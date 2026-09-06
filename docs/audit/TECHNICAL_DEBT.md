# Technical Debt & Architectural Backlog — Wealth Compass Platform

**Document ID:** TD-001  
**Version:** 1.0.0  
**Status:** Active Backlog & Architectural Roadmap  
**Author:** Principal Software Architect & Engineering Director  
**Last Updated:** 2026-09-06

---

## 1. Overview & Debt Philosophy

In high-velocity software engineering, taking on deliberate, well-understood technical debt is often necessary to achieve speed-to-market. However, unmanaged technical debt creates operational drag, financial calculation edge cases, and scalability bottlenecks.

This document provides a completely candid, unvarnished inventory of all known trade-offs, architecture limitations, numerical solver edge cases, and future enhancements across the Wealth Compass codebase as of the **v1.0.0 production sign-off**.

---

## 2. Architectural & Service Boundary Debt

### TD-ARCH-01: Co-Location of Background Workers inside `apps/api`

- **Current State:** BullMQ worker processors (`ReportSchedulerProcessor`, `AlertEvaluatorProcessor`, `MarketDataProcessor`) run in the same Node.js process and container as the NestJS HTTP REST API gateway.
- **Trade-off / Risk:** Heavy PDF generation jobs (`pdfmake`) or bulk market data parsing can cause transient event loop lag spikes, impacting HTTP API p95 response latencies.
- **Remediation Recommendation:** Decouple background processors into a dedicated container workload (`apps/worker`) deployed independently in ECS Fargate. The Terraform ECS module already provisions task definitions for `worker`; code decoupling is scheduled for v1.1.
- **Severity:** Medium
- **Effort:** 3 Days
- **Target Release:** v1.1.0

---

### TD-ARCH-02: Direct Database Replica Querying by Python Quant Engine

- **Current State:** The Python Quant Engine (`apps/quant-engine`) establishes a direct, read-only `asyncpg` connection to the PostgreSQL/TimescaleDB database to fetch price matrices.
- **Trade-off / Risk:** While this avoids transferring large price datasets over HTTP from NestJS, it couples the Python engine directly to the relational database schema, creating dual migration dependencies.
- **Remediation Recommendation:** Abstract price time-series reads behind a dedicated high-throughput internal gRPC stream or Redis TimeSeries cache layer as instrument count scales beyond 10,000 active tickers.
- **Severity:** Low
- **Effort:** 5 Days
- **Target Release:** v2.0.0

---

## 3. Database & TimescaleDB Optimization Debt

### TD-DATA-01: Native TimescaleDB Hypertable Partitioning on `market_prices`

- **Current State:** The `market_prices` table is currently modeled as a standard PostgreSQL table with composite B-Tree indexes (`[asset_id, price_timestamp]`, `[price_timestamp]`).
- **Trade-off / Risk:** For current MVP volumes (<5 million rows), query performance is sub-5ms. However, as intraday price ticks accumulate over years, non-partitioned tables will experience index bloat and slower range scans.
- **Remediation Recommendation:** Execute `SELECT create_hypertable('market_prices', 'price_timestamp', chunk_time_interval => INTERVAL '7 days');` and configure automated data retention policies to compress chunks older than 90 days.
- **Severity:** Medium
- **Effort:** 2 Days
- **Target Release:** v1.1.0

---

### TD-DATA-02: Read-Write Connection Splitting in Prisma ORM

- **Current State:** Prisma Client utilizes a single connection string pool (`DATABASE_URL`) directed to the primary database instance for both read and write operations.
- **Trade-off / Risk:** Under heavy analytical read load (e.g., thousands of investors checking portfolios during market close), read queries compete for connection pool slots with transactional write queries.
- **Remediation Recommendation:** Introduce PgBouncer connection pooling with read-replica splitting, or configure Prisma's read replica extension to route `findMany` queries to the Aurora read replica.
- **Severity:** Medium
- **Effort:** 3 Days
- **Target Release:** v1.1.0

