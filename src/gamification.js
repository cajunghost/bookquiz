// Gamification rules: how a quiz score converts to points, level thresholds,
// and badge definitions. Pure functions so they're easy to test and reuse.

// Score tiers and the base points each awards. Scaled by quiz length so a
// 50-question quiz is worth more than a 5-question one.
const TIERS = [
  { min: 100, points: 100, label: 'Perfect', key: 'perfect' },
  { min: 90, points: 60, label: 'Excellent', key: 'excellent' },
  { min: 80, points: 40, label: 'Great', key: 'great' },
  { min: 70, points: 25, label: 'Passed', key: 'passed' },
]

/**
 * Points for a quiz attempt. Below 70% earns a small consolation so practice
 * still nudges the counter, but the headline rewards are the 70/80/90/100 tiers.
 * Longer quizzes scale up (×1 at 5q, up to ×2 at 50q).
 */
export function pointsForScore(pct, questionCount = 10) {
  const lengthMultiplier = 1 + Math.min(1, (questionCount - 5) / 45) // 1.0 → 2.0
  const tier = TIERS.find((t) => pct >= t.min)
  const base = tier ? tier.points : Math.round((pct / 100) * 10) // <70%: up to 9 pts
  return Math.round(base * lengthMultiplier)
}

export function tierForScore(pct) {
  return TIERS.find((t) => pct >= t.min) || null
}

// Level curve: each level needs progressively more points (triangular-ish).
const LEVELS = [
  { level: 1, name: 'Page Turner', min: 0 },
  { level: 2, name: 'Bookworm', min: 100 },
  { level: 3, name: 'Story Seeker', min: 300 },
  { level: 4, name: 'Chapter Champion', min: 600 },
  { level: 5, name: 'Plot Master', min: 1000 },
  { level: 6, name: 'Lit Scholar', min: 1600 },
  { level: 7, name: 'Comprehension Sage', min: 2400 },
  { level: 8, name: 'Literary Legend', min: 3500 },
]

export function computeLevel(points) {
  let current = LEVELS[0]
  let next = null
  for (let i = 0; i < LEVELS.length; i++) {
    if (points >= LEVELS[i].min) {
      current = LEVELS[i]
      next = LEVELS[i + 1] || null
    }
  }
  const span = next ? next.min - current.min : 1
  const into = points - current.min
  const progress = next ? Math.min(1, into / span) : 1
  return {
    level: current.level,
    name: current.name,
    points,
    nextName: next?.name || null,
    pointsToNext: next ? next.min - points : 0,
    progress,
  }
}

// Badge catalog. Each badge has a predicate over a profile (post-update).
export const BADGES = [
  { id: 'first_quiz', icon: '🎯', name: 'First Steps', desc: 'Complete your first quiz', test: (p) => p.history.length >= 1 },
  { id: 'first_pass', icon: '✅', name: 'Passing Grade', desc: 'Score 70% or higher', test: (p) => p.history.some((h) => h.pct >= 70) },
  { id: 'perfect', icon: '💯', name: 'Flawless', desc: 'Score 100% on a quiz', test: (p) => p.history.some((h) => h.pct >= 100) },
  { id: 'ninety', icon: '⭐', name: 'Top of the Class', desc: 'Score 90% or higher', test: (p) => p.history.some((h) => h.pct >= 90) },
  { id: 'five_passed', icon: '📚', name: 'Avid Reader', desc: 'Pass 5 quizzes', test: (p) => p.history.filter((h) => h.passed).length >= 5 },
  { id: 'ten_passed', icon: '🏆', name: 'Scholar', desc: 'Pass 10 quizzes', test: (p) => p.history.filter((h) => h.passed).length >= 10 },
  { id: 'streak3', icon: '🔥', name: 'On a Roll', desc: 'Pass 3 quizzes in a row', test: (p) => maxPassStreak(p.history) >= 3 },
  { id: 'big_quiz', icon: '🧠', name: 'Marathon Mind', desc: 'Pass a 50-question quiz', test: (p) => p.history.some((h) => h.passed && h.questionCount >= 50) },
  { id: 'level5', icon: '👑', name: 'Plot Master', desc: 'Reach Level 5', test: (p) => computeLevel(p.points).level >= 5 },
]

// history is newest-first; compute the longest run of consecutive passes.
function maxPassStreak(history) {
  let best = 0
  let run = 0
  // iterate chronological order
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].passed) {
      run += 1
      best = Math.max(best, run)
    } else {
      run = 0
    }
  }
  return best
}

export function badgesFor(profile) {
  return BADGES.filter((b) => {
    try {
      return b.test(profile)
    } catch {
      return false
    }
  })
}

export function badgeById(id) {
  return BADGES.find((b) => b.id === id) || null
}
