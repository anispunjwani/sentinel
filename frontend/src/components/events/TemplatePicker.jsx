import { useState, useEffect } from 'react'
import { getTemplates, renderTemplate } from '../../lib/api'
import { copyToClipboard } from '../../lib/utils'
import './TemplatePicker.css'

export default function TemplatePicker({ event, onClose }) {
  const [templates, setTemplates] = useState([])
  const [selected, setSelected] = useState(null)
  const [rendered, setRendered] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getTemplates().then(data => setTemplates(data.templates || []))
  }, [])

  async function handleSelect(tmpl) {
    setSelected(tmpl)
    setLoading(true)
    setRendered('')
    try {
      const result = await renderTemplate(tmpl.id, event.id)
      setRendered(result.rendered)
    } finally { setLoading(false) }
  }

  async function handleCopy() {
    await copyToClipboard(rendered)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 300 }}>
      <div className="modal template-picker-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Copy Message</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body template-picker-body">
          {templates.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📄</div>
              <p>No templates yet. Create one in the Templates screen.</p>
            </div>
          ) : (
            <div className="template-picker-layout">
              <div className="template-list">
                <p className="template-list-label">Select a template</p>
                {templates.map(t => (
                  <button
                    key={t.id}
                    className={`template-list-item ${selected?.id === t.id ? 'selected' : ''}`}
                    onClick={() => handleSelect(t)}
                  >
                    <span className="template-list-name">{t.name}</span>
                    <span className="template-list-preview">
                      {t.body.replace(/{{[^}]+}}/g, '…').slice(0, 60)}
                    </span>
                  </button>
                ))}
              </div>

              <div className="template-preview">
                {!selected && (
                  <div className="empty-state" style={{ padding: 'var(--s8)' }}>
                    <div className="empty-state-icon">👆</div>
                    <p>Pick a template to preview</p>
                  </div>
                )}
                {selected && loading && (
                  <div className="empty-state"><div className="spinner" /></div>
                )}
                {selected && !loading && rendered && (
                  <>
                    <p className="template-preview-label">Preview</p>
                    <pre className="template-preview-text">{rendered}</pre>
                    <button
                      className={`btn btn-primary btn-sm template-copy-btn ${copied ? 'copied' : ''}`}
                      onClick={handleCopy}
                    >
                      {copied ? '✓ Copied!' : '📋 Copy to Clipboard'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
