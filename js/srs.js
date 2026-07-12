/* Spaced-repetition engine (Leitner-style box system) for the flashcard
   deck. Runs entirely in localStorage - no backend needed. A card starts
   unreviewed ("new"); each review moves it up or down a box, and its box
   determines how many days until it's due again, so items you already know
   resurface less often while shaky ones come back sooner. */

const SRS_KEY = "em_srs_v1";
const NEW_CARDS_PER_DAY = 20;
const BOX_INTERVAL_DAYS = [1, 3, 7, 14, 30, 90]; // index 0 = box 1

function defaultSrsState() {
  return {
    cards: {}, // cardId -> { box, dueDate, reviewCount }
    deckOrder: null, // shuffled indices into the full card list, walked once
    deckPos: 0,
    newToday: { date: null, count: 0 },
  };
}

function getSrsState() {
  try {
    const raw = localStorage.getItem(SRS_KEY);
    if (!raw) return defaultSrsState();
    return { ...defaultSrsState(), ...JSON.parse(raw) };
  } catch (e) {
    return defaultSrsState();
  }
}

function saveSrsState(s) {
  localStorage.setItem(SRS_KEY, JSON.stringify(s));
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ensureDeckOrder(s, allCards) {
  if (!s.deckOrder || s.deckOrder.length !== allCards.length) {
    s.deckOrder = shuffleArray(allCards.map((_, i) => i));
    s.deckPos = 0;
  }
}

function resetNewTodayIfStale(s) {
  const today = todayStr();
  if (s.newToday.date !== today) {
    s.newToday = { date: today, count: 0 };
  }
}

/* Read-only estimate of how many cards are ready right now (due reviews +
   still-available new cards under today's quota), for dashboard display.
   Does not mutate saved state. */
function peekDueCount(allCards) {
  const s = getSrsState();
  const today = todayStr();
  ensureDeckOrder(s, allCards);
  resetNewTodayIfStale(s);

  const dueCount = allCards.filter((c) => s.cards[c.id] && s.cards[c.id].dueDate <= today).length;
  const remainingQuota = Math.max(0, NEW_CARDS_PER_DAY - s.newToday.count);
  let availableNew = 0;
  for (let i = s.deckPos; i < s.deckOrder.length && availableNew < remainingQuota; i++) {
    const card = allCards[s.deckOrder[i]];
    if (!s.cards[card.id]) availableNew++;
  }
  return dueCount + availableNew;
}

/* Builds and commits today's review queue: due cards plus up to the daily
   new-card quota, shuffled together. Mutates and saves SRS state (advances
   deckPos and today's new-card count), since starting a session "spends"
   today's new cards even if the user doesn't finish reviewing them all. */
function startTodayQueue(allCards) {
  const s = getSrsState();
  const today = todayStr();
  ensureDeckOrder(s, allCards);
  resetNewTodayIfStale(s);

  const dueCards = allCards.filter((c) => s.cards[c.id] && s.cards[c.id].dueDate <= today);

  const newCards = [];
  const remainingQuota = Math.max(0, NEW_CARDS_PER_DAY - s.newToday.count);
  while (newCards.length < remainingQuota && s.deckPos < s.deckOrder.length) {
    const card = allCards[s.deckOrder[s.deckPos]];
    s.deckPos += 1;
    if (!s.cards[card.id]) newCards.push(card);
  }
  s.newToday.count += newCards.length;

  saveSrsState(s);
  return shuffleArray([...dueCards, ...newCards]);
}

/* rating: "again" (forgot - back to box 1), "good" (box + 1), or
   "easy" (box + 2, still capped at the longest interval). */
function rateCard(cardId, rating) {
  const s = getSrsState();
  const existing = s.cards[cardId] || { box: 0, dueDate: null, reviewCount: 0 };
  let box = existing.box;
  if (rating === "again") box = 1;
  else if (rating === "good") box = Math.min(box + 1, BOX_INTERVAL_DAYS.length);
  else box = Math.min(box + 2, BOX_INTERVAL_DAYS.length);
  if (box < 1) box = 1;

  const days = BOX_INTERVAL_DAYS[box - 1];
  const due = new Date();
  due.setDate(due.getDate() + days);

  s.cards[cardId] = {
    box,
    dueDate: todayStr(due),
    reviewCount: existing.reviewCount + 1,
  };
  saveSrsState(s);
  return s.cards[cardId];
}
