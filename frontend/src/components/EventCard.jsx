import { useState } from 'react'
import { reviewEvent, escalateEvent, renderTemplate } from '../api.js'

// The one-step-up escalation target for each tier.
const NEXT_TIER = { digest: 'monitor', monitor: 'active' }

export default function EventCard({ event, templates, onChanged }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  // Run an action, then refresh the dashboard so the card reflects new state.
  async function run(action) {
    setBusy(true)
    try {
      await action()
      await onChanged()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function buildMessage(templateId) {
    setBusy(true)
    try {
      const res = await renderTemplate(templateId, event.id)
      setMessage(res.rendered)
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const nextTier = NEXT_TIER[event.tier]

  return (
    <div className="card event">
      <div className="event-head">
        <span className="event-type">{event.event_type}</span>
        <span className="muted">
          {event.county_name || event.county_fips || '—'} · {event.source.toUpperCase()}
        </span>
      </div>

      <div className="headline">{event.headline}</div>
      {event.summary && <p className="summary">{event.summary.slice(0, 300)}{event.summary.length > 300 ? '…' : ''}</p>}

      <div className="event-meta muted">
        {event.issued_at && <span>{new Date(event.issued_at).toLocaleString()}</span>}
        {event.reviewed && <span className="badge">reviewed by {event.reviewed_by}</span>}
        {event.source_url && <a href={event.source_url} target="_blank" rel="noreferrer">source</a>}
      </div>

      <div className="actions">
        {!event.reviewed && (
          <button disabled={busy} onClick={() => run(() => reviewEvent(event.id))}>Review</button>
        )}
        {nextTier && (
          <button disabled={busy} onClick={() => run(() => escalateEvent(event.id, nextTier))}>
            Escalate to {nextTier}
          </button>
        )}
        {templates.length > 0 && (
          <select disabled={busy} value=""
            onChange={(e) => e.target.value && buildMessage(e.target.value)}>
            <option value="">Message…</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
      </div>

      {message && (
        <div className="message">
          <textarea readOnly value={message} rows={8} />
          <div className="actions">
            <button onClick={() => navigator.clipboard.writeText(message)}>Copy</button>
            <button className="ghost" onClick={() => setMessage('')}>Close</button>
          </div>
        </div>
      )}
    </div>
  )
}
