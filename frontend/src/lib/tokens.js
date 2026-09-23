const color = {
  bg: '#0e0f11',
  bgRaised: '#121419',
  panel: '#171a20',
  panel2: '#1d2129',
  panel3: '#242933',
  border: '#262b34',
  borderSoft: '#1d212a',
  text: '#f3efe7',
  textDim: '#a8b0bd',
  textFaint: '#6e7683',
  accent: '#ff5a2d',
  accentHi: '#ff7a52',
  accentDeep: '#d94216',
  ok: '#3ecf6e',
  warn: '#f7b428',
  danger: '#f2433f',
  star: '#f7b428',
  onAccent: '#ffffff',
  scrollThumb: '#2c323d',
  scrollThumbHover: '#3a4150',
}

const radius = {
  s: '8px',
  m: '12px',
  l: '18px',
  xl: '26px',
}

const shadow = {
  default: '0 14px 40px rgba(0, 0, 0, 0.45)',
}

const typography = {
  display: "'Fraunces Variable', Georgia, 'Times New Roman', serif",
  body: "'Plus Jakarta Sans Variable', 'Segoe UI', system-ui, sans-serif",
}

const layout = {
  headerH: '68px',
  maxWidth: '1240px',
}

export const tokens = { color, radius, shadow, typography, layout }

export const CSS_VARS = {
  '--bg': color.bg,
  '--bg-raised': color.bgRaised,
  '--panel': color.panel,
  '--panel-2': color.panel2,
  '--panel-3': color.panel3,
  '--border': color.border,
  '--border-soft': color.borderSoft,
  '--text': color.text,
  '--text-dim': color.textDim,
  '--text-faint': color.textFaint,
  '--accent': color.accent,
  '--accent-hi': color.accentHi,
  '--accent-deep': color.accentDeep,
  '--ok': color.ok,
  '--warn': color.warn,
  '--danger': color.danger,
  '--star': color.star,
  '--on-accent': color.onAccent,
  '--scroll-thumb': color.scrollThumb,
  '--scroll-thumb-hover': color.scrollThumbHover,
  '--radius-s': radius.s,
  '--radius-m': radius.m,
  '--radius-l': radius.l,
  '--radius-xl': radius.xl,
  '--shadow': shadow.default,
  '--font-display': typography.display,
  '--font-body': typography.body,
  '--header-h': layout.headerH,
  '--maxw': layout.maxWidth,
}

export function applyTokens(root = null) {
  const el = root || (typeof document !== 'undefined' ? document.documentElement : null)
  if (!el) return null
  for (const [name, value] of Object.entries(CSS_VARS)) {
    el.style.setProperty(name, value)
  }
  return el
}