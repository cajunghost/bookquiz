// Keyless quiz generation. Strategy, in order:
//   1. If the book has free public-domain text (Project Gutenberg), fetch an
//      excerpt to ground the questions.
//   2. Ask a free, no-key LLM endpoint (Pollinations) to write the quiz.
//   3. If the endpoint fails AND we have full text, fall back to a deterministic
//      algorithmic quiz built directly from the real text (no AI, never fails).
//
// No API key is required from the user at any point.

import { SYSTEM_PROMPT, buildPrompt, extractJson, normalizeQuiz } from './quizCore.js'
import { fetchGutenbergText, excerptFor, buildAlgorithmicQuiz } from './gutenberg.js'

// Pollinations: free, no-key text generation. POST returns the model's text.
const POLLINATIONS_URL = 'https://text.pollinations.ai/'

async function callPollinations(book, gradeValue, questionCount, excerpt, signal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })
  try {
    const res = await fetch(POLLINATIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildPrompt(book, gradeValue, questionCount, excerpt) },
        ],
        model: 'openai',
        jsonMode: true,
        private: true,
        referrer: 'bookquiz',
      }),
    })
    if (!res.ok) return null
    const text = await res.text()
    return extractJson(text)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Generate a quiz with no API key.
 * @param {object} args
 * @param {object} args.book   normalized book record (may carry pgId/formats/freeText)
 * @param {string} args.gradeValue
 * @param {number} args.questionCount
 * @param {AbortSignal} [args.signal]
 */
export async function generateQuiz({ book, gradeValue, questionCount, signal }) {
  if (!book || !book.title) {
    throw new Error('No book selected. Find a book first, then generate the quiz.')
  }

  // 1. Public-domain full text for grounding / fallback, when available.
  let fullText = null
  if (book.freeText && book.pgId) {
    fullText = await fetchGutenbergText(book.pgId, book.formats, signal)
  }
  const excerpt = excerptFor(fullText)

  // 2. Free keyless LLM.
  const parsed = await callPollinations(book, gradeValue, questionCount, excerpt, signal)
  if (parsed) {
    const quiz = normalizeQuiz(parsed, questionCount)
    if (quiz.questions.length > 0) {
      if (fullText && !quiz.sourceNote) {
        quiz.sourceNote = 'Grounded in an excerpt of the book’s public-domain text.'
      }
      return quiz
    }
  }

  // 3. Deterministic fallback from real text (only possible with full text).
  if (fullText) {
    const algo = buildAlgorithmicQuiz({ fullText, title: book.title, requestedCount: questionCount })
    if (algo && algo.questions.length > 0) return algo
  }

  throw new Error(
    'The free quiz service is busy right now. Please try again in a moment' +
      (book.freeText ? '.' : ', or pick a different book.'),
  )
}
