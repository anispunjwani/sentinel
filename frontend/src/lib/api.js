/**
 * api.js — Sentinel mock API client
 *
 * Set VITE_USE_MOCKS=true in Replit environment secrets to use local JSON files.
 * Set VITE_API_URL to your Railway backend URL when ready to go live.
 *
 * All functions return the same shape whether using mocks or the real API,
 * so switching is a one-line environment variable change.
 */

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const MOCK_BASE = "/mocks";

// ── Auth token helpers ───────────────────────────────────────────────────────

export function getToken() {
  return localStorage.getItem("sentinel_token");
}

export function setToken(token) {
  localStorage.setItem("sentinel_token", token);
}

export function clearToken() {
  localStorage.removeItem("sentinel_token");
  localStorage.removeItem("sentinel_user");
}

export function getStoredUser() {
  const raw = localStorage.getItem("sentinel_user");
  return raw ? JSON.parse(raw) : null;
}

export function storeUser(user) {
  localStorage.setItem("sentinel_user", JSON.stringify(user));
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatError(err.detail) || "Request failed");
  }
  // 204 No Content (e.g. DELETE) has an empty body — don't try to parse it.
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// FastAPI returns `detail` as a string (HTTPException) or an array of
// validation-error objects (422). Coerce both into a readable message so the
// UI never shows "[object Object]".
function formatError(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  }
  return JSON.stringify(detail);
}

async function mockFetch(filename) {
  const res = await fetch(`${MOCK_BASE}/${filename}`);
  if (!res.ok) throw new Error(`Mock not found: ${filename}`);
  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(email, password) {
  if (USE_MOCKS) {
    // Accept any credentials in mock mode
    const user = await mockFetch("auth_me.json");
    const fakeToken = "mock-jwt-token-sentinel-demo";
    setToken(fakeToken);
    storeUser(user);
    return { access_token: fakeToken, user };
  }
  // The backend login uses OAuth2PasswordRequestForm, which expects a
  // form-encoded body with `username`/`password` — not JSON.
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(formatError(err.detail) || "Login failed");
  }
  const data = await res.json();
  setToken(data.access_token);
  const user = await getMe();
  storeUser(user);
  // Return the user alongside the token so callers (LoginPage) can set auth
  // state — matching the mock login's shape.
  return { ...data, user };
}

export async function getMe() {
  if (USE_MOCKS) return mockFetch("auth_me.json");
  return apiFetch("/api/auth/me");
}

// ── Center enrichment (live mode) ────────────────────────────────────────────
// The backend has no concept of centers (they are a client-side, per-user grouping
// of counties — see CLAUDE.md). Real events carry only county_fips, so we derive
// each event's center_name here by matching its county against the saved centers.

function centerNameForFips(fips, centers) {
  if (!fips) return null;
  for (const c of centers) {
    if ((c.counties || []).some(co => co.fips === fips)) return c.name;
  }
  return null;
}

async function enrichEventsWithCenter(events) {
  const centers = await initCenters(); // idempotent; seeds from mock centers.json
  return events.map(e => ({
    ...e,
    center_name: e.center_name || centerNameForFips(e.county_fips, centers),
  }));
}

// ── Events ───────────────────────────────────────────────────────────────────

export async function getEvents(filters = {}) {
  if (USE_MOCKS) {
    const data = await mockFetch("events.json");
    let events = data.events;
    if (filters.tier) events = events.filter(e => e.tier === filters.tier);
    if (filters.center_name) events = events.filter(e => e.center_name === filters.center_name);
    if (filters.county_fips_list) {
      events = events.filter(e => filters.county_fips_list.includes(e.county_fips));
    }
    return { ...data, events, total: events.length };
  }
  // Backend supports these query params; center_name/county_fips_list are handled
  // client-side (they are not backend concepts).
  const params = new URLSearchParams();
  for (const key of ["tier", "county_fips", "source", "reviewed", "limit", "offset"]) {
    if (filters[key] !== undefined) params.set(key, filters[key]);
  }
  const q = params.toString();
  // The backend returns a bare array; the UI expects { events, total }.
  const events = await enrichEventsWithCenter(await apiFetch(`/api/events${q ? `?${q}` : ""}`));
  return { events, total: events.length };
}

export async function getEvent(id) {
  if (USE_MOCKS) {
    const data = await mockFetch("events.json");
    const event = data.events.find(e => e.id === id);
    if (!event) throw new Error("Event not found");
    return event;
  }
  const [event] = await enrichEventsWithCenter([await apiFetch(`/api/events/${id}`)]);
  return event;
}

export async function escalateEvent(id) {
  if (USE_MOCKS) {
    // Return a mock updated event
    const event = await getEvent(id);
    return { ...event, tier: "active", reviewed: true, reviewed_by: "Anis Punjwani" };
  }
  // The UI's "Escalate to Active" action; backend requires the target tier and
  // that it be more severe than the current one (always true from Monitor/Digest).
  return apiFetch(`/api/events/${id}/escalate`, {
    method: "POST",
    body: JSON.stringify({ tier: "active" }),
  });
}

export async function deescalateEvent(id) {
  if (USE_MOCKS) {
    const event = await getEvent(id);
    return { ...event, tier: "digest", reviewed: true };
  }
  return apiFetch(`/api/events/${id}/deescalate`, { method: "POST" });
}

