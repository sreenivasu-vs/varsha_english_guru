/* Flashcard Review: spaced-repetition drill over the 3000 vocab/phrase/
   mistake items already taught across the lessons (see js/srs.js for the
   scheduling engine). No login or backend needed - runs entirely off
   localStorage, so progress carries over session to session. */

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

function showToast(msg) {
  const t = el("div", "toast", msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

let ALL_CARDS = [];
let sessionQueue = [];
let sessionPos = 0;
let sessionStats = { again: 0, good: 0, easy: 0 };

const TYPE_LABELS = { vocab: "IT Vocabulary", phrase: "Business Phrase", mistake: "Common Mistake" };

function renderStartScreen(container) {
  container.innerHTML = "";
  const dueCount = peekDueCount(ALL_CARDS);

  const card = el("div", "card");
  if (dueCount === 0) {
    card.innerHTML = `
      <div class="section-title" style="margin-top:0">All Caught Up!</div>
      <p style="margin:0;color:var(--text-muted);font-size:14.5px;">No cards are due right now. Come back later today or tomorrow for your next review batch.</p>
    `;
    container.appendChild(card);
    return;
  }

  card.innerHTML = `
    <div class="section-title" style="margin-top:0">Ready to Review</div>
    <p style="margin:0 0 12px;color:var(--text-muted);font-size:14.5px;">You have <b style="color:var(--text);">${dueCount}</b> card${dueCount === 1 ? "" : "s"} ready - a mix of new items and ones due for review. Each card you see and rate gets scheduled to come back right before you'd forget it.</p>
  `;
  const startBtn = el("button", "btn block", "▶ Start Review Session");
  startBtn.onclick = () => startSession(container);
  card.appendChild(startBtn);
  container.appendChild(card);
}

function startSession(container) {
  sessionQueue = startTodayQueue(ALL_CARDS);
  sessionPos = 0;
  sessionStats = { again: 0, good: 0, easy: 0 };
  renderCard(container);
}

function renderCard(container) {
  container.innerHTML = "";
  const item = sessionQueue[sessionPos];

  const counter = el("div", "", `Card ${sessionPos + 1} of ${sessionQueue.length}`);
  counter.style.cssText = "text-align:center;font-size:13px;color:var(--text-muted);margin-bottom:10px;";
  container.appendChild(counter);

  const card = el("div", "card");
  card.innerHTML = `
    <div class="tag">${TYPE_LABELS[item.type]}${item.sub && item.sub !== TYPE_LABELS[item.type] ? " · " + escapeHtml(item.sub) : ""}</div>
    <p style="margin:16px 0;font-size:19px;font-weight:700;line-height:1.5;">${escapeHtml(item.front)}</p>
  `;
  const listenBtn = el("button", "btn secondary block", "🔊 Listen");
  listenBtn.onclick = () => speak(item.front);
  card.appendChild(listenBtn);

  const answerArea = el("div");
  answerArea.style.marginTop = "14px";
  card.appendChild(answerArea);

  const showBtn = el("button", "btn block", "Show Answer");
  showBtn.style.marginTop = "10px";
  showBtn.onclick = () => {
    showBtn.style.display = "none";
    renderAnswer(answerArea, item, container);
  };
  card.appendChild(showBtn);

  container.appendChild(card);
}

function renderAnswer(answerArea, item, container) {
  answerArea.innerHTML = "";
  const isMistake = item.type === "mistake";
  answerArea.innerHTML = `
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">${isMistake ? "Correct version:" : "Meaning:"}</div>
    <div style="font-weight:700;color:var(--accent);margin-bottom:10px;font-size:16px;">${escapeHtml(item.back)}</div>
    ${item.example ? `<div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">${isMistake ? "Why:" : "Example:"}</div><div style="font-style:${isMistake ? "normal" : "italic"};">${escapeHtml(item.example)}</div>` : ""}
  `;

  const ratingRow = el("div");
  ratingRow.style.cssText = "display:flex;gap:8px;margin-top:16px;";
  const ratings = [
    { key: "again", label: "😕 Again", cls: "btn secondary" },
    { key: "good", label: "🙂 Good", cls: "btn secondary" },
    { key: "easy", label: "😄 Easy", cls: "btn secondary" },
  ];
  ratings.forEach((r) => {
    const btn = el("button", r.cls, r.label);
    btn.style.flex = "1";
    btn.onclick = () => {
      rateCard(item.id, r.key);
      sessionStats[r.key] += 1;
      sessionPos += 1;
      if (sessionPos >= sessionQueue.length) finishSession(container);
      else renderCard(container);
    };
    ratingRow.appendChild(btn);
  });
  answerArea.appendChild(ratingRow);
}

function finishSession(container) {
  const result = recordFlashcardSession();
  container.innerHTML = "";
  const card = el("div", "card");
  card.innerHTML = `
    <div class="section-title" style="margin-top:0">🎉 Session Complete!</div>
    <p style="margin:0 0 10px;color:var(--text-muted);font-size:14.5px;">You reviewed ${sessionQueue.length} card${sessionQueue.length === 1 ? "" : "s"}: ${sessionStats.again} to revisit soon, ${sessionStats.good} good, ${sessionStats.easy} easy.</p>
  `;
  const backBtn = el("button", "btn block", "← Back to Overview");
  backBtn.onclick = () => renderStartScreen(container);
  card.appendChild(backBtn);
  container.appendChild(card);

  if (result.awarded) {
    showToast("✅ Review session complete · +20 XP earned");
  }
}

async function init() {
  setupThemeToggle();
  const container = document.getElementById("flashcardsContainer");
  container.innerHTML = `<div class="empty-state">Loading flashcards...</div>`;
  try {
    const res = await fetch("../data/flashcards.json");
    ALL_CARDS = await res.json();
    renderStartScreen(container);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load flashcards. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
