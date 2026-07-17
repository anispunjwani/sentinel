# Sentinel
**Disaster Management Intelligence Dashboard**

A free, open-source event aggregation and alert dashboard for volunteer and professional disaster management teams. Consolidates weather alerts, emergency broadcasts, and news feeds into a single configurable interface with push notifications via Progressive Web App.

---

## 🚀 Live Deployment

The app is deployed and running:

| What | URL |
|------|-----|
| **Dashboard (open this to use the app)** | https://sentinel-68y.pages.dev |
| **API (backend)** | https://sentinel-production-249d.up.railway.app |
| Backend health check | https://sentinel-production-249d.up.railway.app/health |
| Interactive API docs (Swagger) | https://sentinel-production-249d.up.railway.app/docs |

**How to log in:** open the **Dashboard** URL and sign in with the admin **email + password**
that were created when the database was seeded (`python seed.py`). Your session persists
until you explicitly log out (tap the avatar top-right → **Log out**).

**Architecture:** Cloudflare Pages (static React PWA) → Railway (FastAPI + background workers)
→ Railway PostgreSQL. The frontend calls the backend at `VITE_API_URL`; the backend only
accepts browser requests from the origins listed in `CORS_ORIGINS`.

> Everything below is for running Sentinel **locally** or deploying **your own** copy.

---

