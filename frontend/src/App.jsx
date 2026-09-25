import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import FilterBar from './components/FilterBar.jsx'
import RestaurantCard from './components/RestaurantCard.jsx'
import MenuDrawer from './components/MenuDrawer.jsx'
import CartDrawer from './components/CartDrawer.jsx'
import TrackOrder from './components/TrackOrder.jsx'
import { SkeletonGrid, EmptyState, ErrorState, Pager } from './components/States.jsx'
import { listRestaurants, PAGE_SIZE } from './lib/api.js'
import { SORT_OPTIONS } from './lib/constants.js'
import './App.css'

function loadCart() {
  try {
    const raw = localStorage.getItem('buka_cart')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export default function App() {
  const [items, setItems] = useState([])
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paging, setPaging] = useState(false)
  const [error, setError] = useState(null)
  const [city, setCity] = useState('')
  const [cuisine, setCuisine] = useState('')
  const [sortId, setSortId] = useState('rating')
  const [openOnly, setOpenOnly] = useState(false)
  const [offset, setOffset] = useState(0)
  const [drawer, setDrawer] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [cart, setCart] = useState(loadCart)
  const [cartOpen, setCartOpen] = useState(false)
  const [trackOpen, setTrackOpen] = useState(false)
  const [trackOrderId, setTrackOrderId] = useState(null)
  const requestId = useRef(0)

  // Debounce the header search so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim())
      setOffset(0)
    }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Persist the cart across reloads.
  useEffect(() => {
    try {
      localStorage.setItem('buka_cart', JSON.stringify(cart))
    } catch { /* quota / private mode — ignore */ }
  }, [cart])

  const sort = SORT_OPTIONS.find((s) => s.id === sortId) || SORT_OPTIONS[0]

  const load = useCallback((nextOffset, { reset = false, skeleton = true } = {}) => {
    const id = ++requestId.current
    if (skeleton) setLoading(true)
    setError(null)
    listRestaurants({
      limit: PAGE_SIZE,
      offset: nextOffset,
      city,
      cuisine,
      sort: sort.sort,
      order: sort.order,
      openOnly,
      search: debouncedSearch,
    })
      .then((body) => {
        if (id !== requestId.current) return
        setItems(body.data)
        setMeta(body.meta)
      })
      .catch((e) => {
        if (id !== requestId.current) return
        setError(e.message)
        setItems([])
        setMeta(null)
      })
      .finally(() => {
        if (id === requestId.current) {
          setLoading(false)
          setPaging(false)
        }
      })
    setOffset(nextOffset)
    if (reset) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [city, cuisine, sort.sort, sort.order, openOnly, debouncedSearch])

  // First load + whenever a filter/search changes: back to page 1, full-load skeleton.
  useEffect(() => {
    load(0, { reset: true })
  }, [load])

  const onPage = useCallback(
    (page) => {
      const next = Math.max(0, page - 1) * PAGE_SIZE
      setPaging(true)
      load(next, { reset: true, skeleton: false })
    },
    [load],
  )

  const page = Math.floor(offset / PAGE_SIZE) + 1
  const hasActive = city !== '' || cuisine !== '' || openOnly || debouncedSearch !== ''
  const clearFilters = () => {
    setCity('')
    setCuisine('')
    setOpenOnly(false)
    setSearch('')
  }

  // One-restaurant cart (matches the API rule that all items come from one restaurant).
  const addToCart = useCallback((item, delta) => {
    setCart((prev) => {
      const restId = drawer?.id
      if (!restId) return prev
      const existing = prev.find((c) => c.id === item.id)
      if (existing && existing.restaurantId !== restId) return prev
      // Starting a new restaurant's cart: replace it wholesale.
      const base = prev.length > 0 && prev[0].restaurantId !== restId ? [] : prev
      const found = base.find((c) => c.id === item.id)
      if (found) {
        const qty = found.qty + delta
        if (qty <= 0) return base.filter((c) => c.id !== item.id)
        return base.map((c) => (c.id === item.id ? { ...c, qty } : c))
      }
      if (delta <= 0) return base
      return [
        ...base,
        {
          id: item.id,
          name: item.name,
          price: item.price,
          qty: 1,
          restaurantId: restId,
          restaurantName: drawer?.name || '',
        },
      ]
    })
  }, [drawer])

  const changeQty = useCallback((id, delta) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0),
    )
  }, [])

  const removeItem = useCallback((id) => {
    setCart((prev) => prev.filter((c) => c.id !== id))
  }, [])

  const cartCount = useMemo(() => cart.reduce((n, c) => n + c.qty, 0), [cart])

  // Cart qty map for the menu drawer's steppers.
  const cartQty = useMemo(() => {
    const map = {}
    for (const c of cart) map[c.id] = c.qty
    return map
  }, [cart])

  return (
    <div id="top">
      <Header
        city={city}
        onCityChange={(c) => { setCity(c); setOffset(0) }}
        search={search}
        onSearchChange={setSearch}
        cartCount={cartCount}
        onCartOpen={() => setCartOpen(true)}
        onTrack={() => { setTrackOrderId(null); setTrackOpen(true) }}
      />

      <main className="shell">
        <Hero total={meta?.total} />

        <FilterBar
          cuisine={cuisine}
          onCuisine={(c) => { setCuisine(c); setOffset(0) }}
          sortId={sortId}
          onSort={(s) => { setSortId(s); setOffset(0) }}
          openOnly={openOnly}
          onOpenOnly={(v) => { setOpenOnly(v); setOffset(0) }}
          hasActive={hasActive}
          onClear={clearFilters}
        />

        {error ? (
          <ErrorState message={error} onRetry={() => load(offset)} />
        ) : loading ? (
          <SkeletonGrid />
        ) : meta && meta.total === 0 ? (
          <EmptyState onClear={clearFilters} />
        ) : (
          <>
            <section
              className={`results${paging ? ' is-busy' : ''}`}
              aria-label="Restaurant results"
              aria-busy={paging}
            >
              {items.map((r) => (
                <RestaurantCard key={r.id} restaurant={r} onOpen={setDrawer} />
              ))}
            </section>
            {meta && <Pager meta={meta} page={page} onPage={onPage} busy={paging} />}
          </>
        )}
      </main>

      <footer className="foot">
        <p>
          <span className="foot__brand">Buka Finder</span> · served by{' '}
          <code>/api/v1</code>
        </p>
        <p className="foot__note">Go · PostgreSQL · Gin · React — seeded with 350+ restaurants.</p>
      </footer>

      <MenuDrawer
        restaurant={drawer}
        onClose={() => setDrawer(null)}
        cart={cartQty}
        onAdd={addToCart}
      />

      {cartOpen && (
        <CartDrawer
          cart={cart}
          onClose={() => setCartOpen(false)}
          onChangeQty={changeQty}
          onRemove={removeItem}
          onClear={() => setCart([])}
          onTrack={(id) => { setCartOpen(false); setTrackOrderId(id); setTrackOpen(true) }}
        />
      )}

      {trackOpen && (
        <TrackOrder
          orderId={trackOrderId}
          onClose={() => setTrackOpen(false)}
          onBackToRestaurants={() => setTrackOpen(false)}
        />
      )}
    </div>
  )
}