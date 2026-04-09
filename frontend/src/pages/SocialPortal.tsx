import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSocialMediaPosts } from '../api/social'
import PaginationBar from '../components/PaginationBar'
import './SocialPortal.css'

type Post = Record<string, unknown>

export default function SocialPortal() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('All')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [activePost, setActivePost] = useState<Post | null>(null)
  const [playbookOpen, setPlaybookOpen] = useState(true)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)
  const togglePlaybook = useCallback(() => setPlaybookOpen((v) => !v), [])

  useEffect(() => {
    getSocialMediaPosts()
      .then(setPosts)
      .catch(() => setError('Failed to load social media posts.'))
      .finally(() => setLoading(false))
  }, [])

  const platforms = ['All', ...Array.from(new Set(posts.map((p) => String(p.platform ?? ''))))]

  const filtered = posts.filter((p) => {
    const q = search.toLowerCase()
    const matchSearch =
      String(p.caption ?? '').toLowerCase().includes(q) ||
      String(p.post_type ?? '').toLowerCase().includes(q) ||
      String(p.content_topic ?? '').toLowerCase().includes(q)
    const matchPlatform = platformFilter === 'All' || p.platform === platformFilter
    return matchSearch && matchPlatform
  })

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize) || 1)
  const currentPage = Math.min(page, totalPages)
  const pagedPosts = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  useEffect(() => {
    setPage(1)
  }, [search, platformFilter])

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages))
  }, [totalPages])

  const totalReach = posts.reduce((sum, p) => sum + Number(p.reach ?? 0), 0)
  const totalEngagement = posts.reduce((sum, p) => sum + Number(p.likes ?? 0) + Number(p.comments ?? 0) + Number(p.shares ?? 0), 0)

  const activeCaption = useMemo(() => String(activePost?.caption ?? ''), [activePost])
  const activeUrl = useMemo(() => String(activePost?.post_url ?? ''), [activePost])
  const activePlatform = useMemo(() => String(activePost?.platform ?? '—'), [activePost])
  const activeDate = useMemo(() => String(activePost?.created_at ?? '—').split('T')[0], [activePost])
  const activeType = useMemo(() => String(activePost?.post_type ?? '—'), [activePost])
  const activeTopic = useMemo(() => String(activePost?.content_topic ?? '—'), [activePost])

  useEffect(() => {
    if (!activePost) return
    // Move keyboard focus into the dialog for accessibility.
    closeBtnRef.current?.focus()
  }, [activePost])

  return (
    <main className="social-page">
      <div className="social-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <div>
          <h1>Social Media Portal</h1>
          <p className="subtitle">Engagement and post analytics</p>
        </div>
      </div>

      <section className="social-purpose" aria-labelledby="social-purpose-heading">
        <h2 id="social-purpose-heading" className="social-purpose-title">
          Why we show up online
        </h2>
        <p className="social-purpose-body">
          Social channels are how we <strong>educate the public</strong> about child protection,{' '}
          <strong>recruit donors and volunteers</strong> who want to fund real programs (not noise), and{' '}
          <strong>amplify survivor-informed messaging</strong> — always with dignity and without sharing private
          details. The numbers below help our small team see which topics and platforms resonate so we can spend
          limited time where it actually supports the mission.
        </p>
      </section>

      <div className="social-stats">
        <div className="stat-card"><span className="stat-value">{posts.length}</span><span className="stat-label">Total Posts</span></div>
        <div className="stat-card"><span className="stat-value">{totalReach.toLocaleString()}</span><span className="stat-label">Total Reach</span></div>
        <div className="stat-card"><span className="stat-value">{totalEngagement.toLocaleString()}</span><span className="stat-label">Total Engagement</span></div>
        <div className="stat-card"><span className="stat-value">{posts.filter((p) => p.is_boosted).length}</span><span className="stat-label">Boosted Posts</span></div>
      </div>

      {/* ── Outreach Playbook ───────────────────────────────────────────────── */}
      <section className="sp-playbook" aria-labelledby="sp-playbook-heading">
        <button
          type="button"
          className="sp-playbook-toggle"
          onClick={togglePlaybook}
          aria-expanded={playbookOpen}
        >
          <span className="sp-playbook-toggle-title">
            <span className="sp-playbook-toggle-icon">📋</span>
            Outreach Playbook
            <span className="sp-playbook-toggle-sub">— what the data says about what works</span>
          </span>
          <span className="sp-playbook-chevron" aria-hidden="true">{playbookOpen ? '▲' : '▼'}</span>
        </button>

        {playbookOpen && (
          <div className="sp-playbook-body">

            {/* Row 1: What to post */}
            <div className="sp-playbook-group">
              <h3 className="sp-playbook-group-title">What to Post</h3>
              <div className="sp-playbook-cards">
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">🎥</span>
                  <div>
                    <p className="sp-playbook-card-title">Lead with visual content</p>
                    <p className="sp-playbook-card-body">Videos and images significantly outperform text-only posts. Every post should include at least one piece of media.</p>
                  </div>
                </div>
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">📊</span>
                  <div>
                    <p className="sp-playbook-card-title">Name specific outcomes</p>
                    <p className="sp-playbook-card-body">Posts with real numbers ("14 girls received counseling") consistently outperform generic donation asks. Make the impact concrete.</p>
                  </div>
                </div>
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">🔗</span>
                  <div>
                    <p className="sp-playbook-card-title">Tie posts to a live campaign</p>
                    <p className="sp-playbook-card-body">Campaign-linked posts outperform standalone organic content. Even routine updates see a lift when anchored to an active fundraiser.</p>
                  </div>
                </div>
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">👆</span>
                  <div>
                    <p className="sp-playbook-card-title">Include one clear call to action</p>
                    <p className="sp-playbook-card-body">Engagement peaks when posts direct followers to a single, simple action — donate, share, or sign up. Avoid stacking multiple asks.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: When to post */}
            <div className="sp-playbook-group">
              <h3 className="sp-playbook-group-title">When to Post</h3>
              <div className="sp-playbook-cards">
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">🗓️</span>
                  <div>
                    <p className="sp-playbook-card-title">Concentrate campaigns Nov–Dec</p>
                    <p className="sp-playbook-card-body">Year-end and holiday campaigns generate 2–4× the revenue of off-season campaigns. If capacity allows only a few big pushes, make them year-end.</p>
                  </div>
                </div>
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">⏱️</span>
                  <div>
                    <p className="sp-playbook-card-title">Quality beats volume</p>
                    <p className="sp-playbook-card-body">Spacing posts out reduces audience fatigue. Average engagement per post matters more than total post count — fewer, better posts outperform a high-frequency feed.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Row 3: Campaign strategy */}
            <div className="sp-playbook-group">
              <h3 className="sp-playbook-group-title">Campaign Strategy</h3>
              <div className="sp-playbook-cards">
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">🤝</span>
                  <div>
                    <p className="sp-playbook-card-title">Announce matching gifts early</p>
                    <p className="sp-playbook-card-body">Even a small matching commitment from a major donor significantly boosts campaign revenue. Announce it at launch and repeat it throughout to sustain urgency.</p>
                  </div>
                </div>
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">🎯</span>
                  <div>
                    <p className="sp-playbook-card-title">Focus on your strongest platform</p>
                    <p className="sp-playbook-card-body">Spreading effort thin across all platforms underperforms. Identify the one platform where your audience engages most and make it the primary channel for campaigns.</p>
                  </div>
                </div>
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">📣</span>
                  <div>
                    <p className="sp-playbook-card-title">Impact messaging converts best</p>
                    <p className="sp-playbook-card-body">Campaign posts that describe specific program outcomes ("help fund one more safehouse") outperform broad awareness appeals. Connect every ask to a tangible result donors can visualize.</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="sp-playbook-disclaimer">
              Insights derived from campaign-effectiveness and social-media-engagement analytics on historical post and donation data. Use as directional guidance — results will vary with audience growth and platform algorithm changes.
            </p>
          </div>
        )}
      </section>

      <div className="social-controls">
        <div className="platform-filters">
          {platforms.map((p) => (
            <button
              key={p}
              className={`platform-btn ${platformFilter === p ? 'active' : ''}`}
              onClick={() => { setPlatformFilter(p); setPage(1) }}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          className="search-input"
          type="text"
          placeholder="Search by caption, type, topic..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
        />
        <span className="count">{filtered.length} post{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p className="state-msg">Loading...</p>}
      {error && <p className="state-msg error">{error}</p>}

      {!loading && !error && (
        <>
        <div className="posts-grid" aria-describedby="social-pagination-nav">
          {pagedPosts.map((p, idx) => (
            <button
              key={String(p.post_id ?? `${(currentPage - 1) * pageSize + idx}`)}
              type="button"
              className="post-card"
              onClick={() => setActivePost(p)}
              aria-label={`Open ${String(p.platform ?? 'social')} post details`}
            >
              <div className="post-card-header">
                <span className={`platform-badge platform-${String(p.platform ?? '').toLowerCase()}`}>{String(p.platform ?? '—')}</span>
                <span className="post-date">{String(p.created_at ?? '—').split('T')[0]}</span>
              </div>
              <div className="post-card-body">
                {!!p.caption && <p className="post-caption">{String(p.caption)}</p>}
                <div className="post-meta">
                  <span className="meta-tag">{String(p.post_type ?? '—')}</span>
                  <span className="meta-tag">{String(p.content_topic ?? '—')}</span>
                  {!!p.is_boosted && <span className="meta-tag boosted">Boosted</span>}
                </div>
                <div className="post-stats">
                  <span>👍 {Number(p.likes ?? 0).toLocaleString()}</span>
                  <span>💬 {Number(p.comments ?? 0).toLocaleString()}</span>
                  <span>↗ {Number(p.shares ?? 0).toLocaleString()}</span>
                  <span>👁 {Number(p.reach ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="state-msg">No posts match your search.</p>}
        </div>
        {filtered.length > 0 && (
          <PaginationBar
            page={currentPage}
            pageSize={pageSize}
            totalItems={filtered.length}
            onPageChange={setPage}
            onPageSizeChange={(n) => {
              setPageSize(n)
              setPage(1)
            }}
            labelId="social-pagination"
          />
        )}
        </>
      )}

      {activePost && (
        <div
          className="post-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Post details"
          onClick={() => setActivePost(null)}
        >
          <div className="post-modal" onClick={(e) => e.stopPropagation()} tabIndex={-1}>
            <div className="post-modal-header">
              <div className="post-modal-title">
                <span className={`platform-badge platform-${activePlatform.toLowerCase()}`}>{activePlatform}</span>
                <span className="post-date">{activeDate}</span>
              </div>
              <button
                type="button"
                className="post-modal-close"
                onClick={() => setActivePost(null)}
                aria-label="Close"
                ref={closeBtnRef}
              >
                ✕
              </button>
            </div>

            <div className="post-modal-body">
              <div className="post-meta">
                <span className="meta-tag">{activeType}</span>
                <span className="meta-tag">{activeTopic}</span>
                {!!activePost.is_boosted && <span className="meta-tag boosted">Boosted</span>}
              </div>

              {activeCaption ? <p className="post-modal-caption">{activeCaption}</p> : null}

              {activeUrl ? (
                <a className="post-modal-link" href={activeUrl} target="_blank" rel="noreferrer">
                  Open post ↗
                </a>
              ) : (
                <p className="post-modal-link post-modal-link--muted">No link available for this post.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
