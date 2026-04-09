import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PaginationBar from '../components/PaginationBar'
import {
  getResidents,
  getProcessRecordings,
  getHomeVisitations,
  getEducationRecords,
  getHealthRecords,
  getInterventionPlans,
  getIncidentReports,
  getResidentReadinessScore,
} from '../api/residents'
import type { ReadinessScore } from '../api/residents'
import { getSafehouses } from '../api/safehouses'
import { insertRow } from '../api/tables'
import FormModal from '../components/FormModal'
import type { FieldDef } from '../components/FormModal'
import { deleteSupporter } from '../api/supporters'
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

function participantRowKey(tab: Tab, r: Row): string {
  switch (tab) {
    case 'residents':
      return `res-${String(r.resident_id ?? '')}`
    case 'process':
      return `pr-${String(r.recording_id ?? '')}`
    case 'visitations':
      return `hv-${String(r.visitation_id ?? '')}`
    case 'education':
      return `ed-${String(r.education_record_id ?? '')}`
    case 'health':
      return `hl-${String(r.health_record_id ?? '')}`
    case 'interventions':
      return `ip-${String(r.plan_id ?? '')}`
    case 'incidents':
      return `inc-${String(r.incident_id ?? '')}`
    default:
      return JSON.stringify(r)
  }
}

