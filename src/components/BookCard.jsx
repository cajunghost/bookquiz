// Displays the resolved book so the user can confirm the match before
// generating a quiz.

export default function BookCard({ book }) {
  if (!book) return null
  const {
    title,
    subtitle,
    authors,
    publishedYear,
    publisher,
    pageCount,
    description,
    coverUrl,
    subjects,
    categories,
    sources,
  } = book

  const tags = (categories?.length ? categories : subjects || []).slice(0, 5)

  return (
    <div className="book-card">
      <div className="book-cover">
        {coverUrl ? (
          <img src={coverUrl} alt={`Cover of ${title}`} />
        ) : (
          <div className="book-cover--placeholder" aria-hidden="true">
            <span>{(title || '?').slice(0, 1)}</span>
          </div>
        )}
      </div>
      <div className="book-meta">
        <h2 className="book-title">{title}</h2>
        {subtitle && <p className="book-subtitle">{subtitle}</p>}
        {authors?.length > 0 && (
          <p className="book-authors">by {authors.join(', ')}</p>
        )}
        <p className="book-facts">
          {[publishedYear, publisher, pageCount && `${pageCount} pages`]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {tags.length > 0 && (
          <div className="tag-row">
            {tags.map((t) => (
              <span className="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        )}
        {description && (
          <p className="book-description">
            {description.length > 360
              ? description.slice(0, 360).trimEnd() + '…'
              : description}
          </p>
        )}
        {sources?.length > 0 && (
          <p className="book-sources">Metadata from {sources.join(' + ')}</p>
        )}
      </div>
    </div>
  )
}
