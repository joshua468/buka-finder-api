import { useEffect, useRef, useState } from 'react'
import { getOrder, getRestaurant } from '../lib/api.js'
import { naira } from '../lib/constants.js'
import './Drawer.css'

// Delivery lifecycle — each phase in sim-seconds since the watch started.
const PHASES = [
  { id: 'pending', label: 'Order placed', short: 'Placed', start: 0 },
  { id: 'confirmed', label: 'Restaurant confirmed', short: 'Confirmed', start: 20 },
  { id: 'preparing', label: 'Cooking in the kitchen', short: 'Preparing', start: 45 },
  { id: 'on_the_way', label: 'On the way', short: 'On the way', start: 70 },
  { id: 'delivered', label: 'Delivered', short: 'Delivered', start: 160 },
]

// Courier stays parked at the buka until "on the way" flips green,
// then rides the route from that moment until it reaches the door.
const RIDE_START = PHASES[3].start
const RIDE_END = PHASES[4].start

// Full journey ≈ 35 real minutes. ETA shrinks as the courier progresses.
const FULL_ETA_MIN = 35

function pctAt(t) {
  if (t <= RIDE_START) return 0
  return Math.min(((t - RIDE_START) / (RIDE_END - RIDE_START)) * 100, 100)
}

function phaseAt(t) {
  return PHASES.reduce((acc, p, i) => (t >= p.start ? i : acc), 0)
}

// Deterministic (stable per order) fake rider for the demo.
const RIDERS = [
  { name: 'Chuka Okafor', vehicle: 'Motorbike' },
  { name: 'Amina Bello', vehicle: 'Bicycle' },
  { name: 'Kelechi Eze', vehicle: 'Motorbike' },
  { name: 'Tunde Adisa', vehicle: 'Motorbike' },
  { name: 'Ngozi Nwosu', vehicle: 'Motorbike' },
  { name: 'Ibrahim Musa', vehicle: 'Bicycle' },
]
function riderFor(id) {
  let h = 0
  for (let i = 0; i < Math.min(id.length, 12); i++) h = (h * 31 + id.charCodeAt(i)) % 997
  return RIDERS[h % RIDERS.length]
}

// Route drawn on the mini-map: pickup -> dropoff across the street grid.
// Each entry is [x, y] on a 400 x 240 viewBox.
const ROUTE = [
  [52, 182],
  [52, 128],
  [110, 128],
  [110, 84],
  [175, 84],
  [175, 136],
  [236, 136],
  [236, 62],
  [296, 62],
  [296, 108],
  [348, 108],
  [348, 48],
]

const STREETS = { v: [84, 146, 214, 266, 328], h: [56, 106, 156, 198] }

// Block fill cells for map realism (x, y, w, h).
const BLOCKS = [
  [62, 20, 70, 30], [148, 20, 58, 30], [212, 20, 100, 36],
  [62, 118, 70, 32], [148, 118, 124, 32], [284, 118, 56, 32],
  [62, 20 + 104, 70, 32], [148, 20 + 104, 58, 32], [284, 20 + 104, 56, 32],
]

function polyLength(pts) {
  let len = 0
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
  return len
}

function pointAt(pts, dist) {
  let remaining = dist
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1]
    const [x2, y2] = pts[i]
    const seg = Math.hypot(x2 - x1, y2 - y1)
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg
      return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]
    }
    remaining -= seg
  }
  return pts[pts.length - 1]
}

