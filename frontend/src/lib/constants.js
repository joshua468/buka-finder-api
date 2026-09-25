// Dish images keyed by the seeded base item name (seed/main.go itemNames).
// Menu item names arrive as "<Dish> (<Restaurant> N)" — the base name is
// everything before the " (". A value can be a single path or an array of
// variants — arrays are mixed deterministically per item name so the same
// dish shows different photos at different restaurants. Fallback chain is
// dish -> category -> gradient.
export const DISH_IMAGES = {
  'Jollof Rice with Chicken': [
    '/images/dishes/jollof-rice.jpg',
    '/images/dishes/jollof-rice-2.jpg',
  ],
  'Fried Rice': '/images/dishes/fried-rice.jpg',
  'Ofada Rice with Ayamase': [
    '/images/dishes/ofada-rice.jpg',
    '/images/dishes/ofada-rice-1.jpg',
    '/images/dishes/ofada-rice-3.jpg',
    '/images/dishes/ofada-rice-4.jpg',
  ],
  'Efo Riro': [
    '/images/dishes/efo-riro.jpg',
    '/images/dishes/efo-riro-2.jpg',
    '/images/dishes/efo-riro-3.jpg',
  ],
  'Egusi Soup': '/images/dishes/egusi-soup.jpg',
  'Ogbono Soup': [
    '/images/dishes/ogbono-soup.jpg',
    '/images/dishes/ogbono-soup-2.jpg',
  ],
  'Pounded Yam': [
    '/images/dishes/pounded-yam-1.jpg',
    '/images/dishes/pounded-yam-2.jpg',
    '/images/dishes/pounded-yam-3.jpg',
  ],
  'Amala with Gbegiri': [
    '/images/dishes/amala-gbegiri-1.jpg',
    '/images/dishes/amala-gbegiri-2.jpg',
    '/images/dishes/amala-gbegiri-3.jpg',
    '/images/dishes/amala-gbegiri.jpg',
    '/images/dishes/amala-gbegiri-5.jpg',
  ],
  'Suya Skewers': [
    '/images/dishes/suya-skewers-1.jpg',
    '/images/dishes/suya-skewers-2.jpg',
    '/images/dishes/suya-skewers-4.jpg',
    '/images/dishes/suya-skewers.jpg',
    '/images/dishes/suya-skewers-5.jpg',
  ],
  'Kilishi': '/images/dishes/kilishi.jpg',
  'Nkwobi': '/images/dishes/nkwobi.jpg',
  'Asun': '/images/dishes/asun.jpg',
  'Moi Moi': [
    '/images/dishes/moin-moin.jpg',
    '/images/dishes/moin-moin-3.jpg',
    '/images/dishes/moin-moin-4.jpg',
    '/images/dishes/moin-moin-5.jpg',
    '/images/dishes/moin-moin-6.jpg',
  ],
  'Akara': '/images/dishes/akara.jpg',
  'Ewa Agoyin': [
    '/images/dishes/ewagoyin.jpg',
    '/images/dishes/ewagoyin-2.jpg',
  ],
  'Pepper Soup': [
    '/images/dishes/pepper-soup-1.jpg',
    '/images/dishes/pepper-soup-2.jpg',
    '/images/dishes/pepper-soup.jpg',
    '/images/dishes/pepper-soup-4.jpg',
    '/images/dishes/pepper-soup-5.jpg',
  ],
  'Peppered Snail': '/images/dishes/peppered-snail.jpg',
  'Banga Soup': '/images/dishes/banga-soup.jpg',
  'Edikang Ikong': '/images/dishes/edikang-ikong.jpg',
  'White Soup': '/images/dishes/white-soup.jpg',
  'Grilled Catfish': '/images/dishes/grilled-catfish.jpg',
  'Plantain Mosa': '/images/dishes/plantain-mosa.jpg',
  'Puff Puff': '/images/dishes/puff-puff.jpg',
  'Chin Chin': [
    '/images/dishes/chin-chin.jpg',
    '/images/dishes/chin-chin-2.jpg',
    '/images/dishes/chin-chin-3.jpg',
    '/images/dishes/chin-chin-4.jpg',
    '/images/dishes/chin-chin-5.jpg',
  ],
  'Zobo Drink': '/images/dishes/zobo-drink.jpg',
  'Chapman': '/images/dishes/chapman.jpg',
  'Kunun Aya': '/images/dishes/kunun-aya.jpg',
  'Groundnut Soup': [
    '/images/dishes/groundnut-soup.jpg',
    '/images/dishes/groundnut-soup-1.jpg',
    '/images/dishes/groundnut-soup-2.jpg',
    '/images/dishes/groundnut-soup-4.jpg',
  ],
  'Vegetable Soup': '/images/dishes/vegetable-soup.jpg',
  'Okro Soup': [
    '/images/dishes/okro-soup.jpg',
    '/images/dishes/okra-1.webp',
    '/images/dishes/okra-2.webp',
    '/images/dishes/okra-3.webp',
    '/images/dishes/okra-4.webp',
  ],
  'Boli (Roast Plantain)': '/images/dishes/boli-plantain.jpg',
}

