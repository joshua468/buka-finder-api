# Food Delivery API

A production-shaped REST API for a Nigerian food delivery market — restaurants, menu items,
customers and orders — with a consumer web app that calls it. This is **Task 1** of the Five
Engineering Tasks bootcamp.

- **Stack:** Go + Gin, PostgreSQL + GORM, React + Vite (consumer)
- **Market:** food delivery (restaurants → menu items → orders)
- **Identifiers:** UUID v4 (generated, never sequential integers)

---

## Live URLs

| Service     | URL                                   |
|-------------|---------------------------------------|
| API + Web   | `https://<deployed>.onrender.com/`    |
| Local API   | `http://localhost:8000`               |

> Deployment happens at the end of this task (Step 7 — Railway / Render). Until then
> everything below runs against `http://localhost:8000`.

---

## Step 1 — Resource design

Four resources, three levels of relationship:

```
Restaurant 1───∞ MenuItem
Restaurant 1───∞ Order
Customer   1───∞ Order
Order      1───∞ OrderItem ──∞1 MenuItem
```

| Resource   | Field                    | Type            | Required | Notes                                      |
|------------|--------------------------|-----------------|----------|--------------------------------------------|
| restaurant | `id`                     | uuid (PK)       | auto     | UUID v4                                    |
|            | `name`                   | varchar(255)    | yes      | unique                                     |
|            | `description`            | text            | no       |                                            |
|            | `cuisine_type`           | varchar(100)    | no       |                                            |
|            | `address`                | varchar(500)    | yes      |                                            |
|            | `city`                   | varchar(100)    | yes      | indexed, filterable                        |
|            | `rating`                 | numeric(2,1)    | no       | 0.0 – 5.0                                  |
|            | `status`                 | varchar(20)     | no       | `active` / `inactive` / `suspended`        |
|            | `phone`, `email`         | varchar         | no       | unique                                     |
|            | `created_at` / `updated_at` | timestamptz  | auto     | UTC                                        |
| menu_item  | `id`                     | uuid (PK)       | auto     |                                            |
|            | `restaurant_id`          | uuid (FK)       | yes      | restaurant RESTRICT course                 |
|            | `name`                   | varchar(255)    | yes      | unique per restaurant                      |
|            | `description`            | text            | no       |                                            |
|            | `price`                  | numeric(10,2)   | yes      | money as DECIMAL, never float              |
|            | `available`              | bool            | no       | default true                               |
|            | `category`               | varchar(100)    | no       | filterable                                 |
|            | `preparation_time_minutes`| int            | no       |                                            |
| customer   | `id`                     | uuid (PK)       | auto     |                                            |
|            | `email`                  | varchar(255)    | yes      | unique                                     |
|            | `phone`                  | varchar(20)     | no       |                                            |
|            | `first_name` / `last_name`| varchar(100)   | no       |                                            |
|            | `address`                | varchar(500)    | no       |                                            |
|            | `city`                   | varchar(100)    | no       | indexed, filterable                        |
|            | `status`                 | varchar(20)     | no       | `active` / `inactive` / `suspended`        |
| order      | `id`                     | uuid (PK)       | auto     |                                            |
|            | `customer_id`            | uuid (FK)       | yes      | RESTRICT (must exist to order)             |
|            | `restaurant_id`          | uuid (FK)       | yes      | RESTRICT; must be `active`                 |
|            | `status`                 | varchar(20)     | auto     | see state machine below                    |
|            | `total_amount`           | numeric(10,2)   | yes      | computed server-side, never accepted       |
|            | `delivery_address`       | varchar(500)    | yes      |                                            |
|            | `delivery_city`          | varchar(100)    | no       | defaults to the restaurant's city          |
|            | `delivered_at`           | timestamptz     | no       | set when status → `delivered`              |
| order_item | `id`                     | uuid (PK)       | auto     |                                            |
|            | `order_id`               | uuid (FK)       | yes      | CASCADE on order delete                    |
|            | `menu_item_id`           | uuid (FK)       | yes      | RESTRICT                                   |
|            | `quantity`               | int             | yes      | ≥ 1                                        |
|            | `unit_price`             | numeric(10,2)   | yes      | snapshot at order time                     |
|            | `subtotal`               | numeric(10,2)   | yes      | quantity × unit_price                      |

Order status machine (enforced in code):

```
pending → confirmed → preparing → ready → out_for_delivery → delivered
    └────────────── cancellable from any state except delivered ──────┘
```

---

## Step 3 — API

Base path: **`/api/v1`**. All paths kebab-case, no trailing slash.

### Endpoints

