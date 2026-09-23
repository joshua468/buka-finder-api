# Food Delivery API — Project Rules & Standards

These rules are non-negotiable for all work in this repo. Follow them on every change. When in doubt, escalate per the roles in `.opencode/agent/`.

## Core Constraints (Non-Negotiable)

1. All endpoints prefixed with `/api/v1/`
2. PostgreSQL as single source of truth — no denormalization without API Architect approval
3. Generated IDs — UUID v4 for all resources
4. 300+ production-like records per major resource (tested in CI)
5. Repeatable seed script (deterministic, idempotent)
6. Public deployment (staging + production environments)
7. Pagination on all list endpoints (mandatory, no exceptions)

## API Design Rules

### Naming Conventions
```
GET    /api/v1/restaurants              # List resources
GET    /api/v1/restaurants/{id}         # Get single resource
POST   /api/v1/restaurants              # Create resource
PATCH  /api/v1/restaurants/{id}         # Partial update
DELETE /api/v1/restaurants/{id}         # Delete resource
GET    /api/v1/restaurants/{id}/menu    # Sub-resources (nested path max 2 levels)
```

Rules:
- kebab-case for endpoint paths
- snake_case for query parameters and JSON fields
- HTTPS only (HTTP forbidden in production)
- No trailing slashes

### Response Envelope

**Success (2xx):**
```json
{
  "success": true,
  "data": { "id": "uuid", "name": "Restaurant Name", "created_at": "...", "updated_at": "..." },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

**List:**
```json
{
  "success": true,
  "data": [ { "id": "uuid", "name": "..." } ],
  "pagination": { "page": 1, "limit": 20, "total": 156, "total_pages": 8, "has_next": true, "has_prev": false },
  "meta": { "timestamp": "2024-01-15T10:30:00Z" }
}
```

**Error (4xx/5xx):** `success: false`, `error: { code, message, details? }`, `meta: { timestamp, request_id }`

### Error Codes

| Code | HTTP | Scenario |
|------|------|----------|
| `INVALID_REQUEST` | 400 | Malformed JSON, missing required fields |
| `VALIDATION_ERROR` | 400 | Business logic validation failed |
| `RESOURCE_NOT_FOUND` | 404 | Resource with ID doesn't exist |
| `CONFLICT` | 409 | Duplicate unique constraint, state conflict |
| `RATE_LIMITED` | 429 | Rate limit exceeded |
| `AUTHENTICATION_FAILED` | 401 | Invalid/missing API key (future) |
| `AUTHORIZATION_FAILED` | 403 | User lacks permission |
| `INTERNAL_ERROR` | 500 | Unhandled server error |
| `SERVICE_UNAVAILABLE` | 503 | Database/external service down |

### Pagination, Filtering, Sorting

- Pagination params: `?page=1&limit=20` (default limit 20, min 1, max 100; default page 1). Offset+limit internally, page-based externally. Always return `total`. Empty result set → 200 with empty array, never 404.
- Filters: `filter[field]=value&filter[field]=v1,v2`. Filters are AND'd; multiple values for one field are OR'd. Invalid keys and empty values ignored.
- Sorting: `sort=field:asc&sort=field2:desc`. Default `-created_at`. Allowed keys: `id, name, created_at, updated_at, price, status`. Invalid keys ignored (use default).

## Data Modeling

- Timestamps: UTC, ISO 8601 in responses, `TIMESTAMP DEFAULT NOW()` stored, `updated_at` maintained on change.
- Money: `DECIMAL(10,2)`, never float.
- Status: CHECK constraints listing valid values.
- Foreign keys: CASCADE (cleanup) or RESTRICT (integrity) — never plain.
- Indexes on frequently filtered/joined columns (status, dates, foreign keys).
- Every schema change requires a migration file (`migrations/NNN_description.sql`, sequential, reversible with DOWN). Never modify applied migrations — create a new one.
- No soft deletes — hard delete with cascades.
- Business keys unique: restaurant name, phone, email; item name per restaurant; customer email.

## Backend Code Rules

Validation order: input format → required fields → field constraints → business logic → state transitions. Always validate UUID, email, phone (if present), price/quantity ranges, address (required, ≤ 500 chars). Validation errors use `VALIDATION_ERROR` with field/constraint details.

**Business rules to enforce:**
- Orders: customer must exist; restaurant must be `active`; all items from one restaurant; items must be `available`; total must match sum of items; delivery address required.
- Status transitions: `pending → confirmed → preparing → ready → out_for_delivery → delivered`, cancellable from any state except `delivered`; cancellations update `updated_at` and set status `cancelled`.

Language/framework: pick one (Python/FastAPI or TypeScript/Express) and stay consistent. Lint with zero warnings. Tests: minimum 80% coverage (services, utilities). Commit messages: Conventional Commits.

## Security (Mandatory)

- HTTPS only in production; CORS allowed list only (never `*`).
- Validate all external input; parameterized queries; never store/return unsanitized input.
- Rate limiting on all endpoints (Tier 1: 100 req/min/IP, burst 150; headers `X-RateLimit-Limit/-Remaining/-Reset`).
- Never log passwords, API keys, tokens, or PII. Secrets via env/secrets manager only — no hardcoded config. Rotate DB passwords quarterly.
- Never expose database errors to clients — log and return generic 500 with `request_id`.

## Testing & Deployment

- Integration tests per endpoint: happy path, 400, 404, 409 (if applicable), 429, 403 (if applicable).
- Load test before production: 1000 concurrent, 99% < 2s, 0% errors.
- Staging before production; approval from Product + Release Manager; rollback ready for 10 min; 30-min post-deploy monitoring window.
- QA approves staging/production; QA rejects builds failing integration tests.

## Non-Negotiable Deadlines

- No production deployment without passing tests
- No schema changes without a migration file
- No endpoints without integration tests
- No merging without 2+ code reviews
- No logging credentials, API keys, or personal data
- No HTTP in production
- No hardcoded secrets or configuration