// Category fallbacks (seed categories) so unknown dish names still get food.
export const CATEGORY_IMAGES = {
  'Rice & Stews': '/images/dishes/jollof-rice.jpg',
  'Swallow & Soups': '/images/dishes/pounded-yam-1.jpg',
  'Grills & Suya': '/images/dishes/suya-skewers.jpg',
  'Small Chops': '/images/dishes/puff-puff.jpg',
  'Drinks & Desserts': '/images/dishes/zobo-drink.jpg',
}

export const CUISINE_IMAGES = {
  Nigerian: '/images/banners/banner-nigerian.jpg',
  Hausa: '/images/banners/banner-hausa.jpg',
  Yoruba: '/images/banners/banner-yoruba.jpg',
  Igbo: '/images/banners/banner-igbo.jpg',
  'Fast Food': '/images/banners/banner-fastfood.jpg',
  Seafood: '/images/banners/banner-seafood.jpg',
  Barbecue: '/images/banners/banner-barbecue.jpg',
  Continental: '/images/banners/banner-continental.jpg',
}

export function baseDishName(name) {
  const m = String(name || '').replace(/\s+\([^()]* \d+\)$/, '')
  return m
}

export function dishImage(item) {
  if (item?.name) {
    const hit = DISH_IMAGES[baseDishName(item.name)]
    if (Array.isArray(hit)) return pickVariant(hit, item.name)
    if (hit) return hit
  }
  if (item?.category) {
    const cat = CATEGORY_IMAGES[item.category]
    if (cat) return cat
  }
  return null
}

// All-foods mix for buka-style restaurants ("Mama Put" etc.) — flatten every
// dish, so different locations show a different plate.
const ALL_FOOD_MIX = Object.values(DISH_IMAGES).flat()

// Semo photos (user-supplied) for semo-themed restaurants.
const SEMO_MIX = [
  '/images/dishes/semo.jpg',
  '/images/dishes/semo-2.jpg',
  '/images/dishes/semo-3.jpg',
  '/images/dishes/semo-4.jpg',
  '/images/dishes/semo-7.jpg',
]

