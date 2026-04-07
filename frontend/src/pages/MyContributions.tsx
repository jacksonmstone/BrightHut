import { useEffect, useMemo, useState } from 'react'
import { getSupporters } from '../api/supporters'
import { getDonations, getDonationAllocations } from '../api/donations'
import './MyContributions.css'

type Row = Record<string, unknown>

function fmt(val: unknown) {
  const n = parseFloat(String(val ?? ''))
  return isNaN(n) ? '—' : n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function MyContributions() {
  const email = localStorage.getItem('email') ?? ''
  const firstName = email.split('@')[0]

  const [supporters, setSupporters] = useState<Row[]>([])
  const [donations, setDonations] = useState<Row[]>([])
  const [allocations, setAllocations] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getSupporters(), getDonations(), getDonationAllocations()])
      .then(([s, d, a]) => {
        setSupporters(s)
        setDonations(d)
        setAllocations(a)
      })
      .catch(() => setError('Could not load your contribution data.'))
      .finally(() => setLoading(false))
  }, [])

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
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [myAllocations])

  if (loading) return <main className="my-contributions"><p className="mc-loading">Loading your contributions…</p></main>
  if (error) return <main className="my-contributions"><p className="mc-error">{error}</p></main>

  return (
    <main className="my-contributions">
      <div className="mc-header">
        <h1>My Contributions</h1>
        <p className="mc-subhead">Welcome back, <strong>{supporter ? String(supporter.first_name ?? firstName) : firstName}</strong>. Here's your giving history.</p>
      </div>

      {/* Summary cards */}
      <div className="mc-summary">
        <div className="mc-card">
          <span className="mc-card-label">Total Given</span>
          <span className="mc-card-value">₱{fmt(totalGiven)}</span>
        </div>
        <div className="mc-card">
          <span className="mc-card-label">Donations Made</span>
          <span className="mc-card-value">{myDonations.length}</span>
        </div>
        <div className="mc-card">
          <span className="mc-card-label">Latest Gift</span>
          <span className="mc-card-value">
            {myDonations.length > 0 ? String(myDonations[0].donation_date).slice(0, 10) : '—'}
          </span>
        </div>
        <div className="mc-card">
          <span className="mc-card-label">Supporter Since</span>
          <span className="mc-card-value">
            {supporter ? String(supporter.first_donation_date ?? '—').slice(0, 10) : '—'}
          </span>
        </div>
      </div>

      {!supporter ? (
        <div className="mc-empty">
          <p>No contribution records found for <strong>{email}</strong>.</p>
          <p className="mc-empty-sub">Once your account is linked to a donation, your history will appear here.</p>
        </div>
      ) : (
        <>
          {/* Donation history */}
          <section className="mc-section">
            <h2>Donation History</h2>
            {myDonations.length === 0 ? (
              <p className="mc-empty-sub">No donations on record yet.</p>
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

          {/* Where your money goes */}
          {allocationsByArea.length > 0 && (
            <section className="mc-section">
              <h2>Where Your Gifts Go</h2>
              <div className="mc-allocations">
                {allocationsByArea.map(([area, amount]) => (
                  <div key={area} className="mc-allocation-row">
                    <span className="mc-allocation-label">{area}</span>
                    <div className="mc-allocation-bar-wrap">
                      <div
                        className="mc-allocation-bar"
                        style={{ width: `${Math.min(100, (amount / totalGiven) * 100)}%` }}
                      />
                    </div>
                    <span className="mc-allocation-amount">₱{fmt(amount)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  )
}
