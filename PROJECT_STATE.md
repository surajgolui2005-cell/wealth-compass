# Project State — Investor Portfolio Monitoring & Risk Management System

---

| Field             | Value                                                         |
| ----------------- | ------------------------------------------------------------- |
| **Project Name**  | Investor Portfolio Monitoring & Risk Management System        |
| **Repository**    | `Investor Portolio Monitoring and Risk Management System`     |
| **Current Phase** | Phase 4 — Development Environment & CI/CD Setup (IN PROGRESS) |
| **Last Updated**  | 2026-08-14                                                    |
| **Phase Author**  | Product & Architecture Team                                   |

---

## Phase Completion Tracker

| Phase        | Name                                   | Status      | Completed Date | Key Deliverables                                                         |
| ------------ | -------------------------------------- | ----------- | -------------- | ------------------------------------------------------------------------ |
| **Phase 1**  | Product Discovery                      | COMPLETE    | 2026-08-12     | `docs/product/PRODUCT_DISCOVERY.md`                                      |
| **Phase 2**  | Product Requirements Document (PRD)    | COMPLETE    | 2026-08-12     | `docs/product/PRD.md` — 6 Epics, 44 User Stories, 132+ Gherkin scenarios |
| **Phase 3**  | System Architecture & Technical Design | COMPLETE    | 2026-08-13     | `docs/architecture/ARCHITECTURE.md` — SA-001 v1.0.0                      |
| **Phase 4**  | Development Environment & CI/CD Setup  | IN PROGRESS | —              | Monorepo setup complete, Docker & CI/CD pipelines (NEXT)                 |
| **Phase 5**  | Backend Core Services — MVP            | NOT STARTED | —              | Auth, Portfolio, PriceFeed, Risk Engine services                         |
| **Phase 6**  | Frontend — MVP Web App                 | NOT STARTED | —              | Dashboard, Portfolio view, Risk tab, Alerts UI                           |
| **Phase 7**  | Integration Layer — MVP Providers      | NOT STARTED | —              | Zerodha, Groww, ICICI Direct, Binance, WazirX                            |
| **Phase 8**  | Alert & Notification Engine            | NOT STARTED | —              | Price alerts, FD maturity, drawdown, sync alerts                         |
| **Phase 9**  | Testing, QA & Security Audit           | NOT STARTED | —              | Unit/integration tests, pentest, OWASP audit                             |
| **Phase 10** | MVP Launch & Observability             | NOT STARTED | —              | Production deployment, monitoring, SLA validation                        |
| **Phase 11** | V1.0 Feature Development               | NOT STARTED | —              | Rebalancing, Goals, Tax, Native apps                                     |
| **Phase 12** | V2.0 — AI & Advanced Features          | NOT STARTED | —              | AI insights, DeFi, White-label API                                       |

---

## Phase 1 — Product Discovery (COMPLETE)

### Summary

Phase 1 has formally concluded. The Product Discovery Document (PD-001 v1.0.0) has been authored, reviewed, and approved for Phase 2 progression.

### Deliverables Produced

| Deliverable                         | Location                            | Status   |
| ----------------------------------- | ----------------------------------- | -------- |
| Product Discovery Document (PD-001) | `docs/product/PRODUCT_DISCOVERY.md` | COMPLETE |
| Project State Initialisation        | `PROJECT_STATE.md`                  | COMPLETE |

### Key Decisions Made in Phase 1

| Decision ID | Decision                                                       | Rationale                                                                                                 |
| ----------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| D-001       | MVP targets India-first market (INR as primary currency)       | Largest addressable market; clearest regulatory framework for V1                                          |
| D-002       | Read-only API integration only (no write/trade execution)      | Removes SEBI investment advisor classification risk; simplifies security model                            |
| D-003       | Manual asset entry as universal fallback for all asset classes | Ensures all 8 asset classes are accessible from Day 1 regardless of API availability                      |
| D-004       | AES-256 encryption at rest for all provider credentials        | Non-negotiable security baseline given financial data sensitivity                                         |
| D-005       | VaR computed via Historical Simulation (not Parametric)        | More accurate for non-normal distributions (crypto); avoids covariance matrix issues for large portfolios |
| D-006       | React (web) + React Native (mobile) technology stack           | Code reuse across web and mobile; large talent pool; strong ecosystem                                     |
| D-007       | Microservices architecture with event-driven sync              | Supports independent scaling of Price Feed, Risk Engine, and Alert services                               |
| D-008       | PostgreSQL (primary DB) + TimescaleDB (price time-series)      | Relational integrity for portfolio data; TimescaleDB optimised for price tick storage                     |

