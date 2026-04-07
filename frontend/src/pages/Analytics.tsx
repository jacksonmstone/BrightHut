import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getResidents, getEducationRecords, getHealthRecords, getInterventionPlans, getIncidentReports } from '../api/residents'
import { getDonations } from '../api/donations'
import { getSafehouses } from '../api/safehouses'
import { phpToUsd, formatUsd } from '../components/donationProgress'
import './Analytics.css'

type Row = Record<string, unknown>

function toNum(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item)
    acc[k] = acc[k] ?? []
    acc[k].push(item)
    return acc
  }, {} as Record<string, T[]>)
}

export default function Analytics() {
  const navigate = useNavigate()
  const [residents, setResidents] = useState<Row[]>([])
  const [donations, setDonations] = useState<Row[]>([])
  const [safehouses, setSafehouses] = useState<Row[]>([])
  const [education, setEducation] = useState<Row[]>([])
  const [health, setHealth] = useState<Row[]>([])
  const [plans, setPlans] = useState<Row[]>([])
  const [incidents, setIncidents] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getResidents(), getDonations(), getSafehouses(),
      getEducationRecords(), getHealthRecords(), getInterventionPlans(), getIncidentReports(),
    ])
      .then(([r, d, s, edu, hlt, pl, inc]) => {
        setResidents(r); setDonations(d); setSafehouses(s)
        setEducation(edu); setHealth(hlt); setPlans(pl); setIncidents(inc)
      })
      .catch(() => setError('Failed to load analytics data.'))
      .finally(() => setLoading(false))
  }, [])

  // --- KPIs ---
  const totalResidents = residents.length
  const activeResidents = useMemo(() => residents.filter(r => r.case_status === 'Active').length, [residents])
  const reintegrationCompleted = useMemo(() => residents.filter(r => r.reintegration_status === 'Completed').length, [residents])
  const totalRaisedUsd = useMemo(() => formatUsd(phpToUsd(donations.filter(d => d.donation_type === 'Monetary').reduce((s, d) => s + toNum(d.amount), 0))), [donations])

  // --- Donation trends (last 12 months) ---
  const donationTrends = useMemo(() => {
    const months: { label: string; key: string }[] = []
    const now = new Date()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = d.toISOString().slice(0, 7)
      const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })
      months.push({ label, key })
    }
    return months.map(m => ({
      label: m.label,
      usd: phpToUsd(donations.filter(d => d.donation_type === 'Monetary' && String(d.donation_date ?? '').startsWith(m.key)).reduce((s, d) => s + toNum(d.amount), 0)),
      count: donations.filter(d => String(d.donation_date ?? '').startsWith(m.key)).length,
    }))
  }, [donations])

  const maxTrendUsd = Math.max(1, ...donationTrends.map(t => t.usd))

  // --- Donation by type ---
  const byType = useMemo(() => {
    const groups = groupBy(donations, d => String(d.donation_type ?? 'Unknown'))
    return Object.entries(groups).map(([type, rows]) => ({
      type,
      count: rows.length,
      usd: phpToUsd(rows.filter(r => r.donation_type === 'Monetary').reduce((s, r) => s + toNum(r.amount), 0)),
    })).sort((a, b) => b.count - a.count)
  }, [donations])

  // --- Residents by category ---
  const byCategory = useMemo(() => {
    const groups = groupBy(residents, r => String(r.case_category ?? 'Unknown'))
    return Object.entries(groups).map(([cat, rows]) => ({
      cat,
      total: rows.length,
      active: rows.filter(r => r.case_status === 'Active').length,
    })).sort((a, b) => b.total - a.total)
  }, [residents])
  const maxCatCount = Math.max(1, ...byCategory.map(c => c.total))

  // --- Residents by safehouse ---
  const bySafehouse = useMemo(() => {
    const shMap = new Map(safehouses.map(s => [String(s.safehouse_id), String(s.name ?? `#${s.safehouse_id}`)]))
    const groups = groupBy(residents.filter(r => r.case_status === 'Active'), r => String(r.safehouse_id ?? ''))
    return Object.entries(groups).map(([id, rows]) => ({
      name: shMap.get(id) ?? `Safehouse ${id}`,
      count: rows.length,
    })).sort((a, b) => b.count - a.count)
  }, [residents, safehouses])
  const maxShCount = Math.max(1, ...bySafehouse.map(s => s.count))

  // --- Reintegration status ---
  const byReintegration = useMemo(() => {
    const groups = groupBy(residents, r => String(r.reintegration_status ?? 'Not Started'))
    return Object.entries(groups).map(([status, rows]) => ({ status, count: rows.length })).sort((a, b) => b.count - a.count)
  }, [residents])

  // --- Education completion ---
  const eduSummary = useMemo(() => {
    const groups = groupBy(education, e => String(e.completion_status ?? 'Unknown'))
    return Object.entries(groups).map(([status, rows]) => ({ status, count: rows.length })).sort((a, b) => b.count - a.count)
  }, [education])
  const avgProgress = useMemo(() => {
    if (!education.length) return 0
    return education.reduce((s, e) => s + toNum(e.progress_percent), 0) / education.length
  }, [education])

  // --- Health averages ---
  const healthAvg = useMemo(() => {
    if (!health.length) return null
    const avg = (key: string) => (health.reduce((s, h) => s + toNum(h[key]), 0) / health.length).toFixed(1)
    return {
      general: avg('general_health_score'),
      nutrition: avg('nutrition_score'),
      sleep: avg('sleep_quality_score'),
      energy: avg('energy_level_score'),
    }
  }, [health])

  // --- Intervention plan status ---
  const planStatus = useMemo(() => {
    const groups = groupBy(plans, p => String(p.status ?? 'Unknown'))
    return Object.entries(groups).map(([status, rows]) => ({ status, count: rows.length })).sort((a, b) => b.count - a.count)
  }, [plans])

  // --- Open incidents by severity ---
  const openBySeverity = useMemo(() => {
    const open = incidents.filter(i => !i.resolved)
    const groups = groupBy(open, i => String(i.severity ?? 'Unknown'))
    return Object.entries(groups).map(([sev, rows]) => ({ sev, count: rows.length }))
  }, [incidents])

  if (loading) return <main className="analytics-page"><p className="an-state">Loading analytics…</p></main>
  if (error) return <main className="analytics-page"><p className="an-state error">{error}</p></main>

  return (
    <main className="analytics-page">
      <div className="an-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <div>
          <h1>Reports & Analytics</h1>
          <p className="an-sub">Aggregated insights aligned with Annual Accomplishment Report format</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="an-kpis">
        <div className="an-kpi"><span className="an-kpi-label">Total Residents</span><span className="an-kpi-value">{totalResidents}</span><span className="an-kpi-sub">{activeResidents} currently active</span></div>
        <div className="an-kpi"><span className="an-kpi-label">Total Raised</span><span className="an-kpi-value">{totalRaisedUsd}</span><span className="an-kpi-sub">{donations.length} total donations</span></div>
        <div className="an-kpi"><span className="an-kpi-label">Reintegration Completed</span><span className="an-kpi-value">{reintegrationCompleted}</span><span className="an-kpi-sub">of {totalResidents} total residents</span></div>
        <div className="an-kpi"><span className="an-kpi-label">Avg. Education Progress</span><span className="an-kpi-value">{avgProgress.toFixed(1)}%</span><span className="an-kpi-sub">across {education.length} records</span></div>
      </div>

      <div className="an-grid">

        {/* Donation Trends */}
        <section className="an-card an-card--full">
          <h2>Monthly Donation Trends (Last 12 Months)</h2>
          <div className="an-trend-chart">
            {donationTrends.map(t => (
              <div key={t.label} className="an-trend-col">
                <span className="an-trend-val">{t.usd > 0 ? formatUsd(t.usd) : ''}</span>
                <div className="an-trend-bar-wrap">
                  <div className="an-trend-bar" style={{ height: `${(t.usd / maxTrendUsd) * 100}%` }} />
                </div>
                <span className="an-trend-label">{t.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Donations by Type */}
        <section className="an-card">
          <h2>Donations by Type</h2>
          <table className="an-table">
            <thead><tr><th>Type</th><th>Count</th><th>Amount (USD)</th></tr></thead>
            <tbody>
              {byType.map(t => (
                <tr key={t.type}>
                  <td>{t.type}</td>
                  <td>{t.count}</td>
                  <td>{t.usd > 0 ? formatUsd(t.usd) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Intervention Plan Status */}
        <section className="an-card">
          <h2>Intervention Plan Status</h2>
          <table className="an-table">
            <thead><tr><th>Status</th><th>Count</th></tr></thead>
            <tbody>
              {planStatus.map(p => (
                <tr key={p.status}><td>{p.status}</td><td>{p.count}</td></tr>
              ))}
            </tbody>
          </table>
          {openBySeverity.length > 0 && (
            <>
              <h3 className="an-subheading">Open Incidents by Severity</h3>
              <table className="an-table">
                <thead><tr><th>Severity</th><th>Count</th></tr></thead>
                <tbody>
                  {openBySeverity.map(s => (
                    <tr key={s.sev}><td>{s.sev}</td><td>{s.count}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        {/* Residents by Category */}
        <section className="an-card">
          <h2>Caseload by Category</h2>
          <div className="an-bars">
            {byCategory.map(c => (
              <div key={c.cat} className="an-bar-row">
                <span className="an-bar-label">{c.cat}</span>
                <div className="an-bar-track">
                  <div className="an-bar-fill" style={{ width: `${(c.total / maxCatCount) * 100}%` }} />
                </div>
                <span className="an-bar-count">{c.total} <span className="an-bar-sub">({c.active} active)</span></span>
              </div>
            ))}
          </div>
        </section>

        {/* Residents by Safehouse */}
        <section className="an-card">
          <h2>Active Residents by Safehouse</h2>
          <div className="an-bars">
            {bySafehouse.map(s => (
              <div key={s.name} className="an-bar-row">
                <span className="an-bar-label">{s.name}</span>
                <div className="an-bar-track">
                  <div className="an-bar-fill" style={{ width: `${(s.count / maxShCount) * 100}%` }} />
                </div>
                <span className="an-bar-count">{s.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Reintegration Outcomes */}
        <section className="an-card">
          <h2>Reintegration Outcomes</h2>
          <table className="an-table">
            <thead><tr><th>Status</th><th>Count</th><th>%</th></tr></thead>
            <tbody>
              {byReintegration.map(r => (
                <tr key={r.status}>
                  <td>{r.status}</td>
                  <td>{r.count}</td>
                  <td>{totalResidents > 0 ? ((r.count / totalResidents) * 100).toFixed(1) : '0'}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Education */}
        <section className="an-card">
          <h2>Education Progress</h2>
          <table className="an-table">
            <thead><tr><th>Completion Status</th><th>Count</th></tr></thead>
            <tbody>
              {eduSummary.map(e => (
                <tr key={e.status}><td>{e.status}</td><td>{e.count}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="an-stat-note">Average progress: <strong>{avgProgress.toFixed(1)}%</strong> across {education.length} records</p>
        </section>

        {/* Health */}
        {healthAvg && (
          <section className="an-card">
            <h2>Average Health Scores</h2>
            <p className="an-stat-note">Across {health.length} health records</p>
            <div className="an-score-grid">
              <div className="an-score"><span className="an-score-label">General Health</span><span className="an-score-value">{healthAvg.general}</span></div>
              <div className="an-score"><span className="an-score-label">Nutrition</span><span className="an-score-value">{healthAvg.nutrition}</span></div>
              <div className="an-score"><span className="an-score-label">Sleep Quality</span><span className="an-score-value">{healthAvg.sleep}</span></div>
              <div className="an-score"><span className="an-score-label">Energy Level</span><span className="an-score-value">{healthAvg.energy}</span></div>
            </div>
          </section>
        )}

      </div>
    </main>
  )
}