---

## 4. Financial Quantitative Edge Cases & Numerical Limitations

### TD-QUANT-01: Multiple Internal Rates of Return (IRR) in XIRR Solvers

- **Current State:** According to **Descartes' Rule of Signs**, when transaction cash flows change sign multiple times (e.g., Buy -> Sell -> Buy -> Sell with varying dividends), the polynomial equation can possess multiple real roots. Current implementation converges to the first root found via Newton-Raphson / Brent method, or falls back to Time-Weighted Return (TWR) if bounds fail.
- **Trade-off / Risk:** An investor with highly erratic cash flows may see a mathematically valid but economically confusing annualized XIRR rate.
- **Remediation Recommendation:** Implement a multi-root detector that checks for multiple sign changes and annotates the UI with a "Cash Flow Ambiguity Warning" recommending reliance on TWR.
- **Severity:** Low
- **Effort:** 2 Days
- **Target Release:** v1.2.0

---

### TD-QUANT-02: Sparse Price History Handling for Illiquid Assets

- **Current State:** Quantitative risk metrics (VaR, Volatility, Sharpe) require at least 252 trading days of historical prices. For newly listed IPOs, unlisted shares, or thinly traded bonds with <252 days of history, the engine falls back to available observations or flags the asset as non-computable.
- **Trade-off / Risk:** Newly listed assets can temporarily understate portfolio-level volatility until 1 year of price history accumulates.
- **Remediation Recommendation:** Implement **Proxy Asset Imputation**: allow assigning a sector benchmark index or proxy ticker (e.g., NIFTY IT for a new tech IPO) to impute missing variance/covariance parameters during the initial 12 months.
- **Severity:** Medium
- **Effort:** 4 Days
- **Target Release:** v1.2.0

---

### TD-QUANT-03: Fixed Deposit Early Withdrawal Penalty Modeling

- **Current State:** Fixed Deposit valuation currently computes accrued interest linearly based on tenure elapsed without accounting for premature liquidation penalties (typically 0.5%–1.0% interest haircut imposed by Indian commercial banks).
- **Trade-off / Risk:** Prematurely broken FDs reflect gross accrued value rather than net realizable cash value.
- **Remediation Recommendation:** Add `prematurePenaltyPct` to the Asset metadata schema and apply penalty haircuts dynamically when evaluating liquidation scenarios.
- **Severity:** Low
- **Effort:** 1 Day
- **Target Release:** v1.1.0

---

## 5. Frontend & Mobile Optimization Debt

### TD-FRONT-01: Next.js 14 On-Demand Cache Revalidation

- **Current State:** Frontend dashboard pages currently fetch dynamic portfolio data on the client side using TanStack Query hooks (`useQuery`).
- **Trade-off / Risk:** Initial page load requires client-side JavaScript execution to fetch data, rather than streaming pre-rendered server components.
- **Remediation Recommendation:** Migrate portfolio summaries to Server Components with Next.js fetch tags (`revalidateTag('portfolio-{id}')`), invalidated instantly via backend webhooks on transaction commits.
- **Severity:** Low
- **Effort:** 3 Days
- **Target Release:** v1.2.0

---

### TD-FRONT-02: Native Biometric Authentication Enforcement on Mobile

- **Current State:** The React Native / Expo mobile app (`apps/mobile`) stores auth tokens in `expo-secure-store` (iOS Keychain / Android Keystore). Biometric authentication hooks are structured, but biometric enrollment is optional rather than enforced on app resume.
- **Trade-off / Risk:** If an unlocked phone is accessed by an unauthorized individual, the session remains active until token expiration.
- **Remediation Recommendation:** Enforce `LocalAuthentication.authenticateAsync()` on app state transition from background to active.
- **Severity:** Low
- **Effort:** 2 Days
- **Target Release:** v1.1.0

---

## 6. Operational, Security & Infrastructure Debt

