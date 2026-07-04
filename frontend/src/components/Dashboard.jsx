import { useState, useEffect, useCallback } from 'react'
import { listEvents, listTemplates } from '../api.js'
import EventCard from './EventCard.jsx'

// Rendered top-to-bottom: Active first, then Monitor, then Digest (PRD §6.1).
const TIERS = [
  { key: 'active', label: 'Active' },
  { key: 'monitor', label: 'Monitor' },
  { key: 'digest', label: 'Digest' },
]

export default function Dashboard({ user, onLogout }) {
  const [events, setEvents] = useState([])
  const [templates, setTemplates] = useState([])
  const [updated, setUpdated] = useState(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [ev, tpl] = await Promise.all([listEvents(), listTemplates()])
      setEvents(ev)
      setTemplates(tpl)
      setUpdated(new Date())
      setError('')
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  return (
    <div className="app">
      <header className="topbar">
        <strong>Sentinel</strong>
        <div className="topbar-right muted">
          {updated && <span>Updated {updated.toLocaleTimeString()}</span>}
          <button className="ghost" onClick={refresh}>Refresh</button>
          <button className="ghost" onClick={onLogout}>Sign out ({user.name})</button>
        </div>
      </header>

      {error && <div className="error banner">{error}</div>}

      <main>
        {TIERS.map((t) => {
          const items = events.filter((e) => e.tier === t.key)
          return (
            <section key={t.key} className={`tier tier-${t.key}`}>
              <h2>{t.label} <span className="count">{items.length}</span></h2>
              {items.length === 0
                ? <p className="muted empty">No {t.label.toLowerCase()} events.</p>
                : items.map((ev) => (
                    <EventCard key={ev.id} event={ev} templates={templates} onChanged={refresh} />
                  ))}
            </section>
          )
        })}
      </main>
    </div>
  )
}
