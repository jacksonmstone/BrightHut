import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import './AuthPage.css'
import brandLogo from '../assets/Brighthut-logo.png'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const res = await login(email.trim(), password)
      localStorage.setItem('token', res.token)
      localStorage.setItem('role', res.role)
      localStorage.setItem('email', res.email)
      window.dispatchEvent(new Event('auth-change'))
      navigate(res.role === 'staff' ? '/participants' : '/donors')
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
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
