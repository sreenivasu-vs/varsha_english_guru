let CURRICULUM = null;

async function loadCurriculum() {
  const res = await fetch("data/curriculum.json");
  return res.json();
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  document.getElementById("themeToggle").textContent = theme === "dark" ? "☀️" : "🌙";
}

function setupThemeToggle() {
  const progress = getProgress();
  applyTheme(progress.theme || "light");
  document.getElementById("themeToggle").addEventListener("click", () => {
    const p = getProgress();
    const next = p.theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  });
}

function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function showToast(msg) {
  const t = el("div", "toast", msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function renderStats() {
  const progress = getProgress();
  const total = countAllLessons(CURRICULUM);
  const done = Object.keys(progress.completedLessons).length;
  const { level } = xpToLevel(progress.xp);

  document.getElementById("streakCount").textContent = progress.streak.count;
  document.getElementById("xpCount").textContent = progress.xp;
  document.getElementById("levelNum").textContent = level;
  document.getElementById("lessonsCount").textContent = done;
  document.getElementById("lessonsTotal").textContent = total;
  document.getElementById("badgeCount").textContent = getEarnedBadges(progress).length;
}

function renderBadges() {
  const progress = getProgress();
  const earnedIds = new Set(getEarnedBadges(progress).map((b) => b.id));
  const grid = document.getElementById("badgeGrid");
  grid.innerHTML = "";
  BADGES.forEach((b) => {
    const el = document.createElement("div");
    el.className = "badge-item" + (earnedIds.has(b.id) ? " earned" : "");
    el.innerHTML = `<div class="badge-icon">${b.icon}</div><div class="badge-name">${b.name}</div>`;
    grid.appendChild(el);
  });
}

function renderContinue() {
  const progress = getProgress();
  const next = getNextLesson(CURRICULUM, progress);
  const card = document.getElementById("continueCard");
  const content = document.getElementById("continueContent");
  if (!next) {
    card.style.display = "none";
    return;
  }
  card.style.display = "block";
  content.innerHTML = `
    <div style="margin-bottom:10px;color:var(--text-muted);font-size:13px;">Level ${next.levelId} · ${next.moduleTitle}</div>
    <div style="font-weight:700;font-size:17px;margin-bottom:12px;">${next.title}</div>
    <a class="btn block" href="pages/lesson.html#${next.id}">Continue Learning →</a>
  `;
}

function renderWeak() {
  const progress = getProgress();
  const weak = getWeakTopics(CURRICULUM, progress);
  const card = document.getElementById("weakCard");
  const content = document.getElementById("weakContent");
  if (weak.length === 0) {
    card.style.display = "none";
    return;
  }
  card.style.display = "block";
  content.innerHTML = weak
    .slice(0, 3)
    .map(
      (w) => `
    <div class="lesson-row">
      <div class="lesson-check" style="border-color:var(--warning)">⚠</div>
      <div class="lesson-title">${w.title} <span class="lesson-score">(${Math.round(w.pct * 100)}%)</span></div>
      <a class="btn secondary" style="padding:6px 12px;font-size:13px" href="pages/lesson.html#${w.id}">Revise</a>
    </div>`
    )
    .join("");
}

function renderLevels() {
  const progress = getProgress();
  const container = document.getElementById("levelsContainer");
  container.innerHTML = "";

  CURRICULUM.levels.forEach((level) => {
    const allLessons = level.modules.flatMap((m) => m.lessons);
    const doneCount = allLessons.filter((l) => progress.completedLessons[l.id]).length;
    const pct = allLessons.length ? Math.round((doneCount / allLessons.length) * 100) : 0;

    const card = document.createElement("div");
    card.className = "card level-card";

    const header = document.createElement("div");
    header.className = "level-header";
    header.innerHTML = `
      <div class="level-title">
        <div class="level-badge ${pct === 100 ? "done" : ""}">${pct === 100 ? "✓" : level.id}</div>
        <div>
          <div>${level.title}</div>
          <div class="level-progress-text">${doneCount}/${allLessons.length} lessons</div>
        </div>
      </div>
      <div style="width:70px">
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
      </div>
    `;

    const body = document.createElement("div");
    body.className = "level-body";

    level.modules.forEach((mod) => {
      const modBlock = document.createElement("div");
      modBlock.className = "module-block";
      modBlock.innerHTML = `<div class="module-title">${mod.title}</div>`;
      mod.lessons.forEach((lesson) => {
        const result = progress.completedLessons[lesson.id];
        const row = document.createElement("a");
        row.className = "lesson-row";
        row.href = `pages/lesson.html#${lesson.id}`;
        row.innerHTML = `
          <div class="lesson-check ${result ? "complete" : ""}">${result ? "✓" : ""}</div>
          <div class="lesson-title">${lesson.title}</div>
          ${result && result.quizTotal ? `<div class="lesson-score">${result.quizScore}/${result.quizTotal}</div>` : ""}
        `;
        modBlock.appendChild(row);
      });
      body.appendChild(modBlock);
    });

    header.addEventListener("click", () => {
      body.classList.toggle("open");
    });

    card.appendChild(header);
    card.appendChild(body);
    container.appendChild(card);
  });
}

/* PWA install prompt */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById("installBtn").style.display = "flex";
  document.getElementById("installBanner").classList.add("show");
});

