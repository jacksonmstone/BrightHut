import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSocialMediaPosts } from '../api/social'
import './SocialPortal.css'

type Post = Record<string, unknown>

export default function SocialPortal() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [platformFilter, setPlatformFilter] = useState('All')
  const [visible, setVisible] = useState(12)
  const [activePost, setActivePost] = useState<Post | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

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

      <div className="social-stats">
        <div className="stat-card"><span className="stat-value">{posts.length}</span><span className="stat-label">Total Posts</span></div>
        <div className="stat-card"><span className="stat-value">{totalReach.toLocaleString()}</span><span className="stat-label">Total Reach</span></div>
        <div className="stat-card"><span className="stat-value">{totalEngagement.toLocaleString()}</span><span className="stat-label">Total Engagement</span></div>
        <div className="stat-card"><span className="stat-value">{posts.filter((p) => p.is_boosted).length}</span><span className="stat-label">Boosted Posts</span></div>
      </div>

      <div className="social-controls">
        <div className="platform-filters">
          {platforms.map((p) => (
            <button
              key={p}
              className={`platform-btn ${platformFilter === p ? 'active' : ''}`}
              onClick={() => { setPlatformFilter(p); setVisible(6) }}
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
          onChange={(e) => { setSearch(e.target.value); setVisible(6) }}
        />
        <span className="count">{filtered.length} post{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p className="state-msg">Loading...</p>}
      {error && <p className="state-msg error">{error}</p>}

      {!loading && !error && (
        <div className="posts-grid">
          {filtered.slice(0, visible).map((p, i) => (
            <button
              key={i}
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
      )}
      {!loading && !error && visible < filtered.length && (
        <div className="load-more-wrap">
          <button className="load-more-btn" onClick={() => setVisible((v) => v + 12)}>
            See 12 more ({filtered.length - visible} remaining)
          </button>
        </div>
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
