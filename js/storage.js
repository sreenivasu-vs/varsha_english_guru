/* Progress storage - everything lives in localStorage, no backend needed. */
const STORAGE_KEY = "em_progress_v1";

function todayStr(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function defaultProgress() {
  return {
    completedLessons: {},   // { lessonId: { completedAt, quizScore, quizTotal } }
    practiceTests: [],      // [{ completedAt, score, total }]
    xp: 0,
    streak: { count: 0, lastActiveDate: null },
    badges: [],
    theme: "light",
  };
}

function getProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress();
    const parsed = JSON.parse(raw);
    return { ...defaultProgress(), ...parsed };
  } catch (e) {
    return defaultProgress();
  }
}

function saveProgress(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

function touchStreak(p) {
  const today = todayStr();
  const last = p.streak.lastActiveDate;
  if (last === today) return p; // already counted today
  if (!last) {
    p.streak.count = 1;
  } else {
    const yesterday = todayStr(new Date(Date.now() - 86400000));
    p.streak.count = last === yesterday ? p.streak.count + 1 : 1;
  }
  p.streak.lastActiveDate = today;
  return p;
}

function addXP(p, amount) {
  p.xp += amount;
  return p;
}

function xpToLevel(xp) {
  // simple curve: level up every 100 xp, gently increasing
  let level = 1;
  let threshold = 100;
  let remaining = xp;
  while (remaining >= threshold) {
    remaining -= threshold;
    level += 1;
    threshold = Math.round(threshold * 1.15);
  }
  return { level, into: remaining, needed: threshold };
}

function markLessonComplete(lessonId, quizScore, quizTotal) {
  let p = getProgress();
  const isFirstTime = !p.completedLessons[lessonId];
  const prevBest = p.completedLessons[lessonId]?.quizScore ?? -1;

  p.completedLessons[lessonId] = {
    completedAt: new Date().toISOString(),
    quizScore: Math.max(quizScore, prevBest === -1 ? -1 : 0, quizScore),
    quizTotal,
  };
  // keep best score
  if (prevBest > quizScore) {
    p.completedLessons[lessonId].quizScore = prevBest;
  }

  p = touchStreak(p);

  if (isFirstTime) {
    p = addXP(p, 20 + quizScore * 5);
  } else {
    p = addXP(p, 5);
  }

  saveProgress(p);
  return p;
}

function getLessonResult(lessonId) {
  const p = getProgress();
  return p.completedLessons[lessonId] || null;
}

function recordPracticeTest(score, total) {
  let p = getProgress();
  p.practiceTests.push({
    completedAt: new Date().toISOString(),
    score,
    total,
  });
  p = touchStreak(p);
  p = addXP(p, 10 + score * 4);
  saveProgress(p);
  return p;
}

function setTheme(theme) {
  const p = getProgress();
  p.theme = theme;
  saveProgress(p);
}

function resetProgress() {
  localStorage.removeItem(STORAGE_KEY);
}