function routeD(pts) {
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]} ${p[1]}`).join(' ')
}

export default function TrackOrder({ orderId, onClose, onBackToRestaurants }) {
  const [input, setInput] = useState(orderId || '')
  const [loading, setLoading] = useState(Boolean(orderId))
  const [error, setError] = useState(null)
  const [order, setOrder] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [elapsed, setElapsed] = useState(0)
  const closeRef = useRef(null)
  const timerRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(0)
  const orderCurrentId = useRef(null)

  const fetch = async (id) => {
    const trimmed = (id || input).trim()
    if (!trimmed) {
      setError({ message: 'Enter your order ID to track it.' })
      return
    }
    setLoading(true)
    setError(null)
    try {
      const o = await getOrder(trimmed)
      setOrder(o)
      if (orderCurrentId.current !== o.id) {
        orderCurrentId.current = o.id
        startRef.current = performance.now()
        setElapsed(0)
        // Only refetch restaurant details on a new order, not on every poll —
        // otherwise the order card flickers as the name/address reload.
        setRestaurant(null)
        getRestaurant(o.restaurant_id)
          .then(setRestaurant)
          .catch(() => setRestaurant(null))
      }
    } catch (e) {
      setOrder(null)
      setError({ message: e.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (orderId) fetch(orderId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  useEffect(() => {
    if (!order) return undefined
    if (order.status === 'delivered' || order.status === 'cancelled') return undefined
    timerRef.current = setInterval(() => fetch(order.id), 5000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order])

  // Journey clock.
  useEffect(() => {
    if (!order) return undefined
    const terminal = order.status === 'delivered' || order.status === 'cancelled'
    if (terminal) return undefined
    const tick = (now) => {
      const t = Math.min((now - startRef.current) / 1000, RIDE_END)
      setElapsed(t)
      if (t < RIDE_END) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id])

  useEffect(() => {
    if (!closeRef.current) return
    closeRef.current.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cancelled = order?.status === 'cancelled'
  // Delivered when the server says so, OR when the journey clock finishes.
  const delivered = order?.status === 'delivered' || elapsed >= RIDE_END

  const pct = cancelled ? 0 : delivered ? 100 : pctAt(elapsed)
  const idx = cancelled ? 0 : delivered ? PHASES.length - 1 : phaseAt(elapsed)

  const totalLen = polyLength(ROUTE)
  const courier = pointAt(ROUTE, (totalLen * pct) / 100)
  const [cx, cy] = courier
  const d = routeD(ROUTE)

  const rider = order ? riderFor(order.id) : null
  const etaMin = cancelled || delivered ? 0 : Math.max(1, Math.ceil(FULL_ETA_MIN * (1 - elapsed / RIDE_END)))
  const phase = PHASES[idx]

  // Parked beside the buka during the pre-ride steps; on the road along the
// route once "On the way" begins (>= RIDE_START sim-seconds).
  const parked = !delivered && elapsed < RIDE_START
  const riderX = parked ? ROUTE[0][0] : cx
  const riderY = parked ? ROUTE[0][1] - 24 : cy

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label="Track order">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer drawer--track" aria-modal="true" aria-label="Track order">
        <header className="drawer__head drawer__head--track">
          <button ref={closeRef} type="button" className="drawer__close" onClick={onClose} aria-label="Close tracking">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="drawer__title">Track your order</div>
          {order && (
            <p className="drawer__meta">
              Order ID <strong className="track-oid">{order.id.slice(0, 8)}</strong>
            </p>
          )}
        </header>

        <div className="drawer__body">
          {!order ? (
            <div className="track-form">
              <label className="cart-field">
                <span className="cart-field__label">Order ID</span>
                <input
                  className="cart-field__input"
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="e.g. bd96dc8b"
                  onKeyDown={(e) => { if (e.key === 'Enter') fetch() }}
                />
              </label>
              <p className="track-form__hint">
                Paste the order ID from your receipt (shown after checkout), then tap Track.
              </p>
              {error && <p className="cart-error" role="alert">{error.message}</p>}
              <button type="button" className="btn btn--primary btn--block" disabled={loading} onClick={() => fetch()}>
                {loading ? 'Looking up…' : 'Track order'}
              </button>
              {onBackToRestaurants && (
                <button type="button" className="btn btn--ghost btn--block" onClick={onBackToRestaurants}>
                  Back to restaurants
                </button>
              )}
            </div>
          ) : (
            <div className="track-view">
              {/* Status hero */}
              <section className="track-hero">
                {cancelled ? (
                  <>
                    <h3 className="track-hero__title track-hero__title--off">Order cancelled</h3>
                    <p className="track-hero__sub">This order was cancelled and can't be delivered.</p>
                  </>
                ) : delivered ? (
                  <>
                    <h3 className="track-hero__title">Delivered — enjoy your meal!</h3>
                    <p className="track-hero__sub">Your food arrived at the delivery address.</p>
                  </>
                ) : (
                  <>
                    <h3 className="track-hero__title">{phase.label}</h3>
                    <p className="track-hero__sub">
                      {phase.id === 'on_the_way'
                        ? `Arriving in ~${etaMin} min · ${rider?.name} is handling your order`
                        : `Estimated delivery in ~${etaMin} min`}
                    </p>
                  </>
                )}
                {!cancelled && (
                  <span className={delivered ? 'track-eta track-eta--ok' : 'track-eta'}>
                    {delivered ? 'Arrived' : `~${etaMin} min`}
                  </span>
                )}
              </section>

              {/* Live map */}
              <div className="track-map">
                <svg viewBox="0 0 400 240" role="img" aria-label="Delivery route map">
                  {BLOCKS.map(([x, y, w, h], i) => (
                    <rect key={`b${i}`} x={x} y={y} width={w} height={h} rx="3" className="track-map__block" />
                  ))}
                  {STREETS.v.map((x) => (
                    <line key={`v${x}`} x1={x} y1="14" x2={x} y2="226" className="track-map__street" />
                  ))}
                  {STREETS.h.map((y) => (
                    <line key={`h${y}`} x1="14" y1={y} x2="386" y2={y} className="track-map__street" />
                  ))}
                  <line x1="214" y1="14" x2="214" y2="226" className="track-map__street track-map__street--main" />
                  <line x1="14" y1="156" x2="386" y2="156" className="track-map__street track-map__street--main" />
                  <text x="222" y="30" className="track-map__roadname">Admiralty Way</text>
                  <text x="30" y="150" className="track-map__roadname">Victory Road</text>

                  <path d={d} className="track-map__route" />
                  <path d={d} pathLength="100" strokeDasharray={cancelled ? '0 100' : `${pct} 100`} className="track-map__route track-map__route--prog" />

                  <g transform={`translate(${ROUTE[0][0]} ${ROUTE[0][1]})`} className="track-map__pin">
                    <circle r="8" />
                    <path d="M0 -4 4.5 3.4H-4.5Z" />
                  </g>
                  <text x={ROUTE[0][0] + 14} y={ROUTE[0][1] + 5} className="track-map__label">
                    {restaurant?.name || 'The buka'}
                  </text>

                  <g transform={`translate(${ROUTE[ROUTE.length - 1][0]} ${ROUTE[ROUTE.length - 1][1]})`} className="track-map__home">
                    <path d="M0 -10 C6.5 -3.4 9.8 1.6 9.8 8.2 A9.8 9.8 0 0 1 -9.8 8.2 C-9.8 1.6 -6.5 -3.4 0 -10Z" />
                    <circle r="2.6" cx="0" cy="6.2" />
                  </g>
                  <text x={ROUTE[ROUTE.length - 1][0] - 10} y={ROUTE[ROUTE.length - 1][1] - 12} textAnchor="end" className="track-map__label">
                    {order.delivery_city || 'Home'}
                  </text>

                  {!cancelled && !delivered && (
                    <g
                      transform={`translate(${riderX} ${riderY})`}
                      className="track-map__rider"
                    >
                      <circle r="13" className="track-map__rider-halo" />
                      <g className="track-map__rider-ic" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="-5" cy="3.6" r="2.4" fill="currentColor" />
                        <circle cx="5" cy="3.6" r="2.4" fill="currentColor" />
                        <path d="M-5 3.6 2 3.6 4 .4 6.4.2" />
                        <path d="M2 3.6 3.8 -4.8H7" />
                        <path d="M7 -4.8 6.4 -2.4" />
                      </g>
                    </g>
                  )}
                </svg>
              </div>

              {/* Horizontal progress rail */}
              <ol className="track-rail">
                {PHASES.map((p, i) => {
                  const done = !cancelled && i <= idx
                  const cur = !cancelled && i === idx && !delivered
                  const last = i === PHASES.length - 1
                  return (
                    <li key={p.id} className={`track-rail__cell${done ? ' is-done' : ''}${cur ? ' is-cur' : ''}`}>
                      <span className="track-rail__dot" aria-hidden="true">
                        {done ? (
                          <svg viewBox="0 0 12 12" aria-hidden="true">
                            <path d="m2.5 6.2 2.4 2.4 4.6-5.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : (
                          <span className="track-rail__num">{i + 1}</span>
                        )}
                      </span>
                      <span className="track-rail__label">{p.short}</span>
                      {!last && <span className="track-rail__link" aria-hidden="true" />}
                    </li>
                  )
                })}
              </ol>

              {/* Rider card */}
              {!cancelled && rider && (
                <section className="track-card track-rider">
                  <div className="track-avatar" aria-hidden="true">
                    {rider.name.split(' ').map((w) => w[0]).join('')}
                  </div>
                  <div className="track-rider__info">
                    <p className="track-card__label">{delivered ? 'Your courier was' : 'Your courier is'} {rider.name}</p>
                    <p className="track-card__sub">{rider.vehicle} · {delivered ? 'delivered on time' : `estimated ~${etaMin} min`}</p>
                  </div>
                  <div className="track-rider__badge">{delivered ? 'Done' : phase.id === 'on_the_way' ? 'On the way' : 'Awaiting pickup'}</div>
                </section>
              )}

              {/* Order summary */}
              <section className="track-card track-order">
                <div className="track-order__row">
                  <span className="track-card__label">{restaurant?.name || 'Restaurant'}</span>
                  <span className="track-order__qty">{order.items?.length ?? 1} item{(order.items?.length ?? 1) === 1 ? '' : 's'}</span>
                </div>
                <p className="track-card__sub">
                  {delivered
                    ? (order.delivery_address || order.delivery_city || 'Delivered to the customer')
                    : `${restaurant?.address}, ${restaurant?.city || order.delivery_city}`}
                </p>
                <div className="track-order__row track-order__row--total">
                  <span className="track-card__label">Total</span>
                  <strong className="track-order__amt">{naira(order.total_amount)}</strong>
                </div>
              </section>

              {/* Delivery address */}
              <section className="track-card track-drop">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 1.5a4.8 4.8 0 0 0-4.8 4.8c0 3.4 4.8 8.2 4.8 8.2s4.8-4.8 4.8-8.2A4.8 4.8 0 0 0 8 1.5Zm0 6.5a1.7 1.7 0 1 1 0-3.4 1.7 1.7 0 0 1 0 3.4Z" fill="var(--accent)" />
                </svg>
                <div>
                  <p className="track-card__label">Delivering to</p>
                  <p className="track-card__sub">{order.delivery_address || order.delivery_city}</p>
                </div>
              </section>

              {error && <p className="cart-error" role="alert">{error.message}</p>}
              <button type="button" className="btn btn--ghost btn--block" onClick={() => setOrder(null)}>
                Track a different order
              </button>
              {onBackToRestaurants && (
                <button type="button" className="btn btn--primary btn--block" onClick={onBackToRestaurants}>
                  Back to restaurants
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}