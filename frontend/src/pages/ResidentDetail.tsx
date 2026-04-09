import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  getResidents,
  getProcessRecordings,
  getHomeVisitations,
  getEducationRecords,
  getHealthRecords,
  getInterventionPlans,
  getIncidentReports,
  getResidentReadinessScore,
  getResidentRegressionRisk,
  getInterventionEffectiveness,
} from '../api/residents'
import type { ReadinessScore, RegressionRisk, InterventionEffectiveness } from '../api/residents'
import { getSafehouses } from '../api/safehouses'
import { insertRow, updateRow } from '../api/tables'
import FormModal from '../components/FormModal'
import type { FieldDef } from '../components/FormModal'
import './ResidentDetail.css'

type Row = Record<string, unknown>
type Tab = 'overview' | 'process' | 'visitations' | 'conferences' | 'education' | 'health' | 'interventions' | 'incidents'

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview',      label: 'Overview' },
  { id: 'process',       label: 'Process Recordings' },
  { id: 'visitations',   label: 'Home Visitations' },
  { id: 'conferences',   label: 'Case Conferences' },
  { id: 'education',     label: 'Education' },
  { id: 'health',        label: 'Health' },
  { id: 'interventions', label: 'Intervention Plans' },
  { id: 'incidents',     label: 'Incidents' },
]

// Field definitions per tab
const PROCESS_FIELDS: FieldDef[] = [
  { key: 'session_date', label: 'Session Date', type: 'date', required: true },
  { key: 'social_worker', label: 'Social Worker', type: 'text' },
  { key: 'session_type', label: 'Session Type', type: 'select', options: ['Individual', 'Group'], required: true },
  { key: 'session_duration_minutes', label: 'Duration (minutes)', type: 'number' },
  { key: 'emotional_state_observed', label: 'Emotional State (Start)', type: 'select', options: ['Calm','Anxious','Sad','Angry','Hopeful','Withdrawn','Happy','Distressed'] },
  { key: 'emotional_state_end', label: 'Emotional State (End)', type: 'select', options: ['Calm','Anxious','Sad','Angry','Hopeful','Withdrawn','Happy','Distressed'] },
  { key: 'session_narrative', label: 'Session Narrative', type: 'textarea' },
  { key: 'interventions_applied', label: 'Interventions Applied', type: 'textarea' },
  { key: 'follow_up_actions', label: 'Follow-up Actions', type: 'textarea' },
  { key: 'progress_noted', label: 'Progress Noted', type: 'checkbox' },
  { key: 'concerns_flagged', label: 'Concerns Flagged', type: 'checkbox' },
  { key: 'referral_made', label: 'Referral Made', type: 'checkbox' },
]

const VISITATION_FIELDS: FieldDef[] = [
  { key: 'visit_date', label: 'Visit Date', type: 'date', required: true },
  { key: 'social_worker', label: 'Social Worker', type: 'text' },
  { key: 'visit_type', label: 'Visit Type', type: 'select', required: true, options: ['Initial Assessment','Routine Follow-Up','Reintegration Assessment','Post-Placement Monitoring','Emergency'] },
  { key: 'location_visited', label: 'Location Visited', type: 'text' },
  { key: 'family_members_present', label: 'Family Members Present', type: 'text' },
  { key: 'purpose', label: 'Purpose', type: 'text' },
  { key: 'observations', label: 'Observations', type: 'textarea' },
  { key: 'family_cooperation_level', label: 'Family Cooperation', type: 'select', options: ['Highly Cooperative','Cooperative','Neutral','Uncooperative'] },
  { key: 'safety_concerns_noted', label: 'Safety Concerns Noted', type: 'checkbox' },
  { key: 'follow_up_needed', label: 'Follow-up Needed', type: 'checkbox' },
  { key: 'follow_up_notes', label: 'Follow-up Notes', type: 'textarea' },
  { key: 'visit_outcome', label: 'Visit Outcome', type: 'select', options: ['Favorable','Needs Improvement','Unfavorable','Inconclusive'] },
]

const INTERVENTION_FIELDS: FieldDef[] = [
  { key: 'plan_category', label: 'Plan Category', type: 'select', required: true, options: ['Safety','Psychosocial','Education','Physical Health','Legal','Reintegration'] },
  { key: 'plan_description', label: 'Plan Description', type: 'textarea', required: true },
  { key: 'services_provided', label: 'Services Provided', type: 'text' },
  { key: 'target_date', label: 'Target Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', required: true, options: ['Open','In Progress','Achieved','On Hold','Closed'] },
  { key: 'case_conference_date', label: 'Case Conference Date', type: 'date' },
]

const CONFERENCE_FIELDS: FieldDef[] = [
  { key: 'case_conference_date', label: 'Conference Date', type: 'date', required: true },
  { key: 'plan_category', label: 'Plan Category', type: 'select', required: true, options: ['Safety','Psychosocial','Education','Physical Health','Legal','Reintegration'] },
  { key: 'plan_description', label: 'Plan Description', type: 'textarea', required: true },
  { key: 'services_provided', label: 'Services Provided', type: 'text' },
  { key: 'target_date', label: 'Target Date', type: 'date' },
  { key: 'status', label: 'Status', type: 'select', required: true, options: ['Open','In Progress','Achieved','On Hold','Closed'] },
]

const EDUCATION_FIELDS: FieldDef[] = [
  { key: 'record_date', label: 'Record Date', type: 'date', required: true },
  { key: 'education_level', label: 'Education Level', type: 'text', required: true },
  { key: 'school_name', label: 'School Name', type: 'text' },
  { key: 'enrollment_status', label: 'Enrollment Status', type: 'text' },
  { key: 'attendance_rate', label: 'Attendance Rate (%)', type: 'number' },
  { key: 'progress_percent', label: 'Progress (%)', type: 'number' },
  { key: 'completion_status', label: 'Completion Status', type: 'text', required: true },
  { key: 'notes', label: 'Notes', type: 'textarea' },
]

