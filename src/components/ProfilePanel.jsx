import { BADGES, computeLevel } from '../gamification.js'
import { signOut } from '../store.js'

// Full-screen profile sheet: level + points, progress to next level, badge
// grid (earned vs locked), and quiz history (passed/failed, score, points).

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export default function ProfilePanel({ profile, onClose }) {
  if (!profile) return null
  const lvl = computeLevel(profile.points)
  const earned = new Set(profile.badges)
  const passed = profile.history.filter((h) => h.passed).length

  return (
    <div className="sheet-overlay" role="dialog" aria-modal="true" aria-label="Your profile">
      <div className="sheet">
        <div className="sheet-head">
          <h2 className="sheet-title">{profile.name}</h2>
          <button type="button" className="sheet-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="profile-stats">
          <div className="stat">
            <span className="stat-num">{profile.points}</span>
            <span className="stat-label">Points</span>
          </div>
          <div className="stat">
            <span className="stat-num">Lv {lvl.level}</span>
            <span className="stat-label">{lvl.name}</span>
          </div>
          <div className="stat">
            <span className="stat-num">{passed}</span>
            <span className="stat-label">Quizzes passed</span>
          </div>
        </div>

        <div className="level-bar">
          <div className="level-track">
            <div className="level-fill" style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
          </div>
          <span className="level-next">
            {lvl.nextName ? `${lvl.pointsToNext} pts to ${lvl.nextName}` : 'Max level reached!'}
          </span>
        </div>

        <h3 className="sheet-subtitle">Badges</h3>
        <div className="badge-grid">
          {BADGES.map((b) => {
            const has = earned.has(b.id)
            return (
              <div key={b.id} className={`badge-tile${has ? '' : ' badge-tile--locked'}`} title={b.desc}>
                <span className="badge-tile-icon">{has ? b.icon : '🔒'}</span>
                <span className="badge-tile-name">{b.name}</span>
                <span className="badge-tile-desc">{b.desc}</span>
              </div>
            )
          })}
        </div>

        <h3 className="sheet-subtitle">History</h3>
        {profile.history.length === 0 ? (
          <p className="history-empty">No quizzes yet — generate one to get started!</p>
        ) : (
          <ul className="history-list">
            {profile.history.map((h) => (
              <li key={h.id} className="history-item">
                <span className={`history-badge history-badge--${h.passed ? 'pass' : 'low'}`}>
                  {h.pct}%
                </span>
                <span className="history-text">
                  <span className="history-title">{h.bookTitle}</span>
                  <span className="history-meta">
                    {h.correct}/{h.questionCount} · {h.gradeLabel} · {timeAgo(h.ts)}
                  </span>
                </span>
                <span className="history-pts">+{h.points}</span>
              </li>
            ))}
          </ul>
        )}

        <button type="button" className="btn btn--secondary sheet-signout" onClick={() => { signOut(); onClose() }}>
          Sign out
        </button>
      </div>
    </div>
  )
}
