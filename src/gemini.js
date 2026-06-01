// Generates a grade-calibrated reading-comprehension quiz with Google Gemini
// (free tier), called directly from the browser. The user's free Google AI
// Studio key is sent straight to the Generative Language API — no server.

import { getGradeGuidance, gradeLabel } from './gradeLevels.js'

// gemini-2.5-flash is on the free tier, supports JSON-schema output, and has a
// large enough output budget for 50-question quizzes.
const MODEL = 'gemini-2.5-flash'

const SYSTEM_PROMPT = `You are an expert K-12 reading specialist and assessment designer. You create high-quality, multiple-choice reading-comprehension quizzes that measure how well a student understood a specific book.

Core rules:
1. GROUND EVERY QUESTION IN THE BOOK. Questions must test comprehension of the book's actual content — its plot, characters, setting, events, ideas, themes, and the way language is used. Do NOT ask about external trivia (author biography, publication facts, awards, adaptations) unless it is part of the supplied material.
2. Each question is multiple choice with EXACTLY 4 options and EXACTLY ONE unambiguously correct answer. "correctIndex" is the zero-based index (0-3) of the correct option.
3. Distractors must be plausible to a careless reader but clearly incorrect to one who understood the book. No "all/none of the above". No trick questions.
4. Provide a concise "explanation" for each question stating why the correct answer is right, grounded in the book.
5. Tag each question with the comprehension "skill" it assesses (e.g., "main idea", "inference", "vocabulary in context", "character motivation", "theme", "sequence of events", "cause and effect", "author's purpose", "tone").
6. Vary the skills across the quiz; do not repeat a question in different words.
7. Calibrate difficulty, vocabulary, sentence length, and the skills you target to the requested grade level.
8. Every answer must be defensible from the book; avoid opinion-based or unanswerable questions.
9. Use "sourceNote" to briefly note what your questions are based on and any limitation (e.g., working from a description rather than full text).

If you lack enough grounded knowledge of the book to write fair, accurate questions, say so in "sourceNote" and produce only the questions you can support — accuracy matters more than hitting the requested count.`

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

function maxTokensFor(count) {
  if (count <= 5) return 3072
  if (count <= 10) return 6144
  if (count <= 25) return 12288
  return 24576
}

function buildPrompt(book, gradeValue, questionCount) {
  if (!book || !book.title) {
    throw new Error('No book selected. Find a book first, then generate the quiz.')
  }
  const g = getGradeGuidance(gradeValue)
  const label = gradeLabel(gradeValue)
  const facts = [`Title: ${book.title}`]
  if (book.subtitle) facts.push(`Subtitle: ${book.subtitle}`)
  if (book.authors?.length) facts.push(`Author(s): ${book.authors.join(', ')}`)
  if (book.publishedYear) facts.push(`Published: ${book.publishedYear}`)
  if (book.categories?.length) facts.push(`Categories: ${book.categories.join(', ')}`)
  if (book.subjects?.length) facts.push(`Subjects: ${book.subjects.join(', ')}`)
  if (book.firstSentence) facts.push(`Opening line: "${book.firstSentence}"`)
  if (book.description) facts.push(`\nPublisher / summary description:\n${book.description}`)

  return `Create a reading-comprehension quiz for the following book.

=== BOOK ===
${facts.join('\n')}

=== TARGET LEVEL: ${label} (${g.band}) ===
Vocabulary: ${g.vocabulary}
Sentence length: ${g.sentenceLength}
Question style: ${g.questionStyle}
Prioritize these comprehension skills: ${g.skills.join('; ')}.

=== REQUEST ===
Generate EXACTLY ${questionCount} questions appropriate for ${label}, following all rules and the required JSON structure. Keep every question grounded in the book itself.`
}

function normalize(data, requestedCount) {
  const out = []
  for (const q of Array.isArray(data?.questions) ? data.questions : []) {
    if (!q || typeof q.question !== 'string') continue
    const options = Array.isArray(q.options) ? q.options.filter((o) => typeof o === 'string' && o.trim()) : []
    if (options.length < 2) continue
    let correctIndex = Number.isInteger(q.correctIndex) ? q.correctIndex : 0
    if (correctIndex < 0 || correctIndex >= options.length) correctIndex = 0
    out.push({
      question: q.question.trim(),
      options,
      correctIndex,
      explanation: typeof q.explanation === 'string' ? q.explanation.trim() : '',
      skill: typeof q.skill === 'string' ? q.skill.trim() : 'comprehension',
    })
  }
  return {
    questions: out,
    sourceNote: typeof data?.sourceNote === 'string' ? data.sourceNote : '',
    requestedCount,
    generatedCount: out.length,
  }
}

export async function generateQuiz({ apiKey, book, gradeValue, questionCount }) {
  if (!apiKey) throw new Error('Enter your Gemini API key first.')
  if (!book || !book.title) {
    throw new Error('No book selected. Find a book first, then generate the quiz.')
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildPrompt(book, gradeValue, questionCount) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: SCHEMA,
      maxOutputTokens: maxTokensFor(questionCount),
      temperature: 0.7,
      thinkingConfig: { thinkingBudget: 0 },
    },
  }

  let res
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Network error contacting Gemini. Check your connection and try again.')
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    const msg = data?.error?.message || `Gemini request failed (${res.status}).`
    const keyProblem = res.status === 400 || res.status === 403 || /api[_ ]?key|API_KEY_INVALID/i.test(msg)
    throw new Error(
      keyProblem
        ? 'Your Gemini API key was rejected. Make sure it is a valid Google AI Studio key.'
        : msg,
    )
  }

  const candidate = data?.candidates?.[0]
  const finish = candidate?.finishReason
  const text = candidate?.content?.parts?.map((p) => p?.text || '').join('') || ''

  if (!text) {
    if (finish === 'SAFETY' || finish === 'PROHIBITED_CONTENT') {
      throw new Error('Gemini blocked this request. Try a different book or grade level.')
    }
    throw new Error('No quiz content was returned. Please try again.')
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error(
      finish === 'MAX_TOKENS'
        ? 'The quiz was too long to finish. Try a smaller question count.'
        : 'Could not parse the generated quiz. Please try again.',
    )
  }

  const quiz = normalize(parsed, questionCount)
  if (quiz.questions.length === 0) throw new Error('No usable questions were generated. Please try again.')
  return quiz
}
