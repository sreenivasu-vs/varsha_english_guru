function getLessonId() {
  // Use the URL hash (not a query string) so lesson links survive static-host
  // "clean URL" redirects that strip query params from .html requests.
  const hash = window.location.hash.replace(/^#/, "");
  if (hash) return decodeURIComponent(hash);
  // Fallback for any old bookmarked ?id= links.
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
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

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function speakButton(text) {
  const btn = el("button", "speak-btn", "🔊");
  btn.onclick = () => speak(text);
  return btn;
}

function renderExampleList(examples) {
  const list = el("ul", "example-list");
  examples.forEach((ex) => {
    const item = el("li", "example-item");
    const span = el("span", "", ex);
    span.style.flex = "1";
    item.appendChild(span);
    item.appendChild(speakButton(ex));
    list.appendChild(item);
  });
  return list;
}

function renderStructureTable(structure) {
  const table = el("table", "conjugation");
  table.innerHTML = `
    <tr><th>Form</th><th>Sentence</th></tr>
    <tr><td>Positive</td><td>${structure.positive || ""}</td></tr>
    <tr><td>Negative</td><td>${structure.negative || ""}</td></tr>
    <tr><td>Question</td><td>${structure.question || ""}</td></tr>
    <tr><td>WH Question</td><td>${structure.whQuestion || ""}</td></tr>
  `;
  return table;
}

function renderMistakes(mistakes) {
  const wrap = el("div");
  mistakes.forEach((m) => {
    const item = el("div", "mistake-item");
    item.innerHTML = `<div><span class="mistake-wrong">${m.wrong}</span> → <span class="mistake-right">${m.right}</span></div>`;
    if (m.why) item.appendChild(el("div", "mistake-why", m.why));
    wrap.appendChild(item);
  });
  return wrap;
}

function renderDialogue(dialogue) {
  const wrap = el("div");
  dialogue.forEach((d) => {
    const line = el("div", "dialogue-line");
    line.innerHTML = `<div class="dialogue-speaker">${d.speaker}</div>`;
    const textWrap = el("div", "dialogue-text");
    textWrap.textContent = d.line;
    const btn = speakButton(d.line);
    line.appendChild(textWrap);
    line.appendChild(btn);
    wrap.appendChild(line);
  });
  return wrap;
}

function renderVocabWords(words) {
  const wrap = el("div");
  words.forEach((w) => {
    const card = el("div", "card");
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-weight:800;font-size:17px;flex:1;">${w.word} <span style="color:var(--text-muted);font-weight:400;font-size:13px;">${w.pronunciation || ""}</span></div>
      </div>
      <div style="margin:6px 0;">${w.meaning}</div>
      ${w.synonyms ? `<div style="font-size:13px;color:var(--text-muted);"><b>Synonyms:</b> ${w.synonyms.join(", ")}</div>` : ""}
      ${w.antonyms ? `<div style="font-size:13px;color:var(--text-muted);"><b>Antonyms:</b> ${w.antonyms.join(", ")}</div>` : ""}
      <div style="margin-top:8px;font-style:italic;">"${w.sentence}"</div>
    `;
    const btn = speakButton(w.sentence);
    card.appendChild(btn);
    wrap.appendChild(card);
  });
  return wrap;
}

function renderIdioms(idioms) {
  const wrap = el("div");
  idioms.forEach((i) => {
    const card = el("div", "card");
    card.innerHTML = `
      <div style="font-weight:800;font-size:16px;">"${i.phrase}"</div>
      <div style="margin:6px 0;color:var(--text-muted);">${i.meaning}</div>
      <div style="font-style:italic;">Example: ${i.example}</div>
    `;
    wrap.appendChild(card);
  });
  return wrap;
}

/* Renders phrases grouped under category headings, e.g.
   [{ category: "Presentation Phrases", phrases: [{phrase, meaning, example}] }] */
function renderPhraseGroups(groups) {
  const wrap = el("div");
  groups.forEach((g) => {
    const heading = el("div", "", g.category);
    heading.style.cssText = "font-weight:700;font-size:13px;text-transform:uppercase;letter-spacing:.03em;color:var(--primary);margin:18px 4px 8px;";
    wrap.appendChild(heading);
    g.phrases.forEach((p) => {
      const card = el("div", "card");
      card.innerHTML = `
        <div style="font-weight:800;font-size:15.5px;">"${p.phrase}"</div>
        <div style="margin:6px 0;color:var(--text-muted);">${p.meaning}</div>
        <div style="font-style:italic;">Example: "${p.example}"</div>
      `;
      card.appendChild(speakButton(p.example));
      wrap.appendChild(card);
    });
  });
  return wrap;
}

function section(title) {
  return el("div", "section-title", title);
}

/* ---------- Tense practice: "build your own sentence" ----------
   Given a subject (pronoun or noun) + a verb (from the existing 50-verb
   Verb Mastery Bank, reusing its V1-V5 forms - no new verb content
   authored), the user writes a full sentence in the tense the lesson is
   teaching. Checked deterministically against the exact grammatical
   pattern for that tense/subject/verb combination - not a general grammar
   checker, since the point here is specifically "did you form THIS tense
   correctly", which a generic checker can't judge (a grammatically valid
   sentence in the wrong tense would pass a generic check but fail this
   exercise). If the phrase doesn't match, the checker also tries the other
   11 tense patterns for the same subject/verb - a very common mistake is
   forming a different, equally "correct" tense by accident - to give a
   precise "that's actually X, not Y" explanation instead of a generic
   "wrong" message. */

const TENSE_SUBJECTS = [
  { text: "I", thirdSg: false, be: "am", bePast: "was", have: "have" },
  { text: "You", thirdSg: false, be: "are", bePast: "were", have: "have" },
  { text: "He", thirdSg: true, be: "is", bePast: "was", have: "has" },
  { text: "She", thirdSg: true, be: "is", bePast: "was", have: "has" },
  { text: "It", thirdSg: true, be: "is", bePast: "was", have: "has" },
  { text: "We", thirdSg: false, be: "are", bePast: "were", have: "have" },
  { text: "They", thirdSg: false, be: "are", bePast: "were", have: "have" },
  { text: "The teacher", thirdSg: true, be: "is", bePast: "was", have: "has" },
  { text: "My friend", thirdSg: true, be: "is", bePast: "was", have: "has" },
  { text: "The students", thirdSg: false, be: "are", bePast: "were", have: "have" },
  { text: "My parents", thirdSg: false, be: "are", bePast: "were", have: "have" },
  { text: "Ravi", thirdSg: true, be: "is", bePast: "was", have: "has" },
];

const TENSE_INFO = {
  presentSimple: {
    label: "Present Simple",
    formula: "Subject + V1 (+s/es for he/she/it)",
    conjugate: (s, v) => (s.thirdSg ? v.v5 : v.v1),
    tips: [
      "Add -s or -es to the verb when the subject is he/she/it or a singular noun (works, watches, goes).",
      "Everyone else (I/you/we/they, or plural nouns) just uses the base verb (work, watch, go).",
    ],
  },
  presentContinuous: {
    label: "Present Continuous",
    formula: "Subject + am/is/are + V-ing",
    conjugate: (s, v) => `${s.be} ${v.v4}`,
    tips: [
      "Use am with I, is with he/she/it, are with everyone else.",
      "The main verb always ends in -ing, no matter the subject.",
    ],
  },
  presentPerfect: {
    label: "Present Perfect",
    formula: "Subject + has/have + V3",
    conjugate: (s, v) => `${s.have} ${v.v3}`,
    tips: [
      "Use has with he/she/it, have with everyone else.",
      "The main verb must be the past participle (V3) - regular verbs add -ed, but many common verbs are irregular (go → gone, write → written).",
    ],
  },
  presentPerfectContinuous: {
    label: "Present Perfect Continuous",
    formula: "Subject + has/have + been + V-ing",
    conjugate: (s, v) => `${s.have} been ${v.v4}`,
    tips: [
      "The structure is always [has/have] + been + verb-ing - \"been\" never changes.",
      "Use has been with he/she/it, have been with everyone else.",
    ],
  },
  pastSimple: {
    label: "Past Simple",
    formula: "Subject + V2",
    conjugate: (s, v) => v.v2,
    tips: [
      "The past form (V2) is the same for every subject - no -s, no am/is/are.",
      "Regular verbs add -ed (worked), but many common verbs are irregular (go → went, write → wrote).",
    ],
  },
  pastContinuous: {
    label: "Past Continuous",
    formula: "Subject + was/were + V-ing",
    conjugate: (s, v) => `${s.bePast} ${v.v4}`,
    tips: [
      "Use was with I/he/she/it, were with you/we/they.",
      "The main verb always ends in -ing.",
    ],
  },
  pastPerfect: {
    label: "Past Perfect",
    formula: "Subject + had + V3",
    conjugate: (s, v) => `had ${v.v3}`,
    tips: [
      "Always had + past participle (V3) - \"had\" is the same for every subject.",
      "Past Perfect describes something that happened before another past action.",
    ],
  },
  pastPerfectContinuous: {
    label: "Past Perfect Continuous",
    formula: "Subject + had + been + V-ing",
    conjugate: (s, v) => `had been ${v.v4}`,
    tips: ["The structure is always had been + verb-ing, no matter the subject."],
  },
  futureSimple: {
    label: "Future Simple",
    formula: "Subject + will + V1",
    conjugate: (s, v) => `will ${v.v1}`,
    tips: ["\"Will\" never changes with the subject - will + base verb (V1)."],
  },
  futureContinuous: {
    label: "Future Continuous",
    formula: "Subject + will be + V-ing",
    conjugate: (s, v) => `will be ${v.v4}`,
    tips: ["will be + verb-ing, the same for every subject."],
  },
  futurePerfect: {
    label: "Future Perfect",
    formula: "Subject + will have + V3",
    conjugate: (s, v) => `will have ${v.v3}`,
    tips: ["will have + past participle (V3), the same for every subject."],
  },
  futurePerfectContinuous: {
    label: "Future Perfect Continuous",
    formula: "Subject + will have been + V-ing",
    conjugate: (s, v) => `will have been ${v.v4}`,
    tips: ["will have been + verb-ing - the longest chain, but nothing changes with the subject."],
  },
};

function normalizeSentenceWords(text) {
  return text.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
}

function containsSubsequence(haystack, needle) {
  for (let i = 0; i <= haystack.length - needle.length; i++) {
    if (needle.every((w, j) => haystack[i + j] === w)) return true;
  }
  return false;
}

function checkTensePractice(userText, subject, verb, tenseKey) {
  const info = TENSE_INFO[tenseKey];
  const expectedPhrase = info.conjugate(subject, verb);
  const expectedSentence = `${subject.text} ${expectedPhrase}.`;

  if (!userText.trim()) {
    return { correct: false, expectedSentence, message: "Type a sentence first." };
  }

  const userWords = normalizeSentenceWords(userText);
  const subjectWords = normalizeSentenceWords(subject.text);
  const startsWithSubject = subjectWords.every((w, i) => userWords[i] === w);

  if (!startsWithSubject) {
    return {
      correct: false,
      expectedSentence,
      message: `Start your sentence with "${subject.text}" - that's the subject you were given.`,
    };
  }

  if (containsSubsequence(userWords, expectedPhrase.split(" "))) {
    return { correct: true, expectedSentence, message: `Correct ${info.label} sentence!` };
  }

  // Very common mistake: forgetting -s/-es for a third-person-singular subject.
  if (tenseKey === "presentSimple" && subject.thirdSg && containsSubsequence(userWords, [verb.v1])) {
    return {
      correct: false,
      expectedSentence,
      message: `You wrote "${verb.v1}", but "${subject.text}" is third-person singular (he/she/it) - add -s/-es: "${verb.v5}".`,
    };
  }

  // Did they accidentally form a different (also valid) tense instead? Check
  // longer/more specific patterns first - a short one-word pattern (e.g.
  // Present Simple's bare verb) would otherwise "match" trivially any time
  // the verb appears at all, even inside a longer, more specific pattern the
  // user actually attempted (e.g. Future Simple's "will write" also contains
  // the word "write").
  const otherTenses = Object.entries(TENSE_INFO)
    .filter(([key]) => key !== tenseKey)
    .map(([key, otherInfo]) => ({ key, otherInfo, otherPhrase: otherInfo.conjugate(subject, verb) }))
    .filter(({ otherPhrase }) => otherPhrase !== expectedPhrase)
    .sort((a, b) => b.otherPhrase.split(" ").length - a.otherPhrase.split(" ").length);

  for (const { otherInfo, otherPhrase } of otherTenses) {
    if (containsSubsequence(userWords, otherPhrase.split(" "))) {
      return {
        correct: false,
        expectedSentence,
        message: `That's actually ${otherInfo.label} ("${otherPhrase}"). For ${info.label}, you need: "${expectedPhrase}".`,
      };
    }
  }

  // Did they use some form of the verb, just not the one this tense needs?
  const verbForms = [verb.v1, verb.v2, verb.v3, verb.v4, verb.v5];
  const usedForm = verbForms.find((f) => userWords.includes(f));
  if (usedForm) {
    return {
      correct: false,
      expectedSentence,
      message: `You used "${usedForm}", but for ${info.label} the correct form here is "${expectedPhrase}".`,
    };
  }

  return {
    correct: false,
    expectedSentence,
    message: `Your sentence doesn't seem to use "${verb.v1}" correctly for ${info.label}. Formula: ${info.formula}.`,
  };
}

function renderTensePractice(container, lesson) {
  const info = TENSE_INFO[lesson.tenseKey];
  if (!info) return;

  container.appendChild(section("Practice: Build Your Own Sentence"));
  const card = el("div", "card");
  card.innerHTML = `<p style="margin:0 0 12px;color:var(--text-muted);font-size:14.5px;">You'll get a subject and a verb - write a full ${escapeHtml(info.label)} sentence using them.</p>`;

  const promptArea = el("div");
  promptArea.style.cssText = "text-align:center;margin:10px 0 16px;";
  card.appendChild(promptArea);

  const input = el("textarea", "text-input", "");
  input.rows = 2;
  input.placeholder = "Write your sentence here...";
  card.appendChild(input);

  const checkBtn = el("button", "btn block", "Check Sentence");
  checkBtn.style.marginTop = "8px";
  card.appendChild(checkBtn);

  const tryAnotherBtn = el("button", "btn secondary block", "🔀 Try Another Subject/Verb");
  tryAnotherBtn.style.marginTop = "8px";
  card.appendChild(tryAnotherBtn);

  const resultArea = el("div");
  resultArea.style.marginTop = "14px";
  card.appendChild(resultArea);
  container.appendChild(card);

  let verbs = [];
  let currentSubject = null;
  let currentVerb = null;

  function pickPair() {
    let subject, verb;
    do {
      subject = TENSE_SUBJECTS[Math.floor(Math.random() * TENSE_SUBJECTS.length)];
      verb = verbs[Math.floor(Math.random() * verbs.length)];
    } while (subject === currentSubject && verb === currentVerb && (TENSE_SUBJECTS.length > 1 || verbs.length > 1));
    currentSubject = subject;
    currentVerb = verb;
    promptArea.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Subject / Noun</div>
      <div style="font-size:22px;font-weight:800;color:var(--primary);">${escapeHtml(subject.text)}</div>
      <div style="font-size:13px;color:var(--text-muted);margin:10px 0 4px;">Verb</div>
      <div style="font-size:20px;font-weight:800;">${escapeHtml(verb.v1)}</div>
    `;
    input.value = "";
    resultArea.innerHTML = "";
  }

  checkBtn.onclick = () => {
    const result = checkTensePractice(input.value, currentSubject, currentVerb, lesson.tenseKey);
    const tipsHtml = info.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("");
    resultArea.innerHTML = `
      <div style="font-size:13px;color:var(--text-muted);">You wrote:</div>
      <div style="margin:4px 0 10px;">${escapeHtml(input.value) || "<i>(empty)</i>"}</div>
      <div class="feedback-box ${result.correct ? "correct" : "incorrect"}">${result.correct ? "✅" : "✘"} ${escapeHtml(result.message)}</div>
      <div style="margin-top:10px;font-size:13px;color:var(--text-muted);">Model sentence:</div>
      <div id="tenseModelSentence" style="margin-top:4px;font-weight:700;color:var(--accent);">${escapeHtml(result.expectedSentence)}</div>
      <div style="margin-top:12px;font-size:13px;font-weight:700;">Tips &amp; Tricks:</div>
      <ul class="plain-list" style="margin-top:6px;">${tipsHtml}</ul>
    `;
    resultArea.querySelector("#tenseModelSentence").appendChild(speakButton(result.expectedSentence));
  };

  tryAnotherBtn.onclick = () => pickPair();

  fetch("../data/verbs.json")
    .then((r) => r.json())
    .then((data) => {
      verbs = data;
      pickPair();
    })
    .catch(() => {
      promptArea.innerHTML = `<div class="empty-state">Couldn't load verbs for practice.</div>`;
    });
}

function renderLessonContent(container, lesson) {
  container.innerHTML = "";

  const tag = el("div", "tag", `Level ${lesson.level} · ${lesson.module}`);
  container.appendChild(tag);

  if (lesson.definition) {
    const card = el("div", "card", `<p style="margin:0;font-size:15.5px;">${lesson.definition}</p>`);
    container.appendChild(card);
  }

  if (lesson.formula) {
    container.appendChild(section("Formula"));
    container.appendChild(el("div", "formula-box", lesson.formula));
  }

  if (lesson.structure) {
    container.appendChild(section("Structure"));
    const card = el("div", "card");
    card.appendChild(renderStructureTable(lesson.structure));
    container.appendChild(card);
  }

  if (lesson.usage) {
    container.appendChild(section("Usage"));
    container.appendChild(el("div", "card", `<p style="margin:0;">${lesson.usage}</p>`));
  }

  if (lesson.rules && lesson.rules.length) {
    container.appendChild(section("Rules"));
    const card = el("div", "card");
    const list = el("ul", "rules-list");
    lesson.rules.forEach((r) => list.appendChild(el("li", "", r)));
    card.appendChild(list);
    container.appendChild(card);
  }

  if (lesson.signalWords && lesson.signalWords.length) {
    container.appendChild(section("Signal Words"));
    container.appendChild(el("div", "card", lesson.signalWords.map((w) => `<span class="tag">${w}</span>`).join(" ")));
  }

  if (lesson.examples && lesson.examples.length) {
    container.appendChild(section("Examples"));
    const card = el("div", "card");
    card.appendChild(renderExampleList(lesson.examples));
    container.appendChild(card);
  }

  if (lesson.dailyConversation && lesson.dailyConversation.length) {
    container.appendChild(section("Daily Conversation"));
    const card = el("div", "card");
    card.appendChild(renderDialogue(lesson.dailyConversation));
    container.appendChild(card);
  }

  if (lesson.dialogue && lesson.dialogue.length) {
    container.appendChild(section("Conversation"));
    const card = el("div", "card");
    card.appendChild(renderDialogue(lesson.dialogue));
    container.appendChild(card);
  }

  if (lesson.practicePhrases && lesson.practicePhrases.length) {
    container.appendChild(section("Practice Phrases"));
    const card = el("div", "card");
    card.appendChild(renderExampleList(lesson.practicePhrases));
    container.appendChild(card);
  }

  if (lesson.words && lesson.words.length) {
    container.appendChild(section("Today's Words"));
    container.appendChild(renderVocabWords(lesson.words));
  }

  if (lesson.idioms && lesson.idioms.length) {
    container.appendChild(section("Idioms"));
    container.appendChild(renderIdioms(lesson.idioms));
  }

  if (lesson.phraseGroups && lesson.phraseGroups.length) {
    container.appendChild(section("Key Phrases"));
    container.appendChild(renderPhraseGroups(lesson.phraseGroups));
  }

  if (lesson.tips && lesson.tips.length) {
    container.appendChild(section("Tips"));
    const card = el("div", "card");
    const list = el("ul", "plain-list");
    lesson.tips.forEach((t) => list.appendChild(el("li", "", t)));
    card.appendChild(list);
    container.appendChild(card);
  }

  if (lesson.commonMistakes && lesson.commonMistakes.length) {
    container.appendChild(section("Common Mistakes"));
    container.appendChild(renderMistakes(lesson.commonMistakes));
  }

  if (lesson.tenseKey) {
    renderTensePractice(container, lesson);
  }

  if (lesson.quiz && lesson.quiz.length) {
    container.appendChild(section("Quiz"));
    const quizCard = el("div", "card");
    const prevResult = getLessonResult(lesson.id);
    const startBtn = el("button", "btn block", prevResult ? `Retake Quiz (Best: ${prevResult.quizScore}/${prevResult.quizTotal})` : "Start Quiz");
    const quizArea = el("div");
    quizCard.appendChild(startBtn);
    quizCard.appendChild(quizArea);
    container.appendChild(quizCard);

    startBtn.onclick = () => {
      startBtn.style.display = "none";
      renderQuiz(quizArea, lesson.quiz, (score, total) => finishQuiz(lesson, score, total, quizArea, startBtn));
    };
  }

  const doneBtn = el("button", "btn secondary block", "✓ Mark Lesson Complete (no quiz)");
  doneBtn.style.marginTop = "20px";
  doneBtn.onclick = () => {
    const before = getProgress();
    const after = markLessonComplete(lesson.id, 0, 0);
    showCompletionUI(before, after);
  };
  if (!lesson.quiz || !lesson.quiz.length) container.appendChild(doneBtn);
}

function finishQuiz(lesson, score, total, quizArea, startBtn) {
  const before = getProgress();
  const after = markLessonComplete(lesson.id, score, total);

  quizArea.innerHTML = `
    <div class="quiz-result">
      <div class="score-big">${score}/${total}</div>
      <div style="margin:8px 0;color:var(--text-muted);">${score / total >= 0.7 ? "Great job!" : "Keep practicing - revisit the rules above."}</div>
    </div>
  `;
  startBtn.textContent = `Retake Quiz (Best: ${Math.max(score, (getLessonResult(lesson.id)||{}).quizScore||0)}/${total})`;
  startBtn.style.display = "block";

  showCompletionUI(before, after);
}

function showCompletionUI(before, after) {
  const newBadges = checkNewBadges(before, after);
  newBadges.forEach((b, i) => {
    setTimeout(() => showToast(`${b.icon} Badge earned: ${b.name}!`), i * 1600);
  });
  showToast("✅ Lesson saved · +XP earned");
  appendNextLessonLink();
}

function showToast(msg) {
  const t = el("div", "toast", msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

async function appendNextLessonLink() {
  const res = await fetch("../data/curriculum.json");
  const curriculum = await res.json();
  const progress = getProgress();
  const next = getNextLesson(curriculum, progress);
  const container = document.getElementById("lessonContainer");
  const existing = document.getElementById("nextLessonCard");
  if (existing) existing.remove();
  const card = el("div", "card", "");
  card.id = "nextLessonCard";
  card.style.marginTop = "16px";
  if (next) {
    card.innerHTML = `<div class="section-title" style="margin-top:0">Up Next</div><div style="font-weight:700;margin-bottom:10px;">${next.title}</div>`;
    const link = el("a", "btn block", "Next Lesson →");
    link.href = `lesson.html#${next.id}`;
    card.appendChild(link);
  } else {
    card.innerHTML = `<div style="text-align:center;">🎉 You've completed every lesson! Keep revisiting weak topics from the dashboard.</div>`;
  }
  container.appendChild(card);
}

async function loadLesson() {
  const id = getLessonId();
  const container = document.getElementById("lessonContainer");
  if (!id) {
    document.getElementById("lessonTitle").textContent = "Lesson";
    container.innerHTML = `<div class="empty-state">No lesson selected.</div>`;
    return;
  }
  container.innerHTML = `<div class="empty-state">Loading lesson...</div>`;
  try {
    const res = await fetch(`../data/lessons/${id}.json`);
    if (!res.ok) throw new Error("not found");
    const lesson = await res.json();
    lesson.id = id;
    document.getElementById("lessonTitle").textContent = lesson.title;
    document.title = lesson.title + " - English Master";
    renderLessonContent(container, lesson);
    window.scrollTo(0, 0);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">This lesson isn't available yet.</div>`;
  }
}

function init() {
  setupThemeToggle();
  loadLesson();
  // Clicking "Next Lesson" changes only the URL hash (same lesson.html page),
  // which browsers don't reload automatically - so re-render manually.
  window.addEventListener("hashchange", loadLesson);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
