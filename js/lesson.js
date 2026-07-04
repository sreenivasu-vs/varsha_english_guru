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
