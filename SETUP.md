# EventFlow — Setup Guide

## Prerequisites

- Docker Desktop (Mac/Windows) or Docker Engine + Compose plugin (Linux)
- `curl` for testing
- That's it — no Node.js needed locally

---

## Step 1 — Unzip and enter the project

```bash
unzip eventflow.zip
cd eventflow
```

---

## Step 2 — Create your .env file

```bash
cp .env.example .env
```

The defaults work out of the box for local development. No changes needed.

---

## Step 3 — Build and start everything

```bash
docker compose up --build
```

This will:
1. Pull PostgreSQL and Redis images
2. Build the API, Worker, and Dashboard images (~2-3 minutes first time)
3. Run `prisma db push` to create the database schema
4. Start all 5 services

Leave this terminal running so you can watch the logs. Open a second terminal for the commands below.

---

## Step 4 — Confirm everything is healthy

Wait until you see `API server started` in the logs, then:

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{"status":"ok","checks":{"database":"ok","redis":"ok"}}
```

If you see `"degraded"`, wait another 10 seconds and try again — PostgreSQL takes a moment on first boot.

---

## Step 5 — Send your first event

```bash
curl -X POST http://localhost:3000/events \
  -H "Authorization: Bearer dev_key_123" \
  -H "Content-Type: application/json" \
  -d '{"type":"user.signup","payload":{"email":"hello@example.com","userId":"usr_001"}}'
```

Expected response:
```json
{
  "id": "...",
  "jobId": "...",
  "status": "QUEUED",
  "message": "Event accepted and queued for processing."
}
```

---

## Step 6 — Open the Dashboard

→ **http://localhost:5173**

You should see your event appear within a few seconds. It will cycle through `QUEUED → PROCESSING → SUCCESS`.

The dashboard auto-refreshes every 5 seconds.

---

## Step 7 — Send more test events (optional)

```bash
# Send one of each built-in event type
for TYPE in user.signup user.login order.created order.shipped payment.processed; do
  curl -s -X POST http://localhost:3000/events \
    -H "Authorization: Bearer dev_key_123" \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"$TYPE\",\"payload\":{\"test\":true,\"ts\":\"$(date -u +%s)\"}}" > /dev/null
  echo "Sent: $TYPE"
done
```

---

## Step 8 — Check metrics

```bash
curl http://localhost:3000/events/metrics \
  -H "Authorization: Bearer dev_key_123"
```

---

## Useful commands

```bash
# View all logs
docker compose logs -f

# View only API logs
docker compose logs -f api

# View only worker logs
docker compose logs -f worker

# List recent events
curl "http://localhost:3000/events?pageSize=5" \
  -H "Authorization: Bearer dev_key_123"

# Retry a failed event (replace ID)
curl -X POST http://localhost:3000/events/REPLACE_ID/retry \
  -H "Authorization: Bearer dev_key_123"

# Stop everything
docker compose down

