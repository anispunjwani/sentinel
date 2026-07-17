import { useState } from 'react'
import TierBadge from '../shared/TierBadge'
import TemplatePicker from './TemplatePicker'
import { escalateEvent, deescalateEvent } from '../../lib/api'
import { timeAgo, formatTime, sourceLabel } from '../../lib/utils'
import './EventDetail.css'

export default function EventDetail({ event, onClose, onTierChange }) {
  const [showTemplates, setShowTemplates] = useState(false)
  const [currentTier, setCurrentTier] = useState(event.tier)
  const [loading, setLoading] = useState(null)

  async function handleEscalate() {
    setLoading('escalate')
    try {
      await escalateEvent(event.id)
      setCurrentTier('active')
      onTierChange?.(event.id, 'active')
    } finally { setLoading(null) }
  }

  async function handleDeescalate() {
    setLoading('deescalate')
    try {
      await deescalateEvent(event.id)
      setCurrentTier('digest')
      onTierChange?.(event.id, 'digest')
    } finally { setLoading(null) }
  }

  return (
    <>
      <div className="overlay" onClick={onClose}>
        <div className="slide-panel" onClick={e => e.stopPropagation()}>
          <div className="panel-header">
            <div className="event-detail-header-content">
              <TierBadge tier={currentTier} pulse />
              <h2 className="event-detail-title">{event.event_type}</h2>
              <div className="event-detail-meta">
                <span className="event-detail-location">
                  {event.center_name && <><strong>{event.center_name}</strong> · </>}
                  {event.county_name}{event.state_code ? `, ${event.state_code}` : ''}
                </span>
                <span className="event-detail-time">
                  {formatTime(event.issued_at)} · {timeAgo(event.issued_at)}
                </span>
                <span className="event-detail-source">{sourceLabel(event.source)}</span>
              </div>
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">✕</button>
          </div>

          <div className="panel-body">
            <p className="event-detail-headline">{event.headline}</p>
            {event.summary && (
              <div className="event-detail-summary">
                <p>{event.summary}</p>
              </div>
            )}
            {event.source_url && (
              <a
                href={event.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost btn-sm event-detail-source-link"
              >
                ↗ View original source
              </a>
            )}
            {event.reviewed && event.reviewed_by && (
              <div className="event-detail-reviewed">
                ✓ Reviewed by {event.reviewed_by}
              </div>
            )}
          </div>

          <div className="panel-footer">
            {currentTier !== 'active' && (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleEscalate}
                disabled={loading === 'escalate'}
              >
                {loading === 'escalate' ? <span className="spinner" style={{width:14,height:14}}/> : '🔴'} Escalate to Active
              </button>
            )}
            {currentTier !== 'digest' && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleDeescalate}
                disabled={loading === 'deescalate'}
              >
                {loading === 'deescalate' ? <span className="spinner" style={{width:14,height:14}}/> : '↓'} De-escalate
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowTemplates(true)}
            >
              📋 Copy Message
            </button>
          </div>
        </div>
      </div>

      {showTemplates && (
        <TemplatePicker
          event={{ ...event, tier: currentTier }}
          onClose={() => setShowTemplates(false)}
        />
      )}
    </>
  )
}
