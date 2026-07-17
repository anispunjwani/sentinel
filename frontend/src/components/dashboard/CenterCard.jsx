import { useState } from 'react'
import EventCard from '../events/EventCard'
import EventDetail from '../events/EventDetail'
import TierBadge from '../shared/TierBadge'
import './CenterCard.css'

function centerStatus(events) {
  if (events.some(e => e.tier === 'active')) return 'active'
  if (events.some(e => e.tier === 'monitor')) return 'monitor'
  return 'quiet'
}

export default function CenterCard({ center, events, onEventClick }) {
  const [showAll, setShowAll] = useState(false)
  const status = centerStatus(events)
  const activeCount = events.filter(e => e.tier === 'active').length
  const monitorCount = events.filter(e => e.tier === 'monitor').length
  const preview = events.slice(0, 3)

  return (
    <div className={`center-card card center-card-${status}`}>
      <div className="center-card-header">
        <div className="center-card-title-row">
          <h3 className="center-card-name">{center.name}</h3>
          <span className={`center-card-status-dot center-dot-${status}`} />
        </div>
        <div className="center-card-badges">
          {activeCount > 0 && (
            <span className="badge badge-active">
              <span className="badge-dot" />{activeCount} active
            </span>
          )}
          {monitorCount > 0 && (
            <span className="badge badge-monitor">
              <span className="badge-dot" />{monitorCount} monitor
            </span>
          )}
          {activeCount === 0 && monitorCount === 0 && (
            <span className="badge badge-digest">
              <span className="badge-dot" />Quiet
            </span>
          )}
        </div>
      </div>

      <div className="center-card-body">
        {events.length === 0 ? (
          <p className="center-card-empty">No events being tracked</p>
        ) : (
          <div className="center-card-events">
            {preview.map(event => (
              <EventCard
                key={event.id}
                event={event}
                onClick={onEventClick}
                compact
              />
            ))}
          </div>
        )}
      </div>

      {events.length > 3 && (
        <div className="center-card-footer">
          <button
            className="center-card-view-all"
            onClick={() => setShowAll(true)}
          >
            View all {events.length} events →
          </button>
        </div>
      )}

      {showAll && (
        <CenterDetailModal
          center={center}
          events={events}
          onEventClick={onEventClick}
          onClose={() => setShowAll(false)}
        />
      )}
    </div>
  )
}

function CenterDetailModal({ center, events, onEventClick, onClose }) {
  const [filter, setFilter] = useState('all')
  const [selectedEvent, setSelectedEvent] = useState(null)

  const filtered = filter === 'all' ? events : events.filter(e => e.tier === filter)

  function handleEventClick(event) {
    setSelectedEvent(event)
  }

  return (
    <>
      <div className="overlay" onClick={onClose}>
        <div className="slide-panel" onClick={e => e.stopPropagation()}>
          <div className="panel-header">
            <div>
              <h2>{center.name}</h2>
              <p style={{ fontSize: '0.8125rem', marginTop: 4 }}>
                {center.counties.length} {center.counties.length === 1 ? 'county' : 'counties'}
              </p>
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
          </div>

          <div className="center-detail-filters">
            {['all', 'active', 'monitor', 'digest'].map(t => (
              <button
                key={t}
                className={`filter-tab ${filter === t ? 'active' : ''}`}
                onClick={() => setFilter(t)}
              >
                {t === 'all' ? 'All' : <TierBadge tier={t} />}
              </button>
            ))}
          </div>

          <div className="panel-body">
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">✓</div>
                <p>No events in this category</p>
              </div>
            ) : (
              <div className="center-detail-events">
                {filtered.map(event => (
                  <EventCard
                    key={event.id}
                    event={event}
                    onClick={handleEventClick}
                  />
                ))}
              </div>
            )}

            <details className="center-county-list">
              <summary>Counties in this center</summary>
              <p className="center-county-names">
                {center.counties.map(c => `${c.name}, ${c.state}`).join(' · ')}
              </p>
            </details>
          </div>
        </div>
      </div>

      {selectedEvent && (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </>
  )
}
