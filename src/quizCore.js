// Shared quiz building blocks used by the AI provider (aiProvider.js): the
// grade-calibrated prompt, the desired JSON shape, and a normalizer that
// validates/repairs whatever the model returns.

import { getGradeGuidance, gradeLabel } from './gradeLevels.js'

export const SYSTEM_PROMPT = `You are an expert K-12 reading specialist and assessment designer. You create high-quality, multiple-choice reading-comprehension quizzes that measure how well a student understood a specific book.

Core rules:
1. GROUND EVERY QUESTION IN THIS SPECIFIC BOOK (a single volume). Questions must test comprehension of THIS book's actual content — its plot, characters, setting, events, ideas, themes, and the way language is used. Do NOT ask about external trivia (author biography, publication facts, awards, adaptations) unless it is part of the supplied material.
2. SINGLE VOLUME ONLY — NOT THE SERIES. If this book belongs to a series, ask ONLY about events, characters, and developments that occur within THIS installment. Do NOT ask about earlier or later books, the overall series arc, or events the reader would only know from other volumes. A student who has read only this one book must be able to answer every question. If you are unsure whether a detail belongs to this volume specifically, do not ask about it.
3. Each question is multiple choice with EXACTLY 4 options and EXACTLY ONE unambiguously correct answer. "correctIndex" is the zero-based index (0-3) of the correct option.
4. Distractors must be plausible to a careless reader but clearly incorrect to one who understood the book. No "all/none of the above". No trick questions.
5. Provide a concise "explanation" for each question stating why the correct answer is right, grounded in the book.
6. Tag each question with the comprehension "skill" it assesses (e.g., "main idea", "inference", "vocabulary in context", "character motivation", "theme", "sequence of events", "cause and effect", "author's purpose", "tone").
7. Vary the skills across the quiz; do not repeat a question in different words.
8. Calibrate difficulty, vocabulary, sentence length, and the skills you target to the requested grade level.
9. Every answer must be defensible from the book; avoid opinion-based or unanswerable questions.
10. Use "sourceNote" to briefly note what your questions are based on and any limitation (e.g., working from a description or excerpt rather than the full text, or that this title is part of a series and questions are limited to this volume).

Return ONLY a JSON object of the form:
{"sourceNote": string, "questions": [{"question": string, "options": [string,string,string,string], "correctIndex": number, "explanation": string, "skill": string}]}
Do not wrap it in markdown fences or add any prose before or after the JSON.

If you lack enough grounded knowledge of THIS specific book to write fair, accurate questions, say so in "sourceNote" and produce only the questions you can support — accuracy and book-specificity matter more than hitting the requested count.`

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

  // Series awareness: when we can tell the book is part of a series, instruct
  // the model to confine questions to THIS volume only.
  let seriesBlock = ''
  if (book.series) {
    seriesBlock = `\n=== SERIES NOTICE ===
This book is part of the "${book.series}" series. Ask ONLY about what happens within THIS specific volume ("${book.title}"). Do NOT reference other books in the series, the broader series arc, or events a reader would only know from other installments.\n`
  } else {
    seriesBlock = `\n=== SCOPE NOTICE ===
If "${book.title}" is part of a series, treat it as a single volume: ask only about events and characters within this specific book, not the wider series.\n`
  }

  // Reading-level metadata (when available from catalog sources) to refine
  // grade calibration beyond the chosen grade band.
  let levelBlock = ''
  const rl = []
  if (book.readingLevel) rl.push(`Stated reading level: ${book.readingLevel}`)
  if (book.lexile) rl.push(`Lexile measure: ${book.lexile}`)
  if (rl.length) {
    levelBlock = `\n=== READING-LEVEL METADATA (from catalog sources) ===
${rl.join('\n')}
Use this to fine-tune difficulty, but keep questions answerable at the requested grade.\n`
  }

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
${seriesBlock}${levelBlock}${excerptBlock}${feedbackBlock}
=== TARGET LEVEL: ${label} (${g.band}) ===
Vocabulary: ${g.vocabulary}
Sentence length: ${g.sentenceLength}
Question style: ${g.questionStyle}
Prioritize these comprehension skills: ${g.skills.join('; ')}.

=== REQUEST ===
Generate EXACTLY ${questionCount} questions appropriate for ${label}, following all rules. Every question must be answerable by someone who has read ONLY this specific book. Output only the JSON object described above.`
}

// Second-pass refinement prompt: the model reviews its own draft quiz and fixes
// any question that (a) isn't specific to THIS volume, (b) references the wider
// series, (c) isn't verifiable from the book, or (d) misfits the grade level.
export function buildRefinePrompt(book, gradeValue, draftQuiz, excerpt) {
  const g = getGradeGuidance(gradeValue)
  const label = gradeLabel(gradeValue)
  const seriesLine = book.series
    ? `This title is part of the "${book.series}" series — every question must concern ONLY this volume ("${book.title}"), never other books or the series arc.`
    : `If "${book.title}" is part of a series, every question must concern ONLY this volume, never other books or the series arc.`
  const excerptBlock = excerpt
    ? `\nActual book excerpt for verification:\n"""\n${excerpt.slice(0, 6000)}\n"""\n`
    : ''

  return `You are reviewing a draft reading-comprehension quiz for "${book.title}"${
    book.authors?.length ? ` by ${book.authors.join(', ')}` : ''
  }, intended for ${label} (${g.band}).

Revise the quiz so that EVERY question:
- is specific to THIS book, answerable by someone who read only this volume. ${seriesLine}
- is factually verifiable from the book (fix or replace anything you are not confident is accurate).
- fits ${label}: ${g.vocabulary} ${g.questionStyle}
- has exactly 4 options with exactly one correct answer, plus a grounded explanation and a skill tag.

Keep the same number of questions if they can be made good; drop a question only if it cannot be made accurate and book-specific.
${excerptBlock}
Draft quiz to revise:
${JSON.stringify({ questions: draftQuiz.questions })}

Return ONLY the corrected JSON object: {"sourceNote": string, "questions": [{"question","options","correctIndex","explanation","skill"}]}. No prose, no markdown fences.`
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
