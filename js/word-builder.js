/* Word Builder: a scrambled sentence is shown as tappable word chips. Tap
   words in order to build the sentence, check your answer, see the correct
   order. Content is the existing beginner-level example sentences from the
   Verb Mastery Bank (data/word-builder.json, generated from data/verbs.json).
   No login or backend needed. */

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

function scrambledWords(words) {
  if (words.length < 2) return [...words];
  let attempt = shuffleArray(words);
  let tries = 0;
  while (attempt.join(" ") === words.join(" ") && tries < 10) {
    attempt = shuffleArray(words);
    tries += 1;
  }
  return attempt;
}

function renderScoreBar(container) {
  const bar = el("div", "", `Score: ${sessionScore.perfect} / ${sessionScore.attempted} correct`);
  bar.style.cssText = "text-align:center;font-size:13px;color:var(--text-muted);margin-bottom:10px;";
  container.appendChild(bar);
}

function renderRound(container) {
  container.innerHTML = "";
  renderScoreBar(container);

  const item = ITEMS[currentItemIndex(shuffleState)];
  let checked = false;

  const card = el("div", "card");
  card.innerHTML = `<div class="section-title" style="margin-top:0">Word Builder</div><p style="margin:0 0 12px;font-size:13.5px;color:var(--text-muted);">Tap the words in the correct order to build the sentence.</p>`;

  const answerZone = el("div", "rearrange-tokens");
  const bank = el("div", "rearrange-bank");

  scrambledWords(item.words).forEach((word) => {
    const tok = el("button", "token", escapeHtml(word));
    tok.onclick = () => {
      if (checked) return;
      answerZone.appendChild(tok);
      tok.onclick = () => {
        if (checked) return;
        bank.appendChild(tok);
      };
    };
    bank.appendChild(tok);
  });

  card.appendChild(answerZone);
  card.appendChild(bank);

  const checkBtn = el("button", "btn block", "Check Answer");
  checkBtn.style.marginTop = "12px";
  const resultArea = el("div");
  resultArea.style.marginTop = "14px";

  checkBtn.onclick = () => {
    if (checked) return;
    checked = true;
    checkBtn.disabled = true;

    const built = [...answerZone.children].map((t) => t.textContent).join(" ");
    const isCorrect = built === item.sentence;

    sessionScore.attempted += 1;
    if (isCorrect) sessionScore.perfect += 1;
    container.querySelector("div").textContent = `Score: ${sessionScore.perfect} / ${sessionScore.attempted} correct`;

    resultArea.innerHTML = `
      <div class="feedback-box ${isCorrect ? "correct" : "incorrect"}">${isCorrect ? "✅ Correct sentence order!" : "✘ Not quite the right order."}</div>
      <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Correct sentence:</div>
      <div style="margin-top:4px;font-size:17px;font-weight:700;color:var(--accent);">${escapeHtml(item.sentence)}</div>
    `;
    const speakBtn = el("button", "speak-btn", "🔊");
    speakBtn.title = "Listen to the correct sentence";
    speakBtn.onclick = () => speak(item.sentence);
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
    const res = await fetch("../data/word-builder.json");
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
