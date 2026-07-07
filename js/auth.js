/* Shared account/session logic used by both the front-page login gate and
   the Speaking Practice page. Talks to the FastAPI + PostgreSQL backend. */

// Locally this talks to your local backend. In production (any hostname
// other than localhost), point this at your deployed backend - e.g. after
// deploying to Render: "https://english-master-api.onrender.com".
// See DEPLOY.md.
const API_BASE = (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")
  ? "http://localhost:8000"
  : "https://english-master-api.onrender.com";

const SESSION_KEY = "em_session";

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setSession(username) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username }));
}

function setGuestSession() {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ guest: true }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function apiSignup(username) {
  const res = await fetch(`${API_BASE}/api/users/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 409) {
    const err = new Error(body.detail?.message || "Username already taken");
    err.code = "TAKEN";
    err.suggestions = body.detail?.suggestions || [];
    throw err;
  }
  if (!res.ok) {
    const err = new Error(body.detail || "Sign up failed");
    err.code = "ERROR";
    throw err;
  }
  return body; // { id, username }
}

async function apiLogin(username) {
  const res = await fetch(`${API_BASE}/api/users/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) {
    const err = new Error(body.detail || "No account found");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (!res.ok) {
    const err = new Error(body.detail || "Log in failed");
    err.code = "ERROR";
    throw err;
  }
  return body; // { id, username, total_attempts, avg_issues_found, last_practice_at, recent }
}

async function apiGetSummary(username) {
  const res = await fetch(`${API_BASE}/api/users/${encodeURIComponent(username)}/summary`);
  if (!res.ok) throw new Error("Could not load summary");
  return res.json();
}
