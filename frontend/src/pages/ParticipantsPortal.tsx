import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getResidents,
  getProcessRecordings,
  getHomeVisitations,
  getEducationRecords,
  getHealthRecords,
  getInterventionPlans,
  getIncidentReports,
} from '../api/residents'
import './ParticipantsPortal.css'

type Row = Record<string, unknown>

type Tab = 'residents' | 'process' | 'visitations' | 'education' | 'health' | 'interventions' | 'incidents'

const TABS: { id: Tab; label: string }[] = [
  { id: 'residents', label: 'Residents' },
  { id: 'process', label: 'Process Recordings' },
  { id: 'visitations', label: 'Home Visitations' },
  { id: 'education', label: 'Education' },
  { id: 'health', label: 'Health' },
  { id: 'interventions', label: 'Intervention Plans' },
  { id: 'incidents', label: 'Incidents' },
]

export default function ParticipantsPortal() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('residents')
  const [data, setData] = useState<Record<Tab, Row[]>>({
    residents: [], process: [], visitations: [], education: [], health: [], interventions: [], incidents: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(12)

  useEffect(() => {
    Promise.all([
      getResidents(),
      getProcessRecordings(),
      getHomeVisitations(),
      getEducationRecords(),
      getHealthRecords(),
      getInterventionPlans(),
      getIncidentReports(),
    ])
      .then(([residents, process, visitations, education, health, interventions, incidents]) => {
        setData({ residents, process, visitations, education, health, interventions, incidents })
      })
      .catch(() => setError('Failed to load participant data.'))
      .finally(() => setLoading(false))
  }, [])

  const rows = data[tab]
  const filtered = rows.filter((r) =>
    Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(search.toLowerCase()))
  )

  const renderCard = (r: Row, i: number) => {
    switch (tab) {
      case 'residents':
        return (
          <div key={i} className="p-card">
            <div className="p-card-header">
              <span className="p-code">{String(r.internal_code ?? '—')}</span>
              <span className={`status-badge status-${String(r.case_status ?? '').toLowerCase()}`}>{String(r.case_status ?? '—')}</span>
            </div>
            <div className="p-card-body">
              <div className="p-field"><span className="field-label">Category</span><span>{String(r.case_category ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Risk Level</span><span>{String(r.current_risk_level ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Social Worker</span><span>{String(r.assigned_social_worker ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Admitted</span><span>{String(r.date_of_admission ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Reintegration</span><span>{String(r.reintegration_status ?? '—')}</span></div>
            </div>
          </div>
        )
      case 'process':
        return (
          <div key={i} className="p-card">
            <div className="p-card-header">
              <span className="p-code">{String(r.session_date ?? '—')}</span>
              <span className="meta-tag">{String(r.session_type ?? '—')}</span>
            </div>
            <div className="p-card-body">
              <div className="p-field"><span className="field-label">Social Worker</span><span>{String(r.social_worker ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Duration</span><span>{String(r.session_duration_minutes ?? '—')} min</span></div>
              <div className="p-field"><span className="field-label">Emotional Start</span><span>{String(r.emotional_state_observed ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Emotional End</span><span>{String(r.emotional_state_end ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Progress</span><span>{r.progress_noted ? 'Yes' : 'No'}</span></div>
              <div className="p-field"><span className="field-label">Concerns</span><span>{r.concerns_flagged ? 'Yes' : 'No'}</span></div>
            </div>
          </div>
        )
      case 'visitations':
        return (
          <div key={i} className="p-card">
            <div className="p-card-header">
              <span className="p-code">{String(r.visit_date ?? '—')}</span>
              <span className="meta-tag">{String(r.visit_type ?? '—')}</span>
            </div>
            <div className="p-card-body">
              <div className="p-field"><span className="field-label">Social Worker</span><span>{String(r.social_worker ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Cooperation</span><span>{String(r.family_cooperation_level ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Safety Concerns</span><span>{r.safety_concerns_noted ? 'Yes' : 'No'}</span></div>
              <div className="p-field"><span className="field-label">Outcome</span><span>{String(r.visit_outcome ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Follow-up</span><span>{r.follow_up_needed ? 'Yes' : 'No'}</span></div>
            </div>
          </div>
        )
      case 'education':
        return (
          <div key={i} className="p-card">
            <div className="p-card-header">
              <span className="p-code">{String(r.record_date ?? '—')}</span>
              <span className="meta-tag">{String(r.program_name ?? '—')}</span>
            </div>
            <div className="p-card-body">
              <div className="p-field"><span className="field-label">Course</span><span>{String(r.course_name ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Level</span><span>{String(r.education_level ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Attendance</span><span>{String(r.attendance_status ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Progress</span><span>{Number(r.progress_percent ?? 0).toFixed(1)}%</span></div>
              <div className="p-field"><span className="field-label">GPA Score</span><span>{String(r.gpa_like_score ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Status</span><span>{String(r.completion_status ?? '—')}</span></div>
            </div>
          </div>
        )
      case 'health':
        return (
          <div key={i} className="p-card">
            <div className="p-card-header">
              <span className="p-code">{String(r.record_date ?? '—')}</span>
              <span className="meta-tag">BMI: {String(r.bmi ?? '—')}</span>
            </div>
            <div className="p-card-body">
              <div className="p-field"><span className="field-label">Weight</span><span>{String(r.weight_kg ?? '—')} kg</span></div>
              <div className="p-field"><span className="field-label">Height</span><span>{String(r.height_cm ?? '—')} cm</span></div>
              <div className="p-field"><span className="field-label">Nutrition</span><span>{String(r.nutrition_score ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Sleep</span><span>{String(r.sleep_score ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Energy</span><span>{String(r.energy_score ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">General Health</span><span>{String(r.general_health_score ?? '—')}</span></div>
            </div>
          </div>
        )
      case 'interventions':
        return (
          <div key={i} className="p-card">
            <div className="p-card-header">
              <span className="p-code">{String(r.plan_category ?? '—')}</span>
              <span className={`status-badge status-${String(r.status ?? '').toLowerCase().replace(' ', '-')}`}>{String(r.status ?? '—')}</span>
            </div>
            <div className="p-card-body">
              <div className="p-field"><span className="field-label">Description</span><span>{String(r.plan_description ?? '—').slice(0, 80)}</span></div>
              <div className="p-field"><span className="field-label">Services</span><span>{String(r.services_provided ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Target Date</span><span>{String(r.target_date ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Case Conference</span><span>{String(r.case_conference_date ?? '—')}</span></div>
            </div>
          </div>
        )
      case 'incidents':
        return (
          <div key={i} className="p-card">
            <div className="p-card-header">
              <span className="p-code">{String(r.incident_date ?? '—')}</span>
              <span className={`severity-badge severity-${String(r.severity ?? '').toLowerCase()}`}>{String(r.severity ?? '—')}</span>
            </div>
            <div className="p-card-body">
              <div className="p-field"><span className="field-label">Type</span><span>{String(r.incident_type ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Reported By</span><span>{String(r.reported_by ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Resolved</span><span>{r.resolved ? 'Yes' : 'No'}</span></div>
              <div className="p-field"><span className="field-label">Follow-up</span><span>{r.follow_up_required ? 'Required' : 'None'}</span></div>
            </div>
          </div>
        )
    }
  }

  return (
    <main className="participants-page">
      <div className="participants-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <div>
          <h1>Participants Portal</h1>
          <p className="subtitle">Case management records</p>
        </div>
      </div>

      <div className="tab-scroll">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); setSearch(''); setVisible(12) }}
          >
            {t.label}
            <span className="tab-count">{data[t.id].length}</span>
          </button>
        ))}
      </div>

      <div className="participants-controls">
        <input
          className="search-input"
          type="text"
          placeholder="Search across all fields..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p className="state-msg">Loading...</p>}
      {error && <p className="state-msg error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="residents-grid">
            {filtered.slice(0, visible).map((r, i) => renderCard(r, i))}
            {filtered.length === 0 && <p className="state-msg">No records match your search.</p>}
          </div>
          {visible < filtered.length && (
            <div className="load-more-wrap">
              <button className="load-more-btn" onClick={() => setVisible(v => v + 12)}>
                Show 12 more ({filtered.length - visible} remaining)
              </button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