export default function ParticipantsPortal() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('residents')
  const [data, setData] = useState<Record<Tab, Row[]>>({
    residents: [], process: [], visitations: [], education: [], health: [], interventions: [], incidents: [],
  })
  const [safehouses, setSafehouses] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterSafehouse, setFilterSafehouse] = useState('')
  const [filterReadiness, setFilterReadiness] = useState('')
  const [showAddResident, setShowAddResident] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [deleteSupporterId, setDeleteSupporterId] = useState('')
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [readinessScores, setReadinessScores] = useState<Map<number, ReadinessScore>>(new Map())

  useEffect(() => {
    Promise.all([
      getResidents(),
      getProcessRecordings(),
      getHomeVisitations(),
      getEducationRecords(),
      getHealthRecords(),
      getInterventionPlans(),
      getIncidentReports(),
      getSafehouses(),
    ])
      .then(([residents, process, visitations, education, health, interventions, incidents, sh]) => {
        setData({ residents, process, visitations, education, health, interventions, incidents })
        setSafehouses(sh)

        // Load readiness scores for active residents in parallel.
        // Silently ignored if the user lacks staff/admin role.
        const activeIds = residents
          .filter(r => r.case_status === 'Active')
          .map(r => Number(r.resident_id))
        Promise.allSettled(activeIds.map(id => getResidentReadinessScore(id)))
          .then(results => {
            const map = new Map<number, ReadinessScore>()
            results.forEach((r, i) => {
              if (r.status === 'fulfilled') map.set(activeIds[i], r.value)
            })
            setReadinessScores(map)
          })
      })
      .catch(() => setError('Failed to load participant data.'))
      .finally(() => setLoading(false))
  }, [refreshKey])

  const residentFields: FieldDef[] = [
    { key: 'case_control_no', label: 'Case Control No', type: 'text', required: true },
    { key: 'internal_code', label: 'Internal Code', type: 'text', required: true },
    { key: 'safehouse_id', label: 'Safehouse', type: 'select', required: true, options: safehouses.filter(s => s.status === 'Active').map(s => String(s.safehouse_id)) },
    { key: 'case_status', label: 'Case Status', type: 'select', required: true, options: ['Active','Closed','Transferred'] },
    { key: 'case_category', label: 'Case Category', type: 'select', required: true, options: ['Abandoned','Foundling','Surrendered','Neglected'] },
    { key: 'sex', label: 'Sex', type: 'select', required: true, options: ['F'] },
    { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
    { key: 'birth_status', label: 'Birth Status', type: 'select', options: ['Marital','Non-Marital'] },
    { key: 'place_of_birth', label: 'Place of Birth', type: 'text' },
    { key: 'religion', label: 'Religion', type: 'text' },
    { key: 'date_of_admission', label: 'Date of Admission', type: 'date' },
    { key: 'age_upon_admission', label: 'Age on Admission', type: 'text' },
    { key: 'assigned_social_worker', label: 'Assigned Social Worker', type: 'text' },
    { key: 'referral_source', label: 'Referral Source', type: 'select', options: ['Government Agency','NGO','Police','Self-Referral','Community','Court Order'] },
    { key: 'referring_agency_person', label: 'Referring Agency/Person', type: 'text' },
    { key: 'initial_risk_level', label: 'Initial Risk Level', type: 'select', options: ['Low','Medium','High','Critical'] },
    { key: 'current_risk_level', label: 'Current Risk Level', type: 'select', options: ['Low','Medium','High','Critical'] },
    { key: 'reintegration_type', label: 'Reintegration Type', type: 'select', options: ['Family Reunification','Foster Care','Adoption (Domestic)','Adoption (Inter-Country)','Independent Living','None'] },
    { key: 'reintegration_status', label: 'Reintegration Status', type: 'select', options: ['Not Started','In Progress','Completed','On Hold'] },
  ]

  const rows = data[tab]
  const filtered = rows.filter((r) => {
    const matchSearch = Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(search.toLowerCase()))
    if (tab !== 'residents') return matchSearch
    const matchStatus = !filterStatus || r.case_status === filterStatus
    const matchCategory = !filterCategory || r.case_category === filterCategory
    const matchSafehouse = !filterSafehouse || String(r.safehouse_id) === filterSafehouse
    const matchReadiness = !filterReadiness || readinessScores.get(Number(r.resident_id))?.readinessTier === filterReadiness
    return matchSearch && matchStatus && matchCategory && matchSafehouse && matchReadiness
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1)
  const currentPage = Math.min(page, totalPages)
  const pagedRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [tab, search, filterStatus, filterCategory, filterSafehouse, filterReadiness])

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const resetFilters = () => { setFilterStatus(''); setFilterCategory(''); setFilterSafehouse(''); setFilterReadiness('') }

  const renderCard = (r: Row, rk: string) => {
    switch (tab) {
      case 'residents': {
        return (
          <button
            key={rk}
            type="button"
            className="p-card p-card--clickable p-card--button"
            onClick={() => navigate(`/participants/${r.resident_id}`)}
            aria-label={`Open resident ${String(r.internal_code ?? r.resident_id ?? '')}`}
          >
            <div className="p-card-header">
              <span className="p-code">{String(r.internal_code ?? '—')}</span>
              <div className="p-card-badges">
                <span className={`status-badge status-${String(r.case_status ?? '').toLowerCase()}`}>{String(r.case_status ?? '—')}</span>
              </div>
            </div>
            <div className="p-card-body">
              <div className="p-field"><span className="field-label">Category</span><span>{String(r.case_category ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Risk Level</span><span>{String(r.current_risk_level ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Social Worker</span><span>{String(r.assigned_social_worker ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Admitted</span><span>{String(r.date_of_admission ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Reintegration</span><span>{String(r.reintegration_status ?? '—')}</span></div>
            </div>
            <div className="p-card-footer">View full record →</div>
          </button>
        )
      }
      case 'process':
        return (
          <div key={rk} className="p-card">
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
          <div key={rk} className="p-card">
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
          <div key={rk} className="p-card">
            <div className="p-card-header">
              <span className="p-code">{String(r.record_date ?? '—')}</span>
              <span className="meta-tag">{String(r.program_name ?? r.education_level ?? '—')}</span>
            </div>
            <div className="p-card-body">
              <div className="p-field"><span className="field-label">School</span><span>{String(r.school_name ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Level</span><span>{String(r.education_level ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Attendance</span><span>{String(r.attendance_status ?? r.enrollment_status ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Progress</span><span>{Number(r.progress_percent ?? 0).toFixed(1)}%</span></div>
              <div className="p-field"><span className="field-label">Status</span><span>{String(r.completion_status ?? '—')}</span></div>
            </div>
          </div>
        )
      case 'health':
        return (
          <div key={rk} className="p-card">
            <div className="p-card-header">
              <span className="p-code">{String(r.record_date ?? '—')}</span>
              <span className="meta-tag">BMI: {String(r.bmi ?? '—')}</span>
            </div>
            <div className="p-card-body">
              <div className="p-field"><span className="field-label">Weight</span><span>{String(r.weight_kg ?? '—')} kg</span></div>
              <div className="p-field"><span className="field-label">Height</span><span>{String(r.height_cm ?? '—')} cm</span></div>
              <div className="p-field"><span className="field-label">Nutrition</span><span>{String(r.nutrition_score ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Sleep</span><span>{String(r.sleep_quality_score ?? r.sleep_score ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">Energy</span><span>{String(r.energy_level_score ?? r.energy_score ?? '—')}</span></div>
              <div className="p-field"><span className="field-label">General Health</span><span>{String(r.general_health_score ?? '—')}</span></div>
            </div>
          </div>
        )
      case 'interventions':
        return (
          <div key={rk} className="p-card">
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
          <div key={rk} className="p-card">
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

  const handleDeleteSupporter = async () => {
    const id = Number(deleteSupporterId)
    if (!Number.isInteger(id) || id <= 0) {
      setDeleteMessage('Enter a valid supporter ID (positive integer).')
      return
    }

    const confirmed = window.confirm(`Delete supporter #${id}? This action cannot be undone.`)
    if (!confirmed) return

    setDeleting(true)
    setDeleteMessage(null)
    try {
      await deleteSupporter(id)
      setDeleteMessage(`Supporter #${id} deleted.`)
      setDeleteSupporterId('')
    } catch (err: unknown) {
      setDeleteMessage(err instanceof Error ? err.message : 'Delete failed.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <main className="participants-page">
      {showAddResident && (
        <FormModal
          title="Add New Resident"
          fields={residentFields}
          onSave={async (d) => { await insertRow('residents', d); setRefreshKey(k => k + 1) }}
          onClose={() => setShowAddResident(false)}
        />
      )}

      <div className="participants-header">
        <button className="pp-back-btn" onClick={() => navigate('/')}>← Back</button>
        <h1>Caseload inventory</h1>
        <p className="subtitle">
            Resident records, process notes, visitations, and plans — filter by status, safehouse, and category; open a
            resident for full detail.
        </p>
      </div>

      <div className="participants-controls">
        <input
          className="search-input"
          type="number"
          min={1}
          step={1}
          placeholder="Supporter ID to delete (staff/admin demo)"
          value={deleteSupporterId}
          onChange={(e) => setDeleteSupporterId(e.target.value)}
        />
        <button className="tab-btn" onClick={() => void handleDeleteSupporter()} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Delete supporter'}
        </button>
        {deleteMessage ? <span className="count">{deleteMessage}</span> : null}
      </div>

      <div className="tab-scroll">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); setSearch(''); setPage(1); resetFilters() }}
          >
            {t.label}
            <span className="tab-count">{data[t.id].length}</span>
          </button>
        ))}
      </div>

      {tab === 'residents' && (
        <div className="pp-filters">
          <select className="pp-filter-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="">All Statuses</option>
            {['Active','Closed','Transferred'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="pp-filter-select" value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }}>
            <option value="">All Categories</option>
            {['Abandoned','Foundling','Surrendered','Neglected'].map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="pp-filter-select" value={filterSafehouse} onChange={e => { setFilterSafehouse(e.target.value); setPage(1) }}>
            <option value="">All Safehouses</option>
            {safehouses.map(s => <option key={String(s.safehouse_id)} value={String(s.safehouse_id)}>{String(s.name)}</option>)}
          </select>
          {readinessScores.size > 0 && (
            <select className="pp-filter-select" value={filterReadiness} onChange={e => { setFilterReadiness(e.target.value); setPage(1) }}>
              <option value="">All Readiness Tiers</option>
              <option value="High Readiness">High Readiness</option>
              <option value="Moderate Readiness">Moderate Readiness</option>
              <option value="Needs Support">Needs Support</option>
            </select>
          )}
          <button className="pp-add-btn" onClick={() => setShowAddResident(true)}>+ Add Resident</button>
        </div>
      )}

      <div className="participants-controls">
        <input
          className="search-input"
          type="text"
          placeholder="Search across all fields..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <span className="count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p className="state-msg">Loading...</p>}
      {error && <p className="state-msg error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="residents-grid" aria-describedby="participants-pagination-nav">
            {pagedRows.map((r) => renderCard(r, participantRowKey(tab, r)))}
            {filtered.length === 0 && <p className="state-msg">No records match your search.</p>}
          </div>
          {filtered.length > 0 && (
            <PaginationBar
              page={currentPage}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n)
                setPage(1)
              }}
              labelId="participants-pagination"
            />
          )}
        </>
      )}
    </main>
  )
}
