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
  renderBadges();
  renderContinue();
  renderWeak();
  renderLevels();
  renderDailyConversationCard();

  if ("serviceWorker" in navigator) {
    setupServiceWorkerUpdates();
  }
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
