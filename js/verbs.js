/* Verb Mastery Bank: a searchable list of verbs, each with a full
   20-section breakdown (forms, Telugu meaning, pronunciation, definition,
   example sentences at three levels, common mistakes, grammar tips,
   synonyms/antonyms, a sample dialogue, and a mini quiz). No login or
   backend needed - pure reference + practice content. */

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

function section(title) {
  return el("div", "section-title", title);
}

let VERBS = [];

function renderSentenceList(sentences) {
  const list = el("ul", "example-list");
  sentences.forEach((s) => {
    const item = el("li", "example-item");
    const span = el("span", "", escapeHtml(s));
    span.style.flex = "1";
    item.appendChild(span);
    item.appendChild(speakButton(s));
    list.appendChild(item);
  });
  return list;
}

function renderVerbList(container) {
  container.innerHTML = "";

  const searchBox = el("input", "text-input", "");
  searchBox.type = "text";
  searchBox.placeholder = "Search verbs...";
  searchBox.style.marginBottom = "14px";
  container.appendChild(searchBox);

  const listWrap = el("div");
  container.appendChild(listWrap);

  function renderList(filter) {
    listWrap.innerHTML = "";
    const filtered = VERBS.filter((v) => v.verb.toLowerCase().includes(filter.toLowerCase()));
    if (filtered.length === 0) {
      listWrap.appendChild(el("div", "empty-state", "No verbs match your search."));
      return;
    }
    filtered.forEach((v) => {
      const card = el("div", "card");
      card.style.cssText = "cursor:pointer;display:flex;justify-content:space-between;align-items:center;";
      card.innerHTML = `
        <div>
          <div style="font-weight:800;font-size:16px;">${escapeHtml(v.verb)}</div>
          <div style="font-size:13px;color:var(--text-muted);">${escapeHtml(v.telugu)}</div>
        </div>
        <div style="color:var(--text-muted);">→</div>
      `;
      card.onclick = () => renderVerbDetail(container, v);
      listWrap.appendChild(card);
    });
  }

  searchBox.oninput = () => renderList(searchBox.value);
  renderList("");
}

