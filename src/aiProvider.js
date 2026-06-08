// Quiz generation — requires the user's own Google AI Studio (Gemini) key.
// The keyless community endpoint was removed to avoid its frequent rate-limit /
// busy errors; generation now goes solely through the user's key. For
// public-domain (Project Gutenberg) books we still fetch a real text excerpt to
// ground the questions in the book's actual words.

import { excerptFor, fetchGutenbergText } from './gutenberg.js'
import { getApiKey, getRefine } from './store.js'
import { generateWithGemini } from './gemini.js'

export class MissingKeyError extends Error {
  constructor() {
    super('Add your free Google AI Studio key at the top of the page to generate quizzes.')
    this.code = 'NO_KEY'
  }
}

/**
 * Generate a quiz using the user's saved Gemini key.
 * @param {object} args
 * @param {object} args.book   normalized book record (may carry pgId/formats/freeText)
 * @param {string} args.gradeValue
 * @param {number} args.questionCount
 * @param {AbortSignal} [args.signal]
 */
export async function generateQuiz({ book, gradeValue, questionCount, signal }) {
  if (!book || !book.title) {
    throw new Error('No book selected. Search for a book first, then generate the quiz.')
  }

  const apiKey = getApiKey()
  if (!apiKey) throw new MissingKeyError()

  // For public-domain titles, fetch the real text: an excerpt grounds the
  // prompt, and the full text is used to VERIFY each question's evidence quote
  // actually appears in this book (drops series-bleed / fabricated questions).
  let excerpt = null
  let fullText = null
  if (book.freeText && book.pgId) {
    fullText = await fetchGutenbergText(book.pgId, book.formats, signal).catch(() => null)
    excerpt = excerptFor(fullText)
  }

  const quiz = await generateWithGemini({
    apiKey,
    book,
    gradeValue,
    questionCount,
    excerpt,
    fullText,
    signal,
    refine: getRefine(),
  })
  return quiz
}