---

## Phase 2 — Product Requirements Document (COMPLETE)

### Summary

Phase 2 has formally concluded. The Product Requirements Document (PRD-001 v1.0.0) has been authored, validated, and approved for Phase 3 (System Architecture) progression.

### Deliverables Produced

| Deliverable                             | Location              | Status   |
| --------------------------------------- | --------------------- | -------- |
| Product Requirements Document (PRD-001) | `docs/product/PRD.md` | COMPLETE |
| PROJECT_STATE.md Phase 2 update         | `PROJECT_STATE.md`    | COMPLETE |

### PRD Statistics

| Metric                       | Value                                        |
| ---------------------------- | -------------------------------------------- |
| Total Epics                  | 6                                            |
| Total User Stories           | 44                                           |
| Total Gherkin Scenarios      | 132+ Given/When/Then blocks                  |
| Total `And` clauses          | 411                                          |
| Financial Edge Cases Covered | 31 (see Cross-Epic Edge Cases Matrix in PRD) |
| Epic codes defined           | AUTH, ING, VAL, RISK, ALT, RPT               |

### Story Count by Epic

| Epic                                   | Code | Stories | Scope Mix  |
| -------------------------------------- | ---- | ------- | ---------- |
| Epic 1: Auth & User Preference Mgmt    | AUTH | 8       | All MVP    |
| Epic 2: Multi-Provider Data Ingestion  | ING  | 9       | All MVP    |
| Epic 3: Deterministic Valuation Engine | VAL  | 7       | MVP + V1.0 |
| Epic 4: Performance & Risk Analytics   | RISK | 8       | MVP + V1.0 |
| Epic 5: Automated Alert Engine         | ALT  | 7       | MVP        |
| Epic 6: Report Generation (PDF/CSV)    | RPT  | 5       | MVP        |
| **Total**                              |      | **44**  |            |

### Financial Edge Cases Formally Specified

| Category          | Edge Cases                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| Valuation         | Zero portfolio, stale prices, FX rate unavailable, NAV not published       |
| Transactions      | Oversell, fractional crypto, cost basis methods (FIFO/LIFO/AVG), dividends |
| Corporate Actions | Stock split with data, split without history, fractional shares from split |
| Crypto Complexity | Multi-currency cost basis, FX gain/loss separation                         |
| Risk Analytics    | XIRR non-convergence, negative XIRR, VaR with < 252 days data, VaR timeout |
| Alerting          | Pre-breached alert, cooldown recovery re-breach, all channels fail         |
| Auth Security     | OTP expiry, max attempts, TOTP replay, backup code, user enumeration       |
| Imports           | Duplicate CSV detection, oversized file, partial import with errors        |

---

### Open Questions for Phase 3 (Architecture) — ALL RESOLVED

| ID     | Question                                               | Resolution                                                                                     | Doc Ref                     |
| ------ | ------------------------------------------------------ | ---------------------------------------------------------------------------------------------- | --------------------------- |
| OQ-006 | Which API framework: FastAPI vs NestJS?                | **Both** — NestJS (Modular Monolith) for business logic; Python FastAPI for quant microservice | SA-001 §2, ADR-001, ADR-002 |
| OQ-007 | Message queue choice for async sync jobs?              | **BullMQ over Redis** — sufficient scale, zero added infra, rich job management                | SA-001 §6, ADR-003          |
| OQ-008 | TOTP secret storage — DB vs secrets vault?             | **HashiCorp Vault KV v2** — dedicated secrets vault; TOTP secrets never in application DB      | SA-001 §7.3, ADR-005        |
| OQ-009 | VaR computation: in-app Python engine vs QuantLib?     | **NumPy/Pandas + QuantLib-Python** in dedicated Python FastAPI microservice                    | SA-001 §3.4, ADR-002        |
| OQ-010 | PDF generation: Puppeteer vs wkhtmltopdf vs ReportLab? | **Puppeteer (headless Chromium)** — pixel-perfect CSS/chart support                            | SA-001 §11, ADR-006         |

