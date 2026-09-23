// Real values confirmed from the seeded database (GET /api/v1/restaurants).
export const CITIES = [
  'Lagos',
  'Abuja',
  'Kano',
  'Ibadan',
  'Port Harcourt',
  'Benin City',
  'Enugu',
]

export const CUISINES = [
  'Nigerian',
  'Hausa',
  'Yoruba',
  'Igbo',
  'Fast Food',
  'Seafood',
  'Barbecue',
  'Continental',
]

// Gradient per cuisine for the card banner. Warm Nigerian palette, kept muted
// enough that the monogram and text stay readable.
const GRADIENTS = {
  Nigerian: ['#d9481f', '#f59e0b'],
  Hausa: ['#be123c', '#fb6f14'],
  Yoruba: ['#7c2d12', '#d97706'],
  Igbo: ['#14532d', '#16a34a'],
  'Fast Food': ['#c2410c', '#f5a10b'],
  Seafood: ['#155e75', '#0ea5e9'],
  Barbecue: ['#78350f', '#ea5c09'],
  Continental: ['#312e81', '#6d6ee8'],
}

export function cuisineGradient(cuisine) {
  const g = GRADIENTS[cuisine] || ['#263238', '#546e7a']
  return `linear-gradient(135deg, ${g[0]} 0%, ${g[1]} 100%)`
}

export const STATUS_LABEL = {
  active: 'Open',
  suspended: 'Suspended',
  inactive: 'Closed',
}

export const STATUS_TONE = {
  active: 'ok',
  suspended: 'warn',
  inactive: 'muted',
}

export const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest', sort: 'created_at', order: 'desc' },
  { id: 'rating', label: 'Top rated', sort: 'rating', order: 'desc' },
  { id: 'name', label: 'Name A–Z', sort: 'name', order: 'asc' },
]

export const naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
})

export function initials(name) {
  return name
    .replace(/[^a-z0-9 ]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}