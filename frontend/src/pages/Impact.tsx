import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

function ym(d: string) { return d.slice(0, 7) }

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
    return [...snapshots]
      .sort((a, b) => String(b.snapshot_date ?? '').localeCompare(String(a.snapshot_date ?? '')))
      [0] ?? null
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
    const activeResidents = latestMonthRows.reduce((sum, r) => sum + toNumber(r.active_residents), 0)
    const avgEducation = latestMonthRows.length
      ? latestMonthRows.reduce((sum, r) => sum + toNumber(r.avg_education_progress), 0) / latestMonthRows.length
      : 0
    const avgHealth = latestMonthRows.length
      ? latestMonthRows.reduce((sum, r) => sum + toNumber(r.avg_health_score), 0) / latestMonthRows.length
      : 0
    const processNotes = latestMonthRows.reduce((sum, r) => sum + toNumber(r.process_recording_count), 0)
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

  return (
    <main className="impact-page">

      {/* ── Hero ── */}
      <section className="impact-hero">
        <div className="impact-hero-inner">
          <span className="impact-tag">Impact Dashboard</span>
          <h1>
            Every gift changes<br />
            <span className="impact-accent">a child's story.</span>
          </h1>
          <p className="impact-lead">
            Aggregated, anonymized insights showing how donor support translates into safety,
            healing, and new beginnings — no individual details, just honest outcomes.
          </p>
        </div>
        <div className="impact-hero-blob" aria-hidden="true" />
      </section>

      {loading && <p className="impact-state">Loading impact data…</p>}
      {error && <p className="impact-state impact-state--error">{error}</p>}

      {!loading && !error && (
        <>
          {/* ── Total raised ── */}
          <section className="impact-raised">
            <div className="impact-raised-inner">
              <div className="impact-raised-amount">
                <span className="impact-raised-label">Total Raised</span>
                <span className="impact-raised-value">{formatUsd(phpToUsd(totalRaisedPhp))}</span>
                <span className="impact-raised-sub">in monetary donations across all campaigns</span>
              </div>
              <div className="impact-raised-stats">
                {[
                  { value: totals.activeResidents.toLocaleString(), label: 'Active residents' },
                  { value: totals.avgEducation.toFixed(1) + '%', label: 'Avg education progress' },
                  { value: totals.avgHealth.toFixed(2), label: 'Avg health score' },
                  { value: totals.processNotes.toLocaleString(), label: 'Counseling notes' },
                  { value: totals.visits.toLocaleString(), label: 'Home visits' },
                ].map(({ value, label }) => (
                  <div key={label} className="impact-stat">
                    <span className="impact-stat-value">{value}</span>
                    <span className="impact-stat-label">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Resident care trend ── */}
          <section className="impact-chart-section">
            <div className="impact-chart-inner">
              <div className="impact-section-header">
                <h2>Resident care trend</h2>
                <p>Active resident counts across all safehouses over the last 6 reported months.</p>
              </div>
              <div className="impact-chart" role="img" aria-label="Active residents trend">
                {trend.keys.map((k, idx) => {
                  const v = trend.values[idx] ?? 0
                  const h = Math.max(8, Math.round((v / trend.max) * 100))
                  return (
                    <div key={k} className="impact-bar">
                      <span className="impact-bar-value">{v}</span>
                      <div className="impact-bar-track">
                        <div className="impact-bar-fill" style={{ height: h + '%' }} />
                      </div>
                      <span className="impact-bar-label">{monthLabel(k)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </section>

          {/* ── What donors make possible ── */}
          <section className="impact-what">
            <div className="impact-what-inner">
              <div className="impact-section-header">
                <h2>What your support makes possible</h2>
                <p>This dashboard uses aggregate metrics only — no resident-level details are ever shared.</p>
              </div>
              <div className="impact-cards">
                {[
                  { n: '01', title: 'Caring', body: 'Safe shelter, consistent meals, and daily routines that help residents regain stability and feel secure.' },
                  { n: '02', title: 'Healing', body: 'Counseling sessions, intervention plans, and follow-up actions documented to support long-term recovery.' },
                  { n: '03', title: 'Teaching', body: 'Education progress tracking and support services that help residents rebuild confidence and opportunity.' },
                ].map(({ n, title, body }) => (
                  <div key={n} className="impact-card">
                    <span className="impact-card-num">{n}</span>
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Latest snapshot ── */}
          {latestSnapshot && (
            <section className="impact-snapshot">
              <div className="impact-snapshot-inner">
                <span className="impact-tag impact-tag--light">Latest snapshot</span>
                <h2>{String(latestSnapshot.headline ?? 'BrightHut impact')}</h2>
                <p>{String(latestSnapshot.summary_text ?? 'Every month, we report outcomes using anonymized aggregates to protect residents.')}</p>
                <div className="impact-snapshot-meta">
                  <span className="impact-meta-pill">Snapshot: {String(latestSnapshot.snapshot_date ?? '—').slice(0, 10)}</span>
                  <span className="impact-meta-pill">Reporting month: {latestMonth ? latestMonth.slice(0, 7) : '—'}</span>
                </div>
              </div>
            </section>
          )}

          {/* ── CTA ── */}
          <section className="impact-cta">
            <div className="impact-cta-inner">
              <h2>Ready to be part of the story?</h2>
              <p>Your donation directly funds shelter, counseling, education, and hope.</p>
              <button className="btn-primary impact-cta-btn" onClick={() => navigate('/#donate')}>
                Donate now
              </button>
            </div>
          </section>
        </>
      )}
    </main>
  )
}