---

### Open Questions for Phase 2 (resolved / carried forward)

| ID     | Question                                                                        | Owner            | Due By  |
| ------ | ------------------------------------------------------------------------------- | ---------------- | ------- |
| OQ-001 | Which Account Aggregator (AA) framework provider to use for Open Banking?       | Architecture     | Phase 2 |
| OQ-002 | Confirm legal position on DPDP Act and storing encrypted OAuth refresh tokens   | Legal/Compliance | Phase 2 |
| OQ-003 | Evaluate CoinGecko Pro vs. alternative crypto price APIs for volume/rate limits | Backend Lead     | Phase 2 |
| OQ-004 | Real estate valuation API: Housing.com vs. 99acres vs. NoBroker API terms       | Product          | Phase 2 |
| OQ-005 | Confirm SEBI regulatory classification — informational disclaimer scope         | Legal            | Phase 2 |

---

## Asset Class Tracking

All 8 target asset classes accounted for in Phase 1:

| #   | Asset Class              | MVP Support | V1.0 Support | Discovery Doc Reference       |
| --- | ------------------------ | ----------- | ------------ | ----------------------------- |
| 1   | **Stocks (Equities)**    | Full        | Full         | FR-2, FR-3, FR-5, Section 7.4 |
| 2   | **ETFs**                 | Full        | Full         | FR-2, FR-3, FR-5, Section 7.4 |
| 3   | **Mutual Funds**         | Full        | Full         | FR-2, FR-3, FR-5, Section 7.4 |
| 4   | **Bonds**                | Manual only | API-driven   | FR-3, FR-5, FR-8, Section 7.4 |
| 5   | **Crypto**               | Full        | Full         | FR-2, FR-3, FR-5, Section 7.4 |
| 6   | **Cash / Bank Accounts** | Full        | Full         | FR-3, FR-5, Section 7.4       |
| 7   | **Fixed Deposits**       | Full        | Full         | FR-3, FR-5, FR-8, Section 7.4 |
| 8   | **Real Estate**          | Manual only | API-driven   | FR-3, FR-5, Section 7.4       |

---

## Architecture Snapshot (Phase 1 Assumptions)

> To be refined and formalised in Phase 2.

```
+------------------+      +-------------------+      +------------------+
|   Web App        |      |   API Gateway     |      |  Auth Service    |
|   (React/Next)   |----->|   (Kong / AWS GW) |----->|  (JWT + OAuth)   |
+------------------+      +-------------------+      +------------------+
                                    |
           +-----------+------------+-----------+------------------+
           |           |            |           |                  |
   +-------+---+  +----+-----+  +--+-----+  +--+-------+  +------+-----+
   | Portfolio |  | Risk     |  | Price  |  | Alert    |  | Export     |
   | Service   |  | Engine   |  | Feed   |  | Engine   |  | Service    |
   +-----------+  +----------+  +--------+  +----------+  +------------+
           |           |            |
   +-------+---+  +----+-----+  +--+------+
   | PostgreSQL|  |TimescaleDB|  | Redis   |
   | (Primary) |  |(PriceHist)|  | (Cache) |
   +-----------+  +----------+  +---------+
```

---

## Document Registry

