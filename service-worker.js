const CACHE_NAME = "english-master-v38";
const APP_SHELL = [
  "./manifest.json",
  "./css/style.css",
  "./js/app.js",
  "./js/storage.js",
  "./js/srs.js",
  "./js/gamification.js",
  "./js/auth.js",
  "./js/auth-gate.js",
  "./js/speech.js",
  "./js/quiz.js",
  "./js/lesson.js",
  "./js/practice-test.js",
  "./js/speech-practice.js",
  "./js/daily-conversation.js",
  "./js/shadowing-practice.js",
  "./js/tongue-twisters.js",
  "./js/flashcards.js",
  "./js/listening-practice.js",
  "./js/speaking-test.js",
  "./js/verbs.js",
  "./js/find-the-mistake.js",
  "./js/word-builder.js",
  "./js/verb-challenge.js",
  "./js/games.js",
  "./icons/icon.svg",
  "./data/curriculum.json",
  "./data/games.json",
  "./data/daily-conversations.json",
  "./data/shadowing-sentences.json",
  "./data/shadowing-paragraphs.json",
  "./data/natural-speech.json",
  "./data/tongue-twisters.json",
  "./data/listening-dictation.json",
  "./data/listening-comprehension.json",
  "./data/speaking-test-topics.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* Cache-first for app shell (CSS/JS/data), stale-while-revalidate for lesson
   JSON so new lesson files get picked up automatically. Page navigations
   (index.html, pages/lesson.html) are intentionally NOT intercepted here:
   some static hosts issue a redirect for .html URLs (clean URLs), and Chrome
   refuses to let a service worker respondWith() a redirected response for a
   navigation request - intercepting it would break every page load. */
self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") return;

  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.includes("/data/lessons/") || url.pathname.endsWith("/data/flashcards.json") || url.pathname.endsWith("/data/verbs.json") || url.pathname.endsWith("/data/mistake-game.json") || url.pathname.endsWith("/data/word-builder.json")) {
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(event.request);
        const networkFetch = fetch(event.request)
          .then((res) => {
            cache.put(event.request, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || networkFetch;
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
