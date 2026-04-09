import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getResidents, getInterventionPlans, getIncidentReports, getResidentReadinessScore, getResidentRegressionRisk } from '../api/residents'
import { getDonations } from '../api/donations'
import { getSafehouses } from '../api/safehouses'
import { getSupporters } from '../api/supporters'
import { phpToUsd, formatUsd } from '../components/donationProgress'
import './AdminDashboard.css'

type Row = Record<string, unknown>

function toNum(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function AdminDashboard() {
  const navigate = useNavigate()

  const [residents, setResidents] = useState<Row[]>([])
  const [donations, setDonations] = useState<Row[]>([])
  const [safehouses, setSafehouses] = useState<Row[]>([])
  const [supporters, setSupporters] = useState<Row[]>([])
  const [plans, setPlans] = useState<Row[]>([])
  const [incidents, setIncidents] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readinessTiers, setReadinessTiers] = useState<{ high: number; moderate: number; needsSupport: number } | null>(null)
  const [regressionRiskTiers, setRegressionRiskTiers] = useState<{ high: number; moderate: number; stable: number } | null>(null)

  useEffect(() => {
    Promise.all([
      getResidents(),
      getDonations(),
      getSafehouses(),
      getSupporters(),
      getInterventionPlans(),
      getIncidentReports(),
    ])
      .then(([r, d, s, sup, p, inc]) => {
        setResidents(r)
        setDonations(d)
        setSafehouses(s)
        setSupporters(sup)
        setPlans(p)
        setIncidents(inc)

        // Load readiness scores for all active residents — silently ignored if not staff/admin
        const activeIds = r
          .filter((res: Row) => res.case_status === 'Active')
          .map((res: Row) => Number(res.resident_id))
        Promise.allSettled(activeIds.map((id: number) => getResidentReadinessScore(id)))
          .then(results => {
            const counts = { high: 0, moderate: 0, needsSupport: 0 }
            results.forEach(res => {
              if (res.status === 'fulfilled') {
                const tier = res.value.readinessTier
                if (tier === 'High Readiness') counts.high++
                else if (tier === 'Moderate Readiness') counts.moderate++
                else counts.needsSupport++
              }
            })
            if (counts.high + counts.moderate + counts.needsSupport > 0) {
              setReadinessTiers(counts)
            }
          })

        Promise.allSettled(activeIds.map((id: number) => getResidentRegressionRisk(id)))
          .then(results => {
            const counts = { high: 0, moderate: 0, stable: 0 }
            results.forEach(res => {
              if (res.status === 'fulfilled') {
                const tier = res.value.riskTier
                if (tier === 'High Risk') counts.high++
                else if (tier === 'Moderate Risk') counts.moderate++
                else counts.stable++
              }
            })
            if (counts.high + counts.moderate + counts.stable > 0) {
              setRegressionRiskTiers(counts)
            }
          })
      })
      .catch(() => setError('Failed to load dashboard data.'))
      .finally(() => setLoading(false))
  }, [])

  // KPIs
  const activeResidents = useMemo(() => residents.filter(r => r.case_status === 'Active').length, [residents])
  const totalSafehouses = safehouses.length
  const activeSupporters = useMemo(() => supporters.filter(s => s.status === 'Active').length, [supporters])
  const totalRaisedUsd = useMemo(() =>
    formatUsd(phpToUsd(donations.filter(d => d.donation_type === 'Monetary').reduce((sum, d) => sum + toNum(d.amount), 0))),
    [donations]
  )

  // This month donations
  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisMonthDonations = useMemo(() =>
    donations.filter(d => String(d.donation_date ?? '').startsWith(thisMonth)),
    [donations, thisMonth]
  )
  const thisMonthUsd = useMemo(() =>
    formatUsd(phpToUsd(thisMonthDonations.filter(d => d.donation_type === 'Monetary').reduce((sum, d) => sum + toNum(d.amount), 0))),
    [thisMonthDonations]
  )

  // Recent donations (last 8)
  const recentDonations = useMemo(() =>
    [...donations].sort((a, b) => String(b.donation_date).localeCompare(String(a.donation_date))).slice(0, 8),
    [donations]
  )

  // Upcoming case conferences (future dates, sorted soonest first)
  const today = new Date().toISOString().slice(0, 10)
  const upcomingConferences = useMemo(() =>
    plans
      .filter(p => p.case_conference_date && String(p.case_conference_date) >= today && p.status !== 'Achieved' && p.status !== 'Closed')
      .sort((a, b) => String(a.case_conference_date).localeCompare(String(b.case_conference_date)))
      .slice(0, 8),
    [plans, today]
  )

  // Active incidents (unresolved)
  const openIncidents = useMemo(() => incidents.filter(i => !i.resolved), [incidents])

  // Residents per safehouse
  const bySafehouse = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of residents.filter(r => r.case_status === 'Active')) {
      const id = String(r.safehouse_id ?? '')
      map.set(id, (map.get(id) ?? 0) + 1)
    }
    return safehouses.map(s => ({
      name: String(s.name ?? `Safehouse ${s.safehouse_id}`),
      count: map.get(String(s.safehouse_id)) ?? 0,
      status: String(s.status ?? ''),
    })).filter(s => s.status === 'Active').sort((a, b) => b.count - a.count)
  }, [residents, safehouses])

  const maxCount = Math.max(1, ...bySafehouse.map(s => s.count))

  if (loading) return <main className="admin-dash"><p className="ad-state">Loading dashboard…</p></main>
  if (error) return <main className="admin-dash"><p className="ad-state error">{error}</p></main>

  return (
    <main className="admin-dash">
      <div className="ad-header">
        <div>
          <button className="ad-back-btn" onClick={() => navigate('/')}>← Back</button>
          <h1>Admin Dashboard</h1>
          <p className="ad-subhead">Command center — live overview of operations</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="ad-kpis">
        <div className="ad-kpi ad-kpi--link" onClick={() => navigate('/participants')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate('/participants')}>
          <span className="ad-kpi-label">Active Residents</span>
          <span className="ad-kpi-value">{activeResidents}</span>
          <span className="ad-kpi-sub">across {totalSafehouses} safehouses</span>
        </div>
        <div className="ad-kpi ad-kpi--link" onClick={() => navigate('/donors')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate('/donors')}>
          <span className="ad-kpi-label">Total Raised</span>
          <span className="ad-kpi-value">{totalRaisedUsd}</span>
          <span className="ad-kpi-sub">{thisMonthUsd} this month</span>
        </div>
        <div className="ad-kpi ad-kpi--link" onClick={() => navigate('/donors')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate('/donors')}>
          <span className="ad-kpi-label">Active Supporters</span>
          <span className="ad-kpi-value">{activeSupporters}</span>
          <span className="ad-kpi-sub">of {supporters.length} total</span>
        </div>
        <div className="ad-kpi ad-kpi--alert ad-kpi--link" onClick={() => navigate('/participants')} role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && navigate('/participants')}>
          <span className="ad-kpi-label">Open Incidents</span>
          <span className="ad-kpi-value">{openIncidents.length}</span>
          <span className="ad-kpi-sub">unresolved</span>
        </div>
      </div>

      <div className="ad-grid">
        {/* Recent Donations */}
        <section className="ad-card">
          <div className="ad-card-header">
            <h2>Recent Donations</h2>
            <button className="ad-link" onClick={() => navigate('/donors')}>View all →</button>
          </div>
          <div className="ad-table-scroll" tabIndex={0}>
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Channel</th>
                </tr>
              </thead>
              <tbody>
                {recentDonations.map((d, i) => (
                  <tr key={i}>
                    <td>{String(d.donation_date ?? '—').slice(0, 10)}</td>
                    <td><span className={`ad-badge ad-badge--${String(d.donation_type ?? '').toLowerCase()}`}>{String(d.donation_type ?? '—')}</span></td>
                    <td>{d.amount ? formatUsd(phpToUsd(toNum(d.amount))) : '—'}</td>
                    <td>{String(d.channel_source ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Upcoming Case Conferences */}
        <section className="ad-card">
          <div className="ad-card-header">
            <h2>Upcoming Case Conferences</h2>
            <button className="ad-link" onClick={() => navigate('/participants')}>View all →</button>
          </div>
          {upcomingConferences.length === 0 ? (
            <p className="ad-empty">No upcoming case conferences scheduled.</p>
          ) : (
            <div className="ad-table-scroll" tabIndex={0}>
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingConferences.map((p, i) => (
                    <tr key={i}>
                      <td>{String(p.case_conference_date ?? '—').slice(0, 10)}</td>
                      <td>{String(p.plan_category ?? '—')}</td>
                      <td><span className={`ad-badge ad-badge--${String(p.status ?? '').toLowerCase().replace(' ', '-')}`}>{String(p.status ?? '—')}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Residents per Safehouse */}
        <section className="ad-card ad-card--full">
          <div className="ad-card-header">
            <h2>Active Residents by Safehouse</h2>
            <button className="ad-link" onClick={() => navigate('/participants')}>View caseload →</button>
          </div>
          <div className="ad-bars">
            {bySafehouse.map((s) => (
              <div key={s.name} className="ad-bar-row">
                <span className="ad-bar-label">{s.name}</span>
                <div className="ad-bar-track">
                  <div className="ad-bar-fill" style={{ width: `${(s.count / maxCount) * 100}%` }} />
                </div>
                <span className="ad-bar-count">{s.count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Reintegration Readiness Breakdown */}
        {readinessTiers && (() => {
          const total = readinessTiers.high + readinessTiers.moderate + readinessTiers.needsSupport
          const tiers = [
            { label: 'High Readiness',     count: readinessTiers.high,        key: 'high' },
            { label: 'Moderate Readiness', count: readinessTiers.moderate,    key: 'moderate' },
            { label: 'Needs Support',      count: readinessTiers.needsSupport, key: 'low' },
          ]
          return (
            <section className="ad-card">
              <div className="ad-card-header">
                <h2>Reintegration Readiness</h2>
                <button className="ad-link" onClick={() => navigate('/participants')}>View caseload →</button>
              </div>
              <p className="ad-readiness-subtitle">Active residents scored by the ML pipeline · {total} residents</p>
              <div className="ad-readiness-tiers">
                {tiers.map(t => (
                  <div key={t.key} className="ad-readiness-row">
                    <span className={`ad-readiness-dot ad-readiness-dot--${t.key}`} />
                    <span className="ad-readiness-label">{t.label}</span>
                    <div className="ad-readiness-bar-track">
                      <div
                        className={`ad-readiness-bar-fill ad-readiness-bar-fill--${t.key}`}
                        style={{ width: total > 0 ? `${(t.count / total) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="ad-readiness-count">{t.count}</span>
                  </div>
                ))}
              </div>
            </section>
          )
        })()}

        {/* Regression Risk Breakdown */}
        {regressionRiskTiers && (() => {
          const total = regressionRiskTiers.high + regressionRiskTiers.moderate + regressionRiskTiers.stable
          const tiers = [
            { label: 'High Risk',      count: regressionRiskTiers.high,     key: 'high' },
            { label: 'Moderate Risk',  count: regressionRiskTiers.moderate, key: 'moderate' },
            { label: 'Stable',         count: regressionRiskTiers.stable,   key: 'low' },
          ]
          return (
            <section className="ad-card">
              <div className="ad-card-header">
                <h2>Regression Risk</h2>
                <button className="ad-link" onClick={() => navigate('/participants')}>View caseload →</button>
              </div>
              <p className="ad-readiness-subtitle">Active residents scored by the ML pipeline · {total} residents</p>
              <div className="ad-readiness-tiers">
                {tiers.map(t => (
                  <div key={t.key} className="ad-readiness-row">
                    <span className={`ad-readiness-dot ad-readiness-dot--${t.key}`} />
                    <span className="ad-readiness-label">{t.label}</span>
                    <div className="ad-readiness-bar-track">
                      <div
                        className={`ad-readiness-bar-fill ad-readiness-bar-fill--${t.key}`}
                        style={{ width: total > 0 ? `${(t.count / total) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="ad-readiness-count">{t.count}</span>
                  </div>
                ))}
              </div>
            </section>
          )
        })()}

        {/* Open Incidents */}
        {openIncidents.length > 0 && (
          <section className="ad-card ad-card--full">
            <div className="ad-card-header">
              <h2>Open Incidents</h2>
              <button className="ad-link" onClick={() => navigate('/participants')}>View all →</button>
            </div>
            <div className="ad-table-scroll" tabIndex={0}>
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Reported By</th>
                    <th>Follow-up</th>
                  </tr>
                </thead>
                <tbody>
                  {openIncidents.slice(0, 8).map((inc, i) => (
                    <tr key={i}>
                      <td>{String(inc.incident_date ?? '—').slice(0, 10)}</td>
                      <td>{String(inc.incident_type ?? '—')}</td>
                      <td><span className={`ad-badge ad-badge--sev-${String(inc.severity ?? '').toLowerCase()}`}>{String(inc.severity ?? '—')}</span></td>
                      <td>{String(inc.reported_by ?? '—')}</td>
                      <td>{inc.follow_up_required ? 'Required' : 'None'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
