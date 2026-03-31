# EventFlow — Realtime Event Processing Platform

A production-style event ingestion and processing pipeline. Events come in through an authenticated REST API, get queued in Redis via BullMQ, are processed by workers with retry/backoff logic, and results are persisted to PostgreSQL. A React dashboard shows live event status.

```
POST /events  →  Redis Queue  →  Worker  →  PostgreSQL
                                    ↓
                              Dashboard polls /events
```

---

## Architecture

```
eventflow/
├── api/            Express API — ingestion, auth, rate limiting
│   └── src/
│       ├── config/         DB + Redis + Queue clients
│       ├── controllers/    Request handlers
│       ├── middleware/     Auth, rate limiting, error handling
│       ├── routes/         Route definitions
│       └── services/       Business logic (EventService)
├── worker/         BullMQ worker — processes queued jobs
│   └── src/
│       ├── config/         Redis + DB config
│       └── processors/     Event processor registry + handlers
├── dashboard/      Vite + React — event viewer
│   └── src/
│       ├── components/     UI components
│       ├── hooks/          Data fetching hooks with polling
│       └── lib/            API client
├── shared/         Shared TypeScript types + logger
├── prisma/         Database schema + migrations + seed
└── docker-compose.yml
```

### Services

| Service   | Port | Description                          |
|-----------|------|--------------------------------------|
| API       | 3000 | Event ingestion + REST API           |
| Dashboard | 5173 | React UI (served via nginx in prod)  |
| PostgreSQL| 5432 | Event storage                        |
| Redis     | 6379 | Job queue (BullMQ)                   |
| Worker    | —    | Background job processor             |

---

## How to Run This Project

### Prerequisites

- Docker + Docker Compose
- `make` (optional but convenient)
- `curl` or any HTTP client for testing

### 1 — Clone and configure

```bash
git clone <repo>
cd eventflow
cp .env.example .env
# Edit .env if needed (defaults work for local dev)
```

### 2 — Start all services

```bash
# With Make:
make up

# Without Make:
docker compose up --build -d
```

This starts: PostgreSQL, Redis, API, Worker, and Dashboard.

Wait ~15 seconds for PostgreSQL to initialize and Prisma migrations to run.

### 3 — Verify everything is healthy

```bash
curl http://localhost:3000/health
# {"status":"ok","checks":{"database":"ok","redis":"ok"}}
```

### 4 — Send your first event

```bash
curl -X POST http://localhost:3000/events \
  -H "Authorization: Bearer dev_key_123" \
  -H "Content-Type: application/json" \
  -d '{"type":"user.signup","payload":{"email":"test@example.com","userId":"usr_123"}}'
```

Response:
```json
{
  "id": "uuid-here",
  "jobId": "uuid-here",
  "status": "QUEUED",
  "message": "Event accepted and queued for processing."
}
```

### 5 — Open the dashboard

→ http://localhost:5173

Events appear immediately and auto-refresh every 5 seconds.

### 6 — Seed sample data (optional)

```bash
make seed
# Or: docker compose exec api npx tsx ../prisma/seed.ts
```

### 7 — Send a batch of test events

```bash
make test-events
```

### 8 — Check metrics

```bash
make metrics
# Or:
curl http://localhost:3000/events/metrics \
  -H "Authorization: Bearer dev_key_123"
```

### Useful commands

```bash
make logs            # All service logs
make logs-api        # API logs only
make logs-worker     # Worker logs only
make list-events     # Show latest 5 events
make test-rate-limit # Trigger rate limiting (sends 110 requests)
make down            # Stop services
make down-v          # Stop services + delete volumes
```

---

## API Reference

All routes require: `Authorization: Bearer <api-key>`

### POST /events

Ingest a new event.

```bash
curl -X POST http://localhost:3000/events \
  -H "Authorization: Bearer dev_key_123" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "order.created",
    "payload": {
      "orderId": "ord_abc",
      "amount": 99.99,
      "currency": "USD"
    }
  }'
```

**Validation rules:**
- `type`: required, alphanumeric + `.` `_` `:` `-`, max 128 chars
- `payload`: JSON object, max 512KB
- `source`: optional string, max 64 chars

**Response 202:**
```json
{ "id": "...", "jobId": "...", "status": "QUEUED" }
```

### GET /events

List events with filtering and pagination.

```
GET /events?page=1&pageSize=20&status=FAILED&type=user.signup
```

### GET /events/:id

Get a single event by ID.

### POST /events/:id/retry

Manually retry a `FAILED` or `DEAD_LETTERED` event.

### GET /events/metrics

Get aggregated counts by status + success rate.

### GET /health

Health check for DB and Redis.

---

## Event Processing

### Supported event types (type-specific processors)

| Type                | Behaviour                                        |
|---------------------|--------------------------------------------------|
| `user.signup`       | Validates email, simulates welcome email         |
| `order.created`     | Simulates inventory update + fulfillment trigger |
| `payment.processed` | Simulates billing record update (5% failure rate)|
| `*` (any other)     | Generic processor — logs + transforms payload    |

### Adding a new processor

Edit `worker/src/processors/registry.ts`:

```typescript
const myProcessor: ProcessorFn = async (job) => {
  const start = Date.now();
  // your logic here
  return {
    success: true,
    processedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    output: { handled: true },
  };
};

const PROCESSORS: Record<string, ProcessorFn> = {
  "my.event.type": myProcessor,
  // ...
};
```

### Retry & backoff

Configured in `api/src/config/index.ts`:

```
attempts: 3
backoff: exponential, starting at 1s
→ Attempt 1: immediate
→ Attempt 2: 1s delay
→ Attempt 3: 2s delay
→ After 3 failures: status = DEAD_LETTERED
```

Dead-lettered events can be manually retried from the dashboard or via API.

---

