import { useState } from 'react'
import { getApiKey, setApiKey } from '../store.js'

// Optional "bring your own key" panel. The app works with no key (free shared
// service); adding a free Google AI Studio (Gemini) key gives higher-quality,
// more reliable generation. The key is stored only in this browser and sent
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
    <details className="key-panel" open={false}>
      <summary className="key-summary">
        <span>
          Use your own AI key{' '}
          {has ? (
            <span className="key-status key-status--ok">key saved · higher quality</span>
          ) : (
            <span className="key-status key-status--opt">optional</span>
          )}
        </span>
      </summary>

      <div className="key-body">
        <p className="key-intro">
          BookQuiz works with <strong>no key</strong> using a free shared service. For
          faster, higher-quality quizzes, add your own <strong>free</strong> Google AI
          Studio (Gemini) key — it’s stored only in this browser and sent directly to
          Google.
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