| Method | Path                          | Description             |
|--------|-------------------------------|-------------------------|
| GET    | `/api/v1/restaurants`         | list, paginated         |
| GET    | `/api/v1/restaurants/:id`     | one restaurant          |
| GET    | `/api/v1/restaurants/:id/menu`| nested resource         |
| GET    | `/api/v1/customers`           | list, paginated         |
| GET    | `/api/v1/customers/:id`       | one customer            |
| GET    | `/api/v1/orders`              | list, paginated         |
| GET    | `/api/v1/orders/:id`          | one order (with items)  |
| POST   | `/api/v1/orders`              | create order            |
| PATCH  | `/api/v1/orders/:id`          | partial update (status) |
| DELETE | `/api/v1/orders/:id`          | remove order            |

### Query parameters (all list endpoints)

| Param  | Type    | Default | Notes                                    |
|--------|---------|---------|------------------------------------------|
| `limit`| int     | 20      | min 1, **max 100 — clamped, never > max** |
| `page` | int     | 1       | 1-based; `offset` derived as `(page-1)*limit`; negative/0 → 400 |
| `offset`| int    | 0       | raw offset; explicit `offset` wins over `page`; negative → 400 `INVALID_QUERY` |
| `sort` | string  | —       | field name; unknown field → 400          |
| `order`| string  | `asc`   | `asc` or `desc`                          |

