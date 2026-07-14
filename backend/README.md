# Speech Practice API (FastAPI + PostgreSQL)

Minimal backend for the Speaking Practice feature: receives text transcribed
by the browser's Web Speech API, checks grammar via LanguageTool, and saves
the user + each practice attempt to PostgreSQL.

## Setup

1. Create a PostgreSQL database:
   ```
   createdb english_master
   ```
   (or via psql: `CREATE DATABASE english_master;`)

2. Install dependencies:
   ```
   cd backend
   python -m venv venv
   venv\Scripts\activate        # Windows
   pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env` and adjust `DATABASE_URL` if your Postgres
   user/password/host differ from the default.

4. Run the server:
   ```
   uvicorn main:app --reload --port 8000
   ```

Tables are created automatically on first run (no migration tool needed for
this minimal setup).

## Quick local run without PostgreSQL (SQLite)

For local testing you can skip Postgres entirely and use the bundled SQLite
database instead - no database server needed:

```powershell
# PowerShell, from the backend folder
$env:DATABASE_URL = "sqlite:///./dev.db"
venv\Scripts\python.exe -m uvicorn main:app --port 8000
```

```bash
# Git Bash / macOS / Linux
DATABASE_URL="sqlite:///./dev.db" ./venv/Scripts/python.exe -m uvicorn main:app --port 8000
```

The frontend served at localhost automatically points at
`http://localhost:8000`, so once this is running, Speaking Practice, Daily
Conversation, the Speaking Test and grammar scoring all work locally.
(The deployed Netlify site uses the Render backend instead - this is only
for local testing.)

## Endpoints

- `GET /api/users/check?username=xxx` - `{ available }` - checks if a username is free
- `POST /api/users/signup` - `{ username }` - creates a new account; `409` with suggested alternatives if the name is taken
- `POST /api/users/login` - `{ username }` - returns the account + a progress summary if it exists; `404` if not
- `GET /api/users/{username}/summary` - practice stats (total attempts, average issues, recent attempts)
- `POST /api/check` - `{ username, text }` - grammar-checks a sentence, saves the attempt, returns corrections
- `GET /api/history/{username}` - last 20 practice attempts for that user
- `GET /admin` - server-rendered admin dashboard (see below)
- `GET /admin/user/{username}` - that user's full practice history

## Admin dashboard

`/admin` lists every registered user (joined date, attempt count, average
grammar issues, last-practice time), and clicking a username drills into
their full attempt history. It's a plain server-rendered page on the
**backend itself** - not part of the Netlify frontend - so there's nothing
to deploy on Netlify and no CORS configuration involved: just open
`https://<your-backend-domain>/admin` directly in a browser.

It's protected by HTTP Basic Auth (the browser will show its own native
login prompt). Set these in `.env` locally and as environment variables on
Render for the deployed backend:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD=choose-a-real-password-here
```

If `ADMIN_PASSWORD` isn't set, `/admin` returns a `503` rather than falling
back to a guessable default - it's disabled by default until you configure
a real password.

## Swapping to self-hosted LanguageTool later

By default this uses the free public API (`https://api.languagetool.org/v2/check`),
which needs no setup but is rate-limited. To self-host instead:

```
docker run -d -p 8010:8010 erikvl87/languagetool
```

Then set in `.env`:
```
LANGUAGETOOL_URL=http://localhost:8010/v2/check
```

No code changes needed - the backend just calls whatever URL is configured.

## Custom grammar rules

LanguageTool (rule-based, free/self-hosted) misses some common ESL patterns -
notably missing articles before capitalized words (it treats them as proper
nouns) and preposition/collocation errors. `custom_rule_matches()` in
`main.py` supplements LanguageTool with small, targeted regex rules for
patterns it misses. Currently included: "working (with/in/on)? <Capitalized
word> project/domain/team/..." missing "on a" (e.g. "working Telecom domain
project" -> "working on a Telecom domain project"). Add more patterns there
as you find gaps - each just needs an offset, length, message, and suggested
replacement, and it merges into the same response the frontend already reads.
