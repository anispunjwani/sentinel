# CLAUDE.md — Sentinel

Guidance and running context for working in this repo. See `README.md` for the
end-user setup guide and `Sentinel_PRD_v0.1.docx` for the full product spec.

## What this is

Disaster-management intelligence dashboard: a FastAPI backend that polls public
alert sources (NWS, RSS, later FEMA), classifies events into three tiers
(Active / Monitor / Digest), stores them in PostgreSQL, and (eventually) pushes
notifications to a PWA frontend. Multi-tenant by `Team`. Deploys to Railway.

**Current state:** ingestion backend + REST API (Phases A–C) + a minimal React
dashboard. Remaining: PWA push subscription loop, and config/digest/export UI.

## Running locally (Docker — the reliable path on Windows)

Everything runs in containers; no host Python or venv needed.

```powershell
docker compose up --build -d                         # start Postgres + backend
docker compose exec backend alembic upgrade head     # create tables
docker compose exec backend python seed.py           # seed pilot team + admin (interactive)
docker compose logs -f backend                        # watch worker activity
docker compose down                                   # stop (add -v to wipe the DB volume)
```

Health check: http://localhost:8000/health → `{"status":"ok","app":"Sentinel"}`

Manually trigger a worker (useful for testing without waiting for the interval):
```powershell
docker compose exec -T backend python -c "import asyncio, logging; logging.basicConfig(level=logging.INFO); from app.workers.nws_worker import run_nws_worker; asyncio.run(run_nws_worker())"
```

## Component status (active vs dormant)

- **Active:** FastAPI app + `/health`, REST API routers (`app/api/*` — auth, events,
  config, templates, export, digest), APScheduler (NWS 5min, RSS 15min, expiry 1h,
  archive 2am), NWS worker (fixed — see below), classifier, expiry/archive workers,
  `renderer.py` (via template render endpoint), `push.py` (via escalate/manual-Active).
- **Dormant / not built:** push *subscription* endpoints (`/api/push/*` — no way for a
  device to register yet, so notifications never reach a phone), FEMA worker, scheduled
  digest *delivery* worker (the `/api/digest` view exists; the push-on-schedule job does not).

## API surface (Phases A–C, all team-scoped + JWT-gated)

```
auth:      POST /api/auth/login   GET /api/auth/me
events:    GET /api/events   POST /api/events (manual)   GET /api/events/{id}
           PATCH /api/events/{id}/review   POST /api/events/{id}/escalate (push on Active)
templates: GET /api/templates   GET /api/templates/variables   POST /api/templates/{id}/render
config:    GET counties|keywords|rss-sources   +  POST/PATCH/DELETE (admin-only)
reports:   GET /api/digest   GET /api/export/incidents.csv
```

## Frontend (`frontend/`)

Minimal Vite + React (JS, plain CSS, plain `fetch` — no UI/router/state libraries).
Login + tiered dashboard (Active/Monitor/Digest) with review, one-step escalate, and
template render-to-copy. Run: `cd frontend && npm install && npm run dev` (→ :5173).
API base is `VITE_API_URL` (defaults to `http://localhost:8000`).
Not yet built: config/digest/export screens, PWA + push subscription.

## Fixes already applied during setup (context, not TODO)

- `requirements.txt`: pinned `bcrypt==4.0.1` (passlib 1.7.4 breaks on bcrypt 4.1+).
- `app/models/models.py`: added `values_callable` to the `UserRole` and
  `AlertTier` enum columns so SQLAlchemy sends lowercase DB values, not member names.
- `app/workers/nws_worker.py`: NWS `/alerts/active` has no `county` param — switched
  to `zone` with UGC codes (`<state>C<last3 FIPS>`); normalized NWS tz-aware
  timestamps to naive UTC to match the DB columns.

---

## Deferred / backlog (revisit for improvement)

### Database growth & retention (important — Railway free tier targets < 1 GB)

**How growth actually works:** both workers dedupe by `external_id`, so re-polling
the same alert every 5 min inserts NOTHING. New rows appear only for genuinely new
alerts/articles. Measured NWS row ≈ 800 B text (~1–1.5 KB with indexes).

**Rough projection (~1.5 KB/row incl. indexes):**
| Scenario | New rows/day | Growth |
|---|---|---|
| Quiet (mostly NWS) | ~150 | ~0.2 MB/day |
| Typical (13 RSS feeds active) | ~700 | ~1 MB/day |
| Heavy (busy news + weather) | ~1,500 | ~2.2 MB/day |

