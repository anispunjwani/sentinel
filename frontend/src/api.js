// Tiny API client: stores the JWT in localStorage and attaches it to requests.
const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const getToken = () => localStorage.getItem('token')
export const setToken = (t) => localStorage.setItem('token', t)
export const clearToken = () => localStorage.removeItem('token')

// Generic JSON request with auth header + error handling.
async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, { ...options, headers })

  if (res.status === 401) {
    clearToken()
    throw new Error('Session expired — please sign in again.')
  }
  if (!res.ok) {
    let detail = res.statusText
    try { detail = (await res.json()).detail || detail } catch { /* ignore */ }
    throw new Error(detail)
  }
  return res.status === 204 ? null : res.json()
}

// Login uses form-encoding (OAuth2 password flow), not JSON.
export async function login(email, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: email, password }),
  })
  if (!res.ok) throw new Error('Incorrect email or password')
  setToken((await res.json()).access_token)
}

const jsonBody = (data) => ({
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
})

export const getMe = () => request('/api/auth/me')
export const listEvents = () => request('/api/events?limit=200')
export const reviewEvent = (id) => request(`/api/events/${id}/review`, { method: 'PATCH' })
export const escalateEvent = (id, tier) =>
  request(`/api/events/${id}/escalate`, { method: 'POST', ...jsonBody({ tier }) })
export const listTemplates = () => request('/api/templates')
export const renderTemplate = (templateId, eventId) =>
  request(`/api/templates/${templateId}/render`, { method: 'POST', ...jsonBody({ event_id: eventId }) })
