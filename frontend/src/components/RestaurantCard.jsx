import { bannerImage, cuisineGradient, STATUS_LABEL, STATUS_TONE } from '../lib/constants.js'
import './Card.css'

export default function RestaurantCard({ restaurant, onOpen }) {
  const r = restaurant
  const tone = STATUS_TONE[r.status] || 'muted'
  const label = STATUS_LABEL[r.status] || r.status
  const img = bannerImage(r.cuisine_type, r.name)

  return (
    <article className="card" aria-label={r.name}>
      <div
        className="card__banner"
        style={{ background: cuisineGradient(r.cuisine_type) }}
      >
        {img && (
          <img
            className="card__banner-img"
            src={img}
            alt=""
            loading="lazy"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
        )}
        <div className="card__banner-top">
          <span className="card__rating">
            <Star className="card__star" />
            {Number(r.rating ?? 0).toFixed(2)}
          </span>
          <span className={`badge badge--${tone}`}>{label}</span>
        </div>
      </div>

      <div className="card__body">
        <div className="card__head">
          <h3 className="card__name">{r.name}</h3>
          {r.cuisine_type && <span className="card__cuisine">{r.cuisine_type}</span>}
        </div>
        <p className="card__addr">
          <svg className="card__pin" viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 1.5a5 5 0 0 0-5 5c0 3.5 5 8 5 8s5-4.5 5-8a5 5 0 0 0-5-5Z" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <circle cx="8" cy="6.5" r="1.7" fill="currentColor" />
          </svg>
          <span>{r.city}{r.address ? ` · ${r.address}` : ''}</span>
        </p>
        <button
          type="button"
          className="card__cta"
          onClick={() => onOpen(r)}
          aria-label={`View menu for ${r.name}`}
        >
          View menu
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3 8h9M9 4.5 12.5 8 9 11.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </article>
  )
}

function Star({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" aria-hidden="true">
      <path d="m8 1.6 1.9 3.9 4.3.6-3.1 3 .7 4.2-3.8-2-3.8 2 .7-4.2-3.1-3 4.3-.6L8 1.6Z" fill="currentColor" />
    </svg>
  )
}