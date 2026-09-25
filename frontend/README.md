# Buka Finder — Consumer (React + Vite)

The customer-facing web app for the food delivery API. It consumes the live API
(`/api/v1`) same-origin and proves pagination, filtering, sorting, ordering and live
order tracking from outside the API itself.

## What it does

- restaurant list (20 per page) from `GET /restaurants`
- city filter (header dropdown), cuisine chips, "open now" toggle
- sort: newest / top rated / name A–Z
- page controls with total counts and empty/error states
- order tracking drawer with a live map + progress rail
  (`pending → confirmed → preparing → ready → out_for_delivery → delivered`)

## Money

Prices are returned in **kobo** (₦3,750 → `"375000"`). The `naira()` helper in
`src/lib/constants.js` divides by 100 for display only. Money is never rounded in flight.

## Run (dev)

```bash
npm install
npm run dev      # Vite dev server; proxies /api/v1 → http://localhost:8000
```

## Build

```bash
npm run build    # emits dist/ — served by the API binary at :8000 from the repo root
```

## Pointing at another API

Copy `frontend/.env.example` to `frontend/.env` and set `VITE_API_URL`. Default is the
same-origin `/api/v1`.

## Production

The API binary serves `dist/` itself (see `cmd/api/main.go`), so the deployed consumer
lives at the API origin — e.g. `https://api-production-a74d.up.railway.app/`.