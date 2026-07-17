import { useState, useEffect } from 'react'
import { getEvents, initCenters } from '../lib/api'
import { tierPriority } from '../lib/utils'
import EventCard from '../components/events/EventCard'
import EventDetail from '../components/events/EventDetail'
import TierBadge from '../components/shared/TierBadge'
import './EventsPage.css'

export default function EventsPage() {
  const [events, setEvents] = useState([])
  const [centers, setCenters] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [tierFilter, setTierFilter] = useState('all')
  const [centerFilter, setCenterFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const PER_PAGE = 25

  useEffect(() => {
    Promise.all([getEvents(), initCenters()]).then(([eventsData, centersData]) => {
      setEvents(eventsData.events || [])
      setCenters(centersData)
      setLoading(false)
    })
  }, [])

  function handleTierChange(eventId, newTier) {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, tier: newTier } : e))
  }

  const filtered = events
    .filter(e => tierFilter === 'all' || e.tier === tierFilter)
    .filter(e => centerFilter === 'all' || e.center_name === centerFilter)
    .filter(e => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        e.headline?.toLowerCase().includes(q) ||
        e.event_type?.toLowerCase().includes(q) ||
        e.summary?.toLowerCase().includes(q) ||
        e.county_name?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const tp = tierPriority(a.tier) - tierPriority(b.tier)
      if (tp !== 0) return tp
      return new Date(b.issued_at) - new Date(a.issued_at)
    })

  const totalPages = Math.ceil(filtered.length / PER_PAGE)
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [tierFilter, centerFilter, search])

  const centerNames = [...new Set(events.map(e => e.center_name).filter(Boolean))]

  return (
    <div className="events-page">
      <div className="events-page-header">
        <h1>Events</h1>
        <span className="events-page-count">{filtered.length} events</span>
      </div>

      <div className="events-filters">
        <input
          className="input events-search"
          type="search"
          placeholder="Search events…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <div className="events-filter-row">
          <div className="filter-group">
            <span className="filter-group-label">Tier</span>
            {['all', 'active', 'monitor', 'digest'].map(t => (
              <button
                key={t}
                className={`filter-tab ${tierFilter === t ? 'active' : ''}`}
                onClick={() => setTierFilter(t)}
              >
                {t === 'all' ? 'All' : <TierBadge tier={t} />}
              </button>
            ))}
          </div>

          <div className="filter-group">
            <span className="filter-group-label">Center</span>
            <select
              className="input events-center-select"
              value={centerFilter}
              onChange={e => setCenterFilter(e.target.value)}
            >
              <option value="all">All centers</option>
              {centerNames.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="events-loading"><div className="spinner" /></div>
      ) : paginated.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <p>{search || tierFilter !== 'all' || centerFilter !== 'all'
            ? 'No events match your filters'
            : 'No events yet'
          }</p>
        </div>
      ) : (
        <>
          <div className="events-list">
            {paginated.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onClick={setSelectedEvent}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="events-pagination">
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >← Prev</button>
              <span className="events-page-indicator">
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >Next →</button>
            </div>
          )}
        </>
      )}

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onTierChange={handleTierChange}
        />
      )}
    </div>
  )
}
