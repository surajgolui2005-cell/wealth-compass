# Troubleshooting & Diagnostics Runbook — Wealth Compass Platform

**Document ID:** TS-001  
**Version:** 1.0.0  
**Status:** Approved for Production  
**Target Audience:** DevOps Engineers, Site Reliability Engineers (SRE), Backend & Frontend Developers  
**Last Updated:** 2026-09-06

---

## 1. Quick Diagnostic Cheat Sheet

Before deep diving into component-specific diagnostics, run these baseline verification commands from the project root:

```bash
# 1. Check health of local Docker containers (PostgreSQL, Redis, Adminer)
docker-compose ps

# 2. Probe API service deep readiness (tests DB, Redis, and Python Quant Engine connectivity)
curl -i http://localhost:3000/health/readiness

# 3. Check Python Quant Engine standalone health
curl -i http://localhost:8001/health

# 4. Check Prometheus metrics endpoint
curl -s http://localhost:3000/metrics | grep wealthcompass_

# 5. Execute full monorepo automated test runner
pnpm test:all
```

---

## 2. Environment & Container Infrastructure

### 2.1 Issue: Port Collision (`5432` or `6379` already in use)

**Symptoms:**

- `docker-compose up -d` outputs:
  ```
  Error response from daemon: Ports are not available: exposing port TCP 0.0.0.0:5432 -> 0.0.0.0:0: listen tcp 0.0.0.0:5432: bind: address already in use
  ```

**Root Cause:**
A local instance of PostgreSQL or Redis is running on the host machine outside Docker, occupying the default port.

**Resolution:**

1. Identify the occupying process:
   ```powershell
   # Windows PowerShell
   Get-NetTCPConnection -LocalPort 5432 | Select-Object OwningProcess
   # Linux / macOS
   lsof -i :5432
   ```
2. Either stop the host service or override the mapped ports in `.env`:
   ```bash
   # .env
   POSTGRES_PORT=5433
   REDIS_PORT=6380
   DATABASE_URL="postgresql://postgres:postgres_dev_password_only@localhost:5433/investor_pm?schema=public"
   REDIS_URL="redis://localhost:6380"
   ```
3. Restart containers:
   ```bash
   docker-compose down && docker-compose up -d
   ```

---

### 2.2 Issue: Docker Volume Corruption or Permission Errors

**Symptoms:**

- PostgreSQL container terminates immediately with `FATAL: database files are incompatible with server` or `chown: changing ownership of '/var/lib/postgresql/data': Permission denied`.

**Resolution:**
Reset local data volumes cleanly (WARNING: wipes local development database):

```bash
docker-compose down -v
docker-compose up -d
pnpm --filter @investor-pm/api run prisma:migrate
```

---

## 3. Database & Prisma ORM

### 3.1 Issue: Schema Drift & Migration Desynchronization

**Symptoms:**

- `PrismaClientKnownRequestError: Table 'investor_pm.XYZ' does not exist in the current database`.
- Or `prisma migrate dev` reports database drift requiring a reset.

**Resolution:**

1. Regenerate the local Prisma Client:
   ```bash
   pnpm --filter @investor-pm/api run prisma:generate
   ```
2. If working in local development and schema changes were applied:
   ```bash
   # Synchronize migrations in dev
   pnpm --filter @investor-pm/api exec prisma migrate dev --name <migration_name>
   ```
3. In staging/production environments, strictly apply versioned migrations:
   ```bash
   pnpm --filter @investor-pm/api exec prisma migrate deploy
   ```

---

### 3.2 Issue: Database Connection Pool Exhaustion

**Symptoms:**

- Log message: `Timed out fetching a new connection from the connection pool`.
- Health probe `checks.database.status` reports `"down"`.

**Root Cause:**
Too many concurrent worker tasks or long-running queries holding Prisma connections without releasing them.

**Resolution:**

1. Tune connection limits in `DATABASE_URL`:
   ```bash
   DATABASE_URL="postgresql://user:password@localhost:5432/investor_pm?schema=public&connection_limit=20&pool_timeout=10"
   ```
