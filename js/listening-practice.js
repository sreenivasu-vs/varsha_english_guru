/* Listening Comprehension / Dictation: two modes sharing a shuffle-bag
   navigation pattern (see js/shadowing-practice.js for the same idea).
   Dictation plays a sentence via text-to-speech, the user types what they
   heard, and a word-level diff scores accuracy. Comprehension plays a short
   passage and asks multiple-choice questions about it. No login or backend
   needed - pure practice tool, not graded against an account. */

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

let DICTATION = [];
let COMPREHENSION = [];
let activeMode = "dictation";

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

let dictationState = { order: [], pos: 0 };
let comprehensionState = { order: [], pos: 0 };
let dictationLevelFilter = "All";
let filteredDictationList = [];

function applyDictationFilter() {
  filteredDictationList = dictationLevelFilter === "All"
    ? DICTATION
    : DICTATION.filter((d) => d.level === dictationLevelFilter);
  dictationState = makeShuffleState(filteredDictationList.length);
}

function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, "")
    .split(/\s+/)
    .filter(Boolean);
}

/* Longest-common-subsequence word diff: returns which expected-word indices
   the user actually said (in the right relative order, so words said out of
   order don't falsely count as correct) and which actual-word indices were
   part of that match - the complement of the latter is "extra" words the
   user said that weren't in the original sentence at all. */