// ── Digest ───────────────────────────────────────────────────────────────────

export async function getDigest() {
  if (USE_MOCKS) return mockFetch("digest.json");
  // The backend /api/digest returns only Digest-tier events grouped by county.
  // The UI wants all tiers from the last 24h grouped by CENTER, so compute it
  // client-side from the enriched event list (centers are client-side only).
  const events = await enrichEventsWithCenter(await apiFetch("/api/events"));
  const since = Date.now() - 24 * 60 * 60 * 1000;
  const recent = events.filter(e => new Date(e.created_at).getTime() >= since);

  const byCenter = {};
  for (const e of recent) {
    const name = e.center_name || e.county_name || e.state_code || "Other";
    const bucket = (byCenter[name] ||= {});
    const key = `${e.event_type}|${e.tier}`;
    bucket[key] = (bucket[key] || 0) + 1;
  }

  const by_center = Object.entries(byCenter).map(([center_name, counts]) => {
    const breakdown = Object.entries(counts).map(([k, count]) => {
      const [event_type, tier] = k.split("|");
      return { event_type, tier, count };
    });
    return { center_name, total: breakdown.reduce((s, b) => s + b.count, 0), breakdown };
  });

  return {
    total_events: recent.length,
    generated_at: new Date().toISOString(),
    by_center,
  };
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates() {
  if (USE_MOCKS) return mockFetch("templates.json");
  // Backend returns a bare array; consumers expect { templates: [...] }.
  const templates = await apiFetch("/api/templates");
  return { templates };
}

export async function createTemplate(data) {
  if (USE_MOCKS) {
    return {
      id: `tmpl-${Date.now()}`,
      team_id: "61a4646e-8e47-4fda-9a57-7aa7908430ee",
      ...data,
      created_at: new Date().toISOString(),
    };
  }
  return apiFetch("/api/templates", { method: "POST", body: JSON.stringify(data) });
}

export async function updateTemplate(id, data) {
  if (USE_MOCKS) return { id, ...data };
  return apiFetch(`/api/templates/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export async function deleteTemplate(id) {
  if (USE_MOCKS) return { deleted: true };
  return apiFetch(`/api/templates/${id}`, { method: "DELETE" });
}

export async function renderTemplate(templateId, eventId) {
  if (USE_MOCKS) {
    const { templates } = await mockFetch("templates.json");
    const template = templates.find(t => t.id === templateId);
    const event = await getEvent(eventId);
    if (!template || !event) throw new Error("Template or event not found");

    const now = new Date(event.issued_at);
    const timeStr = now.toLocaleString("en-US", {
      month: "long", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
      timeZone: "America/New_York"
    });

    const rendered = template.body
      .replace(/{{event_type}}/g, event.event_type)
      .replace(/{{county}}/g, `${event.county_name}, ${event.state_code}`)
      .replace(/{{severity}}/g, event.tier.toUpperCase())
      .replace(/{{time}}/g, timeStr)
      .replace(/{{summary}}/g, event.summary || "")
      .replace(/{{source}}/g, event.source.toUpperCase())
      .replace(/{{source_link}}/g, event.source_url || "")
      .replace(/{{team_name}}/g, "Northeastern US Disaster Management");

    return { rendered };
  }
  return apiFetch(`/api/templates/${templateId}/render`, {
    method: "POST",
    body: JSON.stringify({ event_id: eventId }),
  });
}

// ── Counties ─────────────────────────────────────────────────────────────────

export async function getCounties() {
  if (USE_MOCKS) return mockFetch("counties.json");
  // Backend returns a bare array of {fips_code, county_name, state_code}; the
  // Centers UI expects { counties: [{fips, name, state, state_name}] }.
  const rows = await apiFetch("/api/config/counties");
  const counties = rows.map(c => ({
    fips: c.fips_code,
    name: c.county_name,
    state: c.state_code,
    state_name: c.state_code, // backend has no full state name; code is searchable
  }));
  return { counties };
}

// ── Centers (always localStorage — no backend endpoint) ──────────────────────

const CENTERS_KEY = "sentinel_centers";

export function getCenters() {
  const raw = localStorage.getItem(CENTERS_KEY);
  if (raw) return JSON.parse(raw);
  // First load: seed the demo centers from the mock file
  return null; // caller handles seeding
}

export function saveCenters(centers) {
  localStorage.setItem(CENTERS_KEY, JSON.stringify(centers));
}

export async function initCenters() {
  const existing = getCenters();
  if (existing) return existing;
  // Seed from mock file on first load
  const data = await mockFetch("centers.json");
  saveCenters(data.centers);
  return data.centers;
}

export function createCenter(center) {
  const centers = getCenters() || [];
  const newCenter = {
    id: `center-${Date.now()}`,
    user_id: getStoredUser()?.id || "local",
    created_at: new Date().toISOString(),
    ...center,
  };
  const updated = [...centers, newCenter];
  saveCenters(updated);
  return newCenter;
}

export function updateCenter(id, updates) {
  const centers = getCenters() || [];
  const updated = centers.map(c => c.id === id ? { ...c, ...updates } : c);
  saveCenters(updated);
  return updated.find(c => c.id === id);
}

export function deleteCenter(id) {
  const centers = getCenters() || [];
  saveCenters(centers.filter(c => c.id !== id));
}
