import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import DonationCallout from '../components/DonationCallout'
import './Home.css'

const privatePortals = [
  {
    title: 'Social Media Portal',
    description: 'Stay connected and engage with our community across platforms.',
    icon: '💬',
    path: '/social',
    color: 'blue',
  },
  {
    title: 'My Contributions',
    description: 'View your donation history and see the impact of your giving.',
    icon: '🤝',
    path: '/donors',
    color: 'sand',
  },
  {
    title: 'Participants Portal',
    description: 'Access resources, updates, and tools for program participants.',
    icon: '⭐',
    path: '/participants',
    color: 'teal',
  },
]

export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const loggedIn = !!localStorage.getItem('token')
  const isStaff = localStorage.getItem('role') === 'staff'
  const portals = isStaff ? privatePortals : privatePortals.filter(p => p.path === '/donors')

  // Support links like /#donate
  // Keeps the grid layout fixed; scrolls to the section the user asked for.
  // (No-op if element doesn't exist.)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!location.hash) return
    const id = location.hash.replace('#', '')
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash])

  return (
    <main className="home">
      <section className="hero">
        <div className="hero-content">
          <span className="hero-tag">Welcome to BrightHut</span>
          <h1 className="hero-title">
            Empowering communities,<br />
            <span className="hero-accent">one connection at a time.</span>
          </h1>
          <p className="hero-subtitle">
            A place where participants, donors, and community members come together
            to create meaningful, lasting change.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate('/login')}>
              Get Started
            </button>
            <button className="btn-secondary" onClick={() => navigate('/about')}>
              Learn More
            </button>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-blob" />
        </div>
      </section>

      {loggedIn && (
        <section className="portals-section">
          <div className="portals-header">
            <h2>Where would you like to go?</h2>
            <p className="portals-subtitle">Select a portal to get started</p>
          </div>
          <div className="portals-grid">
            {portals.map((portal) => (
              <button
                key={portal.path}
                className={`portal-card portal-card--${portal.color}`}
                onClick={() => navigate(portal.path)}
              >
                <span className="portal-icon">{portal.icon}</span>
                <h3 className="portal-title">{portal.title}</h3>
                <p className="portal-desc">{portal.description}</p>
                <span className="portal-arrow">→</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <DonationCallout />

      <footer className="footer">
        <p>
          © 2025 BrightHut. All rights reserved. · <Link to="/privacy">Privacy Policy</Link>
        </p>
      </footer>
    </main>
  )
}