function setupInstall() {
  const triggerInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    document.getElementById("installBtn").style.display = "none";
    document.getElementById("installBanner").classList.remove("show");
  };
  document.getElementById("installBtn").addEventListener("click", triggerInstall);
  document.getElementById("installBannerBtn").addEventListener("click", triggerInstall);
}

async function initDashboard() {
  setupThemeToggle();
  setupInstall();
  CURRICULUM = await loadCurriculum();
  renderStats();
  renderGrowthBoard();
  renderBadges();
  renderContinue();
  renderWeak();
  renderLevels();
  renderDailyConversationCard();
  renderFlashcardsCard();
  setupMicPermissionPrompt();

  if ("serviceWorker" in navigator) {
    setupServiceWorkerUpdates();
  }
}

/* Growth Board: the logged-in perk. Every feature works for guests; what an
   account adds is this dashboard section - progress metrics plus "what to
   practice next" recommendations built from the last few 360° Practice
   sessions (localStorage, same data the 360° report uses) and the backend's
   speaking-practice summary when reachable. */
const GROWTH_SKILLS = {
  grammar: { label: "Grammar", icon: "🎯", suggestion: "Play Find the Mistake and revisit the Common Mistakes Bank lessons.", href: "pages/find-the-mistake.html" },
  sentence: { label: "Sentence Formation", icon: "🧩", suggestion: "Play Word Builder and review the Sentence Formation lessons.", href: "pages/word-builder.html" },
  verbForms: { label: "Verb Forms in Context", icon: "📝", suggestion: "Play Fill in the Blank and study tenses in the Verb Mastery Bank.", href: "pages/fill-blank.html" },
  verbs: { label: "Verb Knowledge", icon: "⚡", suggestion: "Play Verb Challenge and browse V1-V5 forms in the Verb Mastery Bank.", href: "pages/verb-challenge.html" },
  vocabulary: { label: "Vocabulary", icon: "🗂️", suggestion: "Do your daily Flashcard Review.", href: "pages/flashcards.html" },
  listening: { label: "Listening", icon: "🎧", suggestion: "Practice dictation and comprehension in Listening Practice.", href: "pages/listening-practice.html" },
  speaking: { label: "Speaking", icon: "🎤", suggestion: "Use Speaking Practice, Shadowing and the Pronunciation Coach.", href: "pages/pronunciation-coach.html" },
};

