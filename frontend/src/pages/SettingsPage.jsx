import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'
import './SettingsPage.css'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const [digestTime, setDigestTime] = useState(user?.digest_time || '09:00')
  const [timezone, setTimezone] = useState(user?.timezone || 'America/New_York')
  const [saved, setSaved] = useState(false)
  const [notifStatus, setNotifStatus] = useState('idle') // idle | requested | granted | denied

  function handleSaveProfile(e) {
    e.preventDefault()
    // In mock mode, just show saved confirmation
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleEnableNotifications() {
    setNotifStatus('requested')
    try {
      const result = await Notification.requestPermission()
      setNotifStatus(result)
    } catch {
      setNotifStatus('denied')
    }
  }

  const currentNotifPermission = typeof Notification !== 'undefined'
    ? Notification.permission
    : 'unsupported'

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      {/* Profile section */}
      <section className="settings-section card">
        <div className="settings-section-header">
          <h2>Profile</h2>
        </div>
        <form className="settings-form" onSubmit={handleSaveProfile}>
          <div className="settings-fields">
            <div className="field">
              <label>Full name</label>
              <input className="input" type="text" defaultValue={user?.name} readOnly />
            </div>
            <div className="field">
              <label>Email address</label>
              <input className="input" type="email" defaultValue={user?.email} readOnly />
            </div>
            <div className="field">
              <label>Team</label>
              <input className="input" type="text" defaultValue={user?.team_name} readOnly />
            </div>
          </div>
          <p className="settings-readonly-note">Contact your team administrator to update your name or email.</p>
        </form>
      </section>

      {/* Digest preferences */}
      <section className="settings-section card">
        <div className="settings-section-header">
          <h2>Digest Preferences</h2>
          <p>Controls when your daily summary notification is delivered.</p>
        </div>
        <form className="settings-form" onSubmit={handleSaveProfile}>
          <div className="settings-fields">
            <div className="field">
              <label htmlFor="digest-time">Daily digest time</label>
              <input
                id="digest-time"
                className="input settings-time-input"
                type="time"
                value={digestTime}
                onChange={e => setDigestTime(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="timezone">Timezone</label>
              <select
                id="timezone"
                className="input"
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
              >
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="America/Anchorage">Alaska Time (AKT)</option>
                <option value="Pacific/Honolulu">Hawaii Time (HT)</option>
              </select>
            </div>
          </div>
          <div className="settings-form-footer">
            <button className="btn btn-primary btn-sm" type="submit">
              {saved ? '✓ Saved' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </section>

      {/* PWA Install */}
      <section className="settings-section card">
        <div className="settings-section-header">
          <h2>Install on Your Phone</h2>
          <p>Add Sentinel to your home screen to receive push notifications and use it like an app.</p>
        </div>
        <div className="pwa-instructions">
          <div className="pwa-instruction-block">
            <div className="pwa-instruction-platform">🍎 iPhone (Safari)</div>
            <ol className="pwa-instruction-steps">
              <li>Open this page in <strong>Safari</strong></li>
              <li>Tap the <strong>Share</strong> button (box with arrow)</li>
              <li>Scroll down and tap <strong>Add to Home Screen</strong></li>
              <li>Tap <strong>Add</strong></li>
            </ol>
            <p className="pwa-instruction-note">Requires iOS 16.4 or later for push notifications.</p>
          </div>
          <div className="pwa-instruction-block">
            <div className="pwa-instruction-platform">🤖 Android (Chrome)</div>
            <ol className="pwa-instruction-steps">
              <li>Open this page in <strong>Chrome</strong></li>
              <li>Tap the <strong>⋮ menu</strong> (top right)</li>
              <li>Tap <strong>Add to Home Screen</strong></li>
              <li>Tap <strong>Add</strong></li>
            </ol>
          </div>
        </div>
      </section>

      {/* Push notifications */}
      <section className="settings-section card">
        <div className="settings-section-header">
          <h2>Push Notifications</h2>
          <p>Get notified immediately when an Active-tier event is detected.</p>
        </div>
        <div className="settings-form">
          {currentNotifPermission === 'granted' ? (
            <div className="notif-status notif-status-granted">
              ✓ Push notifications are enabled on this device
            </div>
          ) : currentNotifPermission === 'denied' ? (
            <div className="notif-status notif-status-denied">
              ✕ Notifications are blocked. To enable, go to your browser or phone settings and allow notifications for this site.
            </div>
          ) : (
            <>
              <p className="settings-form-desc">
                Tap the button below to allow Sentinel to send you push notifications. You can revoke this at any time in your browser settings.
              </p>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleEnableNotifications}
                disabled={notifStatus === 'requested'}
              >
                {notifStatus === 'requested' ? 'Requesting…' : 'Enable Push Notifications'}
              </button>
              <p className="settings-readonly-note" style={{ marginTop: 'var(--s3)' }}>
                Note: Full push notification delivery requires a backend update currently in progress. Enabling permissions now means you will receive notifications automatically when that update is deployed.
              </p>
            </>
          )}
        </div>
      </section>

      {/* Logout */}
      <section className="settings-section card settings-logout-section">
        <div className="settings-section-header">
          <h2>Session</h2>
          <p>You are signed in as <strong>{user?.email}</strong>. Your session persists until you log out.</p>
        </div>
        <button className="btn btn-ghost btn-sm settings-logout-btn" onClick={logout}>
          Log out of Sentinel
        </button>
      </section>
    </div>
  )
}
