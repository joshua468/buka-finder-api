# Buka Finder — Food Delivery API (Task 1)

A REST API for a Nigerian food delivery market — restaurants, menu items, customers and
orders — deployed to a public URL and consumed by a small React app that calls it from the
public internet. This is **Task 1** of the Five Engineering Tasks bootcamp.

- **Stack:** Go + Gin, PostgreSQL + GORM, React + Vite (consumer)
- **Market:** food delivery (restaurants → menu items → orders → order items)
- **Identifiers:** UUID v4 (generated server-side, never sequential integers)
- **Money:** stored and returned in **kobo** (₦1 = 100 kobo, so `"375000"` = ₦3,750), never
  float; `DECIMAL(10,2)` column holds whole kobo
- **Timestamps:** UTC, rendered as `Z` (e.g. `"2026-09-09T22:00:00Z"`)

## Live URL

| Service     | URL |
|-------------|-----|
| API + Consumer (same origin) | `https://api-production-a74d.up.railway.app` |
| Consumer (root) | `https://api-production-a74d.up.railway.app/` |

The API is live, seeded, and verified from the public internet. Everything below is
documented against the live URL — paste any curl and run it. (If you get a `429`, you hit the
rate limit; wait a minute — see Step 5.)

---

## Step 1 — Resource design

Five resources, three levels of relationship:

```
Restaurant 1───∞ MenuItem
Restaurant 1───∞ Order
Customer   1───∞ Order
Order      1───∞ OrderItem ──∞1 MenuItem
```

Every identifier is a generated UUID v4. Money is `DECIMAL(10,2)` storing **kobo**. Timestamps
are UTC.

| Resource   | Field                     | Type             | Required | Notes                                           |
|------------|---------------------------|------------------|----------|-------------------------------------------------|
| restaurant | `id`                      | uuid (PK)        | auto     | UUID v4                                         |
|            | `name`                    | varchar(255)     | yes      | unique (global)                                 |
|            | `description`             | text             | no       |                                                 |
|            | `cuisine_type`            | varchar(100)     | no       |                                                 |
|            | `address`                 | varchar(500)     | yes      |                                                 |
|            | `city`                    | varchar(100)     | yes      | indexed, filterable                             |
|            | `rating`                  | numeric(4,3)     | no       | 0.0 – 5.0                                       |
|            | `status`                  | varchar(20)      | no       | `active` / `inactive` / `suspended`             |
|            | `phone`, `email`          | varchar(255)     | no       | unique                                          |
|            | `created_at` / `updated_at` | timestamptz    | auto     | UTC                                             |
| menu_item  | `id`                      | uuid (PK)        | auto     | UUID v4                                         |
|            | `restaurant_id`           | uuid (FK)        | yes      | → restaurant (RESTRICT)                         |
|            | `name`                    | varchar(255)     | yes      | unique per restaurant                           |
|            | `description`             | text             | no       |                                                 |
|            | `price`                   | numeric(10,2)    | yes      | **kobo**, never float                           |
|            | `available`               | bool             | no       | default `true`                                  |
|            | `category`                | varchar(100)     | no       | filterable                                      |
|            | `preparation_time_minutes`| int              | no       | 10 – 40                                         |
| customer   | `id`                      | uuid (PK)        | auto     | UUID v4                                         |
|            | `email`                   | varchar(255)     | yes      | unique                                          |
|            | `phone`                   | varchar(20)      | no       |                                                 |
|            | `first_name` / `last_name`| varchar(100)     | no       |                                                 |
|            | `address`                 | varchar(500)     | no       |                                                 |
|            | `city`                    | varchar(100)     | no       | indexed, filterable                             |
|            | `status`                  | varchar(20)     | no       | `active` / `inactive`                           |
| order      | `id`                      | uuid (PK)        | auto     | UUID v4                                         |
|            | `customer_id`             | uuid (FK)        | yes      | → customer (RESTRICT: must exist to order)      |
|            | `restaurant_id`           | uuid (FK)        | yes      | → restaurant (RESTRICT; must be `active`)       |
|            | `status`                  | varchar(20)     | auto     | starts `pending`; see state machine below       |
|            | `total_amount`            | numeric(10,2)    | yes      | **kobo**; computed server-side, never from client|
|            | `delivery_address`        | varchar(500)     | yes      |                                                 |
|            | `delivery_city`           | varchar(100)    | no       | defaults to the customer's city                 |
|            | `delivered_at`            | timestamptz     | no       | set when status → `delivered`                   |
|            | `created_at` / `updated_at` | timestamptz   | auto     | `updated_at` changes on every PATCH             |
| order_item | `id`                      | uuid (PK)        | auto     | UUID v4                                         |
|            | `order_id`                | uuid (FK)        | yes      | → order (CASCADE on order delete)               |
|            | `menu_item_id`            | uuid (FK)        | yes      | → menu_item (RESTRICT)                          |
|            | `quantity`                | int              | yes      | ≥ 1                                             |
|            | `unit_price`              | numeric(10,2)    | yes      | snapshot of menu price at order time (kobo)     |
|            | `subtotal`                | numeric(10,2)    | yes      | quantity × unit_price (kobo)                    |

