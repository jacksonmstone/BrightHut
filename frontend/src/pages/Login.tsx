import { useState } from 'react'
import { Link } from 'react-router-dom'
import './AuthPage.css'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: connect to backend auth
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <span className="auth-icon">✦</span>
          <h1>Welcome back</h1>
          <p>Sign in to your BrightHutt account</p>
        </div>
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
          <button type="submit" className="auth-submit">Sign In</button>
        </form>
        <p className="auth-footer">
          Don't have an account? <Link to="/">Return home</Link>
        </p>
      </div>
    </main>
  )
}
