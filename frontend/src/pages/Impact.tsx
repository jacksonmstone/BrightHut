import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSafehouseMonthlyMetrics } from '../api/impact'
import { getDonations } from '../api/donations'
import { phpToUsd, formatUsd } from '../components/donationProgress'
import handsTogether from '../assets/hands-together.png'
import './Impact.css'

type MetricRow = Record<string, unknown>

function toNumber(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}


export default function Impact() {
  const navigate = useNavigate()
  const [metrics, setMetrics] = useState<MetricRow[]>([])
  const [totalRaisedPhp, setTotalRaisedPhp] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([getSafehouseMonthlyMetrics(), getDonations()])
      .then(([m, d]) => {
        setMetrics(m ?? [])
        const total = (d ?? [])
          .filter((r) => r.donation_type === 'Monetary')
          .reduce((sum, r) => sum + toNumber(r.amount), 0)
        setTotalRaisedPhp(total)
      })
      .catch(() => setError('Failed to load impact data. Please try again later.'))
      .finally(() => setLoading(false))
  }, [])


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

  // For fields that may be NULL in the latest month, find the most recent month with real data
  const latestMonthWithEducation = useMemo(() => {
    const months = [...new Set(metrics.map(r => String(r.month_start ?? '').slice(0, 7)).filter(Boolean))].sort()
    for (let i = months.length - 1; i >= 0; i--) {
      const rows = metrics.filter(r => String(r.month_start ?? '').startsWith(months[i]))
      if (rows.some(r => r.avg_education_progress != null && toNumber(r.avg_education_progress) > 0)) return rows
    }
    return []
  }, [metrics])

  const latestMonthWithHealth = useMemo(() => {
    const months = [...new Set(metrics.map(r => String(r.month_start ?? '').slice(0, 7)).filter(Boolean))].sort()
    for (let i = months.length - 1; i >= 0; i--) {
      const rows = metrics.filter(r => String(r.month_start ?? '').startsWith(months[i]))
      if (rows.some(r => r.avg_health_score != null && toNumber(r.avg_health_score) > 0)) return rows
    }
    return []
  }, [metrics])

  const latestMonthWithVisits = useMemo(() => {
    const months = [...new Set(metrics.map(r => String(r.month_start ?? '').slice(0, 7)).filter(Boolean))].sort()
    for (let i = months.length - 1; i >= 0; i--) {
      const rows = metrics.filter(r => String(r.month_start ?? '').startsWith(months[i]))
      if (rows.some(r => toNumber(r.home_visitation_count) > 0)) return rows
    }
    return []
  }, [metrics])

  const totals = useMemo(() => {
    const activeResidents = latestMonthRows.reduce((sum, r) => sum + toNumber(r.active_residents), 0)
    const avgEducation = latestMonthWithEducation.length
      ? latestMonthWithEducation.reduce((sum, r) => sum + toNumber(r.avg_education_progress), 0) / latestMonthWithEducation.length
      : 0
    const avgHealth = latestMonthWithHealth.length
      ? latestMonthWithHealth.reduce((sum, r) => sum + toNumber(r.avg_health_score), 0) / latestMonthWithHealth.length
      : 0
    const processNotes = latestMonthRows.reduce((sum, r) => sum + toNumber(r.process_recording_count), 0)
    const visits = latestMonthWithVisits.reduce((sum, r) => sum + toNumber(r.home_visitation_count), 0)
    return { activeResidents, avgEducation, avgHealth, processNotes, visits }
  }, [latestMonthRows, latestMonthWithEducation, latestMonthWithHealth, latestMonthWithVisits])

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
        <div className="impact-hero-visual">
          <img src={handsTogether} alt="Community members with hands together" className="impact-hero-img" />
        </div>
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
                  {
                    value: totals.activeResidents.toLocaleString(),
                    label: 'Girls in our care',
                    sub: 'Residents living in our safehouses this month',
                  },
                  {
                    value: totals.avgEducation.toFixed(0) + '%',
                    label: 'Education progress',
                    sub: 'Average academic progress across enrolled girls',
                  },
                  {
                    value: totals.processNotes.toLocaleString(),
                    label: 'Counseling sessions',
                    sub: 'Individual and group sessions supporting emotional healing',
                  },
                  {
                    value: totals.visits.toLocaleString(),
                    label: 'Family visits',
                    sub: 'Home visits to families preparing girls for reunification',
                  },
                ].map(({ value, label, sub }) => (
                  <div key={label} className="impact-stat">
                    <span className="impact-stat-value">{value}</span>
                    <span className="impact-stat-label">{label}</span>
                    <span className="impact-stat-sub">{sub}</span>
                  </div>
                ))}
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
