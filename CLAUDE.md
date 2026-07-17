# CLAUDE.md — Sentinel

Guidance and running context for working in this repo. See `README.md` for the
end-user setup guide, `Sentinel_PRD_v0.1.docx` for the backend/product spec, and
`Sentinel_Frontend_PRD_v0.1.docx` for the full frontend/UI spec.

## What this is

Disaster-management intelligence dashboard: a FastAPI backend that polls public
alert sources (NWS, RSS, later FEMA), classifies events into three tiers
(Active / Monitor / Digest), stores them in PostgreSQL, and (eventually) pushes
notifications to a PWA frontend. Multi-tenant by `Team`. Deploys to Railway.

**Current state:** ingestion backend + REST API (Phases A–C) are built and
running. A **complete demo frontend** (Vite + React PWA) has now been built
against mock data, intended to run standalone in Replit for stakeholder demos
before being wired to the live Railway backend. Remaining on the backend: PWA
push subscription loop. Remaining on the frontend: wiring to live API (currently
mock-only), real push subscription registration.

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

## Running the frontend (Replit — demo path, mock data)

The frontend is designed to run standalone in Replit against mock JSON files,
with a single environment variable flip to switch to the live Railway backend
later. No backend or Docker required for the demo.

1. Create a Replit repl using the **Vite + React** template.
2. Replace the default `src/`, `public/`, `index.html`, `package.json`, and
   `vite.config.js` with the contents of `frontend/` from this repo.
3. In Replit **Secrets**, set:
   ```
   VITE_USE_MOCKS=true
   VITE_API_URL=http://localhost:8000
   ```
4. `npm install`, then Run.

To point the same frontend at the live Railway backend later, flip
`VITE_USE_MOCKS=false` and set `VITE_API_URL` to the Railway domain — no code
changes required (see `src/lib/api.js`).

Local (non-Replit) dev: `cd frontend && npm install && npm run dev` (→ :5173).

## Component status (active vs dormant)

**Backend**
- **Active:** FastAPI app + `/health`, REST API routers (`app/api/*` — auth, events,
  config, templates, export, digest), APScheduler (NWS 5min, RSS 15min, expiry 1h,
  archive 2am), NWS worker (fixed — see below), classifier, expiry/archive workers,
  `renderer.py` (via template render endpoint), `push.py` (via escalate/manual-Active).
- **Dormant / not built:** push *subscription* endpoints (`/api/push/*` — no way for a
  device to register yet, so notifications never reach a phone), FEMA worker, scheduled
  digest *delivery* worker (the `/api/digest` view exists; the push-on-schedule job does not).

**Frontend**
- **Active (fully built, mock-data-driven):** login + persistent session (localStorage
  JWT, never expires client-side until manual logout), top nav (desktop) / bottom tab
  bar (mobile), Dashboard (Active Events banner with 5-item cap + "view all" modal,
  collapsible 24h Digest Summary grouped by center, responsive Center Cards grid —
  3/2/1 columns), Center Detail slide-in with tier filter, Event Detail slide-in with
  Escalate / De-escalate / Copy Message actions, Template Picker modal (pick → preview
  rendered text → copy to clipboard), Events screen (search + tier/center filters +
  pagination), Centers screen (list + create/edit two-step modal: name → multi-select
  counties grouped by state, delete with inline confirm), Templates screen (list +
  create/edit modal with clickable variable-insertion panel + live preview), Settings
  screen (digest time/timezone form, PWA install instructions for iOS/Android, native
  `Notification.requestPermission()` button, logout).
