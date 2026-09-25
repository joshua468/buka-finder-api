import { useState } from 'react'
import { CITIES } from '../lib/constants.js'
import './Header.css'

export default function Header({ city, onCityChange, search, onSearchChange, cartCount, onCartOpen, onTrack }) {
  const [open, setOpen] = useState(false)

  const label = city || 'All cities'
  const current = city ? 'location' : 'location-empty'

  return (
    <header className="hd shell">
      <a className="hd__brand" href="#top" aria-label="Buka Finder home">
        <svg className="hd__mark" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M6 19a10 10 0 0 0 20 0H6Z" fill="var(--accent)" />
          <circle cx="16" cy="8" r="2.4" fill="currentColor" />
          <circle cx="10" cy="11" r="1.7" fill="currentColor" opacity="0.75" />
          <circle cx="22" cy="11" r="1.7" fill="currentColor" opacity="0.75" />
        </svg>
        <span className="hd__name">Buka Finder</span>
      </a>

      <div className="hd__search" role="search">
        <svg className="hd__search-icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="m10.5 10.5 3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          className="hd__search-input"
          placeholder="Search restaurants and food…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search restaurants and food"
        />
        {search && (
          <button type="button" className="hd__search-clear" onClick={() => onSearchChange('')} aria-label="Clear search">
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="hd__right">
        <button
          type="button"
          className="hd__track"
          onClick={onTrack}
          aria-label="Track an order"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.7" />
            <path d="m16 16 4 4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
          <span className="hd__track-label">Track</span>
        </button>

        <button
          type="button"
          className="hd__cart"
          onClick={onCartOpen}
          aria-label={`Open cart, ${cartCount} item${cartCount === 1 ? '' : 's'}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 5h2l2.2 10.2A2 2 0 0 0 10.2 17h6.6a2 2 0 0 0 1.95-1.55L20 9H7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="10.5" cy="20" r="1.4" fill="currentColor" />
            <circle cx="17.5" cy="20" r="1.4" fill="currentColor" />
          </svg>
          {cartCount > 0 && <span className="hd__cart-badge">{cartCount > 99 ? '99+' : cartCount}</span>}
        </button>

        <div className={`city ${open ? 'is-open' : ''}`}>
          <button
            type="button"
            className="city__btn"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
          >
            <svg className="city__pin" viewBox="0 0 16 16" aria-hidden="true">
              {current === 'location' ? (
                <>
                  <path d="M8 1.5a5 5 0 0 0-5 5c0 3.5 5 8 5 8s5-4.5 5-8a5 5 0 0 0-5-5Z" fill="var(--accent)" />
                  <circle cx="8" cy="6.5" r="1.8" fill="var(--bg)" />
                </>
              ) : (
                <path d="M8 1.5a5 5 0 0 0-5 5c0 3.5 5 8 5 8s5-4.5 5-8a5 5 0 0 0-5-5Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
              )}
            </svg>
            <span className="city__label">Deliver to</span>
            <span className="city__value">{label}</span>
            <svg className="city__chev" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m4 6 4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {open && (
            <>
              {/*
                Click-away scrim. aria-hidden since the actual dismissal is the
                Escape key or picking a city.
              */}
              <div className="city__scrim" onClick={() => setOpen(false)} aria-hidden="true" />
              <ul className="city__menu" role="listbox" aria-label="Choose a delivery city">
                <li role="option" aria-selected={!city}>
                  <button
                    type="button"
                    className={!city ? 'is-selected' : ''}
                    onClick={() => { onCityChange(''); setOpen(false) }}
                  >
                    <span>All cities</span>
                    {!city && <Check />}
                  </button>
                </li>
                {CITIES.map((c) => (
                  <li key={c} role="option" aria-selected={city === c}>
                    <button
                      type="button"
                      className={city === c ? 'is-selected' : ''}
                      onClick={() => { onCityChange(c); setOpen(false) }}
                    >
                      <span>{c}</span>
                      {city === c && <Check />}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function Check() {
  return (
    <svg className="city__check" viewBox="0 0 16 16" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}