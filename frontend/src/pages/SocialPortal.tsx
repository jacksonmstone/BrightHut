import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSocialMediaPosts } from '../api/social'
import PaginationBar from '../components/PaginationBar'
import './SocialPortal.css'

// ── Post Scorer: OLS coefficients from social-media-engagement.ipynb ─────────
// Standardized-feature OLS on log_engagement, n=812 posts, R²=0.406.
// Only statistically significant features (p < 0.10) are used.
const OLS_PLATFORM: Record<string, number> = {
  YouTube: 0.201, TikTok: 0.145, Instagram: 0.142,
  Facebook: 0, Twitter: -0.095, LinkedIn: -0.128, WhatsApp: -0.337,
}
const OLS_CONTENT: Record<string, number> = {
  'Impact Story': 0.209, 'Educational Content': 0, 'Thank You': 0,
  'Fundraising Appeal': 0, 'Event Promotion': -0.124, 'General': 0,
}
// hour_of_day coef = 0.697 on standardized inputs; mapped to 4 time slots
const OLS_HOUR: Record<string, number> = {
  'Night (11pm–5am)':    -1.20 * 0.697,
  'Morning (6am–11am)':  -0.50 * 0.697,
  'Afternoon (12pm–5pm)': 0.20 * 0.697,
  'Evening (6pm–10pm)':   1.00 * 0.697,
}
const OLS_VIDEO    =  0.241
const OLS_LINK     =  0.434
const OLS_QUESTION = -0.342
// Range calibrated on worst/best-case combinations so score is always 0–100
const OLS_MIN   = -1.639
const OLS_RANGE =  3.421

function computePostScore(
  platform: string, contentType: string, timeSlot: string,
  hasVideo: boolean, hasLink: boolean, hasQuestion: boolean,
): { score: number; tier: 'High' | 'Medium' | 'Low'; factors: { label: string; positive: boolean }[] } {
  const raw = (OLS_PLATFORM[platform] ?? 0)
    + (OLS_CONTENT[contentType] ?? 0)
    + (OLS_HOUR[timeSlot] ?? 0)
    + (hasVideo ? OLS_VIDEO : 0)
    + (hasLink  ? OLS_LINK  : 0)
    + (hasQuestion ? OLS_QUESTION : 0)
  const score = Math.round(Math.min(100, Math.max(0, (raw - OLS_MIN) / OLS_RANGE * 100)))
  const tier: 'High' | 'Medium' | 'Low' = score >= 65 ? 'High' : score >= 35 ? 'Medium' : 'Low'

  const allFactors = [
    { label: timeSlot,     effect: OLS_HOUR[timeSlot] ?? 0 },
    { label: platform,     effect: OLS_PLATFORM[platform] ?? 0 },
    { label: contentType,  effect: OLS_CONTENT[contentType] ?? 0 },
    ...(hasVideo    ? [{ label: 'Video content',          effect: OLS_VIDEO    }] : []),
    ...(hasLink     ? [{ label: 'Link included',           effect: OLS_LINK     }] : []),
    ...(hasQuestion ? [{ label: 'Question in caption',     effect: OLS_QUESTION }] : []),
  ]
  const factors = allFactors
    .filter(f => Math.abs(f.effect) > 0.05)
    .sort((a, b) => Math.abs(b.effect) - Math.abs(a.effect))
    .slice(0, 3)
    .map(f => ({ label: f.label, positive: f.effect > 0 }))

  return { score, tier, factors }
}