Order status state machine (enforced in code — illegal transitions return `409 CONFLICT`):

```
pending → confirmed → preparing → ready → out_for_delivery → delivered
    └────────────── cancellable from any state except delivered ──────┘
```

---

## Step 2 — Data

Realistic volume, generated in code — not a DB dump, no Mockaroo CSV.

- **350 restaurants**, **3,500 menu items** (10 each), **320 customers**, **2,100 orders**
  with ~4 order items each — ~6,300 rows.
- Names, addresses, phones and emails come from curated Nigerian buka/meal/name lists
  ("Chop & Cheers", "Suya Republic", "Jollof Junction", "Ofada Rice House"…), so the data
  reads like a real local platform.
- The seed script (`seed/main.go`) is **repeatable, idempotent, and byte-for-byte
  deterministic**: it truncates all rows and re-inserts the same dataset **every run — the
  same UUIDs, the same addresses, the same prices, the same fixed timestamps**. It is
  seeded by a SHA-256 keyed by entity + index for UUIDs and a fixed base time for
  timestamps. Running it twice never produces duplicates; a local seed and a production
  reseed are identical. The script is committed; the database is not.
- Prices are **kobo** — `"375000"` means ₦3,750. Ratings are `numeric(4,3)` so every card
  gets a unique value like `"4.93"`.

```bash
go run ./seed
# seeded 350 restaurants, 3500 menu items, 320 customers, 2100 orders
```

---

## Step 3 — API

Base path: **`/api/v1`**. All paths kebab-case, no trailing slashes. Every list endpoint
is paginated, filtered and sortable. Every response — success or error — uses the same
envelope on every endpoint.

### Endpoint index

| Method | Path                          | Description            |
|--------|-------------------------------|------------------------|
| GET    | `/api/v1/restaurants`         | list, paginated        |
| GET    | `/api/v1/restaurants/:id`     | one restaurant         |
| GET    | `/api/v1/restaurants/:id/menu`| nested resource        |
| GET    | `/api/v1/customers`           | list, paginated        |
| GET    | `/api/v1/customers/:id`       | one customer           |
| GET    | `/api/v1/orders`              | list, paginated        |
| GET    | `/api/v1/orders/:id`          | one order (with items) |
| POST   | `/api/v1/orders`              | create order           |
| PATCH  | `/api/v1/orders/:id`          | partial update (status)|
| DELETE | `/api/v1/orders/:id`          | remove order           |

### Query parameters (all list endpoints)

| Param    | Type   | Default | Notes                                                    |
|----------|--------|---------|----------------------------------------------------------|
| `limit`  | int    | 20      | min 1, **max 100 — clamped, never honoured above max**   |
| `page`   | int    | 1       | 1-based; offset derived as `(page-1)*limit`; ≤ 0 → 400   |
| `offset` | int    | 0       | raw offset; explicit `offset` wins over `page`; < 0 → 400|
| `sort`   | string | —       | field name; **unknown field → 400**                      |
| `order`  | string | `asc`   | `asc` or `desc`                                          |

Filters are AND'd across fields; multiple values for one field are OR'd. Both flat
(`?city=Lagos`) and bracket (`?filter[city]=Lagos`) syntaxes are accepted and unioned.
`rating_min` and the price filters are range filters (`>=`), not exact matches. Invalid
filter keys and empty values are ignored.

| Endpoint                | Filter fields                                        | Sortable fields            |
|-------------------------|------------------------------------------------------|----------------------------|
| `/restaurants`          | `city`, `cuisine`, `status`, `rating_min`            | `name`, `rating`, `created_at` |
| `/restaurants/:id/menu` | `category`, `available`, `min_price`, `max_price`    | `name`, `price`, `category` |
| `/customers`            | `city`, `status`                                     | `name`, `created_at`       |
| `/orders`               | `status`, `restaurant_id`, `customer_id`             | `created_at`, `total_amount`, `status` |

### Response envelope

**Success — list:**

```json
{
  "success": true,
  "data": [ { "id": "…", "name": "…" } ],
  "meta": { "total": 350, "limit": 20, "offset": 0, "hasMore": true, "timestamp": "2026-09-24T23:38:15Z" }
}
```

