// Project Gutenberg integration: fetch real public-domain full text, and
// generate deterministic comprehension questions from it WITHOUT any AI. This
// is the keyless, dependency-free fallback — it can never rate-limit or go
// down the way a hosted model can, and every question is grounded in the
// actual book text.

// --- Fetching full text ---------------------------------------------------

async function tryFetchText(url, signal, timeoutMs = 12000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })
  try {
    const res = await fetch(url, { signal: controller.signal })
    if (!res.ok) return null
    const text = await res.text()
    return text && text.length > 2000 ? text : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// Given a Gutendex book record (or just an id), fetch the plain-text content.
export async function fetchGutenbergText(gutenbergId, formats, signal) {
  const candidates = []
  if (formats) {
    for (const [mime, url] of Object.entries(formats)) {
      if (mime.startsWith('text/plain') && !url.endsWith('.zip')) candidates.push(url)
    }
  }
  // Standard Gutenberg plain-text locations as fallbacks.
  if (gutenbergId) {
    candidates.push(
      `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}-0.txt`,
      `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.txt`,
      `https://www.gutenberg.org/files/${gutenbergId}/${gutenbergId}.txt`,
    )
  }
  for (const url of candidates) {
    const text = await tryFetchText(url, signal)
    if (text) return stripGutenbergBoilerplate(text)
  }
  return null
}

// Remove the Project Gutenberg license header/footer, keeping the work itself.
export function stripGutenbergBoilerplate(raw) {
  let text = raw.replace(/\r\n/g, '\n')
  const startMatch = text.match(/\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG[^*]*\*\*\*/i)
  if (startMatch) text = text.slice(startMatch.index + startMatch[0].length)
  const endMatch = text.match(/\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG/i)
  if (endMatch) text = text.slice(0, endMatch.index)
  return text.trim()
}

// A representative excerpt for grounding an AI prompt. Samples several windows
// spread across the book (not just the opening) so questions can be drawn from
// throughout this volume rather than biased to the first chapter.
export function excerptFor(fullText, maxChars = 12000) {
  if (!fullText) return null
  // Skip ~5% front matter (title page, contents).
  const start = Math.min(1500, Math.floor(fullText.length * 0.05))
  const body = fullText.slice(start)
  if (body.length <= maxChars) return body

  const windows = 4
  const win = Math.floor(maxChars / windows)
  const span = Math.floor(body.length / windows)
  const parts = []
  for (let i = 0; i < windows; i++) {
    const from = i * span
    parts.push(body.slice(from, from + win).trim())
  }
  return parts.join('\n\n[...]\n\n')
}

// ---- Evidence verification (anti-series-bleed) ----------------------------

// Normalize text for fuzzy substring matching: lowercase, strip punctuation,
// collapse whitespace. Smart quotes/dashes are folded to plain forms first.
function normalizeForMatch(s) {
  return String(s || '')
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Is `evidence` actually present in the book text? Returns true if a run of at
 * least `minRun` consecutive words from the (normalized) evidence appears in the
 * (normalized) full text — tolerant of minor quoting differences, but strict
 * enough to reject invented/other-volume "quotes".
 */
export function evidenceInText(evidence, normalizedText, minRun = 6) {
  const words = normalizeForMatch(evidence).split(' ').filter(Boolean)
  if (words.length === 0) return false
  // Short evidence: require the whole thing to appear.
  if (words.length <= minRun) {
    return normalizedText.includes(words.join(' '))
  }
  // Otherwise require any window of `minRun` consecutive words to appear.
  for (let i = 0; i + minRun <= words.length; i++) {
    if (normalizedText.includes(words.slice(i, i + minRun).join(' '))) return true
  }
  return false
}

/**
 * Keep only questions whose `evidence` quote is verifiably in the book text.
 * Returns { questions, kept, dropped }. Questions without evidence are dropped
 * (we can't confirm them against this specific volume).
 */
export function verifyQuizAgainstText(questions, fullText) {
  const normText = normalizeForMatch(fullText)
  const kept = []
  let dropped = 0
  for (const q of questions) {
    if (q?.evidence && evidenceInText(q.evidence, normText)) kept.push(q)
    else dropped += 1
  }
  return { questions: kept, kept: kept.length, dropped }
}

// --- Deterministic question generation (no AI) ----------------------------

const STOPWORDS = new Set(
  ('the a an and or but if then of to in on at by for with as is are was were be been being ' +
    'it its he she they them his her their you your we our i me my mine not no nor so than too very ' +
    'this that these those there here who whom whose which what when where why how all any both each ' +
    'few more most other some such only own same can will just should now into out up down over under ' +
    'again further once about above below from did do does done had has have having would could may might ' +
    'must shall said say says one two upon him came come went go going get got like said mr mrs')
    .split(/\s+/),
)

// Split text into clean sentences of a usable length.
function sentences(text) {
  return text
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 40 && s.length <= 220 && /[a-z]/.test(s))
}

// Deterministic PRNG so a given book+grade yields a stable quiz.
function makeRng(seedStr) {
  let h = 2166136261
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h += 0x6d2b79f5
    let t = h
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(arr, rng) {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Content words eligible to be blanked, ranked by length (proxy for salience).
function contentWords(text) {
  const counts = new Map()
  for (const raw of text.toLowerCase().match(/[a-z][a-z'-]{3,}/g) || []) {
    const w = raw.replace(/^'+|'+$/g, '')
    if (w.length < 4 || STOPWORDS.has(w)) continue
    counts.set(w, (counts.get(w) || 0) + 1)
  }
  return counts
}

/**
 * Build a cloze (fill-in-the-blank) quiz purely from the book's real text.
 * Each question shows a real sentence with one meaningful word removed; the
 * distractors are other real words of similar frequency from the same book.
 */
export function buildAlgorithmicQuiz({ fullText, title, requestedCount }) {
  const rng = makeRng(`${title}|${requestedCount}`)
  const sents = sentences(fullText)
  const counts = contentWords(fullText)
  const vocab = [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .map(([w]) => w)
  if (sents.length < 5 || vocab.length < 12) return null

  const usedWords = new Set()
  const questions = []
  const pool = shuffle(sents, rng)

  for (const sentence of pool) {
    if (questions.length >= requestedCount) break
    // Candidate blank words within this sentence.
    const words = sentence.match(/[A-Za-z][A-Za-z'-]{3,}/g) || []
    const candidates = words
      .map((w) => w.replace(/^'+|'+$/g, ''))
      .filter((w) => {
        const lw = w.toLowerCase()
        return (
          !STOPWORDS.has(lw) &&
          lw.length >= 4 &&
          (counts.get(lw) || 0) >= 2 &&
          !usedWords.has(lw) &&
          /^[A-Za-z]/.test(w) &&
          w[0] === w[0].toLowerCase() // skip proper nouns / sentence-initial caps
        )
      })
    if (!candidates.length) continue

    const answer = candidates[Math.floor(rng() * candidates.length)]
    const answerLc = answer.toLowerCase()
    usedWords.add(answerLc)

    // Distractors: other vocab words, not equal to the answer.
    const distractors = shuffle(
      vocab.filter((w) => w !== answerLc && Math.abs(w.length - answerLc.length) <= 3),
      rng,
    ).slice(0, 3)
    if (distractors.length < 3) continue

    const blanked = sentence.replace(
      new RegExp(`\\b${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`),
      '_____',
    )
    const options = shuffle([answerLc, ...distractors], rng)
    const correctIndex = options.indexOf(answerLc)

    questions.push({
      question: `Which word best completes this line from the text?\n“${blanked}”`,
      options,
      correctIndex,
      explanation: `In the original text the line reads “${sentence}”.`,
      skill: 'vocabulary in context',
    })
  }

  if (questions.length === 0) return null
  return {
    questions,
    sourceNote:
      'These questions were generated automatically from the book’s actual public-domain text (Project Gutenberg) — no AI service was used, so they focus on vocabulary in context.',
    requestedCount,
    generatedCount: questions.length,
  }
}
