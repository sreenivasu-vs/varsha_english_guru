# Deploying English Master

Three free services, no credit card required for any of them:

| Piece | Service | 
|---|---|
| Frontend (static PWA) | [Netlify](https://netlify.com) |
| Backend (FastAPI) | [Render](https://render.com) |
| Database (PostgreSQL) | [Neon](https://neon.tech) |

The lessons, quizzes, dashboard, and PWA install all work with **just the frontend** on Netlify - no backend needed. The backend is only required for the login gate and Speaking Practice history. If you only care about the lessons, you can stop after Step 1.

---

## Step 1: Push the code to GitHub

1. Create a new repository on [github.com/new](https://github.com/new) (e.g. `english-master`). Leave it empty (no README/license).
2. In this project folder:
   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/english-master.git
   git push -u origin main
   ```

---

## Step 2: Database - Neon (PostgreSQL)

1. Sign up at [neon.tech](https://neon.tech) (free, no card needed).
2. Create a new project (any name/region).
3. On the project dashboard, copy the **connection string** - it looks like:
   ```
   postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require
   ```
   Keep this for Step 3.

---

## Step 3: Backend - Render

1. Sign up at [render.com](https://render.com) and connect your GitHub account.
2. Click **New +** → **Blueprint**, select your `english-master` repo. Render will detect `render.yaml` at the repo root automatically - leave the "Blueprint Path" field as the default (don't point it at a subfolder; Render only auto-scans the root).
   - If you'd rather set it up manually instead: **New +** → **Web Service** → select the repo → set **Root Directory** to `backend`, **Build Command** to `pip install -r requirements.txt`, **Start Command** to `uvicorn main:app --host 0.0.0.0 --port $PORT`.
3. Under **Environment**, set:
   - `DATABASE_URL` = the Neon connection string from Step 2
   - `LANGUAGETOOL_URL` = `https://api.languagetool.org/v2/check` (default, no self-hosting needed)
   - `ALLOWED_ORIGINS` = leave as `*` for now - you'll update this in Step 5
4. Deploy. Once live, copy your backend's URL, e.g. `https://english-master-api.onrender.com`.
5. Sanity check it works: open `https://YOUR-BACKEND-URL.onrender.com/api/health` in a browser - it should show `{"status":"ok"}`.

> **Free tier note**: Render's free web services spin down after 15 minutes of inactivity and take ~30-60 seconds to wake up on the next request. The first login/grammar-check after idle time will feel slow - that's expected, not a bug.

---

## Step 4: Frontend - Netlify

1. Sign up at [netlify.com](https://netlify.com) and connect your GitHub account.
2. **Add new site** → **Import an existing project** → select your `english-master` repo.
3. Build settings: leave **Build command** empty, set **Publish directory** to `.` (Netlify should auto-detect this from `netlify.toml`).
4. Deploy. You'll get a URL like `https://random-name-123.netlify.app` (you can rename it under Site settings → Domain management).

---

## Step 5: Connect frontend and backend

Now that both are live, wire them together:

1. Open [js/auth.js](js/auth.js) and replace the placeholder:
   ```js
   : "https://YOUR-BACKEND-URL.onrender.com";
   ```
   with your real Render URL from Step 3.
2. Commit and push:
   ```
   git add js/auth.js
   git commit -m "Point frontend at deployed backend"
   git push
   ```
   Netlify auto-redeploys on push.
3. Back in Render, update the `ALLOWED_ORIGINS` environment variable to your real Netlify URL from Step 4 (e.g. `https://random-name-123.netlify.app`), then save - Render will redeploy the backend automatically.

---

## Step 6: Test it live

Visit your Netlify URL and check:
- [ ] Lessons and quizzes load (Course Levels section)
- [ ] "New User" signup works and doesn't show a CORS/connection error
- [ ] "Existing User" login works after creating an account
- [ ] Speaking Practice records, transcribes, and grammar-checks a sentence
- [ ] Install prompt appears (or install via browser menu) - PWA requires HTTPS, which both Netlify and Render provide automatically

---

## Optional: custom domain

Both Netlify and Render support free custom domains (you just need to own one, e.g. from Namecheap/GoDaddy - typically ₹800-1000/year). Add it under each service's Domain settings and update DNS records as instructed.

## Optional: self-hosted LanguageTool

If you outgrow the free public LanguageTool API's rate limits, see the "Swapping to self-hosted LanguageTool" section in [backend/README.md](backend/README.md). You'd deploy it as a second Render service (or any Docker host) and point `LANGUAGETOOL_URL` at it.
