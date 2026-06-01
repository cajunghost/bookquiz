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

async function searchGoogleBooks(q, signal) {
  // Google Books has one of the largest catalogs; great for recent / popular
  // titles that may be sparse in Open Library.
  const data = await fetchJson(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}` +
      `&maxResults=8&printType=books&orderBy=relevance`,
    signal,
  )
  if (!data?.items) return []
  return data.items
    .filter((it) => it.volumeInfo?.title)
    .map((it) => {
      const v = it.volumeInfo
      const isbns = (v.industryIdentifiers || []).map((x) => x.identifier).filter(Boolean)
      return {
        id: `gb:${it.id}`,
        source: 'Google Books',
        title: v.title,
        authors: v.authors || [],
        publishedYear: v.publishedDate ? v.publishedDate.slice(0, 4) : null,
        coverUrl:
          v.imageLinks?.thumbnail?.replace('http://', 'https://') ||
          v.imageLinks?.smallThumbnail?.replace('http://', 'https://') ||
          null,
        subjects: (v.categories || []).slice(0, 12),
        firstSentence: null,
        isbns: isbns.slice(0, 3),
        description: v.description || null,
      }
    })
}

async function searchGutenberg(q, signal) {
  // Gutendex is a free JSON API over the Project Gutenberg catalog.
  const data = await fetchJson(
    `https://gutendex.com/books?search=${encodeURIComponent(q)}`,
    signal,
  )
  if (!data?.results) return []
  return data.results.slice(0, 8).map((b) => ({
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
  const title = (s.title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(the|a|an)\b/g, '')
    .trim()
  // Use the first author's surname (last word) so "Mary Shelley" and
  // "Mary Wollstonecraft Shelley" collapse to the same key.
  const author = (s.authors?.[0] || '').toLowerCase().trim()
  const surname = author ? author.split(/\s+/).pop() : ''
  return `${title}|${surname}`
}

/**
 * Search all sources in parallel and return a merged, de-duplicated list of
 * suggestions (each is a quiz-ready book record). Open Library and Google Books
 * provide breadth; Project Gutenberg contributes free full-text titles (flagged
 * and preferred for grounding). Any source that errors or is rate-limited is
 * simply skipped, so suggestions keep working as long as one source responds.
 */
export async function searchBooks(query, signal) {
  const q = String(query || '').trim()
  if (q.length < 2) return []

  const [ol, gb, pg] = await Promise.all([
    searchOpenLibrary(q, signal),
    searchGoogleBooks(q, signal),
    searchGutenberg(q, signal),
  ])

  const merged = []
  const seen = new Map() // dedupeKey -> index in merged

  // Order matters for which record "wins" a duplicate: list Open Library and
  // Google Books first for rich metadata, then fold in Gutenberg's free-text
  // flag/handle onto the existing entry.
  for (const s of [...ol, ...gb, ...pg]) {
    s.authors = (s.authors || []).map(tidyAuthor)
    const key = dedupeKey(s)
    if (seen.has(key)) {
      const existing = merged[seen.get(key)]
      existing.freeText = existing.freeText || s.freeText
      if (!existing.pgId && s.pgId) {
        existing.pgId = s.pgId
        existing.formats = s.formats
      }
      if (!existing.coverUrl && s.coverUrl) existing.coverUrl = s.coverUrl
      if (!existing.description && s.description) existing.description = s.description
      if (!existing.subjects?.length && s.subjects?.length) existing.subjects = s.subjects
      if (!existing.isbns?.length && s.isbns?.length) existing.isbns = s.isbns
      continue
    }
    seen.set(key, merged.length)
    merged.push(s)
  }

  // Relevance order is preserved (Open Library / Google Books lead); free-text
  // titles keep their "Free text" badge so users can spot the most reliable
  // picks without burying the exact match they searched for.
  return merged.slice(0, 12)
}