**Success — single resource:** same shape, `data` is one object, `meta` is just the
timestamp.

**Error — every endpoint, every status:**

```json
{
  "success": false,
  "data": null,
  "error": { "code": "INVALID_QUERY", "message": "invalid offset: \"-5\" (must be a non-negative integer)" },
  "meta": { "timestamp": "2026-09-24T23:38:37Z", "request_id": "34f4b10a-caf5-4429-9002-287cc4af8adc" }
}
```

Every error carries a `request_id` for tracing and never leaks internals.

### Error codes

| Code                | HTTP | Used for                                              |
|---------------------|------|-------------------------------------------------------|
| `INVALID_REQUEST`   | 400  | malformed identifier, malformed UUID, malformed JSON  |
| `INVALID_QUERY`     | 400  | bad `limit`/`page`/`offset`/`sort`/`order`            |
| `VALIDATION_ERROR`  | 422  | missing/invalid body fields (names the field(s))      |
| `RESOURCE_NOT_FOUND`| 404  | resource with given ID does not exist                 |
| `CONFLICT`          | 409  | inactive restaurant, wrong/unavailable item, illegal status transition |
| `RATE_LIMITED`      | 429  | rate limit exceeded (with `Retry-After` header)       |
| `INTERNAL_ERROR`    | 500  | unexpected server error (never leaks details)         |

---

### Endpoint documentation with curl examples

All responses below are **real output from the live API** (verified against the deployed
instance). Because the seed is deterministic, the same ids resolve on any seeded copy. The
only part that changes is the timestamp in `meta` (and the order id after a `POST`). Prices
are kobo: `"375000"` = ₦3,750.

---

#### `GET /restaurants` — list restaurants

Query params: `limit`, `page`, `offset`, `sort` (`name`/`rating`/`created_at`),
`order` (`asc`/`desc`); filters `city`, `cuisine`, `status`, `rating_min`.

```bash
curl "https://api-production-a74d.up.railway.app/api/v1/restaurants?limit=2&city=Lagos&sort=rating&order=desc"
```

Response (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "2eafc64b-1f35-4465-b225-8ddab1b666b0",
      "name": "Pepper Soup Inn 44",
      "description": "Family-run buka serving Yoruba cuisine.",
      "cuisine_type": "Continental",
      "address": "471, Surulere",
      "city": "Lagos",
      "rating": "4.94",
      "status": "inactive",
      "phone": "+234899722886",
      "email": "hello43@peppersoupinn44.ng",
      "created_at": "2026-09-11T17:00:00Z",
      "updated_at": "2026-09-11T17:00:00Z"
    },
    {
      "id": "cecea780-878f-40f8-b739-802ff550e115",
      "name": "Iya Metro Soup 41",
      "description": "Family-run buka serving Fast Food cuisine.",
      "cuisine_type": "Hausa",
      "address": "147, Lekki Phase 1",
      "city": "Lagos",
      "rating": "4.93",
      "status": "active",
      "phone": "+234876419440",
      "email": "hello40@iyametrosoup41.ng",
      "created_at": "2026-09-11T14:00:00Z",
      "updated_at": "2026-09-11T14:00:00Z"
    }
  ],
  "meta": { "total": 65, "limit": 2, "offset": 0, "hasMore": true, "timestamp": "2026-09-24T23:38:15Z" }
}
```

Note `total: 65` — the honest count for `city=Lagos`, not the row 350 of the whole table.

---

#### `GET /restaurants/:id` — one restaurant

No query parameters. An invalid (non-UUID) id → `400 INVALID_REQUEST`; a valid-but-missing
uuid → `404 RESOURCE_NOT_FOUND`.

```bash
curl "https://api-production-a74d.up.railway.app/api/v1/restaurants/809990a9-dfb9-4e72-86f9-7f19df8b503f"
```

Response (200):

```json
{
  "success": true,
  "data": {
    "id": "809990a9-dfb9-4e72-86f9-7f19df8b503f",
    "name": "Chop & Cheers 1",
    "description": "Family-run buka serving Hausa cuisine.",
    "cuisine_type": "Continental",
    "address": "381, Wuse",
    "city": "Abuja",
    "rating": "4.69",
    "status": "active",
    "phone": "+234827619258",
    "email": "hello0@chopcheers1.ng",
    "created_at": "2026-09-09T22:00:00Z",
    "updated_at": "2026-09-09T22:00:00Z"
  },
  "meta": { "timestamp": "2026-09-24T23:38:15Z" }
}
```

---

#### `GET /restaurants/:id/menu` — nested resource (menu of one restaurant)

Query params: `limit`, `page`, `offset`, `sort` (`name`/`price`/`category`), `order`;
filters `category`, `available`, `min_price`, `max_price`. The restaurant id must exist,
else `404`.

```bash
curl "https://api-production-a74d.up.railway.app/api/v1/restaurants/809990a9-dfb9-4e72-86f9-7f19df8b503f/menu?available=true&sort=price&order=desc&limit=2"
```

Response (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "1745f1eb-afe0-4665-a3f0-7a1e092f999c",
      "restaurant_id": "809990a9-dfb9-4e72-86f9-7f19df8b503f",
      "name": "Ofada Rice with Ayamase (Chop & Cheer 3)",
      "description": "Locally grown ofada rice in fiery green pepper ayamase.",
      "price": "695000",
      "available": true,
      "category": "Rice & Stews",
      "preparation_time_minutes": 25,
      "created_at": "2026-09-24T12:00:00Z",
      "updated_at": "2026-09-24T12:00:00Z"
    },
    {
      "id": "71261e8f-cb0b-463c-a8ee-24c80a809212",
      "restaurant_id": "809990a9-dfb9-4e72-86f9-7f19df8b503f",
      "name": "Efo Riro (Chop & Cheer 4)",
      "description": "Rich tomato and pepper stew with spinach, stockfish and locust beans.",
      "price": "680000",
      "available": true,
      "category": "Swallow & Soups",
      "preparation_time_minutes": 13,
      "created_at": "2026-09-24T12:00:00Z",
      "updated_at": "2026-09-24T12:00:00Z"
    }
  ],
  "meta": { "total": 10, "limit": 2, "offset": 0, "hasMore": true, "timestamp": "2026-09-24T23:38:16Z" }
}
```

