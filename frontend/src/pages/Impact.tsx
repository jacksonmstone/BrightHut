import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getPublicImpactSnapshots, getSafehouseMonthlyMetrics } from '../api/impact'
import { getDonations } from '../api/donations'
import { phpToUsd, formatUsd } from '../components/donationProgress'
import './Impact.css'

type Snapshot = Record<string, unknown>
type MetricRow = Record<string, unknown>

function toNumber(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function ym(d: string) {
  return d.slice(0, 7)
}

function monthLabel(yyyyMm: string) {
  const [y, m] = yyyyMm.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: '2-digit' })
}

export default function Impact() {
  const navigate = useNavigate()
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [metrics, setMetrics] = useState<MetricRow[]>([])
  const [totalRaisedPhp, setTotalRaisedPhp] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([getPublicImpactSnapshots(), getSafehouseMonthlyMetrics(), getDonations()])
      .then(([s, m, d]) => {
        setSnapshots(s ?? [])
        setMetrics(m ?? [])
        const total = (d ?? [])
          .filter((r) => r.donation_type === 'Monetary')
          .reduce((sum, r) => sum + toNumber(r.amount), 0)
        setTotalRaisedPhp(total)
      })
      .catch(() => setError('Failed to load impact data. Please try again later.'))
      .finally(() => setLoading(false))
  }, [])

  const latestSnapshot = useMemo(() => {
    const sorted = [...snapshots].sort((a, b) =>
      String(b.snapshot_date ?? '').localeCompare(String(a.snapshot_date ?? ''))
    )
    return sorted[0] ?? null
  }, [snapshots])

  const latestMonth = useMemo(() => {
    const ms = metrics
      .map((m) => String(m.month_start ?? ''))
      .filter((d) => d.length >= 10)
      .sort()
    return ms.length ? ms[ms.length - 1] : ''
  }, [metrics])

  const latestMonthRows = useMemo(
    () => metrics.filter((m) => String(m.month_start ?? '') === latestMonth),
    [metrics, latestMonth]
  )

  const totals = useMemo(() => {
    const activeResidents = latestMonthRows.reduce(
      (sum, r) => sum + toNumber(r.active_residents),
      0
    )
    const avgEducation = latestMonthRows.length
      ? latestMonthRows.reduce((sum, r) => sum + toNumber(r.avg_education_progress), 0) /
        latestMonthRows.length
      : 0
    const avgHealth = latestMonthRows.length
      ? latestMonthRows.reduce((sum, r) => sum + toNumber(r.avg_health_score), 0) /
        latestMonthRows.length
      : 0
    const processNotes = latestMonthRows.reduce(
      (sum, r) => sum + toNumber(r.process_recording_count),
      0
    )
    const visits = latestMonthRows.reduce((sum, r) => sum + toNumber(r.home_visitation_count), 0)
    return { activeResidents, avgEducation, avgHealth, processNotes, visits }
  }, [latestMonthRows])

  const trend = useMemo(() => {
    const byMonth = new Map<string, number>()
    for (const r of metrics) {
      const d = String(r.month_start ?? '')
      if (d.length < 7) continue
      byMonth.set(ym(d), (byMonth.get(ym(d)) ?? 0) + toNumber(r.active_residents))
    }
    const keys = [...byMonth.keys()].sort().slice(-6)
    const values = keys.map((k) => byMonth.get(k) ?? 0)
    const max = Math.max(1, ...values)
    return { keys, values, max }
  }, [metrics])

  const snapshotPayload = useMemo(() => {
    const raw = String(latestSnapshot?.metric_payload_json ?? '')
    if (!raw) return null
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return null
    }
  }, [latestSnapshot])

  return (
    <main className="impact-page">
      <div className="impact-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Back
        </button>
        <div className="impact-header-text">
          <h1>Impact Dashboard</h1>
          <p className="subtitle">
            Aggregated, anonymized insights that show how support turns into safety and healing.
          </p>
        </div>
      </div>

      {loading ? <p className="state-msg">Loading impact data…</p> : null}
      {error ? <p className="state-msg error">{error}</p> : null}

      {!loading && !error ? (
        <>
          <section className="impact-hero">
            <div className="impact-hero-card">
              <span className="impact-tag">Latest snapshot</span>
              <h2>{String(latestSnapshot?.headline ?? 'BrightHut impact')}</h2>
              <p className="impact-hero-text">
                {String(
                  latestSnapshot?.summary_text ??
                    'Every month, we report outcomes using anonymized aggregates to protect residents.'
                )}
              </p>
              <div className="impact-hero-meta">
                <span className="impact-meta-pill">
                  Snapshot: {String(latestSnapshot?.snapshot_date ?? '—')}
                </span>
                <span className="impact-meta-pill">
                  Reporting month: {latestMonth ? latestMonth.slice(0, 7) : '—'}
                </span>
              </div>
            </div>
          </section>

          <div className="impact-metrics-wrap">
            <div className="impact-total-raised">
              <span className="impact-total-raised-label">Total Raised</span>
              <span className="impact-total-raised-value">{formatUsd(phpToUsd(totalRaisedPhp))}</span>
              <span className="impact-total-raised-sub">in monetary donations across all campaigns</span>
            </div>

            <section className="impact-stats">
            <div className="impact-stat">
              <span className="impact-stat-value">{totals.activeResidents.toLocaleString()}</span>
              <span className="impact-stat-label">Active residents (latest month)</span>
            </div>
            <div className="impact-stat">
              <span className="impact-stat-value">{totals.avgEducation.toFixed(1)}%</span>
              <span className="impact-stat-label">Avg education progress</span>
            </div>
            <div className="impact-stat">
              <span className="impact-stat-value">{totals.avgHealth.toFixed(2)}</span>
              <span className="impact-stat-label">Avg health score</span>
            </div>
            <div className="impact-stat">
              <span className="impact-stat-value">{totals.processNotes.toLocaleString()}</span>
              <span className="impact-stat-label">Counseling notes logged</span>
            </div>
            <div className="impact-stat">
              <span className="impact-stat-value">{totals.visits.toLocaleString()}</span>
              <span className="impact-stat-label">Home/field visits completed</span>
            </div>
          </section>
          </div>

          <section className="impact-section">
            <div className="impact-section-header">
              <h2>Resident care trend</h2>
              <p>
                Active resident counts across all safehouses over the last 6 reported months (anonymized).
              </p>
            </div>

            <div className="impact-chart" role="img" aria-label="Active residents trend">
              {trend.keys.map((k, idx) => {
                const v = trend.values[idx] ?? 0
                const h = Math.max(6, Math.round((v / trend.max) * 100))
                return (
                  <div key={k} className="impact-bar">
                    <div className="impact-bar-fill" style={{ height: `${h}%` }} />
                    <div className="impact-bar-label">{monthLabel(k)}</div>
                    <div className="impact-bar-value">{v}</div>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="impact-section">
            <div className="impact-section-header">
              <h2>What donors help make possible</h2>
              <p>
                We share impact in ways that protect identities. This dashboard uses aggregate metrics—no
                resident-level details.
              </p>
            </div>

            <div className="impact-cards">
              <div className="impact-card">
                <h3>Caring</h3>
                <p>
                  Safe shelter, consistent meals, and daily routines that help residents regain stability.
                </p>
              </div>
              <div className="impact-card">
                <h3>Healing</h3>
                <p>
                  Counseling sessions, intervention plans, and follow-up actions documented to support long-term recovery.
                </p>
              </div>
              <div className="impact-card">
                <h3>Teaching</h3>
                <p>
                  Education progress tracking and support services that help residents rebuild confidence and opportunity.
                </p>
              </div>
            </div>

            {snapshotPayload ? (
              <details className="impact-details">
                <summary>View snapshot metrics payload (anonymized)</summary>
                <pre className="impact-json">{JSON.stringify(snapshotPayload, null, 2)}</pre>
              </details>
            ) : null}

            <div className="impact-cta">
              <Link className="impact-cta-link" to="/#donate">
                Donate to support this work →
              </Link>
              <Link className="impact-cta-link" to="/privacy">
                Read our privacy approach →
              </Link>
            </div>
          </section>
        </>
      ) : null}
    </main>
  )
}

