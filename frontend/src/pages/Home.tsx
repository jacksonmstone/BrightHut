import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { getDonations } from '../api/donations'
import { getSafehouseMonthlyMetrics } from '../api/impact'
import DonationCallout from '../components/DonationCallout'
import safehouseCommunity from '../assets/safehouse-community.png'
import sandboarding from '../assets/sandboarding.png'
import dashboardIcon from '../assets/dashboard-icon.png'
import socialMediaIcon from '../assets/social-media-icon.png'
import donorIcon from '../assets/donor-icon.png'
import participantsIcon from '../assets/participants-icon.png'
import { formatUsd, phpToUsd } from '../components/donationProgress'
import './Home.css'

type MetricRow = Record<string, unknown>

function toNumber(v: unknown) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const privatePortals = [
  {
    title: 'Dashboard',
    description: 'Command center — active residents, donations, incidents, and case conferences.',
    icon: dashboardIcon,
    path: '/dashboard',
    color: 'teal',
  },
  {
    title: 'Social Media Portal',
    description: 'Stay connected and engage with our community across platforms.',
    icon: socialMediaIcon,
    path: '/social',
    color: 'blue',
  },
  {
    title: 'Donors Portal',
    description: 'View all donor records, donation history, and contribution data.',
    icon: donorIcon,
    path: '/donors',
    color: 'sand',
  },
  {
    title: 'Participants Portal',
    description: 'Access resources, updates, and tools for program participants.',
    icon: participantsIcon,
    path: '/participants',
    color: 'teal',
  },
]

