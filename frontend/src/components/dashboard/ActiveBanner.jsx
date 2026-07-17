import { useState } from 'react'
import { timeAgo } from '../../lib/utils'
import './ActiveBanner.css'

export default function ActiveBanner({ events, onEventClick }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? events : events.slice(0, 5)
  const hasMore = events.length > 5

  if (events.length === 0) {
    return (
      <div className="active-banner active-banner-clear">
        <span className="active-banner-clear-dot" />
        <span className="active-banner-clear-text">All clear — no active events</span>
      </div>
    )
  }

  return (
    <div className="active-banner active-banner-alert">
      <div className="active-banner-header">
        <div className="active-banner-title">
          <span className="pulse-dot" />
          <span>Active Events</span>
          <span className="active-banner-count">{events.length}</span>
        </div>
      </div>
      <div className="active-banner-list">
        {visible.map(event => (
          <button
            key={event.id}
            className="active-banner-item"
            onClick={() => onEventClick(event)}
          >
            <span className="active-banner-item-dot" />
            <span className="active-banner-item-type">{event.event_type}</span>
            <span className="active-banner-item-center">{event.center_name || event.county_name}</span>
            <span className="active-banner-item-time">{timeAgo(event.issued_at)}</span>
          </button>
        ))}
        {hasMore && !expanded && (
          <button className="active-banner-more" onClick={() => setExpanded(true)}>
            View all {events.length} active events →
          </button>
        )}
      </div>
    </div>
  )
}