The live `events` table self-bounds to ~30 days (30–70 MB steady state) — **not** the
concern. The concerns below are:

- **⚠️ `event_archive` grows UNBOUNDED — the real free-tier risk.** `run_archive_worker`
  COPIES events > 30 days into `event_archive`, then deletes from `events`. Total DB size
  therefore grows forever. Reaches 1 GB in ~2–3 yrs (typical) or ~7–15 months (heavy RSS /
  full-content feeds). **Fix:** add a hard-delete retention on `event_archive` (e.g. purge
  after 90–180 days), or don't archive low-value Digest rows at all.
- **RSS persists EVERY article as a Digest event**, keyword match or not — the dominant
  volume driver, and most of it is irrelevant general news. **Fix:** don't persist unmatched
  Digest RSS, or purge it far faster than 30 days.
- **`Event.summary` is untruncated TEXT.** NWS descriptions and some full-content RSS feeds
  run multiple KB each — the per-row size driver. **Fix:** cap summary length on insert.
- **No DB-size monitoring / alarm.** Nothing warns as the archive approaches the free-tier
  cap. Consider a periodic size check or a Railway usage alert.
- Action items above are improvements, not blockers — a 2-user pilot has months of runway.

### NWS worker accuracy
- `parse_nws_alert` leaves `county_name` / `state_code` NULL — never populated from
  the matched `TeamCounty`. Push titles and templates need the name.
- Multi-zone alerts: parser takes the *first* SAME code, so `county_fips` may fall
  outside the team's coverage area. Should match against the team's counties.

### Feature gaps vs PRD
- **Push not wired to Active events** — `notify_team_active_event` exists but is never
  called. Wire it into the escalate endpoint / NWS worker (Phase B of API build).
- **No FEMA IPAWS worker** (PRD §5) — only a `classify_fema_event` stub.
- **No daily digest worker** (PRD §6.3) — `send_digest_notification` exists, never scheduled.
- **No storm auto-promotion** (PRD §4.1) — a Watch then a Warning become two separate
  events; the original event's tier is never upgraded (dedup is by external_id).
- **No CSV/PDF incident export** (PRD §6.5).
- **No onboarding / Census TIGER county loading** (PRD §3.2, §6.6) — `seed.py`
  hardcodes the 24 pilot counties.
- **No manual event entry** endpoint (PRD §5).
- **RSS worker unverified** against the real seeded feeds.

### Security & deploy hardening
- **`SECRET_KEY` is a hardcoded dev value** (`dev-secret-key-change-in-production`) in
  `docker-compose.yml`. Must be overridden with a real secret in Railway — it signs JWTs.
- `app/core/database.py` sets `echo=True` in development, logging every SQL statement.
  Noisy and a slight perf cost; fine for dev, ensure `ENVIRONMENT=production` on deploy.
- API auth is stateless JWT (8h expiry, no refresh token, no server-side logout/revocation).
  Acceptable for the pilot; revisit if longer sessions or forced logout are needed.

### Observability
- **App-level `logger.info(...)` output is invisible under uvicorn.** The workers and
  push module log useful signals ("NWS worker: N new events", "Push notifications sent: N"),
  but uvicorn's default logging leaves the root logger at WARNING, so these never appear
  in `docker compose logs` / Railway logs. Add a `logging.basicConfig`/dictConfig at app
  startup (or a `--log-config`) so worker and notification INFO logs are captured.

### Config / correctness
- `app/templates/renderer.py` uses `%-d` / `%-I` strftime codes — Linux-only. Fine in
  Docker/Railway, breaks if run natively on Windows.
- CORS production origin in `app/main.py` is the placeholder
  `https://your-railway-domain.up.railway.app` — set the real domain before deploy.
- **Digest time discrepancy:** PRD §6.3 says default 7:00 AM; code uses `09:00`
  everywhere (PRD Open Question #1, unresolved).
- **Monitor auto-expiry** (48h demote to Digest) is implemented, though PRD Open
  Question #4 lists it as still open — confirm this is the intended behavior.

### Not built yet (the roadmap)
- **Push subscription loop + PWA** — `/api/push/{vapid-key,subscribe,unsubscribe}`
  endpoints and a service worker / manifest. Without this, Active-tier pushes are
  generated but reach no device. The biggest remaining gap.
- **Frontend config/digest/export screens** — APIs exist; only the dashboard feed +
  review/escalate/render UI is built so far.
- Scheduled digest *delivery* worker (daily push at the configured time).
