import { useNavigate } from 'react-router-dom'
import './Home.css'

const portals = [
  {
    title: 'About Us',
    description: 'Learn about our mission, values, and the people behind BrightHutt.',
    icon: '🌿',
    path: '/about',
    color: 'green',
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
    description: 'Support our cause and manage your contributions with ease.',
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

  return (
    <main className="home">
      <section className="hero">
        <div className="hero-content">
          <span className="hero-tag">Welcome to BrightHutt</span>
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

      <footer className="footer">
        <p>© 2025 BrightHutt. All rights reserved.</p>
      </footer>
    </main>
  )
}
