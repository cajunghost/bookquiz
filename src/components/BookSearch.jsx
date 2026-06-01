import { useEffect, useId, useRef, useState } from 'react'
import { searchBooks } from '../bookSearch.js'

// Debounced autocomplete over open book databases (Open Library + Project
// Gutenberg). Calls onSelect(book) with a quiz-ready record when the user picks
// a suggestion, or onSubmitRaw(text) when they press Enter without choosing one
// (falls back to the title/ISBN resolver).

const DEBOUNCE_MS = 250

export default function BookSearch({ value, onChange, onSelect, onSubmitRaw, disabled }) {
  const [suggestions, setSuggestions] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1)

  const listId = useId()
  const boxRef = useRef(null)
  const abortRef = useRef(null)
  const debounceRef = useRef(null)
  const justSelected = useRef(false)

  // Debounced search whenever the query changes.
  useEffect(() => {
    if (justSelected.current) {
      justSelected.current = false
      return
    }
    const q = value.trim()
    clearTimeout(debounceRef.current)
    if (q.length < 2) {
      setSuggestions([])
      setOpen(false)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      const results = await searchBooks(q, controller.signal)
      if (controller.signal.aborted) return
      setSuggestions(results)
      setActive(-1)
      setOpen(results.length > 0)
      setLoading(false)
    }, DEBOUNCE_MS)
    return () => clearTimeout(debounceRef.current)
  }, [value])

  // Close the dropdown on outside click.
  useEffect(() => {
    function onDocClick(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  function pick(s) {
    justSelected.current = true
    onChange(s.title)
    setOpen(false)
    setSuggestions([])
    setActive(-1)
    onSelect(s)
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      if (open && active >= 0 && suggestions[active]) {
        e.preventDefault()
        pick(suggestions[active])
      } else {
        e.preventDefault()
        setOpen(false)
        onSubmitRaw?.()
      }
      return
    }
    if (!open || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length) setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="combobox" ref={boxRef}>
      <input
        type="text"
        className="text-input"
        placeholder="Search a book by title or author · or paste an ISBN"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => suggestions.length && setOpen(true)}
        disabled={disabled}
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-opt-${active}` : undefined}
        autoFocus
      />
      {loading && <span className="combobox-spinner" aria-hidden="true" />}

      {open && suggestions.length > 0 && (
        <ul className="suggest-list" id={listId} role="listbox">
          {suggestions.map((s, i) => (
            <li
              key={s.id}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`suggest-item${i === active ? ' is-active' : ''}`}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                pick(s)
              }}
            >
              <div className="suggest-cover">
                {s.coverUrl ? (
                  <img src={s.coverUrl} alt="" loading="lazy" />
                ) : (
                  <span className="suggest-cover--ph" aria-hidden="true">
                    {(s.title || '?').slice(0, 1)}
                  </span>
                )}
              </div>
              <div className="suggest-text">
                <span className="suggest-title">{s.title}</span>
                <span className="suggest-sub">
                  {s.authors?.length ? s.authors.join(', ') : 'Unknown author'}
                  {s.publishedYear ? ` · ${s.publishedYear}` : ''}
                </span>
              </div>
              <span className={`suggest-badge${s.freeText ? ' suggest-badge--free' : ''}`}>
                {s.freeText ? 'Free text' : s.source}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