- **Dormant / not built:** actual push subscription registration (Settings screen has
  the permission-request button wired to the browser API, but does not yet POST to
  `/api/push/subscribe` because that endpoint doesn't exist server-side), service worker
  (`sw.js` — manifest.json exists, service worker file does not yet), Census TIGER full
  county selector (Centers screen only offers the 24 seeded pilot counties), member vs
  admin role enforcement (all demo users see full admin UI regardless of backend role).

## API surface (Phases A–C, all team-scoped + JWT-gated)

```
auth:      POST /api/auth/login   GET /api/auth/me
events:    GET /api/events   POST /api/events (manual)   GET /api/events/{id}
           PATCH /api/events/{id}/review   POST /api/events/{id}/escalate (push on Active)
templates: GET /api/templates   GET /api/templates/variables   POST /api/templates/{id}/render
config:    GET counties|keywords|rss-sources   +  POST/PATCH/DELETE (admin-only)
reports:   GET /api/digest   GET /api/export/incidents.csv
```

**Not yet built, needed for frontend to go fully live:**
```
push:      POST /api/push/subscribe   DELETE /api/push/subscribe   GET /api/push/vapid-key
centers:   No backend equivalent — centers are intentionally client-side only (see below)
```

## Frontend architecture (`frontend/`)

Vite + React (JavaScript, not TypeScript), plain CSS with a custom-property design
system (no Tailwind/component library), plain `fetch` via a single API client — no
axios, no react-query, no router library (hash-based routing in `App.jsx`).

### File structure
```
frontend/
  index.html                    # PWA meta tags, manifest link
  vite.config.js
  package.json
  public/
    manifest.json                # PWA manifest (icons referenced but not yet generated)
    mocks/                        # mock JSON — see below
  src/
    main.jsx                     # entry point
    App.jsx                      # hash router + AuthProvider wiring
    index.css                    # full design system (CSS custom properties)
    lib/
      api.js                     # THE central API client — mock/live switch lives here
      AuthContext.jsx             # React context for auth state
      utils.js                   # timeAgo, formatTime, tierPriority, copyToClipboard, etc.
    components/
      layout/AppShell.jsx+css     # top nav (desktop) + bottom tab bar (mobile)
      shared/TierBadge.jsx        # reusable Active/Monitor/Digest badge
      events/EventCard.jsx+css    # event list item (used in dashboard, events page, centers)
      events/EventDetail.jsx+css  # slide-in panel: full detail + action bar
      events/TemplatePicker.jsx+css # modal: pick template → render → copy
      dashboard/ActiveBanner.jsx+css   # top-of-dashboard active events strip
      dashboard/DigestSummary.jsx+css  # collapsible 24h breakdown by center
      dashboard/CenterCard.jsx+css     # center grid card + its own detail modal
    pages/
      LoginPage.jsx+css
      DashboardPage.jsx+css
      EventsPage.jsx+css
      CentersPage.jsx+css          # includes CenterModal (create/edit) + CountyRow
      TemplatesPage.jsx+css        # includes TemplateModal (create/edit) + variable panel
      SettingsPage.jsx+css
```

### The mock/live switch — `src/lib/api.js`
Every data operation in the app goes through this one file. Each exported function
checks `import.meta.env.VITE_USE_MOCKS`:
- `true` → reads static JSON from `public/mocks/*.json` (or, for centers/templates
  create/update/delete, mutates `localStorage` / returns constructed objects)
- `false` → calls the real FastAPI backend at `VITE_API_URL` with the stored JWT as
  a Bearer token

**Rule for future work:** never write a raw `fetch()` call anywhere else in the
codebase. Add a new function to `api.js` instead, so the mock/live switch stays
total. This was an explicit build instruction and all current screens follow it.

### Centers are intentionally client-side only
There is no `centers` table in the backend schema and no `/api/centers` endpoint.
This was a deliberate product decision (see PRD §9): centers are a personal,
zero-cost-to-create grouping of counties for one user's dashboard view, stored in
`localStorage` under the key `sentinel_centers`. Creating, editing, or deleting a
center never touches the shared database or affects any other user's view. If/when
the team-based model is built (per CLAUDE.md history: "NE and MW would still not
see each other's data"), this will need a real backend table scoped by user or by
a new `super_admin`-managed team layer — that is future work, not yet started.

### Mock data (`public/mocks/`)
Six JSON files seeded with a coherent demo scenario across all 8 pre-loaded centers:
- `auth_me.json` — the logged-in user (Anis Punjwani, admin)
- `events.json` — 10 events: 2 Active (Tornado Warning/CT, Power Outage/Richmond),
  3 Monitor (Tropical Storm Watch/Nassau, Protest/DC, Road Closure/Philadelphia),
  5 Digest (various weather statements/advisories)
- `digest.json` — pre-computed 24h breakdown by center, matches `events.json`
- `centers.json` — the 8 pre-loaded demo centers (NYC, Richmond, DC Metro, Boston,
  Nassau/Long Island, Albany, Connecticut, Philadelphia) with their county lists;
  this is what seeds `localStorage` on first load via `initCenters()`
- `templates.json` — the same 3 default templates as the backend `seed.py`
- `counties.json` — the 24 pilot counties, used by the Centers screen's county
  selector

If mock data needs to change (e.g. to demo a different scenario), edit these files
directly — no code changes needed, `api.js` reads them as-is.

### Visual design system
Defined entirely as CSS custom properties in `src/index.css`. Rationale: this is
an operations tool used under stress — calm, authoritative, high-contrast tier
signaling rather than a generic consumer SaaS look.
- Shell color: near-black navy (`--navy: #0F1923`) for top nav / bottom tab bar /
  login background. Card surfaces are white on a light neutral page background.
- Tier colors carry all the emotional signaling: red (`--active-*`), amber
  (`--monitor-*`), grey (`--digest-*`) — used consistently across badges, card
  left-borders, dots, and banners.
- Signature interaction: `.pulse-dot` / `.center-dot-active` — a CSS keyframe
  pulse animation on Active-tier indicators (dashboard banner dot, center card
  status dot, event detail badge dot) so the UI visibly "feels alive" when there's
  something happening and is still when clear.
- System font stack only — no webfont load, keeps the PWA fast.
- Responsive breakpoints: mobile <768px (single column, bottom tab bar, slide-ins
  become bottom sheets), tablet 768–1023px (2-col center grid), desktop ≥1024px
  (3-col grid, slide-ins from the right, top nav).

### Key UX decisions baked into the build (from the PRD Q&A)
- Session persists indefinitely client-side (JWT in `localStorage`, no expiry
  check, no refresh flow) — required so the PWA opens straight to the dashboard
  after being added to the home screen, matching iOS/Android PWA conventions.
- Active Events banner caps at 5 inline items + "View all N" modal rather than a
  potentially long flat list — chosen because a real multi-jurisdiction weather
  event could produce 10–15 simultaneous Active events.
- 24h Digest Summary is collapsed by default, grouped by center, omits centers
  with zero events in the window.
- A county can belong to multiple centers simultaneously (no exclusivity
  constraint) — reflected in `CentersPage.jsx`'s county selector, which does not
  filter out counties already used by another center.
- Dismissing an event de-tiers it to Digest (does not delete or hide it) — this
  was flagged as "revisit in another iteration," not a final design.
- Template picker is a deliberate two-step flow (pick template → see rendered
  preview → copy) rather than a single default-template copy button, so the user
  always chooses intentionally.
- All county/FIPS/NWS-zone-level detail is hidden from every user-facing screen;
  only the human-assigned center name is ever shown. County names appear only
  inside the Center Detail modal's collapsed "Counties in this center" section
  and in the Event Detail subtitle line (for precise location context on an
  individual alert).

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

- **✅ RESOLVED — `event_archive` unbounded growth.** `run_archive_worker` now hard-deletes
  archive rows older than `ARCHIVE_RETENTION_DAYS` (default 180) after the copy+delete step,
  so total DB size self-bounds instead of growing forever. Tune or disable via the env var
  (`0` = keep forever). This was the real free-tier risk.
- **✅ RESOLVED — RSS no longer persists every article.** The RSS worker now skips
  keyword-unmatched (Digest-tier) news unless `STORE_UNMATCHED_RSS=true`. This removes the
  dominant row-count driver; only keyword-matched (Monitor) news and all NWS events are stored.
- **✅ RESOLVED — untruncated summaries.** Both workers truncate `summary` to
  `MAX_SUMMARY_LENGTH` (default 2000 chars) on insert, bounding per-row size.
- **Still open — No DB-size monitoring / alarm.** Nothing warns as the DB approaches the
  free-tier cap. With retention + RSS-skip in place this is far less urgent, but a periodic
  size check or a Railway usage alert is still worth adding.
- Net effect: the live `events` table self-bounds to ~30 days AND `event_archive` self-bounds
  to `ARCHIVE_RETENTION_DAYS`, so total DB size now has a hard ceiling instead of growing
  forever. All three thresholds are env-tunable (see README Railway env-var table).

### NWS worker accuracy
- `parse_nws_alert` leaves `county_name` / `state_code` NULL — never populated from
  the matched `TeamCounty`. Push titles and templates need the name.
  **Frontend impact:** the frontend's `EventDetail` and `EventCard` components
  already expect `county_name`/`state_code`/`center_name` on every event object
  (see mock data shape in `events.json`) — once this backend gap is fixed, no
  frontend changes should be needed, just confirm the live API response shape
  matches the mock shape exactly before flipping `VITE_USE_MOCKS=false`.
- Multi-zone alerts: parser takes the *first* SAME code, so `county_fips` may fall
  outside the team's coverage area. Should match against the team's counties.

### Feature gaps vs PRD
- **Push not wired to Active events** — `notify_team_active_event` exists but is never
  called. Wire it into the escalate endpoint / NWS worker (Phase B of API build).
- **No push subscription endpoints** (`/api/push/subscribe`, `/api/push/vapid-key`,
  `/api/push/unsubscribe`) — blocks the frontend's Settings screen from completing
  its notification flow. The browser-permission half is built; the server-registration
  half is not.
- **No service worker file** (`public/sw.js`) — needed to actually *receive* and
  display push notifications once subscriptions exist. `manifest.json` is in place;
  `sw.js` is not yet written.
- **No FEMA IPAWS worker** (PRD §5) — only a `classify_fema_event` stub.
- **No daily digest worker** (PRD §6.3) — `send_digest_notification` exists, never scheduled.
- **No storm auto-promotion** (PRD §4.1) — a Watch then a Warning become two separate
  events; the original event's tier is never upgraded (dedup is by external_id).
- **No CSV/PDF incident export** (PRD §6.5) — no frontend screen for this yet either.
- **No onboarding / Census TIGER county loading** (PRD §3.2, §6.6) — `seed.py`
  hardcodes the 24 pilot counties, and the frontend Centers screen's county picker
  is scoped to just those 24 (`mocks/counties.json` / `GET /api/config/counties`
  would need the full ~3,200-county dataset for this to be genuinely self-serve).
- **No manual event entry** endpoint (PRD §5) or frontend form for it.
- **RSS worker unverified** against the real seeded feeds.
- **No backend `centers` concept at all** — by design, see "Centers are
  intentionally client-side only" above. If a team-based sharing model is wanted
  later, this needs real schema + endpoints, not just a frontend change.
- **No member-vs-admin UI distinction** — PRD frontend doc explicitly scoped this
  out for the demo; all logged-in users currently get full admin capability in
  the UI regardless of their backend `role` value.

### Security & deploy hardening
- **`SECRET_KEY` is a hardcoded dev value** (`dev-secret-key-change-in-production`) in
  `docker-compose.yml`. Must be overridden with a real secret in Railway — it signs JWTs.
- `app/core/database.py` sets `echo=True` in development, logging every SQL statement.
  Noisy and a slight perf cost; fine for dev, ensure `ENVIRONMENT=production` on deploy.
- API auth is stateless JWT (8h expiry server-side, but the frontend never checks
  or refreshes it — a token that expires server-side will simply start failing
  requests until the user manually logs out and back in). No refresh token, no
  server-side logout/revocation. Acceptable for the pilot; revisit if longer
  sessions or forced logout are needed.
- **✅ RESOLVED — CORS is now config-driven.** `app/main.py` reads allowed origins from
  the `CORS_ORIGINS` env var (comma-separated) in production, and allows all origins in
  development. Set `CORS_ORIGINS` to the real frontend domain(s) in Railway before the
  Replit-hosted or any other frontend can call the live API cross-origin. No code change
  needed per environment.

### Observability
- **App-level `logger.info(...)` output is invisible under uvicorn.** The workers and
  push module log useful signals ("NWS worker: N new events", "Push notifications sent: N"),
  but uvicorn's default logging leaves the root logger at WARNING, so these never appear
  in `docker compose logs` / Railway logs. Add a `logging.basicConfig`/dictConfig at app
  startup (or a `--log-config`) so worker and notification INFO logs are captured.

### Config / correctness
- `app/templates/renderer.py` uses `%-d` / `%-I` strftime codes — Linux-only. Fine in
  Docker/Railway, breaks if run natively on Windows. (The frontend's own mock-mode
  template renderer in `api.js` uses `toLocaleString` instead and is platform-safe —
  worth aligning the backend renderer to a similarly portable approach.)
- CORS is now driven by the `CORS_ORIGINS` env var (see Security & deploy hardening above);
  set it to the real frontend domain in Railway before deploy.
- **Digest time discrepancy:** PRD §6.3 originally said default 7:00 AM; code and
  frontend (`SettingsPage.jsx` default, `digest.json` mock) both use `09:00` — this
  was resolved during the frontend PRD Q&A (Open Question #1): 9 AM is correct,
  configurable per user. The original 7 AM mention in the backend PRD doc is now stale.
- **Monitor auto-expiry** (48h demote to Digest) is implemented and was confirmed
  as intended during the frontend PRD Q&A (Open Question #4 resolved: 48h, or
  immediately if the underlying alert is no longer active).

### Not built yet (the roadmap)
- **Push subscription loop + service worker** — `/api/push/{vapid-key,subscribe,
  unsubscribe}` endpoints and `public/sw.js`. The frontend Settings screen already
  has the UI and the browser permission request wired up and waiting for these.
  This is the single biggest remaining gap to take the demo from "looks real" to
  "is real."
- **Wire frontend to live Railway backend** — flip `VITE_USE_MOCKS=false`, confirm
  every API response shape matches what the mock JSON files currently model
  (especially `county_name`/`state_code`/`center_name` on events — see NWS worker
  note above), and confirm CORS is set correctly for wherever the frontend ends
  up hosted (Replit during demo, Railway static site or elsewhere for real use).
- **PWA icons** — `manifest.json` references `/icons/icon-192.png` and
  `/icons/icon-512.png`; actual icon image files have not been generated/added yet.
- Scheduled digest *delivery* worker (daily push at the configured time).
- CSV/PDF incident export screen (backend endpoint exists: `GET /api/export/incidents.csv`;
  no frontend UI consumes it yet).
- Full Census TIGER county dataset + onboarding flow (PRD §3.2/§6.6), and a real
  backend-side `centers` concept if/when team-shared centers are wanted.

---

## Session log — Frontend build (this session)

For traceability, this session's work in order:

1. **Frontend PRD** (`Sentinel_Frontend_PRD_v0.1.docx`) — written after a full
   clarifying-question pass covering auth/session, dashboard layout, centers
   (grouping model, personal vs shared, pre-loaded demo set), event detail and
   actions, template picker flow, responsive/mobile requirements, and demo scope.
   Confirmed decisions are documented inline in that file's sections 3–11.
2. **Mock data + API client** — six JSON files under `frontend/public/mocks/`
   and the single `frontend/src/lib/api.js` client with the mock/live switch.
3. **Full React frontend scaffold** — every screen, component, and CSS file
   listed in "Frontend architecture" above, built to match the Frontend PRD
   exactly, using the design system described in that section.
4. **This CLAUDE.md update** — folding all of the above into the running
   context doc for handoff to another machine/session.

Everything above is built and was packaged as a zip for local extraction into a
Replit "Vite + React" template repl, per the "Running the frontend" instructions
above.