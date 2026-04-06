import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getSupporters } from '../api/supporters'
import { formatUsd } from '../components/donationProgress'
import './DonatePaymentPage.css'

export type DonatePaymentLocationState = {
  amountUsd?: number | null
  note?: string
}

type DonorKind = 'individual' | 'organization'

type LookupState = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

function normalizeName(s: string) {
  return s.trim().toLowerCase()
}

function findIndividualSupporter(
  supporters: Record<string, unknown>[],
  first: string,
  last: string
): Record<string, unknown> | undefined {
  const f = normalizeName(first)
  const l = normalizeName(last)
  if (!f || !l) return undefined
  return supporters.find((row) => {
    const sf = normalizeName(String(row.first_name ?? ''))
    const sl = normalizeName(String(row.last_name ?? ''))
    return sf === f && sl === l
  })
}

export default function DonatePaymentPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = (location.state ?? {}) as DonatePaymentLocationState

  const amountUsd = state.amountUsd
  const note = state.note

  const [donorKind, setDonorKind] = useState<DonorKind>('individual')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [orgName, setOrgName] = useState('')

  const [lookup, setLookup] = useState<LookupState>('idle')
  const [matchedDisplay, setMatchedDisplay] = useState<string | null>(null)

  const runLookup = useCallback(async () => {
    setLookup('loading')
    setMatchedDisplay(null)
    try {
      const supporters = await getSupporters()
      const match = findIndividualSupporter(supporters, firstName, lastName)
      if (match) {
        setLookup('found')
        const fromName =
          `${String(match.first_name ?? '')} ${String(match.last_name ?? '')}`.trim()
        const label =
          (match.display_name != null && String(match.display_name).trim() !== ''
            ? String(match.display_name).trim()
            : fromName) || 'Supporter'
        setMatchedDisplay(label)
      } else {
        setLookup('not_found')
      }
    } catch {
      setLookup('error')
    }
  }, [firstName, lastName])

  const goToCreateAccount = () => {
    navigate('/create-account', {
      state: {
        fromDonation: true,
        prefillFirstName: firstName.trim(),
        prefillLastName: lastName.trim(),
        suggestSupporterType: 'MonetaryDonor',
      },
    })
  }

  const hasValidAmount = amountUsd != null && amountUsd > 0

  return (
    <main className="donate-payment-page">
      <div className="donate-payment-inner">
        <div className="donate-payment-header">
          <Link to="/" className="donate-payment-back">
            ← Back to home
          </Link>
          <h1>Complete your gift</h1>
          <p className="donate-payment-subtitle">
            This is a <strong>placeholder</strong> checkout—no real payment is processed yet.
          </p>
        </div>

        {!hasValidAmount ? (
          <div className="donate-payment-card donate-payment-card--warn">
            <p>No donation amount was passed. Choose an amount on the home page first.</p>
            <Link to="/" className="donate-payment-primary-link">
              Return to home
            </Link>
          </div>
        ) : (
          <>
            <section className="donate-payment-card donate-payment-summary" aria-labelledby="summary-heading">
              <h2 id="summary-heading">Gift summary</h2>
              <dl className="donate-payment-dl">
                <div>
                  <dt>Amount</dt>
                  <dd>{formatUsd(amountUsd)}</dd>
                </div>
                {note ? (
                  <div>
                    <dt>Note</dt>
                    <dd>{note}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="donate-payment-placeholder-pay">
                <span className="donate-payment-chip">Placeholder</span>
                <p>Card / wallet fields would appear here in a future integration.</p>
              </div>
            </section>

            <section className="donate-payment-card" aria-labelledby="donor-heading">
              <h2 id="donor-heading">Who is giving?</h2>
              <p className="donate-payment-hint">
                Tell us whether you are donating as a person or on behalf of a group or organization.
              </p>

              <div className="donate-payment-kind-grid" role="radiogroup" aria-label="Donor type">
                <button
                  type="button"
                  className={`donate-payment-kind${donorKind === 'individual' ? ' donate-payment-kind--active' : ''}`}
                  onClick={() => {
                    setDonorKind('individual')
                    setLookup('idle')
                    setMatchedDisplay(null)
                  }}
                  aria-pressed={donorKind === 'individual'}
                >
                  <span className="donate-payment-kind-title">Individual</span>
                  <span className="donate-payment-kind-desc">I’m donating as myself</span>
                </button>
                <button
                  type="button"
                  className={`donate-payment-kind${donorKind === 'organization' ? ' donate-payment-kind--active' : ''}`}
                  onClick={() => {
                    setDonorKind('organization')
                    setLookup('idle')
                    setMatchedDisplay(null)
                  }}
                  aria-pressed={donorKind === 'organization'}
                >
                  <span className="donate-payment-kind-title">Group / organization</span>
                  <span className="donate-payment-kind-desc">Company, church, school, family fund, etc.</span>
                </button>
              </div>

              {donorKind === 'individual' && (
                <div className="donate-payment-individual">
                  <p className="donate-payment-section-label">
                    We’ll check whether you already appear in our supporter records (by first and last name).
                  </p>
                  <div className="donate-payment-name-row">
                    <label className="donate-payment-label">
                      First name
                      <input
                        type="text"
                        className="donate-payment-input"
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value)
                          setLookup('idle')
                        }}
                        autoComplete="given-name"
                        required
                      />
                    </label>
                    <label className="donate-payment-label">
                      Last name
                      <input
                        type="text"
                        className="donate-payment-input"
                        value={lastName}
                        onChange={(e) => {
                          setLastName(e.target.value)
                          setLookup('idle')
                        }}
                        autoComplete="family-name"
                        required
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    className="donate-payment-lookup-btn"
                    disabled={!firstName.trim() || !lastName.trim() || lookup === 'loading'}
                    onClick={() => void runLookup()}
                  >
                    {lookup === 'loading' ? 'Checking…' : 'Check supporter records'}
                  </button>

                  {lookup === 'found' && (
                    <div className="donate-payment-alert donate-payment-alert--success" role="status">
                      <strong>We found a matching name.</strong>
                      <p>
                        Record: <em>{matchedDisplay}</em>. You can continue with this placeholder payment when
                        processing is ready.
                      </p>
                      <button type="button" className="donate-payment-fake-pay" disabled>
                        Pay {formatUsd(amountUsd)} (coming soon)
                      </button>
                    </div>
                  )}

                  {lookup === 'not_found' && (
                    <div className="donate-payment-alert donate-payment-alert--action" role="status">
                      <strong>We don’t see that name in our supporter list yet.</strong>
                      <p>Create an account so we can thank you and send receipts when the app is fully connected.</p>
                      <button type="button" className="donate-payment-primary-btn" onClick={goToCreateAccount}>
                        Create an account
                      </button>
                    </div>
                  )}

                  {lookup === 'error' && (
                    <div className="donate-payment-alert donate-payment-alert--error" role="alert">
                      Could not reach the server to verify your name. Try again, or create an account to continue.
                      <button type="button" className="donate-payment-secondary-btn" onClick={() => void runLookup()}>
                        Retry check
                      </button>
                    </div>
                  )}
                </div>
              )}

              {donorKind === 'organization' && (
                <div className="donate-payment-org">
                  <label className="donate-payment-label donate-payment-label--block">
                    Organization or group name
                    <input
                      type="text"
                      className="donate-payment-input"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      placeholder="e.g. Sunrise Community Church"
                    />
                  </label>
                  <p className="donate-payment-org-note">
                    Account matching for organizations is not wired yet. Use the button below as a placeholder
                    completion step.
                  </p>
                  <button
                    type="button"
                    className="donate-payment-fake-pay"
                    disabled={!orgName.trim()}
                  >
                    Continue for {orgName.trim() || 'organization'} (placeholder)
                  </button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  )
}
