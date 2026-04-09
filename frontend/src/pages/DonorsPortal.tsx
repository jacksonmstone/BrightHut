import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDonations, getDonationAllocations, getInKindDonationItems } from '../api/donations'
import { getSupporters, getDonorChurnRisk, getDonorUpgradePotential, type DonorChurnEntry, type DonorUpgradeEntry } from '../api/supporters'
import { insertRow, updateRow } from '../api/tables'
import FormModal from '../components/FormModal'
import PaginationBar from '../components/PaginationBar'
import type { FieldDef } from '../components/FormModal'
import { phpToUsd, formatUsd } from '../components/donationProgress'
import './DonorsPortal.css'

type Row = Record<string, unknown>
type Tab = 'donations' | 'supporters' | 'allocations' | 'inkind'

const TABS: { id: Tab; label: string }[] = [
  { id: 'donations', label: 'Donations' },
  { id: 'supporters', label: 'Supporters' },
  { id: 'allocations', label: 'Allocations' },
  { id: 'inkind', label: 'In-Kind Items' },
]

const SUPPORTER_FIELDS: FieldDef[] = [
  { key: 'display_name', label: 'Display Name', type: 'text', required: true },
  { key: 'supporter_type', label: 'Supporter Type', type: 'select', required: true, options: ['MonetaryDonor','InKindDonor','Volunteer','SkillsContributor','SocialMediaAdvocate','PartnerOrganization'] },
  { key: 'relationship_type', label: 'Relationship Type', type: 'select', required: true, options: ['Local','International','PartnerOrganization'] },
  { key: 'first_name', label: 'First Name', type: 'text' },
  { key: 'last_name', label: 'Last Name', type: 'text' },
  { key: 'organization_name', label: 'Organization Name', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'phone', label: 'Phone', type: 'text' },
  { key: 'region', label: 'Region', type: 'text' },
  { key: 'country', label: 'Country', type: 'text' },
  { key: 'status', label: 'Status', type: 'select', required: true, options: ['Active','Inactive'] },
  { key: 'acquisition_channel', label: 'Acquisition Channel', type: 'select', options: ['Website','SocialMedia','Event','WordOfMouth','PartnerReferral','Church'] },
  { key: 'first_donation_date', label: 'First Donation Date', type: 'date' },
]