| Document                                       | Path                                                    | Version | Phase                                                         |
| ---------------------------------------------- | ------------------------------------------------------- | ------- | ------------------------------------------------------------- |
| Performance Analytics Engine & Polyglot Client | `apps/quant-engine/`, `apps/api/src/modules/analytics/` | 1.0.0   | Step 13 — COMPLETE                                            |
| Analytics Methodology Specification            | `docs/analytics/ANALYTICS_METHODOLOGY.md`               | 1.0.0   | Step 13 — COMPLETE                                            |
| Deterministic Portfolio Calculation Engine     | `apps/api/src/modules/calculator/`                      | 1.0.0   | Step 12 — COMPLETE                                            |
| Market Data Ingestion Pipeline & Adapters      | `apps/api/src/modules/market-data/`                     | 1.0.0   | Step 11 — COMPLETE                                            |
| Provider Integration Layer & Data Adapters     | `apps/api/src/modules/providers/`                       | 1.0.0   | Step 10 — COMPLETE                                            |
| Portfolio & Transaction Domain Engine          | `apps/api/src/modules/portfolio/`                       | 1.0.0   | Step 9 — COMPLETE                                             |
| Authentication & Security Module               | `apps/api/src/modules/auth/`                            | 1.0.0   | Step 8 — COMPLETE                                             |
| Database Documentation & ERD                   | `DATABASE.md`                                           | 1.0.0   | Step 7 — COMPLETE                                             |
| Prisma ORM Schema                              | `apps/api/prisma/schema.prisma`                         | 1.0.0   | Step 7 — COMPLETE                                             |
| Initial SQL Migration                          | `apps/api/prisma/migrations/0_init/`                    | 1.0.0   | Step 7 — COMPLETE                                             |
| Product Discovery                              | `docs/product/PRODUCT_DISCOVERY.md`                     | 1.0.0   | Phase 1 — COMPLETE                                            |
| Product Requirements (PRD)                     | `docs/product/PRD.md`                                   | 1.0.0   | Phase 2 — COMPLETE                                            |
| System Architecture                            | `docs/architecture/ARCHITECTURE.md`                     | 1.0.0   | Phase 3 — COMPLETE                                            |
| API Contracts (OpenAPI)                        | `docs/api/openapi.yaml`                                 | —       | Phase 3 (partial — Quant Engine excerpt in SA-001 Appendix B) |
| Architecture Decision Records                  | `docs/adr/`                                             | 1.0.0   | Phase 3 — ADR-0001 through ADR-0006 COMPLETE                  |
| Monorepo Workspace Configuration               | `/` (root configs)                                      | 1.0.0   | Phase 4 — Scaffolded (pnpm + Turborepo)                       |
| Containerized Dev Environment                  | `docker-compose.yml`                                    | 1.0.0   | Phase 4 — Postgres 16 (TimescaleDB), Redis 7, Adminer         |
| Environment Variable Validation                | `packages/config/src/env.ts`, `.env.example`            | 1.0.0   | Phase 4 — Zod Schema & Safety Controls                        |
| Git Hooks & Lint-Staged                        | `.husky/`, `package.json`                               | 1.0.0   | Phase 4 — Husky Pre-commit Linting                            |
| Developer Setup Script                         | `scripts/dev-setup.sh`                                  | 1.0.0   | Phase 4 — Automated Onboarding Script                         |
| Development Setup Guide                        | `docs/dev/SETUP.md`                                     | —       | Phase 4                                                       |
| Runbook                                        | `docs/ops/RUNBOOK.md`                                   | —       | Phase 10                                                      |

---

## Changelog

