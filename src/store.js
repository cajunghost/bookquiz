// Local-first data store: accounts (profiles), points, quiz history, and
// per-book question feedback. Everything persists in localStorage on the
// device — no backend, consistent with the keyless, static-hosting design.
//
// NOTE (cross-device): because storage is local, points/history live per
// browser/device. A future backend could sync this same shape across devices;
// the data model here is intentionally backend-friendly (plain JSON records).

import { computeLevel, badgesFor } from './gamification.js'

const PROFILES_KEY = 'bookquiz_profiles_v1'
const FEEDBACK_KEY = 'bookquiz_feedback_v1'
const APIKEY_KEY = 'bookquiz_gemini_key_v1'

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore quota/private-mode errors */
  }
}

function uid() {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
  ).toUpperCase()
}

// ---- in-memory state mirrored to localStorage -----------------------------

let state = {
  activeId: null,
  profiles: {}, // id -> profile
  feedback: {}, // bookKey -> [ {question, reason, ts} ]
  apiKey: '', // user-supplied Gemini key (mirrored to localStorage)
}

function hydrate() {
  const p = load(PROFILES_KEY, { activeId: null, profiles: {} })
  state = {
    activeId: p.activeId || null,
    profiles: p.profiles || {},
    feedback: load(FEEDBACK_KEY, {}),
    apiKey: load(APIKEY_KEY, ''),
  }
}
hydrate()

const listeners = new Set()
function emit() {
  for (const l of listeners) l()
}
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
export function getState() {
  return state
}

function persistProfiles() {
  save(PROFILES_KEY, { activeId: state.activeId, profiles: state.profiles })
}
function persistFeedback() {
  save(FEEDBACK_KEY, state.feedback)
}

// ---- profile (account) management -----------------------------------------

function newProfile(name) {
  return {
    id: uid(),
    name: name.trim() || 'Reader',
    createdAt: Date.now(),
    points: 0,
    history: [], // newest first
    badges: [], // badge ids earned
  }
}

export function getActiveProfile() {
  return state.activeId ? state.profiles[state.activeId] || null : null
}

export function listProfiles() {
  return Object.values(state.profiles).sort((a, b) => b.createdAt - a.createdAt)
}

export function createProfile(name) {
  const p = newProfile(name)
  state = {
    ...state,
    profiles: { ...state.profiles, [p.id]: p },
    activeId: p.id,
  }
  persistProfiles()
  emit()
  return p
}

export function switchProfile(id) {
  if (!state.profiles[id]) return
  state = { ...state, activeId: id }
  persistProfiles()
  emit()
}

export function signOut() {
  state = { ...state, activeId: null }
  persistProfiles()
  emit()
}

export function deleteProfile(id) {
  if (!state.profiles[id]) return
  const profiles = { ...state.profiles }
  delete profiles[id]
  const activeId = state.activeId === id ? null : state.activeId
  state = { ...state, profiles, activeId }
  persistProfiles()
  emit()
}

// ---- recording a completed quiz -------------------------------------------

/**
 * Record a finished quiz against the active profile.
 * @returns {{entry, pointsEarned, newBadges, profile}|null}
 */
export function recordQuizResult({ book, gradeLabel, questionCount, correct, pct, points }) {
  const active = getActiveProfile()
  if (!active) return null

  const entry = {
    id: uid(),
    ts: Date.now(),
    bookTitle: book?.title || 'Unknown book',
    author: (book?.authors || [])[0] || null,
    gradeLabel,
    questionCount,
    correct,
    pct,
    points,
    passed: pct >= 70,
  }

  const updated = {
    ...active,
    points: active.points + points,
    history: [entry, ...active.history].slice(0, 200),
  }

  // Award any newly-earned badges.
  const before = new Set(active.badges)
  const earned = badgesFor(updated)
  const newBadges = earned.filter((b) => !before.has(b.id))
  updated.badges = earned.map((b) => b.id)

  state = {
    ...state,
    profiles: { ...state.profiles, [updated.id]: updated },
  }
  persistProfiles()
  emit()

  return {
    entry,
    pointsEarned: points,
    newBadges,
    profile: updated,
    level: computeLevel(updated.points),
  }
}

// ---- question feedback (teach-the-model signal) ---------------------------

export function bookKey(book) {
  const t = (book?.title || '').toLowerCase().trim()
  const a = ((book?.authors || [])[0] || '').toLowerCase().trim()
  return `${t}|${a}`
}

/**
 * Flag a question as inaccurate/not faithful to the book. Stored per book and
 * later fed back into the generation prompt so the model avoids repeating it.
 */
export function addFeedback(book, question, reason) {
  const key = bookKey(book)
  const list = state.feedback[key] || []
  const entry = {
    question: question?.question || '',
    options: question?.options || [],
    flaggedAnswer: question?.options?.[question?.correctIndex] ?? null,
    reason: reason || 'inaccurate',
    ts: Date.now(),
  }
  const next = [entry, ...list].slice(0, 30)
  state = { ...state, feedback: { ...state.feedback, [key]: next } }
  persistFeedback()
  emit()
}

export function getFeedback(book) {
  return state.feedback[bookKey(book)] || []
}

// Export all collected feedback (e.g. to later train/evaluate a model).
export function exportFeedback() {
  return JSON.stringify(state.feedback, null, 2)
}

// ---- optional user-supplied Gemini API key --------------------------------
// Stored separately (not inside a profile) so it persists across sign-in/out
// on the device. Sent only to Google, never to any server we run.

export function getApiKey() {
  return state.apiKey || ''
}

export function setApiKey(value) {
  const v = (value || '').trim()
  // Replace the state object so useSyncExternalStore detects the change and
  // re-renders subscribers (this is what unlocks the search/generate UI).
  state = { ...state, apiKey: v }
  save(APIKEY_KEY, v)
  emit()
}

export function hasApiKey() {
  return getApiKey().length > 0
}
