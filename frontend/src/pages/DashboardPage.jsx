import { useState, useEffect, useCallback } from 'react'
import { getEvents, getDigest, initCenters } from '../lib/api'
import { tierPriority } from '../lib/utils'
import EventCard from '../components/events/EventCard'
import EventDetail from '../components/events/EventDetail'
import CenterCard from '../components/dashboard/CenterCard'
import ActiveBanner from '../components/dashboard/ActiveBanner'
import DigestSummary from '../components/dashboard/DigestSummary'
import './DashboardPage.css'

export default function DashboardPage() {
  const [events, setEvents] = useState([])
  const [digest, setDigest] = useState(null)
  const [centers, setCenters] = useState([])
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    try {
      const [eventsData, digestData, centersData] = await Promise.all([
        getEvents(),
        getDigest(),
        initCenters(),
      ])
      setEvents(eventsData.events || [])
      setDigest(digestData)
      setCenters(centersData)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 60000) // auto-refresh every 60s
    return () => clearInterval(interval)
  }, [loadData])

  function handleTierChange(eventId, newTier) {
    setEvents(prev => prev.map(e => e.id === eventId ? { ...e, tier: newTier } : e))
  }

  const activeEvents = events.filter(e => e.tier === 'active')

  // Build per-center event lists
  function eventsForCenter(center) {
    const fipsList = center.counties.map(c => c.fips)
    return events
      .filter(e => fipsList.includes(e.county_fips))
      .sort((a, b) => tierPriority(a.tier) - tierPriority(b.tier))
  }

  if (loading) return (
    <div className="dashboard-loading">
      <div className="spinner" />
      <p>Loading Sentinel…</p>
    </div>
  )

  return (
    <div className="dashboard">
      {/* Active banner */}
      <ActiveBanner
        events={activeEvents}
        onEventClick={setSelectedEvent}
      />

      {/* Digest summary */}
      <DigestSummary digest={digest} />

      {/* Center cards grid */}
      <div className="dashboard-section">
        <div className="dashboard-section-header">
          <h2>Centers</h2>
          <span className="dashboard-center-count">{centers.length} centers</span>
        </div>

        {centers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📍</div>
            <p>No centers set up yet. Go to Centers to create your first one.</p>
          </div>
        ) : (
          <div className="center-grid">
            {centers.map(center => (
              <CenterCard
                key={center.id}
                center={center}
                events={eventsForCenter(center)}
                onEventClick={setSelectedEvent}
              />
            ))}
          </div>
        )}
      </div>

      {/* Event detail panel */}
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
