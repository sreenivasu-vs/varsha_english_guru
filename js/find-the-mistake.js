/* Find the Mistake: a short sentence with one or more wrong words is shown
   as clickable word chips. Tap the word(s) you think are wrong, then check
   your answer - see the corrected sentence and a teacher-style explanation.
   Content and the "which word is wrong" detection are both pulled from the
   existing 1000-item Common Mistakes bank (see data/mistake-game.json,
   generated from data/lessons/mistakes-*.json). No login or backend needed. */

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

let ITEMS = [];
let shuffleState = { order: [], pos: 0 };
let sessionScore = { perfect: 0, attempted: 0 };

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeShuffleState(length) {
  return { order: shuffleArray(Array.from({ length }, (_, i) => i)), pos: 0 };
}

function currentItemIndex(state) {
  return state.order[state.pos];
}

function advanceShuffleState(state) {
  state.pos += 1;
  if (state.pos >= state.order.length) {
    const lastIndex = state.order[state.order.length - 1];
    let reshuffled = shuffleArray(state.order);
    if (reshuffled.length > 1 && reshuffled[0] === lastIndex) {
      [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
    }
    state.order = reshuffled;
    state.pos = 0;
  }
}

function renderScoreBar(container) {
  const bar = el("div", "", `Score: ${sessionScore.perfect} / ${sessionScore.attempted} perfect rounds`);
  bar.style.cssText = "text-align:center;font-size:13px;color:var(--text-muted);margin-bottom:10px;";
  container.appendChild(bar);
}

function renderRound(container) {
  container.innerHTML = "";
  renderScoreBar(container);

  const item = ITEMS[currentItemIndex(shuffleState)];
  const selected = new Set();
  let checked = false;

  const card = el("div", "card");
  card.innerHTML = `<div class="section-title" style="margin-top:0">Find the Mistake</div><p style="margin:0 0 12px;font-size:13.5px;color:var(--text-muted);">Tap the word or words that are wrong in this sentence.</p>`;

  const sentenceWrap = el("div");
  sentenceWrap.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;font-size:18px;font-weight:700;line-height:2;";

  const wordButtons = item.wrongTokens.map((word, idx) => {
    const btn = el("button", "mistake-word-chip", escapeHtml(word));
    btn.onclick = () => {
      if (checked) return;
      if (selected.has(idx)) {
        selected.delete(idx);
        btn.classList.remove("selected");
      } else {
        selected.add(idx);
        btn.classList.add("selected");
      }
    };
    sentenceWrap.appendChild(btn);
    return btn;
  });
  card.appendChild(sentenceWrap);

  const checkBtn = el("button", "btn block", "Check Answer");
  const resultArea = el("div");
  resultArea.style.marginTop = "14px";

  checkBtn.onclick = () => {
    if (checked) return;
    checked = true;
    checkBtn.disabled = true;

    const mistakeSet = new Set(item.mistakeIndices);
    let foundAll = true;
    wordButtons.forEach((btn, idx) => {
      const isMistake = mistakeSet.has(idx);
      const wasSelected = selected.has(idx);
      btn.classList.remove("selected");
      if (isMistake && wasSelected) btn.classList.add("correct-catch");
      else if (isMistake && !wasSelected) { btn.classList.add("missed-catch"); foundAll = false; }
      else if (!isMistake && wasSelected) { btn.classList.add("wrong-catch"); foundAll = false; }
    });

    sessionScore.attempted += 1;
    if (foundAll) sessionScore.perfect += 1;
    container.querySelector("div").textContent = `Score: ${sessionScore.perfect} / ${sessionScore.attempted} perfect rounds`;

    resultArea.innerHTML = `
      <div class="feedback-box ${foundAll ? "correct" : "incorrect"}">${foundAll ? "✅ Perfect! You found the mistake." : "⚠ Not quite - see the highlights above."}</div>
      <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Correct sentence:</div>
      <div style="margin-top:4px;font-size:17px;font-weight:700;color:var(--accent);">${escapeHtml(item.right)}</div>
      <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Why:</div>
      <div style="margin-top:4px;">${escapeHtml(item.why)}</div>
    `;
    const speakBtn = el("button", "speak-btn", "🔊");
    speakBtn.title = "Listen to the correct sentence";
    speakBtn.onclick = () => speak(item.right);
    resultArea.querySelector("div:nth-child(3)").appendChild(speakBtn);
  };

  card.appendChild(checkBtn);
  card.appendChild(resultArea);
  container.appendChild(card);

  const nextBtn = el("button", "btn secondary block", "Next Sentence →");
  nextBtn.style.marginTop = "10px";
  nextBtn.onclick = () => {
    advanceShuffleState(shuffleState);
    renderRound(container);
  };
  container.appendChild(nextBtn);
}

async function init() {
  setupThemeToggle();
  const container = document.getElementById("gameContainer");
  container.innerHTML = `<div class="empty-state">Loading...</div>`;
  try {
    const res = await fetch("../data/mistake-game.json");
    ITEMS = await res.json();
    shuffleState = makeShuffleState(ITEMS.length);
    renderRound(container);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load the game. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
