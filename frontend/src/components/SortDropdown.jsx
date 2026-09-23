import { useId, useRef, useState } from 'react'
import './SortDropdown.css'

function StarIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="m8 1.6 1.9 3.9 4.3.6-3.1 3 .7 4.2-3.8-2-3.8 2 .7-4.2-3.1-3 4.3-.6L8 1.6Z" fill="currentColor" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5A5.5 5.5 0 1 0 13.5 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M8 5v3.1L10.5 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function AlphaIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3.5 4.5h9M5 8h6M6.5 11.5h3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

const SORT_ICONS = {
  newest: <ClockIcon />,
  rating: <StarIcon />,
  name: <AlphaIcon />,
}

export default function SortDropdown({ options, value, onChange, label }) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const btnRef = useRef(null)
  const menuId = useId()

  const selectedIndex = options.findIndex((o) => o.id === value)
  const current = options[selectedIndex] || options[0]

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) setHighlight(Math.max(0, selectedIndex))
  }

  const select = (opt) => {
    onChange(opt.id)
    setOpen(false)
    btnRef.current?.focus()
  }

  const onKey = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setHighlight(Math.max(0, selectedIndex))
        setOpen(true)
      }
      return
    }
    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        btnRef.current?.focus()
        break
      case 'ArrowDown':
        e.preventDefault()
        setHighlight((h) => (h + 1) % options.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlight((h) => (h - 1 + options.length) % options.length)
        break
      case 'Home':
        e.preventDefault()
        setHighlight(0)
        break
      case 'End':
        e.preventDefault()
        setHighlight(options.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        select(options[highlight])
        break
      case 'Tab':
        setOpen(false)
        break
    }
  }

  return (
    <div className={`sort${open ? ' is-open' : ''}`} onKeyDown={onKey}>
      <button
        ref={btnRef}
        type="button"
        className="sort__btn"
        onClick={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`sort-menu-${menuId}`}
      >
        <span className="sort__ic" aria-hidden="true">{SORT_ICONS[current.id]}</span>
        <span className="sort__label">{label}</span>
        <span className="sort__value">{current.label}</span>
        <span className="sort__chev" aria-hidden="true">
          <svg viewBox="0 0 16 16">
            <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open && (
        <>
          <div className="sort__scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <ul
            id={`sort-menu-${menuId}`}
            className="sort__menu"
            role="listbox"
            aria-label={label}
            aria-activedescendant={`sort-opt-${menuId}-${options[highlight]?.id}`}
            onMouseLeave={() => setHighlight(Math.max(0, selectedIndex))}
          >
            {options.map((o, i) => (
              <li
                key={o.id}
                role="option"
                id={`sort-opt-${menuId}-${o.id}`}
                aria-selected={o.id === value}
                className={i === highlight ? 'is-highlighted' : ''}
                onMouseEnter={() => setHighlight(i)}
              >
                <button
                  type="button"
                  className={o.id === value ? 'is-selected' : ''}
                  onClick={() => select(o)}
                >
                  <span className="sort__opt-ic" aria-hidden="true">{SORT_ICONS[o.id]}</span>
                  <span className="sort__opt-label">{o.label}</span>
                  {o.id === value && (
                    <svg className="sort__check" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}