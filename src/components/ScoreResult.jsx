import { tierForScore, computeLevel } from '../gamification.js'

// Celebratory, gamified summary shown after a quiz is submitted. Renders the
// score, the tier reached (70/80/90/100), points earned, level progress, and
// any newly-unlocked badges.

function scoreMessage(pct) {
  if (pct >= 100) return 'Perfect score! Flawless comprehension.'
  if (pct >= 90) return 'Outstanding — top of the class!'
  if (pct >= 80) return 'Great work — strong understanding.'
  if (pct >= 70) return 'Nice — you passed!'
  if (pct >= 40) return 'Keep practicing — review the explanations below.'
  return "Let's revisit the book and try again."
}

export default function ScoreResult({ pct, correct, total, gradeLabel, award }) {
  const tier = tierForScore(pct)
  const passed = pct >= 70
  const level = award?.level || (award?.profile ? computeLevel(award.profile.points) : null)

  return (
    <div className="result-card">
      <div className={`result-ring result-ring--${passed ? 'pass' : 'low'}`}>
        <span className="result-pct">{pct}%</span>
        {tier && <span className="result-tier">{tier.label}</span>}
      </div>

      <h2 className="result-headline">{scoreMessage(pct)}</h2>
      <p className="result-sub">
        {correct} of {total} correct · {gradeLabel}
      </p>

      {award && (
        <>
          <div className="result-points">
            <span className="result-points-num">+{award.pointsEarned}</span>
            <span className="result-points-label">points</span>
          </div>

          {level && (
            <div className="level-bar" aria-label={`Level ${level.level}: ${level.name}`}>
              <div className="level-bar-head">
                <span className="level-name">
                  Lv {level.level} · {level.name}
                </span>
                <span className="level-total">{award.profile.points} pts</span>
              </div>
              <div className="level-track">
                <div className="level-fill" style={{ width: `${Math.round(level.progress * 100)}%` }} />
              </div>
              {level.nextName && (
                <span className="level-next">
                  {level.pointsToNext} pts to {level.nextName}
                </span>
              )}
            </div>
          )}

          {award.newBadges?.length > 0 && (
            <div className="badge-pop">
              <p className="badge-pop-title">Badge{award.newBadges.length > 1 ? 's' : ''} unlocked!</p>
              <div className="badge-pop-row">
                {award.newBadges.map((b) => (
                  <div className="badge-chip" key={b.id} title={b.desc}>
                    <span className="badge-chip-icon">{b.icon}</span>
                    <span className="badge-chip-name">{b.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {!award && (
        <p className="result-signin-note">
          Sign in to earn points, unlock badges, and track your history.
        </p>
      )}
    </div>
  )
}
