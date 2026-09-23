import { useCallback, useEffect, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import FilterBar from './components/FilterBar.jsx'
import RestaurantCard from './components/RestaurantCard.jsx'
import MenuDrawer from './components/MenuDrawer.jsx'
import { SkeletonGrid, EmptyState, ErrorState, Pager } from './components/States.jsx'
import { listRestaurants, PAGE_SIZE } from './lib/api.js'
import { SORT_OPTIONS } from './lib/constants.js'
import './App.css'

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
  const requestId = useRef(0)

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
  }, [city, cuisine, sort.sort, sort.order, openOnly])

  // First load + whenever a filter changes: back to page 1, full-load skeleton.
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
  const hasActive = city !== '' || cuisine !== '' || openOnly
  const clearFilters = () => {
    setCity('')
    setCuisine('')
    setOpenOnly(false)
  }

  return (
    <div id="top">
      <Header city={city} onCityChange={(c) => { setCity(c); setOffset(0) }} />

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
          <span className="foot__brand">Buka Finder</span> · Task 1 — served by{' '}
          <code>/api/v1</code>
        </p>
        <p className="foot__note">Go · PostgreSQL · Gin · React — seeded with 350+ restaurants.</p>
      </footer>

      <MenuDrawer restaurant={drawer} onClose={() => setDrawer(null)} />
    </div>
  )
}