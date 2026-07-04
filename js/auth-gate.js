/* Front-page login gate: New User / Existing User / continue as guest.
   The dashboard ("growth board" - stats, streak, XP, badges, course levels)
   stays hidden until this resolves, via enterApp(), which reveals it and
   starts initDashboard() (js/app.js). */

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function gateEl() {
  return document.getElementById("authGate");
}

function renderGate() {
  gateEl().style.display = "block";
  gateEl().innerHTML = `
    <div class="card" style="max-width:420px;margin:60px auto;">
      <div class="section-title" style="margin-top:0;text-align:center;">Welcome to English Master</div>
      <p style="text-align:center;color:var(--text-muted);margin-bottom:20px;">Are you a new or existing user?</p>
      <button class="btn block" id="newUserBtn" style="margin-bottom:10px;">🆕 New User</button>
      <button class="btn secondary block" id="existingUserBtn">👋 Existing User</button>
      <button id="guestBtn" style="display:block;width:100%;background:none;border:none;color:var(--text-muted);text-align:center;margin-top:18px;font-size:13px;text-decoration:underline;">Continue without an account</button>
    </div>
  `;
  document.getElementById("newUserBtn").onclick = () => renderSignupForm();
  document.getElementById("existingUserBtn").onclick = () => renderLoginForm();
  document.getElementById("guestBtn").onclick = () => continueAsGuest();
}

function renderSignupForm(prefill = "") {
  gateEl().innerHTML = `
    <div class="card" style="max-width:420px;margin:60px auto;">
      <div class="section-title" style="margin-top:0;">Create Your Account</div>
      <input class="text-input" id="signupUsername" placeholder="Choose a username" value="${escapeHtml(prefill)}" />
      <div id="signupMsg"></div>
      <button class="btn block" id="signupSubmit">Create Account</button>
      <button class="btn secondary block" id="backBtn" style="margin-top:10px;">← Back</button>
    </div>
  `;
  document.getElementById("backBtn").onclick = renderGate;
  document.getElementById("signupSubmit").onclick = () => submitSignup();
  document.getElementById("signupUsername").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitSignup();
  });
}

async function submitSignup() {
  const username = document.getElementById("signupUsername").value.trim();
  const msg = document.getElementById("signupMsg");
  if (!username) {
    msg.innerHTML = `<div class="feedback-box incorrect">Please enter a username.</div>`;
    return;
  }
  msg.innerHTML = `<div style="color:var(--text-muted);font-size:13px;margin:8px 0;">Checking availability...</div>`;

  try {
    await apiSignup(username);
    setSession(username);
    enterApp({ username, isNew: true });
  } catch (e) {
    if (e.code === "TAKEN") {
      msg.innerHTML = `
        <div class="feedback-box incorrect">${escapeHtml(e.message)}</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0;">
          ${e.suggestions.map((s) => `<button class="tag suggestion-chip" data-name="${escapeHtml(s)}" style="cursor:pointer;">${escapeHtml(s)}</button>`).join("")}
        </div>
      `;
      msg.querySelectorAll(".suggestion-chip").forEach((chip) => {
        chip.onclick = () => {
          document.getElementById("signupUsername").value = chip.dataset.name;
          submitSignup();
        };
      });
    } else {
      msg.innerHTML = `
        <div class="feedback-box incorrect">Couldn't reach the account server. Is the backend running? (see backend/README.md)</div>
        <button class="btn secondary block" id="guestFallback" style="margin-top:8px;">Continue without an account</button>
      `;
      document.getElementById("guestFallback").onclick = continueAsGuest;
    }
  }
}

function renderLoginForm(prefill = "") {
  gateEl().innerHTML = `
    <div class="card" style="max-width:420px;margin:60px auto;">
      <div class="section-title" style="margin-top:0;">Welcome Back</div>
      <input class="text-input" id="loginUsername" placeholder="Enter your username" value="${escapeHtml(prefill)}" />
      <div id="loginMsg"></div>
      <button class="btn block" id="loginSubmit">Log In</button>
      <button class="btn secondary block" id="backBtn" style="margin-top:10px;">← Back</button>
    </div>
  `;
  document.getElementById("backBtn").onclick = renderGate;
  document.getElementById("loginSubmit").onclick = () => submitLogin();
  document.getElementById("loginUsername").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitLogin();
  });
}