function renderVerbDetail(container, v) {
  container.innerHTML = "";

  const backBtn = el("button", "btn secondary block", "← Back to Verb List");
  backBtn.style.marginBottom = "14px";
  backBtn.onclick = () => renderVerbList(container);
  container.appendChild(backBtn);

  const headerCard = el("div", "card");
  headerCard.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="font-size:28px;font-weight:800;flex:1;">${escapeHtml(v.verb)}</div>
    </div>
    <div style="font-size:15px;color:var(--text-muted);margin:4px 0 10px;">${escapeHtml(v.telugu)}</div>
    <div style="font-size:14px;margin-bottom:10px;"><b>Pronunciation:</b> ${escapeHtml(v.pronunciation)}</div>
    <p style="margin:0;font-size:14.5px;">${escapeHtml(v.definition)}</p>
  `;
  headerCard.appendChild(speakButton(v.verb));
  container.appendChild(headerCard);

  container.appendChild(section("The 5 Verb Forms"));
  const formsTable = el("table", "conjugation");
  formsTable.innerHTML = `
    <tr><th>V1 (Base)</th><th>V2 (Past)</th><th>V3 (Past Participle)</th><th>V4 (-ing)</th><th>V5 (-s)</th></tr>
    <tr><td>${escapeHtml(v.v1)}</td><td>${escapeHtml(v.v2)}</td><td>${escapeHtml(v.v3)}</td><td>${escapeHtml(v.v4)}</td><td>${escapeHtml(v.v5)}</td></tr>
  `;
  const formsCard = el("div", "card");
  formsCard.appendChild(formsTable);
  container.appendChild(formsCard);

  container.appendChild(section("Past, Present & Future Tense"));
  const tenseCard = el("div", "card");
  [
    { label: "Past", text: v.tenseUsage.past },
    { label: "Present", text: v.tenseUsage.present },
    { label: "Future", text: v.tenseUsage.future },
  ].forEach((t) => {
    const row = el("div");
    row.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:10px;";
    row.innerHTML = `<div style="min-width:64px;font-weight:700;color:var(--primary);font-size:13px;">${t.label}</div><div style="flex:1;font-size:14.5px;">${escapeHtml(t.text)}</div>`;
    row.appendChild(speakButton(t.text));
    tenseCard.appendChild(row);
  });
  container.appendChild(tenseCard);

  container.appendChild(section("Common Uses"));
  const usesCard = el("div", "card");
  const usesList = el("ul", "plain-list");
  v.commonUses.forEach((u) => usesList.appendChild(el("li", "", escapeHtml(u))));
  usesCard.appendChild(usesList);
  container.appendChild(usesCard);

  container.appendChild(section("Beginner Sentences"));
  const beginnerCard = el("div", "card");
  beginnerCard.appendChild(renderSentenceList(v.beginnerSentences));
  container.appendChild(beginnerCard);

  container.appendChild(section("Intermediate Sentences"));
  const intermediateCard = el("div", "card");
  intermediateCard.appendChild(renderSentenceList(v.intermediateSentences));
  container.appendChild(intermediateCard);

  container.appendChild(section("Business English Sentences"));
  const businessCard = el("div", "card");
  businessCard.appendChild(renderSentenceList(v.businessSentences));
  container.appendChild(businessCard);

  container.appendChild(section("Questions Using This Verb"));
  const questionsCard = el("div", "card");
  questionsCard.appendChild(renderSentenceList(v.questions));
  container.appendChild(questionsCard);

  container.appendChild(section("Common Mistakes"));
  const mistakesWrap = el("div");
  v.commonMistakes.forEach((m) => {
    const item = el("div", "mistake-item");
    item.innerHTML = `<div><span class="mistake-wrong">${escapeHtml(m.wrong)}</span> → <span class="mistake-right">${escapeHtml(m.right)}</span></div>`;
    item.appendChild(el("div", "mistake-why", escapeHtml(m.why)));
    mistakesWrap.appendChild(item);
  });
  container.appendChild(mistakesWrap);

  container.appendChild(section("Grammar Tips"));
  const tipsCard = el("div", "card");
  const tipsList = el("ul", "plain-list");
  v.grammarTips.forEach((t) => tipsList.appendChild(el("li", "", escapeHtml(t))));
  tipsCard.appendChild(tipsList);
  container.appendChild(tipsCard);

  container.appendChild(section("Synonyms & Antonyms"));
  const synCard = el("div", "card");
  synCard.innerHTML = `
    <div style="margin-bottom:8px;"><b>Synonyms:</b> ${v.synonyms.length ? v.synonyms.map(escapeHtml).join(", ") : "—"}</div>
    <div><b>Antonyms:</b> ${v.antonyms.length ? v.antonyms.map(escapeHtml).join(", ") : "—"}</div>
  `;
  container.appendChild(synCard);

  container.appendChild(section("Daily Conversation"));
  const convoCard = el("div", "card");
  v.dailyConversation.forEach((d) => {
    const line = el("div", "dialogue-line");
    line.innerHTML = `<div class="dialogue-speaker">${escapeHtml(d.speaker)}</div>`;
    const textWrap = el("div", "dialogue-text");
    textWrap.textContent = d.line;
    line.appendChild(textWrap);
    line.appendChild(speakButton(d.line));
    convoCard.appendChild(line);
  });
  container.appendChild(convoCard);

  container.appendChild(section("Mini Quiz"));
  const quizCard = el("div", "card");
  renderMiniQuiz(quizCard, v.miniQuiz);
  container.appendChild(quizCard);

  window.scrollTo(0, 0);
}

function renderMiniQuiz(container, questions) {
  questions.forEach((q, idx) => {
    const qWrap = el("div");
    qWrap.style.marginBottom = "20px";
    qWrap.innerHTML = `<div style="font-weight:700;margin-bottom:8px;">${idx + 1}. ${escapeHtml(q.question)}</div>`;

    if (q.type === "mcq") {
      const optWrap = el("div", "quiz-options");
      let answered = false;
      q.options.forEach((opt) => {
        const optBtn = el("button", "quiz-option", escapeHtml(opt));
        optBtn.onclick = () => {
          if (answered) return;
          answered = true;
          const correct = opt === q.answer;
          optBtn.classList.add(correct ? "correct" : "incorrect");
          if (!correct) {
            [...optWrap.children].forEach((b) => { if (b.textContent === q.answer) b.classList.add("correct"); });
          }
          qWrap.appendChild(el("div", "mistake-why", escapeHtml(q.explanation)));
        };
        optWrap.appendChild(optBtn);
      });
      qWrap.appendChild(optWrap);
    } else {
      const input = el("input", "text-input", "");
      input.type = "text";
      input.placeholder = "Type your answer...";
      input.style.marginBottom = "8px";
      const checkBtn = el("button", "btn secondary", "Check");
      const feedback = el("div");
      feedback.style.marginTop = "8px";
      checkBtn.onclick = () => {
        const correct = input.value.trim().toLowerCase() === q.answer.toLowerCase();
        feedback.innerHTML = `<div class="feedback-box ${correct ? "correct" : "incorrect"}">${correct ? "Correct!" : `Not quite - the answer is "${escapeHtml(q.answer)}"`}</div><div class="mistake-why" style="margin-top:6px;">${escapeHtml(q.explanation)}</div>`;
      };
      qWrap.appendChild(input);
      qWrap.appendChild(checkBtn);
      qWrap.appendChild(feedback);
    }
    container.appendChild(qWrap);
  });
}

async function init() {
  setupThemeToggle();
  const container = document.getElementById("verbsContainer");
  container.innerHTML = `<div class="empty-state">Loading verbs...</div>`;
  try {
    const res = await fetch("../data/verbs.json");
    VERBS = await res.json();
    renderVerbList(container);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Couldn't load verbs. Please try again later.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
