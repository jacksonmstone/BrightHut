import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDonations } from '../api/donations'
import {
  computeMonthlyGoalUsd,
  formatUsd,
  phpToUsd,
  progressPercent,
  sumMonetaryPhpForYear,
  type DonationRow,
} from './donationProgress'
import './DonationCallout.css'

const PRESET_AMOUNTS_USD = [25, 50, 100, 250, 500, 1000] as const

export default function DonationCallout() {
  const navigate = useNavigate()
  const isStaff = localStorage.getItem('role') === 'staff'
  if (isStaff) return null

  const [selected, setSelected] = useState<number | null>(null)
  const [customRaw, setCustomRaw] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [rows, setRows] = useState<DonationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getDonations()
      .then((data) => { if (!cancelled) setRows((data ?? []) as DonationRow[]) })
      .catch(() => { if (!cancelled) { setLoadError('Could not load donation totals.'); setRows([]) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const currentYear = new Date().getFullYear()
  const raisedPhpThisYear = useMemo(() => sumMonetaryPhpForYear(rows, currentYear), [rows, currentYear])
  const raisedUsdThisYear = useMemo(() => phpToUsd(raisedPhpThisYear), [raisedPhpThisYear])
  const yearlyGoalUsd = useMemo(() => computeMonthlyGoalUsd(rows) * 12, [rows])
  const percent = useMemo(() => progressPercent(raisedUsdThisYear, yearlyGoalUsd), [raisedUsdThisYear, yearlyGoalUsd])

  const customAmount = parseFloat(customRaw.replace(/,/g, ''))
  const effectiveAmount = selected ?? (!Number.isNaN(customAmount) && customAmount > 0 ? customAmount : null)
  const btnLabel = effectiveAmount != null ? 'Give ' + formatUsd(effectiveAmount) : 'Select an amount'

  const handleContinue = () => {
    if (effectiveAmount == null) return
    navigate('/donate/payment', {
      state: { amountUsd: effectiveAmount, note: showNote ? note.trim() || undefined : undefined },
    })
  }

  const selectAmt = (amt: number) => { setSelected(amt); setCustomRaw('') }

  return (
    <section id="donate" className="donation-callout" aria-labelledby="donation-callout-title">
      <div className="donation-callout-inner">

        <div className="donation-callout-left">
          <h2 id="donation-callout-title">Help us keep every girl safe and supported</h2>
          <p className="donation-callout-lead">
            Your gift funds shelter, education, and counseling for children in need.
          </p>

          <div className="donation-progress">
            {loadError && <p className="donation-progress-error">{loadError}</p>}
            <div className="donation-progress-top">
              <span className="donation-progress-raised">
                {loading ? '...' : formatUsd(raisedUsdThisYear)}
              </span>
              <span className="donation-progress-label">
                {loading ? '--' : String(percent) + '%'} of {loading ? '...' : formatUsd(yearlyGoalUsd)} {currentYear} annual goal
              </span>
            </div>
            <div
              className="donation-progress-bar"
              role="progressbar"
              aria-label="Donation progress"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="donation-progress-fill" style={{ width: loading ? '0%' : String(percent) + '%' }} />
            </div>
          </div>
        </div>

        <div className="donation-card">
          <div className="donation-card-header">
            <span className="donation-card-check" aria-hidden="true">&#10003;</span>
            <span>Choose amount</span>
          </div>

          <div className="donation-amount-grid">
            {PRESET_AMOUNTS_USD.map((amt) => (
              <button
                key={amt}
                type="button"
                className={'donation-amount-btn' + (selected === amt ? ' donation-amount-btn--active' : '')}
                onClick={() => selectAmt(amt)}
              >
                {formatUsd(amt)}
              </button>
            ))}
          </div>

          <label className="donation-custom-label" htmlFor="donation-custom">
            <span className="donation-custom-prefix">$</span>
            <input
              id="donation-custom"
              type="text"
              inputMode="decimal"
              className="donation-custom-input"
              placeholder="Other amount"
              value={customRaw}
              onChange={(e) => { setCustomRaw(e.target.value); setSelected(null) }}
            />
            <span className="donation-custom-suffix">USD</span>
          </label>

          <label className="donation-note-toggle">
            <input type="checkbox" checked={showNote} onChange={(e) => setShowNote(e.target.checked)} />
            <span>Add a note</span>
          </label>

          {showNote && (
            <textarea
              className="donation-note-field"
              rows={2}
              placeholder="In honor of someone, or a message of encouragement..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}

          <button type="button" className="donation-continue" onClick={handleContinue} disabled={effectiveAmount == null}>
            {btnLabel}
          </button>
        </div>

      </div>
    </section>
  )
}
