// Shared quiz building blocks used by the AI provider (aiProvider.js): the
// grade-calibrated prompt, the desired JSON shape, and a normalizer that
// validates/repairs whatever the model returns.

import { getGradeGuidance, gradeLabel } from './gradeLevels.js'

export const SYSTEM_PROMPT = `You are an expert K-12 reading specialist and assessment designer. You create high-quality, multiple-choice reading-comprehension quizzes that measure how well a student understood a specific book.

Core rules:
1. GROUND EVERY QUESTION IN THE BOOK. Questions must test comprehension of the book's actual content — its plot, characters, setting, events, ideas, themes, and the way language is used. Do NOT ask about external trivia (author biography, publication facts, awards, adaptations) unless it is part of the supplied material.
2. Each question is multiple choice with EXACTLY 4 options and EXACTLY ONE unambiguously correct answer. "correctIndex" is the zero-based index (0-3) of the correct option.
3. Distractors must be plausible to a careless reader but clearly incorrect to one who understood the book. No "all/none of the above". No trick questions.
4. Provide a concise "explanation" for each question stating why the correct answer is right, grounded in the book.
5. Tag each question with the comprehension "skill" it assesses (e.g., "main idea", "inference", "vocabulary in context", "character motivation", "theme", "sequence of events", "cause and effect", "author's purpose", "tone").
6. Vary the skills across the quiz; do not repeat a question in different words.
7. Calibrate difficulty, vocabulary, sentence length, and the skills you target to the requested grade level.
8. Every answer must be defensible from the book; avoid opinion-based or unanswerable questions.
9. Use "sourceNote" to briefly note what your questions are based on and any limitation (e.g., working from a description or excerpt rather than the full text).

Return ONLY a JSON object of the form:
{"sourceNote": string, "questions": [{"question": string, "options": [string,string,string,string], "correctIndex": number, "explanation": string, "skill": string}]}
Do not wrap it in markdown fences or add any prose before or after the JSON.

If you lack enough grounded knowledge of the book to write fair, accurate questions, say so in "sourceNote" and produce only the questions you can support — accuracy matters more than hitting the requested count.`

export function buildPrompt(book, gradeValue, questionCount, excerpt, feedback) {
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

  const excerptBlock = excerpt
    ? `\n=== EXCERPT FROM THE ACTUAL BOOK TEXT (public domain) ===\nUse this real text as your primary grounding. Base questions on what it actually says.\n"""\n${excerpt}\n"""\n`
    : ''

  // In-context learning: prior reader feedback about inaccurate questions for
  // THIS book. The model is told to avoid repeating them and to ground harder.
  let feedbackBlock = ''
  if (Array.isArray(feedback) && feedback.length) {
    const items = feedback
      .slice(0, 12)
      .map((f, i) => {
        const reason = f.reason ? ` (reported as: ${f.reason})` : ''
        return `${i + 1}. "${f.question}"${reason}`
      })
      .join('\n')
    feedbackBlock = `\n=== READER FEEDBACK — QUESTIONS PREVIOUSLY FLAGGED AS INACCURATE FOR THIS BOOK ===
Readers reported that the questions below were NOT faithful to the book's actual content. Do NOT reproduce these questions or their premises. Be extra careful that every new question is verifiable against the book; when unsure about a detail, ask about something you are confident is in the text instead.
${items}\n`
  }

  return `Create a reading-comprehension quiz for the following book.

=== BOOK ===
${facts.join('\n')}
${excerptBlock}${feedbackBlock}
=== TARGET LEVEL: ${label} (${g.band}) ===
Vocabulary: ${g.vocabulary}
Sentence length: ${g.sentenceLength}
Question style: ${g.questionStyle}
Prioritize these comprehension skills: ${g.skills.join('; ')}.

=== REQUEST ===
Generate EXACTLY ${questionCount} questions appropriate for ${label}, following all rules. Keep every question grounded in the book itself. Output only the JSON object described above.`
}

// Pull a JSON object out of arbitrary model text (handles markdown fences and
// leading/trailing prose that keyless endpoints sometimes add).
export function extractJson(text) {
  if (typeof text !== 'string') return null
  let t = text.trim()
  // Strip ```json ... ``` fences if present.
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) t = fence[1].trim()
  // Try direct parse, else grab the outermost {...}.
  try {
    return JSON.parse(t)
  } catch {
    const start = t.indexOf('{')
    const end = t.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(t.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

export function normalizeQuiz(data, requestedCount) {
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