async function submitLogin() {
  const username = document.getElementById("loginUsername").value.trim();
  const msg = document.getElementById("loginMsg");
  if (!username) {
    msg.innerHTML = `<div class="feedback-box incorrect">Please enter your username.</div>`;
    return;
  }
  msg.innerHTML = `<div style="color:var(--text-muted);font-size:13px;margin:8px 0;">Checking...</div>`;

  try {
    const summary = await apiLogin(username);
    setSession(username);
    enterApp({ username, isNew: false, summary });
  } catch (e) {
    if (e.code === "NOT_FOUND") {
      msg.innerHTML = `
        <div class="feedback-box incorrect">${escapeHtml(e.message)}</div>
        <button class="btn block" id="createInsteadBtn" style="margin-top:8px;">Create account "${escapeHtml(username)}" instead</button>
      `;
      document.getElementById("createInsteadBtn").onclick = () => renderSignupForm(username);
    } else {
      msg.innerHTML = `
        <div class="feedback-box incorrect">Couldn't reach the account server. Is the backend running? (see backend/README.md)</div>
        <button class="btn secondary block" id="guestFallback" style="margin-top:8px;">Continue without an account</button>
      `;
      document.getElementById("guestFallback").onclick = continueAsGuest;
    }
  }
}

function continueAsGuest() {
  setGuestSession();
  enterApp({ guest: true });
}

function renderWelcomeBanner({ username, isNew, summary, guest }) {
  const banner = document.getElementById("welcomeBanner");
  if (guest) {
    banner.style.display = "none";
    return;
  }
  banner.style.display = "block";

  if (isNew) {
    banner.innerHTML = `<div class="card"><div style="font-weight:700;">👋 Welcome, ${escapeHtml(username)}! Your account is ready.</div></div>`;
    return;
  }
  if (summary) {
    const last = summary.last_practice_at ? new Date(summary.last_practice_at).toLocaleDateString() : null;
    banner.innerHTML = `
      <div class="card">
        <div style="font-weight:700;margin-bottom:6px;">👋 Welcome back, ${escapeHtml(username)}!</div>
        <div style="font-size:14px;color:var(--text-muted);">
          🎤 ${summary.total_attempts} speaking practice attempt${summary.total_attempts === 1 ? "" : "s"}
          ${summary.total_attempts ? ` · avg ${summary.avg_issues_found} issue${summary.avg_issues_found === 1 ? "" : "s"} per sentence` : ""}
          ${last ? ` · last practiced ${last}` : ""}
        </div>
      </div>
    `;
  } else {
    banner.innerHTML = `<div class="card"><div style="font-weight:700;">👋 Welcome back, ${escapeHtml(username)}!</div></div>`;
  }
}

function enterApp(opts) {
  gateEl().style.display = "none";
  gateEl().innerHTML = "";
  document.getElementById("dashboardContent").style.display = "block";
  document.getElementById("switchUserBtn").style.display = "flex";
  document.getElementById("switchUserBtn").title = opts.guest ? "Log in / Sign up" : "Log out";
  renderWelcomeBanner(opts);
  initDashboard();
}

async function initAuthGate() {
  document.getElementById("switchUserBtn").addEventListener("click", () => {
    const session = getSession();
    if (session && session.username) {
      clearSession();
      window.location.reload();
    } else {
      clearSession();
      document.getElementById("dashboardContent").style.display = "none";
      document.getElementById("switchUserBtn").style.display = "none";
      renderGate();
    }
  });

  const session = getSession();
  if (!session) {
    renderGate();
    return;
  }
  if (session.guest) {
    enterApp({ guest: true });
    return;
  }

  try {
    const summary = await apiGetSummary(session.username);
    enterApp({ username: session.username, isNew: false, summary });
  } catch (e) {
    // Backend unreachable - trust the cached local session rather than
    // locking the user out of the whole app.
    enterApp({ username: session.username, isNew: false, summary: null });
  }
}

initAuthGate();
