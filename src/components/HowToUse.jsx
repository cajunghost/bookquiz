// "How to use the search / generate a quiz" instructions. Shown right after the
// AI Studio key panel so a first-time user reads: (1) get a key, then (2) how to
// run a quiz. Collapsible to stay out of the way for returning users.

export default function HowToUse() {
  return (
    <details className="howto-panel">
      <summary className="key-summary">
        <span>How to create a quiz</span>
      </summary>

      <div className="key-body">
        <ol className="howto-steps">
          <li>
            <strong>Search for a book.</strong> Start typing a title or author in the
            search box below. A dropdown suggests matches from Open Library, Google Books,
            and Project Gutenberg — or paste an ISBN. Pick the book you want.
          </li>
          <li>
            <strong>Choose a grade level.</strong> Select Kindergarten through Grade 12;
            questions are tuned to that reading level.
          </li>
          <li>
            <strong>Choose how many questions.</strong> Pick 5, 10, 25, or 50.
          </li>
          <li>
            <strong>Tap “Generate quiz.”</strong> Your quiz is written and appears below —
            answer each question, then <strong>Submit</strong> to see your score,
            explanations, and points.
          </li>
          <li>
            <strong>Report a bad question</strong> with the ⚑ button under any question.
            Future quizzes for that book will avoid it.
          </li>
        </ol>
        <p className="howto-tip">
          💡 Books with a <span className="suggest-badge suggest-badge--free">Free text</span>{' '}
          badge use the book’s actual public-domain text, so their quizzes are the most
          accurate. Sign in (top-right) to earn points and badges and keep a history of
          quizzes you’ve passed.
        </p>
      </div>
    </details>
  )
}
