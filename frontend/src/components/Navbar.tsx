import { Link, useNavigate } from 'react-router-dom'
import './Navbar.css'
import brandLogo from '../assets/Brighthut-logo.png'

export default function Navbar() {
  const navigate = useNavigate()

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <img src={brandLogo} alt="BrightHut logo" className="brand-icon" />
        BrightHut
      </Link>
      <div className="navbar-links">
        <Link to="/about" className="nav-link">About Us</Link>
        <Link to="/privacy" className="nav-link">Privacy</Link>
        <button className="nav-btn-login" onClick={() => navigate('/login')}>
          Login
        </button>
      </div>
    </nav>
  )
}
