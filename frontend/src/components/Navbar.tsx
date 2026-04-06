import { Link, useNavigate } from 'react-router-dom'
import './Navbar.css'

export default function Navbar() {
  const navigate = useNavigate()

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <span className="brand-icon">✦</span>
        BrightHutt
      </Link>
      <div className="navbar-links">
        <Link to="/about" className="nav-link">About Us</Link>
        <button className="nav-btn-login" onClick={() => navigate('/login')}>
          Login
        </button>
      </div>
    </nav>
  )
}
