// Grade-level definitions and the reading-comprehension guidance that shapes
// each quiz. The guidance is injected into the prompt so the model calibrates
// vocabulary, sentence length, and the skills it targets to the K-12 level.

export const GRADE_LEVELS = [
  { value: 'K', label: 'Kindergarten' },
  ...Array.from({ length: 12 }, (_, i) => ({
    value: String(i + 1),
    label: `Grade ${i + 1}`,
  })),
]

export const QUESTION_COUNTS = [5, 10, 25, 50]

export function gradeLabel(value) {
  return GRADE_LEVELS.find((g) => g.value === String(value))?.label || `Grade ${value}`
}

function gradeIndex(value) {
  return value === 'K' ? 0 : Number(value)
}

export function getGradeGuidance(value) {
  const grade = String(value)
  const idx = gradeIndex(grade)

  if (idx <= 2) {
    return {
      band: 'Early Elementary (K-2)',
      vocabulary:
        'Use very simple, common words. Avoid multisyllabic or abstract terms. Keep each option to a few words.',
      sentenceLength: 'Keep question stems to one short sentence (roughly 6-12 words).',
      skills: [
        'recalling characters and who did what',
        'identifying the setting (where and when)',
        'sequencing simple events (what happened first/next/last)',
        "naming a character's obvious feeling",
        'understanding the meaning of simple words used in the story',
      ],
      questionStyle:
        'Focus on literal recall of concrete details a young reader can find directly in the story. Answers must be unambiguous. No inference about theme or author intent.',
    }
  }

  if (idx <= 5) {
    return {
      band: 'Upper Elementary (3-5)',
      vocabulary:
        'Use grade-appropriate vocabulary. You may use words from the book, with the meaning clear from context.',
      sentenceLength: 'Keep question stems to one or two clear sentences.',
      skills: [
        'identifying the main idea of a section or the whole book',
        'cause and effect between events',
        'basic inference from stated details',
        'understanding vocabulary in context',
        "describing characters' feelings, traits, and motivations",
        'comparing characters or events',
      ],
      questionStyle:
        'Mix literal recall with light inference. Every answer must be defensible from the text. Distractors should be plausible but clearly incorrect on a careful read.',
    }
  }

  if (idx <= 8) {
    return {
      band: 'Middle School (6-8)',
      vocabulary:
        'Use academic vocabulary appropriate for middle school, including literary terms (theme, point of view, figurative language).',
      sentenceLength: 'Question stems may be one to three sentences.',
      skills: [
        'determining theme and central ideas',
        'multi-step inference and drawing conclusions',
        'analyzing character development and motivation',
        'identifying point of view and narrator reliability',
        'interpreting figurative language, symbolism, and tone',
        'summarizing and tracing how ideas or plot develop',
        "author's purpose and craft",
      ],
      questionStyle:
        'Emphasize inference, analysis, and interpretation grounded in textual evidence. Avoid pure trivia. Distractors should reflect common misreadings.',
    }
  }

  return {
    band: 'High School (9-12)',
    vocabulary: 'Use sophisticated, precise academic and literary vocabulary suitable for high school.',
    sentenceLength:
      'Question stems may be complex, one to four sentences, and may quote or paraphrase the text.',
    skills: [
      'analyzing theme development across the work',
      'evaluating tone, mood, and authorial stance',
      'interpreting symbolism, motif, irony, and rhetorical devices',
      'analyzing structure and how it shapes meaning',
      'assessing characterization and complex motivation',
      'examining how point of view shapes interpretation',
      'evaluating arguments, evidence, and ambiguity in the text',
    ],
    questionStyle:
      'Demand close reading, analysis, and synthesis. Questions should require justified interpretation rather than recall, while remaining defensible from the text. Distractors should be subtly wrong and reflect sophisticated misreadings.',
  }
}
