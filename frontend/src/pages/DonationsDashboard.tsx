import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDonations } from '../api/donations'
import { getSupporters, getDonorChurnRisk, getDonorUpgradePotential, type DonorChurnEntry, type DonorUpgradeEntry } from '../api/supporters'
import { phpToUsd, formatUsd } from '../components/donationProgress'
import './DonationsDashboard.css'

type Row = Record<string, unknown>

function toNum(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function DonationsDashboard() {
  const navigate = useNavigate()
  const [donations, setDonations] = useState<Row[]>([])
  const [supporters, setSupporters] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [churnScores, setChurnScores] = useState<Map<number, DonorChurnEntry>>(new Map())
  const [upgradeScores, setUpgradeScores] = useState<Map<number, DonorUpgradeEntry>>(new Map())

  useEffect(() => {
    Promise.all([getDonations(), getSupporters()])
      .then(([d, s]) => { setDonations(d); setSupporters(s) })
      .catch(() => setError('Failed to load donation data.'))
      .finally(() => setLoading(false))

    getDonorChurnRisk()
      .then(result => {
        const map = new Map<number, DonorChurnEntry>()
        for (const d of result.donors) map.set(d.supporterId, d)
        setChurnScores(map)
      })
      .catch(() => {})

    getDonorUpgradePotential()
      .then(result => {
        const map = new Map<number, DonorUpgradeEntry>()
        for (const d of result.donors) map.set(d.supporterId, d)
        setUpgradeScores(map)
      })
      .catch(() => {})
  }, [])

  const monetary = useMemo(() => donations.filter(d => d.donation_type === 'Monetary'), [donations])
  const totalRaised = useMemo(() => monetary.reduce((s, d) => s + toNum(d.amount), 0), [monetary])

  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisMonthTotal = useMemo(() =>
    monetary.filter(d => String(d.donation_date ?? '').startsWith(thisMonth))
      .reduce((s, d) => s + toNum(d.amount), 0),
    [monetary, thisMonth])

  const recurringCount = useMemo(() => donations.filter(d => d.is_recurring).length, [donations])
  const activeSupporters = useMemo(() => supporters.filter(s => s.status === 'Active').length, [supporters])

  // By type breakdown
  const byType = useMemo(() => {
    const map: Record<string, number> = {}
    for (const d of donations) {
      const t = String(d.donation_type ?? 'Unknown')
      map[t] = (map[t] ?? 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [donations])

  // By channel breakdown
  const byChannel = useMemo(() => {
    const map: Record<string, number> = {}
    for (const d of donations) {
      const c = String(d.channel_source ?? 'Unknown')
      map[c] = (map[c] ?? 0) + 1
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [donations])

  // Top donors by total monetary amount
  const topDonors = useMemo(() => {
    const map = new Map<number, { name: string; total: number; count: number }>()
    for (const d of monetary) {
      const id = Number(d.supporter_id)
      const sup = supporters.find(s => Number(s.supporter_id) === id)
      const name = sup ? String(sup.display_name ?? '—') : `Supporter #${id}`
      const entry = map.get(id) ?? { name, total: 0, count: 0 }
      entry.total += toNum(d.amount)
      entry.count += 1
      map.set(id, entry)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 8)
  }, [monetary, supporters])

  const maxDonorTotal = Math.max(1, ...topDonors.map(d => d.total))

  // Recent donations
  const recentDonations = useMemo(() =>
    [...donations]
      .sort((a, b) => String(b.donation_date).localeCompare(String(a.donation_date)))
      .slice(0, 15),
    [donations])

  const supporterMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of supporters) m.set(Number(s.supporter_id), String(s.display_name ?? '—'))
    return m
  }, [supporters])

  const maxTypeCount = Math.max(1, ...byType.map(([, v]) => v))
  const maxChannelCount = Math.max(1, ...byChannel.map(([, v]) => v))

  const topChurnDonors = useMemo(() =>
    Array.from(churnScores.values())
      .filter(e => e.churnTier !== 'Stable')
      .sort((a, b) => b.churnProbability - a.churnProbability)
      .slice(0, 5)
      .map(e => ({ ...e, name: supporterMap.get(e.supporterId) || `Donor #${e.supporterId}` }))
  , [churnScores, supporterMap])

  const topUpgradeDonors = useMemo(() =>
    Array.from(upgradeScores.values())
      .filter(e => e.upgradeTier !== 'LOW')
      .sort((a, b) => b.upgradeProbability - a.upgradeProbability)
      .slice(0, 5)
      .map(e => ({ ...e, name: supporterMap.get(e.supporterId) || `Donor #${e.supporterId}` }))
  , [upgradeScores, supporterMap])

  if (loading) return <main className="dd-page"><p className="dd-state">Loading donation data…</p></main>
  if (error) return <main className="dd-page"><p className="dd-state dd-state--error">{error}</p></main>

  return (
    <main className="dd-page">
      <div className="dd-header">
        <div>
          <button className="dd-back-btn" onClick={() => navigate('/')}>← Back</button>
          <h1>Donations Overview</h1>
          <p className="dd-subhead">All donation activity at a glance</p>
        </div>
        <button className="dd-manage-btn" onClick={() => navigate('/donors/manage')}>
          Manage records →
        </button>
      </div>

      {/* KPIs */}
      <div className="dd-kpis">
        <div className="dd-kpi">
          <span className="dd-kpi-label">Total Raised</span>
          <span className="dd-kpi-value">{formatUsd(phpToUsd(totalRaised))}</span>
          <span className="dd-kpi-sub">all time</span>
        </div>
        <div className="dd-kpi">
          <span className="dd-kpi-label">This Month</span>
          <span className="dd-kpi-value">{formatUsd(phpToUsd(thisMonthTotal))}</span>
          <span className="dd-kpi-sub">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
        </div>
        <div className="dd-kpi">
          <span className="dd-kpi-label">Total Donations</span>
          <span className="dd-kpi-value">{donations.length}</span>
          <span className="dd-kpi-sub">{monetary.length} monetary</span>
        </div>
        <div className="dd-kpi">
          <span className="dd-kpi-label">Active Supporters</span>
          <span className="dd-kpi-value">{activeSupporters}</span>
          <span className="dd-kpi-sub">of {supporters.length} total</span>
        </div>
        <div className="dd-kpi">
          <span className="dd-kpi-label">Recurring</span>
          <span className="dd-kpi-value">{recurringCount}</span>
          <span className="dd-kpi-sub">donations</span>
        </div>
      </div>

      <div className="dd-grid">
        {/* By Type */}
        <section className="dd-card">
          <h2>By Donation Type</h2>
          <div className="dd-bars">
            {byType.map(([type, count]) => (
              <div key={type} className="dd-bar-row">
                <span className="dd-bar-label">{type}</span>
                <div className="dd-bar-track">
                  <div className="dd-bar-fill" style={{ width: `${(count / maxTypeCount) * 100}%` }} />
                </div>
                <span className="dd-bar-count">{count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* By Channel */}
        <section className="dd-card">
          <h2>By Channel</h2>
          <div className="dd-bars">
            {byChannel.map(([channel, count]) => (
              <div key={channel} className="dd-bar-row">
                <span className="dd-bar-label">{channel}</span>
                <div className="dd-bar-track">
                  <div className="dd-bar-fill dd-bar-fill--alt" style={{ width: `${(count / maxChannelCount) * 100}%` }} />
                </div>
                <span className="dd-bar-count">{count}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Top Donors */}
        <section className="dd-card dd-card--full">
          <h2>Top Donors by Total Giving</h2>
          <div className="dd-bars">
            {topDonors.map((d) => (
              <div key={d.name} className="dd-bar-row">
                <span className="dd-bar-label">{d.name}</span>
                <div className="dd-bar-track">
                  <div className="dd-bar-fill dd-bar-fill--green" style={{ width: `${(d.total / maxDonorTotal) * 100}%` }} />
                </div>
                <span className="dd-bar-count">{formatUsd(phpToUsd(d.total))}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ML Insight Cards */}
        {(topChurnDonors.length > 0 || topUpgradeDonors.length > 0) && (
          <>
            {topChurnDonors.length > 0 && (
              <section className="dd-card dd-insight-card dd-insight-card--churn">
                <div className="dd-insight-header">
                  <div>
                    <h2>Donors at Risk of Lapsing</h2>
                    <p className="dd-insight-sub">Highest predicted churn probability</p>
                  </div>
                  <button className="dd-link" onClick={() => navigate('/donors/manage', { state: { tab: 'supporters', filterChurn: 'At Risk' } })}>
                    See more →
                  </button>
                </div>
                <div className="dd-bars">
                  {topChurnDonors.map(d => {
                    const tk = d.churnTier === 'At Risk' ? 'risk' : 'moderate'
                    return (
                      <div key={d.supporterId} className="dd-bar-row">
                        <span className="dd-bar-label">{d.name}</span>
                        <span className={`dd-churn-badge dd-churn-badge--${tk}`}>{d.churnTier}</span>
                        <div className="dd-bar-track">
                          <div className={`dd-bar-fill dd-bar-fill--${tk}`} style={{ width: `${Math.round(d.churnProbability * 100)}%` }} />
                        </div>
                        <span className="dd-bar-count">{Math.round(d.churnProbability * 100)}%</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
            {topUpgradeDonors.length > 0 && (
              <section className="dd-card dd-insight-card dd-insight-card--upgrade">
                <div className="dd-insight-header">
                  <div>
                    <h2>Donors Ready to Upgrade</h2>
                    <p className="dd-insight-sub">Highest predicted upgrade probability</p>
                  </div>
                  <button className="dd-link" onClick={() => navigate('/donors/manage', { state: { tab: 'supporters', filterUpgrade: 'HIGH' } })}>
                    See more →
                  </button>
                </div>
                <div className="dd-bars">
                  {topUpgradeDonors.map(d => {
                    const tk = d.upgradeTier === 'HIGH' ? 'high' : 'medium'
                    return (
                      <div key={d.supporterId} className="dd-bar-row">
                        <span className="dd-bar-label">{d.name}</span>
                        <span className={`dd-upgrade-badge dd-upgrade-badge--${tk}`}>{d.upgradeTier}</span>
                        <div className="dd-bar-track">
                          <div className={`dd-bar-fill dd-bar-fill--upgrade-${tk}`} style={{ width: `${Math.round(d.upgradeProbability * 100)}%` }} />
                        </div>
                        <span className="dd-bar-count">{Math.round(d.upgradeProbability * 100)}%</span>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* Recent Donations */}
        <section className="dd-card dd-card--full">
          <div className="dd-card-header">
            <h2>Recent Donations</h2>
            <button className="dd-link" onClick={() => navigate('/donors/manage')}>View all →</button>
          </div>
          <div className="dd-table-scroll">
            <table className="dd-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Donor</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Channel</th>
                  <th>Campaign</th>
                  <th>Recurring</th>
                </tr>
              </thead>
              <tbody>
                {recentDonations.map((d, i) => (
                  <tr key={i}>
                    <td>{String(d.donation_date ?? '—').slice(0, 10)}</td>
                    <td>{supporterMap.get(Number(d.supporter_id)) ?? '—'}</td>
                    <td><span className={`dd-badge dd-badge--${String(d.donation_type ?? '').toLowerCase()}`}>{String(d.donation_type ?? '—')}</span></td>
                    <td>{d.amount ? formatUsd(phpToUsd(toNum(d.amount))) : '—'}</td>
                    <td>{String(d.channel_source ?? '—')}</td>
                    <td>{String(d.campaign_name ?? '—')}</td>
                    <td>{d.is_recurring ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}