2. Inspect active connections in PostgreSQL via Adminer (`http://localhost:8080`) or psql:
   ```sql
   SELECT pid, query, state, age(clock_timestamp(), query_start)
   FROM pg_stat_activity
   WHERE state != 'idle'
   ORDER BY query_start ASC;
   ```

---

## 4. Redis & BullMQ Queue Processing

### 4.1 Issue: BullMQ Jobs Stalled or Not Processing

**Symptoms:**

- Report generation remains in `PENDING` state indefinitely.
- Alert notifications are not dispatched.
- `GET /metrics` shows `wealthcompass_bullmq_queue_depth{status="waiting"}` growing continuously.

**Diagnostic Steps:**

1. Verify Redis connectivity:
   ```bash
   docker exec -it investor_pm_redis redis-cli ping
   # Expected output: PONG
   ```
2. Inspect queue lengths inside Redis:
   ```bash
   docker exec -it investor_pm_redis redis-cli keys "bull:*"
   ```
3. Check worker concurrency and ensure the worker process is running:
   ```bash
   pnpm --filter @investor-pm/api run dev
   ```

**Resolution:**

- Restart the API process to reinitialize BullMQ worker listeners (`ReportSchedulerProcessor`, `AlertEvaluatorProcessor`, `MarketDataProcessor`).
- If a poison-pill job has failed maximum retries (default: 3), inspect `Report.errorMessage` in the database to see the exact stack trace.

---

### 4.2 Issue: Redis Cache Invalidation Out of Sync

**Symptoms:**

- Portfolio net worth or asset allocation on the frontend shows old values after a new BUY or SELL transaction was recorded.

**Resolution:**
The system uses automated write-through event invalidation (`@OnEvent('transaction.recorded')`). If Redis missed an event:

1. Manually invalidate portfolio cache via Redis CLI:
   ```bash
   # Flush keys tagged for specific portfolio
   docker exec -it investor_pm_redis redis-cli keys "analytics:*" | xargs redis-cli del
   ```
2. Check `apps/api/src/common/cache/analytics-cache.manager.ts` logs for Redis connection warnings.

---

## 5. Python Quantitative Engine (`apps/quant-engine`)

### 5.1 Issue: Mathematical Non-Convergence in XIRR / Modified Dietz

**Symptoms:**

- Log error: `RuntimeError: Failed to converge on internal rate of return within 100 iterations`.
- REST response returns fallback TWR or `null`.

**Root Cause:**
Non-standard cash flows (e.g., all cash outflows with no positive residual value, or alternating massive inflows/outflows) causing Newton-Raphson polynomial roots to diverge.

**Resolution:**
The engine implements dual solvers: Newton-Raphson with fallback to SciPy's bounded Brent method (`scipy.optimize.brentq`).

1. Verify portfolio cash flows contain at least one negative flow (BUY/deposit) and one terminal positive valuation.
2. Confirm transaction dates are strictly chronological.
3. Review `apps/quant-engine/src/analytics/xirr.py` for input sanitation.

---

### 5.2 Issue: Inter-Service HTTP Communication Failure

**Symptoms:**

- NestJS API throws `AxiosError: connect ECONNREFUSED 127.0.0.1:8001`.
- `GET /health/readiness` returns HTTP 503 with `"python_analytics": { "status": "down" }`.

**Resolution:**

1. Boot the Python Quant Engine:
   ```bash
   # In apps/quant-engine/
   python -m venv .venv
   source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   uvicorn src.main:app --host 0.0.0.0 --port 8001 --reload
   ```
2. Verify URL in NestJS `.env`:
   ```bash
   QUANT_ENGINE_URL="http://localhost:8001"
   ```

---

## 6. Frontend & Mobile Applications

### 6.1 Issue: Next.js 14 SSR Hydration Mismatch

**Symptoms:**

- Console warning: `Warning: Text content did not match. Server: "₹1,25,000" Client: "₹125,000"`.

