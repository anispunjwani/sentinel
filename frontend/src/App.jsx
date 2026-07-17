import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './lib/AuthContext'
import LoginPage from './pages/LoginPage'
import AppShell from './components/layout/AppShell'
import DashboardPage from './pages/DashboardPage'
import EventsPage from './pages/EventsPage'
import CentersPage from './pages/CentersPage'
import TemplatesPage from './pages/TemplatesPage'
import SettingsPage from './pages/SettingsPage'

function Router() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('dashboard')

  // Simple hash-based routing
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard'
      setPage(hash)
    }
    onHash()
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
      <div className="spinner" />
    </div>
  )

  if (!user) return <LoginPage />

  const pages = {
    dashboard: <DashboardPage />,
    events: <EventsPage />,
    centers: <CentersPage />,
    templates: <TemplatesPage />,
    settings: <SettingsPage />,
  }

  return (
    <AppShell currentPage={page} onNavigate={setPage}>
      {pages[page] || <DashboardPage />}
    </AppShell>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  )
}
