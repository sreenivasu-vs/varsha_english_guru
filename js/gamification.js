/* Badge definitions and progress-based suggestions ("what to do next"). */

const BADGES = [
  { id: "first-lesson", name: "First Step", icon: "🌱", check: (p) => Object.keys(p.completedLessons).length >= 1 },
  { id: "five-lessons", name: "Getting Going", icon: "📘", check: (p) => Object.keys(p.completedLessons).length >= 5 },
  { id: "ten-lessons", name: "Dedicated", icon: "📚", check: (p) => Object.keys(p.completedLessons).length >= 10 },
  { id: "streak-3", name: "3-Day Streak", icon: "🔥", check: (p) => p.streak.count >= 3 },
  { id: "streak-7", name: "7-Day Streak", icon: "🔥🔥", check: (p) => p.streak.count >= 7 },
  { id: "streak-30", name: "30-Day Streak", icon: "🏆", check: (p) => p.streak.count >= 30 },
  { id: "quiz-perfect", name: "Perfect Quiz", icon: "🎯", check: (p) => Object.values(p.completedLessons).some(l => l.quizTotal > 0 && l.quizScore === l.quizTotal) },
  { id: "xp-100", name: "100 XP", icon: "⭐", check: (p) => p.xp >= 100 },
  { id: "xp-500", name: "500 XP", icon: "🌟", check: (p) => p.xp >= 500 },
  { id: "level3-tenses", name: "Tense Master", icon: "⏳", check: (p) => ["present-simple","present-continuous","present-perfect","present-perfect-continuous","past-simple","past-continuous","past-perfect","past-perfect-continuous","future-simple","future-continuous","future-perfect","future-perfect-continuous"].every(id => p.completedLessons[id]) },
  { id: "practice-test-1", name: "Test Taker", icon: "📝", check: (p) => (p.practiceTests || []).length >= 1 },
  { id: "practice-test-5", name: "Test Pro", icon: "🧠", check: (p) => (p.practiceTests || []).length >= 5 },
  { id: "practice-test-perfect", name: "Ace the Test", icon: "🏅", check: (p) => (p.practiceTests || []).some(t => t.total > 0 && t.score === t.total) },
];

function getEarnedBadges(progress) {
  return BADGES.filter(b => b.check(progress));
}

function checkNewBadges(progressBefore, progressAfter) {
  const before = new Set(getEarnedBadges(progressBefore).map(b => b.id));
  const after = getEarnedBadges(progressAfter);
  return after.filter(b => !before.has(b.id));
}

/* Suggest what to work on next: first incomplete lesson in order,
   plus weak topics (quiz score < 70%) for revision suggestions. */
function getNextLesson(curriculum, progress) {
  for (const level of curriculum.levels) {
    for (const mod of level.modules) {
      for (const lesson of mod.lessons) {
        if (!progress.completedLessons[lesson.id]) {
          return { ...lesson, levelId: level.id, levelTitle: level.title, moduleTitle: mod.title };
        }
      }
    }
  }
  return null;
}

function getWeakTopics(curriculum, progress) {
  const weak = [];
  for (const level of curriculum.levels) {
    for (const mod of level.modules) {
      for (const lesson of mod.lessons) {
        const result = progress.completedLessons[lesson.id];
        if (result && result.quizTotal > 0) {
          const pct = result.quizScore / result.quizTotal;
          if (pct < 0.7) {
            weak.push({ ...lesson, levelTitle: level.title, pct });
          }
        }
      }
    }
  }
  return weak.sort((a, b) => a.pct - b.pct);
}

function countAllLessons(curriculum) {
  let total = 0;
  for (const level of curriculum.levels) {
    for (const mod of level.modules) total += mod.lessons.length;
  }
  return total;
}

function countLevelLessons(level) {
  let total = 0, done = 0;
  return { total: level.modules.reduce((s, m) => s + m.lessons.length, 0) };
}