**Root Cause:**
Server-side rendering using node environment locale (`en-US`) while browser client executes in Indian locale (`en-IN`), producing mismatched number grouping.

**Resolution:**
Ensure all currency formatting utilities (`apps/web/src/lib/formatters.ts`) explicitly enforce `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })` uniformly on both server and client.

---

### 6.2 Issue: Recharts `ResponsiveContainer` 0-Width Render Warning

**Symptoms:**

- Console error: `The width(0) and height(0) of chart container is invalid`.

**Root Cause:**
Chart component mounted inside a hidden tab or modal before CSS layout calculation completed.

**Resolution:**
Wrap charts in the provided `ChartContainer` (`apps/web/src/components/charts/chart-container.tsx`) which integrates layout observers and skeleton shimmer states until container dimensions are positive.

---

### 6.3 Issue: Expo Go Cannot Connect to Local API on Mobile

**Symptoms:**

- Mobile app shows `Network Error` or infinite loading screen on iOS/Android simulator or physical device.

**Root Cause:**
Mobile apps cannot resolve `http://localhost:3000` because `localhost` refers to the mobile handset/emulator itself.

**Resolution:**

1. Find your machine's LAN IP address (`ipconfig` on Windows, `ifconfig` on macOS/Linux).
2. Set in `apps/mobile/.env`:
   ```bash
   EXPO_PUBLIC_API_URL="http://192.168.1.XX:3000/api/v1"
   ```
3. Restart Expo bundler with cache cleared:
   ```bash
   pnpm --filter @investor-pm/mobile exec expo start -c
   ```

---

## 7. Security, Auth & Encryption

### 7.1 Issue: Encryption Key Length Error (`AES-256-GCM`)

**Symptoms:**

- API crashes on startup with: `InvalidKeyLengthException: ENCRYPTION_KEY must be a 32-byte hex string (64 characters)`.

**Root Cause:**
`ENCRYPTION_KEY` in `.env` is either missing, too short, or not hex-encoded.

**Resolution:**
Generate a cryptographically secure 256-bit key using Node.js crypto CLI:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the 64-character output into `.env`:

```bash
ENCRYPTION_KEY="<64_hex_characters>"
```

---

### 7.2 Issue: JWT Expired or Invalid Refresh Token

**Symptoms:**

- REST calls return `401 Unauthorized` with `{ "code": "TOKEN_EXPIRED" }`.

**Resolution:**

1. The platform uses short-lived access tokens (15 minutes) and rotating refresh tokens (7 days).
2. Ensure clients call `/api/v1/auth/refresh` sending the HTTP-only cookie.
3. If refresh fails, clear client cookies/storage and log in again to receive a fresh token pair.

---

## 8. Health & Observability Triage

### 8.1 Health Check Status Codes

| Endpoint                |        HTTP Status        | Meaning                                      | Action                                                            |
| :---------------------- | :-----------------------: | :------------------------------------------- | :---------------------------------------------------------------- |
| `GET /health/liveness`  |         `200 OK`          | Process is running and event loop is active. | No action required.                                               |
| `GET /health/readiness` |         `200 OK`          | PostgreSQL, Redis, and Quant Engine all UP.  | Healthy — ready for traffic.                                      |
| `GET /health/readiness` | `503 Service Unavailable` | At least 1 dependency probe failed.          | Inspect response JSON `checks` map to pinpoint failing component. |

### 8.2 Triage Matrix for 503 Readiness Failures

```json
{
  "status": "degraded",
  "isHealthy": false,
  "checks": {
    "database": { "status": "down", "error": "Connection lost" },
    "redis": { "status": "up", "latencyMs": 1 },
    "python_analytics": { "status": "up", "latencyMs": 4 }
  }
}
```

- **If `database` is down:** Check Docker container `investor_pm_postgres`, verify PostgreSQL disk space and credentials.
- **If `redis` is down:** Verify Docker container `investor_pm_redis` and network reachability.
- **If `python_analytics` is down:** Verify `QUANT_ENGINE_URL` port 8001 process is active.
