import { useMemo, useState } from 'react'

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']

function scoreMessage(pct) {
  if (pct >= 90) return 'Outstanding comprehension!'
  if (pct >= 75) return 'Great job — strong understanding.'
  if (pct >= 60) return 'Good effort — review the explanations below.'
  if (pct >= 40) return 'Keep practicing — re-read the tricky parts.'
  return "Let's revisit the book and try again."
}

export default function Quiz({ quiz, gradeLabel }) {
  const { questions, sourceNote, requestedCount, generatedCount } = quiz
  const [answers, setAnswers] = useState({})
  const [submitted, setSubmitted] = useState(false)

  const correctCount = useMemo(
    () =>
      questions.reduce(
        (sum, q, i) => sum + (answers[i] === q.correctIndex ? 1 : 0),
        0,
      ),
    [answers, questions],
  )

  const answeredCount = Object.keys(answers).length
  const allAnswered = answeredCount === questions.length
  const pct = Math.round((correctCount / questions.length) * 100)

  function choose(qIndex, optIndex) {
    if (submitted) return
    setAnswers((prev) => ({ ...prev, [qIndex]: optIndex }))
  }

  function submit() {
    setSubmitted(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function retake() {
    setAnswers({})
    setSubmitted(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <section className="quiz">
      {submitted && (
        <div className="score-banner" role="status">
          <div className="score-circle" data-band={pct >= 60 ? 'pass' : 'low'}>
            <span className="score-pct">{pct}%</span>
          </div>
          <div>
            <h2 className="score-headline">{scoreMessage(pct)}</h2>
            <p className="score-detail">
              {correctCount} of {questions.length} correct · {gradeLabel}
            </p>
          </div>
        </div>
      )}

      {generatedCount < requestedCount && (
        <p className="quiz-note">
          Generated {generatedCount} of {requestedCount} requested questions to
          keep every question accurate and grounded in the book.
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
                {q.options.map((opt, oi) => {
                  const isSelected = selected === oi
                  const isCorrect = q.correctIndex === oi
                  let state = ''
                  if (submitted) {
                    if (isCorrect) state = 'correct'
                    else if (isSelected) state = 'incorrect'
                  } else if (isSelected) {
                    state = 'selected'
                  }
                  return (
                    <button
                      type="button"
                      key={oi}
                      className={`option option--${state || 'idle'}`}
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
            </li>
          )
        })}
      </ol>

      <div className="quiz-actions">
        {!submitted ? (
          <button
            type="button"
            className="btn btn--primary"
            onClick={submit}
            disabled={!allAnswered}
          >
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
