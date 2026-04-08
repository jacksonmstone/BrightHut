import './PaginationBar.css'

export type PaginationBarProps = {
  /** 1-based current page */
  page: number
  pageSize: number
  totalItems: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (size: number) => void
  pageSizeOptions?: number[]
  /** Prefix for aria-labelledby / unique ids */
  labelId?: string
  className?: string
}

const DEFAULT_PAGE_SIZES = [12, 24, 48]

function buildPageList(current: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages = new Set<number>()
  pages.add(1)
  pages.add(totalPages)
  for (let d = -2; d <= 2; d++) pages.add(current + d)
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const out: (number | 'ellipsis')[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('ellipsis')
    out.push(sorted[i])
  }
  return out
}

export default function PaginationBar({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  labelId,
  className = '',
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize) || 1)
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const end = Math.min(totalItems, safePage * pageSize)

  const pageList = buildPageList(safePage, totalPages)

  const navId = labelId ? `${labelId}-nav` : undefined

  return (
    <nav
      className={`pagination-bar ${className}`.trim()}
      aria-label="Pagination"
      {...(navId ? { id: navId } : {})}
    >
      <p className="pagination-bar__summary" aria-live="polite">
        {totalItems === 0 ? (
          'No results'
        ) : (
          <>
            Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{totalItems}</strong>
          </>
        )}
      </p>

      <div className="pagination-bar__controls">
        {onPageSizeChange && (
          <label className="pagination-bar__size">
            <span className="pagination-bar__size-label">Per page</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Results per page"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="pagination-bar__buttons">
          <button
            type="button"
            className="pagination-bar__btn"
            onClick={() => onPageChange(1)}
            disabled={safePage <= 1}
            aria-label="First page"
          >
            «
          </button>
          <button
            type="button"
            className="pagination-bar__btn"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage <= 1}
            aria-label="Previous page"
          >
            ‹
          </button>

          {pageList.map((item, idx) =>
            item === 'ellipsis' ? (
              <span key={`e-${idx}`} className="pagination-bar__ellipsis" aria-hidden>
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                className={`pagination-bar__page${item === safePage ? ' pagination-bar__page--active' : ''}`}
                onClick={() => onPageChange(item)}
                aria-label={`Page ${item}`}
                aria-current={item === safePage ? 'page' : undefined}
              >
                {item}
              </button>
            ),
          )}

          <button
            type="button"
            className="pagination-bar__btn"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage >= totalPages}
            aria-label="Next page"
          >
            ›
          </button>
          <button
            type="button"
            className="pagination-bar__btn"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage >= totalPages}
            aria-label="Last page"
          >
            »
          </button>
        </div>
      </div>
    </nav>
  )
}