const HEALTH_FIELDS: FieldDef[] = [
  { key: 'record_date', label: 'Record Date', type: 'date', required: true },
  { key: 'height_cm', label: 'Height (cm)', type: 'number' },
  { key: 'weight_kg', label: 'Weight (kg)', type: 'number' },
  { key: 'bmi', label: 'BMI', type: 'number' },
  { key: 'general_health_score', label: 'General Health Score', type: 'number' },
  { key: 'nutrition_score', label: 'Nutrition Score', type: 'number' },
  { key: 'sleep_quality_score', label: 'Sleep Quality Score', type: 'number' },
  { key: 'energy_level_score', label: 'Energy Level Score', type: 'number' },
  { key: 'medical_checkup_done', label: 'Medical Checkup Done', type: 'checkbox' },
  { key: 'dental_checkup_done', label: 'Dental Checkup Done', type: 'checkbox' },
  { key: 'psychological_checkup_done', label: 'Psychological Checkup Done', type: 'checkbox' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
]

const INCIDENT_FIELDS: FieldDef[] = [
  { key: 'incident_date', label: 'Incident Date', type: 'date', required: true },
  { key: 'incident_type', label: 'Incident Type', type: 'select', required: true, options: ['Behavioral','Medical','Security','RunawayAttempt','SelfHarm','ConflictWithPeer','PropertyDamage'] },
  { key: 'severity', label: 'Severity', type: 'select', required: true, options: ['Low','Medium','High'] },
  { key: 'description', label: 'Description', type: 'textarea' },
  { key: 'response_taken', label: 'Response Taken', type: 'textarea' },
  { key: 'reported_by', label: 'Reported By', type: 'text' },
  { key: 'resolved', label: 'Resolved', type: 'checkbox' },
  { key: 'resolution_date', label: 'Resolution Date', type: 'date' },
  { key: 'follow_up_required', label: 'Follow-up Required', type: 'checkbox' },
]

const OVERVIEW_FIELDS: FieldDef[] = [
  { key: 'case_control_no', label: 'Case Control No', type: 'text', required: true },
  { key: 'internal_code', label: 'Internal Code', type: 'text', required: true },
  { key: 'case_status', label: 'Case Status', type: 'select', required: true, options: ['Active','Closed','Transferred'] },
  { key: 'case_category', label: 'Case Category', type: 'select', required: true, options: ['Abandoned','Foundling','Surrendered','Neglected'] },
  { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
  { key: 'birth_status', label: 'Birth Status', type: 'select', options: ['Marital','Non-Marital'] },
  { key: 'place_of_birth', label: 'Place of Birth', type: 'text' },
  { key: 'religion', label: 'Religion', type: 'text' },
  { key: 'date_of_admission', label: 'Date of Admission', type: 'date' },
  { key: 'age_upon_admission', label: 'Age on Admission', type: 'text' },
  { key: 'present_age', label: 'Present Age', type: 'text' },
  { key: 'assigned_social_worker', label: 'Assigned Social Worker', type: 'text' },
  { key: 'referral_source', label: 'Referral Source', type: 'select', options: ['Government Agency','NGO','Police','Self-Referral','Community','Court Order'] },
  { key: 'referring_agency_person', label: 'Referring Agency/Person', type: 'text' },
  { key: 'initial_risk_level', label: 'Initial Risk Level', type: 'select', options: ['Low','Medium','High','Critical'] },
  { key: 'current_risk_level', label: 'Current Risk Level', type: 'select', options: ['Low','Medium','High','Critical'] },
  { key: 'reintegration_type', label: 'Reintegration Type', type: 'select', options: ['Family Reunification','Foster Care','Adoption (Domestic)','Adoption (Inter-Country)','Independent Living','None'] },
  { key: 'reintegration_status', label: 'Reintegration Status', type: 'select', options: ['Not Started','In Progress','Completed','On Hold'] },
  { key: 'date_closed', label: 'Date Closed', type: 'date' },
]

function Field({ label, value }: { label: string; value: unknown }) {
  const v = value == null || value === '' ? '—' : String(value)
  return (
    <div className="rd-field">
      <span className="rd-field-label">{label}</span>
      <span className="rd-field-value">{v}</span>
    </div>
  )
}

function Badge({ text, variant }: { text: string; variant?: string }) {
  return <span className={`rd-badge rd-badge--${variant ?? text.toLowerCase().replace(/\s+/g, '-')}`}>{text}</span>
}

type FormState = { fields: FieldDef[]; table: string; pk?: number; initial?: Row }

// ── Clinical assessment display helpers ───────────────────────────────────────

// Readiness: format a raw feature value into a human-readable string
function formatReadinessValue(rawKey: string, value: number): string {
  switch (rawKey) {
    case 'session_count':
      return `${value} session${value !== 1 ? 's' : ''} on record`
    case 'progress_noted_rate':
      return `${Math.round(value * 100)}% of sessions showed progress`
    case 'avg_session_improvement':
      return value >= 0
        ? `+${value.toFixed(1)} avg emotional improvement per session`
        : `${value.toFixed(1)} avg emotional change per session`
    case 'favorable_visit_rate':
      return `${Math.round(value * 100)}% of home visits were favorable`
    case 'avg_education_progress':
      return `${value.toFixed(0)}% average education progress`
    case 'avg_health_score':
      return `${value.toFixed(1)} / 10 general health score`
    case 'incident_count':
      return `${value} incident${value !== 1 ? 's' : ''} on record`
    case 'has_reintegration_plan':
      return value >= 1 ? 'Reintegration plan is active' : 'No reintegration plan on file'
    case 'avg_cooperation_score':
      return `${value.toFixed(1)} / 4 family cooperation score`
    default:
      return String(value)
  }
}

// Readiness: reinforcement note for a positive strength
function getReinforceNote(rawKey: string): string {
  switch (rawKey) {
    case 'session_count':
      return 'Consistent attendance is building therapeutic trust — keep sessions scheduled regularly.'
    case 'progress_noted_rate':
      return 'A high session progress rate is one of the strongest readiness signals — continue reinforcing these gains.'
    case 'avg_session_improvement':
      return 'Emotional improvement across sessions indicates the current interventions are working — maintain this approach.'
    case 'favorable_visit_rate':
      return 'Favorable home visits are strongly associated with successful reintegration — maintain visit frequency and quality.'
    case 'avg_education_progress':
      return 'Strong education progress supports long-term independence — continue current academic engagement and support.'
    case 'avg_health_score':
      return 'Good health scores support overall wellbeing — continue current health routines and checkup schedule.'
    case 'incident_count':
      return 'Low incident count reflects behavioral stability — actively reinforce the positive behavior patterns driving this.'
    case 'has_reintegration_plan':
      return 'An active reintegration plan is directly associated with successful outcomes — continue executing and updating the plan.'
    case 'avg_cooperation_score':
      return 'Strong family cooperation is one of the most important reintegration factors — nurture and document this relationship.'
    default:
      return 'Continue the current approach in this area.'
  }
}

// Regression risk: format a raw risk feature value
function formatRiskValue(rawKey: string, value: number): string {
  switch (rawKey) {
    case 'total_incidents':
      return `${value} total incident${value !== 1 ? 's' : ''} on record`
    case 'recent_incidents':
      return `${value} incident${value !== 1 ? 's' : ''} in the last 90 days`
    case 'max_incident_severity':
      return value >= 3 ? 'Highest severity: High' : value >= 2 ? 'Highest severity: Medium' : 'Highest severity: Low'
    case 'recent_max_severity':
      return value >= 3 ? 'Recent highest severity: High' : value >= 2 ? 'Recent highest: Medium' : value > 0 ? 'Recent highest: Low' : 'No recent incidents'
    case 'has_safety_concern':
      return value >= 1 ? 'Safety concern flagged during a home visit' : 'No safety concerns noted'
    case 'emotion_volatility':
      return `${value.toFixed(2)} emotional volatility score`
    case 'avg_emotion_score':
      return `${value.toFixed(1)} / 7 average emotional state`
    case 'avg_family_coop':
      return `${value.toFixed(1)} / 4 average family cooperation`
    case 'is_enrolled':
      return value >= 1 ? 'Currently enrolled in education' : 'Not currently enrolled in school'
    case 'session_count':
      return `${value} total counseling session${value !== 1 ? 's' : ''}`
    case 'recent_session_count':
      return `${value} session${value !== 1 ? 's' : ''} in the last 90 days`
    case 'avg_health_score':
      return `${value.toFixed(1)} / 10 average health score`
    default:
      return String(value)
  }
}

// Regression risk: actionable guidance for a risk factor
function getRiskActionNote(rawKey: string): string {
  switch (rawKey) {
    case 'total_incidents':
      return 'Review incident patterns and address root causes through targeted behavioral interventions.'
    case 'recent_incidents':
      return 'Recent incidents require immediate follow-up — increase monitoring and consider crisis support sessions.'
    case 'max_incident_severity':
      return 'Ensure all high-severity incidents have documented response plans and confirmed resolution follow-up.'
    case 'recent_max_severity':
      return 'A high-severity recent incident warrants urgent case conference review before next steps.'
    case 'has_safety_concern':
      return 'Home visit safety concerns must be fully addressed and documented before reintegration can safely proceed.'
    case 'emotion_volatility':
      return 'Emotional instability may benefit from more consistent session scheduling and structured therapeutic routines.'
    case 'avg_emotion_score':
      return 'Low average emotional state suggests current interventions may need adjustment — review session approach with supervisor.'
    case 'avg_family_coop':
      return 'Low family cooperation is a major regression risk — prioritize family engagement through structured visits and counseling.'
    case 'is_enrolled':
      return 'Re-enrolling this resident in school provides structure, routine, and a key protective environment.'
    case 'session_count':
      return 'Increasing counseling session frequency builds therapeutic history and strengthens protective factors.'
    case 'recent_session_count':
      return 'Scheduling more sessions in the near term improves engagement during this at-risk period.'
    case 'avg_health_score':
      return 'Health concerns can compound regression risk — schedule checkups and address any outstanding medical needs.'
    default:
      return 'Discuss this risk factor with the assigned social worker at the next case conference.'
  }
}

// Intervention effectiveness: staff note for status + top domain
function getInterventionNote(statusLabel: string, topDomain: string | null): string {
  if (statusLabel === 'IMPROVING') {
    switch (topDomain) {
      case 'emotion':   return 'Strong emotional gains — reinforce by maintaining session frequency and acknowledging progress explicitly.'
      case 'health':    return 'Health is trending up — continue current wellness support and document improvements for case reports.'
      case 'education': return 'Educational engagement is the top strength — keep school routines stable as a foundation for other recovery.'
      default:          return 'Positive trajectory across domains — maintain the current intervention mix and document what is working.'
    }
  }
  if (statusLabel === 'ON TRACK') {
    switch (topDomain) {
      case 'emotion':   return 'Emotional progress is steady — consider adding a group counseling session to build on individual gains.'
      case 'health':    return 'Health is stable — introduce regular physical activity to support continued improvement.'
      case 'education': return 'Education is the strongest domain — leverage school success to build confidence in other areas.'
      default:          return 'Progress is on track — review plan completion rates and address any incomplete goals before the next case conference.'
    }
  }
  // REVIEW NEEDED
  switch (topDomain) {
    case 'emotion':   return 'Emotional state is a primary concern — increase session frequency and consult a trauma-informed specialist if available.'
    case 'health':    return 'Health scores are declining — schedule a medical check and review nutrition and sleep routines.'
    case 'education': return 'Educational engagement is low — coordinate with school staff to reduce barriers to attendance.'
    default:          return 'Multiple domains need attention — prioritize a full case review with the team to reset intervention goals.'
  }
}

function interventionStatusKey(s: string): string {
  if (s === 'IMPROVING')   return 'improving'
  if (s === 'ON TRACK')    return 'on-track'
  if (s === 'REVIEW NEEDED') return 'review'
  return 'insufficient'
}

export default function ResidentDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('overview')
  const [refreshKey, setRefreshKey] = useState(0)

  const [resident, setResident] = useState<Row | null>(null)
  const [safehouses, setSafehouses] = useState<Row[]>([])
  const [process, setProcess] = useState<Row[]>([])
  const [visitations, setVisitations] = useState<Row[]>([])
  const [education, setEducation] = useState<Row[]>([])
  const [health, setHealth] = useState<Row[]>([])
  const [plans, setPlans] = useState<Row[]>([])
  const [incidents, setIncidents] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formState, setFormState] = useState<FormState | null>(null)
  const [readinessScore, setReadinessScore] = useState<ReadinessScore | null>(null)
  const [regressionRisk, setRegressionRisk] = useState<RegressionRisk | null>(null)
  const [interventionEff, setInterventionEff] = useState<InterventionEffectiveness | null>(null)

  useEffect(() => {
    setLoading(true)
    setReadinessScore(null)
    setRegressionRisk(null)
    setInterventionEff(null)
    Promise.all([
      getResidents(),
      getSafehouses(),
      getProcessRecordings(),
      getHomeVisitations(),
      getEducationRecords(),
      getHealthRecords(),
      getInterventionPlans(),
      getIncidentReports(),
    ])
      .then(([residents, sh, pr, vis, edu, hlt, ipl, inc]) => {
        const found = residents.find(r => String(r.resident_id) === id)
        if (!found) { setError('Resident not found.'); return }
        setResident(found)
        setSafehouses(sh)
        const rid = found.resident_id
        setProcess(pr.filter(r => r.resident_id === rid).sort((a, b) => String(b.session_date).localeCompare(String(a.session_date))))
        setVisitations(vis.filter(r => r.resident_id === rid).sort((a, b) => String(b.visit_date).localeCompare(String(a.visit_date))))
        setEducation(edu.filter(r => r.resident_id === rid).sort((a, b) => String(b.record_date).localeCompare(String(a.record_date))))
        setHealth(hlt.filter(r => r.resident_id === rid).sort((a, b) => String(b.record_date).localeCompare(String(a.record_date))))
        setPlans(ipl.filter(r => r.resident_id === rid).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))))
        setIncidents(inc.filter(r => r.resident_id === rid).sort((a, b) => String(b.incident_date).localeCompare(String(a.incident_date))))

        // Load ML scores independently — silently ignored if not staff/admin
        const rid_ = Number(rid)
        getResidentReadinessScore(rid_).then(setReadinessScore).catch(() => {})
        getResidentRegressionRisk(rid_).then(setRegressionRisk).catch(() => {})
        getInterventionEffectiveness(rid_).then(setInterventionEff).catch(() => {})
      })
      .catch(() => setError('Failed to load resident data.'))
      .finally(() => setLoading(false))
  }, [id, refreshKey])

  const safehouseName = useMemo(() => {
    const sh = safehouses.find(s => s.safehouse_id === resident?.safehouse_id)
    return sh ? String(sh.name ?? '—') : '—'
  }, [safehouses, resident])

  const conferences = useMemo(() => plans.filter(p => p.case_conference_date), [plans])
  const upcomingConferences = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return conferences.filter(p => String(p.case_conference_date) >= today)
  }, [conferences])

  const counts: Record<Tab, number> = {
    overview: 0, process: process.length, visitations: visitations.length,
    conferences: conferences.length, education: education.length,
    health: health.length, interventions: plans.length, incidents: incidents.length,
  }

  const openForm = (fields: FieldDef[], table: string, record?: Row, pkKey?: string) => {
    const pk = pkKey && record ? Number(record[pkKey]) : undefined
    setFormState({ fields, table, pk, initial: record })
  }

  const handleSave = async (data: Record<string, unknown>) => {
    if (!formState) return
    if (formState.pk !== undefined) {
      await updateRow(formState.table, formState.pk, data)
    } else {
      const payload: Record<string, unknown> = { ...data, resident_id: Number(id) }
      if (formState.table === 'incident_reports' && resident) {
        payload.safehouse_id = resident.safehouse_id
      }
      await insertRow(formState.table, payload)
    }
    setRefreshKey(k => k + 1)
  }

  if (loading) return <main className="resident-detail"><p className="rd-state">Loading…</p></main>
  if (error || !resident) return <main className="resident-detail"><p className="rd-state error">{error ?? 'Not found.'}</p></main>

  return (
    <main className="resident-detail">
      {formState && (
        <FormModal
          title={formState.pk !== undefined ? `Edit ${formState.table.replace(/_/g, ' ')}` : `Add ${formState.table.replace(/_/g, ' ')}`}
          fields={formState.fields}
          initialData={formState.initial}
          onSave={handleSave}
          onClose={() => setFormState(null)}
        />
      )}

      <div className="rd-header">
        <button className="rd-back" onClick={() => navigate('/participants')}>← Back to Participants</button>
        <div className="rd-title-row">
          <div>
            <h1 className="rd-title">{String(resident.internal_code ?? '—')}</h1>
            <p className="rd-subtitle">
              Case #{String(resident.case_control_no ?? '—')} · {safehouseName} — process recordings, home visitations,
              and case conferences are documented below.
            </p>
          </div>
          <div className="rd-badges">
            <Badge text={String(resident.case_status ?? '—')} />
            {!!resident.current_risk_level && <Badge text={String(resident.current_risk_level)} variant={`risk-${String(resident.current_risk_level).toLowerCase()}`} />}
            <button className="rd-edit-btn" onClick={() => openForm(OVERVIEW_FIELDS, 'residents', resident, 'resident_id')}>Edit Resident</button>
          </div>
        </div>
      </div>

      <div className="rd-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`rd-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
            {counts[t.id] > 0 && <span className="rd-tab-count">{counts[t.id]}</span>}
          </button>
        ))}
      </div>

      <div className="rd-content">

        {tab === 'overview' && (
          <div className="rd-sections">
            <section className="rd-section">
              <h2>Case Details</h2>
              <div className="rd-fields">
                <Field label="Case Category" value={resident.case_category} />
                <Field label="Case Status" value={resident.case_status} />
                <Field label="Initial Risk Level" value={resident.initial_risk_level} />
                <Field label="Current Risk Level" value={resident.current_risk_level} />
                <Field label="Assigned Social Worker" value={resident.assigned_social_worker} />
                <Field label="Referral Source" value={resident.referral_source} />
                <Field label="Referring Agency/Person" value={resident.referring_agency_person} />
                <Field label="Date Admitted" value={resident.date_of_admission} />
                <Field label="Age on Admission" value={resident.age_upon_admission} />
                <Field label="Present Age" value={resident.present_age} />
                <Field label="Length of Stay" value={resident.length_of_stay} />
                <Field label="Date Enrolled" value={resident.date_enrolled} />
                <Field label="Date Closed" value={resident.date_closed} />
              </div>
            </section>
            <section className="rd-section">
              <h2>Demographics</h2>
              <div className="rd-fields">
                <Field label="Date of Birth" value={resident.date_of_birth} />
                <Field label="Birth Status" value={resident.birth_status} />
                <Field label="Place of Birth" value={resident.place_of_birth} />
                <Field label="Religion" value={resident.religion} />
                <Field label="COLB Registered" value={resident.date_colb_registered} />
                <Field label="COLB Obtained" value={resident.date_colb_obtained} />
              </div>
            </section>
            <section className="rd-section">
              <h2>Case Sub-categories</h2>
              <div className="rd-flags">
                {([['Orphaned','sub_cat_orphaned'],['Trafficked','sub_cat_trafficked'],['Child Labor','sub_cat_child_labor'],['Physical Abuse','sub_cat_physical_abuse'],['Sexual Abuse','sub_cat_sexual_abuse'],['OSAEC','sub_cat_osaec'],['CICL','sub_cat_cicl'],['At Risk','sub_cat_at_risk'],['Street Child','sub_cat_street_child'],['Child w/ HIV','sub_cat_child_with_hiv']] as [string, string][]).map(([label, key]) => (
                  <span key={key} className={`rd-flag${resident[key] ? ' active' : ''}`}>{label}</span>
                ))}
              </div>
            </section>
            <section className="rd-section">
              <h2>Family Socio-Demographic Profile</h2>
              <div className="rd-flags">
                {([['4Ps Beneficiary','family_is_4ps'],['Solo Parent','family_solo_parent'],['Indigenous Group','family_indigenous'],['Parent w/ PWD','family_parent_pwd'],['Informal Settler','family_informal_settler']] as [string, string][]).map(([label, key]) => (
                  <span key={key} className={`rd-flag${resident[key] ? ' active' : ''}`}>{label}</span>
                ))}
              </div>
            </section>
            <section className="rd-section">
              <h2>Disability</h2>
              <div className="rd-fields">
                <Field label="PWD" value={resident.is_pwd ? 'Yes' : 'No'} />
                <Field label="PWD Type" value={resident.pwd_type} />
                <Field label="Special Needs" value={resident.has_special_needs ? 'Yes' : 'No'} />
                <Field label="Diagnosis" value={resident.special_needs_diagnosis} />
              </div>
            </section>
            <section className="rd-section">
              <h2>Reintegration</h2>
              <div className="rd-fields">
                <Field label="Type" value={resident.reintegration_type} />
                <Field label="Status" value={resident.reintegration_status} />
                <Field label="Initial Assessment" value={resident.initial_case_assessment} />
              </div>
            </section>

            {(readinessScore || regressionRisk || interventionEff) && (() => {
              const readTier    = readinessScore?.readinessTier
              const readTierKey = readTier === 'High Readiness' ? 'high' : readTier === 'Moderate Readiness' ? 'moderate' : 'low'
              const readPct     = readinessScore ? Math.round(readinessScore.readinessScore * 100) : null

              const riskTier    = regressionRisk?.riskTier
              const riskTierKey = riskTier === 'High Risk' ? 'high' : riskTier === 'Moderate Risk' ? 'moderate' : 'stable'
              const riskPct     = regressionRisk ? Math.round(regressionRisk.riskScore * 100) : null

              const strengths  = readinessScore?.topDrivers.filter(d => d.direction === 'positive') ?? []
              const focusAreas = regressionRisk?.topRiskDrivers ?? []

              return (
                <section className="rd-section rd-section--highlight">
                  <h2>Clinical Assessment</h2>
                  <p className="rd-readiness-explainer">
                    Three ML models assess this resident's current standing: reintegration readiness
                    (how prepared they are for successful reintegration), regression risk (whether
                    behavioral or emotional decline is likely), and intervention effectiveness (whether
                    current support programs are producing measurable cross-domain progress). Together
                    they surface both strengths to reinforce and active risks to address.
                  </p>

                  {readinessScore && readPct !== null && (
                    <div className="rd-score-block">
                      <div className="rd-score-block-header">
                        <span className="rd-score-block-label">Reintegration Readiness</span>
                        <span className={`rd-readiness-tier-badge rd-readiness-tier-badge--${readTierKey}`}>{readTier}</span>
                      </div>
                      <div className="rd-readiness-score-row">
                        <span className="rd-readiness-pct">{readPct}%</span>
                        <div className="rd-score-bar-track">
                          <div className={`rd-score-bar-fill rd-score-bar-fill--${readTierKey}`} style={{ width: `${readPct}%` }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {strengths.length > 0 && (
                    <div className="rd-driver-group">
                      <p className="rd-driver-group-label rd-driver-group-label--positive">Strengths supporting readiness</p>
                      {strengths.map(d => (
                        <div key={d.rawKey} className="rd-driver-row rd-driver-row--strength">
                          <span className="rd-driver-icon rd-driver-icon--positive">✓</span>
                          <div className="rd-driver-text">
                            <span className="rd-driver-feature">{d.feature}</span>
                            <span className="rd-driver-value">{formatReadinessValue(d.rawKey, d.value)}</span>
                            <span className="rd-driver-reinforce">{getReinforceNote(d.rawKey)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {regressionRisk && riskPct !== null && (
                    <div className="rd-score-block">
                      <div className="rd-score-block-header">
                        <span className="rd-score-block-label">Regression Risk</span>
                        <span className={`rd-readiness-tier-badge rd-risk-tier-badge--${riskTierKey}`}>{riskTier}</span>
                      </div>
                      <div className="rd-readiness-score-row">
                        <span className="rd-readiness-pct">{riskPct}%</span>
                        <div className="rd-score-bar-track">
                          <div className={`rd-score-bar-fill rd-risk-bar-fill--${riskTierKey}`} style={{ width: `${riskPct}%` }} />
                        </div>
                      </div>
                    </div>
                  )}

                  {focusAreas.length > 0 && (
                    <div className="rd-driver-group">
                      <p className="rd-driver-group-label rd-driver-group-label--negative">Active risk factors to address</p>
                      {focusAreas.map(d => (
                        <div key={d.rawKey} className="rd-driver-row rd-driver-row--focus">
                          <span className="rd-driver-icon rd-driver-icon--negative">!</span>
                          <div className="rd-driver-text">
                            <span className="rd-driver-feature">{d.feature}</span>
                            <span className="rd-driver-value">{formatRiskValue(d.rawKey, d.value)}</span>
                            <span className="rd-driver-action">{getRiskActionNote(d.rawKey)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {focusAreas.length === 0 && riskTierKey !== 'stable' && (
                    <div className="rd-no-negatives-note">
                      No single factor is the dominant risk driver — the elevated score reflects a combination
                      of factors still building. Lean into the strengths above and increase engagement
                      across counseling sessions, home visits, and education to reduce risk over time.
                    </div>
                  )}

                  {focusAreas.length === 0 && riskTierKey === 'stable' && strengths.length === 0 && (
                    <div className="rd-no-negatives-note">
                      Both models indicate a stable outlook. Continue current support routines and monitor
                      for any changes in incident frequency, emotional state, or family cooperation.
                    </div>
                  )}

                  {interventionEff && (() => {
                    const statusKey = interventionStatusKey(interventionEff.statusLabel)
                    const isInsufficient = interventionEff.statusLabel === 'INSUFFICIENT DATA'
                    const pct = interventionEff.improvementScore !== null
                      ? Math.round(interventionEff.improvementScore * 100) : null
                    return (
                      <div className="rd-score-block">
                        <div className="rd-score-block-header">
                          <span className="rd-score-block-label">Intervention Effectiveness</span>
                          <span className={`rd-intervention-badge rd-intervention-badge--${statusKey}`}>
                            {isInsufficient ? 'Insufficient Data' : interventionEff.statusLabel}
                          </span>
                        </div>
                        {!isInsufficient && pct !== null && (
                          <div className="rd-readiness-score-row">
                            <span className="rd-readiness-pct">{pct}%</span>
                            <div className="rd-score-bar-track">
                              <div
                                className={`rd-intervention-bar-fill rd-intervention-bar-fill--${statusKey}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {!isInsufficient && interventionEff.topDomainLabel && (
                          <div className="rd-driver-group">
                            <p className="rd-driver-group-label rd-driver-group-label--positive">Strongest domain</p>
                            <div className="rd-driver-row rd-driver-row--strength">
                              <span className="rd-driver-icon rd-driver-icon--positive">✓</span>
                              <div className="rd-driver-text">
                                <span className="rd-driver-feature">{interventionEff.topDomainLabel}</span>
                                <span className="rd-driver-reinforce">
                                  {getInterventionNote(interventionEff.statusLabel, interventionEff.topDomain)}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        {isInsufficient && (
                          <p className="rd-no-negatives-note">
                            At least 2 process recordings are needed to generate a score. Add session records to enable this assessment.
                          </p>
                        )}
                      </div>
                    )
                  })()}

                  <p className="rd-readiness-disclaimer">
                    {readinessScore?.disclaimer ?? regressionRisk?.disclaimer ?? interventionEff?.disclaimer}
                  </p>
                </section>
              )
            })()}
          </div>
        )}

        {tab === 'process' && (
          <>
            <div className="rd-tab-actions">
              <button className="rd-add-btn" onClick={() => openForm(PROCESS_FIELDS, 'process_recordings')}>+ Add Recording</button>
            </div>
            <div className="rd-timeline">
              {process.length === 0 && <p className="rd-empty">No process recordings on file.</p>}
              {process.map((p, i) => (
                <div key={i} className="rd-timeline-item">
                  <div className="rd-timeline-dot" />
                  <div className="rd-timeline-card">
                    <div className="rd-timeline-header">
                      <strong>{String(p.session_date ?? '—')}</strong>
                      <span className="rd-meta">{String(p.session_type ?? '—')} · {String(p.social_worker ?? '—')}</span>
                      <span className="rd-meta">{String(p.session_duration_minutes ?? '—')} min</span>
                      <button className="rd-edit-inline" onClick={() => openForm(PROCESS_FIELDS, 'process_recordings', p, 'recording_id')}>Edit</button>
                    </div>
                    <div className="rd-fields">
                      <Field label="Emotional State (Start)" value={p.emotional_state_observed} />
                      <Field label="Emotional State (End)" value={p.emotional_state_end} />
                      <Field label="Progress Noted" value={p.progress_noted ? 'Yes' : 'No'} />
                      <Field label="Concerns Flagged" value={p.concerns_flagged ? 'Yes' : 'No'} />
                      <Field label="Referral Made" value={p.referral_made ? 'Yes' : 'No'} />
                    </div>
                    {!!p.session_narrative && <p className="rd-narrative"><strong>Narrative:</strong> {String(p.session_narrative)}</p>}
                    {!!p.interventions_applied && <p className="rd-narrative"><strong>Interventions:</strong> {String(p.interventions_applied)}</p>}
                    {!!p.follow_up_actions && <p className="rd-narrative"><strong>Follow-up:</strong> {String(p.follow_up_actions)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'visitations' && (
          <>
            <div className="rd-tab-actions">
              <button className="rd-add-btn" onClick={() => openForm(VISITATION_FIELDS, 'home_visitations')}>+ Add Visitation</button>
            </div>
            <div className="rd-timeline">
              {visitations.length === 0 && <p className="rd-empty">No home visitations on file.</p>}
              {visitations.map((v, i) => (
                <div key={i} className="rd-timeline-item">
                  <div className="rd-timeline-dot" />
                  <div className="rd-timeline-card">
                    <div className="rd-timeline-header">
                      <strong>{String(v.visit_date ?? '—')}</strong>
                      <span className="rd-meta">{String(v.visit_type ?? '—')} · {String(v.social_worker ?? '—')}</span>
                      <button className="rd-edit-inline" onClick={() => openForm(VISITATION_FIELDS, 'home_visitations', v, 'visitation_id')}>Edit</button>
                    </div>
                    <div className="rd-fields">
                      <Field label="Location" value={v.location_visited} />
                      <Field label="Family Members Present" value={v.family_members_present} />
                      <Field label="Family Cooperation" value={v.family_cooperation_level} />
                      <Field label="Safety Concerns" value={v.safety_concerns_noted ? 'Yes' : 'No'} />
                      <Field label="Follow-up Needed" value={v.follow_up_needed ? 'Yes' : 'No'} />
                      <Field label="Outcome" value={v.visit_outcome} />
                    </div>
                    {!!v.observations && <p className="rd-narrative"><strong>Observations:</strong> {String(v.observations)}</p>}
                    {!!v.follow_up_notes && <p className="rd-narrative"><strong>Follow-up Notes:</strong> {String(v.follow_up_notes)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'conferences' && (
          <div className="rd-sections">
            <div className="rd-tab-actions">
              <button className="rd-add-btn" onClick={() => openForm(CONFERENCE_FIELDS, 'intervention_plans')}>+ Add Conference</button>
            </div>
            {upcomingConferences.length > 0 && (
              <section className="rd-section rd-section--highlight">
                <h2>Upcoming Conferences</h2>
                {upcomingConferences.map((p, i) => (
                  <div key={i} className="rd-conf-row">
                    <div>
                      <strong>{String(p.case_conference_date ?? '—')}</strong>
                      <span className="rd-meta"> · {String(p.plan_category ?? '—')}</span>
                    </div>
                    <Badge text={String(p.status ?? '—')} />
                  </div>
                ))}
              </section>
            )}
            <section className="rd-section">
              <h2>All Case Conferences</h2>
              {conferences.length === 0 && <p className="rd-empty">No case conferences recorded.</p>}
              <div className="rd-timeline">
                {conferences.map((p, i) => (
                  <div key={i} className="rd-timeline-item">
                    <div className="rd-timeline-dot" />
                    <div className="rd-timeline-card">
                      <div className="rd-timeline-header">
                        <strong>{String(p.case_conference_date ?? '—')}</strong>
                        <Badge text={String(p.status ?? '—')} />
                        <button className="rd-edit-inline" onClick={() => openForm(CONFERENCE_FIELDS, 'intervention_plans', p, 'plan_id')}>Edit</button>
                      </div>
                      <div className="rd-fields">
                        <Field label="Category" value={p.plan_category} />
                        <Field label="Target Date" value={p.target_date} />
                        <Field label="Services" value={p.services_provided} />
                      </div>
                      {!!p.plan_description && <p className="rd-narrative"><strong>Plan:</strong> {String(p.plan_description)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}

        {tab === 'education' && (
          <>
            <div className="rd-tab-actions">
              <button className="rd-add-btn" onClick={() => openForm(EDUCATION_FIELDS, 'education_records')}>+ Add Education Record</button>
            </div>
            <div className="rd-timeline">
              {education.length === 0 && <p className="rd-empty">No education records on file.</p>}
              {education.map((e, i) => (
                <div key={i} className="rd-timeline-item">
                  <div className="rd-timeline-dot" />
                  <div className="rd-timeline-card">
                    <div className="rd-timeline-header">
                      <strong>{String(e.record_date ?? '—')}</strong>
                      <span className="rd-meta">{String(e.education_level ?? '—')}</span>
                      <button className="rd-edit-inline" onClick={() => openForm(EDUCATION_FIELDS, 'education_records', e, 'education_record_id')}>Edit</button>
                    </div>
                    <div className="rd-fields">
                      <Field label="School" value={e.school_name} />
                      <Field label="Enrollment Status" value={e.enrollment_status} />
                      <Field label="Attendance Rate" value={e.attendance_rate != null ? `${Number(e.attendance_rate).toFixed(1)}%` : null} />
                      <Field label="Progress" value={e.progress_percent != null ? `${Number(e.progress_percent).toFixed(1)}%` : null} />
                      <Field label="Completion Status" value={e.completion_status} />
                    </div>
                    {!!e.notes && <p className="rd-narrative"><strong>Notes:</strong> {String(e.notes)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'health' && (
          <>
            <div className="rd-tab-actions">
              <button className="rd-add-btn" onClick={() => openForm(HEALTH_FIELDS, 'health_wellbeing_records')}>+ Add Health Record</button>
            </div>
            <div className="rd-timeline">
              {health.length === 0 && <p className="rd-empty">No health records on file.</p>}
              {health.map((h, i) => (
                <div key={i} className="rd-timeline-item">
                  <div className="rd-timeline-dot" />
                  <div className="rd-timeline-card">
                    <div className="rd-timeline-header">
                      <strong>{String(h.record_date ?? '—')}</strong>
                      <span className="rd-meta">BMI: {String(h.bmi ?? '—')}</span>
                      <button className="rd-edit-inline" onClick={() => openForm(HEALTH_FIELDS, 'health_wellbeing_records', h, 'health_record_id')}>Edit</button>
                    </div>
                    <div className="rd-fields">
                      <Field label="Height (cm)" value={h.height_cm} />
                      <Field label="Weight (kg)" value={h.weight_kg} />
                      <Field label="General Health" value={h.general_health_score} />
                      <Field label="Nutrition" value={h.nutrition_score} />
                      <Field label="Sleep Quality" value={h.sleep_quality_score} />
                      <Field label="Energy Level" value={h.energy_level_score} />
                      <Field label="Medical Checkup" value={h.medical_checkup_done ? 'Done' : 'Pending'} />
                      <Field label="Dental Checkup" value={h.dental_checkup_done ? 'Done' : 'Pending'} />
                      <Field label="Psychological Checkup" value={h.psychological_checkup_done ? 'Done' : 'Pending'} />
                    </div>
                    {!!h.notes && <p className="rd-narrative"><strong>Notes:</strong> {String(h.notes)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'interventions' && (
          <>
            <div className="rd-tab-actions">
              <button className="rd-add-btn" onClick={() => openForm(INTERVENTION_FIELDS, 'intervention_plans')}>+ Add Intervention Plan</button>
            </div>
            <div className="rd-timeline">
              {plans.length === 0 && <p className="rd-empty">No intervention plans on file.</p>}
              {plans.map((p, i) => (
                <div key={i} className="rd-timeline-item">
                  <div className="rd-timeline-dot" />
                  <div className="rd-timeline-card">
                    <div className="rd-timeline-header">
                      <strong>{String(p.plan_category ?? '—')}</strong>
                      <Badge text={String(p.status ?? '—')} />
                      <button className="rd-edit-inline" onClick={() => openForm(INTERVENTION_FIELDS, 'intervention_plans', p, 'plan_id')}>Edit</button>
                    </div>
                    <div className="rd-fields">
                      <Field label="Target Date" value={p.target_date} />
                      <Field label="Case Conference" value={p.case_conference_date} />
                      <Field label="Services Provided" value={p.services_provided} />
                      <Field label="Created" value={String(p.created_at ?? '—').slice(0, 10)} />
                    </div>
                    {!!p.plan_description && <p className="rd-narrative"><strong>Plan:</strong> {String(p.plan_description)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'incidents' && (
          <>
            <div className="rd-tab-actions">
              <button className="rd-add-btn" onClick={() => openForm(INCIDENT_FIELDS, 'incident_reports')}>+ Add Incident</button>
            </div>
            <div className="rd-timeline">
              {incidents.length === 0 && <p className="rd-empty">No incidents on file.</p>}
              {incidents.map((inc, i) => (
                <div key={i} className="rd-timeline-item">
                  <div className="rd-timeline-dot rd-timeline-dot--alert" />
                  <div className="rd-timeline-card">
                    <div className="rd-timeline-header">
                      <strong>{String(inc.incident_date ?? '—')}</strong>
                      <Badge text={String(inc.severity ?? '—')} variant={`sev-${String(inc.severity ?? '').toLowerCase()}`} />
                      <button className="rd-edit-inline" onClick={() => openForm(INCIDENT_FIELDS, 'incident_reports', inc, 'incident_id')}>Edit</button>
                    </div>
                    <div className="rd-fields">
                      <Field label="Type" value={inc.incident_type} />
                      <Field label="Reported By" value={inc.reported_by} />
                      <Field label="Resolved" value={inc.resolved ? 'Yes' : 'No'} />
                      <Field label="Resolution Date" value={inc.resolution_date} />
                      <Field label="Follow-up Required" value={inc.follow_up_required ? 'Yes' : 'No'} />
                    </div>
                    {!!inc.description && <p className="rd-narrative"><strong>Description:</strong> {String(inc.description)}</p>}
                    {!!inc.response_taken && <p className="rd-narrative"><strong>Response:</strong> {String(inc.response_taken)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </main>
  )
}