`"695000"` = ₦6,950. Every menu item here belongs to "Chop & Cheers 1" and no other
restaurant.

---

#### `GET /customers` — list customers

Query params: `limit`, `page`, `offset`, `sort` (`name`/`created_at`), `order`;
filters `city`, `status`.

```bash
curl "https://api-production-a74d.up.railway.app/api/v1/customers?city=Benin+City&limit=2"
```

Response (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "36d98083-0cf1-473a-8e16-d85fdb9286a3",
      "email": "yetunde.emeka319@example.com",
      "phone": "+234935542437",
      "first_name": "Yetunde",
      "last_name": "Emeka",
      "address": "731, Ugbowo",
      "city": "Benin City",
      "status": "inactive",
      "created_at": "2026-09-24T11:00:00Z",
      "updated_at": "2026-09-24T11:00:00Z"
    },
    {
      "id": "db6e1f0f-a90a-4e59-b546-590c41a6f998",
      "email": "chiamaka.uche315@example.com",
      "phone": "+234932724374",
      "first_name": "Chiamaka",
      "last_name": "Uche",
      "address": "576, Ekiosa",
      "city": "Benin City",
      "status": "active",
      "created_at": "2026-09-24T07:00:00Z",
      "updated_at": "2026-09-24T07:00:00Z"
    }
  ],
  "meta": { "total": 55, "limit": 2, "offset": 0, "hasMore": true, "timestamp": "2026-09-24T23:38:17Z" }
}
```

---

#### `GET /customers/:id` — one customer

```bash
curl "https://api-production-a74d.up.railway.app/api/v1/customers/db6e1f0f-a90a-4e59-b546-590c41a6f998"
```

Response (200): `data` is the single customer object (same shape as a list item above),
`meta` is the timestamp only. Invalid uuid → `400`; missing → `404`.

---

#### `GET /orders` — list orders

Query params: `limit`, `page`, `offset`, `sort` (`created_at`/`total_amount`/`status`),
`order`; filters `status`, `restaurant_id`, `customer_id`. Each order embeds its `items`.

```bash
curl "https://api-production-a74d.up.railway.app/api/v1/orders?customer_id=db6e1f0f-a90a-4e59-b546-590c41a6f998&status=pending&limit=1"
```

Response (200):

```json
{
  "success": true,
  "data": [
    {
      "id": "873854b7-7098-4413-8ccc-c95e115c8045",
      "customer_id": "db6e1f0f-a90a-4e59-b546-590c41a6f998",
      "restaurant_id": "f9c43583-1e9f-4767-8ccd-d01db11bace5",
      "status": "pending",
      "total_amount": "4960000",
      "delivery_address": "576, Ekiosa",
      "delivery_city": "Benin City",
      "created_at": "2026-09-23T20:28:00Z",
      "updated_at": "2026-09-23T20:28:00Z",
      "items": [
        { "id": "576bf574-f5ff-478c-8b98-2536ce10743d", "order_id": "873854b7-7098-4413-8ccc-c95e115c8045", "menu_item_id": "50e6e4f2-d3fd-464b-b207-347e120809ac", "quantity": 1, "unit_price": "515000", "subtotal": "515000", "created_at": "2026-09-23T20:28:00Z" },
        { "id": "6480647b-add9-455e-9b61-74e3862435e8", "order_id": "873854b7-7098-4413-8ccc-c95e115c8045", "menu_item_id": "ad707ecc-2317-4af0-88b3-cf1711328209", "quantity": 1, "unit_price": "635000", "subtotal": "635000", "created_at": "2026-09-23T20:28:00Z" },
        { "id": "e70a8bb4-03dd-48ac-9ecb-3780c6135eb3", "order_id": "873854b7-7098-4413-8ccc-c95e115c8045", "menu_item_id": "ad707ecc-2317-4af0-88b3-cf1711328209", "quantity": 3, "unit_price": "635000", "subtotal": "1905000", "created_at": "2026-09-23T20:28:00Z" },
        { "id": "2d598ba2-192d-4686-a886-b5192873dee9", "order_id": "873854b7-7098-4413-8ccc-c95e115c8045", "menu_item_id": "ad707ecc-2317-4af0-88b3-cf1711328209", "quantity": 3, "unit_price": "635000", "subtotal": "1905000", "created_at": "2026-09-23T20:28:00Z" }
      ]
    }
  ],
  "meta": { "total": 1, "limit": 1, "offset": 0, "hasMore": false, "timestamp": "2026-09-24T23:43:57Z" }
}
```

This is a **seeded** order, so the same id, items and totals appear on any fresh seed
(local or production) — the filters (`customer_id` + `status`) narrow 2,100 orders to this
one, and `meta.total: 1` reflects that.

---

#### `GET /orders/:id` — one order (with items)

```bash
curl "https://api-production-a74d.up.railway.app/api/v1/orders/873854b7-7098-4413-8ccc-c95e115c8045"
```

Response (200): `data` is the single order object exactly as shown in the list item above,
including its full `items` array. Invalid uuid → `400`; missing → `404`.

---

#### `POST /orders` — create an order

Body requires: `customer_id`, `restaurant_id`, `delivery_address`, `items[]` (each with
`menu_item_id` and `quantity ≥ 1`). `delivery_city` is optional — it **defaults to the
customer's city**. All fields validated in one place; missing required field →
`422 VALIDATION_ERROR` naming the field.

Business rules enforced server-side:
- customer must exist
- restaurant must be `active`
- all items must belong to that restaurant and be `available`
- `total_amount` is **computed server-side** (Σ quantity × unit_price snapshot) — never accepted from the client

```bash
curl -X POST "https://api-production-a74d.up.railway.app/api/v1/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "db6e1f0f-a90a-4e59-b546-590c41a6f998",
    "restaurant_id": "809990a9-dfb9-4e72-86f9-7f19df8b503f",
    "delivery_address": "12 Marina Road, Lagos",
    "items": [
      { "menu_item_id": "aa08f7cb-7e4e-42b9-a206-9f885d6f5aa4", "quantity": 2 },
      { "menu_item_id": "3e7daca7-e00f-408a-b5a7-dd8b91f46f30", "quantity": 1 }
    ]
  }'