Filters (AND across fields; multiple values OR'd). Both flat (`?status=pending`) and bracket (`?filter[status]=pending`) syntaxes are accepted — they are equivalent and their values are unioned. `rating_min` is a range filter (`rating >= value`), not an exact match.

| Endpoint               | Filter fields                                  | Sortable fields           |
|------------------------|------------------------------------------------|---------------------------|
| `/restaurants`         | `city`, `cuisine`, `status`, `rating_min`      | `name`, `rating`, `created_at` |
| `/restaurants/:id/menu`| `category`, `available`, `min_price`, `max_price` | `name`, `price`, `category` |
| `/customers`           | `city`, `status`                               | `name`, `created_at`      |
| `/orders`              | `status`, `restaurant_id`, `customer_id`       | `created_at`, `total_amount`, `status` |

### Response envelope (every successful response)

```json
{
  "success": true,
  "data": [...],
  "meta": { "total": 350, "limit": 20, "offset": 0, "hasMore": true, "timestamp": "2026-01-15T10:30:00Z" }
}
```

### Error envelope (every error response)

```json
{
  "success": false,
  "data": null,
  "error": { "code": "INVALID_QUERY", "message": "invalid offset: \"-5\" (must be a non-negative integer)" },
  "meta": { "timestamp": "2026-01-15T10:30:00Z", "request_id": "13bf95e9-e730-4f0b-ae65-7b0d0e7c3f4e" }
}
```

### Error codes

| Code             | HTTP | Used for                                    |
|------------------|------|---------------------------------------------|
| `INVALID_REQUEST`| 400  | malformed identifier, malformed UUID        |
| `INVALID_QUERY`  | 400  | bad `limit`/`page`/`offset`/`sort`/`order`  |
| `VALIDATION_ERROR`| 422 | missing required body fields                |
| `RESOURCE_NOT_FOUND` | 404  | resource does not exist                 |
| `CONFLICT`       | 409  | illegal status transition / inactive restaurant / unavailable item |
| `RATE_LIMITED`   | 429  | rate limit exceeded (with `Retry-After`)    |
| `INTERNAL_ERROR` | 500  | unexpected server error (never leaks details) |

---

## Step 4 — Ugly inputs handled on purpose

| Request                                          | Result                                                                |
|--------------------------------------------------|-----------------------------------------------------------------------|
| `?limit=5000`                                    | `limit` clamped to `100` in the response, 200, never a 500            |
| `?offset=-5`                                     | 400 `INVALID_QUERY` with a clear message                              |
| `?sort=bogus`                                    | 400 `INVALID_QUERY` listing the allowed fields                        |
| `/restaurants/not-a-uuid`                        | 400 `INVALID_REQUEST`                                                 |
| `/restaurants/<valid-but-missing-uuid>`          | 404 `RESOURCE_NOT_FOUND`                                             |
| `POST /orders` missing required field            | 422 `VALIDATION_ERROR` naming the field(s)                            |
| more than 100 req/min from one IP                | 429 `RATE_LIMITED` with `Retry-After` header                          |

Request bodies and query params are validated in one place with `go-playground/validator`.

---

## Step 5 — Rate limiting

- Keyed on **client IP**, default **100 requests/minute** with a **150 burst**.
- Over-limit requests get **HTTP 429** + `Retry-After` header (seconds to wait).
- All numbers live in `internal/config/config.go` (env-overridable):
  `RATE_LIMIT_LIMIT`, `RATE_LIMIT_BURST`, `RATE_LIMIT_ENABLED` — never in handlers.
- Response also includes `X-RateLimit-Remaining`.

---

## Quick start

### Prerequisites

- Go 1.24+
- PostgreSQL (local or managed)
- Node.js 20+ (for the consumer, optional at runtime)

### 1. Configure the environment

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/fooddelivery?sslmode=disable"
export PORT=8000
```

### 2. Seed the database (repeatable, idempotent)

```bash
go run ./seed
# seeded 350 restaurants, 3500 menu items, 320 customers, 2100 orders
```

The seed **truncates** then inserts — run it any number of times, no duplicates. The RNG is
seeded with a fixed value, so the data is deterministic across runs. The script lives in
`seed/main.go` and is committed (no DB dumps in the repo).

### 3. Run the API

```bash
go run ./cmd/api
# food delivery API running on :8000
```

The API also serves the built consumer at `/` (build it first in `frontend/` or run the Vite
dev server separately).

### 4. Run the consumer (optional, dev mode)

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173, proxies /api/v1 -> :8000
```

---

## Endpoint documentation with curl examples

All of these work against the live URL once deployed — substitute the domain.

### GET /restaurants — list restaurants

Query params: `limit`, `page`, `offset`, `sort` (`name`/`rating`/`created_at`), `order` (`asc`/`desc`),
filters `city`, `cuisine`, `status`, `rating_min` (either `?status=x` or `?filter[status]=x`).

```bash
curl "https://<deployed>/api/v1/restaurants?limit=2&city=Lagos&sort=rating&order=desc"
```

```json
{
  "success": true,
  "data": [
    {
      "id": "0d9e0f94-2bcc-42c0-a1e2-ee27034b7c2d",
      "name": "Chop & Cheers 1",
      "cuisine_type": "Nigerian",
      "city": "Port Harcourt",
      "rating": "3.5",
      "status": "active",
      "created_at": "2026-09-23T14:01:54.601347+01:00",
      "updated_at": "2026-09-23T14:01:54.601347+01:00"
    }
  ],
  "meta": { "total": 350, "limit": 2, "offset": 0, "hasMore": true, "timestamp": "2026-09-23T14:03:11Z" }
}
```

### GET /restaurants/:id — one restaurant

```bash
curl "http://localhost:8000/api/v1/restaurants/0d9e0f94-2bcc-42c0-a1e2-ee27034b7c2d"
```

### GET /restaurants/:id/menu — nested resource

```bash
curl "http://localhost:8000/api/v1/restaurants/0d9e0f94-2bcc-42c0-a1e2-ee27034b7c2d/menu?category=Grills%20%26%20Suya&min_price=10"
```

### GET /customers — list

```bash
curl "http://localhost:8000/api/v1/customers?city=Ibadan&limit=5"
```

### GET /orders — list

```bash
curl "http://localhost:8000/api/v1/orders?status=pending&sort=created_at&order=desc"
```

### POST /orders — create

Body: `customer_id`, `restaurant_id`, `delivery_address`, `delivery_city` (optional), `items[]`.

```bash
curl -X POST "http://localhost:8000/api/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "b37cd50b-c8f6-442b-be1f-b6240b912998",
    "restaurant_id": "0d9e0f94-2bcc-42c0-a1e2-ee27034b7c2d",
    "delivery_address": "12 Marina Road",
    "items": [
      { "menu_item_id": "e7e0b32c-6b1a-434c-a53c-0ef98985d0d7", "quantity": 2 }
    ]
  }'
```

Business rules enforced: customer must exist; restaurant must be `active`; all items must
belong to the restaurant and be `available`; `total_amount` is computed server-side
(∑ quantity × unit_price), never accepted from the client.

### PATCH /orders/:id — partial update (status)

```bash
curl -X PATCH "http://localhost:8000/api/v1/orders/72ff384b-5650-458f-814a-2c4227855941" \
  -H "Content-Type: application/json" \
  -d '{ "status": "confirmed" }'
```

Illegal transitions → 409 `CONFLICT` (e.g. `delivered` → anything).

### DELETE /orders/:id — remove

```bash
curl -X DELETE "http://localhost:8000/api/v1/orders/72ff384b-5650-458f-814a-2c4227855941"
```

---

## Design decisions

**Why these resources.** Restaurants, menu items, customers and orders are the four nouns a
food platform actually stores, and they give every relationship type we want to prove:
one-to-many (restaurant → menu, order → order items), and two separate owners of an order
(customer places it, restaurant fulfills it). Three resources reference each other, which is
the minimum the task demands.

**Why generated (UUID) identifiers.** Sequential integer ids let anyone enumerate the whole
dataset by counting — `/restaurants/1`, `/restaurants/2` … walk to the end. A v4 UUID is
unguessable and unorderable across resources, so a client cannot infer existence or volume
from ids alone. UUIDs are the professional default and cost nothing in PostgreSQL.

**Why offset pagination (and when I'd use a cursor).** Offset pagination is simple, stable,
and works everywhere; `meta.offset + meta.limit < meta.total` answers "is there a next page"
in one expression. I chose it because the dataset is bounded (hundreds of thousands, not
billions) and clients can deep-page (`offset=0`, `20`, `40`…) which cursors make awkward.
The external interface is page-based (`?page=N` maps to `offset=(N-1)*limit`), with raw
`?offset=` still supported for power clients; the derived and raw forms land in the same
`meta.offset`.
The tradeoff: as offset grows, PostgreSQL still has to scan and discard the skipped rows, and
if rows are inserted/deleted between requests, pages can drift. **I'd switch to cursor
pagination** (e.g. a `?cursor=<opaque-token>` built from `(created_at, id)`) the moment the
table reaches high millions of rows, or when clients page deeper than ~10k rows, because it
turns `OFFSET n` scans into index seeks and makes paging immune to concurrent writes.

**What happens if you request page 50 of 30 pages** (`offset=1000` on 350 rows): you get 200
with `data: []` and the correct `meta.total`, not a 404 and not an error. The envelope always
tells you the truth (`total=350`, `hasMore=false`); empty pages are a valid, honest result.

**What happens if you request 5000 records** (`limit=5000`): clamped to the configured max
(`100`), returned in `meta.limit`. The client can see the real limit in the envelope. Never
honour a limit above max and never error on it.

**Why this envelope shape.** `{ data, meta }` and `{ data: null, error }` is one shape for
success and one for failure — never 200-with-a-message-in-the-body, never two different
success shapes. `meta` carries pagination facts next to the data they describe. Every client
(including the consumer) parses `body.data` and `body.error` the same way for every endpoint.

**Why rate limiting lives in a config file, not the handler.** The handler's job is to serve
data; the rate-limit policy is an operational number that ops changes without a code review
(abuse spike → tighten, legitimate burst → loosen). It's env-overridable at `internal/config`
and applied as middleware before any handler runs, so no handler can forget it.

**Room for a v2.** The `/v1/` prefix means I can add `/api/v2` tomorrow (say, switch to cursor
pagination or add `is_favorite` on restaurants) without breaking any existing client of v1.
This is exactly the "renamed `/orders` breaks every client" trap the task warns about —
versioning exists from the first commit.

---

## Structure

```
cmd/api/main.go        # entrypoint: wiring, middleware, routes, static consumer
internal/config        # env-driven config (rate limit, pagination, CORS)
internal/database      # Postgres connection + AutoMigrate
internal/models        # GORM models + business-key uniqueness
internal/handlers      # REST handlers (restaurants/menu/customers/orders)
internal/paging        # limit/offset/sort/order parsing + validation
internal/filters       # multi-field filter builder
internal/ratelimit     # per-IP token bucket middleware
internal/response      # consistent envelope + error codes
internal/validation    # go-playground/validator wrapper
seed/main.go           # repeatable deterministic seed (~6.3k rows)
frontend/              # React + Vite consumer (list + filters + paging)
```

---

## Task 1 requirement checklist

| Requirement | Status |
|-------------|--------|
| 3+ related resources | ✅ 4 resources, real FK relationships |
| Repeatable seed, few hundred records/resource | ✅ 350 · 3,500 · 320 · 2,100; truncate-and-insert |
| Versioned paths `/api/v1/` | ✅ |
| Pagination on every list | ✅ limit/page(+offset) + total + hasMore |
| Filtering (≥2 fields/list) | ✅ e.g. `city`, `cuisine`, `min_price`… |
| Sorting with `sort`/`order` | ✅ |
| Consistent envelopes | ✅ `data/meta` + `data:null/error` |
| Honest status codes 400/404/422/429 | ✅ verified with curl above |
| Rate limiting in configuration | ✅ `RATE_LIMIT_*` env vars |
| Full docs with curl examples | ✅ this README |
| Live public URL | ⏳ Step 7 (Railway/Render) |
| Consumer calls the live URL | ⏳ `.env` → `VITE_API_URL` |