import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSupporters } from '../api/supporters'
import './AuthPage.css'
import brandLogo from '../assets/Brighthut-logo.png'

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [helper, setHelper] = useState<string | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setHelper(null)

    const trimmedEmail = email.trim()
    if (!isValidEmail(trimmedEmail)) {
      setFormError('Please enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.')
      return
    }

    // Placeholder authentication flow:
    // We verify the email exists in supporter records and show a helpful next step.
    if (submitting) return
    setSubmitting(true)
    getSupporters()
      .then((rows) => {
        const found = (rows ?? []).some(
          (r) => String(r.email ?? '').trim().toLowerCase() === trimmedEmail.toLowerCase()
        )
        if (found) {
          setHelper(
            'We found a supporter record with this email. Login is not enabled yet—this is a demo app. You can still explore the Donors Portal.'
          )
        } else {
          setHelper(
            "We couldn't find this email in our supporter records yet. Create an account to get started."
          )
        }
      })
      .catch(() => {
        setFormError('Could not reach the server. Please try again.')
      })
      .finally(() => setSubmitting(false))
  }

  const canSubmit = useMemo(() => email.trim().length > 0 && password.length > 0, [email, password])

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={brandLogo} alt="BrightHut logo" className="auth-icon" />
          <h1>Welcome back</h1>
          <p>Sign in to your BrightHut account</p>
        </div>
        {formError ? (
          <p className="auth-alert auth-alert--error" role="alert">
            {formError}
          </p>
        ) : null}
        {helper ? (
          <div className="auth-alert auth-alert--info" role="status">
            <p>{helper}</p>
            <div className="auth-alert-actions">
              <button type="button" className="auth-secondary" onClick={() => navigate('/donors')}>
                Go to Donors Portal
              </button>
              <Link className="auth-secondary auth-secondary--link" to="/create-account">
                Create an account
              </Link>
            </div>
          </div>
        ) : null}
        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-label">
            Email
            <input
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label className="form-label">
            Password
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          <button
            type="submit"
            className="auth-submit"
            disabled={!canSubmit || submitting}
          >
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="auth-footer">
          Don't have an account? <Link to="/create-account">Create one</Link>
        </p>
      </div>
    </main>
  )
}
