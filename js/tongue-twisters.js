/* Tongue Twisters: pick one of 10 sound-focused sets, then run a 1-minute
   auto-scrolling teleprompter drill - read aloud continuously as the text
   scrolls, the same way news anchors and actors rehearse articulation. No
   backend, no login, no grading - a pure pronunciation drill. */

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

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

let SETS = [];
// Seconds of scroll time per twister sentence, not a fixed total - so the
// scroll duration scales with however many unique twisters a set has,
// instead of a fixed loop time that forces short sets to repeat content.
const SECONDS_PER_TWISTER = { slow: 10, normal: 6, fast: 3.5 };
let currentSpeed = "normal";
let countdownInterval = null;

function ensureScrollAnimationStyle() {
  if (document.getElementById("scrollTwisterStyle")) return;
  const style = el("style");
  style.id = "scrollTwisterStyle";
  style.textContent = `
    @keyframes scrollTwisters {
      from { transform: translateY(0); }
      to { transform: translateY(-100%); }
    }
  `;
  document.head.appendChild(style);
}

function renderSetGrid(container) {
  container.innerHTML = "";
  const intro = el("div", "card", `
    <p style="margin:0;font-size:14.5px;color:var(--text-muted);">Pick a set below, then start a 1-minute scrolling drill. Read every word out loud as it scrolls by - focus on clarity over speed at first, then try to keep up as it moves.</p>
  `);
  intro.style.background = "var(--surface-2)";
  container.appendChild(intro);

  SETS.forEach((set) => {
    const card = el("div", "card");
    card.innerHTML = `
      <div class="section-title" style="margin-top:0">${escapeHtml(set.title)}</div>
      <p style="margin:0 0 10px;font-size:13.5px;color:var(--text-muted);">${escapeHtml(set.focus)}</p>
    `;
    const startBtn = el("button", "btn block", "▶ Start 1-Minute Practice");
    startBtn.onclick = () => renderPracticeView(container, set);
    card.appendChild(startBtn);
    container.appendChild(card);
  });
}

function renderPracticeView(container, set) {
  container.innerHTML = "";
  ensureScrollAnimationStyle();

  const header = el("div", "card");
  header.innerHTML = `<div class="section-title" style="margin-top:0">${escapeHtml(set.title)}</div>`;
  const controlsRow = el("div");
  controlsRow.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:10px;";

  const listenBtn = el("button", "btn secondary", "🔊 Listen Once");
  listenBtn.onclick = () => speak(set.twisters.join(". "));
  controlsRow.appendChild(listenBtn);

  const speedSelect = el("select", "text-input");
  speedSelect.style.cssText = "width:auto;padding:8px 10px;";
  ["slow", "normal", "fast"].forEach((s) => {
    const opt = el("option", "", s.charAt(0).toUpperCase() + s.slice(1));
    opt.value = s;
    if (s === currentSpeed) opt.selected = true;
    speedSelect.appendChild(opt);
  });
  speedSelect.onchange = () => {
    currentSpeed = speedSelect.value;
    const duration = set.twisters.length * SECONDS_PER_TWISTER[currentSpeed];
    scrollContent.style.animationDuration = duration + "s";
  };
  controlsRow.appendChild(speedSelect);
  header.appendChild(controlsRow);

  const timerDisplay = el("div", "", "60");
  timerDisplay.style.cssText = "font-size:32px;font-weight:800;text-align:center;color:var(--primary);margin-bottom:6px;";
  header.appendChild(timerDisplay);
  container.appendChild(header);

  const viewport = el("div");
  viewport.style.cssText = "height:220px;overflow:hidden;position:relative;background:var(--surface-2);border-radius:var(--radius);border:1px solid var(--border);";
  const scrollContent = el("div");
  const initialDuration = set.twisters.length * SECONDS_PER_TWISTER[currentSpeed];
  scrollContent.style.cssText = `animation: scrollTwisters ${initialDuration}s linear 1 forwards; padding:16px;`;
  const twisterText = set.twisters
    .map((t) => `<p style="font-size:22px;font-weight:700;line-height:1.7;margin:0 0 28px;">"${escapeHtml(t)}"</p>`)
    .join("");
  scrollContent.innerHTML = twisterText;
  viewport.appendChild(scrollContent);
  container.appendChild(viewport);

  const buttonRow = el("div");
  buttonRow.style.cssText = "display:flex;gap:8px;margin-top:14px;";
  const pauseBtn = el("button", "btn secondary block", "⏸ Pause");
  const stopBtn = el("button", "btn secondary block", "⏹ Stop");
  buttonRow.appendChild(pauseBtn);
  buttonRow.appendChild(stopBtn);
  container.appendChild(buttonRow);

  const resultArea = el("div");
  resultArea.style.marginTop = "14px";
  container.appendChild(resultArea);

  let secondsLeft = 60;
  let isPaused = false;

  function finishPractice() {
    clearInterval(countdownInterval);
    scrollContent.style.animationPlayState = "paused";
    pauseBtn.disabled = true;
    stopBtn.textContent = "← Back to Sets";
    resultArea.innerHTML = `<div class="feedback-box correct">⏱ Time's up! Nice articulation practice.</div>`;
    const againBtn = el("button", "btn block", "🔁 Practice This Set Again");
    againBtn.style.marginTop = "10px";
    againBtn.onclick = () => renderPracticeView(container, set);
    resultArea.appendChild(againBtn);
  }

  countdownInterval = setInterval(() => {
    if (isPaused) return;
    secondsLeft -= 1;
    timerDisplay.textContent = String(secondsLeft);
    if (secondsLeft <= 0) finishPractice();
  }, 1000);

  pauseBtn.onclick = () => {
    isPaused = !isPaused;
    scrollContent.style.animationPlayState = isPaused ? "paused" : "running";
    pauseBtn.textContent = isPaused ? "▶ Resume" : "⏸ Pause";
  };

  stopBtn.onclick = () => {
    clearInterval(countdownInterval);
    renderSetGrid(container);
  };
}

async function init() {
  setupThemeToggle();
  const container = document.getElementById("twistersContainer");
  container.innerHTML = `<div class="empty-state">Loading...</div>`;
  try {
    const res = await fetch("../data/tongue-twisters.json");
    SETS = await res.json();
    renderSetGrid(container);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load tongue twisters. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
