import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './Navbar.css'
import brandLogo from '../assets/Brighthut-logo.png'
import { getStoredRole, isStaffLikeRole } from '../lib/storedRole'

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('token'))
  const [menuOpen, setMenuOpen] = useState(false)
  const isStaffLike = isStaffLikeRole(getStoredRole())

  useEffect(() => {
    const sync = () => setLoggedIn(!!localStorage.getItem('token'))
    window.addEventListener('storage', sync)
    window.addEventListener('auth-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('auth-change', sync)
    }
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [menuOpen])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('email')
    localStorage.removeItem('firstName')
    setLoggedIn(false)
    setMenuOpen(false)
    navigate('/')
  }

  return (
    <nav className={`navbar${menuOpen ? ' navbar--open' : ''}`} aria-label="Main">
      <div className="navbar-shell">
        <Link to="/" className="navbar-brand" onClick={() => setMenuOpen(false)}>
          <img src={brandLogo} alt="BrightHut logo" className="brand-icon" />
          BrightHut
        </Link>
        <button
          type="button"
          className="navbar-menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="navbar-site-links"
          id="navbar-menu-button"
          onClick={() => setMenuOpen(o => !o)}
        >
          <span className="navbar-menu-toggle__bars" aria-hidden />
          <span className="navbar-menu-toggle__label">{menuOpen ? 'Close menu' : 'Open menu'}</span>
        </button>
        <div className="navbar-links" id="navbar-site-links">
          <Link to="/about" className="nav-link">About Us</Link>
          <Link to="/impact" className="nav-link">Impact</Link>
          {isStaffLike && <Link to="/social" className="nav-link">Social Media</Link>}
          {loggedIn && (
            <>
              {isStaffLike && <Link to="/dashboard" className="nav-link">Dashboard</Link>}
              <Link to="/donors" className="nav-link">{isStaffLike ? 'Donors' : 'My Contributions'}</Link>
              {isStaffLike && <Link to="/participants" className="nav-link">Participants</Link>}
              {isStaffLike && <Link to="/analytics" className="nav-link">Analytics</Link>}
            </>
          )}
          <Link to="/privacy" className="nav-link">Privacy</Link>
          {loggedIn ? (
            <button type="button" className="nav-btn-logout" onClick={handleLogout}>Log Out</button>
          ) : (
            <button type="button" className="nav-btn-login" onClick={() => navigate('/login')}>Login</button>
          )}
        </div>
      </div>
      {menuOpen && (
        <button
          type="button"
          className="navbar-backdrop"
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => setMenuOpen(false)}
        />
      )}
    </nav>
  )
}
