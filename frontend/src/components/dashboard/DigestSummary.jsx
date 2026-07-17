import { useState } from 'react'
import { timeAgo } from '../../lib/utils'
import './DigestSummary.css'

export default function DigestSummary({ digest }) {
  const [open, setOpen] = useState(false)
  if (!digest) return null

  const total = digest.total_events || 0
  const centers = digest.by_center || []

  return (
    <div className="digest-summary card">
      <button className="digest-summary-toggle" onClick={() => setOpen(o => !o)}>
        <div className="digest-summary-left">
          <span className="digest-summary-icon">📋</span>
          <span className="digest-summary-title">24-Hour Digest</span>
          <span className="digest-summary-total">{total} events</span>
        </div>
        <span className="digest-summary-chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="digest-summary-body">
          <div className="digest-summary-grid">
            {centers.map(center => (
              <div key={center.center_name} className="digest-center">
                <div className="digest-center-name">{center.center_name}</div>
                <div className="digest-center-items">
                  {center.breakdown.map((item, i) => (
                    <div key={i} className={`digest-center-item digest-tier-${item.tier}`}>
                      <span className="digest-item-dot" />
                      <span className="digest-item-type">{item.event_type}</span>
                      <span className="digest-item-count">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {digest.generated_at && (
            <div className="digest-summary-footer">
              Last updated {timeAgo(digest.generated_at)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
