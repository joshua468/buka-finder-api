import { useEffect, useRef, useState } from 'react'
import { createOrder, getFirstCustomer } from '../lib/api.js'
import { dishImage, naira } from '../lib/constants.js'
import './Drawer.css'

export default function CartDrawer({ cart, onClose, onChangeQty, onRemove, onClear, onTrack }) {
  const [address, setAddress] = useState('')
  const [busy, setBusy] = useState(false)
  const [placed, setPlaced] = useState(null)
  const [error, setError] = useState(null)
  const closeRef = useRef(null)

  const restaurantCount = new Set(cart.map((c) => c.restaurantId)).size
  const total = cart.reduce((sum, c) => sum + Number(c.price) * c.qty, 0)

  useEffect(() => {
    if (!closeRef.current) return
    closeRef.current.focus()
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const placeOrder = async () => {
    if (restaurantCount !== 1 || cart.length === 0) return
    if (!address.trim() || address.trim().length > 500) {
      setError({ message: 'Enter a delivery address (500 characters max).' })
      return
    }
    setBusy(true)
    setError(null)
    try {
      let customer = await getFirstCustomer()
      if (!customer) throw new Error('No customer on file to place the order under.')
      const order = await createOrder({
        customer_id: customer.id,
        restaurant_id: cart[0].restaurantId,
        delivery_address: address.trim(),
        items: cart.map((c) => ({ menu_item_id: c.id, quantity: c.qty })),
      })
      setPlaced(order)
      onClear()
    } catch (e) {
      setError({ message: e.message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="drawer-root" role="dialog" aria-modal="true" aria-label="Your cart">
      <div className="drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside className="drawer drawer--cart" aria-modal="true" aria-label="Your cart">
        <header className="drawer__head drawer__head--cart">
          <button ref={closeRef} type="button" className="drawer__close" onClick={onClose} aria-label="Close cart">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <div className="drawer__title">Your cart</div>
          <p className="drawer__meta">Review your order and check out</p>
        </header>

        <div className="drawer__body">
          {placed ? (
            <div className="cart-done">
              <div className="cart-done__badge" aria-hidden="true">✓</div>
              <h3 className="cart-done__title">Order placed!</h3>
              <p className="cart-done__meta">
                We've received your order. You can track it using order ID{' '}
                <strong className="cart-done__id">{placed.id.slice(0, 8)}</strong>.
              </p>
              <div className="cart-done__card">
                <span>Subtotal</span>
                <strong>{naira(placed.total_amount)}</strong>
              </div>
              <p className="cart-done__status">
                <span className="cart-done__dot" aria-hidden="true" /> Status: <strong>{placed.status}</strong>
              </p>
              <button type="button" className="btn btn--ghost btn--block" onClick={() => onTrack(placed.id)}>
                Track this order
              </button>
              <button type="button" className="btn btn--primary btn--block" onClick={onClose}>Back to restaurants</button>
            </div>
          ) : cart.length === 0 ? (
            <div className="cart-empty">
              <div className="cart-empty__icon" aria-hidden="true">🛒</div>
              <p className="cart-empty__title">Your cart is empty</p>
              <p className="cart-empty__note">Add dishes from a restaurant's menu to get started.</p>
            </div>
          ) : (
            <>
              {restaurantCount > 1 && (
                <p className="cart-warn">
                  Orders can only contain items from one restaurant. Add an item from a new restaurant to replace the cart.
                </p>
              )}
              <p className="cart-from">Ordering from</p>
              <p className="cart-rest">{cart[0].restaurantName}</p>
              <ul className="cart-list">
                {cart.map((c) => {
                  const img = dishImage({ name: c.name })
                  return (
                    <li key={c.id} className="cart-item">
                      {img && (
                        <div className="cart-item__media">
                          <img src={img} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />
                        </div>
                      )}
                      <div className="cart-item__info">
                        <p className="cart-item__name">{c.name}</p>
                        <p className="cart-item__price">
                          {naira(c.price)}
                          {c.qty > 1 && <span className="cart-item__mult"> × {c.qty}</span>}
                        </p>
                      </div>
                      <div className="qty" role="group" aria-label={`Quantity for ${c.name}`}>
                        <button type="button" className="qty__btn" onClick={() => onChangeQty(c.id, -1)} aria-label="Decrease quantity">−</button>
                        <span className="qty__n">{c.qty}</span>
                        <button type="button" className="qty__btn" onClick={() => onChangeQty(c.id, 1)} aria-label="Increase quantity">+</button>
                      </div>
                      <button type="button" className="cart-item__remove" onClick={() => onRemove(c.id)}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m2 0-1 12a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1L7 7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {error && <p className="cart-error" role="alert">{error.message}</p>}

              <label className="cart-field">
                <span className="cart-field__label">Delivery address</span>
                <textarea
                  className="cart-field__input"
                  rows={3}
                  maxLength={500}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 12 Admiralty Way, Lekki Phase 1, Lagos"
                />
              </label>

              <div className="cart-total">
                <span>Total</span>
                <strong>{naira(total)}</strong>
              </div>

              <button type="button" className="btn btn--primary btn--block" disabled={busy || cart.length === 0} onClick={placeOrder}>
                {busy ? 'Placing order…' : `Place order · ${naira(total)}`}
              </button>
            </>
          )}
        </div>
      </aside>
    </div>
  )
}