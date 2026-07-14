import os
import random
import re
import secrets
from html import escape
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import PracticeAttempt, User

load_dotenv()

LANGUAGETOOL_URL = os.getenv("LANGUAGETOOL_URL", "https://api.languagetool.org/v2/check")

# Admin dashboard (see /admin below) - protected by HTTP Basic Auth rather
# than the app's own username-only "login" (that system has no passwords at
# all, so it can't gate anything sensitive). Requires ADMIN_PASSWORD to be
# set; the route refuses to serve anything if it isn't, rather than falling
# back to a guessable default.
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")

# Comma-separated list of allowed frontend origins, e.g.
# "https://english-master.netlify.app,http://localhost:5173". Defaults to "*"
# (any origin) for easy local development - set this explicitly once deployed.
_allowed_origins = os.getenv("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS = ["*"] if _allowed_origins == "*" else [o.strip() for o in _allowed_origins.split(",")]

Base.metadata.create_all(bind=engine)

app = FastAPI(title="English Master - Speech Practice API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- schemas ----------

class UsernameIn(BaseModel):
    username: str


class UserOut(BaseModel):
    id: int
    username: str

    class Config:
        from_attributes = True


class CheckIn(BaseModel):
    username: str
    text: str


class MatchOut(BaseModel):
    message: str
    short_message: Optional[str] = None
    offset: int
    length: int
    original: str
    suggestions: List[str]


class CheckOut(BaseModel):
    original_text: str
    corrected_text: str
    issues_found: int
    matches: List[MatchOut]


# ---------- helpers ----------

def find_user(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.username.ilike(username.strip())).first()


def get_or_create_user(db: Session, username: str) -> User:
    user = find_user(db, username)
    if user:
        return user
    user = User(username=username.strip())
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def generate_username_suggestions(db: Session, base_username: str, count: int = 3) -> List[str]:
    base = base_username.strip().replace(" ", "")
    candidates = [f"{base}{n}" for n in (1, 2, 7, 21, 99)]
    candidates += [f"{base}_{random.randint(10, 999)}" for _ in range(4)]

    suggestions = []
    for candidate in candidates:
        if not find_user(db, candidate):
            suggestions.append(candidate)
        if len(suggestions) >= count:
            break
    return suggestions


# LanguageTool (rule-based) misses missing-article-before-capitalized-word and
# preposition/collocation errors, since it treats capitalized words like
# "Telecom" as proper nouns exempt from article rules. This catches the very
# common IT-English pattern "working (with/in/on)? <Capitalized...> project/
# domain/team/..." missing "on a" - e.g. "working Telecom domain project",
# "working with Telecom domain project" -> "working on a Telecom domain project".
_WORKING_ON_PROJECT_RE = re.compile(
    r"\b(?:working|work)\s+((?:with|in|on)\s+)?"
    r"([A-Z][a-zA-Z]*\s+(?:[a-z]+\s+){0,2}(?:project|domain|team|module|application|system)s?)\b"
)


def _article_for(word: str) -> str:
    return "an" if word[:1].lower() in "aeiou" else "a"


def custom_rule_matches(text: str) -> List[dict]:
    results = []
    for m in _WORKING_ON_PROJECT_RE.finditer(text):
        prep, noun_phrase = m.group(1), m.group(2).strip()
        start = m.start(1) if prep else m.start(2)
        end = m.end(2)
        suggestion = f"on {_article_for(noun_phrase)} {noun_phrase}"
        results.append(
            {
                "offset": start,
                "length": end - start,
                "message": f"Use \"{suggestion}\" - add the missing article and use 'on' when talking about working on a project.",
                "short_message": "Missing article / preposition",
                "replacements": [suggestion],
            }
        )
    return results


def build_summary(db: Session, user: User) -> dict:
    attempts = (
        db.query(PracticeAttempt)
        .filter(PracticeAttempt.user_id == user.id)
        .order_by(PracticeAttempt.created_at.desc())
        .all()
    )
    total = len(attempts)
    avg_issues = round(sum(a.issues_found for a in attempts) / total, 1) if total else 0

    return {
        "id": user.id,
        "username": user.username,
        "total_attempts": total,
        "avg_issues_found": avg_issues,
        "last_practice_at": attempts[0].created_at.isoformat() if attempts else None,
        "recent": [
            {
                "original_text": a.original_text,
                "corrected_text": a.corrected_text,
                "issues_found": a.issues_found,
                "created_at": a.created_at.isoformat(),
            }
            for a in attempts[:5]
        ],
    }


_admin_security = HTTPBasic()


def verify_admin(credentials: HTTPBasicCredentials = Depends(_admin_security)) -> bool:
    if not ADMIN_PASSWORD:
        raise HTTPException(status_code=503, detail="Admin panel is not configured (set ADMIN_PASSWORD on the server)")
    # secrets.compare_digest to avoid leaking match-length via response timing.
    is_valid_username = secrets.compare_digest(credentials.username, ADMIN_USERNAME)
    is_valid_password = secrets.compare_digest(credentials.password, ADMIN_PASSWORD)
    if not (is_valid_username and is_valid_password):
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Basic"},
        )
    return True


def admin_page(title: str, body: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>{escape(title)} - English Master Admin</title>
<style>
  body {{ margin:0; padding:32px 20px 60px; background:#f5f6fc; color:#1c1e29; font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif; }}
  .wrap {{ max-width:960px; margin:0 auto; }}
  h1 {{ font-size:22px; margin:0 0 4px; }}
  .sub {{ color:#666c7c; font-size:14px; margin:0 0 24px; }}
  a {{ color:#4f46e5; text-decoration:none; }}
  a:hover {{ text-decoration:underline; }}
  .stats-row {{ display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap; }}
  .stat {{ background:#fff; border:1px solid #e2e4ec; border-radius:12px; padding:14px 18px; flex:1 1 140px; }}
  .stat .n {{ font-size:22px; font-weight:800; }}
  .stat .l {{ font-size:12px; color:#666c7c; }}
  table {{ width:100%; border-collapse:collapse; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 2px 10px rgba(20,20,40,.06); }}
  th, td {{ text-align:left; padding:10px 14px; border-bottom:1px solid #e2e4ec; font-size:14px; }}
  th {{ background:#eef0f7; font-size:12px; text-transform:uppercase; letter-spacing:.03em; color:#666c7c; }}
  tr:last-child td {{ border-bottom:none; }}
  .muted {{ color:#666c7c; }}
  .back {{ display:inline-block; margin-bottom:16px; font-size:14px; }}
  .mono {{ font-family:ui-monospace,Consolas,monospace; font-size:13px; }}
</style>
</head>
<body>
<div class="wrap">
{body}
</div>
</body>
</html>"""


# ---------- routes ----------

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/users/check")
def check_username(username: str, db: Session = Depends(get_db)):
    """Used by the New User form to check availability before submitting."""
    taken = find_user(db, username) is not None
    return {"available": not taken}


@app.post("/api/users/signup", response_model=UserOut, status_code=201)
def signup(payload: UsernameIn, db: Session = Depends(get_db)):
    username = payload.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")

    if find_user(db, username):
        suggestions = generate_username_suggestions(db, username)
        raise HTTPException(
            status_code=409,
            detail={
                "message": f"'{username}' is already taken. Try one of these instead:",
                "suggestions": suggestions,
            },
        )

    user = User(username=username)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/users/login")
def login(payload: UsernameIn, db: Session = Depends(get_db)):
    username = payload.username.strip()
    user = find_user(db, username)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"No account found for '{username}'. Create a new account instead?",
        )
    return build_summary(db, user)


@app.get("/api/users/{username}/summary")
def get_summary(username: str, db: Session = Depends(get_db)):
    user = find_user(db, username)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return build_summary(db, user)


@app.post("/api/check", response_model=CheckOut)
async def check_grammar(payload: CheckIn, db: Session = Depends(get_db)):
    """Sends transcribed speech text to LanguageTool for grammar checking,
    builds a corrected version, saves the attempt, and returns feedback."""
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Text is empty")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                LANGUAGETOOL_URL,
                data={"text": text, "language": "en-US"},
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Grammar checker is unavailable")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="Grammar checker is unavailable")

    lt_matches = [
        {
            "offset": m["offset"],
            "length": m["length"],
            "message": m.get("message", ""),
            "short_message": m.get("shortMessage") or None,
            "replacements": [r["value"] for r in m.get("replacements", [])[:3]],
        }
        for m in resp.json().get("matches", [])
    ]

    # Merge LanguageTool's matches with our supplementary pattern rules, then
    # sort by position so corrections can be applied left-to-right. If a
    # custom match overlaps one LanguageTool already found, skip the custom
    # one to avoid corrupting the corrected text with double edits.
    all_matches = sorted(lt_matches + custom_rule_matches(text), key=lambda m: m["offset"])

    matches: List[MatchOut] = []
    corrected = text
    offset_shift = 0
    cursor = 0
    for m in all_matches:
        offset, length = m["offset"], m["length"]
        if offset < cursor:
            continue  # overlaps a match already applied
        cursor = offset + length

        original_fragment = text[offset : offset + length]
        replacements = m["replacements"]

        matches.append(
            MatchOut(
                message=m["message"],
                short_message=m["short_message"],
                offset=offset,
                length=length,
                original=original_fragment,
                suggestions=replacements,
            )
        )

        if replacements:
            start = offset + offset_shift
            end = start + length
            corrected = corrected[:start] + replacements[0] + corrected[end:]
            offset_shift += len(replacements[0]) - length

    user = get_or_create_user(db, payload.username)
    attempt = PracticeAttempt(
        user_id=user.id,
        original_text=text,
        corrected_text=corrected,
        issues_found=len(matches),
    )
    db.add(attempt)
    db.commit()

    return CheckOut(
        original_text=text,
        corrected_text=corrected,
        issues_found=len(matches),
        matches=matches,
    )


@app.get("/api/history/{username}")
def get_history(username: str, db: Session = Depends(get_db)):
    user = find_user(db, username)
    if not user:
        return []
    attempts = (
        db.query(PracticeAttempt)
        .filter(PracticeAttempt.user_id == user.id)
        .order_by(PracticeAttempt.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "original_text": a.original_text,
            "corrected_text": a.corrected_text,
            "issues_found": a.issues_found,
            "created_at": a.created_at.isoformat(),
        }
        for a in attempts
    ]


@app.get("/admin", response_class=HTMLResponse)
def admin_dashboard(db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    """A small server-rendered admin view - not part of the Netlify frontend
    at all, so it needs no CORS configuration and no frontend changes: just
    open https://<this-backend>/admin directly and log in with
    ADMIN_USERNAME/ADMIN_PASSWORD (HTTP Basic Auth, browser-native prompt)."""
    users = db.query(User).order_by(User.created_at.desc()).all()
    total_attempts = db.query(PracticeAttempt).count()

    stats_by_user = {
        row.user_id: row
        for row in db.query(
            PracticeAttempt.user_id,
            func.count(PracticeAttempt.id).label("total"),
            func.avg(PracticeAttempt.issues_found).label("avg_issues"),
            func.max(PracticeAttempt.created_at).label("last_at"),
        ).group_by(PracticeAttempt.user_id)
    }

    rows = ""
    for u in users:
        s = stats_by_user.get(u.id)
        total = s.total if s else 0
        avg_issues = round(s.avg_issues, 1) if s and s.avg_issues is not None else "-"
        last_at = s.last_at.strftime("%Y-%m-%d %H:%M") if s and s.last_at else "-"
        rows += f"""
        <tr>
          <td>{u.id}</td>
          <td><a href="/admin/user/{escape(u.username)}">{escape(u.username)}</a></td>
          <td class="muted">{u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else "-"}</td>
          <td>{total}</td>
          <td>{avg_issues}</td>
          <td class="muted">{last_at}</td>
        </tr>"""

    body = f"""
      <h1>English Master - Admin</h1>
      <p class="sub">All registered accounts and their Speaking Practice / grammar-check activity.</p>
      <div class="stats-row">
        <div class="stat"><div class="n">{len(users)}</div><div class="l">Registered users</div></div>
        <div class="stat"><div class="n">{total_attempts}</div><div class="l">Total practice attempts</div></div>
      </div>
      <table>
        <tr><th>ID</th><th>Username</th><th>Joined</th><th>Attempts</th><th>Avg Issues</th><th>Last Practice</th></tr>
        {rows or '<tr><td colspan="6" class="muted">No users yet.</td></tr>'}
      </table>
    """
    return HTMLResponse(admin_page("Dashboard", body))


@app.get("/admin/user/{username}", response_class=HTMLResponse)
def admin_user_detail(username: str, db: Session = Depends(get_db), _: bool = Depends(verify_admin)):
    user = find_user(db, username)
    if not user:
        return HTMLResponse(admin_page("Not found", '<a class="back" href="/admin">&larr; Back to all users</a><p>No user with that username.</p>'), status_code=404)

    attempts = (
        db.query(PracticeAttempt)
        .filter(PracticeAttempt.user_id == user.id)
        .order_by(PracticeAttempt.created_at.desc())
        .all()
    )

    rows = ""
    for a in attempts:
        rows += f"""
        <tr>
          <td class="muted">{a.created_at.strftime("%Y-%m-%d %H:%M") if a.created_at else "-"}</td>
          <td class="mono">{escape(a.original_text)}</td>
          <td class="mono">{escape(a.corrected_text)}</td>
          <td>{a.issues_found}</td>
        </tr>"""

    body = f"""
      <a class="back" href="/admin">&larr; Back to all users</a>
      <h1>{escape(user.username)}</h1>
      <p class="sub">User #{user.id} · joined {user.created_at.strftime("%Y-%m-%d %H:%M") if user.created_at else "-"} · {len(attempts)} practice attempt{"s" if len(attempts) != 1 else ""}</p>
      <table>
        <tr><th>When</th><th>Said</th><th>Corrected</th><th>Issues</th></tr>
        {rows or '<tr><td colspan="4" class="muted">No practice attempts yet.</td></tr>'}
      </table>
    """
    return HTMLResponse(admin_page(user.username, body))
