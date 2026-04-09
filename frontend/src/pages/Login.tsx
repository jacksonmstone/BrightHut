import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import { enableTwoFactor, googleLogin, login, setupTwoFactor, type AuthResponse } from '../api/auth'
import './AuthPage.css'
import brandLogo from '../assets/Brighthut-logo.png'

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: {
            client_id: string
            callback: (response: { credential?: string }) => void
          }) => void
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void
          prompt: () => void
        }
      }
    }
  }
}

type AuthMethod = 'password' | 'google'

export default function Login() {
  const navigate = useNavigate()
  const googleButtonRef = useRef<HTMLDivElement | null>(null)
  const googleClientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [twoFactorCode, setTwoFactorCode] = useState('')
  const [authMethod, setAuthMethod] = useState<AuthMethod>('password')
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null)
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false)
  const [needsTwoFactorSetup, setNeedsTwoFactorSetup] = useState(false)
  const [needsAccountTypeSelection, setNeedsAccountTypeSelection] = useState(false)
  const [supporterType, setSupporterType] = useState('')
  const [setupToken, setSetupToken] = useState<string | null>(null)
  const [setupSecret, setSetupSecret] = useState<string | null>(null)
  const [setupUri, setSetupUri] = useState<string | null>(null)
  const [setupQrDataUrl, setSetupQrDataUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!needsTwoFactorSetup || !setupUri) {
      setSetupQrDataUrl(null)
      return
    }

    QRCode.toDataURL(setupUri, { width: 220, margin: 1 })
      .then((dataUrl: string) => {
        if (!cancelled) setSetupQrDataUrl(dataUrl)
      })
      .catch(() => {
        if (!cancelled) setSetupQrDataUrl(null)
      })

    return () => {
      cancelled = true
    }
  }, [needsTwoFactorSetup, setupUri])

  useEffect(() => {
    if (!googleClientId) return
    if (needsTwoFactor || needsTwoFactorSetup) return

    let cancelled = false

    const initGoogle = () => {
      if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) return

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          const credential = response.credential
          if (!credential) {
            setFormError('Google login failed: missing credential token.')
            return
          }

          setFormError(null)
          setSubmitting(true)
          try {
            setAuthMethod('google')
            setGoogleIdToken(credential)
            const res = await googleLogin(credential)
            if (res.requiresAccountTypeSelection) {
              setEmail(res.email)
              setPassword('')
              setNeedsAccountTypeSelection(true)
              setNeedsTwoFactor(false)
              setNeedsTwoFactorSetup(false)
              setTwoFactorCode('')
              return
            }

            if (res.requires2faSetup) {
              if (!res.setupToken) {
                setFormError('2FA enrollment token is missing. Please try again.')
                return
              }
              const setup = await setupTwoFactor(res.setupToken)
              setEmail(res.email)
              setSetupToken(res.setupToken)
              setSetupSecret(setup.secret)
              setSetupUri(setup.otpauthUrl)
              setNeedsTwoFactorSetup(true)
              setNeedsAccountTypeSelection(false)
              setNeedsTwoFactor(false)
              setTwoFactorCode('')
              return
            }

            if (res.requires2fa) {
              setEmail(res.email)
              setNeedsTwoFactor(true)
              setNeedsAccountTypeSelection(false)
              setNeedsTwoFactorSetup(false)
              setTwoFactorCode('')
              return
            }

            if (!res.token || !res.role) {
              setFormError('Login response was incomplete. Please try again.')
              return
            }

            localStorage.setItem('token', res.token)
            localStorage.setItem('role', res.role)
            localStorage.setItem('email', res.email)
            if (res.firstName) localStorage.setItem('firstName', res.firstName)
            window.dispatchEvent(new Event('auth-change'))
            navigate('/')
          } catch (err: unknown) {
            setFormError(err instanceof Error ? err.message : 'Google login failed.')
          } finally {
            setSubmitting(false)
          }
        },
      })

      googleButtonRef.current.innerHTML = ''
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        width: 320,
      })
    }

    const existing = document.getElementById('google-identity-service') as HTMLScriptElement | null
    if (existing) {
      initGoogle()
    } else {
      const script = document.createElement('script')
      script.id = 'google-identity-service'
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.defer = true
      script.onload = initGoogle
      document.head.appendChild(script)
    }

    return () => {
      cancelled = true
    }
  }, [googleClientId, navigate, needsTwoFactor, needsTwoFactorSetup])

  const finishInteractiveSignIn = (res: AuthResponse) => {
    if (!res.token || !res.role) {
      setFormError('Login response was incomplete. Please try again.')
      return
    }
    localStorage.setItem('token', res.token)
    localStorage.setItem('role', res.role)
    localStorage.setItem('email', res.email)
    if (res.firstName) localStorage.setItem('firstName', res.firstName)
    window.dispatchEvent(new Event('auth-change'))
    navigate('/')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      const isGoogleFlow = authMethod === 'google' && !!googleIdToken

      if (needsTwoFactorSetup) {
        if (!setupToken) {
          setFormError('2FA setup session expired. Please sign in again.')
          return
        }
        await enableTwoFactor(twoFactorCode, setupToken)
        const res = isGoogleFlow
          ? await googleLogin(googleIdToken!, twoFactorCode, supporterType || undefined)
          : await login(email.trim(), password, twoFactorCode)
        finishInteractiveSignIn(res)
        return
      }

      const res = isGoogleFlow
        ? await googleLogin(
          googleIdToken!,
          needsTwoFactor ? twoFactorCode : undefined,
          needsAccountTypeSelection ? supporterType : undefined,
        )
        : await login(email.trim(), password, needsTwoFactor ? twoFactorCode : undefined)

      if (res.requiresAccountTypeSelection) {
        setEmail(res.email)
        setPassword('')
        setNeedsAccountTypeSelection(true)
        setNeedsTwoFactor(false)
        setNeedsTwoFactorSetup(false)
        setTwoFactorCode('')
        return
      }

      if (res.requires2faSetup) {
        if (!res.setupToken) {
          setFormError('2FA enrollment token is missing. Please try again.')
          return
        }
        const setup = await setupTwoFactor(res.setupToken)
        setAuthMethod(isGoogleFlow ? 'google' : 'password')
        setSetupToken(res.setupToken)
        setSetupSecret(setup.secret)
        setSetupUri(setup.otpauthUrl)
        setNeedsAccountTypeSelection(false)
        setNeedsTwoFactorSetup(true)
        setNeedsTwoFactor(false)
        setTwoFactorCode('')
        return
      }
      if (res.requires2fa) {
        setNeedsTwoFactor(true)
        setNeedsAccountTypeSelection(false)
        setNeedsTwoFactorSetup(false)
        setFormError(null)
        return
      }

      finishInteractiveSignIn(res)
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = useMemo(
    () => {
      const requiresCode = needsTwoFactor || needsTwoFactorSetup
      const hasCode = twoFactorCode.trim().length === 6
      const isGoogleFlow = authMethod === 'google' && !!googleIdToken
      if (isGoogleFlow && needsAccountTypeSelection) return supporterType.trim().length > 0
      if (requiresCode && isGoogleFlow) return hasCode
      if (requiresCode) return email.trim().length > 0 && password.length > 0 && hasCode
      return email.trim().length > 0 && password.length > 0
    },
    [email, password, needsTwoFactor, needsTwoFactorSetup, needsAccountTypeSelection, twoFactorCode, authMethod, googleIdToken, supporterType],
  )

  const isGoogleInteractiveFlow = authMethod === 'google' && !!googleIdToken

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <img src={brandLogo} alt="BrightHut logo" className="auth-icon" />
          <h1>Welcome back</h1>
          <p>
            {needsTwoFactorSetup
              ? 'First-time sign-in requires 2FA setup. Add this account to Microsoft Authenticator, then enter the 6-digit code below.'
              : needsAccountTypeSelection
                ? 'Please choose your account type to finish Google sign-in.'
              : needsTwoFactor
                ? 'Enter the 6-digit code from your authenticator app.'
                : 'Sign in with your email and password — we use your email as your username.'}
          </p>
          {!needsTwoFactor && !needsTwoFactorSetup && googleClientId ? (
            <div style={{ marginTop: 12 }}>
              <div ref={googleButtonRef} />
            </div>
          ) : null}
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
              onChange={(e) => {
                setEmail(e.target.value)
                if (!needsTwoFactor && !needsTwoFactorSetup && !needsAccountTypeSelection) {
                  setAuthMethod('password')
                  setGoogleIdToken(null)
                }
              }}
              placeholder="you@example.com"
              required={!isGoogleInteractiveFlow}
              readOnly={isGoogleInteractiveFlow}
            />
          </label>
          {!isGoogleInteractiveFlow ? (
            <label className="form-label">
              Password
              <input
                type="password"
                className="form-input"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (!needsTwoFactor && !needsTwoFactorSetup && !needsAccountTypeSelection) {
                    setAuthMethod('password')
                    setGoogleIdToken(null)
                  }
                }}
                placeholder="••••••••"
                required
              />
            </label>
          ) : null}
          {needsAccountTypeSelection ? (
            <label className="form-label">
              Account Type
              <select
                className="form-input"
                value={supporterType}
                onChange={(e) => setSupporterType(e.target.value)}
                required
              >
                <option value="">Select account type</option>
                <option value="MonetaryDonor">Monetary Donor</option>
                <option value="InKindDonor">In-kind Donor</option>
                <option value="Volunteer">Volunteer</option>
                <option value="SkillsContributor">Skills Contributor</option>
                <option value="SocialMediaAdvocate">Social Media Advocate</option>
                <option value="PartnerOrganization">Partner Organization</option>
              </select>
            </label>
          ) : null}
          {needsTwoFactorSetup && setupSecret ? (
            <div className="auth-alert" role="status">
              {setupQrDataUrl ? (
                <img
                  src={setupQrDataUrl}
                  alt="Scan this QR code with Microsoft Authenticator"
                  style={{ width: 220, height: 220, display: 'block', marginBottom: 12, borderRadius: 8 }}
                />
              ) : null}
              <strong>Setup key:</strong> {setupSecret}
              {setupUri ? (
                <>
                  <br />
                  <small>Use manual key entry in Microsoft Authenticator if QR is unavailable.</small>
                </>
              ) : null}
            </div>
          ) : null}
          {(needsTwoFactor || needsTwoFactorSetup) ? (
            <label className="form-label">
              Authentication Code
              <input
                type="text"
                className="form-input"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </label>
          ) : null}
          <button
            type="submit"
            className="auth-submit"
            disabled={!canSubmit || submitting}
          >
            {submitting
              ? 'Signing in…'
              : needsAccountTypeSelection
                ? 'Continue with Google'
                : needsTwoFactorSetup
                  ? 'Enable 2FA & Sign In'
                  : needsTwoFactor
                    ? 'Verify Code'
                    : 'Sign In'}
          </button>
        </form>
        <p className="auth-footer">
          Don't have an account? <Link to="/create-account">Create one</Link>
        </p>
      </div>
    </main>
  )
}