```

Response (201) — note `status: "pending"`, the server-computed `total_amount` (2×
375000 + 395000 = 1 145 000 kobo = ₦11,450), and `delivery_city` defaulted to the
customer's city even though the restaurant is in Abuja:

```json
{
  "success": true,
  "data": {
    "id": "cd81b380-595b-4fb8-9388-61a64c83e09d",
    "customer_id": "db6e1f0f-a90a-4e59-b546-590c41a6f998",
    "restaurant_id": "809990a9-dfb9-4e72-86f9-7f19df8b503f",
    "status": "pending",
    "total_amount": "1145000",
    "delivery_address": "12 Marina Road, Lagos",
    "delivery_city": "Benin City",
    "delivered_at": null,
    "created_at": "2026-09-25T02:32:03.811461Z",
    "updated_at": "2026-09-25T02:32:03.811461Z",
    "items": [
      { "id": "1aa402e1-6b5a-46b2-aa46-6cf23ba61e0c", "order_id": "cd81b380-595b-4fb8-9388-61a64c83e09d", "menu_item_id": "aa08f7cb-7e4e-42b9-a206-9f885d6f5aa4", "quantity": 2, "unit_price": "375000", "subtotal": "750000", "created_at": "2026-09-25T02:32:03.811461Z" },
      { "id": "636fc9a9-1ce7-4c78-bf21-a078d1e64c26", "order_id": "cd81b380-595b-4fb8-9388-61a64c83e09d", "menu_item_id": "3e7daca7-e00f-408a-b5a7-dd8b91f46f30", "quantity": 1, "unit_price": "395000", "subtotal": "395000", "created_at": "2026-09-25T02:32:03.811461Z" }
    ]
  },
  "meta": { "timestamp": "2026-09-25T02:32:03Z" }
}
```

The order id is random (UUID v4) — substitute the one you get back into the PATCH/DELETE
guides below.

---

#### `PATCH /orders/:id` — partial update (status)

Accepts a partial body. The supported mutation is `{ "status": "<next state>" }`. The order
must make a legal transition (`pending → confirmed → preparing → ready → out_for_delivery →
delivered`; cancellable from any state except `delivered`) — an illegal transition returns
`409 CONFLICT`. Not found → `404`.

```bash
curl -X PATCH "https://api-production-a74d.up.railway.app/api/v1/orders/cd81b380-595b-4fb8-9388-61a64c83e09d" \
  -H "Content-Type: application/json" \
  -d '{ "status": "confirmed" }'
