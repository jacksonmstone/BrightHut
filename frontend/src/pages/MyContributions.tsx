import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSupporters } from '../api/supporters'
import { getDonations, getDonationAllocations } from '../api/donations'
import { createDonorDemoDonation } from '../api/donor'
import { phpToUsd, formatUsd } from '../components/donationProgress'
import './MyContributions.css'

type Row = Record<string, unknown>

function fmt(val: unknown) {
  const n = parseFloat(String(val ?? ''))
  return isNaN(n) ? '—' : formatUsd(phpToUsd(n))
}

function fmtDate(val: unknown) {
  const s = String(val ?? '').slice(0, 10)
  if (!s || s === 'null') return '—'
  const d = new Date(s + 'T00:00:00')
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function timeAgo(val: unknown) {
  const s = String(val ?? '').slice(0, 10)
  if (!s || s === 'null') return '—'
  const d = new Date(s + 'T00:00:00')
  if (isNaN(d.getTime())) return s
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

export default function MyContributions() {
  const navigate = useNavigate()
  const email = localStorage.getItem('email') ?? ''
  const rawName = email.split('@')[0]
  const firstName = rawName.charAt(0).toUpperCase() + rawName.slice(1)

  const [supporters, setSupporters] = useState<Row[]>([])
  const [donations, setDonations] = useState<Row[]>([])
  const [allocations, setAllocations] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [giftUsd, setGiftUsd] = useState('50')
  const [giftNote, setGiftNote] = useState('')
  const [giftSubmitting, setGiftSubmitting] = useState(false)
  const [giftMsg, setGiftMsg] = useState<string | null>(null)
  const [giftErr, setGiftErr] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([getSupporters(), getDonations(), getDonationAllocations()])
      .then(([s, d, a]) => {
        setSupporters(s)
        setDonations(d)
        setAllocations(a)
      })
      .catch(() => setError('Could not load your contribution data.'))
      .finally(() => setLoading(false))
  }, [refreshKey])

  // Match logged-in user to a supporter record by email
  const supporter = useMemo(
    () => supporters.find(s => String(s.email ?? '').toLowerCase() === email.toLowerCase()),
    [supporters, email]
  )

  const myDonations = useMemo(() => {
    if (!supporter) return []
    return donations
      .filter(d => d.supporter_id === supporter.supporter_id)
      .sort((a, b) => String(b.donation_date).localeCompare(String(a.donation_date)))
  }, [donations, supporter])

  const myAllocations = useMemo(() => {
    const myIds = new Set(myDonations.map(d => d.donation_id))
    return allocations.filter(a => myIds.has(a.donation_id))
  }, [allocations, myDonations])

  const totalGiven = useMemo(
    () => myDonations.filter(d => d.donation_type === 'Monetary').reduce((sum, d) => sum + parseFloat(String(d.amount ?? 0)), 0),
    [myDonations]
  )

  const allocationsByArea = useMemo(() => {
    const map: Record<string, number> = {}
    for (const a of myAllocations) {
      const area = String(a.program_area ?? 'Other')
      map[area] = (map[area] ?? 0) + parseFloat(String(a.amount_allocated ?? 0))
    }
    return Object.entries(map).filter(([, v]) => phpToUsd(v) >= 0.5).sort((a, b) => b[1] - a[1])
  }, [myAllocations])

  const handleDemoGift = async (e: React.FormEvent) => {
    e.preventDefault()
    setGiftErr(null)
    setGiftMsg(null)
    const n = parseFloat(giftUsd.replace(/,/g, ''))
    if (!Number.isFinite(n) || n <= 0) {
      setGiftErr('Enter a valid amount in USD.')
      return
    }
    if (n > 1_000_000) {
      setGiftErr('Amount is too large for a demo gift.')
      return
    }
    setGiftSubmitting(true)
    try {
      const res = await createDonorDemoDonation({
        amountUsd: n,
        notes: giftNote.trim() || undefined,
        campaignName: 'Donor Dashboard',
      })
      setGiftMsg(
        `Recorded ${formatUsd(res.amount_usd)} (stored as ₱${Math.round(res.amount_php).toLocaleString()}). Thank you!`
      )
      setGiftNote('')
      setRefreshKey((k) => k + 1)
    } catch (err) {
      setGiftErr(err instanceof Error ? err.message : 'Could not record your gift.')
    } finally {
      setGiftSubmitting(false)
    }
  }

  if (loading) return <main className="my-contributions"><p className="mc-loading">Loading your contributions…</p></main>
  if (error) return <main className="my-contributions"><p className="mc-error">{error}</p></main>

  return (
    <main className="my-contributions">
      <div className="mc-header">
        <button className="mc-back" onClick={() => window.history.back()}>← Back to Portal</button>
        <h1>Donor dashboard</h1>
        <p className="mc-subhead">
          Welcome back, <strong>{supporter ? String(supporter.first_name ?? firstName) : firstName}</strong>. Review your
          history and record a demo gift (no real payment).
        </p>
      </div>

      {/* Summary cards */}
      <div className="mc-summary">
        <div className="mc-card">
          <span className="mc-card-label">Total Given</span>
          <span className="mc-card-value">{fmt(totalGiven)}</span>
        </div>
        <div className="mc-card">
          <span className="mc-card-label">Donations Made</span>
          <span className="mc-card-value">{myDonations.length}</span>
        </div>
        <div className="mc-card">
          <span className="mc-card-label">Latest Gift</span>
          <span className="mc-card-value">
            {myDonations.length > 0 ? timeAgo(myDonations[0].donation_date) : '—'}
          </span>
        </div>
        <div className="mc-card">
          <span className="mc-card-label">Supporter Since</span>
          <span className="mc-card-value">
            {(() => {
              const explicit = supporter ? String(supporter.first_donation_date ?? '').slice(0, 10) : ''
              if (explicit && explicit !== 'null') return fmtDate(explicit)
              const earliest = myDonations.length > 0
                ? [...myDonations].sort((a, b) => String(a.donation_date).localeCompare(String(b.donation_date)))[0]
                : null
              return earliest ? fmtDate(earliest.donation_date) : '—'
            })()}
          </span>
        </div>
      </div>

      {/* Your Direct Impact — most important section, shown first */}
      <section className="mc-impact-card" aria-labelledby="mc-impact-heading">
        <div className="mc-impact-header">
          <h2 id="mc-impact-heading">Your Direct Impact</h2>
          <p className="mc-impact-desc">
            Here is exactly how BrightHut has put your <strong>{fmt(totalGiven)}</strong> to work across our program areas.
          </p>
        </div>
        {allocationsByArea.length === 0 ? (
          <div className="mc-empty-allocations">
            <span className="mc-empty-icon">🌱</span>
            <p>No allocations on record yet. Staff allocate funds after each donation cycle — check back soon.</p>
          </div>
        ) : (
          <>
            <div className="mc-allocations">
              {allocationsByArea.map(([area, amount]) => {
                const totalAllocated = allocationsByArea.reduce((s, [, v]) => s + v, 0)
                const pct = totalAllocated > 0 ? Math.round((amount / totalAllocated) * 100) : 0
                const areaColors: Record<string, string> = {
                  Education: '#4f8ef7',
                  Wellbeing: '#34c77b',
                  Transport: '#f5a623',
                  Operations: '#9b59b6',
                  Maintenance: '#e67e22',
                  Outreach: '#1abc9c',
                }
                const color = areaColors[area] ?? '#6b7280'
                return (
                  <div key={area} className="mc-allocation-row">
                    <div className="mc-allocation-meta">
                      <span className="mc-allocation-dot" style={{ background: color }} />
                      <span className="mc-allocation-label">{area}</span>
                      <span className="mc-allocation-pct">{pct}%</span>
                    </div>
                    <div className="mc-allocation-bar-wrap">
                      <div className="mc-allocation-bar" style={{ width: `${pct}%`, background: color }} />
                    </div>
                    <span className="mc-allocation-amount">{fmt(amount)}</span>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </section>

      <div className="mc-actions-row">
        <button type="button" className="mc-donate-btn mc-donate-btn--secondary" onClick={() => navigate('/donate')}>
          Make Another Donation
        </button>
      </div>

      <section className="mc-gift-card" aria-labelledby="mc-gift-heading">
        <h2 id="mc-gift-heading">Record a demo gift</h2>
        <p className="mc-gift-lead">
          This does not charge a real card — it saves a monetary gift to our database so you can see your history update
          instantly (amounts are stored in Philippine pesos using the same rate as the rest of the site).
        </p>
        <form className="mc-gift-form" onSubmit={handleDemoGift}>
          <label className="mc-gift-label">
            Amount (USD)
            <input
              type="text"
              inputMode="decimal"
              className="mc-gift-input"
              value={giftUsd}
              onChange={(e) => setGiftUsd(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="mc-gift-label mc-gift-label--full">
            Note (optional)
            <input
              type="text"
              className="mc-gift-input"
              value={giftNote}
              onChange={(e) => setGiftNote(e.target.value)}
              placeholder="In honor of…"
            />
          </label>
          <button type="submit" className="mc-gift-submit" disabled={giftSubmitting}>
            {giftSubmitting ? 'Saving…' : 'Save gift to database'}
          </button>
        </form>
        {giftErr ? (
          <p className="mc-gift-feedback mc-gift-feedback--error" role="alert">
            {giftErr}
          </p>
        ) : null}
        {giftMsg ? <p className="mc-gift-feedback mc-gift-feedback--ok">{giftMsg}</p> : null}
      </section>

      {!supporter ? (
        <div className="mc-empty mc-empty--soft">
          <p>
            No supporter profile was on file for <strong>{email}</strong> yet — use &quot;Record a demo gift&quot; above to
            create one and see your giving history below.
          </p>
        </div>
      ) : null}

      {/* Donation history */}
      <section className="mc-section">
        <h2>Donation History</h2>
        {myDonations.length === 0 ? (
          <p className="mc-empty-sub">No donations on record yet — add a demo gift above.</p>
        ) : (
          <div className="mc-table-wrap">
            <table className="mc-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Currency</th>
                  <th>Channel</th>
                  <th>Campaign</th>
                  <th>Recurring</th>
                </tr>
              </thead>
              <tbody>
                {myDonations.map((d) => (
                  <tr key={String(d.donation_id)}>
                    <td>{String(d.donation_date).slice(0, 10)}</td>
                    <td>{String(d.donation_type ?? '—')}</td>
                    <td>{d.amount != null ? fmt(d.amount) : '—'}</td>
                    <td>{String(d.currency_code ?? '—')}</td>
                    <td>{String(d.channel_source ?? '—')}</td>
                    <td>{String(d.campaign_name ?? '—')}</td>
                    <td>{d.is_recurring ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

    </main>
  )
}
