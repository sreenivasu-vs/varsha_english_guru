/* Verb Challenge: shown a verb and asked for one of its forms (V2 - simple
   past, or V3 - past participle), pick the right one from that verb's other
   forms. Content is pulled straight from the existing Verb Mastery Bank
   (data/verbs.json) - no new content, no login or backend needed. */

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

const FORMS = [
  { key: "v2", label: "V2 (Simple Past)" },
  { key: "v3", label: "V3 (Past Participle)" },
];

let ITEMS = [];
let shuffleState = { order: [], pos: 0 };
let sessionScore = { correct: 0, attempted: 0 };

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
  const bar = el("div", "", `Score: ${sessionScore.correct} / ${sessionScore.attempted} correct`);
  bar.style.cssText = "text-align:center;font-size:13px;color:var(--text-muted);margin-bottom:10px;";
  container.appendChild(bar);
}

function renderRound(container) {
  container.innerHTML = "";
  renderScoreBar(container);

  const item = ITEMS[currentItemIndex(shuffleState)];
  let checked = false;

  const card = el("div", "card");
  card.innerHTML = `
    <div class="section-title" style="margin-top:0">Verb Challenge</div>
    <div style="text-align:center;margin:6px 0 4px;">
      <div style="font-size:32px;font-weight:800;color:var(--primary);">${escapeHtml(item.base)}</div>
      <div style="font-size:14.5px;color:var(--text-muted);margin-top:4px;">What is the <b>${escapeHtml(item.targetLabel)}</b> form?</div>
    </div>
  `;

  const opts = el("div", "quiz-options");
  opts.style.marginTop = "16px";
  const options = shuffleArray(item.options);
  const buttons = options.map((opt) => {
    const btn = el("button", "quiz-option", escapeHtml(opt));
    btn.onclick = () => {
      if (checked) return;
      checked = true;
      const isCorrect = opt === item.answer;
      buttons.forEach((b, i) => {
        if (options[i] === item.answer) b.classList.add("correct");
      });
      if (!isCorrect) btn.classList.add("incorrect");

      sessionScore.attempted += 1;
      if (isCorrect) sessionScore.correct += 1;
      container.querySelector("div").textContent = `Score: ${sessionScore.correct} / ${sessionScore.attempted} correct`;

      resultArea.innerHTML = `
        <div class="feedback-box ${isCorrect ? "correct" : "incorrect"}">${isCorrect ? "✅ Correct!" : `✘ Not quite. The ${escapeHtml(item.targetLabel)} of "${escapeHtml(item.base)}" is "${escapeHtml(item.answer)}".`}</div>
      `;
      const speakBtn = el("button", "speak-btn", "🔊");
      speakBtn.title = "Listen to the correct form";
      speakBtn.onclick = () => speak(item.answer);
      resultArea.querySelector("div").appendChild(speakBtn);
      resultArea.style.display = "block";
    };
    opts.appendChild(btn);
    return btn;
  });
  card.appendChild(opts);

  const resultArea = el("div");
  resultArea.style.cssText = "margin-top:14px;display:none;";
  card.appendChild(resultArea);
  container.appendChild(card);

  const nextBtn = el("button", "btn secondary block", "Next Verb →");
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
    const res = await fetch("../data/verbs.json");
    const verbs = await res.json();
    ITEMS = [];
    verbs.forEach((v) => {
      FORMS.forEach((form) => {
        const uniqueOptions = [...new Set([v.v2, v.v3, v.v4, v.v5])];
        ITEMS.push({
          base: v.verb,
          targetLabel: form.label,
          answer: v[form.key],
          options: uniqueOptions,
        });
      });
    });
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
