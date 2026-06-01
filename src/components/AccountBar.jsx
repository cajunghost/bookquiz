import { useState } from 'react'
import { computeLevel } from '../gamification.js'
import { createProfile, listProfiles, switchProfile } from '../store.js'

// Compact account control in the masthead. Signed out: shows a "Sign in"
// button that opens a lightweight name-based account creator / switcher (no
// passwords — local device profiles). Signed in: shows level + points and
// opens the full profile panel.

export default function AccountBar({ profile, onOpenProfile }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [name, setName] = useState('')

  function create(e) {
    e.preventDefault()
    if (!name.trim()) return
    createProfile(name)
    setName('')
    setMenuOpen(false)
  }

  if (profile) {
    const lvl = computeLevel(profile.points)
    return (
      <button type="button" className="account-pill" onClick={onOpenProfile}>
        <span className="account-avatar" aria-hidden="true">
          {profile.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="account-pill-text">
          <span className="account-pill-name">{profile.name}</span>
          <span className="account-pill-meta">
            Lv {lvl.level} · {profile.points} pts
          </span>
        </span>
      </button>
    )
  }

  const existing = listProfiles()
  return (
    <div className="account-signin">
      <button type="button" className="btn btn--ghost" onClick={() => setMenuOpen((o) => !o)}>
        Sign in
      </button>
      {menuOpen && (
        <div className="account-menu" role="dialog" aria-label="Sign in or create profile">
          <form onSubmit={create}>
            <label className="field-label" htmlFor="acct-name">
              Create a profile
            </label>
            <div className="account-menu-row">
              <input
                id="acct-name"
                className="text-input"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
                Start
              </button>
            </div>
          </form>
          {existing.length > 0 && (
            <div className="account-existing">
              <span className="field-label">Switch to</span>
              {existing.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="account-existing-item"
                  onClick={() => {
                    switchProfile(p.id)
                    setMenuOpen(false)
                  }}
                >
                  <span className="account-avatar account-avatar--sm" aria-hidden="true">
                    {p.name.slice(0, 1).toUpperCase()}
                  </span>
                  {p.name}
                  <span className="account-existing-pts">{p.points} pts</span>
                </button>
              ))}
            </div>
          )}
          <p className="account-note">
            Profiles are saved on this device — no password, no email.
          </p>
        </div>
      )}
    </div>
  )
}