// Per-restaurant banner overrides keyed by the seeded base restaurant name
// (matched via startsWith, since seeds append a running number). A value can
// be a single path or an array of variants — arrays are mixed deterministically
// per restaurant so "Amala & Gbegiri N" locations each show a different photo.
export const RESTAURANT_BANNERS = {
  'Mama Put Kitchen': ALL_FOOD_MIX,
  'Suya Republic': [
    '/images/dishes/suya-skewers-1.jpg',
    '/images/dishes/suya-skewers-2.jpg',
    '/images/dishes/suya-skewers-4.jpg',
    '/images/dishes/suya-skewers.jpg',
    '/images/dishes/suya-skewers-5.jpg',
  ],
  'Akara House': '/images/dishes/akara.jpg',
  'Ofada Rice House': [
    '/images/dishes/ofada-rice.jpg',
    '/images/dishes/ofada-rice-1.jpg',
    '/images/dishes/ofada-rice-3.jpg',
    '/images/dishes/ofada-rice-4.jpg',
  ],
  'Jollof Junction': [
    '/images/dishes/jollof-rice.jpg',
    '/images/dishes/jollof-rice-2.jpg',
  ],
  'Ogbono Health Foods': '/images/dishes/ogbono-soup.jpg',
  'Nasco Eatery': '/images/dishes/jollof-rice.jpg',
  'Edikang Ikong': '/images/dishes/edikang-ikong.jpg',
  'Nkwobi Lounge': '/images/dishes/nkwobi.jpg',
  'Kilishi Spot': '/images/dishes/kilishi.jpg',
  'Ewa Agoyin Palace': [
    '/images/dishes/ewagoyin.jpg',
    '/images/dishes/ewagoyin-2.jpg',
  ],
  'Moi Moi Spot': [
    '/images/dishes/moin-moin.jpg',
    '/images/dishes/moin-moin-3.jpg',
    '/images/dishes/moin-moin-4.jpg',
    '/images/dishes/moin-moin-5.jpg',
    '/images/dishes/moin-moin-6.jpg',
  ],
  'Efo Riro Place': [
    '/images/dishes/efo-riro.jpg',
    '/images/dishes/efo-riro-2.jpg',
    '/images/dishes/efo-riro-3.jpg',
  ],
  'Asun Republic': '/images/dishes/asun.jpg',
  'Pounded Yam Palace': [
    '/images/dishes/pounded-yam-1.jpg',
    '/images/dishes/pounded-yam-2.jpg',
    '/images/dishes/pounded-yam-3.jpg',
  ],
  'Egusi Supreme': '/images/dishes/egusi-soup.jpg',
  'Buka Palace': [
    ...DISH_IMAGES['Amala with Gbegiri'],
    ...SEMO_MIX,
    '/images/dishes/ofada-rice.jpg',
    '/images/dishes/ewagoyin.jpg',
    '/images/dishes/banga-soup.jpg',
  ],
  'Groundnut Soup Hub': [
    '/images/dishes/groundnut-soup.jpg',
    '/images/dishes/groundnut-soup-1.jpg',
    '/images/dishes/groundnut-soup-2.jpg',
    '/images/dishes/groundnut-soup-4.jpg',
  ],
  'Banga Soup Buka': '/images/dishes/banga-soup.jpg',
  'Amala & Gbegiri': [
    '/images/dishes/amala-gbegiri-1.jpg',
    '/images/dishes/amala-gbegiri-2.jpg',
    '/images/dishes/amala-gbegiri-3.jpg',
    '/images/dishes/amala-gbegiri.jpg',
    '/images/dishes/amala-gbegiri-5.jpg',
  ],
  'Puff-Puff Yard': '/images/dishes/puff-puff.jpg',
  'Semo Specialist': SEMO_MIX,
  'Naija Flavour': '/images/dishes/amala-gbegiri.jpg',
  'Pepper Soup Inn': [
    '/images/dishes/pepper-soup-1.jpg',
    '/images/dishes/pepper-soup-2.jpg',
    '/images/dishes/pepper-soup.jpg',
    '/images/dishes/pepper-soup-4.jpg',
    '/images/dishes/pepper-soup-5.jpg',
  ],
  'Beans & Plantain': '/images/dishes/ewagoyin.jpg',
  'Nigerian Grill House': '/images/dishes/suya-skewers.jpg',
  'Yam Pottage Spot': [
    '/images/dishes/yam-porrage-1.jpg',
    '/images/dishes/yam-porrage.jpg',
    '/images/dishes/yam-porrage-3.jpg',
  ],
  'White Soup Kitchen': '/images/dishes/white-soup.jpg',
  'Isi Ewu Corner': [
    '/isiewuu.jpg',
    '/isiewu2.jpg',
    '/isiewu3.jpg',
  ],
  'Okra Soup Joint': [
    '/images/dishes/okro-soup.jpg',
    '/images/dishes/okra-1.webp',
    '/images/dishes/okra-2.webp',
    '/images/dishes/okra-3.webp',
    '/images/dishes/okra-4.webp',
  ],
}

// Deterministic per-string pick so the same restaurant always shows the
// same variant while different locations across the array.
function pickVariant(list, key) {
  let total = 0
  for (const ch of String(key)) total = (total * 31 + ch.charCodeAt(0)) >>> 0
  return list[total % list.length]
}

export function bannerImage(cuisine, restaurantName) {
  if (restaurantName) {
    const hit = Object.entries(RESTAURANT_BANNERS).find(([name]) =>
      String(restaurantName).startsWith(name),
    )
    if (hit) {
      const img = hit[1]
      return Array.isArray(img) ? pickVariant(img, restaurantName) : img
    }
  }
  return CUISINE_IMAGES[cuisine] || CUISINE_IMAGES.Nigerian
}

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

const _naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

// Backend stores money in kobo (naira * 100). Convert to naira before display
// so users always see proper amounts like ₦5,000 — never raw kobo.
export const naira = (kobo) => _naira.format(Math.round(Number(kobo) / 100))

export function initials(name) {
  return name
    .replace(/[^a-z0-9 ]/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}