// Optional "bring your own key" provider: Google Gemini via a free Google AI
// Studio key the user supplies. Reuses the shared prompt (with feedback
// injection) and normalizer from quizCore. The key lives only in the browser
// and is sent directly to Google — no server. When no key is set, the app uses
// the keyless path instead (see aiProvider.js).

import {
  SYSTEM_PROMPT,
  buildPrompt,
  buildRefinePrompt,
  extractJson,
  normalizeQuiz,
} from './quizCore.js'
import { getFeedback } from './store.js'

const MODEL = 'gemini-2.5-flash'

function maxTokensFor(count) {
  if (count <= 5) return 3072
  if (count <= 10) return 6144
  if (count <= 25) return 12288
  return 24576
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    sourceNote: { type: 'STRING' },
    questions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING' },
          options: { type: 'ARRAY', items: { type: 'STRING' } },
          correctIndex: { type: 'INTEGER' },
          explanation: { type: 'STRING' },
          skill: { type: 'STRING' },
        },
        required: ['question', 'options', 'correctIndex', 'explanation', 'skill'],
        propertyOrdering: ['question', 'options', 'correctIndex', 'explanation', 'skill'],
      },
    },
  },
  required: ['questions', 'sourceNote'],
  propertyOrdering: ['sourceNote', 'questions'],
}

/**
 * Generate a quiz with the user's own Gemini key.
 * Returns a normalized quiz, or throws Error (with a friendly message) on
 * failure so the caller can fall back to the keyless path.
 */
// One Gemini call. systemText may be null (used for the refine pass, where the
// instructions live in the user turn). Returns a normalized quiz or null.
async function callGemini({ apiKey, systemText, userText, questionCount, signal }) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent` +
    `?key=${encodeURIComponent(apiKey)}`

  const body = {
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
      maxOutputTokens: maxTokensFor(questionCount),
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 0 },
    },
  }
  if (systemText) body.systemInstruction = { parts: [{ text: systemText }] }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60000)
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Network error contacting Gemini. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg = data?.error?.message || `Gemini request failed (${res.status}).`
    const keyProblem =
      res.status === 400 || res.status === 403 || /api[_ ]?key|API_KEY_INVALID|PERMISSION/i.test(msg)
    const err = new Error(
      keyProblem
        ? 'Your Gemini API key was rejected. Check the key at the top of the page.'
        : msg,
    )
    err.keyProblem = keyProblem
    throw err
  }

  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('') || ''
  const parsed = extractJson(text)
  return parsed ? normalizeQuiz(parsed, questionCount) : null
}

export async function generateWithGemini({
  apiKey,
  book,
  gradeValue,
  questionCount,
  excerpt,
  signal,
  refine = true,
}) {
  if (!apiKey) throw new Error('No Gemini API key provided.')
  if (!book || !book.title) throw new Error('No book selected.')

  const feedback = getFeedback(book)

  // Pass 1 — draft (book-specific, series-aware, grade-calibrated prompt).
  const draft = await callGemini({
    apiKey,
    systemText: SYSTEM_PROMPT,
    userText: buildPrompt(book, gradeValue, questionCount, excerpt, feedback),
    questionCount,
    signal,
  })
  if (!draft || draft.questions.length === 0) {
    throw new Error('Gemini returned no usable questions. Please try again.')
  }

  // Pass 2 — self-refinement: the model fixes any non-book-specific, series-leaking,
  // unverifiable, or off-grade questions. Best-effort: if it fails or returns
  // fewer/empty, keep the draft.
  if (refine) {
    try {
      const refined = await callGemini({
        apiKey,
        systemText: null,
        userText: buildRefinePrompt(book, gradeValue, draft, excerpt),
        questionCount,
        signal,
      })
      if (refined && refined.questions.length >= Math.min(draft.questions.length, 2)) {
        if (!refined.sourceNote) refined.sourceNote = draft.sourceNote
        return refined
      }
    } catch {
      /* keep the draft on any refine failure */
    }
  }

  return draft
}
