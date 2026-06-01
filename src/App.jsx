import { useState } from 'react'
import { GRADE_LEVELS, QUESTION_COUNTS, gradeLabel as labelFor } from './gradeLevels.js'
import { resolveBook } from './bookLookup.js'
import { generateQuiz } from './gemini.js'
import BookCard from './components/BookCard.jsx'
import BookSearch from './components/BookSearch.jsx'
import Quiz from './components/Quiz.jsx'

const KEY_STORE = 'bookquiz_gemini_key'
const readKey = () => {
  try {
    return localStorage.getItem(KEY_STORE) || ''
  } catch {
    return ''
  }
}
const writeKey = (v) => {
  try {
    v ? localStorage.setItem(KEY_STORE, v) : localStorage.removeItem(KEY_STORE)
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [apiKey, setApiKey] = useState(readKey())
  const [showKey, setShowKey] = useState(false)

  const [query, setQuery] = useState('')
  const [gradeLevel, setGradeLevel] = useState('5')
  const [questionCount, setQuestionCount] = useState(10)

  const [book, setBook] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | resolving | resolved | generating | ready
  const [error, setError] = useState('')

  const hasKey = apiKey.trim().length > 0
  const gradeLabel = labelFor(gradeLevel)
  const busy = phase === 'resolving' || phase === 'generating'

  function onApiKeyChange(value) {
    setApiKey(value)
    writeKey(value)
  }

  function resetDownstream() {
    setBook(null)
    setQuiz(null)
    setError('')
    setPhase('idle')
  }

  // Picked from the autocomplete dropdown — already a quiz-ready record.
  function onSelectSuggestion(s) {
    setError('')
    setQuiz(null)
    setBook({
      title: s.title,
      subtitle: null,
      authors: s.authors || [],
      description: s.description || null,
      categories: [],
      subjects: s.subjects || [],
      firstSentence: s.firstSentence || null,
      publishedYear: s.publishedYear || null,
      publisher: null,
      pageCount: null,
      coverUrl: s.coverUrl || null,
      freeText: !!s.freeText,
      sources: [s.source].filter(Boolean),
    })
    setPhase('resolved')
  }

  async function onFindBook(e) {
    e?.preventDefault?.()
    if (!query.trim() || busy) return
    setError('')
    setQuiz(null)
    setBook(null)
    setPhase('resolving')
    try {
      const found = await resolveBook(query.trim())
      if (!found) throw new Error('No matching book was found. Try a more specific title or an ISBN.')
      setBook(found)
      setPhase('resolved')
    } catch (err) {
      setError(err.message)
      setPhase('idle')
    }
  }

  async function onGenerate() {
    if (busy || !hasKey) return
    setError('')
    setQuiz(null)
    setPhase('generating')
    try {
      // Resolve the book on demand if it hasn't been resolved yet (or the
      // query changed), so generating never runs with a null book.
      let activeBook = book
      if (!activeBook || !activeBook.title) {
        if (!query.trim()) throw new Error('Enter a book title or ISBN first.')
        activeBook = await resolveBook(query.trim())
        if (!activeBook) {
          throw new Error('No matching book was found. Try a more specific title or an ISBN.')
        }
        setBook(activeBook)
      }
      const result = await generateQuiz({
        apiKey: apiKey.trim(),
        book: activeBook,
        gradeValue: gradeLevel,
        questionCount: Number(questionCount),
      })
      setQuiz(result)
      setPhase('ready')
    } catch (err) {
      setError(err.message)
      setPhase(book ? 'resolved' : 'idle')
    }
  }

  return (
    <div className="app">
      <header className="masthead">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">📖</span>
          <h1 className="brand-name">BookQuiz</h1>
        </div>
        <p className="tagline">
          Reading-comprehension quizzes for any book, tuned to the reader's grade.
        </p>
      </header>

      <main className="container">
        <details className="key-panel" open={!hasKey}>
          <summary className="key-summary">
            <span>
              Google Gemini API key (free){' '}
              {hasKey ? (
                <span className="key-status key-status--ok">saved in this browser</span>
              ) : (
                <span className="key-status key-status--need">required</span>
              )}
            </span>
          </summary>
          <div className="key-body">
            <div className="key-input-row">
              <input
                type={showKey ? 'text' : 'password'}
                className="text-input"
                placeholder="AIza..."
                value={apiKey}
                onChange={(e) => onApiKeyChange(e.target.value)}
                autoComplete="off"
                spellCheck="false"
              />
              <button type="button" className="btn btn--secondary" onClick={() => setShowKey((s) => !s)}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="key-note">
              Free from Google AI Studio. Your key is stored only in this browser and sent
              directly to the Gemini API — it never passes through any server.{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">
                Get a free key ↗
              </a>
            </p>
          </div>
        </details>

        <form className="search-panel" onSubmit={onFindBook}>
          <label className="field field--query">
            <span className="field-label">Search for a book</span>
            <BookSearch
              value={query}
              disabled={busy}
              onChange={(v) => {
                setQuery(v)
                if (book || quiz) resetDownstream()
              }}
              onSelect={onSelectSuggestion}
              onSubmitRaw={() => onFindBook()}
            />
            <span className="field-hint">
              Start typing to search Open Library &amp; Project Gutenberg, or paste an ISBN.
            </span>
          </label>

          <div className="controls">
            <label className="field">
              <span className="field-label">Grade level</span>
              <select className="select-input" value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)}>
                {GRADE_LEVELS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span className="field-label">Questions</span>
              <select
                className="select-input"
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
              >
                {QUESTION_COUNTS.map((c) => (
                  <option key={c} value={c}>
                    {c} questions
                  </option>
                ))}
              </select>
            </label>

            <button type="submit" className="btn btn--primary find-btn" disabled={!query.trim() || busy}>
              {phase === 'resolving' ? 'Finding…' : 'Find book'}
            </button>
          </div>
        </form>

        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}

        {book && (
          <>
            <BookCard book={book} />
            {phase !== 'ready' && (
              <div className="generate-row">
                <button
                  type="button"
                  className="btn btn--accent"
                  onClick={onGenerate}
                  disabled={busy || !hasKey}
                >
                  {phase === 'generating'
                    ? 'Building your quiz…'
                    : hasKey
                      ? `Generate ${questionCount}-question quiz · ${gradeLabel}`
                      : 'Enter your Gemini key above to generate'}
                </button>
                {phase === 'generating' && (
                  <p className="hint">
                    Writing grade-appropriate questions grounded in the book — this can take a
                    moment for longer quizzes.
                  </p>
                )}
              </div>
            )}
          </>
        )}

        {phase === 'generating' && (
          <div className="loading-bar" aria-hidden="true">
            <div className="loading-bar-fill" />
          </div>
        )}

        {quiz && phase === 'ready' && (
          <>
            <Quiz quiz={quiz} gradeLabel={gradeLabel} />
            <div className="regenerate-row">
              <button type="button" className="btn btn--secondary" onClick={onGenerate} disabled={busy}>
                Regenerate ({questionCount} · {gradeLabel})
              </button>
            </div>
          </>
        )}
      </main>

      <footer className="footer">
        <p>
          Runs entirely in your browser. Quizzes are AI-generated from book metadata and the
          model's knowledge of the work — review questions for accuracy before classroom use.
        </p>
      </footer>
    </div>
  )
}