// ── Campaign Planner: patterns from campaign-effectiveness.ipynb ──────────────
// Ridge regression on 4 campaigns (standardized features).
// Results are directional only — used as a structured checklist, not a model.
function computeCampaignScore(
  isHoliday: boolean, postCount: 'Low' | 'Medium' | 'High',
  isImpactFocused: boolean, hasMatchingGift: boolean,
): { score: number; tier: 'Strong' | 'Moderate' | 'Needs Work'; tips: string[] } {
  let s = 0
  const tips: string[] = []
  if (isHoliday)       { s += 25; }
  else                 { tips.push('Holiday-season (Nov–Dec) campaigns averaged higher revenue in the dataset.') }
  if (postCount === 'High')   s += 25
  else if (postCount === 'Medium') { s += 15; tips.push('More posts correlated with higher revenue; consider increasing posting frequency.') }
  else                 { s += 0;  tips.push('Low post count may limit reach — aim for 30+ posts per campaign.') }
  if (isImpactFocused) { s += 30; }
  else                 { tips.push('Impact-focused posts (specific outcomes, program updates) drove stronger results.') }
  if (hasMatchingGift) { s += 20; }
  else                 { tips.push('Even a small matching gift commitment from a major donor can significantly boost campaign revenue.') }
  const tier: 'Strong' | 'Moderate' | 'Needs Work' = s >= 65 ? 'Strong' : s >= 35 ? 'Moderate' : 'Needs Work'
  return { score: s, tier, tips }
}

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

  // Post Scorer state
  const [scorerPlatform, setScorerPlatform]     = useState('Instagram')
  const [scorerContent,  setScorerContent]      = useState('Impact Story')
  const [scorerTime,     setScorerTime]         = useState('Evening (6pm–10pm)')
  const [scorerVideo,    setScorerVideo]        = useState(true)
  const [scorerLink,     setScorerLink]         = useState(false)
  const [scorerQuestion, setScorerQuestion]     = useState(false)
  const postResult = useMemo(
    () => computePostScore(scorerPlatform, scorerContent, scorerTime, scorerVideo, scorerLink, scorerQuestion),
    [scorerPlatform, scorerContent, scorerTime, scorerVideo, scorerLink, scorerQuestion],
  )

  // Campaign Planner state
  const [campHoliday,  setCampHoliday]  = useState(false)
  const [campPosts,    setCampPosts]    = useState<'Low' | 'Medium' | 'High'>('Medium')
  const [campImpact,   setCampImpact]   = useState(true)
  const [campMatch,    setCampMatch]    = useState(false)
  const campaignResult = useMemo(
    () => computeCampaignScore(campHoliday, campPosts, campImpact, campMatch),
    [campHoliday, campPosts, campImpact, campMatch],
  )

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
        <button className="sp-back-btn" onClick={() => navigate('/')}>← Back</button>
        <h1>Social Media Portal</h1>
        <p className="subtitle">Engagement and post analytics</p>
      </div>

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
                    <p className="sp-playbook-card-body">Videos and images outperform text-only posts. Always include media.</p>
                  </div>
                </div>
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">📊</span>
                  <div>
                    <p className="sp-playbook-card-title">Name specific outcomes</p>
                    <p className="sp-playbook-card-body">Real numbers beat generic asks. Make the impact concrete.</p>
                  </div>
                </div>
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">🔗</span>
                  <div>
                    <p className="sp-playbook-card-title">Tie posts to a live campaign</p>
                    <p className="sp-playbook-card-body">Campaign-linked posts outperform standalone content.</p>
                  </div>
                </div>
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">👆</span>
                  <div>
                    <p className="sp-playbook-card-title">One clear call to action</p>
                    <p className="sp-playbook-card-body">Pick one ask — donate, share, or sign up. Don't stack multiple.</p>
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
                    <p className="sp-playbook-card-body">Year-end campaigns generate 2–4× more revenue. Prioritize your big pushes here.</p>
                  </div>
                </div>
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">⏱️</span>
                  <div>
                    <p className="sp-playbook-card-title">Quality beats volume</p>
                    <p className="sp-playbook-card-body">Fewer, better posts outperform a high-frequency feed.</p>
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
                    <p className="sp-playbook-card-body">A matching commitment boosts revenue. Announce at launch and repeat throughout.</p>
                  </div>
                </div>
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">🎯</span>
                  <div>
                    <p className="sp-playbook-card-title">Focus on your strongest platform</p>
                    <p className="sp-playbook-card-body">Go deep on one platform rather than spreading thin across all.</p>
                  </div>
                </div>
                <div className="sp-playbook-card">
                  <span className="sp-playbook-card-icon">📣</span>
                  <div>
                    <p className="sp-playbook-card-title">Impact messaging converts best</p>
                    <p className="sp-playbook-card-body">Tie every ask to a specific outcome donors can picture.</p>
                  </div>
                </div>
              </div>
            </div>

            <p className="sp-playbook-disclaimer">
              Based on historical post and donation data. Use as directional guidance.
            </p>
          </div>
        )}
      </section>

      {/* ── Post Scorer ────────────────────────────────────────────────── */}
      <section className="sp-scorer" aria-labelledby="sp-scorer-heading">
        <div className="sp-scorer-header">
          <h2 id="sp-scorer-heading" className="sp-scorer-title">
            Post Scorer
          </h2>
          <p className="sp-scorer-subtitle">
            Configure a post below to get a predicted engagement score — computed from OLS regression on 812 historical posts (R²&nbsp;=&nbsp;0.41).
          </p>
        </div>
        <div className="sp-scorer-body">
          <div className="sp-scorer-form">
            <label className="sp-scorer-field">
              <span>Platform</span>
              <select value={scorerPlatform} onChange={e => setScorerPlatform(e.target.value)}>
                {Object.keys(OLS_PLATFORM).map(p => <option key={p}>{p}</option>)}
              </select>
            </label>
            <label className="sp-scorer-field">
              <span>Content Type</span>
              <select value={scorerContent} onChange={e => setScorerContent(e.target.value)}>
                {Object.keys(OLS_CONTENT).map(c => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="sp-scorer-field">
              <span>Time of Day</span>
              <select value={scorerTime} onChange={e => setScorerTime(e.target.value)}>
                {Object.keys(OLS_HOUR).map(t => <option key={t}>{t}</option>)}
              </select>
            </label>
            <div className="sp-scorer-checks">
              <label className="sp-scorer-check">
                <input type="checkbox" checked={scorerVideo} onChange={e => setScorerVideo(e.target.checked)} />
                <span>Video content</span>
              </label>
              <label className="sp-scorer-check">
                <input type="checkbox" checked={scorerLink} onChange={e => setScorerLink(e.target.checked)} />
                <span>Link in post</span>
              </label>
              <label className="sp-scorer-check">
                <input type="checkbox" checked={scorerQuestion} onChange={e => setScorerQuestion(e.target.checked)} />
                <span>Question in caption</span>
              </label>
            </div>
          </div>
          <div className="sp-scorer-result">
            <div className={`sp-scorer-tier sp-scorer-tier--${postResult.tier.toLowerCase()}`}>
              {postResult.tier} Engagement
            </div>
            <div className="sp-scorer-bar-wrap" aria-label={`Engagement score ${postResult.score} out of 100`}>
              <div className="sp-scorer-bar" style={{ width: `${postResult.score}%` }} />
            </div>
            <div className="sp-scorer-score">{postResult.score} / 100</div>
            {postResult.factors.length > 0 && (
              <ul className="sp-scorer-factors">
                {postResult.factors.map(f => (
                  <li key={f.label} className={f.positive ? 'factor-pos' : 'factor-neg'}>
                    {f.positive ? '↑' : '↓'} {f.label}
                  </li>
                ))}
              </ul>
            )}
            <p className="sp-scorer-disclaimer">
              Scores are relative, not absolute. Based on historical patterns — results will vary.
            </p>
          </div>
        </div>
      </section>

      {/* ── Campaign Planner ────────────────────────────────────────────── */}
      <section className="sp-scorer" aria-labelledby="sp-campaign-heading">
        <div className="sp-scorer-header">
          <h2 id="sp-campaign-heading" className="sp-scorer-title">
            Campaign Planner
          </h2>
          <p className="sp-scorer-subtitle">
            Rate your campaign configuration against patterns found in historical campaign data. Results are directional — based on&nbsp;4&nbsp;campaigns.
          </p>
        </div>
        <div className="sp-scorer-body">
          <div className="sp-scorer-form">
            <label className="sp-scorer-field">
              <span>Campaign Posts Volume</span>
              <select value={campPosts} onChange={e => setCampPosts(e.target.value as 'Low' | 'Medium' | 'High')}>
                <option value="Low">Low (&lt; 30 posts)</option>
                <option value="Medium">Medium (30–60 posts)</option>
                <option value="High">High (&gt; 60 posts)</option>
              </select>
            </label>
            <div className="sp-scorer-checks">
              <label className="sp-scorer-check">
                <input type="checkbox" checked={campHoliday} onChange={e => setCampHoliday(e.target.checked)} />
                <span>Holiday season (Nov–Dec)</span>
              </label>
              <label className="sp-scorer-check">
                <input type="checkbox" checked={campImpact} onChange={e => setCampImpact(e.target.checked)} />
                <span>Impact-focused messaging</span>
              </label>
              <label className="sp-scorer-check">
                <input type="checkbox" checked={campMatch} onChange={e => setCampMatch(e.target.checked)} />
                <span>Matching gift committed</span>
              </label>
            </div>
          </div>
          <div className="sp-scorer-result">
            <div className={`sp-scorer-tier sp-scorer-tier--${campaignResult.tier === 'Strong' ? 'high' : campaignResult.tier === 'Moderate' ? 'medium' : 'low'}`}>
              {campaignResult.tier} Readiness
            </div>
            <div className="sp-scorer-bar-wrap" aria-label={`Campaign readiness score ${campaignResult.score} out of 100`}>
              <div className="sp-scorer-bar" style={{ width: `${campaignResult.score}%` }} />
            </div>
            <div className="sp-scorer-score">{campaignResult.score} / 100</div>
            {campaignResult.tips.length > 0 && (
              <ul className="sp-scorer-factors">
                {campaignResult.tips.map(t => (
                  <li key={t} className="factor-neg">↑ {t}</li>
                ))}
              </ul>
            )}
            <p className="sp-scorer-disclaimer">
              Based on patterns across 4 historical campaigns. Treat as directional guidance only.
            </p>
          </div>
        </div>
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
