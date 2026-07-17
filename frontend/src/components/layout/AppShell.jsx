import { useAuth } from '../../lib/AuthContext'
import './AppShell.css'

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: '⊞' },
  { id: 'events',    label: 'Events',    icon: '🔔' },
  { id: 'centers',   label: 'Centers',   icon: '📍' },
  { id: 'templates', label: 'Templates', icon: '📄' },
  { id: 'settings',  label: 'Settings',  icon: '⚙' },
]

export default function AppShell({ children, currentPage, onNavigate }) {
  const { user, logout } = useAuth()

  function nav(id) {
    window.location.hash = id
    onNavigate(id)
  }

  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  return (
    <div className="shell">
      {/* Top nav */}
      <header className="topnav">
        <div className="topnav-brand" onClick={() => nav('dashboard')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="#3B82F6" opacity="0.2"/>
            <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" stroke="#3B82F6" strokeWidth="1.5" strokeLinejoin="round"/>
            <path d="M9 12l2 2 4-4" stroke="#3B82F6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span className="topnav-wordmark">Sentinel</span>
        </div>

        <nav className="topnav-links hide-mobile">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`topnav-link ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => nav(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="topnav-user">
          <span className="topnav-team hide-mobile">{user?.team_name?.split(' ').slice(0, 2).join(' ')}</span>
          <div className="avatar-menu">
            <div className="avatar">{initials}</div>
            <div className="avatar-dropdown">
              <div className="avatar-dropdown-name">{user?.name}</div>
              <div className="avatar-dropdown-email">{user?.email}</div>
              <div className="avatar-dropdown-divider" />
              <button className="avatar-dropdown-item" onClick={() => nav('settings')}>Settings</button>
              <button className="avatar-dropdown-item danger" onClick={logout}>Log out</button>
            </div>
          </div>
        </div>
      </header>

      {/* Page content */}
      <main className="shell-main">
        {children}
      </main>

      {/* Bottom tab bar (mobile) */}
      <nav className="bottomnav show-mobile">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`bottomnav-item ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => nav(item.id)}
          >
            <span className="bottomnav-icon">{item.icon}</span>
            <span className="bottomnav-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
