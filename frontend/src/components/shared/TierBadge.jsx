export default function TierBadge({ tier, pulse = false }) {
  return (
    <span className={`badge badge-${tier}`}>
      {pulse && tier === 'active'
        ? <span className="pulse-dot" />
        : <span className="badge-dot" />
      }
      {tier === 'active' ? 'Active' : tier === 'monitor' ? 'Monitor' : 'Digest'}
    </span>
  )
}
