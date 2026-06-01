// Typeahead search across open book databases, used by the autocomplete
// dropdown. Sources (all free, open, CORS-friendly, no key required):
//   - Open Library  (openlibrary.org) — the full ~20M-record catalog
//   - Project Gutenberg via Gutendex (gutendex.com) — free public-domain books
//
// Each suggestion is normalized to the same shape the quiz generator consumes,
// so selecting one needs no further lookup.

async function fetchJson(url, signal, timeoutMs = 7000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  // Abort if the caller's signal fires (stale query) OR the timeout hits.
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true })
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

function olCover(id, size = 'M') {
  return id ? `https://covers.openlibrary.org/b/id/${id}-${size}.jpg` : null
}

async function searchOpenLibrary(q, signal) {
  const url =
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}` +
    `&limit=8&fields=key,title,author_name,first_publish_year,cover_i,isbn,subject,first_sentence`
  const data = await fetchJson(url, signal)
  if (!data?.docs) return []
  return data.docs
    .filter((d) => d.title)
    .map((d) => ({
      id: `ol:${d.key || `${d.title}:${(d.author_name || [])[0] || ''}`}`,
      source: 'Open Library',
      title: d.title,
      authors: d.author_name || [],
      publishedYear: d.first_publish_year ? String(d.first_publish_year) : null,
      coverUrl: olCover(d.cover_i),
      subjects: (d.subject || []).slice(0, 12),
      firstSentence: Array.isArray(d.first_sentence)
        ? d.first_sentence[0]
        : d.first_sentence || null,
      isbns: d.isbn ? d.isbn.slice(0, 3) : [],
      description: null,
    }))
}

async function searchGutenberg(q, signal) {
  // Gutendex is a free JSON API over the Project Gutenberg catalog.
  const data = await fetchJson(
    `https://gutendex.com/books?search=${encodeURIComponent(q)}`,
    signal,
  )
  if (!data?.results) return []
  return data.results.slice(0, 6).map((b) => ({
    id: `pg:${b.id}`,
    source: 'Project Gutenberg',
    title: b.title,
    authors: (b.authors || []).map((a) => a.name).filter(Boolean),
    publishedYear: null,
    coverUrl: b.formats?.['image/jpeg'] || null,
    subjects: [...(b.subjects || []), ...(b.bookshelves || [])].slice(0, 12),
    firstSentence: null,
    isbns: [],
    description: null,
    // Free full text is available for Gutenberg titles — note it for grounding.
    freeText: true,
    pgId: b.id,
    formats: b.formats || null,
  }))
}

// Author-name formatting from Gutenberg ("Last, First") to "First Last".
function tidyAuthor(name) {
  if (!name || !name.includes(',')) return name
  const [last, first] = name.split(',').map((s) => s.trim())
  return first ? `${first} ${last}` : last
}

function dedupeKey(s) {
  return `${(s.title || '').toLowerCase().trim()}|${(s.authors[0] || '')
    .toLowerCase()
    .trim()}`
}

/**
 * Search all sources in parallel and return a merged, de-duplicated list of
 * suggestions (each is a quiz-ready book record). Open Library results lead
 * (broadest catalog); Project Gutenberg fills in / flags free-text titles.
 */
export async function searchBooks(query, signal) {
  const q = String(query || '').trim()
  if (q.length < 2) return []

  const [ol, pg] = await Promise.all([
    searchOpenLibrary(q, signal),
    searchGutenberg(q, signal),
  ])

  const merged = []
  const seen = new Map() // dedupeKey -> index in merged

  for (const s of [...ol, ...pg]) {
    s.authors = (s.authors || []).map(tidyAuthor)
    const key = dedupeKey(s)
    if (seen.has(key)) {
      // Prefer the record that already has a cover / more data, but keep the
      // freeText flag and Gutenberg full-text handle if either source had it.
      const existing = merged[seen.get(key)]
      existing.freeText = existing.freeText || s.freeText
      if (!existing.pgId && s.pgId) {
        existing.pgId = s.pgId
        existing.formats = s.formats
      }
      if (!existing.coverUrl && s.coverUrl) existing.coverUrl = s.coverUrl
      if (!existing.subjects?.length && s.subjects?.length) existing.subjects = s.subjects
      continue
    }
    seen.set(key, merged.length)
    merged.push(s)
  }

  return merged.slice(0, 10)
}
