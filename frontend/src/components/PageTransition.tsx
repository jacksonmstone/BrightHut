import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import './PageTransition.css'

/** Minimum time the overlay stays visible after each navigation (ms). */
const HOLD_MS = 520

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Brief full-screen transition when the route changes so navigation feels
 * intentional instead of instantaneous.
 */
export default function PageTransition() {
  const location = useLocation()
  const isFirstNavigation = useRef(true)
  const [active, setActive] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (isFirstNavigation.current) {
      isFirstNavigation.current = false
      return
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    const reduced = prefersReducedMotion()
    if (reduced) {
      setActive(true)
      timerRef.current = setTimeout(() => setActive(false), 80)
      return () => {
        if (timerRef.current) clearTimeout(timerRef.current)
      }
    }

    setActive(true)
    timerRef.current = setTimeout(() => {
      setActive(false)
      timerRef.current = null
    }, HOLD_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [location.pathname])

  return (
    <div
      className={`page-transition-overlay${active ? ' page-transition-overlay--active' : ''}`}
      aria-hidden={!active}
      aria-busy={active}
    >
      <div className="page-transition__inner">
        <div className="page-transition__orb" aria-hidden />
        <p className="page-transition__label">Loading page</p>
        <div className="page-transition__dots" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}
