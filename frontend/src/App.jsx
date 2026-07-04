import { useState, useEffect } from 'react'
import { getMe, getToken, clearToken } from './api.js'
import Login from './components/Login.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // On load, if we already have a token, try to resume the session.
  useEffect(() => {
    if (!getToken()) { setLoading(false); return }
    getMe().then(setUser).catch(() => clearToken()).finally(() => setLoading(false))
  }, [])

  function logout() {
    clearToken()
    setUser(null)
  }

  if (loading) return <div className="center muted">Loading…</div>
  if (!user) return <Login onLogin={setUser} />
  return <Dashboard user={user} onLogout={logout} />
}
