import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import './CookieBanner.css'

type ConsentChoice = 'accepted' | 'declined'

const CONSENT_COOKIE_NAME = 'brighthut_cookie_consent'
const ONE_YEAR_IN_DAYS = 365

function readConsentCookie(): ConsentChoice | null {
  const cookies = document.cookie.split(';').map((item) => item.trim())
  const target = cookies.find((item) => item.startsWith(`${CONSENT_COOKIE_NAME}=`))
  if (!target) return null

  const value = decodeURIComponent(target.split('=')[1] ?? '')
  return value === 'accepted' || value === 'declined' ? value : null
}

function writeConsentCookie(choice: ConsentChoice) {
  const maxAgeSeconds = ONE_YEAR_IN_DAYS * 24 * 60 * 60
  const securePart = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(choice)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax${securePart}`
}

export default function CookieBanner() {
  const [choice, setChoice] = useState<ConsentChoice | null>(null)

  useEffect(() => {
    setChoice(readConsentCookie())
  }, [])

  const isVisible = choice === null

  const onChoose = (nextChoice: ConsentChoice) => {
    writeConsentCookie(nextChoice)
    setChoice(nextChoice)
  }

  if (!isVisible) return null

  return (
    <section className="cookie-banner" aria-label="Cookie consent">
      <p className="cookie-banner__text">
        We use essential cookies to keep BrightHut working and optional cookies to improve experience.
        Read our <Link to="/privacy">Privacy Policy</Link> for details.
      </p>
      <div className="cookie-banner__actions">
        <button
          type="button"
          className="cookie-banner__btn cookie-banner__btn--decline"
          onClick={() => onChoose('declined')}
        >
          Decline
        </button>
        <button
          type="button"
          className="cookie-banner__btn cookie-banner__btn--accept"
          onClick={() => onChoose('accepted')}
        >
          Accept
        </button>
      </div>
    </section>
  )
}