```

Response (200): `data` is the updated order with `status: "confirmed"` and a refreshed
`updated_at`:

```json
{
  "success": true,
  "data": {
    "id": "cd81b380-595b-4fb8-9388-61a64c83e09d",
    "customer_id": "db6e1f0f-a90a-4e59-b546-590c41a6f998",
    "restaurant_id": "809990a9-dfb9-4e72-86f9-7f19df8b503f",
    "status": "confirmed",
    "total_amount": "1145000",
    "delivery_address": "12 Marina Road, Lagos",
    "delivery_city": "Benin City",
    "delivered_at": null,
    "created_at": "2026-09-25T02:32:03.811461Z",
    "updated_at": "2026-09-25T02:32:10.123456Z",
    "items": [
      { "id": "1aa402e1-6b5a-46b2-aa46-6cf23ba61e0c", "order_id": "cd81b380-595b-4fb8-9388-61a64c83e09d", "menu_item_id": "aa08f7cb-7e4e-42b9-a206-9f885d6f5aa4", "quantity": 2, "unit_price": "375000", "subtotal": "750000", "created_at": "2026-09-25T02:32:03.811461Z" },
      { "id": "636fc9a9-1ce7-4c78-bf21-a078d1e64c26", "order_id": "cd81b380-595b-4fb8-9388-61a64c83e09d", "menu_item_id": "3e7daca7-e00f-408a-b5a7-dd8b91f46f30", "quantity": 1, "unit_price": "395000", "subtotal": "395000", "created_at": "2026-09-25T02:32:03.811461Z" }
    ]
  },
  "meta": { "timestamp": "2026-09-25T02:32:10Z" }
}
```

Example illegal transition (`delivered` → anything) → `409`:

```bash
curl -i -X PATCH "https://api-production-a74d.up.railway.app/api/v1/orders/873854b7-7098-4413-8ccc-c95e115c8045" \
  -H "Content-Type: application/json" \
  -d '{ "status": "preparing" }'
