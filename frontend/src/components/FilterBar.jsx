import { CUISINES, SORT_OPTIONS } from '../lib/constants.js'
import SortDropdown from './SortDropdown.jsx'
import './FilterBar.css'

export default function FilterBar({ cuisine, onCuisine, sortId, onSort, openOnly, onOpenOnly, hasActive, onClear }) {
  return (
    <div className="fbar">
      <div className="fbar__chips" role="group" aria-label="Filter by cuisine">
        <button
          type="button"
          className={`chip ${cuisine === '' ? 'is-active' : ''}`}
          onClick={() => onCuisine('')}
        >
          All
        </button>
        {CUISINES.map((c) => (
          <button
            key={c}
            type="button"
            className={`chip ${cuisine === c ? 'is-active' : ''}`}
            onClick={() => onCuisine(c)}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="fbar__controls">
        <button
          type="button"
          className={`toggle ${openOnly ? 'is-on' : ''}`}
          onClick={() => onOpenOnly(!openOnly)}
          aria-pressed={openOnly}
        >
          <span className="toggle__dot" />
          Open now
        </button>
        <SortDropdown
          options={SORT_OPTIONS}
          value={sortId}
          onChange={onSort}
          label="Sort by"
        />
      </div>

      {hasActive && (
        <p className="fbar__hint">
          Some filters are active — <button onClick={onClear}>clear all</button>
        </p>
      )}
    </div>
  )
}