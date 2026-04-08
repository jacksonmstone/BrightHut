import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import DonationCallout from '../components/DonationCallout'
import './Home.css'

const privatePortals = [
  {
    title: 'Dashboard',
    description: 'Command center — active residents, donations, incidents, and case conferences.',
    icon: '📊',
    path: '/dashboard',
    color: 'teal',
  },
  {
    title: 'Social Media Portal',
    description: 'Stay connected and engage with our community across platforms.',
    icon: '💬',
    path: '/social',
    color: 'blue',
  },
  {
    title: 'Donors Portal',
    description: 'View all donor records, donation history, and contribution data.',
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
  const role = (localStorage.getItem('role') ?? '').toLowerCase()
  const isStaffLike = role === 'staff' || role === 'admin'
  const portals = isStaffLike
    ? privatePortals
    : privatePortals
        .filter((p) => p.path === '/donors')
        .map((p) => ({
          ...p,
          title: 'My Contributions',
          description: 'Track your giving history, see how your gifts are allocated across program areas, and measure your total impact.',
          icon: '',
        }))

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

  const rawName = (localStorage.getItem('email')?.split('@')[0] ?? 'there').split('.')[0].split('_')[0]
  const donorName = rawName.charAt(0).toUpperCase() + rawName.slice(1)

  return (
    <main className="home">
      <section className="hero">
        <div className="hero-content">
          {!loggedIn && (
            <>
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
            </>
          )}
          {loggedIn && !isStaffLike && (
            <>
              <span className="hero-tag">Welcome back</span>
              <h1 className="hero-title">
                Hi, <span className="hero-accent">{donorName}.</span>
              </h1>
              <p className="hero-subtitle">
                Thank you for your continued support of BrightHut. Your generosity helps
                provide shelter, education, and healing for children in need.
              </p>
              <div className="hero-actions">
                <button className="btn-primary" onClick={() => navigate('/donors')}>
                  View My Contributions
                </button>
                <button className="btn-secondary" onClick={() => navigate('/#donate')}>
                  Make a Donation
                </button>
              </div>
            </>
          )}
          {loggedIn && isStaffLike && (
            <>
              <span className="hero-tag">Admin Dashboard</span>
              <h1 className="hero-title">
                Welcome back,<br />
                <span className="hero-accent">BrightHut Team.</span>
              </h1>
              <p className="hero-subtitle">
                Manage donor records, participant data, and social media insights from the portals below.
              </p>
            </>
          )}
        </div>
        <div className="hero-visual">
          <div className="hero-blob" />
        </div>
      </section>

      {loggedIn && (
        <section className={'portals-section' + (!isStaffLike ? ' portals-section--donor' : '')}>
          {isStaffLike && (
            <div className="portals-header">
              <h2>Where would you like to go?</h2>
              <p className="portals-subtitle">Select a portal to get started</p>
            </div>
          )}
          <div className={isStaffLike ? 'portals-grid' : 'portals-grid portals-grid--single'}>
            {portals.map((portal) => (
              <button
                key={portal.path}
                className={`portal-card portal-card--${portal.color}${!isStaffLike ? ' portal-card--featured' : ''}`}
                onClick={() => navigate(portal.path)}
              >
                {portal.icon && <span className="portal-icon">{portal.icon}</span>}
                <h3 className="portal-title">{portal.title}</h3>
                <p className="portal-desc">{portal.description}</p>
                <span className="portal-arrow">View now →</span>
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