### TD-OPS-01: Automated Database Secret Rotation

- **Current State:** PostgreSQL database passwords and AES-256 encryption keys are injected via environment variables and AWS Secrets Manager. Key rotation requires manual updating and service reboot.
- **Trade-off / Risk:** Manual secret rotation introduces risk of human error or delayed compliance rotation schedules.
- **Remediation Recommendation:** Implement AWS Secrets Manager automated rotation Lambda functions for PostgreSQL credentials and create an encryption key versioning table supporting dual-key decryption during rotation windows.
- **Severity:** Medium
- **Effort:** 4 Days
- **Target Release:** v1.2.0

---

### TD-OPS-02: Daemon Log Forwarding Sidecar

- **Current State:** Pino logs structured JSON to `stdout`, which CloudWatch Logs captures via the ECS AWSLogs driver.
- **Trade-off / Risk:** Heavy logging under load can consume container CPU cycles for I/O serialization.
- **Remediation Recommendation:** Deploy a lightweight Vector or FluentBit sidecar container in ECS task definitions to stream logs asynchronously to OpenSearch / Grafana Loki.
- **Severity:** Low
- **Effort:** 2 Days
- **Target Release:** v1.2.0

---

## 7. Prioritized Technical Debt Backlog

| Debt ID         | Category     | Title                                                 |  Severity  | Impact                                                        | Effort | Target Milestone |
| :-------------- | :----------- | :---------------------------------------------------- | :--------: | :------------------------------------------------------------ | :----: | :--------------: |
| **TD-ARCH-01**  | Architecture | Decouple BullMQ Worker Process to Dedicated ECS Task  | **Medium** | Prevents API latency spikes during batch PDF export jobs      |   3d   |    **v1.1.0**    |
| **TD-DATA-01**  | Database     | TimescaleDB Hypertable Chunking on `market_prices`    | **Medium** | Prevents index bloat as price ticks exceed 10M rows           |   2d   |    **v1.1.0**    |
| **TD-DATA-02**  | Database     | Read-Write Connection Splitting via PgBouncer         | **Medium** | Eliminates connection contention on heavy analytical queries  |   3d   |    **v1.1.0**    |
| **TD-FRONT-02** | Mobile       | Native Biometric Authentication on Mobile Resume      |  **Low**   | Enhances physical device security for financial portfolios    |   2d   |    **v1.1.0**    |
| **TD-QUANT-03** | Quant        | Fixed Deposit Premature Withdrawal Penalty Modeling   |  **Low**   | Improves exact cash realization accuracy for liquidated FDs   |   1d   |    **v1.1.0**    |
| **TD-QUANT-01** | Quant        | Multiple IRR Root Detection & Warning Annotation      |  **Low**   | Clarifies volatile cash flow return figures for investors     |   2d   |    **v1.2.0**    |
| **TD-QUANT-02** | Quant        | Proxy Asset Imputation for Sparse History Assets      | **Medium** | Enables institutional risk metrics on recent IPOs / new funds |   4d   |    **v1.2.0**    |
| **TD-FRONT-01** | Frontend     | Next.js Server Components with On-Demand Revalidation |  **Low**   | Accelerates First Contentful Paint (FCP) on dashboard         |   3d   |    **v1.2.0**    |
| **TD-OPS-01**   | Security     | Automated Secrets Manager Rotation via Lambda         | **Medium** | Eliminates manual credential rotation operational burden      |   4d   |    **v1.2.0**    |
| **TD-OPS-02**   | SRE          | Vector / FluentBit Log Forwarding Sidecar             |  **Low**   | Offloads log shipping overhead from application tasks         |   2d   |    **v1.2.0**    |
| **TD-ARCH-02**  | Architecture | Abstract Price Matrix Reads Behind gRPC Stream        |  **Low**   | Decouples Python engine completely from DB schema             |   5d   |    **v2.0.0**    |

---

_This backlog is actively tracked and reviewed during sprint planning following commercial release._