## Table of Contents
1. [What You Need Before Starting](#1-what-you-need-before-starting)
2. [Local Development Setup](#2-local-development-setup)
3. [Deploy to Railway (backend)](#3-deploy-to-railway)
3.5. [Deploy the Frontend to Cloudflare Pages](#35-deploy-the-frontend-to-cloudflare-pages)
4. [First Run — Seed the Database](#4-first-run--seed-the-database)
5. [Install the App on Your Phone](#5-install-the-app-on-your-phone)
6. [Adding Keywords](#6-adding-keywords)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. What You Need Before Starting

Install these on your computer before anything else.

| Tool | Purpose | Download |
|------|---------|----------|
| Git | Version control | https://git-scm.com |
| Docker Desktop | Run the app locally | https://www.docker.com/products/docker-desktop |
| Python 3.11+ | Run seed and utility scripts | https://www.python.org |
| A GitHub account | Host the code | https://github.com |
| A Railway account | Free cloud hosting | https://railway.app (sign in with GitHub) |

---

## 2. Local Development Setup

Follow these steps exactly, in order.

### Step 1 — Get the code onto your computer

Open Terminal (Mac) or Command Prompt (Windows) and run:

```bash
git clone https://github.com/YOUR-GITHUB-USERNAME/sentinel.git
cd sentinel
```

Replace `YOUR-GITHUB-USERNAME` with your actual GitHub username.

### Step 2 — Generate VAPID keys for push notifications

These keys let the app send push notifications to your phone. Run this once.

```bash
cd backend
pip install pywebpush
python scripts/generate_vapid.py
```

You will see output like this:

```
VAPID_PRIVATE_KEY=-----BEGIN EC PRIVATE KEY-----
MHQCAQEEIAbc...
-----END EC PRIVATE KEY-----

VAPID_PUBLIC_KEY=BHk3Xyz...
```

**Copy both values and keep them somewhere safe.** You will need them in Steps 3 and later when deploying to Railway.

### Step 3 — Create your environment file

```bash
# Still inside the backend folder
cp .env.example .env
```

Open `.env` in any text editor and fill in:

```
DATABASE_URL=postgresql://sentinel:sentinel_dev@localhost:5432/sentinel
SECRET_KEY=    ← paste a random string here (see tip below)
VAPID_PRIVATE_KEY=    ← paste from Step 2
VAPID_PUBLIC_KEY=     ← paste from Step 2
VAPID_EMAIL=your-real-email@domain.com
ENVIRONMENT=development
```

**Tip — generate a SECRET_KEY:**
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

### Step 4 — Start the database and backend

Go back to the root sentinel folder:

```bash
cd ..   # back to sentinel/
docker-compose up --build
```

Docker will download what it needs (takes a few minutes the first time) and start:
- PostgreSQL database on port 5432
- FastAPI backend on port 8000

When you see `Application startup complete` in the terminal, the backend is running.

**Test it:** Open http://localhost:8000/health in your browser. You should see:
```json
{"status": "ok", "app": "Sentinel"}
```

### Step 5 — Run the database migration

Open a **new terminal window** (keep Docker running in the first one):

```bash
cd sentinel/backend
pip install -r requirements.txt
DATABASE_URL=postgresql://sentinel:sentinel_dev@localhost:5432/sentinel alembic upgrade head
```

This creates all the database tables. You should see:
```
INFO  [alembic.runtime.migration] Running upgrade  -> 0001_initial
```

### Step 6 — Seed the database

```bash
# Still in sentinel/backend
DATABASE_URL=postgresql://sentinel:sentinel_dev@localhost:5432/sentinel python seed.py
```

The script will ask for your name, email, and a password. This creates:
- Your pilot team with all 24 jurisdictions
- 13 pre-configured RSS news sources
- 3 default message templates
- Your first admin account

### Step 7 — Run the dashboard (frontend)

The frontend is a Vite + React PWA in the `frontend/` folder. You need
[Node.js 18+](https://nodejs.org) installed.

It has two modes, controlled by `VITE_USE_MOCKS`:

- **Mock mode (default)** — runs standalone against bundled demo data in
  `public/mocks/`. No backend needed. This is the mode used for stakeholder demos
  (including on Replit).
- **Live mode** — talks to the FastAPI backend at `VITE_API_URL` using your JWT.

Open a **new terminal** (keep the backend running):

```bash
cd frontend
cp .env.example .env   # first time only
npm install            # first time only
npm run dev
```

Open **http://localhost:5173**.

- To explore the full UI with demo data, leave `VITE_USE_MOCKS=true` in `.env` and
  log in with any email/password.
- To use your real backend, set `VITE_USE_MOCKS=false` and `VITE_API_URL=http://localhost:8000`
  in `.env`, then sign in with the admin account you created in Step 6.

The app is a complete dashboard: an Active Events banner, a 24h Digest summary,
center cards, an events browser, and Centers / Templates / Settings screens. Phone
push notifications are the one flow not yet wired end-to-end — see the roadmap in
`CLAUDE.md`.

---

## 3. Deploy to Railway

Do this after local setup is working.

### Step 1 — Push code to GitHub

```bash
# In the sentinel root folder
git init
git add .
git commit -m "Initial Sentinel scaffold"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/sentinel.git
git push -u origin main
```

### Step 2 — Create a Railway project

1. Go to https://railway.app and sign in
2. Click **New Project**
3. Choose **Deploy from GitHub repo**
4. Select your `sentinel` repository
5. **⚠️ Set the Root Directory to `backend`** — click the service → **Settings → Source
   → Root Directory** → `backend`. The backend lives in a subfolder, so without this the
   Docker build fails on `COPY requirements.txt`. Railway reads `backend/railway.toml`.

### Step 3 — Add a PostgreSQL database

1. In your Railway project, click **+ New**
2. Choose **Database → Add PostgreSQL**
3. Wire it into the backend: backend service → **Variables** → **New Variable** →
   `DATABASE_URL` = `${{Postgres.DATABASE_URL}}` (Railway autocompletes the reference).
   Services do **not** share the DB URL automatically — you must add this reference.

### Step 4 — Set environment variables in Railway

1. Click your backend service in Railway
2. Go to the **Variables** tab
3. Add these variables one by one:

| Variable | Value |
|----------|-------|
| `SECRET_KEY` | A random 64-character string (generate with python tip above) |
| `VAPID_PRIVATE_KEY` | From Step 2 of local setup |
| `VAPID_PUBLIC_KEY` | From Step 2 of local setup |
| `VAPID_EMAIL` | Your email address |
| `ENVIRONMENT` | `production` |
| `CORS_ORIGINS` | Your frontend URL(s), comma-separated (e.g. `https://sentinel-68y.pages.dev`) |

`DATABASE_URL` was wired in Step 3 as a reference — do not paste a raw connection string.

The app listens on `${PORT}`; if the generated domain shows **502 Bad Gateway**, set a
`PORT` variable (e.g. `8080`) and make the domain's **target port** match it.

**Important:** in `production`, the backend only accepts browser requests from the
origins listed in `CORS_ORIGINS`. If the dashboard shows "failed to fetch" after
deploy, this is almost always a missing or wrong `CORS_ORIGINS` value.

**Optional database-size tuning** (sensible defaults are built in — see the
free-tier notes in `CLAUDE.md`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `ARCHIVE_RETENTION_DAYS` | `180` | Hard-delete archived events older than this (`0` = keep forever) |
| `MAX_SUMMARY_LENGTH` | `2000` | Truncate stored event summaries to this many characters |
| `STORE_UNMATCHED_RSS` | `false` | Keep keyword-unmatched news articles (much larger DB if `true`) |

### Step 5 — Run the migration on Railway (one time)

The service starts uvicorn directly; migrations are a separate one-time step so a
slow or lock-blocked migration can never hang the web service. After the deploy is
healthy (`/health` responds):

1. In Railway, click your backend service
2. Go to the **Shell** tab
3. Run:

```bash
alembic upgrade head
```

You should see `Running upgrade -> 0001_initial`. If it appears to hang, a previous
deploy may be holding a lock — restart the PostgreSQL service to clear stale
connections, then run it again.

### Step 6 — Seed the Railway database

In the same Railway Shell (after the migration succeeds):

```bash
python seed.py
```

Enter your name, email, and password when prompted — this creates your team and
admin account.

### Step 7 — Get your public URL

1. Click your backend service in Railway
2. Go to **Settings → Networking**
3. Click **Generate Domain**
4. Your API is live at `https://something.up.railway.app` — verify `/health` returns
   `{"status":"ok","app":"Sentinel"}`. **Save this URL** — the frontend needs it next.

---

## 3.5 Deploy the Frontend to Cloudflare Pages

The dashboard is a static Vite/React app. Cloudflare Pages hosts it for free.

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** tab → **Connect to
   Git** (use **Pages**, *not* the Workers "import a repository" flow — that path requires
   Vite 6 and will fail on this project's Vite 5).
2. Select the `sentinel` repo, branch `main`.
3. Build settings:
   - **Root directory:** `frontend`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Environment variables (build-time — `VITE_` vars are baked in at build):
   ```
   VITE_USE_MOCKS = false
   VITE_API_URL   = https://<your-railway-domain>.up.railway.app
   ```
5. **Save and Deploy.** You get a stable URL like `https://sentinel-xxxx.pages.dev` plus a
   per-deploy `https://<hash>.sentinel-xxxx.pages.dev` alias.
6. **Wire CORS:** back in Railway, set `CORS_ORIGINS` to include **both** URLs, comma-separated:
   ```
   https://sentinel-xxxx.pages.dev,https://<hash>.sentinel-xxxx.pages.dev
   ```
   Saving redeploys the backend. Without this the browser shows **"failed to fetch"** (CORS).

Open the `*.pages.dev` URL and log in. Since it's a PWA, you can also add it to your phone's
home screen (see section 5).

> **Local vs live:** the same frontend runs against mock data with `VITE_USE_MOCKS=true`
> (no backend needed — good for demos), or against a real backend with `VITE_USE_MOCKS=false`
> and `VITE_API_URL` set. See `frontend/.env.example`.

---

## 4. First Run — Seed the Database

The seed script only needs to run once per environment (local or Railway). If you run it twice, it will create a second team. If that happens, contact your engineer.

---

## 5. Install the App on Your Phone

### iPhone
1. Open Safari and go to your Railway URL
2. Tap the **Share** button (box with arrow pointing up)
3. Scroll down and tap **Add to Home Screen**
4. Tap **Add**
5. Open the app from your home screen
6. Go to **Settings** and tap **Enable Push Notifications**
7. Tap **Allow** when your phone asks for permission

### Android
1. Open Chrome and go to your Railway URL
2. Tap the **three dots menu** (top right)
3. Tap **Add to Home Screen**
4. Tap **Add**
5. Open the app and enable notifications in Settings

**Note:** Push notifications on iPhone require iOS 16.4 or later.

---

## 6. Adding Keywords

Keywords let Sentinel flag news articles that mention specific schools, landmarks, or locations in your coverage area.

1. Log in to the dashboard
2. Go to **Configuration → Keywords**
3. Click **Add Keyword**
4. Type the keyword (e.g. `Lincoln High School` or `Route 9 bridge`)
5. Click **Save**

Keywords are case-insensitive and match anywhere in an article's title or summary.

---

## 7. Troubleshooting

**Docker won't start**
Make sure Docker Desktop is open and running before running `docker-compose up`.

**"MODULE NOT FOUND" error when running seed.py**
Make sure you're in the `sentinel/backend` folder when running the seed script, not the root folder.

**Migration fails with "already exists" error**
The migration has already run. This is fine — run `alembic current` to check the status.

**Push notifications not arriving on iPhone**
Check that your iOS version is 16.4 or later. Go to Settings → General → Software Update.

**The app says "No events" on the dashboard**
The NWS worker runs every 5 minutes. Wait a few minutes after startup and refresh. If your coverage area has no active weather alerts, the Active section will be empty — that's correct behavior.

**Frontend shows "failed to fetch" on login (deployed)**
This is almost always CORS. Set `CORS_ORIGINS` on the Railway backend to your exact frontend
origin(s) — https, no trailing slash, comma-separated. If the request URL in the browser's
Network tab points at `localhost:8000`, then `VITE_API_URL` wasn't set at build time — set it
in Cloudflare Pages and redeploy (`VITE_` vars are build-time).

**Railway domain returns 502 Bad Gateway**
Port mismatch. The app listens on `${PORT}`; set a `PORT` variable (e.g. `8080`) and make the
domain's target port match. Check the deploy logs for `Uvicorn running on http://0.0.0.0:<port>`.

**`alembic upgrade head` hangs on Railway**
A stale lock from a prior failed deploy. Restart the PostgreSQL service to drop connections,
then re-run. (Migrations use a synchronous psycopg2 driver; they are a manual one-time step,
not run on boot.)

**Login returns 401 after deploy**
The deployed database has its own admin account (created by `python seed.py` in the Railway
shell) — separate from your local one. Use the credentials you set on Railway, or reset them
in the Railway shell.

**Need to add a second team member?**
Go to **Configuration → Team Members → Invite**. They will receive a setup email.

---

## Architecture Reference

See `docs/Sentinel_Architecture_v0.1.docx` for the full technical architecture document.

## License

MIT License. Free to use, modify, and deploy.