function diffWords(expectedWords, actualWords) {
  const m = expectedWords.length;
  const n = actualWords.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = expectedWords[i - 1] === actualWords[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const matchedExpected = new Set();
  const matchedActual = new Set();
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (expectedWords[i - 1] === actualWords[j - 1]) {
      matchedExpected.add(i - 1);
      matchedActual.add(j - 1);
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return { matchedExpected, matchedActual };
}

function renderDictationLevelFilter(container) {
  const row = el("div");
  row.style.cssText = "display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;";
  ["All", "Easy", "Medium", "Hard"].forEach((level) => {
    const btn = el("button", "btn secondary", level);
    btn.style.cssText = "flex:1;padding:8px 6px;font-size:13px;min-width:60px;";
    if (level === dictationLevelFilter) btn.classList.add("active-tab");
    btn.onclick = () => {
      dictationLevelFilter = level;
      applyDictationFilter();
      renderDictationMode(document.getElementById("listeningContainer"));
    };
    row.appendChild(btn);
  });
  container.appendChild(row);
}

function renderDictationMode(container) {
  container.innerHTML = "";
  renderDictationLevelFilter(container);

  if (filteredDictationList.length === 0) {
    container.appendChild(el("div", "empty-state", "No sentences at this level yet."));
    return;
  }

  const item = filteredDictationList[currentItemIndex(dictationState)];

  const card = el("div", "card");
  card.innerHTML = `<div class="tag">${escapeHtml(item.level)}</div>`;
  const playBtn = el("button", "btn block", "🔊 Play Sentence");
  playBtn.style.marginTop = "10px";
  playBtn.onclick = () => speak(item.text);
  card.appendChild(playBtn);

  const answerBox = el("textarea", "text-input", "");
  answerBox.rows = 2;
  answerBox.placeholder = "Type exactly what you heard...";
  answerBox.style.cssText = "resize:vertical;margin-top:10px;";
  card.appendChild(answerBox);

  const checkBtn = el("button", "btn secondary block", "Check Answer");
  checkBtn.style.marginTop = "8px";
  const resultArea = el("div");
  resultArea.style.marginTop = "14px";

  checkBtn.onclick = () => {
    const expected = normalizeWords(item.text);
    const actual = normalizeWords(answerBox.value);
    const { matchedExpected, matchedActual } = diffWords(expected, actual);
    const accuracy = Math.round((matchedExpected.size / expected.length) * 100);

    const highlighted = expected
      .map((w, idx) => matchedExpected.has(idx)
        ? `<span class="mistake-right">${escapeHtml(w)}</span>`
        : `<span class="mistake-wrong" style="text-decoration:line-through;">${escapeHtml(w)}</span>`)
      .join(" ");

    const extraWords = actual.filter((w, idx) => !matchedActual.has(idx));

    resultArea.innerHTML = `
      <div class="feedback-box ${accuracy >= 80 ? "correct" : "incorrect"}">${accuracy}% accuracy</div>
      <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Correct sentence (green = you got it, struck through = missed):</div>
      <div style="margin-top:6px;font-size:15px;line-height:1.7;">${highlighted}</div>
      ${extraWords.length ? `<div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Extra words you typed that weren't in the sentence:</div><div style="margin-top:4px;"><span class="mistake-wrong">${extraWords.map(escapeHtml).join(", ")}</span></div>` : ""}
    `;
  };

  card.appendChild(checkBtn);
  card.appendChild(resultArea);
  container.appendChild(card);

  const counter = el("div", "", `${dictationState.pos + 1} of ${filteredDictationList.length}${dictationLevelFilter !== "All" ? " · " + dictationLevelFilter : ""}`);
  counter.style.cssText = "text-align:center;font-size:13px;color:var(--text-muted);margin-top:10px;";
  container.appendChild(counter);

  const nextBtn = el("button", "btn block", "Next Sentence →");
  nextBtn.style.marginTop = "10px";
  nextBtn.onclick = () => {
    advanceShuffleState(dictationState);
    renderDictationMode(container);
  };
  container.appendChild(nextBtn);
}

function renderComprehensionMode(container) {
  container.innerHTML = "";
  const item = COMPREHENSION[currentItemIndex(comprehensionState)];
  const answers = {};

  const card = el("div", "card");
  card.innerHTML = `<div class="section-title" style="margin-top:0">${escapeHtml(item.title)}</div>`;
  const playBtn = el("button", "btn block", "🔊 Play Passage");
  playBtn.onclick = () => speak(item.passage);
  card.appendChild(playBtn);

  const passageText = el("p", "", escapeHtml(item.passage));
  passageText.style.cssText = "margin:14px 0;font-size:14.5px;line-height:1.6;color:var(--text-muted);";
  card.appendChild(passageText);
  container.appendChild(card);

  const questionsCard = el("div", "card");
  item.questions.forEach((q, qIdx) => {
    const qWrap = el("div");
    qWrap.style.marginBottom = "18px";
    qWrap.innerHTML = `<div style="font-weight:700;margin-bottom:8px;">${qIdx + 1}. ${escapeHtml(q.question)}</div>`;
    const optWrap = el("div", "quiz-options");
    q.options.forEach((opt) => {
      const optBtn = el("button", "quiz-option", escapeHtml(opt));
      optBtn.onclick = () => {
        if (answers[qIdx] !== undefined) return;
        answers[qIdx] = opt;
        const correct = opt === q.answer;
        optBtn.classList.add(correct ? "correct" : "incorrect");
        if (!correct) {
          [...optWrap.children].forEach((b) => {
            if (b.textContent === q.answer) b.classList.add("correct");
          });
        }
      };
      optWrap.appendChild(optBtn);
    });
    qWrap.appendChild(optWrap);
    questionsCard.appendChild(qWrap);
  });
  container.appendChild(questionsCard);

  const counter = el("div", "", `${comprehensionState.pos + 1} of ${COMPREHENSION.length}`);
  counter.style.cssText = "text-align:center;font-size:13px;color:var(--text-muted);margin-top:10px;";
  container.appendChild(counter);

  const nextBtn = el("button", "btn block", "Next Passage →");
  nextBtn.style.marginTop = "10px";
  nextBtn.onclick = () => {
    advanceShuffleState(comprehensionState);
    renderComprehensionMode(container);
  };
  container.appendChild(nextBtn);
}

function renderActiveMode() {
  const container = document.getElementById("listeningContainer");
  if (activeMode === "dictation") renderDictationMode(container);
  else renderComprehensionMode(container);
}

function setupTabs() {
  const tabs = document.getElementById("listeningTabs");
  const modes = [
    { id: "dictation", label: "Dictation" },
    { id: "comprehension", label: "Comprehension" },
  ];
  modes.forEach((m) => {
    const btn = el("button", "btn secondary", m.label);
    btn.style.cssText = "flex:1;padding:10px 8px;font-size:13.5px;";
    btn.onclick = () => {
      activeMode = m.id;
      [...tabs.children].forEach((b) => b.classList.remove("active-tab"));
      btn.classList.add("active-tab");
      renderActiveMode();
    };
    if (m.id === activeMode) btn.classList.add("active-tab");
    tabs.appendChild(btn);
  });
}

async function init() {
  setupThemeToggle();
  setupTabs();
  const container = document.getElementById("listeningContainer");
  container.innerHTML = `<div class="empty-state">Loading...</div>`;
  try {
    const [dRes, cRes] = await Promise.all([
      fetch("../data/listening-dictation.json"),
      fetch("../data/listening-comprehension.json"),
    ]);
    DICTATION = await dRes.json();
    COMPREHENSION = await cRes.json();
    applyDictationFilter();
    comprehensionState = makeShuffleState(COMPREHENSION.length);
    renderActiveMode();
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load listening exercises. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
