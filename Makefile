.PHONY: up down logs seed test-event test-events test-random health

# ── Infrastructure ────────────────────────────────────────────────────────────

up:
	cp -n .env.example .env 2>/dev/null || true
	docker compose up --build -d
	@echo ""
	@echo "  ✓ EventFlow is starting up"
	@echo "  API:       http://localhost:3000"
	@echo "  Dashboard: http://localhost:5173"
	@echo ""
	@echo "  Waiting for services..."
	@sleep 5
	@$(MAKE) health

down:
	docker compose down

down-v:
	docker compose down -v

logs:
	docker compose logs -f

logs-api:
	docker compose logs -f api

logs-worker:
	docker compose logs -f worker

restart-worker:
	docker compose restart worker

# ── Database ──────────────────────────────────────────────────────────────────

migrate:
	docker compose exec api npx prisma migrate deploy

seed:
	docker compose exec api npx tsx prisma/seed.ts

studio:
	cd api && npx prisma studio

# ── Testing ───────────────────────────────────────────────────────────────────

health:
	@curl -sf http://localhost:3000/health | python3 -m json.tool || echo "API not ready yet"

test-event:
	@curl -s -X POST http://localhost:3000/events \
		-H "Authorization: Bearer dev_key_123" \
		-H "Content-Type: application/json" \
		-d '{"type":"user.signup","payload":{"email":"test@example.com","userId":"usr_abc123"}}' \
		| python3 -m json.tool

test-events:
	@for type in user.signup order.created payment.processed user.login order.shipped; do \
		curl -s -X POST http://localhost:3000/events \
			-H "Authorization: Bearer dev_key_123" \
			-H "Content-Type: application/json" \
			-d "{\"type\":\"$$type\",\"payload\":{\"testId\":\"$$RANDOM\"}}" > /dev/null; \
		echo "Sent: $$type"; \
	done
	@echo "\nDone. Check dashboard at http://localhost:5173"

list-events:
	@curl -s "http://localhost:3000/events?pageSize=5" \
		-H "Authorization: Bearer dev_key_123" \
		| python3 -m json.tool

metrics:
	@curl -s "http://localhost:3000/events/metrics" \
		-H "Authorization: Bearer dev_key_123" \
		| python3 -m json.tool

# ── Random 50-event stress test ───────────────────────────────────────────────
# Fires 50 events with randomised types, realistic payloads, and alternating API keys.
# Every run is different. Watch http://localhost:5173 while it runs.

test-random:
	@python3 scripts/random_test.py