export default function Home() {
  const navigate = useNavigate()
  const location = useLocation()
  const loggedIn = !!localStorage.getItem('token')
  const [impactMetrics, setImpactMetrics] = useState<MetricRow[]>([])
  const [impactDonations, setImpactDonations] = useState<Record<string, unknown>[]>([])
  const [impactPreviewLoading, setImpactPreviewLoading] = useState(false)

  useEffect(() => {
    if (loggedIn) return
    setImpactPreviewLoading(true)
    Promise.all([getDonations(), getSafehouseMonthlyMetrics()])
      .then(([d, m]) => {
        setImpactDonations(d ?? [])
        setImpactMetrics(m ?? [])
      })
      .catch(() => {
        setImpactDonations([])
        setImpactMetrics([])
      })
      .finally(() => setImpactPreviewLoading(false))
  }, [loggedIn])

  const impactPreview = useMemo(() => {
    const totalRaisedPhp = impactDonations
      .filter((row) => row.donation_type === 'Monetary')
      .reduce((sum, row) => sum + toNumber(row.amount), 0)

    const months = [...new Set(impactMetrics.map((r) => String(r.month_start ?? '').slice(0, 7)).filter(Boolean))].sort()
    const latestKey = months.length ? months[months.length - 1] : ''
    const latestMonthRows = impactMetrics.filter((r) => String(r.month_start ?? '').startsWith(latestKey))

    const activeResidents = latestMonthRows.reduce((sum, r) => sum + toNumber(r.active_residents), 0)
    const processNotes = latestMonthRows.reduce((sum, r) => sum + toNumber(r.process_recording_count), 0)

    let visitMonthRows = latestMonthRows
    for (let i = months.length - 1; i >= 0; i--) {
      const rows = impactMetrics.filter((r) => String(r.month_start ?? '').startsWith(months[i]))
      if (rows.some((r) => toNumber(r.home_visitation_count) > 0)) {
        visitMonthRows = rows
        break
      }
    }
    const visits = visitMonthRows.reduce((sum, r) => sum + toNumber(r.home_visitation_count), 0)

    return {
      totalRaisedUsd: phpToUsd(totalRaisedPhp),
      activeResidents,
      processNotes,
      visits,
      hasMetrics: impactMetrics.length > 0,
    }
  }, [impactDonations, impactMetrics])
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

  const storedFirst = localStorage.getItem('firstName')
  const emailFallback = (localStorage.getItem('email')?.split('@')[0] ?? 'there').split(/[._\-]/)[0]
  const donorName = storedFirst
    ? storedFirst
    : emailFallback.charAt(0).toUpperCase() + emailFallback.slice(1)

  return (
    <main className="home">
      <section className="hero">
        <div className="hero-content">
          {!loggedIn && (
            <>
              <span className="hero-tag">BrightHut</span>
              <h1 className="hero-title">
                Safe homes and healing for girls in the Philippines<br />
                <span className="hero-accent">who have survived abuse and trafficking.</span>
              </h1>
              <p className="hero-lead">
                We partner with in-country sanctuaries like Lighthouse Sanctuary—supporting shelter, counseling,
                education, and reintegration—while giving staff and donors clear, privacy-safe tools to see how
                help reaches real children.
              </p>
              <p className="hero-tagline">Empowering communities, one connection at a time.</p>
              <p className="hero-trust">
                Survivor privacy comes first: we never share identifying details publicly, and gifts are used for programs
                you can read about in our{' '}
                <Link className="hero-trust-link" to="/privacy">
                  Privacy Policy
                </Link>
                .
              </p>
              <div className="hero-actions">
                <button type="button" className="btn-primary" onClick={() => navigate('/#donate')}>
                  Donate
                </button>
                <button type="button" className="btn-secondary" onClick={() => navigate('/login')}>
                  Sign in
                </button>
                <button type="button" className="btn-secondary btn-secondary--ghost" onClick={() => navigate('/about')}>
                  Our mission
                </button>
              </div>
              <p className="hero-account-hint">
                New supporter?{' '}
                <Link className="hero-account-link" to="/create-account">
                  Create an account
                </Link>{' '}
                to track your impact — or give first with no login.
              </p>
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
                provide shelter, education, and healing for girls in our partner safe homes. We handle your data
                carefully — see our{' '}
                <Link className="hero-trust-link" to="/privacy">
                  privacy commitments
                </Link>
                .
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
                Manage donor records, participant data, and social insights — every update supports girls in care.
                Protect confidential information per policy; public pages only show anonymized impact.
              </p>
            </>
          )}
        </div>
        <div className="hero-visual">
          <div className="hero-blob" />
          <img
            src={safehouseCommunity}
            alt="BrightHut safehouse community"
            className="hero-community-img"
          />
        </div>
      </section>

      {!loggedIn && (
        <section className="home-impact-preview" aria-labelledby="home-impact-preview-title">
          <div className="home-impact-preview-inner">
            <div className="home-impact-preview-header">
              <h2 id="home-impact-preview-title">Impact at a glance</h2>
              <p>
                A quick, anonymized snapshot — the same kind of transparency you’ll find on our full{' '}
                <Link to="/impact">Impact</Link> page. No individual stories here, only program-level numbers.
              </p>
            </div>
            {impactPreviewLoading ? (
              <p className="home-impact-preview-loading">Loading latest figures…</p>
            ) : (
              <ul className="home-impact-preview-stats">
                <li>
                  <span className="home-impact-preview-value">{formatUsd(impactPreview.totalRaisedUsd)}</span>
                  <span className="home-impact-preview-label">Total monetary gifts</span>
                </li>
                <li>
                  <span className="home-impact-preview-value">
                    {impactPreview.hasMetrics ? impactPreview.activeResidents.toLocaleString() : '—'}
                  </span>
                  <span className="home-impact-preview-label">Girls in care (latest month)</span>
                </li>
                <li>
                  <span className="home-impact-preview-value">
                    {impactPreview.hasMetrics ? impactPreview.processNotes.toLocaleString() : '—'}
                  </span>
                  <span className="home-impact-preview-label">Counseling sessions logged</span>
                </li>
                <li>
                  <span className="home-impact-preview-value">
                    {impactPreview.hasMetrics ? impactPreview.visits.toLocaleString() : '—'}
                  </span>
                  <span className="home-impact-preview-label">Home &amp; field visits</span>
                </li>
              </ul>
            )}
            <div className="home-impact-preview-cta">
              <Link className="home-impact-preview-link" to="/impact">
                See full impact dashboard →
              </Link>
            </div>
          </div>
        </section>
      )}

      {loggedIn && (
        <section className={'portals-section' + (!isStaffLike ? ' portals-section--donor' : '')}>
          {isStaffLike && (
            <div className="portals-header">
              <h2>Where would you like to go?</h2>
              <p className="portals-subtitle">Select a portal to get started</p>
            </div>
          )}
          <div className={!isStaffLike ? 'donor-portal-layout' : ''}>
            {!isStaffLike && (
              <img
                src={sandboarding}
                alt="Residents enjoying an outing"
                className="donor-portal-img"
              />
            )}
            <div className={isStaffLike ? 'portals-grid' : 'portals-grid portals-grid--single'}>
              {portals.map((portal) => (
                <button
                  key={portal.path}
                  className={`portal-card portal-card--${portal.color}${!isStaffLike ? ' portal-card--featured' : ''}`}
                  onClick={() => navigate(portal.path)}
                >
                  {portal.icon && <img src={portal.icon} alt={`${portal.title} icon`} className="portal-icon" />}
                  <h3 className="portal-title">{portal.title}</h3>
                  <p className="portal-desc">{portal.description}</p>
                  <span className="portal-arrow">View now →</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <DonationCallout />

      <footer className="footer">
        <p>
          © 2026 BrightHut. All rights reserved. · <Link to="/privacy">Privacy Policy</Link>
        </p>
      </footer>
    </main>
  )
}
