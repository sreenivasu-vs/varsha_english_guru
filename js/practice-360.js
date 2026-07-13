/* 360° Practice: one mixed session that samples every practice style in the
   app - grammar (find the mistake), sentence formation (word builder), verb
   forms (fill in the blank), verb knowledge (V2/V3), vocabulary (flashcard
   meaning match), listening (dictation), and speaking (echo repeat, mic
   optional) - then ends with a per-skill report card and tells the user
   which app feature to spend more time in, based on their weakest areas.
   Session history (last 30) is kept in localStorage so the report can call
   out skills that are consistently weak across sessions, not just today. */

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

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom(arr, n) {
  return shuffleArray(arr).slice(0, n);
}

function normalizeWords(text) {
  return text.toLowerCase().replace(/[^a-z0-9' ]+/g, "").split(/\s+/).filter(Boolean);
}

function diffWords(expectedWords, actualWords) {
  const m = expectedWords.length, n = actualWords.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = expectedWords[i - 1] === actualWords[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const matchedExpected = new Set();
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (expectedWords[i - 1] === actualWords[j - 1]) { matchedExpected.add(i - 1); i--; j--; }
    else if (dp[i - 1][j] >= dp[i][j - 1]) i--;
    else j--;
  }
  return matchedExpected;
}

/* ---------- Skills ---------- */

const SKILLS = {
  grammar: {
    label: "Grammar",
    icon: "🎯",
    suggestion: "Play Find the Mistake and revisit the Common Mistakes Bank lessons (Level 11).",
    links: [{ text: "Find the Mistake", href: "find-the-mistake.html" }],
  },
  sentence: {
    label: "Sentence Formation",
    icon: "🧩",
    suggestion: "Play Word Builder and review the Sentence Formation lessons (Level 2).",
    links: [{ text: "Word Builder", href: "word-builder.html" }],
  },
  verbForms: {
    label: "Verb Forms in Context",
    icon: "📝",
    suggestion: "Play Fill in the Blank and study the Past/Present/Future tense section of each verb in the Verb Mastery Bank.",
    links: [{ text: "Fill in the Blank", href: "fill-blank.html" }, { text: "Verb Mastery Bank", href: "verbs.html" }],
  },
  verbs: {
    label: "Verb Knowledge",
    icon: "⚡",
    suggestion: "Play Verb Challenge and browse the V1-V5 forms in the Verb Mastery Bank.",
    links: [{ text: "Verb Challenge", href: "verb-challenge.html" }, { text: "Verb Mastery Bank", href: "verbs.html" }],
  },
  vocabulary: {
    label: "Vocabulary",
    icon: "🗂️",
    suggestion: "Do your daily Flashcard Review and work through the Vocabulary lessons (Level 5).",
    links: [{ text: "Flashcard Review", href: "flashcards.html" }],
  },
  listening: {
    label: "Listening",
    icon: "🎧",
    suggestion: "Practice dictation and comprehension in Listening Practice.",
    links: [{ text: "Listening Practice", href: "listening-practice.html" }],
  },
  speaking: {
    label: "Speaking",
    icon: "🎤",
    suggestion: "Use Speaking Practice, Shadowing Practice, and the Pronunciation Coach rounds.",
    links: [{ text: "Pronunciation Coach", href: "pronunciation-coach.html" }, { text: "Shadowing Practice", href: "shadowing-practice.html" }],
  },
};

const ROUNDS_PER_SKILL = 2;
const HISTORY_KEY = "em_practice360_v1";

let sessionPlan = [];
let roundIndex = 0;
const skillScores = {};
Object.keys(SKILLS).forEach((k) => (skillScores[k] = { correct: 0, total: 0, skipped: 0 }));

const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

/* ---------- Session plan ---------- */

function buildSessionPlan(data) {
  const plan = [];

  pickRandom(data.mistakes, ROUNDS_PER_SKILL).forEach((item) => plan.push({ skill: "grammar", type: "findMistake", item }));
  pickRandom(data.wordBuilder, ROUNDS_PER_SKILL).forEach((item) => plan.push({ skill: "sentence", type: "wordBuilder", item }));
  pickRandom(data.fillBlank, ROUNDS_PER_SKILL).forEach((item) => plan.push({ skill: "verbForms", type: "fillBlank", item }));

  pickRandom(data.verbs, ROUNDS_PER_SKILL).forEach((v) => {
    const form = Math.random() < 0.5 ? { key: "v2", label: "V2 (Simple Past)" } : { key: "v3", label: "V3 (Past Participle)" };
    plan.push({
      skill: "verbs",
      type: "verbForm",
      item: { base: v.verb, targetLabel: form.label, answer: v[form.key], options: [...new Set([v.v2, v.v3, v.v4, v.v5])] },
    });
  });

  /* Only vocab/phrase cards make sense as "what does X mean?" - mistake-type
     cards have a wrong sentence as the front and its correction as the back. */
  const meaningCards = data.flashcards.filter((c) => c.type === "vocab" || c.type === "phrase");
  pickRandom(meaningCards, ROUNDS_PER_SKILL).forEach((card) => {
    const distractors = pickRandom(meaningCards.filter((c) => c.id !== card.id && c.type === card.type), 3).map((c) => c.back);
    plan.push({ skill: "vocabulary", type: "meaningMatch", item: { front: card.front, answer: card.back, options: shuffleArray([card.back, ...distractors]) } });
  });

  pickRandom(data.dictation, ROUNDS_PER_SKILL).forEach((item) => plan.push({ skill: "listening", type: "dictation", item }));
  pickRandom(data.shadowing, ROUNDS_PER_SKILL).forEach((item) => plan.push({ skill: "speaking", type: "echo", item }));

  return shuffleArray(plan);
}

/* ---------- History ---------- */

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveSessionToHistory(percentages) {
  const history = loadHistory();
  history.push({ date: new Date().toISOString().slice(0, 10), skills: percentages });
  while (history.length > 30) history.shift();
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

/* ---------- Round rendering ---------- */

function renderNextRound(container) {
  if (roundIndex >= sessionPlan.length) {
    renderReport(container);
    return;
  }
  container.innerHTML = "";

  const round = sessionPlan[roundIndex];
  const skill = SKILLS[round.skill];

  const progress = el("div", "quiz-progress", `Round ${roundIndex + 1} of ${sessionPlan.length} · ${skill.icon} ${escapeHtml(skill.label)}`);
  progress.style.textAlign = "center";
  container.appendChild(progress);

  const card = el("div", "card");
  container.appendChild(card);

  const renderers = {
    findMistake: renderFindMistakeRound,
    wordBuilder: renderWordBuilderRound,
    fillBlank: renderMcqRound,
    verbForm: renderVerbFormRound,
    meaningMatch: renderMeaningMatchRound,
    dictation: renderDictationRound,
    echo: renderEchoRound,
  };
  renderers[round.type](card, round, () => {
    const nextBtn = el("button", "btn block", roundIndex === sessionPlan.length - 1 ? "See My Report →" : "Next Round →");
    nextBtn.style.marginTop = "12px";
    nextBtn.onclick = () => {
      roundIndex += 1;
      renderNextRound(container);
    };
    container.appendChild(nextBtn);
  });
}

function recordResult(skillKey, isCorrect) {
  skillScores[skillKey].total += 1;
  if (isCorrect) skillScores[skillKey].correct += 1;
}

function resultBox(card, isCorrect, correctText, extraHtml) {
  const box = el("div");
  box.innerHTML = `
    <div class="feedback-box ${isCorrect ? "correct" : "incorrect"}" style="margin-top:12px;">${isCorrect ? "✅ Correct!" : `✘ Not quite. ${correctText ? "Answer: " + escapeHtml(correctText) : ""}`}</div>
    ${extraHtml || ""}
  `;
  card.appendChild(box);
}

function renderFindMistakeRound(card, round, onDone) {
  const item = round.item;
  card.innerHTML = `<p style="margin:0 0 12px;font-size:13.5px;color:var(--text-muted);">Tap the word or words that are wrong, then check.</p>`;
  const wrap = el("div");
  wrap.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;font-size:17px;font-weight:700;line-height:2;";
  const selected = new Set();
  let checked = false;
  const buttons = item.wrongTokens.map((word, idx) => {
    const btn = el("button", "mistake-word-chip", escapeHtml(word));
    btn.onclick = () => {
      if (checked) return;
      if (selected.has(idx)) { selected.delete(idx); btn.classList.remove("selected"); }
      else { selected.add(idx); btn.classList.add("selected"); }
    };
    wrap.appendChild(btn);
    return btn;
  });
  card.appendChild(wrap);
  const checkBtn = el("button", "btn block", "Check Answer");
  checkBtn.onclick = () => {
    if (checked) return;
    checked = true;
    checkBtn.disabled = true;
    const mistakeSet = new Set(item.mistakeIndices);
    let foundAll = true;
    buttons.forEach((btn, idx) => {
      const isMistake = mistakeSet.has(idx);
      const wasSelected = selected.has(idx);
      btn.classList.remove("selected");
      if (isMistake && wasSelected) btn.classList.add("correct-catch");
      else if (isMistake && !wasSelected) { btn.classList.add("missed-catch"); foundAll = false; }
      else if (!isMistake && wasSelected) { btn.classList.add("wrong-catch"); foundAll = false; }
    });
    recordResult(round.skill, foundAll);
    resultBox(card, foundAll, null, `
      <div style="margin-top:8px;font-size:13px;color:var(--text-muted);">Correct sentence:</div>
      <div style="margin-top:4px;font-weight:700;color:var(--accent);">${escapeHtml(item.right)}</div>
      <div style="margin-top:8px;font-size:13px;color:var(--text-muted);">${escapeHtml(item.why)}</div>
    `);
    onDone();
  };
  card.appendChild(checkBtn);
}

function renderWordBuilderRound(card, round, onDone) {
  const item = round.item;
  card.innerHTML = `<p style="margin:0 0 12px;font-size:13.5px;color:var(--text-muted);">Tap the words in the correct order to build the sentence.</p>`;
  const answerZone = el("div", "rearrange-tokens");
  const bank = el("div", "rearrange-bank");
  let checked = false;
  let scrambled = shuffleArray(item.words);
  let tries = 0;
  while (scrambled.join(" ") === item.words.join(" ") && tries < 10) { scrambled = shuffleArray(item.words); tries += 1; }
  scrambled.forEach((word) => {
    const tok = el("button", "token", escapeHtml(word));
    tok.onclick = () => {
      if (checked) return;
      answerZone.appendChild(tok);
      tok.onclick = () => { if (!checked) bank.appendChild(tok); };
    };
    bank.appendChild(tok);
  });
  card.appendChild(answerZone);
  card.appendChild(bank);
  const checkBtn = el("button", "btn block", "Check Answer");
  checkBtn.style.marginTop = "10px";
  checkBtn.onclick = () => {
    if (checked) return;
    checked = true;
    checkBtn.disabled = true;
    const built = [...answerZone.children].map((t) => t.textContent).join(" ");
    const isCorrect = built === item.sentence;
    recordResult(round.skill, isCorrect);
    resultBox(card, isCorrect, isCorrect ? null : item.sentence);
    onDone();
  };
  card.appendChild(checkBtn);
}

function renderMcqOptions(card, round, question, options, answer, onDone, speakAnswerText) {
  card.appendChild(el("div", "quiz-question", question));
  const opts = el("div", "quiz-options");
  let checked = false;
  const buttons = options.map((opt) => {
    const btn = el("button", "quiz-option", escapeHtml(opt));
    btn.onclick = () => {
      if (checked) return;
      checked = true;
      const isCorrect = opt === answer;
      buttons.forEach((b, i) => { if (options[i] === answer) b.classList.add("correct"); });
      if (!isCorrect) btn.classList.add("incorrect");
      recordResult(round.skill, isCorrect);
      resultBox(card, isCorrect, isCorrect ? null : answer);
      if (speakAnswerText) {
        const sb = el("button", "speak-btn", "🔊");
        sb.onclick = () => speak(speakAnswerText);
        card.lastChild.querySelector(".feedback-box").appendChild(sb);
      }
      onDone();
    };
    opts.appendChild(btn);
    return btn;
  });
  card.appendChild(opts);
}

function renderMcqRound(card, round, onDone) {
  const item = round.item;
  const options = item.options.length <= 4
    ? shuffleArray(item.options)
    : shuffleArray([item.answer, ...pickRandom(item.options.filter((o) => o !== item.answer), 3)]);
  renderMcqOptions(card, round, item.blankSentence, options, item.answer, onDone, item.blankSentence.replace("____", item.answer));
}

function renderVerbFormRound(card, round, onDone) {
  const item = round.item;
  renderMcqOptions(card, round, `What is the ${item.targetLabel} of "${item.base}"?`, shuffleArray(item.options), item.answer, onDone, item.answer);
}

function renderMeaningMatchRound(card, round, onDone) {
  const item = round.item;
  renderMcqOptions(card, round, `What does "${item.front}" mean?`, item.options, item.answer, onDone);
}

function renderDictationRound(card, round, onDone) {
  const item = round.item;
  card.innerHTML = `<p style="margin:0 0 12px;font-size:13.5px;color:var(--text-muted);">Listen to the sentence, then type exactly what you hear.</p>`;
  const playBtn = el("button", "btn block", "🔊 Play Sentence");
  playBtn.onclick = () => speak(item.text);
  card.appendChild(playBtn);
  const input = el("textarea", "text-input", "");
  input.rows = 2;
  input.placeholder = "Type what you heard...";
  input.style.marginTop = "10px";
  card.appendChild(input);
  const checkBtn = el("button", "btn block", "Check Answer");
  let checked = false;
  checkBtn.onclick = () => {
    if (checked) return;
    checked = true;
    checkBtn.disabled = true;
    input.disabled = true;
    const expected = normalizeWords(item.text);
    const matched = diffWords(expected, normalizeWords(input.value));
    const accuracy = expected.length ? Math.round((matched.size / expected.length) * 100) : 0;
    const isCorrect = accuracy >= 80;
    recordResult(round.skill, isCorrect);
    resultBox(card, isCorrect, isCorrect ? null : item.text, `<div style="margin-top:8px;font-size:13px;color:var(--text-muted);">Word accuracy: ${accuracy}%</div>`);
    onDone();
  };
  card.appendChild(checkBtn);
}

function renderEchoRound(card, round, onDone) {
  const item = round.item;
  card.innerHTML = `
    <p style="margin:0 0 8px;font-size:13.5px;color:var(--text-muted);">Say this sentence out loud, clearly.</p>
    <div style="text-align:center;font-size:18px;font-weight:700;margin:8px 0 12px;">${escapeHtml(item.text)}</div>
  `;
  const row = el("div");
  row.style.cssText = "display:flex;gap:8px;flex-wrap:wrap;";
  const listenBtn = el("button", "btn secondary", "🔊 Listen");
  listenBtn.style.flex = "1";
  listenBtn.onclick = () => speak(item.text);
  const micBtn = el("button", "btn", "🎤 Record");
  micBtn.style.flex = "1";
  row.appendChild(listenBtn);
  row.appendChild(micBtn);
  card.appendChild(row);

  const skipBtn = el("button", "btn secondary block", "Skip (no microphone)");
  skipBtn.style.marginTop = "8px";
  card.appendChild(skipBtn);

  const status = el("div", "", "");
  status.style.cssText = "font-size:13px;color:var(--text-muted);margin-top:8px;min-height:18px;text-align:center;";
  card.appendChild(status);

  let done = false;
  let recognition = null;

  skipBtn.onclick = () => {
    if (done) return;
    done = true;
    if (recognition) { try { recognition.stop(); } catch (e) { /* already stopped */ } }
    skillScores[round.skill].skipped += 1;
    status.textContent = "Skipped - speaking won't count in this session's report.";
    onDone();
  };

  micBtn.onclick = () => {
    if (done) return;
    if (!SpeechRecognitionCtor) {
      status.textContent = "Speech recognition isn't supported in this browser - you can skip this round.";
      return;
    }
    recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    micBtn.disabled = true;
    status.textContent = "Listening... speak now.";
    recognition.onresult = (event) => {
      if (done) return;
      done = true;
      let text = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) text += event.results[i][0].transcript + " ";
      }
      const expected = normalizeWords(item.text);
      const matched = diffWords(expected, normalizeWords(text));
      const accuracy = expected.length ? Math.round((matched.size / expected.length) * 100) : 0;
      const isCorrect = accuracy >= 75;
      recordResult(round.skill, isCorrect);
      status.textContent = "";
      resultBox(card, isCorrect, isCorrect ? null : item.text, `
        <div style="margin-top:8px;font-size:13px;color:var(--text-muted);">You said:</div>
        <div style="margin-top:4px;">${escapeHtml(text.trim()) || "<i>(nothing recognized)</i>"}</div>
        <div style="margin-top:8px;font-size:13px;color:var(--text-muted);">Word accuracy: ${accuracy}%</div>
      `);
      onDone();
    };
    recognition.onerror = () => {
      micBtn.disabled = false;
      status.textContent = "Didn't catch that - try again, or skip.";
    };
    recognition.onend = () => { micBtn.disabled = false; };
    recognition.start();
  };
}

/* ---------- Final report ---------- */

function renderReport(container) {
  container.innerHTML = "";

  const percentages = {};
  Object.keys(SKILLS).forEach((k) => {
    const s = skillScores[k];
    percentages[k] = s.total ? Math.round((s.correct / s.total) * 100) : null;
  });
  saveSessionToHistory(percentages);

  const attempted = Object.values(skillScores).reduce((a, s) => a + s.total, 0);
  const correct = Object.values(skillScores).reduce((a, s) => a + s.correct, 0);
  const overall = attempted ? Math.round((correct / attempted) * 100) : 0;

  const header = el("div", "card");
  header.innerHTML = `
    <div class="quiz-result" style="padding:10px;">
      <div class="score-big">${overall}%</div>
      <div style="color:var(--text-muted);">Overall · ${correct} of ${attempted} correct</div>
    </div>
  `;
  container.appendChild(header);

  const breakdown = el("div", "card");
  breakdown.innerHTML = `<div class="section-title" style="margin-top:0">Skill Breakdown</div>`;
  Object.keys(SKILLS).forEach((k) => {
    const pct = percentages[k];
    const s = skillScores[k];
    const row = el("div");
    row.style.marginBottom = "12px";
    row.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:14px;margin-bottom:3px;">
        <span>${SKILLS[k].icon} ${escapeHtml(SKILLS[k].label)}</span>
        <span style="font-weight:700;">${pct === null ? (s.skipped ? "skipped" : "--") : pct + "%"}</span>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${pct === null ? 0 : pct}%"></div></div>
    `;
    breakdown.appendChild(row);
  });
  container.appendChild(breakdown);

  /* Suggestions: weakest skills this session (below 70%, or the bottom skill
     if everything passed), plus anything weak in 2+ of the last 3 sessions. */
  const history = loadHistory();
  const recent = history.slice(-3);
  const suggestions = el("div", "card");
  suggestions.innerHTML = `<div class="section-title" style="margin-top:0">📈 What to Practice Next</div>`;

  const scored = Object.keys(SKILLS).filter((k) => percentages[k] !== null);
  let weak = scored.filter((k) => percentages[k] < 70);
  if (!weak.length && scored.length) {
    const lowest = scored.reduce((a, b) => (percentages[a] <= percentages[b] ? a : b));
    if (percentages[lowest] < 100) weak = [lowest];
  }

  if (!scored.length) {
    suggestions.appendChild(el("p", "", "No rounds were completed - try a full session to get personalized suggestions."));
  } else if (!weak.length) {
    suggestions.appendChild(el("p", "", "💯 Perfect session across every skill - excellent work! Keep your streak going with tomorrow's daily conversation and flashcard review."));
  } else {
    weak.forEach((k) => {
      const persistent = recent.filter((h) => h.skills[k] !== null && h.skills[k] !== undefined && h.skills[k] < 70).length >= 2;
      const block = el("div", "mistake-item");
      const linksHtml = SKILLS[k].links.map((l) => `<a href="${l.href}" style="color:var(--primary);font-weight:700;text-decoration:underline;">${escapeHtml(l.text)}</a>`).join(" · ");
      block.innerHTML = `
        <div style="font-weight:700;">${SKILLS[k].icon} ${escapeHtml(SKILLS[k].label)} - ${percentages[k]}%${persistent ? " · needs consistent work" : ""}</div>
        <div class="mistake-why">${escapeHtml(SKILLS[k].suggestion)}${persistent ? " This has been below 70% in your recent sessions too - make it your daily focus this week." : ""}</div>
        <div style="margin-top:6px;font-size:13px;">${linksHtml}</div>
      `;
      suggestions.appendChild(block);
    });
  }

  const skippedSpeaking = skillScores.speaking.skipped > 0 && skillScores.speaking.total === 0;
  if (skippedSpeaking) {
    const note = el("p", "", "🎤 You skipped the speaking rounds - try them with a microphone next time for a complete 360° picture.");
    note.style.cssText = "font-size:13px;color:var(--text-muted);";
    suggestions.appendChild(note);
  }
  container.appendChild(suggestions);

  const againBtn = el("button", "btn block", "🔄 Practice Again");
  againBtn.onclick = () => window.location.reload();
  container.appendChild(againBtn);

  const home = el("a", "btn secondary block", "← Back to Dashboard");
  home.href = "../index.html";
  home.style.marginTop = "10px";
  container.appendChild(home);
}

/* ---------- Init ---------- */

async function init() {
  setupThemeToggle();
  const container = document.getElementById("practiceContainer");
  container.innerHTML = `<div class="empty-state">Preparing your 360° session...</div>`;
  try {
    const [mistakes, wordBuilder, fillBlank, verbs, flashcards, dictation, shadowing] = await Promise.all([
      fetch("../data/mistake-game.json").then((r) => r.json()),
      fetch("../data/word-builder.json").then((r) => r.json()),
      fetch("../data/fill-blank.json").then((r) => r.json()),
      fetch("../data/verbs.json").then((r) => r.json()),
      fetch("../data/flashcards.json").then((r) => r.json()),
      fetch("../data/listening-dictation.json").then((r) => r.json()),
      fetch("../data/shadowing-sentences.json").then((r) => r.json()),
    ]);
    sessionPlan = buildSessionPlan({ mistakes, wordBuilder, fillBlank, verbs, flashcards, dictation, shadowing });
    roundIndex = 0;
    renderNextRound(container);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load the practice session. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