| Date       | Phase   | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Author                                                  |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 2026-08-12 | Phase 1 | Project initialised. Product Discovery Document PD-001 v1.0.0 created. PROJECT_STATE.md initialised.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Product & Architecture Team                             |
| 2026-08-12 | Phase 2 | PRD-001 v1.0.0 created: 6 Epics, 44 User Stories (US-AUTH-01..08, US-ING-01..09, US-VAL-01..07, US-RISK-01..08, US-ALT-01..07, US-RPT-01..05), 132 Given/When/Then scenarios, 13 financial edge case classes validated.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Product & QA Team                                       |
| 2026-08-13 | Phase 3 | SA-001 v1.0.0 created: C4 diagrams (L1 Context, L2 Container, L3 Component x2), Bounded Context Map (6 contexts, 7 cross-context relationships, 4 ACLs), 7-stage data flow pipeline, BullMQ async queue topology (7 named queues), REST synchronous flow SLA table, security/isolation boundary architecture, Kubernetes deployment topology, inter-service communication contracts (TypeScript + Python type definitions), OpenTelemetry observability architecture, 10 ADRs, all 5 Phase 2 open questions resolved (OQ-006 to OQ-010).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Principal Architecture Team                             |
| 2026-08-14 | Phase 3 | Formally drafted and committed ADR-0001 through ADR-0006 in docs/adr/ covering monorepo, backend, quant service, database, cache/queue, and mobile frameworks.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Principal Architecture Team                             |
| 2026-08-14 | Phase 4 | Scaffolded root monorepo configuration (pnpm-workspace.yaml, turbo.json, package.json, tsconfig.json, .gitignore, .prettierrc) and initialized apps and packages workspaces with cross-package TypeScript path mapping. Verified pnpm install and Turborepo build pipeline.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Principal Architecture Team                             |
| 2026-08-14 | Phase 4 | Configured containerized development stack (`docker-compose.yml` with TimescaleDB Postgres 16, Redis 7, Adminer, persistent volumes & healthchecks), `.env.example`, `@investor-pm/config` Zod runtime validation & unit test suite, `.husky/pre-commit` with `lint-staged`, and onboarding script `scripts/dev-setup.sh`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Lead DevOps & Infrastructure Engineer                   |
| 2026-08-14 | Step 7  | Completed Step 7 — Database Schema Design & Migration Strategy. Authored production Prisma schema (`apps/api/prisma/schema.prisma`) defining 14 financial domain models (`User`, `UserPreferences`, `Portfolio`, `FinancialProviderAccount`, `AssetClass`, `Asset`, `Holding`, `Transaction`, `MarketPrice`, `PortfolioSnapshot`, `RiskMetricSnapshot`, `AlertRule`, `AlertLog`, `Report`) with exact Decimal precision (`Decimal(18,8)` & `Decimal(18,4)`), audit fields (`createdAt`, `updatedAt`, `deletedAt`), composite indexes, foreign key cascades, initial DDL migration script (`0_init/migration.sql`), and comprehensive database specification document in `DATABASE.md` with Mermaid ERD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Principal Database Architect                            |
| 2026-08-14 | Step 8  | Completed Step 8 — Authentication, Authorization & Security Base. Implemented NestJS Auth module (`apps/api/src/modules/auth/`), Argon2id password hashing (`ArgonService`), OWASP password policy validation (min 12 chars, upper, lower, digit, special char), Dual-Token JWT lifecycle with HTTP-Only SameSite=Strict cookies, SHA-256 hashed refresh token database persistence & rotation, rate-limiting via `@nestjs/throttler` (5 login req/min), Helmet security headers, cookie-parser, and unit/integration test suite.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Senior Cybersecurity & Backend Engineer                 |
| 2026-08-14 | Step 9  | Completed Step 9 — Core Portfolio & Transaction Domain Engine. Implemented NestJS Portfolio module (`apps/api/src/modules/portfolio/`), `PortfolioService`, `TransactionService`, and `HoldingService`. Enforced exact financial arithmetic with `Decimal.js` across 9 transaction types (`BUY`, `SELL`, `DIVIDEND`, `INTEREST`, `DEPOSIT`, `WITHDRAWAL`, `FEE`, `SPLIT`, `BONUS`), atomic cash balance updates and position tracking inside Prisma `$transaction`, validation rules preventing oversell (`InsufficientHoldingException`) and cash overdraft (`InsufficientCashException`), domain event dispatching via `EventEmitter2` (`transaction.recorded`, `holding.updated`, `portfolio.updated`), REST endpoints under `/api/v1/portfolios` and `/api/v1/transactions`, and unit test suite passing 33/33 tests.                                                                                                                                                                                                                                                                                                                                                                           | Principal Backend Engineer                              |
| 2026-08-14 | Step 10 | Completed Step 10 — Provider Integration Layer & Data Adapters. Designed extensible Provider Integration Layer in `apps/api/src/modules/providers/` utilizing Adapter and Provider Factory patterns. Created `FinancialDataProvider` interface, `ProviderFactoryService` (dynamic provider resolution & zero-core-change registration), `CsvProviderAdapter` (fast `PapaParse` stream parsing with header alias matching & date/type normalization), `MockBrokerProviderAdapter` (`ZERODHA`, `GROWW`, `BINANCE`, `ICICI_DIRECT`, `WAZIRX`), `ManualEntryAdapter`, `ProviderIngestionService` (raw transaction to canonical `CreateTransactionDto` mapping pipeline), REST endpoints under `/api/v1/providers`, and unit test suite passing 45/45 tests.                                                                                                                                                                                                                                                                                                                                                                                                                                             | Senior Integration Engineer                             |
| 2026-08-15 | Step 11 | Completed Step 11 — Market Data Ingestion Pipeline & Price Caching. Built real-time market data infrastructure in `apps/api/src/modules/market-data/` with 3-tier price resolution (Tier 1: Redis cache ~1ms, Tier 2: external provider adapters with circuit breaker ~200-500ms, Tier 3: append-only DB fallback snapshot with stale/market-closed flags). Implemented `PriceCacheService` (ioredis connection, dynamic TTL: 5 min for active equities/crypto during market hours, 24h for fixed deposits/bonds/closed markets, pipeline batch writes, MGET batch reads), `AlphaVantageProvider` (NSE/BSE equity prices, exponential backoff, circuit breaker), `CoinGeckoProvider` (batch crypto prices with INR/USD rates, 24/7 market hours, circuit breaker), BullMQ scheduled worker `MarketDataProcessor` (recurring cron jobs for crypto every 5 min, equity every 15 min weekdays, EOD MF NAV), `MarketDataScheduler` (job deduplication, backoff policy), REST endpoints under `/api/v1/market-data`, and comprehensive unit test suite passing 53/53 tests (98/98 overall API tests).                                                                                                    | Senior Real-Time Data & Ingestion Engineer              |
| 2026-08-15 | Step 12 | Completed Step 12 — Deterministic Portfolio Calculation Engine. Built core financial valuation algorithms in `apps/api/src/modules/calculator/` guaranteeing exact precision with `Decimal.js` (28-digit precision, zero floating-point standard operators). Implemented `FifoCalculator` (full lot queue management, multi-lot drains, partial sell matching, Indian STCG/LTCG holding period classification, SPLIT/BONUS adjustments), `WeightedAvgCalculator` (running average cost basis, partial sell gains, corporate actions), `CurrencyConverterService` (historical FX rate resolution, multi-currency batch aggregation), `ValuationEngine` (pure read-only portfolio & holding valuation orchestration, live 3-tier price resolution, asset allocation breakdown, stale symbol tracking), `ValuationController` (`GET /api/v1/portfolios/:id/valuation`, `GET /api/v1/portfolios/:portfolioId/holdings/:holdingId/valuation`), DTOs (`PortfolioValuationSummaryDto`, `PositionValuationDto`, `RealizedGainDto`, `AssetAllocationDto`), and test suite with 25 new unit tests (123/123 total API tests passing) including a 10,000 micro-transaction aggregation zero-drift verification. | Principal Quantitative Software Engineer                |
| 2026-08-15 | Step 13 | Completed Step 13 — Performance Analytics Engine & Microservice Integration. Created Python FastAPI quantitative analytics service (`apps/quant-engine/`) with sub-period Time-Weighted Return (`twr.py`, Modified Dietz chain-linking breaking on external cash flows), Extended Internal Rate of Return (`xirr.py`, Newton-Raphson primary solver with Brent–Dekker fallback and TWR fail-safe per PRD US-RISK-01), benchmark performance analytics (`benchmark.py`, vectorised Beta, Jensen's Alpha, Sharpe, Sortino, Tracking Error, Information Ratio, Pearson correlation), formal math methodology specification (`docs/analytics/ANALYTICS_METHODOLOGY.md`), and FastAPI router (`src/app/routers/performance.py`). Integrated Python service into NestJS API via `AnalyticsModule` (`apps/api/src/modules/analytics/`), `AnalyticsClientService` (camelCase to snake_case DTO mapping, 15s timeout, resilient HTTP error handling), and `AnalyticsController` (`POST /api/v1/analytics/twr`, `POST /api/v1/analytics/xirr`, `POST /api/v1/analytics/benchmark`). Verified full precision across 82/82 Python pytest tests and 10 new NestJS unit tests (133/133 total API tests passing).  | Senior Quantitative Analyst & Polyglot Backend Engineer |

---

_This document is the authoritative source of truth for project phase status._
_Update after every phase milestone completion._
