# English Master

A free, installable PWA for learning English grammar, tenses, vocabulary, conversation, and business English — with quizzes, streaks, XP, badges, and progress tracking.

100% static: plain HTML/CSS/JS + JSON content files. No backend, no build step, no server costs. Progress is saved in the browser's `localStorage`.

The front page shows a **New User / Existing User** login gate backed by the small server in [backend/](backend/) (FastAPI + PostgreSQL): new users pick a username (with alternative suggestions if it's taken), existing users log in and see a summary of their Speaking Practice history. If the backend isn't running, "Continue without an account" skips straight to the dashboard - lesson progress still works fully offline in `localStorage` either way; only account login and Speaking Practice need the backend.

## Run it locally

Any static file server works. Example with Node:

```
npx serve .
```

Then open the URL it prints (e.g. `http://localhost:3000`).

> Don't open `index.html` directly via `file://` — the app fetches JSON files, which requires a real HTTP server (even a local one).

## Project structure

```
index.html            Dashboard: levels, streak, XP, badges, "continue learning"
pages/lesson.html      Generic lesson template (reads data/lessons/<id>.json)
css/style.css          Design system (light + dark mode)
js/app.js              Dashboard logic
js/lesson.js           Lesson page rendering
js/quiz.js             Quiz engine (MCQ, fill-in-blank, rearrange, error-correction)
js/storage.js          Progress, XP, streak persistence (localStorage)
js/gamification.js     Badge rules + "what to learn next" / weak-topic logic
js/speech.js           Free pronunciation playback via the Web Speech API
data/curriculum.json   The syllabus tree: Levels → Modules → Lessons
data/lessons/*.json    One JSON file per lesson (content + quiz)
manifest.json, service-worker.js   PWA install + offline support
```

## Adding new lessons (no coding required)

1. Add an entry to `data/curriculum.json` under the right level/module:
   ```json
   { "id": "my-lesson-id", "title": "My Lesson Title" }
   ```
2. Create `data/lessons/my-lesson-id.json` following this shape (all fields optional except `level`, `module`, `title` — include whichever sections apply):
   ```json
   {
     "level": 1,
     "module": "Parts of Speech",
     "title": "My Lesson Title",
     "definition": "...",
     "formula": "...",
     "rules": ["..."],
     "structure": { "positive": "...", "negative": "...", "question": "...", "whQuestion": "..." },
     "signalWords": ["..."],
     "examples": ["..."],
     "dailyConversation": [{ "speaker": "A", "line": "..." }],
     "dialogue": [{ "speaker": "You", "line": "..." }],
     "words": [{ "word": "...", "pronunciation": "...", "meaning": "...", "synonyms": [], "antonyms": [], "sentence": "..." }],
     "idioms": [{ "phrase": "...", "meaning": "...", "example": "..." }],
     "commonMistakes": [{ "wrong": "...", "right": "...", "why": "..." }],
     "quiz": [
       { "type": "mcq", "question": "...", "options": ["a", "b", "c"], "answer": "b", "explanation": "..." },
       { "type": "fill", "question": "...", "answer": "...", "explanation": "..." },
       { "type": "rearrange", "words": ["..."], "answer": "...", "explanation": "..." },
       { "type": "error", "sentence": "...", "correction": "...", "explanation": "..." }
     ]
   }
   ```

That's it — the lesson page, quiz engine, dashboard progress, and offline cache all pick it up automatically.

## What's already built

- Level 1: alphabet/phonics, all 9 parts of speech, articles, verb types
- Level 2: 5 sentence patterns
- Level 3: all 12 tenses (positive/negative/question/WH, signal words, daily conversation)
- Level 4: passive voice, reported speech, conditionals, subject-verb agreement, question tags, comparison
- Level 5: daily vocabulary builder (sample day, easy to add more days)
- Level 6: 7 everyday conversation situations
- Level 7: corporate English (stand-ups, email, meetings)
- Level 8: idioms
- Level 9: business English
- Level 10: fluency practice guide (shadowing, picture description, debate, 30-day plan)

46 lessons total, each with a quiz. Add more anytime using the schema above — it's just data.

- **Mixed Practice Test** (`pages/practice-test.html`): pulls every quiz question from every lesson into one pool and samples 20 at random for a quick overall progress check. Scores are tracked separately from lesson quizzes and count toward XP, streaks, and dedicated badges (Test Taker, Test Pro, Ace the Test).

## Deploy for free

1. Push this folder to a GitHub repository.
2. Deploy with **Netlify**, **Vercel**, or **GitHub Pages** (all free, all give you a URL, all auto-redeploy on push). No build command needed — it's a static site.
3. Optional: attach a custom domain later.

## Turn it into an Android app

1. The site is already a PWA (`manifest.json` + `service-worker.js`) — once deployed over HTTPS, users can "Install app" from Chrome to add it to their home screen and use it offline.
2. To publish on the Play Store: use **PWABuilder** (pwabuilder.com) to wrap it as a Trusted Web Activity, or **Capacitor**. You'll need a one-time $25 Google Play developer fee and a simple hosted privacy policy page.

## Known limitation to fix before wide release

The app icon (`icons/icon.svg`) is currently SVG-only. Most modern browsers accept this for PWA installs, but for best Android/Play Store compatibility you should generate real PNG icons (192×192 and 512×512, plus a maskable version) from a favicon generator and reference them in `manifest.json`.
