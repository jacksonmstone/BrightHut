import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getResidents } from '../api/residents'
import './ParticipantsPortal.css'

type Resident = Record<string, unknown>

export default function ParticipantsPortal() {
  const navigate = useNavigate()
  const [residents, setResidents] = useState<Resident[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    getResidents()
      .then(setResidents)
      .catch(() => setError('Failed to load participants.'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = residents.filter((r) => {
    const q = search.toLowerCase()
    return (
      String(r.internal_code ?? '').toLowerCase().includes(q) ||
      String(r.case_status ?? '').toLowerCase().includes(q) ||
      String(r.case_category ?? '').toLowerCase().includes(q) ||
      String(r.assigned_social_worker ?? '').toLowerCase().includes(q)
    )
  })

  return (
    <main className="participants-page">
      <div className="participants-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <div>
          <h1>Participants Portal</h1>
          <p className="subtitle">Resident case records</p>
        </div>
      </div>

      <div className="participants-controls">
        <input
          className="search-input"
          type="text"
          placeholder="Search by code, status, category, or social worker..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="count">{filtered.length} participant{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p className="state-msg">Loading...</p>}
      {error && <p className="state-msg error">{error}</p>}

      {!loading && !error && (
        <div className="residents-grid">
          {filtered.map((r, i) => (
            <div key={i} className="resident-card">
              <div className="resident-header">
                <span className="resident-code">{String(r.internal_code ?? '—')}</span>
                <span className={`status-badge status-${String(r.case_status ?? '').toLowerCase()}`}>
                  {String(r.case_status ?? '—')}
                </span>
              </div>
              <div className="resident-body">
                <div className="resident-field">
                  <span className="field-label">Category</span>
                  <span>{String(r.case_category ?? '—')}</span>
                </div>
                <div className="resident-field">
                  <span className="field-label">Risk Level</span>
                  <span>{String(r.current_risk_level ?? '—')}</span>
                </div>
                <div className="resident-field">
                  <span className="field-label">Social Worker</span>
                  <span>{String(r.assigned_social_worker ?? '—')}</span>
                </div>
                <div className="resident-field">
                  <span className="field-label">Admitted</span>
                  <span>{String(r.date_of_admission ?? '—')}</span>
                </div>
                <div className="resident-field">
                  <span className="field-label">Reintegration</span>
                  <span>{String(r.reintegration_status ?? '—')}</span>
                </div>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="state-msg">No participants match your search.</p>
          )}
        </div>
      )}
    </main>
  )
}
