// Keyless quiz generation. Strategy, in order:
//   1. If the book has free public-domain text (Project Gutenberg), fetch an
//      excerpt to ground the questions.
//   2. Ask a free, no-key LLM endpoint to write the quiz — trying several
//      models/transports in turn so a single busy model doesn't fail the whole
//      request.
//   3. If every model fails AND we have full text, fall back to a deterministic
//      algorithmic quiz built directly from the real text (no AI, never fails).
//
// No API key is required from the user at any point.

import { SYSTEM_PROMPT, buildPrompt, extractJson, normalizeQuiz } from './quizCore.js'
import { fetchGutenbergText, excerptFor, buildAlgorithmicQuiz } from './gutenberg.js'

const POLLINATIONS_POST = 'https://text.pollinations.ai/'
const POLLINATIONS_GET = 'https://text.pollinations.ai/'

// Free, no-key models exposed by Pollinations, tried in order. Different models
// have independent load/availability, so cycling through them greatly raises
// the success rate during peak times.
const MODELS = ['openai', 'openai-fast', 'mistral', 'llama', 'openai-large']

function withTimeout(signal, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })
  return { signal: controller.signal, done: () => clearTimeout(timer) }
}

// POST transport (preferred: full system+user messages, JSON mode).
async function pollinationsPost(model, messages, signal) {
  const t = withTimeout(signal, 45000)
  try {
    const res = await fetch(POLLINATIONS_POST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: t.signal,
      body: JSON.stringify({
        messages,
        model,
        jsonMode: true,
        private: true,
        referrer: 'bookquiz',
      }),
    })
    if (!res.ok) return null
    return extractJson(await res.text())
  } catch {
    return null
  } finally {
    t.done()
  }
}

// GET transport (fallback: prompt in the URL path). Some models/edges respond
// to one transport when the other is briefly unavailable.
async function pollinationsGet(model, prompt, signal) {
  const t = withTimeout(signal, 45000)
  try {
    const url =
      POLLINATIONS_GET +
      encodeURIComponent(prompt) +
      `?model=${encodeURIComponent(model)}&json=true&private=true&referrer=bookquiz`
    const res = await fetch(url, { signal: t.signal })
    if (!res.ok) return null
    return extractJson(await res.text())
  } catch {
    return null
  } finally {
    t.done()
  }
}

async function tryKeylessLLM(book, gradeValue, questionCount, excerpt, signal) {
  const userPrompt = buildPrompt(book, gradeValue, questionCount, excerpt)
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]
  // Combined single-shot prompt for the GET transport (no separate system role).
  const combined = `${SYSTEM_PROMPT}\n\n${userPrompt}`

  for (const model of MODELS) {
    if (signal?.aborted) return null
    const viaPost = await pollinationsPost(model, messages, signal)
    if (viaPost) {
      const quiz = normalizeQuiz(viaPost, questionCount)
      if (quiz.questions.length > 0) return quiz
    }
  }
  // If every POST attempt came back empty/unparseable, try the GET transport
  // on the two most capable models.
  for (const model of ['openai', 'mistral']) {
    if (signal?.aborted) return null
    const viaGet = await pollinationsGet(model, combined, signal)
    if (viaGet) {
      const quiz = normalizeQuiz(viaGet, questionCount)
      if (quiz.questions.length > 0) return quiz
    }
  }
  return null
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
    throw new Error('No book selected. Search for a book first, then generate the quiz.')
  }

  // 1. Public-domain full text for grounding / fallback, when available.
  let fullText = null
  if (book.freeText && book.pgId) {
    fullText = await fetchGutenbergText(book.pgId, book.formats, signal)
  }
  const excerpt = excerptFor(fullText)

  // 2. Free keyless LLM, across several models + transports.
  const quiz = await tryKeylessLLM(book, gradeValue, questionCount, excerpt, signal)
  if (quiz) {
    if (fullText && !quiz.sourceNote) {
      quiz.sourceNote = 'Grounded in an excerpt of the book’s public-domain text.'
    }
    return quiz
  }

  // 3. Deterministic fallback from real text (only possible with full text).
  if (fullText) {
    const algo = buildAlgorithmicQuiz({ fullText, title: book.title, requestedCount: questionCount })
    if (algo && algo.questions.length > 0) return algo
  }

  throw new Error(
    'The free quiz service is busy right now. Please try again in a moment' +
      (book.freeText
        ? '.'
        : ', or pick a book with a “Free text” badge — those always work.'),
  )
}
