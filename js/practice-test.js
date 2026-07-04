const TEST_SIZE = 20;

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

function showToast(msg) {
  const t = el("div", "toast", msg);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Pulls every quiz question from every lesson in the curriculum into one
   pool, tagged with its source lesson, so a mixed test can sample from it. */
async function buildQuestionBank() {
  const res = await fetch("../data/curriculum.json");
  const curriculum = await res.json();
  const lessonRefs = [];
  for (const level of curriculum.levels) {
    for (const mod of level.modules) {
      for (const lesson of mod.lessons) {
        lessonRefs.push(lesson);
      }
    }
  }

  const lessons = await Promise.all(
    lessonRefs.map(async (ref) => {
      try {
        const r = await fetch(`../data/lessons/${ref.id}.json`);
        if (!r.ok) return null;
        const data = await r.json();
        return { ...data, id: ref.id };
      } catch (e) {
        return null;
      }
    })
  );

  const pool = [];
  lessons.forEach((lesson) => {
    if (!lesson || !lesson.quiz) return;
    lesson.quiz.forEach((q) => {
      pool.push({ ...q, sourceLessonId: lesson.id, sourceLessonTitle: lesson.title });
    });
  });
  return pool;
}

function renderIntro(container, pool) {
  container.innerHTML = "";
  const card = el("div", "card");
  card.innerHTML = `
    <div class="section-title" style="margin-top:0">Mixed Practice Test</div>
    <p style="margin:0 0 12px;">Test yourself with ${TEST_SIZE} random questions pulled from every lesson - grammar, tenses, vocabulary, conversation, idioms, and more, all mixed together.</p>
    <p style="margin:0;color:var(--text-muted);font-size:13px;">Question bank: ${pool.length} questions available.</p>
  `;
  const startBtn = el("button", "btn block", pool.length ? "Start Practice Test" : "No questions available yet");
  startBtn.style.marginTop = "14px";
  startBtn.disabled = pool.length === 0;
  startBtn.onclick = () => runTest(container, pool);
  card.appendChild(startBtn);
  container.appendChild(card);
}

function runTest(container, pool) {
  const size = Math.min(TEST_SIZE, pool.length);
  const questions = shuffle(pool).slice(0, size);

  container.innerHTML = "";
  const card = el("div", "card");
  const quizArea = el("div");
  card.appendChild(quizArea);
  container.appendChild(card);

  renderQuiz(quizArea, questions, (score, total) => finishTest(container, score, total));
}

function finishTest(container, score, total) {
  const before = getProgress();
  const after = recordPracticeTest(score, total);
  const pct = Math.round((score / total) * 100);

  container.innerHTML = "";
  const card = el("div", "card");
  card.innerHTML = `
    <div class="quiz-result">
      <div class="score-big">${score}/${total}</div>
      <div style="margin:8px 0;color:var(--text-muted);">${pct}% - ${pct >= 80 ? "Excellent work!" : pct >= 50 ? "Good effort - keep practicing!" : "Keep studying the lessons and try again."}</div>
    </div>
  `;
  const retryBtn = el("a", "btn block", "Take Another Test");
  retryBtn.href = "practice-test.html";
  const homeBtn = el("a", "btn secondary block", "Back to Dashboard");
  homeBtn.href = "../index.html";
  homeBtn.style.marginTop = "10px";
  card.appendChild(retryBtn);
  card.appendChild(homeBtn);
  container.appendChild(card);

  const newBadges = checkNewBadges(before, after);
  newBadges.forEach((b, i) => {
    setTimeout(() => showToast(`${b.icon} Badge earned: ${b.name}!`), i * 1600);
  });
  showToast("✅ Test saved · +XP earned");
}

async function init() {
  setupThemeToggle();
  const container = document.getElementById("testContainer");
  try {
    const pool = await buildQuestionBank();
    renderIntro(container, pool);
  } catch (e) {
    container.innerHTML = `<div class="empty-state">Could not load questions. Please check your connection and try again.</div>`;
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("../service-worker.js").catch(() => {});
  }
}

init();
