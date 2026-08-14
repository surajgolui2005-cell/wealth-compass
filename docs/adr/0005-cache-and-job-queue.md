# ADR-0005: Cache and Job Queue

| Field          | Value                                            |
|----------------|--------------------------------------------------|
| **ADR ID**     | 0005                                             |
| **Title**      | Cache and Job Queue Selection                    |
| **Status**     | Accepted                                         |
| **Date**       | 2026-08-13                                       |
| **Deciders**   | Principal Architecture Team                      |
| **Supersedes** | —                                                |
| **Superseded by** | —                                             |
| **Ref**        | [ARCHITECTURE.md](file:///c:/Users/suraj/project/Investor%20Portolio%20Monitoring%20and%20Risk%20Management%20System/docs/architecture/ARCHITECTURE.md#L6.2) §2, §6.2, §6.3, §12 |

---

## Context

The IPMS backend relies on several critical, long-running, or resource-heavy background processes:

- **Provider Data Ingestion**: Fetching user balances and cash transactions from multiple external brokerages (e.g., Zerodha Kite Connect, ICICI Direct) and crypto exchanges (e.g., Binance, WazirX). These API endpoints are slow, subject to rate limits, and vulnerable to intermittent network failures.
- **Market Data Feeds**: Fetching live asset price ticks from CoinGecko, AMFI daily NAV sheets, Yahoo Finance, and Open Exchange Rates (OXR) for currency calculations.
- **Valuation computations**: Recalculating holding valuations and aggregating portfolio net worth after provider syncs or manual updates.
- **Quant Analytics triggers**: Initiating CPU-bound requests to the Python Quant Engine to recalculate Value at Risk (VaR), Sharpe ratios, Beta, and correlation matrices.
- **Alert evaluation & notification**: Evaluating alert conditions (e.g., portfolio drawdown breaches, crypto price triggers) and sending emails via AWS SES, push notifications via Firebase Cloud Messaging (FCM), and SMS alerts.
- **Report generation**: Launching Puppeteer instances to render pixel-perfect PDF financial statements and exporting CSV spreadsheets.

Running these tasks in the main request-response thread is impossible: they would block the user's browser, trigger API timeouts, and exhaust memory. We need a robust asynchronous job queuing system and caching layer that supports:

1. **Strict Priority Queues**: Ensuring user-initiated manual sync actions take precedence over recurring background cron syncs.
2. **Dynamic Rate-Limiting**: Restricting external API calls per provider domain to prevent IP blocks and rate limit violations.
3. **Advanced Retry Policies**: Retrying failed requests (e.g., brokerage API timeout) with exponential backoff and jitter.
4. **Job Deduplication**: Preventing multiple concurrent risk computation jobs for the same user if one is already pending or processing.
5. **High-Speed Price Cache**: Serving live price tickers in milliseconds to avoid database reads on every valuation.

---

## Decision

**We will deploy Redis 7 as our caching, pub/sub, and job queue backing store, and use BullMQ 5.x as the job queuing system within our NestJS application.**

Redis will serve three functions:
1. **Cache**: A high-speed, key-value memory store for live asset prices and FX rates (with a 60-second TTL to balance database load and price freshness).
2. **Pub/Sub Broker**: Broadcasting real-time price tick events (e.g., `price:tick:crypto`) from price ingestors to the Alert Engine in sub-milliseconds.
3. **BullMQ Store**: Storing job state and queue lists.

BullMQ (a Node.js-native distributed queue) will manage our seven named queues: `price-sync-queue`, `provider-sync-queue`, `valuation-queue`, `risk-compute-queue`, `alert-eval-queue`, `report-queue`, and `notification-queue`.

---

## Options Considered

### Option A: Redis 7 + BullMQ (Selected)

**Description:** Redis 7 cluster acts as the in-memory backend. BullMQ (built on top of Redis streams and Lua scripts) manages queues in NestJS using TypeScript decorators.

| Criteria | Assessment |
|---|---|
| Caching support | ✅ Native — Redis is the industry standard for caching |
| Pub/Sub capabilities | ✅ Native — Redis Pub/Sub has sub-millisecond propagation times |
| Job Management | ✅ High — Supports priority, retries, cron scheduling, rate-limiting, and parent-child execution chains |
| Operational Footprint | ✅ Low — One service (Redis) handles caching, pub/sub, and queues, reducing infrastructure costs |
| Type Safety | ✅ Strong — TypeScript annotations and decorators via `@nestjs/bullmq` |
| Resource efficiency | ✅ High — Scales background workers independently based on queue length using KEDA |

### Option B: RabbitMQ + Custom Node Workers

**Description:** An AMQP-based message broker. The API Gateway publishes messages to exchange routes; independent Node worker processes subscribe to queues.

| Criteria | Assessment |
|---|---|
| Routing flexibility | ✅ Exceptional — Advanced routing keys, wildcards, and fan-out patterns |
| Caching support | ❌ None — Requires deploying a separate Redis instance for live price cache |
| Operational Footprint | ❌ High — Must maintain both Redis (for cache) and RabbitMQ (for queues), doubling deployment and monitoring overhead |
| Worker Integration | ⚠️ Higher complexity — Requires writing custom reconnection and channel management boilerplate |

**Why not selected:** At our scale, RabbitMQ’s advanced routing patterns are unnecessary. Using BullMQ allows us to fulfill all queuing and caching requirements with a single infrastructure component (Redis), keeping the operations model simple for a small team.

### Option C: Apache Kafka + Custom Consumer Groups

**Description:** A distributed event streaming platform. Events are published to partition topics, and consumer worker pools process messages sequentially.

| Criteria | Assessment |
|---|---|
| Scaling limit | ✅ Unmatched — Millions of events per second with high partition throughput |
| Caching support | ❌ None — Requires a separate caching store |
| Job Operations | ❌ Limited — Lacks native support for cron delay queues, job priority, or job deduplication |
| Operational Overhead | ❌ Extremely High — Requires ZooKeeper/KRaft cluster, partition rebalancing, and complex configuration |

**Why not selected:** Kafka is built for massive log aggregation and high-throughput events. It lacks key job queue features like scheduling delayed tasks or priority overrides, which are essential for manual portfolio syncs. It is also overly complex to deploy and maintain for an MVP/V1.0 scale.

### Option D: PostgreSQL-based Job Queue (e.g. `pg-boss`, `graphile-worker`)

**Description:** Use our existing PostgreSQL database as the job queue backend. SQL tables store job state, and workers poll database tables for work.

| Criteria | Assessment |
|---|---|
| Operational Footprint | ✅ Excellent — Zero additional infrastructure; jobs are backed by SQL tables |
| Transactional Safety | ✅ Maximum — Jobs can be created within the same SQL transaction as database writes |
| Caching / PubSub | ❌ Weak — Inefficient for fast cache reads and real-time pub/sub broadcasts |
| Scaling database lock | ❌ Poor — High polling volume causes database CPU spikes and table bloat from rapid write/delete cycles |

**Why not selected:** While transactional queueing is attractive, pg-boss or graphile-worker would introduce heavy write locks on our primary database. At scale (e.g. syncing prices for thousands of users every minute), database performance would degrade, slowing down user queries.

---

## Consequences

### Positive

- **Infrastructure Consolidation**: A single Redis instance/cluster handles:
  1. Live asset price cache (GET/SET).
  2. Real-time price event broadcasting (Pub/Sub).
  3. Distributed job state engine (BullMQ).
- **Rate-Limit Enforcement**: BullMQ allows us to set per-worker rate limits (e.g., limiting Zerodha Kite syncs to 3 requests per second), protecting us from brokerage IP blocks and API suspensions.
- **Job Flow Chaining**: BullMQ supports complex job dependencies. A user-initiated sync initiates a chain: `SyncJob` -> `ValuationJob` -> `RiskComputeJob` -> `AlertEvaluationJob` -> `NotificationJob`. If any step fails, the chain stops, preventing cascade calculation errors.
- **Deduplication**: `risk-compute-queue` uses BullMQ’s `jobId` deduplication (keyed by `userId`). If a user triggers portfolio syncs repeatedly in seconds, the system drops redundant risk calculation jobs, protecting the Quant Engine from overload.
- **Independent Scaling**: Worker containers run in their own pods, separate from the NestJS API. Using KEDA (Kubernetes Event-driven Autoscaling), we can scale workers up or down based on Redis queue depths (list lengths), keeping infrastructure costs optimal.

### Negative / Trade-offs

- **Memory Limits**: Redis is an in-memory database. If workers freeze and jobs pile up, Redis could exhaust its RAM, leading to job loss or system crashes. Mitigation: Job payloads are restricted to small IDs (e.g. `{ userId: "uuid" }`). Workers fetch large datasets (e.g. transactions, allocations) directly from PostgreSQL.
- **Queue visibility**: Monitoring Redis queues requires dedicated web interfaces. Mitigation: Deploy `Bull Board` (a dashboard UI) as an admin-only endpoint in the NestJS API to inspect, retry, or delete jobs.
- **Persistence Tuning**: Redis can lose data in-memory during sudden server crashes. Mitigation: Enable Redis AOF (Append Only File) persistence with `fsync everysec` to minimize data loss.

### Neutral

- Redis cluster configurations require routing compatibility in the client driver (`ioredis`), which is natively supported by BullMQ.

---

## Compliance Check

| Requirement | Met? | Notes |
|---|---|---|
| **Financial precision** | ✅ | Job chaining guarantees that portfolio valuations and risk calculations run in the correct logical sequence, preventing stale computations. |
| **Developer velocity** | ✅ | `@nestjs/bullmq` provides a familiar decorator-based structure, eliminating queue plumbing code. |
| **System scalability** | ✅ | High-throughput, low-latency Redis operations keep job dispatching fast; workers scale independently using KEDA. |

---

*ADR-0005 — Accepted 2026-08-13*
