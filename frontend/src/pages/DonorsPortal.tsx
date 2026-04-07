import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDonations, getDonationAllocations, getInKindDonationItems } from '../api/donations'
import { getSupporters } from '../api/supporters'
import './DonorsPortal.css'

type Row = Record<string, unknown>
type Tab = 'donations' | 'supporters' | 'allocations' | 'inkind'

const TABS: { id: Tab; label: string }[] = [
  { id: 'donations', label: 'Donations' },
  { id: 'supporters', label: 'Supporters' },
  { id: 'allocations', label: 'Allocations' },
  { id: 'inkind', label: 'In-Kind Items' },
]

export default function DonorsPortal() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('donations')
  const [data, setData] = useState<Record<Tab, Row[]>>({
    donations: [], supporters: [], allocations: [], inkind: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [visible, setVisible] = useState(12)

  useEffect(() => {
    Promise.all([
      getDonations(),
      getSupporters(),
      getDonationAllocations(),
      getInKindDonationItems(),
    ])
      .then(([donations, supporters, allocations, inkind]) => {
        setData({ donations, supporters, allocations, inkind })
      })
      .catch(() => setError('Failed to load donor data.'))
      .finally(() => setLoading(false))
  }, [])

  const rows = data[tab]
  const filtered = rows.filter((r) =>
    Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(search.toLowerCase()))
  )

  const totalMonetary = data.donations
    .filter((d) => d.donation_type === 'Monetary')
    .reduce((sum, d) => sum + Number(d.amount ?? 0), 0)

  const renderCard = (r: Row, i: number) => {
    switch (tab) {
      case 'donations':
        return (
          <div key={i} className="donor-card">
            <div className="donor-card-header">
              <span className={`type-badge type-${String(r.donation_type ?? '').toLowerCase()}`}>{String(r.donation_type ?? '—')}</span>
              <span className="donor-date">{String(r.donation_date ?? '—')}</span>
            </div>
            <div className="donor-card-body">
              <div className="donor-field"><span className="field-label">Channel</span><span>{String(r.channel_source ?? '—')}</span></div>
              {!!r.amount && <div className="donor-field"><span className="field-label">Amount</span><span>₱{Number(r.amount).toLocaleString()}</span></div>}
              {!!r.campaign_name && <div className="donor-field"><span className="field-label">Campaign</span><span>{String(r.campaign_name)}</span></div>}
              <div className="donor-field"><span className="field-label">Recurring</span><span>{r.is_recurring ? 'Yes' : 'No'}</span></div>
            </div>
          </div>
        )
      case 'supporters':
        return (
          <div key={i} className="donor-card">
            <div className="donor-card-header">
              <span className="supporter-name">{String(r.display_name ?? '—')}</span>
              <span className={`status-badge status-${String(r.status ?? '').toLowerCase()}`}>{String(r.status ?? '—')}</span>
            </div>
            <div className="donor-card-body">
              <div className="donor-field"><span className="field-label">Type</span><span>{String(r.supporter_type ?? '—')}</span></div>
              <div className="donor-field"><span className="field-label">Relationship</span><span>{String(r.relationship_type ?? '—')}</span></div>
              {!!r.first_donation_date && <div className="donor-field"><span className="field-label">First Donation</span><span>{String(r.first_donation_date)}</span></div>}
              {!!r.acquisition_channel && <div className="donor-field"><span className="field-label">Source</span><span>{String(r.acquisition_channel)}</span></div>}
            </div>
          </div>
        )
      case 'allocations':
        return (
          <div key={i} className="donor-card">
            <div className="donor-card-header">
              <span className="supporter-name">{String(r.program_area ?? '—')}</span>
              <span className="donor-date">{String(r.allocation_date ?? '—')}</span>
            </div>
            <div className="donor-card-body">
              <div className="donor-field"><span className="field-label">Amount</span><span>₱{Number(r.amount_allocated ?? 0).toLocaleString()}</span></div>
              <div className="donor-field"><span className="field-label">Donation ID</span><span>#{String(r.donation_id ?? '—')}</span></div>
              <div className="donor-field"><span className="field-label">Safehouse ID</span><span>#{String(r.safehouse_id ?? '—')}</span></div>
              {!!r.allocation_notes && <div className="donor-field"><span className="field-label">Notes</span><span>{String(r.allocation_notes).slice(0, 60)}</span></div>}
            </div>
          </div>
        )
      case 'inkind':
        return (
          <div key={i} className="donor-card">
            <div className="donor-card-header">
              <span className="supporter-name">{String(r.item_name ?? '—')}</span>
              <span className={`type-badge type-${String(r.received_condition ?? '').toLowerCase()}`}>{String(r.received_condition ?? '—')}</span>
            </div>
            <div className="donor-card-body">
              <div className="donor-field"><span className="field-label">Category</span><span>{String(r.item_category ?? '—')}</span></div>
              <div className="donor-field"><span className="field-label">Quantity</span><span>{String(r.quantity ?? '—')} {String(r.unit_of_measure ?? '')}</span></div>
              <div className="donor-field"><span className="field-label">Est. Value</span><span>₱{Number(r.estimated_unit_value ?? 0).toLocaleString()}/unit</span></div>
              <div className="donor-field"><span className="field-label">Intended Use</span><span>{String(r.intended_use ?? '—')}</span></div>
            </div>
          </div>
        )
    }
  }

  return (
    <main className="donors-page">
      <div className="donors-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <div>
          <h1>Donors Portal</h1>
          <p className="subtitle">Donations, supporters, and partner records</p>
        </div>
      </div>

      <div className="donors-stats">
        <div className="stat-card"><span className="stat-value">{data.donations.length}</span><span className="stat-label">Total Donations</span></div>
        <div className="stat-card"><span className="stat-value">{data.supporters.length}</span><span className="stat-label">Supporters</span></div>
        <div className="stat-card"><span className="stat-value">₱{totalMonetary.toLocaleString()}</span><span className="stat-label">Total Monetary</span></div>
        <div className="stat-card"><span className="stat-value">{data.donations.filter((d) => d.is_recurring).length}</span><span className="stat-label">Recurring</span></div>
      </div>

      <div className="tab-scroll">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); setSearch(''); setVisible(12) }}
          >
            {t.label}
            <span className="tab-count">{data[t.id].length}</span>
          </button>
        ))}
      </div>

      <div className="donors-controls">
        <input
          className="search-input"
          type="text"
          placeholder="Search across all fields..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setVisible(6) }}
        />
        <span className="count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p className="state-msg">Loading...</p>}
      {error && <p className="state-msg error">{error}</p>}

      {!loading && !error && (
        <div className="donors-grid">
          {filtered.slice(0, visible).map((r, i) => renderCard(r, i))}
          {filtered.length === 0 && <p className="state-msg">No records match your search.</p>}
        </div>
      )}
      {!loading && !error && visible < filtered.length && (
        <div className="load-more-wrap">
          <button className="load-more-btn" onClick={() => setVisible((v) => v + 12)}>
            See 12 more ({filtered.length - visible} remaining)
          </button>
        </div>
      )}
    </main>
  )
}
