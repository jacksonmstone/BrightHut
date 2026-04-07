import { useState } from 'react'
import './FormModal.css'

export type FieldDef = {
  key: string
  label: string
  type: 'text' | 'date' | 'number' | 'select' | 'textarea' | 'checkbox'
  options?: string[]
  required?: boolean
  placeholder?: string
}

type Props = {
  title: string
  fields: FieldDef[]
  initialData?: Record<string, unknown>
  onSave: (data: Record<string, unknown>) => Promise<void>
  onClose: () => void
}

export default function FormModal({ title, fields, initialData, onSave, onClose }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {}
    for (const f of fields) {
      if (initialData && initialData[f.key] !== undefined) {
        init[f.key] = initialData[f.key]
      } else {
        init[f.key] = f.type === 'checkbox' ? false : ''
      }
    }
    return init
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (key: string, value: unknown) => setValues(v => ({ ...v, [key]: value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSave(values)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.')
      setSaving(false)
    }
  }

  return (
    <div className="fm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="fm-modal">
        <div className="fm-header">
          <h2>{title}</h2>
          <button className="fm-close" onClick={onClose} type="button">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="fm-body">
            {fields.map(f => (
              <div key={f.key} className="fm-field">
                <label className="fm-label" htmlFor={`fm-${f.key}`}>
                  {f.label}{f.required && <span className="fm-req"> *</span>}
                </label>
                {f.type === 'textarea' ? (
                  <textarea
                    id={`fm-${f.key}`}
                    className="fm-input fm-textarea"
                    value={String(values[f.key] ?? '')}
                    onChange={e => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    rows={3}
                  />
                ) : f.type === 'select' ? (
                  <select
                    id={`fm-${f.key}`}
                    className="fm-input fm-select"
                    value={String(values[f.key] ?? '')}
                    onChange={e => set(f.key, e.target.value)}
                    required={f.required}
                  >
                    <option value="">— Select —</option>
                    {f.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : f.type === 'checkbox' ? (
                  <label className="fm-checkbox-row">
                    <input
                      id={`fm-${f.key}`}
                      type="checkbox"
                      className="fm-checkbox"
                      checked={!!values[f.key]}
                      onChange={e => set(f.key, e.target.checked)}
                    />
                    <span>{f.placeholder ?? 'Yes'}</span>
                  </label>
                ) : (
                  <input
                    id={`fm-${f.key}`}
                    className="fm-input"
                    type={f.type}
                    value={String(values[f.key] ?? '')}
                    onChange={e => set(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    required={f.required}
                    step={f.type === 'number' ? 'any' : undefined}
                  />
                )}
              </div>
            ))}
            {error && <p className="fm-error">{error}</p>}
          </div>
          <div className="fm-footer">
            <button type="button" className="fm-btn fm-btn--cancel" onClick={onClose}>Cancel</button>
            <button type="submit" className="fm-btn fm-btn--save" disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
