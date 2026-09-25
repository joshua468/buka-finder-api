import { useCallback, useEffect, useRef, useState } from 'react'
import { listMenu } from '../lib/api.js'
import { bannerImage, cuisineGradient, dishImage, naira, STATUS_LABEL, STATUS_TONE } from '../lib/constants.js'
import './Drawer.css'

export default function MenuDrawer({ restaurant, onClose, cart, onAdd }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [category, setCategory] = useState('All')
  const closeRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    if (!restaurant) return
    let alive = true
    setLoading(true)
    setError(null)
    setCategory('All')
    listMenu(restaurant.id)
      .then((body) => { if (alive) setItems(body.data || []) })
      .catch((e) => { if (alive) { setError(e.message); setItems([]) } })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [restaurant])

  useEffect(() => {
    if (!restaurant) return
    closeRef.current?.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && listRef.current) {
        const focusables = listRef.current.querySelectorAll('a[href], button:not(:disabled), [tabindex]:not([tabindex="-1"])')
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [restaurant, onClose])

  const categories = ['All', ...new Set(items.map((i) => i.category).filter(Boolean))]

  const visible = items
  const shown = useCallback(
    (list) => (category === 'All' ? list : list.filter((i) => i.category === category)),
    [category],
  )

  if (!restaurant) return null

  const tone = STATUS_TONE[restaurant.status] || 'muted'
  const status = STATUS_LABEL[restaurant.status] || restaurant.status

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label={`Menu for ${restaurant.name}`}>
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer" ref={listRef}>
        <header
          className="drawer__head"
          style={{ background: cuisineGradient(restaurant.cuisine_type) }}
        >
          {bannerImage(restaurant.cuisine_type, restaurant.name) && (
            <img
              className="drawer__banner-img"
              src={bannerImage(restaurant.cuisine_type, restaurant.name)}
              alt=""
              aria-hidden="true"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          )}
          <button ref={closeRef} type="button" className="drawer__close" onClick={onClose} aria-label="Close menu">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="drawer__headrow">
            <span className={`badge badge--${tone}`}>{status}</span>
            {restaurant.rating != null && (
              <span className="drawer__rating">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m8 1.6 1.9 3.9 4.3.6-3.1 3 .7 4.2-3.8-2-3.8 2 .7-4.2-3.1-3 4.3-.6L8 1.6Z" fill="currentColor" />
                </svg>
                {Number(restaurant.rating).toFixed(2)}
              </span>
            )}
          </div>
          <h2 className="drawer__title">{restaurant.name}</h2>
          <p className="drawer__meta">
            {(restaurant.city)}
            {(restaurant.address ? ` · ${restaurant.address}` : '')}
            {restaurant.cuisine_type ? ` · ${restaurant.cuisine_type}` : ''}
          </p>
        </header>

        <div className="drawer__body">
          {loading ? (
            <div className="drawer__skeletons" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="sk-row"><div className="sk sk--name" /><div className="sk sk--desc" /></div>
              ))}
            </div>
          ) : error ? (
            <div className="drawer__error" role="alert">
              <strong>Couldn't load the menu.</strong>
              <span>{error}</span>
              <button type="button" className="btn btn--primary" onClick={onClose}>Back</button>
            </div>
          ) : categories.length > 1 ? (
            <div className="drawer__cats" role="group" aria-label="Menu categories">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`chip ${category === c ? 'is-active' : ''}`}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          ) : null}

          {!loading && !error && shown(visible).length === 0 && (
            <p className="drawer__empty">Nothing in this category right now.</p>
          )}

          {!loading && !error && (
            <ul className="drawer__list">
              {shown(visible).map((item) => {
                const img = dishImage(item)
                const inCart = cart?.[item.id] || 0
                return (
                  <li key={item.id} className={`dish ${item.available === false ? 'is-off' : ''}`}>
                    {img && (
                      <div className="dish__media">
                        <img
                          src={img}
                          alt={item.name}
                          loading="lazy"
                          onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                      </div>
                    )}
                    <div className="dish__info">
                      <div className="dish__head">
                        <h3 className="dish__name">{item.name}</h3>
                        {item.category && <span className="dish__cat">{item.category}</span>}
                      </div>
                      {item.description && <p className="dish__desc">{item.description}</p>}
                      <p className="dish__price">{naira(item.price)}</p>
                    </div>
                    {item.available === false ? (
                      <span className="dish__off">Sold out</span>
                    ) : (
                      <div className="dish__add">
                        {inCart > 0 ? (
                          <div className="qty" role="group" aria-label={`Quantity for ${item.name}`}>
                            <button type="button" className="qty__btn" onClick={() => onAdd(item, -1)} aria-label="Decrease quantity">−</button>
                            <span className="qty__n">{inCart}</span>
                            <button type="button" className="qty__btn" onClick={() => onAdd(item, 1)} aria-label="Increase quantity">+</button>
                          </div>
                        ) : (
                          <button type="button" className="dish__addbtn" onClick={() => onAdd(item, 1)}>
                            Add
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}