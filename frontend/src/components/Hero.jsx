import { cuisineGradient } from '../lib/constants.js'
import './Hero.css'

export default function Hero({ total }) {
  return (
    <section className="hero">
      <div className="hero__copy">
        <p className="hero__eyebrow">
          <span className="hero__dot" /> Lagos to Enugu, home delivery
        </p>
        <h1 className="hero__title">
          Taste your city's
          <br />
          <em>best bukas.</em>
        </h1>
        <p className="hero__sub">
          {total != null
            ? ` ${total.toLocaleString()} Nigerian restaurants, ready when you are.`
            : ' Nigerian restaurants, ready when you are.'}
        </p>
      </div>

      <div className="hero__art" aria-hidden="true">
        {/* Decorative floating cards — pure CSS, no data behind them. */}
        <div className="hero__plate" style={{ background: cuisineGradient('Nigerian') }}>
          <svg viewBox="0 0 200 200">
            <path d="M40 95a60 60 0 0 0 120 0Z" fill="#fff" opacity="0.92" />
            <path d="M70 78a30 30 0 0 0 60 0Z" fill="#d9481f" opacity="0.85" />
            <g stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.9">
              <path d="M96 30v-14M104 30v-14" />
              <path d="M84 38c-4 6-4 10 0 12M116 38c4 6 4 10 0 12" />
              <path d="M72 46c-7 8-7 14 0 18M128 46c7 8 7 14 0 18" />
            </g>
          </svg>
        </div>
        <div className="hero__tag hero__tag--one" style={{ background: cuisineGradient('Seafood') }}>
          Suya &amp; kilishi
        </div>
        <div className="hero__tag hero__tag--two" style={{ background: cuisineGradient('Igbo') }}>
          Fresh, always
        </div>
      </div>
    </section>
  )
}