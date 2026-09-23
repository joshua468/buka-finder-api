// Task 8: the consumer must call the public URL. In dev we use the Vite proxy
// (/api/v1 -> localhost), but `VITE_API_URL` points the build at a live URL
// (e.g. https://fooddelivery-api.onrender.com) so the same code works deployed.
const API = import.meta.env.VITE_API_URL ?? '/api/v1'

export const PAGE_SIZE = 20

export async function api(path) {
  const res = await fetch(`${API}${path}`)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const msg = body?.error?.message || `Request failed (${res.status})`
    const err = new Error(msg)
    err.code = body?.error?.code
    err.status = res.status
    throw err
  }
  return body
}

export function listRestaurants({ limit, offset, city, cuisine, sort, order, openOnly }) {
  const p = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (city) p.set('city', city)
  if (cuisine) p.set('cuisine', cuisine)
  if (sort) p.set('sort', sort)
  if (order) p.set('order', order)
  if (openOnly) p.set('status', 'active')
  return api(`/restaurants?${p.toString()}`)
}

export function listMenu(restaurantId) {
  return api(`/restaurants/${restaurantId}/menu?limit=100`)
}