async function renderGrowthBoard() {
  const container = document.getElementById("growthBoard");
  if (!container) return;
  const session = getSession();

  if (!session || !session.username) {
    container.innerHTML = `
      <div class="card">
        <div class="section-title" style="margin-top:0">📈 Growth Board</div>
        <p style="margin:0;color:var(--text-muted);font-size:14px;">You're practicing as a guest - everything works, nothing is locked. Log in (👤 above) to unlock this personal Growth Board: progress metrics plus recommendations on what to practice next for faster results.</p>
      </div>
    `;
    return;
  }

  let history = [];
  try {
    history = JSON.parse(localStorage.getItem("em_practice360_v1")) || [];
  } catch (e) { /* corrupt/absent history just means no skill data yet */ }
  const recent = history.slice(-3);

  const skillAvgs = {};
  Object.keys(GROWTH_SKILLS).forEach((k) => {
    const vals = recent.map((h) => h.skills[k]).filter((v) => v !== null && v !== undefined);
    skillAvgs[k] = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  });
  const scored = Object.keys(GROWTH_SKILLS).filter((k) => skillAvgs[k] !== null);

  let skillsHtml = "";
  if (!scored.length) {
    skillsHtml = `<p style="margin:0 0 10px;color:var(--text-muted);font-size:14px;">Take a <a href="pages/practice-360.html" style="color:var(--primary);font-weight:700;text-decoration:underline;">360° Practice session</a> to see your per-skill strengths here and get personalized recommendations.</p>`;
  } else {
    skillsHtml = scored.map((k) => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:3px;">
          <span>${GROWTH_SKILLS[k].icon} ${GROWTH_SKILLS[k].label}</span>
          <span style="font-weight:700;">${skillAvgs[k]}%</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${skillAvgs[k]}%"></div></div>
      </div>
    `).join("");

    let weak = scored.filter((k) => skillAvgs[k] < 70).sort((a, b) => skillAvgs[a] - skillAvgs[b]);
    if (!weak.length) {
      const lowest = scored.reduce((a, b) => (skillAvgs[a] <= skillAvgs[b] ? a : b));
      if (skillAvgs[lowest] < 100) weak = [lowest];
    }
    if (weak.length) {
      skillsHtml += `<div style="font-size:13px;font-weight:700;margin:12px 0 6px;">Practice next for faster results:</div>`;
      skillsHtml += weak.slice(0, 3).map((k) => `
        <div class="mistake-item">
          <div style="font-weight:700;">${GROWTH_SKILLS[k].icon} ${GROWTH_SKILLS[k].label} · ${skillAvgs[k]}%</div>
          <div class="mistake-why">${GROWTH_SKILLS[k].suggestion}</div>
          <div style="margin-top:4px;font-size:13px;"><a href="${GROWTH_SKILLS[k].href}" style="color:var(--primary);font-weight:700;text-decoration:underline;">Practice now →</a></div>
        </div>
      `).join("");
    } else {
      skillsHtml += `<p style="margin:10px 0 0;color:var(--accent);font-size:14px;font-weight:700;">💯 Every skill at 100% recently - outstanding! Keep the streak alive.</p>`;
    }
  }

  container.innerHTML = `
    <div class="card">
      <div class="section-title" style="margin-top:0">📈 Growth Board</div>
      <div id="growthSummary" style="font-size:13px;color:var(--text-muted);margin-bottom:12px;"></div>
      ${skillsHtml}
    </div>
  `;

  /* Backend speaking summary - best effort, silently absent if unreachable */
  try {
    const summary = await apiGetSummary(session.username);
    if (summary && summary.total_attempts) {
      const last = summary.last_practice_at ? new Date(summary.last_practice_at).toLocaleDateString() : null;
      const summaryEl = document.getElementById("growthSummary");
      if (summaryEl) {
        summaryEl.textContent = `🎤 ${summary.total_attempts} speaking attempt${summary.total_attempts === 1 ? "" : "s"} saved · avg ${summary.avg_issues_found} issue${summary.avg_issues_found === 1 ? "" : "s"} per sentence${last ? ` · last practiced ${last}` : ""}`;
      }
    }
  } catch (e) { /* backend offline - board still shows local skill data */ }
}

/* Browsers give web apps no way to request permissions during the actual
   "Install" step - there's no API hook into that native OS prompt. The
   closest practical equivalent is asking right when the app is first
   opened, before the user ever reaches a mic-based feature, instead of
   surprising them with a permission prompt deep inside Speaking Practice. */
const MIC_PROMPT_DISMISSED_KEY = "em_mic_prompt_dismissed";

async function setupMicPermissionPrompt() {
  const card = document.getElementById("micPermissionCard");
  if (!card || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
  if (localStorage.getItem(MIC_PROMPT_DISMISSED_KEY)) return;

  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: "microphone" });
      if (status.state === "granted" || status.state === "denied") return;
    } catch (e) {
      // Permissions API doesn't support querying "microphone" in this browser (e.g. Safari) - fall through and show the prompt once.
    }
  }

  card.style.display = "block";

  document.getElementById("enableMicBtn").onclick = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      localStorage.setItem(MIC_PROMPT_DISMISSED_KEY, "1");
      card.style.display = "none";
      showToast("✅ Microphone enabled - you're all set for speaking practice.");
    } catch (e) {
      localStorage.setItem(MIC_PROMPT_DISMISSED_KEY, "1");
      card.style.display = "none";
      showToast("Microphone access wasn't granted. You can enable it later in your phone's Settings.");
    }
  };

  document.getElementById("dismissMicBtn").onclick = () => {
    localStorage.setItem(MIC_PROMPT_DISMISSED_KEY, "1");
    card.style.display = "none";
  };
}

function dayOfYear(d = new Date()) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  return Math.floor(diff / 86400000);
}

async function renderDailyConversationCard() {
  const topicEl = document.getElementById("dailyConvTopic");
  const doneEl = document.getElementById("dailyConvDone");
  if (!topicEl) return;
  try {
    const res = await fetch("data/daily-conversations.json");
    const scenarios = await res.json();
    const today = scenarios[dayOfYear() % scenarios.length];
    topicEl.textContent = today.topic;
  } catch (e) {
    topicEl.textContent = "Available now";
  }
  const progress = getProgress();
  if (progress.dailyConversation && progress.dailyConversation.lastCompletedDate === todayStr()) {
    doneEl.style.display = "inline";
  }
}

async function renderFlashcardsCard() {
  const dueEl = document.getElementById("flashcardsDue");
  if (!dueEl) return;
  try {
    const res = await fetch("data/flashcards.json");
    const cards = await res.json();
    const due = peekDueCount(cards);
    dueEl.textContent = due === 0 ? "No cards" : `${due} card${due === 1 ? "" : "s"}`;
  } catch (e) {
    dueEl.textContent = "Ready now";
  }
}

/* Installed PWAs only get a new service worker check automatically once
   every ~24h by default. registration.update() forces an immediate check on
   load and whenever the app returns to the foreground, and the banner below
   lets the user pick up new content the moment it's ready instead of
   waiting on the browser's internal timer. */
function setupServiceWorkerUpdates() {
  navigator.serviceWorker.register("service-worker.js").then((registration) => {
    registration.update();

    registration.addEventListener("updatefound", () => {
      const newWorker = registration.installing;
      if (!newWorker) return;
      newWorker.addEventListener("statechange", () => {
        if (newWorker.state === "activated" && navigator.serviceWorker.controller) {
          showUpdateBanner();
        }
      });
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") registration.update();
    });
  }).catch(() => {});
}

function showUpdateBanner() {
  if (document.getElementById("swUpdateBanner")) return;
  const banner = document.createElement("div");
  banner.id = "swUpdateBanner";
  banner.className = "sw-update-banner";
  banner.innerHTML = `
    <span>A new version is ready.</span>
    <button type="button" id="swUpdateBtn">Refresh</button>
  `;
  document.body.appendChild(banner);
  document.getElementById("swUpdateBtn").addEventListener("click", () => window.location.reload());
}

/* Dashboard rendering only starts after the login gate (js/auth-gate.js)
   resolves - either with a logged-in user or a "continue as guest" choice. */
