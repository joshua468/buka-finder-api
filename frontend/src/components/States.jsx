import './States.css'

export function CardSkeleton() {
  return (
    <div className="card card--sk" aria-hidden="true">
      <div className="sk sk--banner" />
      <div className="sk-body">
        <div className="sk sk--name" />
        <div className="sk sk--desc" />
        <div className="sk sk--cta" />
      </div>
    </div>
  )
}

export function SkeletonGrid() {
  return (
    <div className="grid" aria-busy="true" aria-label="Loading restaurants">
      {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  )
}

export function EmptyState({ onClear }) {
  return (
    <section className="state" role="status">
      <svg className="state__art" viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r="40" fill="var(--panel-2)" />
        <circle cx="48" cy="45" r="26" fill="var(--panel-3)" />
        <path d="M33 34a5 5 0 0 0 10 0M53 34a5 5 0 0 0 10 0" stroke="var(--text-faint)" strokeWidth="3" strokeLinecap="round" fill="none" />
        <g transform="rotate(-8 48 45)">
          <rect x="44.5" y="22" width="7" height="26" rx="3.5" fill="var(--accent)" />
          <circle cx="48" cy="20" r="5" fill="var(--accent-hi)" />
        </g>
      </svg>
      <h2 className="state__title">No bukas match</h2>
      <p className="state__text">
        Nothing here for that combo of city, cuisine and filters. Try widening it a little.
      </p>
      <button type="button" className="btn btn--primary" onClick={onClear}>
        Clear all filters
      </button>
    </section>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <section className="state" role="alert">
      <svg className="state__art" viewBox="0 0 96 96" aria-hidden="true">
        <circle cx="48" cy="48" r="40" fill="var(--panel-2)" />
        <path d="M34 34l28 28M62 34 34 62" stroke="var(--danger)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="48" cy="30" r="5" fill="var(--danger)" />
      </svg>
      <h2 className="state__title">Couldn't load restaurants</h2>
      <p className="state__text">{message || 'The API did not respond as expected. This is on us, not you.'}</p>
      <div className="state__actions">
        <button type="button" className="btn btn--primary" onClick={onRetry}>Try again</button>
      </div>
    </section>
  )
}

const PAGE_GAP = '…'

function pageItems(page, pages) {
  if (pages <= 7) {
    return Array.from({ length: pages }, (_, i) => i + 1)
  }
  const wanted = [...new Set([1, pages, page - 1, page, page + 1])]
    .filter((n) => n >= 1 && n <= pages)
    .sort((a, b) => a - b)

  const items = []
  let cursor = 0
  for (const n of wanted) {
    if (n - cursor > 1) items.push(PAGE_GAP)
    items.push(n)
    cursor = n
  }
  if (pages - cursor > 0) items.push(PAGE_GAP)
  return items
}

export function Pager({ meta, page, onPage, busy = false }) {
  const { total, limit, offset, hasMore } = meta
  const pages = Math.max(1, Math.ceil(total / limit))
  const from = total === 0 ? 0 : offset + 1
  const to = Math.min(offset + limit, total)
  const hasPrev = page > 1
  const hasNext = hasMore && page < pages
  const items = pageItems(page, pages)

  return (
    <nav className="pager" aria-label="Pagination">
      <p className="pager__count" aria-live="polite">
        Showing {from}–{to} of {total.toLocaleString()}
      </p>

      {pages > 1 && (
        <div className={`pager__nav${busy ? ' is-busy' : ''}`} aria-busy={busy}>
          <button
            type="button"
            className="pager__btn pager__btn--arrow"
            aria-label="Previous page"
            onClick={() => onPage(page - 1)}
            disabled={busy || !hasPrev}
          >
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 3.5 6 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="pager__label">Prev</span>
          </button>

          {items.map((item, i) =>
            item === PAGE_GAP ? (
              <span key={`gap${i}`} className="pager__gap" aria-hidden="true">{PAGE_GAP}</span>
            ) : (
              <button
                key={`page${item}`}
                type="button"
                className={`pager__btn pager__btn--page${item === page ? ' is-current' : ''}`}
                aria-label={`Go to page ${item}`}
                aria-current={item === page ? 'page' : undefined}
                onClick={() => onPage(item)}
                disabled={busy}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            className="pager__btn pager__btn--arrow"
            aria-label="Next page"
            onClick={() => onPage(page + 1)}
            disabled={busy || !hasNext}
          >
            <span className="pager__label">Next</span>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m5.5 3.5 4.5 4.5-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
      )}
    </nav>
  )
}