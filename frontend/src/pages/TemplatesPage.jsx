import { useState, useEffect } from 'react'
import { getTemplates, createTemplate, updateTemplate, deleteTemplate } from '../lib/api'
import './TemplatesPage.css'

const VARIABLES = [
  { v: '{{event_type}}',  desc: 'Category of event',        ex: 'Tornado Warning' },
  { v: '{{county}}',      desc: 'County and state',          ex: 'Fairfield County, CT' },
  { v: '{{severity}}',    desc: 'Alert tier',                ex: 'ACTIVE' },
  { v: '{{time}}',        desc: 'Time event was issued',     ex: 'July 9, 2026 at 2:45 PM EDT' },
  { v: '{{summary}}',     desc: 'Event summary from source', ex: 'A tornado warning is in effect…' },
  { v: '{{source}}',      desc: 'Originating source',        ex: 'NWS' },
  { v: '{{source_link}}', desc: 'URL to original alert',     ex: 'https://alerts.weather.gov/…' },
  { v: '{{team_name}}',   desc: 'Regional team name',        ex: 'Northeastern US Disaster Management' },
]

const PREVIEW_VALUES = {
  '{{event_type}}':  'Tornado Warning',
  '{{county}}':      'Fairfield County, CT',
  '{{severity}}':    'ACTIVE',
  '{{time}}':        'July 9, 2026 at 2:45 PM EDT',
  '{{summary}}':     'A tornado warning is in effect for Fairfield County until 4:15 PM EDT. Take cover immediately.',
  '{{source}}':      'NWS',
  '{{source_link}}': 'https://alerts.weather.gov/',
  '{{team_name}}':   'Northeastern US Disaster Management',
}

function renderPreview(body) {
  return Object.entries(PREVIEW_VALUES).reduce(
    (text, [key, val]) => text.replaceAll(key, val), body
  )
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    getTemplates().then(data => {
      setTemplates(data.templates || [])
      setLoading(false)
    })
  }, [])

  function handleSave(data) {
    if (editing) {
      updateTemplate(editing.id, data)
      setTemplates(prev => prev.map(t => t.id === editing.id ? { ...t, ...data } : t))
    } else {
      const newT = createTemplate(data)
      if (newT.then) {
        newT.then(t => setTemplates(prev => [...prev, t]))
      } else {
        setTemplates(prev => [...prev, newT])
      }
    }
    setShowModal(false)
    setEditing(null)
  }

  function handleDelete(id) {
    deleteTemplate(id)
    setTemplates(prev => prev.filter(t => t.id !== id))
    setConfirmDelete(null)
  }

  return (
    <div className="templates-page">
      <div className="templates-page-header">
        <div>
          <h1>Message Templates</h1>
          <p>Reusable formats for team communications. Pick one when copying a message from any event.</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditing(null); setShowModal(true) }}>
          + Create Template
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--s10)' }}>
          <div className="spinner" />
        </div>
      ) : templates.length === 0 ? (
        <div className="empty-state card" style={{ padding: 'var(--s10)' }}>
          <div className="empty-state-icon">📄</div>
          <p>No templates yet. Create one to speed up your alert communications.</p>
          <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
            Create your first template
          </button>
        </div>
      ) : (
        <div className="templates-list">
          {templates.map((tmpl, i) => (
            <div key={tmpl.id} className={`template-item card ${i > 0 ? 'template-item-mt' : ''}`}>
              <div className="template-item-header">
                <h3 className="template-item-name">{tmpl.name}</h3>
                <div className="template-item-actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(tmpl); setShowModal(true) }}>
                    Edit
                  </button>
                  {confirmDelete === tmpl.id ? (
                    <div className="template-delete-confirm">
                      <span>Delete this template?</span>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDelete(tmpl.id)}>Delete</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(null)}>Cancel</button>
                    </div>
                  ) : (
                    <button className="btn btn-ghost btn-sm template-delete-btn" onClick={() => setConfirmDelete(tmpl.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <pre className="template-item-preview">{tmpl.body}</pre>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <TemplateModal
          template={editing}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}
    </div>
  )
}

function TemplateModal({ template, onSave, onClose }) {
  const [name, setName] = useState(template?.name || '')
  const [body, setBody] = useState(template?.body || '')

  function insertVariable(v) {
    setBody(prev => prev + v)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal template-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{template ? 'Edit Template' : 'Create Template'}</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body template-modal-body">
          <div className="template-form">
            <div className="field">
              <label>Template name</label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Active Alert — General"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="template-editor-layout">
              <div className="field template-body-field">
                <label>Message body</label>
                <textarea
                  className="input template-textarea"
                  placeholder="Write your template here. Use variables like {{event_type}} to insert event data."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={10}
                />
              </div>

              <div className="template-variables-panel">
                <div className="template-variables-label">Available variables</div>
                {VARIABLES.map(({ v, desc, ex }) => (
                  <button
                    key={v}
                    className="template-variable-btn"
                    onClick={() => insertVariable(v)}
                    title={`Example: ${ex}`}
                  >
                    <span className="template-variable-name">{v}</span>
                    <span className="template-variable-desc">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {body && (
              <div className="field">
                <label>Preview (with sample data)</label>
                <pre className="template-live-preview">{renderPreview(body)}</pre>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => onSave({ name: name.trim(), body })}
            disabled={!name.trim() || !body.trim()}
          >
            {template ? 'Save Changes' : 'Create Template'}
          </button>
        </div>
      </div>
    </div>
  )
}
