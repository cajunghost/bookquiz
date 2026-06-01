// Keyless quiz generation. Strategy:
//   1. Kick off the free-text fetch (Project Gutenberg) and the LLM attempts
//      together so we don't pay for them sequentially.
//   2. Race several free, no-key models/transports in parallel; the FIRST valid
//      quiz wins and the rest are aborted. This is much faster than trying them
//      one at a time.
//   3. If every model fails AND we have full text, fall back to a deterministic
//      algorithmic quiz built directly from the real text (no AI, never fails).
//
// No API key is required from the user at any point.

import { SYSTEM_PROMPT, buildPrompt, extractJson, normalizeQuiz } from './quizCore.js'
import { fetchGutenbergText, excerptFor, buildAlgorithmicQuiz } from './gutenberg.js'
import { getFeedback, getApiKey } from './store.js'
import { generateWithGemini } from './gemini.js'

const POLLINATIONS_URL = 'https://text.pollinations.ai/'

// Free, no-key models. We race a spread of them at once; whichever returns a
// valid quiz first wins.
const POST_MODELS = ['openai', 'openai-fast', 'mistral']
const GET_MODELS = ['openai-fast', 'llama']

// Per-attempt timeout. Each racer gets its own; the overall request resolves as
// soon as any one succeeds, so this is an upper bound per model, not a sum.
const ATTEMPT_TIMEOUT_MS = 30000

function linkSignal(parent, controller) {
  if (parent) parent.addEventListener('abort', () => controller.abort(), { once: true })
}

// POST transport: full system+user messages, JSON mode.
async function pollinationsPost(model, messages, parentSignal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS)
  linkSignal(parentSignal, controller)
  try {
    const res = await fetch(POLLINATIONS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
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
    clearTimeout(timer)
  }
}

// GET transport: prompt in the URL path (some edges respond when POST is busy).
async function pollinationsGet(model, prompt, parentSignal) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ATTEMPT_TIMEOUT_MS)
  linkSignal(parentSignal, controller)
  try {
    const url =
      POLLINATIONS_URL +
      encodeURIComponent(prompt) +
      `?model=${encodeURIComponent(model)}&json=true&private=true&referrer=bookquiz`
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    return extractJson(await res.text())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Resolve with the first racer that yields a valid quiz; resolve null only when
// ALL racers have finished without one. (Promise.any can't express "first
// truthy", so we implement it directly.)
function firstValid(makers, questionCount) {
  return new Promise((resolve) => {
    let remaining = makers.length
    let settled = false
    if (remaining === 0) return resolve(null)
    for (const make of makers) {
      Promise.resolve(make())
        .then((parsed) => {
          if (settled) return
          const quiz = parsed ? normalizeQuiz(parsed, questionCount) : null
          if (quiz && quiz.questions.length > 0) {
            settled = true
            resolve(quiz)
          } else if (--remaining === 0) {
            resolve(null)
          }
        })
        .catch(() => {
          if (!settled && --remaining === 0) resolve(null)
        })
    }
  })
}

async function tryKeylessLLM(book, gradeValue, questionCount, excerpt, signal) {
  const feedback = getFeedback(book)
  const userPrompt = buildPrompt(book, gradeValue, questionCount, excerpt, feedback)
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ]
  const combined = `${SYSTEM_PROMPT}\n\n${userPrompt}`

  // Abort the losing in-flight requests once we have a winner.
  const raceController = new AbortController()
  linkSignal(signal, raceController)

  const makers = [
    ...POST_MODELS.map((m) => () => pollinationsPost(m, messages, raceController.signal)),
    ...GET_MODELS.map((m) => () => pollinationsGet(m, combined, raceController.signal)),
  ]

  const quiz = await firstValid(makers, questionCount)
  raceController.abort() // cancel any stragglers
  return quiz
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

  // 1. For public-domain books, fetch the full text IN PARALLEL with the first
  //    generation attempt, so grounding never adds latency on the happy path.
  const textPromise =
    book.freeText && book.pgId
      ? fetchGutenbergText(book.pgId, book.formats, signal).catch(() => null)
      : Promise.resolve(null)

  // 1a. If the user supplied their own Gemini key, use it first (higher
  //     quality). On any failure we fall through to the free keyless path —
  //     except a clearly-bad key, which we surface so they can fix it.
  const userKey = getApiKey()
  if (userKey) {
    const fullTextForKey = await textPromise
    const excerpt = excerptFor(fullTextForKey)
    try {
      const quiz = await generateWithGemini({
        apiKey: userKey,
        book,
        gradeValue,
        questionCount,
        excerpt,
        signal,
      })
      if (!quiz.sourceNote && fullTextForKey) {
        quiz.sourceNote = 'Grounded in the book’s public-domain text.'
      }
      return quiz
    } catch (err) {
      if (err?.keyProblem) throw err // bad key — tell the user, don't silently swap
      // Otherwise fall back to the keyless path below, reusing the fetched text.
      const firstQuiz = await tryKeylessLLM(book, gradeValue, questionCount, excerpt, signal)
      if (firstQuiz) {
        if (fullTextForKey && !firstQuiz.sourceNote) {
          firstQuiz.sourceNote = 'Grounded in the book’s public-domain text.'
        }
        return firstQuiz
      }
      if (fullTextForKey) {
        const algo = buildAlgorithmicQuiz({ fullText: fullTextForKey, title: book.title, requestedCount: questionCount })
        if (algo && algo.questions.length > 0) return algo
      }
      throw new Error('Could not generate a quiz right now. Please try again in a moment.')
    }
  }

  // First race: start immediately, no excerpt (don't block on the text fetch).
  const firstRace = tryKeylessLLM(book, gradeValue, questionCount, null, signal)

  // Resolve the text fetch alongside the first race.
  const [firstQuiz, fullText] = await Promise.all([firstRace, textPromise])
  if (firstQuiz) {
    if (fullText && !firstQuiz.sourceNote) {
      firstQuiz.sourceNote = 'Grounded in the book’s public-domain text.'
    }
    return firstQuiz
  }

  // 2. If we now have full text, try once more grounded in a real excerpt.
  if (fullText) {
    const excerpt = excerptFor(fullText)
    const grounded = await tryKeylessLLM(book, gradeValue, questionCount, excerpt, signal)
    if (grounded) {
      if (!grounded.sourceNote) {
        grounded.sourceNote = 'Grounded in an excerpt of the book’s public-domain text.'
      }
      return grounded
    }

    // 3. Deterministic fallback from real text — never fails, no AI.
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
