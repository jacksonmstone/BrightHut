import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import peaceCircle from '../assets/peace-circle.png'
import './AboutUs.css'

const PILLARS = [
  {
    id: 'protect',
    label: 'Protect',
    headline: 'Safe housing & stability',
    body: 'Every child deserves a place that is genuinely safe. We support day-to-day safehouse operations — resident intake, staff coordination, and the steady routines that make healing possible.',
  },
  {
    id: 'rehabilitate',
    label: 'Rehabilitate',
    headline: 'Structured care & recovery',
    body: 'Counseling notes, health tracking, education milestones, and intervention plans — organized in one place so staff can focus on the child in front of them, not paperwork.',
  },
  {
    id: 'reintegrate',
    label: 'Reintegrate',
    headline: 'Long-term outcomes',
    body: 'Home visitation records, readiness assessments, and careful follow-up help staff guide each resident toward a stable, independent future and catch early warning signs.',
  },
  {
    id: 'donors',
    label: 'Donors',
    headline: 'Transparent impact',
    body: 'Supporters see exactly how their gifts are allocated across program areas. No vague promises — just clear, privacy-safe summaries that connect generosity to real, measurable change.',
  },
]

export default function AboutUs() {
  const navigate = useNavigate()
  const isLoggedIn = !!localStorage.getItem('token')
  const [activeId, setActiveId] = useState('protect')
  const panel = PILLARS.find((p) => p.id === activeId) ?? PILLARS[0]

  return (
    <main className="about-page">

      {/* ── Hero ── */}
      <section className="about-hero">
        <div className="about-hero-inner">
          <span className="about-tag">Our Mission</span>
          <h1 className="about-title">
            Safe homes for girls<br />
            <span className="about-accent">who deserve better.</span>
          </h1>
          <p className="about-lead">
            BrightHut supports organizations like Lighthouse Sanctuary — safe houses for girls
            recovering from abuse and trafficking in the Philippines. We build the tools they
            need to protect more children, track outcomes, and sustain donor support.
          </p>
          <div className="about-hero-actions">
            <button className="btn-primary" onClick={() => navigate('/#donate')}>Donate now</button>
            {!isLoggedIn && (
              <button className="btn-secondary" onClick={() => navigate('/create-account')}>Get involved</button>
            )}
          </div>
        </div>
        <div className="about-hero-visual">
          <div className="about-hero-blob" aria-hidden="true" />
          <img src={peaceCircle} alt="Residents forming a peace circle" className="about-hero-img" />
        </div>
      </section>

      {/* ── What we do ── */}
      <section className="about-what">
        <div className="about-what-inner">
          {[
            { n: '01', title: 'Protect', body: 'Safe housing, intake records, and daily operations that put every child\'s stability first.' },
            { n: '02', title: 'Rehabilitate', body: 'Counseling, health tracking, education milestones, and structured intervention plans.' },
            { n: '03', title: 'Reintegrate', body: 'Home visitation records and readiness assessments to guide each child toward independence.' },
          ].map(({ n, title, body }) => (
            <div key={n} className="about-what-card">
              <span className="about-what-num">{n}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Interactive focus areas ── */}
      <section className="about-focus">
        <div className="about-focus-inner">
          <h2>How it works</h2>
          <p className="about-focus-sub">Select an area to learn how BrightHut supports it.</p>

          <div className="about-tabs" role="tablist">
            {PILLARS.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={activeId === p.id}
                className={'about-tab' + (activeId === p.id ? ' about-tab--active' : '')}
                onClick={() => setActiveId(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="about-panel" role="tabpanel">
            <h3>{panel.headline}</h3>
            <p>{panel.body}</p>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="about-cta">
        <div className="about-cta-inner">
          <h2>Be the steady place a child can count on.</h2>
          <p>Your support funds shelter, counseling, education, and hope.</p>
          <button className="btn-primary about-cta-btn" onClick={() => navigate('/#donate')}>
            Give today
          </button>
        </div>
      </section>

    </main>
  )
}