```

---

#### `DELETE /orders/:id` — remove an order

Order items are deleted by cascade. Not found → `404`. The response echoes the deleted
order's id (not `true`).

```bash
curl -X DELETE "https://api-production-a74d.up.railway.app/api/v1/orders/cd81b380-595b-4fb8-9388-61a64c83e09d"
```

Response (200):

```json
{
  "success": true,
  "data": { "deleted": "cd81b380-595b-4fb8-9388-61a64c83e09d" },
  "meta": { "timestamp": "2026-09-25T02:32:12Z" }
}
```

---

## Step 4 — Ugly inputs handled on purpose

These are **all verified against the live API** (not just the code):

| Request                                             | Result |
|-----------------------------------------------------|--------|
| `GET /restaurants?limit=5000`                       | 200, `meta.limit` **clamped to 100**, never a 500 |
| `GET /restaurants?offset=-5`                        | 400 `INVALID_QUERY`, message names the bad value |
| `GET /restaurants?sort=bogus`                       | 400 `INVALID_QUERY`, message lists allowed fields |
| `GET /restaurants/not-a-uuid`                       | 400 `INVALID_REQUEST` |
| `GET /restaurants/<valid-but-missing-uuid>`         | 404 `RESOURCE_NOT_FOUND` |
| `POST /orders` (empty body / missing `customer_id`) | 422 `VALIDATION_ERROR`, names the missing field(s) |
| >150 req/min from one IP                            | 429 `RATE_LIMITED` with `Retry-After` header |

Request bodies and query parameters are validated in one place via `go-playground/validator`,
so the same rules apply on every endpoint.

---

## Step 5 — Rate limiting

Unauthenticated public APIs get abused within hours. The API rate-limits **per client IP**
with a token bucket:

- **100 requests/minute**, burst **150** (config defaults).
- Over-limit requests get **HTTP 429** and a **`Retry-After`** header (seconds to wait).
- Allowed responses include `X-RateLimit-Remaining`.
- **The numbers live in configuration**, not in handlers:
  `RATE_LIMIT_LIMIT`, `RATE_LIMIT_BURST`, `RATE_LIMIT_ENABLED`
  (`internal/config/config.go`, env-overridable). Ops can tighten or loosen policy without a
  code review.

A 200-request parallel burst against the live API produced `153 × 200` and `47 × 429` with
`Retry-After: 1` — the cap holds.

---

## Step 6 — This document

This README is the API documentation. Method, path, query parameters with types and
defaults, a runnable curl example and a real response for every endpoint are in Step 3.
Design decisions are in the dedicated section below.

## Step 7 — Deployment (Railway)

Deployed via a 3-stage Dockerfile (`node:22` builds the consumer → `golang:1.27` builds the
API + seed binaries → `alpine:3.20` runtime serving the API **and** the built consumer on
`:8000`). PostgreSQL is provisioned on Railway and configured via `DATABASE_URL`.

**Seeding production (important):** the seed binary is built into the image but the runtime
command runs the API only — that is deliberate, because the seed **truncates** the tables and
must never run on every deploy. You seed production **once**:

```
# from the container/project with DATABASE_URL set to the Railway Postgres
./fooddelivery-seed
# seeded 350 restaurants, 3500 menu items, 320 customers, 2100 orders
```

Because the seed is byte-for-byte deterministic, this production seed produces **exactly the
same UUIDs, prices and timestamps** as the local `go run ./seed` — so every curl in Step 3
returns identical data from `localhost` or the live URL.

The live instance was seeded this way — `GET /api/v1/restaurants?limit=1` returns
`"total": 350`, so the public API is never empty.

Required environment variables (see `.env.example`): `DATABASE_URL`, `PORT`, and the
optional `RATE_LIMIT_*` / `PAGINATION_*` / `CORS_ORIGINS` overrides. Nothing secret is
committed — `.env` is gitignored and only `.env.example` is tracked.

## Step 8 — Consumer

A React + Vite app ("Buka Finder") that consumes the live API and proves pagination,
filtering and sorting work together from outside:

- restaurant list (20 per page) fetched from the **live** URL
- city filter (header dropdown), cuisine chips, "open now" toggle
- sort (newest / top rated / name A–Z)
- page controls with total counts and empty/error states
- a live order-tracking drawer (map + progress rail) that reflects the order status
  returned by the API — `pending → confirmed → preparing → ready → out_for_delivery →
  delivered`, showing "On the way" only once the courier is actually on the move

It calls the API same-origin (`/api/v1`), served by the API binary itself, so the deployed
consumer at `https://api-production-a74d.up.railway.app/` talks to
`https://api-production-a74d.up.railway.app/api/v1/...` — the public URL, never localhost.
To point a separately hosted build at the API, set `VITE_API_URL` (see
`frontend/.env.example`).

---

## Design decisions

**Why these resources.** Restaurants, menu items, customers, orders and order items are the
five nouns a food platform actually stores, and they give every relationship type we want to
prove: one-to-many (restaurant → menu, order → order items) and two separate owners of an
order (customer places it, restaurant fulfils it). Three resources reference each other,
which is the minimum the task demands, and the nested `/restaurants/:id/menu` path exercises
a sub-resource route.

**Why generated (UUID) identifiers.** Sequential integer ids let anyone enumerate the whole
dataset by counting — `/restaurants/1`, `/restaurants/2` … walk to the end. A v4 UUID is
unguessable and carries no ordering information, so a client cannot infer existence or volume
from ids. UUIDs are the professional default and cost nothing in PostgreSQL.

**Why money as kobo (minor units), never float.** Prices and totals are the one field where
a silent rounding error is a financial bug. Floats cannot represent naira/kobo exactly
(`0.1 + 0.2 ≠ 0.3`), so `price`, `unit_price`, `subtotal` and `total_amount` are `DECIMAL`
columns that store **whole kobo** (₦3,750 → `375000`). The API returns them as strings with
the full precision. The consumer divides by 100 only for display (`naira()`), so money is
never rounded in transit and never floats in storage. This is the same pattern payment
providers use for minor units.

**Why a deterministic seed.** A seeded dataset that changes on every run makes docs,
screenshots and tests stale within minutes. This seed derives every UUID from a SHA-256 of
`(entity kind, base id, index)` and every timestamp from a fixed base time, so any two seeds
on any machine produce byte-identical rows. `go run ./seed` locally and `./fooddelivery-seed`
on production give the same ids — the curl examples in this README work unchanged against
both.

