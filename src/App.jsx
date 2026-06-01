import { useState } from 'react'
import { GRADE_LEVELS, QUESTION_COUNTS, gradeLabel as labelFor } from './gradeLevels.js'
import { resolveBook } from './bookLookup.js'
import { generateQuiz } from './aiProvider.js'
import BookCard from './components/BookCard.jsx'
import BookSearch from './components/BookSearch.jsx'
import Quiz from './components/Quiz.jsx'

export default function App() {
  const [query, setQuery] = useState('')
  const [gradeLevel, setGradeLevel] = useState('5')
  const [questionCount, setQuestionCount] = useState(10)

  const [book, setBook] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | resolving | resolved | generating | ready
  const [error, setError] = useState('')

  const gradeLabel = labelFor(gradeLevel)
  const busy = phase === 'resolving' || phase === 'generating'

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
      pgId: s.pgId || null,
      formats: s.formats || null,
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
    if (busy) return
    setError('')
    setQuiz(null)
    setPhase('generating')
    try {
      let activeBook = book
      if (!activeBook || !activeBook.title) {
        if (!query.trim()) throw new Error('Search for a book first.')
        activeBook = await resolveBook(query.trim())
        if (!activeBook) {
          throw new Error('No matching book was found. Try a more specific title or an ISBN.')
        }
        setBook(activeBook)
      }
      const result = await generateQuiz({
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
          Free reading-comprehension quizzes for any book, tuned to the reader's grade.
          No sign-up, no API key.
        </p>
      </header>

      <main className="container">
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
                <button type="button" className="btn btn--accent" onClick={onGenerate} disabled={busy}>
                  {phase === 'generating'
                    ? 'Building your quiz…'
                    : `Generate ${questionCount}-question quiz · ${gradeLabel}`}
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
          Free and keyless. Book data from Open Library &amp; Project Gutenberg; quizzes are
          AI-generated (with a public-domain text fallback) — review questions for accuracy
          before classroom use.
        </p>
      </footer>
    </div>
  )
}
