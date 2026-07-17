import TierBadge from '../shared/TierBadge'
import { timeAgo } from '../../lib/utils'
import './EventCard.css'

export default function EventCard({ event, onClick, compact = false }) {
  return (
    <div
      className={`event-card event-card-${event.tier} ${compact ? 'event-card-compact' : ''}`}
      onClick={() => onClick?.(event)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.(event)}
    >
      <div className="event-card-tier-bar" />
      <div className="event-card-body">
        <div className="event-card-top">
          <TierBadge tier={event.tier} pulse={event.tier === 'active'} />
          <span className="event-card-time">{timeAgo(event.issued_at)}</span>
        </div>
        <div className="event-card-type">{event.event_type}</div>
        <div className="event-card-headline">{event.headline}</div>
        {!compact && event.center_name && (
          <div className="event-card-location">
            📍 {event.center_name}
            {event.county_name ? ` · ${event.county_name}, ${event.state_code}` : ''}
          </div>
        )}
      </div>
    </div>
  )
}