**Why offset pagination (and when I'd use a cursor).** Offset pagination is simple, stable
and works everywhere; `meta.offset + meta.limit < meta.total` answers "is there a next page"
in one expression. I chose it because the dataset is bounded (hundreds of thousands, not
billions) and clients can deep-page (`offset=0, 20, 40…`), which cursors make awkward. The
public interface is page-based (`?page=N` → `offset=(N-1)*limit`) with raw `?offset=` still
supported for power clients; both land in the same `meta.offset`.
**Tradeoff:** as offset grows, PostgreSQL still scans and discards skipped rows, and rows
inserted/deleted between requests can shift pages. **I'd switch to cursor pagination** (e.g.
an opaque token built from `(created_at, id)`) at high millions of rows or when clients page
deeper than ~10k rows, because it turns `OFFSET n` scans into index seeks and is immune to
concurrent writes.

**What happens on page 50 of a 30-page resource** (`offset=1000` of 350 rows): `200` with
`data: []` and the honest `meta.total` — not a 404 and not an error. Empty pages are a valid
result; the envelope never lies.

**What happens when someone asks for 5000 records** (`limit=5000`): clamped to the configured
max (`100`) and reported back in `meta.limit`, so the client can see the real limit. Never
honour a limit above max, never error on it, never return the whole collection when no limit
is supplied (the default is 20).

**Why this envelope.** `{ data, meta }` on success and `{ data: null, error }` on failure is
one shape for each, identical on every endpoint — never 200-with-a-message-in-the-body, never
two different success shapes. `meta` carries the pagination facts (and a `request_id` on
errors) next to the data they describe. The consumer parses `body.data` / `body.error` the
same way for every call.

**Why rate limiting lives in a config file, not a handler.** The handler's job is to serve
data; the rate-limit policy is an operational number ops changes without a code review. It is
env-overridable in `internal/config` and applied as middleware before any handler runs, so no
handler can forget it.

**Room for a v2.** The `/v1/` prefix means `/api/v2` can ship tomorrow (say, cursor
pagination or a new field on restaurants) without breaking any existing v1 client. Versioning
exists from the first commit, so renaming `/orders` never breaks anyone.

---

## Quick start (local)

### Prerequisites

- Go 1.24+ · PostgreSQL (local or managed) · Node.js 20+ (consumer, optional at runtime)

### 1. Configure the environment

```bash
export DATABASE_URL="postgres://postgres:postgres@localhost:5432/fooddelivery?sslmode=disable"
export PORT=8000
```

### 2. Seed the database (repeatable, idempotent, deterministic)

```bash
go run ./seed
# seeded 350 restaurants, 3500 menu items, 320 customers, 2100 orders
```

### 3. Run the API

```bash
go run ./cmd/api
# food delivery API running on :8000
```

### 4. Run the consumer (optional, dev mode)

```bash
cd frontend
npm install
npm run build   # or: npm run dev  (Vite proxies /api/v1 → :8000)
```

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
seed/main.go           # repeatable deterministic seed (~6,300 rows)
frontend/              # React + Vite consumer (list + filters + tracking)
Dockerfile             # 3-stage build; serves API + consumer on :8000
```

---

## Task 1 requirement checklist

| Requirement | Status |
|-------------|--------|
| 3+ related resources | ✅ 5 resources, real FK relationships |
| Repeatable seed, few hundred records/resource | ✅ 350 · 3,500 · 320 · 2,100; deterministic UUIDs + timestamps |
| Versioned paths `/api/v1/` | ✅ |
| Pagination on every list | ✅ `limit` (clamped max 100), `page`/`offset`, `total` + `hasMore` |
| Filtering (≥2 fields per list) | ✅ e.g. `city`, `cuisine`, `category`, `min_price`, `status` |
| Sorting with `sort` + `order` | ✅ on every list endpoint; unknown field → 400 |
| Consistent response & error envelopes | ✅ `data`/`meta` + `data:null`/`error` everywhere |
| Honest status codes 400/404/422/429 | ✅ verified on the live API |
| Rate limiting in config | ✅ `RATE_LIMIT_*` env vars, `Retry-After` header |
| Full docs with curl + response examples | ✅ this README (Step 3) — responses are real API output |
| Live public URL | ✅ `https://api-production-a74d.up.railway.app` |
| Consumer calls the live URL | ✅ same-origin at the live URL, verified `200 text/html` at `/` |
| Seed run against production | ✅ live `total: 350` confirmed |

**Evidence:** live API verified above (curl output in Step 3/4 is real); `429` burst
produced the rate-limit envelope; consumer renders the live data at the deployed root URL.