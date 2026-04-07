import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getDonations } from '../api/donations'
import {
  computeMonthlyGoalUsd,
  currentYearMonth,
  formatUsd,
  phpToUsd,
  progressPercent,
  sumMonetaryPhpForMonth,
  type DonationRow,
  PHP_PER_USD,
} from './donationProgress'
import './DonationCallout.css'

const PRESET_AMOUNTS_USD = [25, 55, 100, 250, 500, 1000] as const

export default function DonationCallout() {
  const navigate = useNavigate()
  const loggedIn = !!localStorage.getItem('token')
  if (loggedIn) return null
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
      .then((data) => {
        if (!cancelled) setRows((data ?? []) as DonationRow[])
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError('Could not load donation totals. Showing $0 until the connection is restored.')
          setRows([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const yearMonth = useMemo(() => currentYearMonth(), [])

  const raisedPhpThisMonth = useMemo(
    () => sumMonetaryPhpForMonth(rows, yearMonth),
    [rows, yearMonth]
  )

  const raisedUsdThisMonth = useMemo(
    () => phpToUsd(raisedPhpThisMonth),
    [raisedPhpThisMonth]
  )

  const monthlyGoalUsd = useMemo(() => computeMonthlyGoalUsd(rows), [rows])

  const percent = useMemo(
    () => progressPercent(raisedUsdThisMonth, monthlyGoalUsd),
    [raisedUsdThisMonth, monthlyGoalUsd]
  )

  const customAmount = parseFloat(customRaw.replace(/,/g, ''))
  const effectiveAmount =
    selected ??
    (!Number.isNaN(customAmount) && customAmount > 0 ? customAmount : null)

  const handleContinue = () => {
    if (effectiveAmount == null) return
    navigate('/donate/payment', {
      state: {
        amountUsd: effectiveAmount,
        note: showNote ? note.trim() || undefined : undefined,
      },
    })
  }

  const monthLabel = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleString('en-US', {
      month: 'long',
      year: 'numeric',
    })
  }, [yearMonth])

  return (
    <section
      id="donate"
      className="donation-callout"
      aria-labelledby="donation-callout-title"
    >
      <div className="donation-callout-inner">
        <div className="donation-callout-intro">
          <h2 id="donation-callout-title">Help us keep every girl safe, seen, and supported</h2>
          <p className="donation-callout-lead">
            Your gift helps provide shelter, counseling, education, and a path toward healing and
            home. When you give, you are telling a child she is not alone—and that her future still
            holds light.
          </p>
          <p className="donation-callout-sub">
            This month, we are rallying our community to meet a shared goal so our safehouses can
            cover meals, staff care, and programs without turning a single child away.
          </p>
        </div>

        <div className="donation-progress">
          <p className="donation-progress-caption">
            Monetary gifts recorded for <strong>{monthLabel}</strong>
            {loading ? ' — loading…' : null}
          </p>
          {loadError ? <p className="donation-progress-error">{loadError}</p> : null}
          <div className="donation-progress-top">
            <span className="donation-progress-raised">
              {loading ? '…' : formatUsd(raisedUsdThisMonth)}
            </span>
            <span className="donation-progress-label">
              {loading ? '—' : `${percent}%`} of {loading ? '…' : formatUsd(monthlyGoalUsd)} goal
            </span>
          </div>
          <div
            className="donation-progress-bar"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress toward monthly donation goal"
          >
            <div
              className="donation-progress-fill"
              style={{ width: loading ? '0%' : `${percent}%` }}
            />
          </div>
          <p className="donation-progress-footnote">
            Progress uses <strong>monetary</strong> donations from our database; amounts stored in
            pesos are converted for display at about <strong>₱{PHP_PER_USD} = $1</strong>.
          </p>
        </div>

        <div className="donation-card">
          <div className="donation-card-header">
            <span className="donation-card-check" aria-hidden="true">
              ✓
            </span>
            <span>Choose amount</span>
          </div>

          <div className="donation-amount-grid">
            {PRESET_AMOUNTS_USD.map((amt) => (
              <button
                key={amt}
                type="button"
                className={`donation-amount-btn${selected === amt ? ' donation-amount-btn--active' : ''}`}
                onClick={() => {
                  setSelected(amt)
                  setCustomRaw('')
                }}
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
              onChange={(e) => {
                setCustomRaw(e.target.value)
                setSelected(null)
              }}
            />
            <span className="donation-custom-suffix">USD</span>
          </label>

          <label className="donation-note-toggle">
            <input
              type="checkbox"
              checked={showNote}
              onChange={(e) => setShowNote(e.target.checked)}
            />
            <span>Add note / dedication</span>
          </label>

          {showNote && (
            <textarea
              className="donation-note-field"
              rows={3}
              placeholder="Optional message (e.g. in honor of someone, or words of encouragement for the girls)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          )}

          <button
            type="button"
            className="donation-continue"
            onClick={handleContinue}
            disabled={effectiveAmount == null}
          >
            Continue to payment
          </button>
          <p className="donation-disclaimer">
            Next you’ll confirm who is giving (and we’ll check our supporter list for individuals).
            Every contribution, large or small, changes a life.
          </p>
        </div>
      </div>
    </section>
  )
}
