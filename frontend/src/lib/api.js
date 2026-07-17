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
  return res.json();
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
  return data;
}

export async function getMe() {
  if (USE_MOCKS) return mockFetch("auth_me.json");
  return apiFetch("/api/auth/me");
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
  const params = new URLSearchParams(filters).toString();
  return apiFetch(`/api/events${params ? `?${params}` : ""}`);
}

export async function getEvent(id) {
  if (USE_MOCKS) {
    const data = await mockFetch("events.json");
    const event = data.events.find(e => e.id === id);
    if (!event) throw new Error("Event not found");
    return event;
  }
  return apiFetch(`/api/events/${id}`);
}

export async function escalateEvent(id) {
  if (USE_MOCKS) {
    // Return a mock updated event
    const event = await getEvent(id);
    return { ...event, tier: "active", reviewed: true, reviewed_by: "Anis Punjwani" };
  }
  return apiFetch(`/api/events/${id}/escalate`, { method: "POST" });
}

export async function deescalateEvent(id) {
  if (USE_MOCKS) {
    const event = await getEvent(id);
    return { ...event, tier: "digest", reviewed: true };
  }
  return apiFetch(`/api/events/${id}/review`, {
    method: "PATCH",
    body: JSON.stringify({ tier: "digest" }),
  });
}

// ── Digest ───────────────────────────────────────────────────────────────────

export async function getDigest() {
  if (USE_MOCKS) return mockFetch("digest.json");
  return apiFetch("/api/digest");
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function getTemplates() {
  if (USE_MOCKS) return mockFetch("templates.json");
  return apiFetch("/api/templates");
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
  return apiFetch("/api/config/counties");
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
