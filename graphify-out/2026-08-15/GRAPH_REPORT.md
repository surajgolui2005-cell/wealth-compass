# Graph Report - Investor Portolio Monitoring and Risk Management System (2026-08-15)

## Corpus Check

- 129 files · ~87,464 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 1463 nodes · 2822 edges · 91 communities (57 shown, 34 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 307 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `9d89c840`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- CsvProviderAdapter
- PRODUCT_DISCOVERY.md
- PRD.md
- auth.module.ts
- Negative / Trade-offs
- ARCHITECTURE.md
- compilerOptions
- package.json
- DATABASE.md
- transaction.service.ts
- compilerOptions
- PortfolioController
- class-validator
- devDependencies
- compute_benchmark_metrics
- PROJECT_STATE.md
- outputs
- _post
- 4. Benchmark Comparison Metrics
- 0006-mobile-framework.md
- TransactionController
- xirr.py
- market-data.service.spec.ts
- CreateTransactionDto
- web/package.json
- workers/package.json
- ui-components/package.json
- PriceQuote
- MarketDataScheduler
- config/package.json
- shared-types/package.json
- scripts
- shared-types/src/index.ts
- README.md
- CoinGeckoProvider
- docker-compose.yml
- env.ts
- valuation.engine.ts
- @investor-pm/types
- env.js
- dev-setup.sh
- rules/graphify.md
- workflows/graphify.md
- class-transformer
- market-data.module.ts
- helmet
- @investor-pm/config
- @nestjs/config
- @nestjs/event-emitter
- @nestjs/jwt
- @nestjs/platform-express
- @nestjs/throttler
- papaparse
- dependencies
- @prisma/client
- reflect-metadata
- date
- AlphaVantageProvider
- MarketDataService
- config/tsconfig.json
- routers/performance.py
- argon2
- cookie-parser
- quant-engine
- bullmq
- _post
- ioredis
- @nestjs/common
- @nestjs/core
- passport-jwt
- @nestjs/bullmq
- zod
- @nestjs/passport
- compute_xirr
- _post
- 0002-backend-framework.md
- benchmark.py
- portfolio.service.ts
- PortfolioService
- tests/**init**.py
- PrismaService
- decimal.js
- app/**init**.py
- src/**init**.py

## God Nodes (most connected - your core abstractions)

1. `Acceptance Criteria` - 52 edges
2. `PrismaService` - 26 edges
3. `AlphaVantageProvider` - 24 edges
4. `CoinGeckoProvider` - 23 edges
5. `compute_xirr()` - 23 edges
6. `MarketDataService` - 22 edges
7. `CsvProviderAdapter` - 22 edges
8. `CashFlow` - 21 edges
9. `PriceQuote` - 20 edges
10. `compilerOptions` - 20 edges

## Surprising Connections (you probably didn't know these)

- `TestComputeBenchmarkMetrics` --uses--> `BenchmarkMetrics` [INFERRED]
  apps/quant-engine/tests/test_benchmark.py → apps/quant-engine/src/analytics/benchmark.py
- `TestHelpers` --uses--> `CashFlow` [INFERRED]
  apps/quant-engine/tests/test_xirr.py → apps/quant-engine/src/analytics/xirr.py
- `TestComputeXirr` --uses--> `XirrResult` [INFERRED]
  apps/quant-engine/tests/test_xirr.py → apps/quant-engine/src/analytics/xirr.py
- `TestComputeXirr` --uses--> `XirrConvergenceError` [INFERRED]
  apps/quant-engine/tests/test_xirr.py → apps/quant-engine/src/analytics/xirr.py
- `Positive` --conceptually_related_to--> `Negative / Trade-offs` [INFERRED]
  docs/adr/0002-backend-framework.md → docs/adr/0004-database-and-orm.md

## Import Cycles

- None detected.

## Communities (91 total, 34 thin omitted)

### Community 0 - "CsvProviderAdapter"

Cohesion: 0.06
Nodes (27): CsvProviderAdapter, Injectable, ManualEntryAdapter, Injectable, MockBrokerProviderAdapter, Injectable, ImportCsvDto, ProviderController (+19 more)

### Community 1 - "PRODUCT_DISCOVERY.md"

Cohesion: 0.07
Nodes (80): 10.1 Technical Risks, 10.2 Business Risks, 10.3 Key Assumptions, 10. Risk & Assumptions Log, 11.1 Product Metrics, 11.2 Technical Metrics, 11.3 Business Metrics, 11.4 Risk & Safety Metrics (+72 more)

### Community 2 - "PRD.md"

Cohesion: 0.10
Nodes (59): 1.1 User Story Format, 1.2 Epic Codes, 1.3 Personas Quick Reference, 1. Document Conventions, 2. Epic 1 — Auth & User Preference Management, 3. Epic 2 — Multi-Provider Data Ingestion & Transaction Recording, 4. Epic 3 — Deterministic Valuation & Holding Engine, 5. Epic 4 — Performance & Risk Analytics Dashboard (+51 more)

### Community 3 - "auth.module.ts"

Cohesion: 0.06
Nodes (35): ArgonService, Injectable, AuthController, COOKIE_OPTIONS, Body, Controller, Get, HttpCode (+27 more)

### Community 4 - "Negative / Trade-offs"

Cohesion: 0.08
Nodes (55): ADR-0001: Monorepo Strategy, Compliance Check, Consequences, Constraints, Context, Decision, Directory Layout, Negative / Trade-offs (+47 more)

### Community 5 - "ARCHITECTURE.md"

Cohesion: 0.11
Nodes (46): 10. Observability Architecture, 11. Architecture Decision Records (ADR) Summary, 12. Open Questions Resolved, 1.1 Guiding Principles, 1.2 Architectural Pattern: Modular Monolith + Quant Microservice, 1. System Overview & Architectural Philosophy, 2. Technology Stack Decisions, 3.1 Level 1 — System Context Diagram (+38 more)

### Community 6 - "compilerOptions"

Cohesion: 0.07
Nodes (26): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, incremental (+18 more)

### Community 7 - "package.json"

Cohesion: 0.08
Nodes (25): husky, lint-staged, devDependencies, husky, lint-staged, prettier, turbo, engines (+17 more)

### Community 8 - "DATABASE.md"

Cohesion: 0.16
Nodes (24): 1. Overview & Technology Selection, 2. Entity-Relationship Diagram (ERD), 3. Financial Precision Standards, 4. Audit Fields & Soft Deletion Strategy, 5.1 Identity & Access Domain, 5.2 Portfolio & Ingestion Domain, 5.3 Asset & Position Domain, 5.4 Analytics, Valuation & Alert Domain (+16 more)

### Community 9 - "transaction.service.ts"

Cohesion: 0.21
Nodes (4): InsufficientCashException, InsufficientHoldingException, HoldingService, Injectable

### Community 10 - "compilerOptions"

Cohesion: 0.10
Nodes (20): node_modules, packages/config/*, packages/config/src/index.ts, packages/shared-types/src/index.ts, packages/ui-components/src/index.ts, compilerOptions, baseUrl, esModuleInterop (+12 more)

### Community 11 - "PortfolioController"

Cohesion: 0.16
Nodes (11): PortfolioController, Body, Controller, Get, HttpCode, Param, Post, Req (+3 more)

### Community 13 - "devDependencies"

Cohesion: 0.05
Nodes (42): devDependencies, jest, @nestjs/testing, prisma, supertest, ts-jest, ts-node, ts-node-dev (+34 more)

### Community 14 - "compute_benchmark_metrics"

Cohesion: 0.11
Nodes (15): compute_benchmark_metrics(), Computes the full suite of benchmark-relative performance metrics. Both price…, If portfolio prices = benchmark prices, β = 1.0, ρ = 1.0, α ≈ 0., Portfolio with consistently positive returns should have positive Sharpe., TE = std(r_p - r_b). When portfolio = benchmark, all active returns = 0 and TE…, Manual derivation for simple 3-point series: Portfolio prices: [100, 110, 121]…, No metric should be NaN/Inf on a clean monotonic price series., Integration tests for the full benchmark metrics computation. (+7 more)

### Community 15 - "PROJECT_STATE.md"

Cohesion: 0.27
Nodes (18): Architecture Snapshot (Phase 1 Assumptions), Asset Class Tracking, Changelog, Deliverables Produced, Deliverables Produced, Document Registry, Financial Edge Cases Formally Specified, Key Decisions Made in Phase 1 (+10 more)

### Community 16 - "outputs"

Cohesion: 0.13
Nodes (16): ^build, .next/**, out/**, dependsOn, outputs, cache, persistent, dist/** (+8 more)

### Community 17 - "_post"

Cohesion: 0.07
Nodes (22): _post(), Integration tests for POST /api/v1/performance/xirr…, TC-B04: Five-year multi-cashflow portfolio. Verifies NPV at solution is within…, Response must include solver diagnostics., Custom guess=0.50 should still produce the same XIRR as default., xirr_pct must equal xirr × 100 exactly., Validate convergence fallback and input validation error paths., Single cash flow → Pydantic min_length=2 catches it (422) before route handler… (+14 more)

### Community 18 - "4. Benchmark Comparison Metrics"

Cohesion: 0.06
Nodes (32): 1. Overview & Design Principles, 2.1 Purpose, 2.2 Sub-Period Boundary Rule, 2.3 Modified Dietz Sub-Period Return, 2.4 Chain-Linking, 2.5 Annualisation, 2.6 TWR vs MWR — When to Use Each, 2. Time-Weighted Return (TWR) (+24 more)

### Community 19 - "0006-mobile-framework.md"

Cohesion: 0.30
Nodes (15): ADR-0006: Mobile Framework, Compliance Check, Consequences, Context, Decision, Mobile Feature Requirements, Negative / Trade-offs, Neutral (+7 more)

### Community 20 - "TransactionController"

Cohesion: 0.19
Nodes (9): TransactionController, Body, Controller, Get, HttpCode, Param, Post, Req (+1 more)

### Community 21 - "xirr.py"

Cohesion: 0.12
Nodes (20): _brent_dekker(), _newton_raphson(), _npv(), _npv_derivative(), Extended Internal Rate of Return (XIRR) — Numerical Root-Finding Engine…, Output of the XIRR computation. Attributes ---------- xirr: Annualised XIRR as…, Raised when neither Newton-Raphson nor Brent's method can converge on a real…, Net Present Value: Σ CF_i / (1 + r)^t_i Avoids math.pow overflow by checking (1… (+12 more)

### Community 22 - "market-data.service.spec.ts"

Cohesion: 0.10
Nodes (18): BatchPriceResult, CircuitBreakerConfig, CircuitBreakerState, MarketDataProvider, ProviderUnavailableException, AlphaVantageGlobalQuote, CoinGeckoPriceResponse, SYMBOL_TO_COINGECKO_ID (+10 more)

### Community 23 - "CreateTransactionDto"

Cohesion: 0.18
Nodes (11): CreateTransactionDto, IsNotEmpty, IsOptional, IsString, IsDate, IsEnum, IsNumber, IsPositive (+3 more)

### Community 24 - "web/package.json"

Cohesion: 0.14
Nodes (13): dependencies, @investor-pm/types, @investor-pm/ui, @investor-pm/types, name, private, scripts, build (+5 more)

### Community 25 - "workers/package.json"

Cohesion: 0.14
Nodes (13): dependencies, @investor-pm/api, @investor-pm/types, @investor-pm/types, name, private, scripts, build (+5 more)

### Community 26 - "ui-components/package.json"

Cohesion: 0.12
Nodes (15): dependencies, @investor-pm/types, @investor-pm/types, main, name, peerDependencies, react, private (+7 more)

### Community 27 - "PriceQuote"

Cohesion: 0.13
Nodes (14): PriceQuote, ASSET_CLASS_TTL_MAP, buildPriceCacheKey(), buildPriceMetaKey(), CACHE_TTL, CachedPriceEntry, PRICE_CACHE_KEY_PREFIX, PriceCacheMetadata (+6 more)

### Community 28 - "MarketDataScheduler"

Cohesion: 0.12
Nodes (12): MarketDataController, Body, Controller, Get, HttpCode, Param, Post, Query (+4 more)

### Community 29 - "config/package.json"

Cohesion: 0.10
Nodes (19): dotenv, dependencies, dotenv, zod, devDependencies, @types/node, typescript, @types/node (+11 more)

### Community 30 - "shared-types/package.json"

Cohesion: 0.20
Nodes (9): main, name, private, scripts, build, lint, test, types (+1 more)

### Community 31 - "scripts"

Cohesion: 0.22
Nodes (8): name, private, scripts, build, dev, lint, test, version

### Community 32 - "shared-types/src/index.ts"

Cohesion: 0.29
Nodes (5): Holding, RiskSnapshot, Transaction, User, UserPreferences

### Community 33 - "README.md"

Cohesion: 0.64
Nodes (7): ✨ Key Features, 📄 License, 🚀 Overview, 📦 Project Structure, 🚀 Quick Start, 🛠️ Technology Stack, Wealth Compass: Investor Portfolio Monitoring & Risk Management System

### Community 35 - "docker-compose.yml"

Cohesion: 0.29
Nodes (6): Service: adminer, Service: investor_pm_network, Service: pgdata, Service: postgres, Service: redis, Service: redisdata

### Community 36 - "env.ts"

Cohesion: 0.38
Nodes (4): EnvConfig, envSchema, validateEnv(), runTests()

### Community 37 - "valuation.engine.ts"

Cohesion: 0.07
Nodes (41): AppModule, Module, AuthModule, Module, CalculatorModule, Module, Controller, Get (+33 more)

### Community 44 - "market-data.module.ts"

Cohesion: 0.27
Nodes (7): MARKET_DATA_JOBS, MARKET_DATA_QUEUE, FetchCryptoPricesJobPayload, FetchEquityPricesJobPayload, FetchSinglePriceJobPayload, CRON_SCHEDULES, JOB_OPTIONS

### Community 53 - "dependencies"

Cohesion: 0.22
Nodes (9): dependencies, axios, passport, rxjs, @types/papaparse, axios, passport, rxjs (+1 more)

### Community 56 - "date"

Cohesion: 0.09
Nodes (30): Analytics math package for the Wealth Compass Quant Engine. Public API: twr —…, CashFlowEvent, compute_twr(), _modified_dietz(), Time-Weighted Return (TWR) — Sub-Period Compounding Engine…, Output of the TWR computation. Attributes ---------- twr_cumulative: Cumulative…, Computes the Modified Dietz return for a single sub-period. Formula: R = (EMV -…, Computes the Time-Weighted Return (TWR) via sub-period chain-linking. The… (+22 more)

### Community 58 - "MarketDataService"

Cohesion: 0.22
Nodes (4): MarketDataService, Injectable, MarketDataProcessor, Processor

### Community 59 - "config/tsconfig.json"

Cohesion: 0.22
Nodes (8): compilerOptions, declaration, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.json

### Community 60 - "routers/performance.py"

Cohesion: 0.09
Nodes (33): compute_benchmark_endpoint(), compute_twr_endpoint(), compute_xirr_endpoint(), _pct(), post, Performance analytics router. Exposes three computation endpoints: POST…, POST /api/v1/performance/xirr Cash flow sign convention: - **Negative** = money…, POST /api/v1/performance/benchmark Accepts aligned portfolio NAV and benchmark… (+25 more)

### Community 68 - "_post"

Cohesion: 0.12
Nodes (16): _build_payload(), _post(), Integration tests for POST /api/v1/performance/benchmark…, Manual β verification: β = Cov(r_p, r_b) / Var(r_b) computed via NumPy and…, alpha_annualised_pct must equal alpha_annualised × 100., Verify 400/422 responses for invalid inputs., Unequal length series → Pydantic model_validator → 422., Two prices (one return) → insufficient for statistics → 400. (+8 more)

### Community 78 - "compute_xirr"

Cohesion: 0.12
Nodes (19): CashFlow, compute_xirr(), Converts cash flow dates to year fractions relative to the first date. t_i =…, Computes XIRR (Extended IRR) for a sequence of non-periodic cash flows. The…, A single cash flow event in the XIRR calculation. Attributes ---------- date:…, _year_fractions(), PRD Scenario 3: Portfolio in loss (current value < invested). Invested…, Newton-Raphson should converge on a well-behaved cash flow sequence. (+11 more)

### Community 79 - "_post"

Cohesion: 0.09
Nodes (19): health_check(), get, Quant Engine — FastAPI Application Entry Point…, Liveness probe for container orchestration., _post(), Integration tests for POST /api/v1/performance/twr…, twr_annualised must be non-None for multi-day windows., Single sub-period with a mid-period deposit. BMV=100, EMV=215, deposit 100 on… (+11 more)

### Community 80 - "0002-backend-framework.md"

Cohesion: 0.27
Nodes (17): ADR-0002: Backend Framework, Compliance Check, Consequences, Context, Decision, Financial Domain Requirements, Negative / Trade-offs, Neutral (+9 more)

### Community 81 - "benchmark.py"

Cohesion: 0.12
Nodes (18): _annualised_std(), BenchmarkMetrics, _daily_returns(), _downside_std(), Benchmark Comparison Analytics =============================== Mathematical…, Full set of benchmark-relative performance metrics. All return metrics are…, Converts a price series into a series of daily simple returns. r_t = (P_t -…, Annualised standard deviation of a daily return series. (+10 more)

### Community 82 - "portfolio.service.ts"

Cohesion: 0.16
Nodes (12): CreatePortfolioDto, IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, IsBoolean, IsOptional (+4 more)

### Community 83 - "PortfolioService"

Cohesion: 0.21
Nodes (5): PortfolioService, Injectable, TransactionService, Injectable, Optional

### Community 85 - "PrismaService"

Cohesion: 0.18
Nodes (5): JwtPayload, JwtStrategy, Injectable, PrismaService, Injectable

## Knowledge Gaps

- **253 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+248 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **34 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `auth.module.ts`, `valuation.engine.ts`, `transaction.service.ts`, `market-data.module.ts`, `portfolio.service.ts`, `PortfolioService`, `market-data.service.spec.ts`, `PriceQuote`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `Investor Portfolio Monitoring & Risk Management System` connect `ARCHITECTURE.md` to `PRODUCT_DISCOVERY.md`, `PRD.md`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `CoinGeckoProvider` connect `CoinGeckoProvider` to `PriceQuote`, `market-data.module.ts`, `market-data.service.spec.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `Acceptance Criteria` (e.g. with `1.2 Epic Codes` and `3. Epic 2 — Multi-Provider Data Ingestion & Transaction Recording`) actually correct?**
  _`Acceptance Criteria` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 24 inferred relationships involving `date` (e.g. with `.test_npv_at_solution_is_zero()` and `.test_quarterly_investments_5yr_known_rate()`) actually correct?**
  _`date` has 24 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _253 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CsvProviderAdapter` be split into smaller, more focused modules?**
  _Cohesion score 0.05642080517190714 - nodes in this community are weakly interconnected._