const DONATION_FIELDS: FieldDef[] = [
  { key: 'supporter_id', label: 'Supporter ID', type: 'number', required: true, placeholder: 'Enter supporter_id number' },
  { key: 'donation_type', label: 'Donation Type', type: 'select', required: true, options: ['Monetary','InKind','Time','Skills','SocialMedia'] },
  { key: 'donation_date', label: 'Donation Date', type: 'date', required: true },
  { key: 'channel_source', label: 'Channel Source', type: 'select', required: true, options: ['Campaign','Event','Direct','SocialMedia','PartnerReferral'] },
  { key: 'amount', label: 'Amount (PHP)', type: 'number' },
  { key: 'currency_code', label: 'Currency Code', type: 'text', placeholder: 'PHP' },
  { key: 'impact_unit', label: 'Impact Unit', type: 'select', required: true, options: ['pesos','items','hours','campaigns'] },
  { key: 'is_recurring', label: 'Recurring Donation', type: 'checkbox' },
  { key: 'campaign_name', label: 'Campaign Name', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
]

type FormState = { mode: 'add-supporter' | 'add-donation' | 'edit-supporter' | 'edit-donation'; record?: Row }

function donorRowKey(tab: Tab, r: Row): string {
  switch (tab) {
    case 'donations':
      return `d-${String(r.donation_id ?? '')}`
    case 'supporters':
      return `s-${String(r.supporter_id ?? '')}`
    case 'allocations':
      return `a-${String(r.allocation_id ?? '')}`
    case 'inkind':
      return `i-${String(r.item_id ?? '')}`
    default:
      return JSON.stringify(r)
  }
}

function getChurnAction(rawKey: string, tier: string): string {
  if (tier === 'Stable') return ''
  switch (rawKey) {
    case 'recency_days':
      return tier === 'At Risk'
        ? 'Send a personal re-engagement note referencing their last gift and its specific impact.'
        : 'Schedule a touchpoint — a brief impact update email can re-establish connection.'
    case 'frequency':
      return 'Low giving history — invite them into a recurring monthly giving program to build habit.'
    case 'avg_gap_days':
      return tier === 'At Risk'
        ? 'Long gaps between gifts — offer a simple automatic monthly pledge option.'
        : 'Remind them of impact between gifts with a mid-year update.'
    case 'is_international':
      return 'International donors lapse at higher rates — share a video impact story of the safehouses they support.'
    case 'org_tenure_days':
      return 'Long relationship showing signs of fatigue — a personal thank-you from leadership can re-energize their commitment.'
    default:
      return tier === 'At Risk'
        ? 'Reach out personally — share a specific resident success story and express gratitude for their support.'
        : 'Send a mid-cycle impact update to keep them engaged.'
  }
}

function getUpgradeAction(rawKey: string, tier: string): string {
  if (tier === 'LOW') return ''
  switch (rawKey) {
    case 'pct_increases':
      return tier === 'HIGH'
        ? 'Consistent pattern of increasing gifts — make a direct, specific upgrade ask now.'
        : 'Growing giving pattern — nurture with impact updates, then ask for a step up.'
    case 'giving_slope':
      return tier === 'HIGH'
        ? 'Gift amounts are trending upward — suggest the next giving level directly.'
        : 'Positive trend — introduce a named giving opportunity at the next level.'
    case 'frequency':
      return tier === 'HIGH'
        ? 'Highly active donor — invite to a major gifts program or leadership giving circle.'
        : 'Regular giver — acknowledge their loyalty before making a step-up ask.'
    case 'freq_accel':
      return tier === 'HIGH'
        ? 'Giving frequency is accelerating — capitalize with a matching gift campaign invitation.'
        : 'Increasing engagement — a campaign-linked upgrade ask is well-timed.'
    case 'tenure_days':
      return tier === 'HIGH'
        ? 'Long-term loyal supporter — frame the upgrade as recognition of their sustained commitment.'
        : 'Established relationship — a personal thank-you with a suggested increase is appropriate.'
    case 'has_inkind':
      return tier === 'HIGH'
        ? 'Deep multi-modal commitment — personally invite to a named or leadership giving circle.'
        : 'Shows broad support — introduce a portfolio giving option.'
    case 'num_safehouses_supported':
      return tier === 'HIGH'
        ? 'Supports multiple safehouses — frame upgrade as expanding to fund one more home.'
        : 'Multi-house donor — introduce the idea of broader program sponsorship.'
    case 'log_avg_amount':
      return tier === 'HIGH'
        ? 'Already giving at a meaningful level — ask for a specific percentage increase.'
        : 'Mid-level giver — suggest a modest step-up framed around a concrete impact milestone.'
    default:
      return tier === 'HIGH'
        ? 'Strong upgrade signals — make a direct, personalized ask now.'
        : 'Building momentum — nurture with impact updates before making an upgrade ask.'
  }
}

export default function DonorsPortal() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('donations')
  const [data, setData] = useState<Record<Tab, Row[]>>({
    donations: [], supporters: [], allocations: [], inkind: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterChurn, setFilterChurn] = useState('')
  const [filterUpgrade, setFilterUpgrade] = useState('')
  const [churnScores, setChurnScores] = useState<Map<number, DonorChurnEntry>>(new Map())
  const [upgradeScores, setUpgradeScores] = useState<Map<number, DonorUpgradeEntry>>(new Map())
  const [formState, setFormState] = useState<FormState | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    Promise.all([getDonations(), getSupporters(), getDonationAllocations(), getInKindDonationItems()])
      .then(([donations, supporters, allocations, inkind]) => {
        setData({ donations, supporters, allocations, inkind })
      })
      .catch(() => setError('Failed to load donor data.'))
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
  }, [refreshKey])

  const totalMonetary = data.donations.filter(d => d.donation_type === 'Monetary').reduce((sum, d) => sum + Number(d.amount ?? 0), 0)

  const rows = data[tab]
  const filtered = rows.filter((r) => {
    const matchSearch = Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(search.toLowerCase()))
    if (tab === 'supporters') {
      const matchType = !filterType || r.supporter_type === filterType
      const matchStatus = !filterStatus || r.status === filterStatus
      const matchChurn = !filterChurn || churnScores.get(Number(r.supporter_id))?.churnTier === filterChurn
      const matchUpgrade = !filterUpgrade || upgradeScores.get(Number(r.supporter_id))?.upgradeTier === filterUpgrade
      return matchSearch && matchType && matchStatus && matchChurn && matchUpgrade
    }
    return matchSearch
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1)
  const currentPage = Math.min(page, totalPages)
  const pagedRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [tab, search, filterType, filterStatus])

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const supporterMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of data.supporters) {
      m.set(Number(s.supporter_id), String(s.display_name ?? ''))
    }
    return m
  }, [data.supporters])

  const handleSave = async (d: Record<string, unknown>) => {
    if (!formState) return
    console.log('[DonorsPortal] handleSave mode:', formState.mode, 'data:', d)
    if (formState.mode === 'add-supporter') {
      await insertRow('supporters', d)
    } else if (formState.mode === 'add-donation') {
      await insertRow('donations', { ...d, currency_code: d.currency_code || 'PHP' })
    } else if (formState.mode === 'edit-supporter' && formState.record) {
      console.log('[DonorsPortal] updating supporter id:', formState.record.supporter_id)
      await updateRow('supporters', Number(formState.record.supporter_id), d)
    } else if (formState.mode === 'edit-donation' && formState.record) {
      console.log('[DonorsPortal] updating donation id:', formState.record.donation_id)
      await updateRow('donations', Number(formState.record.donation_id), d)
    }
    setRefreshKey(k => k + 1)
  }

  const renderCard = (r: Row, rk: string) => {
    switch (tab) {
      case 'donations': {
        const donorName = supporterMap.get(Number(r.supporter_id)) || '—'
        return (
          <div key={rk} className="donor-card">
            <div className="donor-card-header">
              <span className={`type-badge type-${String(r.donation_type ?? '').toLowerCase()}`}>{String(r.donation_type ?? '—')}</span>
              <span className="donor-date">{String(r.donation_date ?? '—')}</span>
              <button className="dp-edit-btn" onClick={() => setFormState({ mode: 'edit-donation', record: r })}>Edit</button>
            </div>
            <div className="donor-card-body">
              <div className="donor-field"><span className="field-label">Donor</span><span className="donor-name-val">{donorName}</span></div>
              <div className="donor-field"><span className="field-label">Channel</span><span>{String(r.channel_source ?? '—')}</span></div>
              {!!r.amount && <div className="donor-field"><span className="field-label">Amount</span><span>{formatUsd(phpToUsd(Number(r.amount)))}</span></div>}
              {!!r.campaign_name && <div className="donor-field"><span className="field-label">Campaign</span><span>{String(r.campaign_name)}</span></div>}
              <div className="donor-field"><span className="field-label">Recurring</span><span>{r.is_recurring ? 'Yes' : 'No'}</span></div>
            </div>
          </div>
        )
      }
      case 'supporters': {
        const churn = churnScores.get(Number(r.supporter_id))
        const churnTierKey = churn?.churnTier === 'At Risk' ? 'risk'
                           : churn?.churnTier === 'Moderate' ? 'moderate'
                           : 'stable'
        const upgrade = upgradeScores.get(Number(r.supporter_id))
        const upgradeTierKey = upgrade?.upgradeTier === 'HIGH' ? 'high'
                             : upgrade?.upgradeTier === 'MEDIUM' ? 'medium'
                             : 'low'
        return (
          <div key={rk} className="donor-card">
            <div className="donor-card-header">
              <span className="supporter-name">{String(r.display_name ?? '—')}</span>
              <span className={`status-badge status-${String(r.status ?? '').toLowerCase()}`}>{String(r.status ?? '—')}</span>
              <button className="dp-edit-btn" onClick={() => setFormState({ mode: 'edit-supporter', record: r })}>Edit</button>
            </div>
            <div className="donor-card-body">
              <div className="donor-field"><span className="field-label">Type</span><span>{String(r.supporter_type ?? '—')}</span></div>
              <div className="donor-field"><span className="field-label">Relationship</span><span>{String(r.relationship_type ?? '—')}</span></div>
              {!!r.email && <div className="donor-field"><span className="field-label">Email</span><span>{String(r.email)}</span></div>}
              {!!r.first_donation_date && <div className="donor-field"><span className="field-label">First Donation</span><span>{String(r.first_donation_date)}</span></div>}
              {!!r.acquisition_channel && <div className="donor-field"><span className="field-label">Source</span><span>{String(r.acquisition_channel)}</span></div>}
              {churn && (
                <div className="dp-churn-row">
                  <span className={`dp-churn-badge dp-churn-badge--${churnTierKey}`}>{churn.churnTier}</span>
                  <div className="dp-churn-bar-track">
                    <div className={`dp-churn-bar-fill dp-churn-bar-fill--${churnTierKey}`} style={{ width: `${Math.round(churn.churnProbability * 100)}%` }} />
                  </div>
                  <span className="dp-churn-pct">{Math.round(churn.churnProbability * 100)}%</span>
                </div>
              )}
              {churn?.topRiskDriver && (
                <div className="donor-field dp-churn-driver">
                  <span className="field-label">Risk factor</span>
                  <span>{churn.topRiskDriver.feature}</span>
                </div>
              )}
              {churn && (() => {
                const suggestion = getChurnAction(churn.topRiskDriver?.rawKey ?? '', churn.churnTier)
                return suggestion ? (
                  <div className="dp-suggestion dp-suggestion--churn">
                    <span className="dp-suggestion-icon">→</span>
                    <span>{suggestion}</span>
                  </div>
                ) : null
              })()}
              {upgrade && (
                <div className="dp-upgrade-row">
                  <span className={`dp-upgrade-badge dp-upgrade-badge--${upgradeTierKey}`}>{upgrade.upgradeTier} upgrade</span>
                  <div className="dp-churn-bar-track">
                    <div className={`dp-upgrade-bar-fill dp-upgrade-bar-fill--${upgradeTierKey}`} style={{ width: `${Math.round(upgrade.upgradeProbability * 100)}%` }} />
                  </div>
                  <span className="dp-churn-pct">{Math.round(upgrade.upgradeProbability * 100)}%</span>
                </div>
              )}
              {upgrade?.topUpgradeSignal && (
                <div className="donor-field dp-churn-driver">
                  <span className="field-label">Upgrade signal</span>
                  <span>{upgrade.topUpgradeSignal.feature}</span>
                </div>
              )}
              {upgrade && (() => {
                const suggestion = getUpgradeAction(upgrade.topUpgradeSignal?.rawKey ?? '', upgrade.upgradeTier)
                return suggestion ? (
                  <div className="dp-suggestion dp-suggestion--upgrade">
                    <span className="dp-suggestion-icon">→</span>
                    <span>{suggestion}</span>
                  </div>
                ) : null
              })()}
            </div>
          </div>
        )
      }
      case 'allocations':
        return (
          <div key={rk} className="donor-card">
            <div className="donor-card-header">
              <span className="supporter-name">{String(r.program_area ?? '—')}</span>
              <span className="donor-date">{String(r.allocation_date ?? '—')}</span>
            </div>
            <div className="donor-card-body">
              <div className="donor-field"><span className="field-label">Amount</span><span>{formatUsd(phpToUsd(Number(r.amount_allocated ?? 0)))}</span></div>
              <div className="donor-field"><span className="field-label">Donation ID</span><span>#{String(r.donation_id ?? '—')}</span></div>
              <div className="donor-field"><span className="field-label">Safehouse ID</span><span>#{String(r.safehouse_id ?? '—')}</span></div>
              {!!r.allocation_notes && <div className="donor-field"><span className="field-label">Notes</span><span>{String(r.allocation_notes).slice(0, 60)}</span></div>}
            </div>
          </div>
        )
      case 'inkind':
        return (
          <div key={rk} className="donor-card">
            <div className="donor-card-header">
              <span className="supporter-name">{String(r.item_name ?? '—')}</span>
              <span className={`type-badge type-${String(r.received_condition ?? '').toLowerCase()}`}>{String(r.received_condition ?? '—')}</span>
            </div>
            <div className="donor-card-body">
              <div className="donor-field"><span className="field-label">Category</span><span>{String(r.item_category ?? '—')}</span></div>
              <div className="donor-field"><span className="field-label">Quantity</span><span>{String(r.quantity ?? '—')} {String(r.unit_of_measure ?? '')}</span></div>
              <div className="donor-field"><span className="field-label">Est. Value</span><span>{formatUsd(phpToUsd(Number(r.estimated_unit_value ?? 0)))}/unit</span></div>
              <div className="donor-field"><span className="field-label">Intended Use</span><span>{String(r.intended_use ?? '—')}</span></div>
            </div>
          </div>
        )
    }
  }

  const modalProps = formState ? (
    formState.mode === 'add-supporter' ? { title: 'Add Supporter', fields: SUPPORTER_FIELDS, initialData: undefined } :
    formState.mode === 'edit-supporter' ? { title: 'Edit Supporter', fields: SUPPORTER_FIELDS, initialData: formState.record } :
    formState.mode === 'add-donation' ? { title: 'Add Donation', fields: DONATION_FIELDS, initialData: undefined } :
    { title: 'Edit Donation', fields: DONATION_FIELDS, initialData: formState.record }
  ) : null

  return (
    <main className="donors-page">
      {formState && modalProps && (
        <FormModal
          title={modalProps.title}
          fields={modalProps.fields}
          initialData={modalProps.initialData}
          onSave={handleSave}
          onClose={() => setFormState(null)}
        />
      )}

      <div className="donors-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <div>
          <h1>Donors &amp; contributions</h1>
          <p className="subtitle">Donations, supporters, and partner records</p>
        </div>
      </div>

      <div className="donors-stats">
        <div className="stat-card"><span className="stat-value">{data.donations.length}</span><span className="stat-label">Total Donations</span></div>
        <div className="stat-card"><span className="stat-value">{data.supporters.length}</span><span className="stat-label">Supporters</span></div>
        <div className="stat-card"><span className="stat-value">{formatUsd(phpToUsd(totalMonetary))}</span><span className="stat-label">Total Monetary</span></div>
        <div className="stat-card"><span className="stat-value">{data.donations.filter((d) => d.is_recurring).length}</span><span className="stat-label">Recurring</span></div>
      </div>

      <div className="tab-scroll">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? 'active' : ''}`}
            onClick={() => { setTab(t.id); setSearch(''); setPage(1); setFilterType(''); setFilterStatus(''); setFilterChurn(''); setFilterUpgrade('') }}
          >
            {t.label}
            <span className="tab-count">{data[t.id].length}</span>
          </button>
        ))}
      </div>

      {tab === 'supporters' && (
        <>
          <div className="dp-filters">
            <select className="pp-filter-select" value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}>
              <option value="">All Types</option>
              {['MonetaryDonor','InKindDonor','Volunteer','SkillsContributor','SocialMediaAdvocate','PartnerOrganization'].map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select className="pp-filter-select" value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
              <option value="">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            {churnScores.size > 0 && (
              <select className="pp-filter-select" value={filterChurn} onChange={e => { setFilterChurn(e.target.value); setPage(1) }}>
                <option value="">All Churn Risk</option>
                <option value="At Risk">At Risk</option>
                <option value="Moderate">Moderate</option>
                <option value="Stable">Stable</option>
              </select>
            )}
            {upgradeScores.size > 0 && (
              <select className="pp-filter-select" value={filterUpgrade} onChange={e => { setFilterUpgrade(e.target.value); setPage(1) }}>
                <option value="">All Upgrade Potential</option>
                <option value="HIGH">High Potential</option>
                <option value="MEDIUM">Medium Potential</option>
                <option value="LOW">Low Potential</option>
              </select>
            )}
          </div>
        </>
      )}

      <div className="donors-controls">
        <input
          className="search-input"
          type="text"
          placeholder="Search across all fields..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <span className="count">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        {tab === 'supporters' && (
          <button className="dp-add-btn" onClick={() => setFormState({ mode: 'add-supporter' })}>+ Add Supporter</button>
        )}
        {tab === 'donations' && (
          <button className="dp-add-btn" onClick={() => setFormState({ mode: 'add-donation' })}>+ Add Donation</button>
        )}
      </div>

      {loading && <p className="state-msg">Loading...</p>}
      {error && <p className="state-msg error">{error}</p>}

      {!loading && !error && (
        <>
          <div className="donors-grid" aria-describedby="donors-pagination-nav">
            {pagedRows.map((r) => renderCard(r, donorRowKey(tab, r)))}
            {filtered.length === 0 && <p className="state-msg">No records match your search.</p>}
          </div>
          {filtered.length > 0 && (
            <PaginationBar
              page={currentPage}
              pageSize={pageSize}
              totalItems={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={(n) => {
                setPageSize(n)
                setPage(1)
              }}
              labelId="donors-pagination"
            />
          )}
        </>
      )}
    </main>
  )
}
