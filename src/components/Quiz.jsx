import { useMemo, useState } from 'react'
import { pointsForScore } from '../gamification.js'
import { addFeedback, getActiveProfile, recordQuizResult } from '../store.js'
import ScoreResult from './ScoreResult.jsx'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

const FEEDBACK_REASONS = [
  { id: 'not_in_book', label: 'Not in the book' },
  { id: 'wrong_answer', label: 'Wrong answer marked correct' },
  { id: 'ambiguous', label: 'Unclear / multiple answers' },
  { id: 'spoiler', label: 'Spoiler / off-topic' },
]

export default function Quiz({ quiz, gradeLabel, book }) {
  const questions = Array.isArray(quiz?.questions) ? quiz.questions : []
  const { sourceNote, requestedCount, generatedCount } = quiz || {}

  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [award, setAward] = useState(null)
  const [openFeedback, setOpenFeedback] = useState(null) // question index
  const [flagged, setFlagged] = useState({}) // qIndex -> reason label

  const correctCount = useMemo(
    () => questions.reduce((sum, q, i) => sum + (answers[i] === q.correctIndex ? 1 : 0), 0),
    [answers, questions],
  )
  const answeredCount = Object.keys(answers).length
  const allAnswered = questions.length > 0 && answeredCount === questions.length
  const pct = questions.length ? Math.round((correctCount / questions.length) * 100) : 0

  function choose(qIndex, optIndex) {
    if (submitted) return
    setAnswers((prev) => ({ ...prev, [qIndex]: optIndex }))
  }

  function submit() {
    const points = pointsForScore(pct, questions.length)
    // Record against the signed-in profile (null if signed out).
    const result = getActiveProfile()
      ? recordQuizResult({
          book,
          gradeLabel,
          questionCount: questions.length,
          correct: correctCount,
          pct,
          points,
        })
      : null
    setAward(result)
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function retake() {
    setAnswers({})
    setSubmitted(false)
    setAward(null)
    setOpenFeedback(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function flag(qIndex, reasonLabel, reasonId) {
    addFeedback(book, questions[qIndex], reasonId)
    setFlagged((prev) => ({ ...prev, [qIndex]: reasonLabel }))
    setOpenFeedback(null)
  }

  return (
    <section className="quiz">
      {submitted && (
        <ScoreResult
          pct={pct}
          correct={correctCount}
          total={questions.length}
          gradeLabel={gradeLabel}
          award={award}
        />
      )}

      {generatedCount < requestedCount && (
        <p className="quiz-note">
          Generated {generatedCount} of {requestedCount} requested questions to keep every
          question accurate and grounded in the book.
        </p>
      )}
      {sourceNote && <p className="quiz-note quiz-note--source">{sourceNote}</p>}

      <ol className="question-list">
        {questions.map((q, qi) => {
          const selected = answers[qi]
          return (
            <li className="question" key={qi}>
              <div className="question-head">
                <span className="question-skill">{q.skill}</span>
              </div>
              <p className="question-stem">{q.question}</p>
              <div className="options">
                {(q.options || []).map((opt, oi) => {
                  const isSelected = selected === oi
                  const isCorrect = q.correctIndex === oi
                  let stateCls = 'idle'
                  if (submitted) {
                    if (isCorrect) stateCls = 'correct'
                    else if (isSelected) stateCls = 'incorrect'
                  } else if (isSelected) stateCls = 'selected'
                  return (
                    <button
                      type="button"
                      key={oi}
                      className={`option option--${stateCls}`}
                      onClick={() => choose(qi, oi)}
                      disabled={submitted}
                      aria-pressed={isSelected}
                    >
                      <span className="option-letter">{LETTERS[oi]}</span>
                      <span className="option-text">{opt}</span>
                      {submitted && isCorrect && (
                        <span className="option-mark" aria-label="correct">✓</span>
                      )}
                      {submitted && isSelected && !isCorrect && (
                        <span className="option-mark" aria-label="your answer">✗</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {submitted && q.explanation && (
                <p className="explanation">
                  <strong>Why:</strong> {q.explanation}
                </p>
              )}

              {submitted && (
                <div className="feedback-row">
                  {flagged[qi] ? (
                    <span className="feedback-done">
                      ✓ Thanks — reported as “{flagged[qi]}”. Future quizzes for this book
                      will avoid it.
                    </span>
                  ) : openFeedback === qi ? (
                    <div className="feedback-menu" role="group" aria-label="Report a problem">
                      <span className="feedback-menu-label">What's wrong?</span>
                      {FEEDBACK_REASONS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className="feedback-reason"
                          onClick={() => flag(qi, r.label, r.id)}
                        >
                          {r.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="feedback-cancel"
                        onClick={() => setOpenFeedback(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="feedback-flag"
                      onClick={() => setOpenFeedback(qi)}
                    >
                      ⚑ Report this question
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <div className="quiz-actions">
        {!submitted ? (
          <button type="button" className="btn btn--primary" onClick={submit} disabled={!allAnswered}>
            {allAnswered
              ? 'Submit answers'
              : `Answer all questions (${answeredCount}/${questions.length})`}
          </button>
        ) : (
          <button type="button" className="btn btn--secondary" onClick={retake}>
            Retake quiz
          </button>
        )}
      </div>
    </section>
  )
}
