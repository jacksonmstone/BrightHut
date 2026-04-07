import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import './Navbar.css'
import brandLogo from '../assets/Brighthut-logo.png'

export default function Navbar() {
  const navigate = useNavigate()
  const [loggedIn, setLoggedIn] = useState(!!localStorage.getItem('token'))

  useEffect(() => {
    const sync = () => setLoggedIn(!!localStorage.getItem('token'))
    window.addEventListener('storage', sync)
    window.addEventListener('auth-change', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('auth-change', sync)
    }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('role')
    localStorage.removeItem('email')
    setLoggedIn(false)
    navigate('/login')
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <img src={brandLogo} alt="BrightHut logo" className="brand-icon" />
        BrightHut
      </Link>
      <div className="navbar-links">
        <Link to="/about" className="nav-link">About Us</Link>
        <Link to="/impact" className="nav-link">Impact</Link>
        <Link to="/privacy" className="nav-link">Privacy</Link>
        {loggedIn ? (
          <button className="nav-btn-logout" onClick={handleLogout}>
            Log Out
          </button>
        ) : (
          <button className="nav-btn-login" onClick={() => navigate('/login')}>
            Login
          </button>
        )}
      </div>
    </nav>
  )
}
