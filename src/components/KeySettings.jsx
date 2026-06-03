import { useState } from 'react'
import { getApiKey, setApiKey } from '../store.js'

// Required API-key panel. Quizzes are generated with the user's own free Google
// AI Studio (Gemini) key. Saving a key updates the reactive store, which unlocks
// the search/generate UI in App. The key is stored only in this browser and sent
// directly to Google.

export default function KeySettings() {
  const [value, setValue] = useState(getApiKey())
  const [show, setShow] = useState(false)
  const [saved, setSaved] = useState(false)
  const has = getApiKey().length > 0

  function save() {
    setApiKey(value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function remove() {
    setApiKey('')
    setValue('')
    setSaved(false)
  }

  return (
    <details className="key-panel" open={!has}>
      <summary className="key-summary">
        <span>
          Your Google AI Studio key{' '}
          {has ? (
            <span className="key-status key-status--ok">key saved</span>
          ) : (
            <span className="key-status key-status--need">required</span>
          )}
        </span>
      </summary>

      <div className="key-body">
        <p className="key-intro">
          BookQuiz uses your own <strong>free</strong> Google AI Studio (Gemini) key to
          write quizzes. It’s stored only in this browser and sent directly to Google —
          never to any server. Follow the steps below to get one in about a minute.
        </p>

        <div className="key-input-row">
          <input
            type={show ? 'text' : 'password'}
            className="text-input"
            placeholder="AIza..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="off"
            spellCheck="false"
          />
          <button type="button" className="btn btn--secondary" onClick={() => setShow((s) => !s)}>
            {show ? 'Hide' : 'Show'}
          </button>
        </div>

        <div className="key-actions">
          <button type="button" className="btn btn--primary" onClick={save} disabled={!value.trim()}>
            {saved ? 'Saved ✓' : 'Save key'}
          </button>
          {has && (
            <button type="button" className="btn btn--ghost-dark" onClick={remove}>
              Remove key
            </button>
          )}
        </div>

        <div className="key-howto">
          <p className="key-howto-title">How to get a free key (about 1 minute)</p>
          <ol className="key-howto-steps">
            <li>
              Go to{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                aistudio.google.com/apikey
              </a>{' '}
              and sign in with a Google account.
            </li>
            <li>Click <strong>Create API key</strong> (accept the terms if prompted).</li>
            <li>Pick or create a project if it asks, then click <strong>Create</strong>.</li>
            <li>Copy the key (it starts with <code>AIza…</code>) and paste it above, then <strong>Save key</strong>.</li>
          </ol>
          <p className="key-howto-note">
            The free tier needs no billing. Your key never leaves your device except in
            requests to Google. Remove it any time to return to the free service.
          </p>
        </div>
      </div>
    </details>
  )
}