# Stop and wipe all data (full reset)
docker compose down -v
```

---

## Ports

| Service   | URL                        |
|-----------|----------------------------|
| Dashboard | http://localhost:5173       |
| API       | http://localhost:3000       |
| Health    | http://localhost:3000/health|
| PostgreSQL| localhost:5432              |
| Redis     | localhost:6379              |

---

## API Keys

Two keys are pre-configured (set in `.env`):

| Key            | Use               |
|----------------|-------------------|
| `dev_key_123`  | Development / testing |
| `test_key_456` | Secondary test key    |

Pass as: `Authorization: Bearer dev_key_123`

Rate limit: 100 requests per minute per key.

---

## What's Missing — What to Build Next

### High priority (needed before sharing with anyone)

**1. Real API key management**
Currently keys are hardcoded in `.env`. You need:
- `POST /api-keys` — create a key, store hashed in DB
- `DELETE /api-keys/:id` — revoke a key
- Per-key rate limits read from the `api_keys` table (already in schema)
- The `authenticate` middleware should query the DB instead of a config Set

**2. Idempotency keys**
Right now sending the same event twice creates two records. Add:
- Accept `Idempotency-Key` header on `POST /events`
- Check Redis for the key before creating (TTL: 24h)
- Return the original response if duplicate

**3. Dashboard auth**
The dashboard API key is baked in at build time. For anything real:
- Add a simple login page (username + password → JWT)
- Or use a read-only API key with no write permissions
- Or put the dashboard behind a VPN/bastion

**4. Proper migration workflow**
We use `prisma db push` which is fine for dev but not for production. You should:
```bash
# Create your first real migration
cd api && npx prisma migrate dev --name init --schema=../prisma/schema.prisma
# Commit the generated migrations/ folder
# In prod, CMD runs: prisma migrate deploy
```

### Medium priority (reliability improvements)

**5. Stalled job recovery**
If the worker crashes mid-job, the event stays `PROCESSING` forever. Add a startup check:
```typescript
// On worker boot, find events stuck in PROCESSING > 5 min and reset to QUEUED
await prisma.event.updateMany({
  where: { status: 'PROCESSING', updatedAt: { lt: new Date(Date.now() - 5 * 60_000) } },
  data: { status: 'QUEUED' }
});
```

**6. Webhook delivery**
The most natural next feature: after processing, `POST` the result to a customer-configured URL (like Stripe webhooks). You'd need:
- A `Destination` model (url, secret, eventTypes[])
- A `WebhookDelivery` model (status, attempts, responseCode)
- A second BullMQ queue: `webhook-deliveries`

**7. Schema validation per event type**
Before queuing, validate payloads against a JSON Schema:
```typescript
const schemas: Record<string, ZodSchema> = {
  'user.signup': z.object({ email: z.string().email(), userId: z.string() }),
  'order.created': z.object({ orderId: z.string(), amount: z.number() }),
};
```

**8. Observability**
- Add a `/metrics` endpoint exposing Prometheus format
- Key metrics: `events_ingested_total`, `events_processing_duration_ms`, `queue_depth`, `worker_errors_total`
- Ship structured logs to Datadog/Loki/CloudWatch

### Nice to have

**9. Scale workers horizontally**
```bash
docker compose up --scale worker=3
```
BullMQ handles distributed locking automatically — this already works, just try it.

**10. Event replay**
```bash
# Replay all FAILED events of a given type
POST /events/replay { "type": "payment.processed", "status": "FAILED" }
```

**11. CLI tool**
```bash
eventflow send user.signup --payload '{"email":"x@y.com"}'
eventflow status evt_abc123
eventflow replay --type order.created --since 2024-01-01
```

**12. BullMQ Board UI**
Add [bull-board](https://github.com/felixmosh/bull-board) for a built-in queue inspector — see job details, retry from the UI, inspect failures. Drop-in with ~10 lines:
```typescript
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
const serverAdapter = new ExpressAdapter().setBasePath('/queues');
createBullBoard({ queues: [new BullMQAdapter(eventQueue)], serverAdapter });
app.use('/queues', serverAdapter.getRouter());
```

---

## How to Talk About This in Interviews

**30-second summary:**
> "It's a distributed event ingestion pipeline — similar to how Stripe webhooks or Segment work internally. Events come in through an authenticated REST API, get persisted to Postgres first so we never lose them, then queued in Redis via BullMQ. A separate worker service processes them with type-specific handlers and exponential backoff retries. Failed events get dead-lettered instead of silently dropped. A React dashboard shows live status across all events."

**Three design decisions worth highlighting:**

1. **Write-before-enqueue** — The event hits Postgres before the queue. If Redis has a hiccup between the write and the enqueue, a startup reconciliation job can find `QUEUED` events with no corresponding job and re-enqueue them. You never lose data.

2. **Processor registry pattern** — Adding support for a new event type is one function, zero changes to existing code. It's the Open/Closed principle applied to an event pipeline.

3. **Separate API and worker processes** — They scale independently. A traffic spike means you add API containers. A processing backlog means you add workers (`docker compose up --scale worker=5`). BullMQ's distributed locking ensures no double-processing.

**Common follow-up questions:**

- *"What happens if the worker crashes mid-job?"* → BullMQ detects stalled jobs (no heartbeat after 30s) and re-queues them automatically. We also track `attempts` in Postgres.
- *"How do you prevent duplicate events?"* → Idempotency keys (not yet built — a good answer is to describe how you'd add it).
- *"How would you scale this to 10k events/second?"* → Partition by event type into separate queues, run workers per partition, use Redis Cluster for queue HA, PgBouncer for DB connection pooling.
