/** Format ISO timestamp to relative time string */
export function timeAgo(isoString) {
  if (!isoString) return ''
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/** Format ISO timestamp to readable string */
export function formatTime(isoString, tz = 'America/New_York') {
  if (!isoString) return ''
  return new Date(isoString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', timeZoneName: 'short', timeZone: tz
  })
}

/** Get tier label */
export function tierLabel(tier) {
  return { active: 'Active', monitor: 'Monitor', digest: 'Digest' }[tier] || tier
}

/** Get event source display name */
export function sourceLabel(source) {
  return {
    nws: 'National Weather Service',
    fema: 'FEMA IPAWS',
    rss: 'News Feed',
    manual: 'Manual Entry'
  }[source] || source?.toUpperCase()
}

/** Group counties by state */
export function groupByState(counties) {
  return counties.reduce((acc, c) => {
    if (!acc[c.state_name]) acc[c.state_name] = []
    acc[c.state_name].push(c)
    return acc
  }, {})
}

/** Get tier priority for sorting (active first) */
export function tierPriority(tier) {
  return { active: 0, monitor: 1, digest: 2 }[tier] ?? 3
}

/** Whether an event should still be shown on the dashboard.
 *  Hidden once its underlying alert has expired, or (for Digest) once it is
 *  older than `digestMaxDays` days — so stale, no-longer-relevant cards clear. */
export function isCurrentEvent(event, digestMaxDays = 3) {
  const now = Date.now()
  if (event.expires_at && new Date(event.expires_at).getTime() < now) return false
  if (event.tier === 'digest') {
    const stamped = event.issued_at || event.created_at
    if (stamped && now - new Date(stamped).getTime() > digestMaxDays * 86400000) return false
  }
  return true
}

/** Sort comparator: most urgent tier first, then most recent first. */
export function byTierThenRecent(a, b) {
  const t = tierPriority(a.tier) - tierPriority(b.tier)
  if (t !== 0) return t
  return new Date(b.issued_at || b.created_at) - new Date(a.issued_at || a.created_at)
}

/** Copy text to clipboard */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Fallback for older browsers
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    return true
  }
}
