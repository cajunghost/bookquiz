// Resolves a user-typed book title or ISBN into a normalized metadata record,
// pulling from Google Books (rich descriptions, cover art) and Open Library
// (subjects, first sentence, ISBNs) and merging the results. Both APIs support
// cross-origin browser requests. Each call is defensive with a timeout; if one
// source is down the other still yields a usable result.

async function fetchJson(url, timeoutMs = 8000) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function normalizeIsbn(raw) {
  const cleaned = String(raw).replace(/[\s-]/g, '').toUpperCase()
  if (/^\d{13}$/.test(cleaned)) return cleaned
  if (/^\d{9}[\dX]$/.test(cleaned)) return cleaned
  return null
}

async function googleBooks(q) {
  const data = await fetchJson(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5&printType=books`,
  )
  const v = data?.items?.[0]?.volumeInfo
  if (!v) return null
  return {
    title: v.title,
    subtitle: v.subtitle || null,
    authors: v.authors || [],
    description: v.description || null,
    categories: v.categories || [],
    publishedYear: v.publishedDate ? v.publishedDate.slice(0, 4) : null,
    publisher: v.publisher || null,
    pageCount: v.pageCount || null,
    coverUrl:
      v.imageLinks?.thumbnail?.replace('http://', 'https://') ||
      v.imageLinks?.smallThumbnail?.replace('http://', 'https://') ||
      null,
    _source: 'Google Books',
  }
}

async function openLibraryByIsbn(isbn) {
  const d = await fetchJson(`https://openlibrary.org/isbn/${isbn}.json`)
  if (!d) return null
  const description =
    typeof d.description === 'string' ? d.description : d.description?.value || null
  const firstSentence =
    typeof d.first_sentence === 'string' ? d.first_sentence : d.first_sentence?.value || null
  return {
    title: d.title,
    subtitle: d.subtitle || null,
    description,
    firstSentence,
    publishedYear: d.publish_date ? (d.publish_date.match(/\d{4}/) || [])[0] || null : null,
    publisher: Array.isArray(d.publishers) ? d.publishers[0] : null,
    pageCount: d.number_of_pages || null,
    subjects: (d.subjects || []).slice(0, 12),
    series: Array.isArray(d.series) ? d.series[0] : d.series || null,
    coverUrl: d.covers?.[0] ? `https://covers.openlibrary.org/b/id/${d.covers[0]}-L.jpg` : null,
    _source: 'Open Library',
  }
}

async function openLibrarySearch(q) {
  const data = await fetchJson(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=3&fields=title,author_name,first_publish_year,cover_i,subject,first_sentence`,
  )
  const doc = data?.docs?.[0]
  if (!doc) return null
  return {
    title: doc.title,
    authors: doc.author_name || [],
    publishedYear: doc.first_publish_year ? String(doc.first_publish_year) : null,
    coverUrl: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null,
    subjects: (doc.subject || []).slice(0, 12),
    firstSentence: Array.isArray(doc.first_sentence) ? doc.first_sentence[0] : doc.first_sentence || null,
    _source: 'Open Library',
  }
}

function pick(...vals) {
  for (const v of vals) if (Array.isArray(v) ? v.length : v) return v
  return Array.isArray(vals[0]) ? [] : null
}

function merge(a = {}, b = {}) {
  return {
    title: pick(a.title, b.title),
    subtitle: pick(a.subtitle, b.subtitle),
    authors: pick(a.authors, b.authors) || [],
    description: pick(a.description, b.description),
    categories: pick(a.categories, b.categories) || [],
    subjects: pick(a.subjects, b.subjects) || [],
    firstSentence: pick(a.firstSentence, b.firstSentence),
    publishedYear: pick(a.publishedYear, b.publishedYear),
    publisher: pick(a.publisher, b.publisher),
    pageCount: pick(a.pageCount, b.pageCount),
    series: pick(a.series, b.series),
    coverUrl: pick(a.coverUrl, b.coverUrl),
    sources: [a._source, b._source].filter(Boolean),
  }
}

export async function resolveBook(query) {
  const q = String(query || '').trim()
  if (!q) return null

  const isbn = normalizeIsbn(q)
  const [primary, secondary] = isbn
    ? await Promise.all([googleBooks(`isbn:${isbn}`), openLibraryByIsbn(isbn)])
    : await Promise.all([googleBooks(q), openLibrarySearch(q)])

  if (!primary && !secondary) return null
  const book = merge(primary, secondary)
  return book.title ? book : null
}
