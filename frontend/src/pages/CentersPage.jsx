import { useState, useEffect } from 'react'
import { initCenters, createCenter, updateCenter, deleteCenter, getCounties } from '../lib/api'
import { groupByState } from '../lib/utils'
import './CentersPage.css'

export default function CentersPage() {
  const [centers, setCenters] = useState([])
  const [counties, setCounties] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [editingCenter, setEditingCenter] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([initCenters(), getCounties()]).then(([c, co]) => {
      setCenters(c)
      setCounties(co.counties || [])
      setLoading(false)
    })
  }, [])

  function handleCreate() {
    setEditingCenter(null)
    setShowModal(true)
  }

  function handleEdit(center) {
    setEditingCenter(center)
    setShowModal(true)
  }

  function handleSave(centerData) {
    if (editingCenter) {
      const updated = updateCenter(editingCenter.id, centerData)
      setCenters(prev => prev.map(c => c.id === editingCenter.id ? updated : c))
    } else {
      const newCenter = createCenter(centerData)
      setCenters(prev => [...prev, newCenter])
    }
    setShowModal(false)
    setEditingCenter(null)
  }

  function handleDelete(id) {
    deleteCenter(id)
    setCenters(prev => prev.filter(c => c.id !== id))
    setConfirmDelete(null)
  }

  if (loading) return <div className="centers-loading"><div className="spinner" /></div>

  return (
    <div className="centers-page">
      <div className="centers-page-header">
        <div>
          <h1>Centers</h1>
          <p>Personal groupings of counties for faster situational awareness.</p>
        </div>
        <button className="btn btn-primary" onClick={handleCreate}>
          + Create Center
        </button>
      </div>

      {centers.length === 0 ? (
        <div className="empty-state card" style={{ padding: 'var(--s10)' }}>
          <div className="empty-state-icon">📍</div>
          <p>No centers yet. Create one to group your counties.</p>
          <button className="btn btn-primary btn-sm" onClick={handleCreate}>
            Create your first center
          </button>
        </div>
      ) : (
        <div className="centers-list card">
          {centers.map((center, i) => (
            <div key={center.id} className={`center-row ${i > 0 ? 'center-row-divider' : ''}`}>
              <div className="center-row-info">
                <div className="center-row-name">{center.name}</div>
                <div className="center-row-meta">
                  {center.counties.length} {center.counties.length === 1 ? 'county' : 'counties'} ·{' '}
                  <span className="center-row-counties">
                    {center.counties.slice(0, 3).map(c => c.name).join(', ')}
                    {center.counties.length > 3 ? ` +${center.counties.length - 3} more` : ''}
                  </span>
                </div>
              </div>
              <div className="center-row-actions">
                <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(center)}>
                  Edit
                </button>
                {confirmDelete === center.id ? (
                  <div className="center-delete-confirm">
                    <span>Remove this center?</span>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(center.id)}>
                      Yes, remove
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-ghost btn-sm center-delete-btn" onClick={() => setConfirmDelete(center.id)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CenterModal
          center={editingCenter}
          counties={counties}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingCenter(null) }}
        />
      )}
    </div>
  )
}

function CenterModal({ center, counties, onSave, onClose }) {
  const [step, setStep] = useState(1)
  const [name, setName] = useState(center?.name || '')
  const [selected, setSelected] = useState(
    center?.counties?.map(c => c.fips) || []
  )
  const [search, setSearch] = useState('')

  const grouped = groupByState(
    counties.filter(c =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.state_name.toLowerCase().includes(search.toLowerCase())
    )
  )

  function toggleCounty(fips) {
    setSelected(prev =>
      prev.includes(fips) ? prev.filter(f => f !== fips) : [...prev, fips]
    )
  }

  function handleSave() {
    const selectedCounties = counties.filter(c => selected.includes(c.fips))
      .map(c => ({ fips: c.fips, name: c.name, state: c.state }))
    onSave({ name: name.trim(), counties: selectedCounties })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal center-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{center ? 'Edit Center' : 'Create Center'}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>

        {/* Step indicator */}
        <div className="center-modal-steps">
          <div className={`center-modal-step ${step >= 1 ? 'done' : ''}`}>
            <span className="step-num">1</span>
            <span className="step-label">Name</span>
          </div>
          <div className="step-connector" />
          <div className={`center-modal-step ${step >= 2 ? 'done' : ''}`}>
            <span className="step-num">2</span>
            <span className="step-label">Counties</span>
          </div>
        </div>

        <div className="modal-body">
          {step === 1 && (
            <div className="center-modal-step-body">
              <label htmlFor="center-name">Center name</label>
              <input
                id="center-name"
                className="input"
                type="text"
                placeholder="e.g. Richmond, NYC, DC Metro"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
              <p style={{ marginTop: 'var(--s3)', fontSize: '0.8125rem' }}>
                This name appears on your dashboard and in alert messages. Choose something your team will recognize immediately.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="center-modal-step-body">
              <div className="county-search-wrap">
                <input
                  className="input"
                  type="search"
                  placeholder="Search counties…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <span className="county-selected-count">
                  {selected.length} selected
                </span>
              </div>

              <div className="county-list">
                {/* Selected counties at top */}
                {selected.length > 0 && !search && (
                  <div className="county-group">
                    <div className="county-group-label">Selected</div>
                    {counties.filter(c => selected.includes(c.fips)).map(county => (
                      <CountyRow
                        key={county.fips}
                        county={county}
                        checked={true}
                        onToggle={toggleCounty}
                      />
                    ))}
                    <div className="county-group-divider" />
                  </div>
                )}

                {Object.entries(grouped).map(([stateName, stateCounties]) => (
                  <div key={stateName} className="county-group">
                    <div className="county-group-label">{stateName}</div>
                    {stateCounties.map(county => (
                      <CountyRow
                        key={county.fips}
                        county={county}
                        checked={selected.includes(county.fips)}
                        onToggle={toggleCounty}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 1 ? (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={() => setStep(2)}
                disabled={!name.trim()}
              >
                Next: Select Counties →
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => setStep(1)}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={selected.length === 0}
              >
                {center ? 'Save Changes' : 'Create Center'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function CountyRow({ county, checked, onToggle }) {
  return (
    <label className="county-row">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(county.fips)}
        className="county-checkbox"
      />
      <span className="county-row-name">{county.name}</span>
      <span className="county-row-state">{county.state}</span>
    </label>
  )
}
