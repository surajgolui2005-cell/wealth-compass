# Graph Report - Investor Portolio Monitoring and Risk Management System (2026-09-06)

## Corpus Check

- 363 files · ~228,050 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 3709 nodes · 6694 edges · 234 communities (175 shown, 59 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 415 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `64fedbe7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- provider-ingestion.service.ts
- PRODUCT_DISCOVERY.md
- PRD.md
- auth.module.ts
- Negative / Trade-offs
- ARCHITECTURE.md
- compilerOptions
- package.json
- DATABASE.md
- compute_drawdown
- compilerOptions
- PortfolioService
- class-validator
- devDependencies
- src/analytics/**init**.py
- PROJECT_STATE.md
- outputs
- _post
- Analytics Methodology
- compute_diversification
- 3. Detailed Table Specifications
- 3. Deep-Dive Security Controls & Mitigations
- CoinGeckoProvider
- AnalyticsCacheManager
- scripts
- workers/package.json
- ui-components/package.json
- MarketDataService
- JwtAuthGuard
- config/package.json
- shared-types/package.json
- scripts
- shared-types/src/index.ts
- README.md
- TestComponentScoresBenchmark
- docker-compose.yml
- env.ts
- valuation.engine.ts
- Troubleshooting & Diagnostics Runbook — Wealth Compass Platform
- env.js
- dev-setup.sh
- rules/graphify.md
- workflows/graphify.md
- class-transformer
- AnalyticsClientService
- alerts/page.tsx
- test_diversification.py
- routers/risk.py
- charts/index.ts
- @nestjs/jwt
- compute_allocation
- @nestjs/throttler
- papaparse
- dependencies
- src/observability.py
- analytics.dto.ts
- ProviderIngestionService
- AlphaVantageProvider
- market-data.module.ts
- config/tsconfig.json
- GroupBy
- test_quant_benchmarks.py
- AllocationWeight
- quant-engine
- alert-evaluator.engine.ts
- _post
- ioredis
- WealthCompass Cloud Infrastructure & Deployment Guide
- @nestjs/core
- main.ts
- @nestjs/bullmq
- MetricsService
- TestHhiBenchmark
- CashFlow
- _post
- compute_correlation
- date
- Performance Benchmark & Database Optimization Report
- mock-benchmark-server.js
- tests/**init**.py
- CreateTransactionDto
- CsvProviderAdapter
- app/**init**.py
- src/**init**.py
- .validate_weight_sums
- [id]/page.tsx
- app.module.ts
- alert.module.ts
- expo
- compute_var
- _post
- _post
- devDependencies
- compilerOptions
- ExcelExportService
- risk/page.tsx
- Endpoints
- transaction.service.ts
- TestDiversificationEndpointSmoke
- dependencies
- PrismaService
- AlertController
- AlertService
- PdfReportService
- dependencies
- alert.service.ts
- compute_sortino
- Developer Onboarding & Setup Guide — Wealth Compass Platform
- devDependencies
- otel-tracer.ts
- PortfoliosScreen.tsx
- TestRiskPropertyInvariants
- AuthContext.tsx
- MainTabs.tsx
- scripts
- TestEdgeCasesAndErrorHandling
- TestHhiInvariants
- mobile/package.json
- AlertsScreen.tsx
- AuthStack.tsx
- include
- 8. Diversification & Concentration Analytics
- Technical Debt & Architectural Backlog — Wealth Compass Platform
- AlertEvaluatorEngine
- health.service.ts
- app/layout.tsx
- index.tsx
- 7. Pairwise Asset Correlation Matrix
- Production Readiness Review & Final Sign-Off — Wealth Compass Platform
- mobile/src/lib/api-client.ts
- TestRiskSummaryEndpoint
- TestDrawdownSeriesEndpoint
- TestCorrelationEndpoint
- 1. Annualised Volatility
- 3. Sharpe Ratio
- 4. Sortino Ratio
- 5. Maximum Drawdown (MDD)
- 6. Value at Risk (VaR)
- 8.5 Composite Diversification Score (0–100)
- expo-status-bar
- Risk Methodology Specification
- 2. Beta (Systematic Risk)
- TestCompositeScoreInvariants
- analytics.controller.ts
- 8.2 Herfindahl-Hirschman Index (HHI)
- @nestjs/swagger
- passport
- swagger-ui-express
- validate-docs-links.js
- expo-notifications
- compute_beta
- @expo/vector-icons
- react
- react-native-gesture-handler
- react-native-safe-area-context
- TestConcentrationRatioBenchmark
- @react-navigation/bottom-tabs
- @react-navigation/native-stack
- tailwindcss
- zod
- TestDiversificationEndpointValidation
- run-benchmarks.js
- TestEffectiveNBenchmark
- @radix-ui/react-avatar
- mock-api.ts
- PinoLoggerService
- web/src/lib/api-client.ts
- @radix-ui/react-tooltip
- react-dom
- react-hook-form
- tailwind-merge
- @testing-library/dom
- EncryptionService
- tailwind.config.ts
- test-runner.js
- TestSectorHhiInvariants
- schemas/risk.py
- CorrelationRequest
- compute_volatility
- WealthCompass Observability & Reliability Operations Guide
- .getMetrics
- .getHoldingValuation
- portfolio-stress-test.js
- main.py
- TestDiversificationScoringThresholds
- analytics-cache-test.js
- TestEffectiveNInvariants
- TestConcentrationRatioInvariants
- next.config.mjs
- next-env.d.ts
- lucide-react
- @radix-ui/react-dropdown-menu
- react
- recharts
- @tanstack/react-query
- @tanstack/react-query-devtools
- RiskScreen.tsx
- 4. Benchmark Comparison Metrics
- compute_correlation_matrix
- AlertEventListener
- validate-workflows.js
- 3. Extended Internal Rate of Return (XIRR)
- react-native-screens
- bullmq
- @investor-pm/config
- @investor-pm/types
- @nestjs/common
- @nestjs/config
- passport-jwt
- pino
- rxjs
- @types/papaparse
- services/analytics/**init**.py
- analytics/observability.py
- JwtRefreshStrategy
- ObservabilityModule
- RiskSummaryRequest

## God Nodes (most connected - your core abstractions)

1. `compute_diversification()` - 110 edges
2. `Acceptance Criteria` - 52 edges
3. `PrismaService` - 45 edges
4. `AllocationWeight` - 30 edges
5. `CashFlow` - 30 edges
6. `compute_drawdown()` - 29 edges
7. `compute_var()` - 27 edges
8. `compute_xirr()` - 27 edges
9. `compute_rebalance()` - 25 edges
10. `cn()` - 25 edges

## Surprising Connections (you probably didn't know these)

- `TestAllocationRouterHappyPath` --uses--> `GroupBy` [INFERRED]
  apps/quant-engine/tests/test_allocation.py → apps/quant-engine/src/analytics/allocation.py
- `TestAllocationRouterValidation` --uses--> `GroupBy` [INFERRED]
  apps/quant-engine/tests/test_allocation.py → apps/quant-engine/src/analytics/allocation.py
- `TestComputeAllocationUnit` --uses--> `GroupBy` [INFERRED]
  apps/quant-engine/tests/test_allocation.py → apps/quant-engine/src/analytics/allocation.py
- `TestAllocationRouterHappyPath` --uses--> `PositionRecord` [INFERRED]
  apps/quant-engine/tests/test_allocation.py → apps/quant-engine/src/analytics/allocation.py
- `TestAllocationRouterValidation` --uses--> `PositionRecord` [INFERRED]
  apps/quant-engine/tests/test_allocation.py → apps/quant-engine/src/analytics/allocation.py

## Import Cycles

- None detected.

## Communities (234 total, 59 thin omitted)

### Community 0 - "provider-ingestion.service.ts"

Cohesion: 0.09
Nodes (16): ManualEntryAdapter, Injectable, MockBrokerProviderAdapter, Injectable, ConnectAccountDto, ImportCsvDto, SyncProviderDto, CsvColumnMapping (+8 more)

### Community 1 - "PRODUCT_DISCOVERY.md"

Cohesion: 0.07
Nodes (80): 10.1 Technical Risks, 10.2 Business Risks, 10.3 Key Assumptions, 10. Risk & Assumptions Log, 11.1 Product Metrics, 11.2 Technical Metrics, 11.3 Business Metrics, 11.4 Risk & Safety Metrics (+72 more)

### Community 2 - "PRD.md"

Cohesion: 0.10
Nodes (60): 1.1 User Story Format, 1.2 Epic Codes, 1.3 Personas Quick Reference, 1. Document Conventions, 2. Epic 1 — Auth & User Preference Management, 3. Epic 2 — Multi-Provider Data Ingestion & Transaction Recording, 4. Epic 3 — Deterministic Valuation & Holding Engine, 5. Epic 4 — Performance & Risk Analytics Dashboard (+52 more)

### Community 3 - "auth.module.ts"

Cohesion: 0.07
Nodes (30): ArgonService, Injectable, AuthController, COOKIE_OPTIONS, Body, Controller, Get, HttpCode (+22 more)

### Community 4 - "Negative / Trade-offs"

Cohesion: 0.05
Nodes (87): ADR-0001: Monorepo Strategy, Compliance Check, Consequences, Constraints, Context, Decision, Directory Layout, Negative / Trade-offs (+79 more)

### Community 5 - "ARCHITECTURE.md"

Cohesion: 0.12
Nodes (45): 10. Observability Architecture, 11. Architecture Decision Records (ADR) Summary, 12. Open Questions Resolved, 1.1 Guiding Principles, 1.2 Architectural Pattern: Modular Monolith + Quant Microservice, 1. System Overview & Architectural Philosophy, 2. Technology Stack Decisions, 3.1 Level 1 — System Context Diagram (+37 more)

### Community 6 - "compilerOptions"

Cohesion: 0.07
Nodes (26): compilerOptions, allowSyntheticDefaultImports, baseUrl, declaration, emitDecoratorMetadata, experimentalDecorators, forceConsistentCasingInFileNames, incremental (+18 more)

### Community 7 - "package.json"

Cohesion: 0.08
Nodes (26): husky, lint-staged, devDependencies, husky, lint-staged, prettier, turbo, engines (+18 more)

### Community 8 - "DATABASE.md"

Cohesion: 0.16
Nodes (24): 1. Overview & Technology Selection, 2. Entity-Relationship Diagram (ERD), 3. Financial Precision Standards, 4. Audit Fields & Soft Deletion Strategy, 5.1 Identity & Access Domain, 5.2 Portfolio & Ingestion Domain, 5.3 Asset & Position Domain, 5.4 Analytics, Valuation & Alert Domain (+16 more)

### Community 9 - "compute_drawdown"

Cohesion: 0.07
Nodes (24): compute_drawdown(), DrawdownResult, Maximum Drawdown Calculator ============================= Pure-math module for…, Compute the Maximum Drawdown from either a daily return series or a NAV series.…, Maximum Drawdown computation output. Attributes ---------- asset_id : Portfolio…, Convert a series of simple daily returns to a cumulative NAV curve., _returns_to_nav(), Risk Analytics Sub-Package for the Wealth Compass Quant Engine. This package… (+16 more)

### Community 10 - "compilerOptions"

Cohesion: 0.10
Nodes (20): packages/config/*, packages/config/src/index.ts, packages/shared-types/src/index.ts, packages/ui-components/src/index.ts, compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames (+12 more)

### Community 11 - "PortfolioService"

Cohesion: 0.09
Nodes (25): PortfolioController, Body, Controller, Delete, Get, HttpCode, Param, Post (+17 more)

### Community 13 - "devDependencies"

Cohesion: 0.06
Nodes (33): devDependencies, jest, @nestjs/testing, prisma, supertest, ts-jest, ts-node, ts-node-dev (+25 more)

### Community 14 - "src/analytics/**init**.py"

Cohesion: 0.06
Nodes (36): _annualised_std(), BenchmarkMetrics, compute_benchmark_metrics(), _daily_returns(), _downside_std(), Benchmark Comparison Analytics =============================== Mathematical…, Full set of benchmark-relative performance metrics. All return metrics are…, Converts a price series into a series of daily simple returns. r_t = (P_t -… (+28 more)

### Community 15 - "PROJECT_STATE.md"

Cohesion: 0.27
Nodes (18): Architecture Snapshot (Phase 1 Assumptions), Asset Class Tracking, Changelog, Deliverables Produced, Deliverables Produced, Document Registry, Financial Edge Cases Formally Specified, Key Decisions Made in Phase 1 (+10 more)

### Community 16 - "outputs"

Cohesion: 0.14
Nodes (15): ^build, out/**, dependsOn, outputs, cache, persistent, dist/**, dependsOn (+7 more)

### Community 17 - "_post"

Cohesion: 0.07
Nodes (22): _post(), Integration tests for POST /api/v1/performance/xirr…, TC-B04: Five-year multi-cashflow portfolio. Verifies NPV at solution is within…, Response must include solver diagnostics., Custom guess=0.50 should still produce the same XIRR as default., xirr_pct must equal xirr × 100 exactly., Validate convergence fallback and input validation error paths., Single cash flow → Pydantic min_length=2 catches it (422) before route handler… (+14 more)

### Community 18 - "Analytics Methodology"

Cohesion: 0.12
Nodes (15): 1. Overview & Design Principles, 2.1 Purpose, 2.2 Sub-Period Boundary Rule, 2.3 Modified Dietz Sub-Period Return, 2.4 Chain-Linking, 2.5 Annualisation, 2.6 TWR vs MWR — When to Use Each, 2. Time-Weighted Return (TWR) (+7 more)

### Community 19 - "compute_diversification"

Cohesion: 0.06
Nodes (24): compute_diversification(), Compute portfolio diversification and concentration metrics. Parameters…, End-to-end validation of canonical portfolio archetypes per RISK_METHODOLOGY.md…, TASK REQUIREMENT: single-stock portfolio HHI > 8,000. (HHI = 10,000)., Per RISK_METHODOLOGY.md §8.8 (Single-asset special case): comp_a = 100 (Neff/N…, Single-stock: no pairs → weighted_avg_correlation = None., TASK REQUIREMENT: concentrated portfolio receives appropriately low score.…, 80%-dominant: HHI > 6,000 ('Very concentrated' range). (+16 more)

### Community 20 - "3. Detailed Table Specifications"

Cohesion: 0.08
Nodes (25): 1.1 Precision Tiers, 1.2 System Audit Conventions, 1. Overview & Financial Precision Standards, 2. Entity Model Catalog, 3.10 `portfolio_snapshots`, 3.11 `risk_metric_snapshots`, 3.12 `alert_rules`, 3.13 `alert_logs` (+17 more)

### Community 21 - "3. Deep-Dive Security Controls & Mitigations"

Cohesion: 0.06
Nodes (34): 1. Executive Summary, 2. Threat Model & Trust Boundaries, 3.1. Insecure Direct Object Reference (IDOR) & Broken Access Control (OWASP A01), 3.2. Cryptographic Failures & Credential Storage at Rest (OWASP A02), 3.3. Zero-Sensitive Logging & Observability Pipeline Hardening (OWASP A09), 3.4. SQL, NoSQL & Command Injection (OWASP A03), 3.5. Cross-Site Scripting (XSS) & Content Security Policy (OWASP A03 / A05), 3.6. Cross-Site Request Forgery (CSRF) & Session Security (+26 more)

### Community 22 - "CoinGeckoProvider"

Cohesion: 0.07
Nodes (20): BatchPriceResult, CircuitBreakerConfig, CircuitBreakerState, MarketDataProvider, ProviderUnavailableException, AlphaVantageGlobalQuote, CoinGeckoPriceResponse, CoinGeckoProvider (+12 more)

### Community 23 - "AnalyticsCacheManager"

Cohesion: 0.09
Nodes (14): AnalyticsCacheManager, CacheStats, MemoryEntry, Injectable, OnEvent, Optional, AnalyticsCacheInterceptor, CACHE_SCOPE_METADATA (+6 more)

### Community 24 - "scripts"

Cohesion: 0.17
Nodes (11): name, private, scripts, build, dev, lint, start, test (+3 more)

### Community 25 - "workers/package.json"

Cohesion: 0.14
Nodes (13): dependencies, @investor-pm/api, @investor-pm/types, @investor-pm/types, name, private, scripts, build (+5 more)

### Community 26 - "ui-components/package.json"

Cohesion: 0.12
Nodes (15): dependencies, @investor-pm/types, @investor-pm/types, react, main, name, peerDependencies, react (+7 more)

### Community 27 - "MarketDataService"

Cohesion: 0.11
Nodes (16): PriceQuote, ASSET_CLASS_TTL_MAP, buildPriceCacheKey(), buildPriceMetaKey(), CACHE_TTL, CachedPriceEntry, PRICE_CACHE_KEY_PREFIX, PriceCacheMetadata (+8 more)

### Community 28 - "JwtAuthGuard"

Cohesion: 0.10
Nodes (14): JwtAuthGuard, Injectable, MarketDataController, Body, Controller, Get, HttpCode, Param (+6 more)

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

Cohesion: 0.18
Nodes (10): Accessing Running Services, 🧪 Automated Testing & Verification, 🔄 CI/CD Automation & Build Pipelines, ✨ Key Platform Capabilities, 📄 License, 📚 Living Documentation Suite, 🚀 Overview, 🚀 Quick Start (3-Command Boot) (+2 more)

### Community 34 - "TestComponentScoresBenchmark"

Cohesion: 0.08
Nodes (14): Verify Component A, Component B, and composite score against hand traces. Score…, 3-asset 50/30/20: comp_a = 87.7193., Without correlation data: comp_b = 50 (neutral assumption)., Score = 0.60×87.7193 + 0.40×50 = 72.6316., 5-asset equal-weight with known matrix: rho_bar = 0.22., rho_bar=0.22 → comp_b = (1-0.22)/2 × 100 = 39.0., Score = 0.60×100 + 0.40×39.0 = 75.6., Key boundary archetype (RISK_METHODOLOGY.md §8.5.6): 20-asset equal-weight with… (+6 more)

### Community 35 - "docker-compose.yml"

Cohesion: 0.29
Nodes (6): Service: adminer, Service: investor_pm_network, Service: pgdata, Service: postgres, Service: redis, Service: redisdata

### Community 36 - "env.ts"

Cohesion: 0.38
Nodes (4): EnvConfig, envSchema, validateEnv(), runTests()

### Community 37 - "valuation.engine.ts"

Cohesion: 0.13
Nodes (21): CalculatorModule, Module, CurrencyAmount, CurrencyConverterService, Injectable, AssetAllocationDto, PortfolioValuationSummaryDto, PositionValuationDto (+13 more)

### Community 38 - "Troubleshooting & Diagnostics Runbook — Wealth Compass Platform"

Cohesion: 0.08
Nodes (24): 1. Quick Diagnostic Cheat Sheet, 2.1 Issue: Port Collision (`5432` or `6379` already in use), 2.2 Issue: Docker Volume Corruption or Permission Errors, 2. Environment & Container Infrastructure, 3.1 Issue: Schema Drift & Migration Desynchronization, 3.2 Issue: Database Connection Pool Exhaustion, 3. Database & Prisma ORM, 4.1 Issue: BullMQ Jobs Stalled or Not Processing (+16 more)

### Community 44 - "AnalyticsClientService"

Cohesion: 0.15
Nodes (12): AnalyticsClientService, Injectable, AnalyticsModule, Module, AnalyticsController, Controller, UseGuards, UseInterceptors (+4 more)

### Community 45 - "alerts/page.tsx"

Cohesion: 0.13
Nodes (27): LoginForm, loginSchema, RegisterForm, registerSchema, AlertForm, AlertRule, alertSchema, alertTypeLabels (+19 more)

### Community 46 - "test_diversification.py"

Cohesion: 0.07
Nodes (31): _component_a(), _component_b(), _compute_hhi(), ConcentrationRatio, DiversificationResult, Diversification & Concentration Analytics Engine…, Single Top-N concentration ratio result. Attributes ---------- n : The top-N…, Comprehensive diversification and concentration analytics output. Attributes… (+23 more)

### Community 47 - "routers/risk.py"

Cohesion: 0.16
Nodes (15): Routers sub-package — FastAPI router modules for all analytics endpoints., compute_risk_summary(), _map_var_estimate(), Risk Analytics Router ===================== Exposes four computation endpoints:…, POST /api/v1/risk/summary Accepts a daily return series for a portfolio and…, BetaDto, DrawdownDto, A single Value at Risk estimate for one method and one confidence level. (+7 more)

### Community 48 - "charts/index.ts"

Cohesion: 0.11
Nodes (37): AllocationDonutChart(), AllocationDonutChartProps, AllocationSlice, CenterLabel(), CustomTooltip(), BenchmarkComparisonChart(), BenchmarkComparisonChartProps, BenchmarkDataPoint (+29 more)

### Community 50 - "compute_allocation"

Cohesion: 0.09
Nodes (26): AllocationBucket, AllocationResult, compute_allocation(), PositionRecord, Asset Allocation Aggregation Engine ===================================== Pure-…, Full allocation breakdown result for a portfolio. Attributes ----------…, Return the classification label for the position on the requested dimension., Aggregate portfolio positions into allocation buckets by the given dimension.… (+18 more)

### Community 53 - "dependencies"

Cohesion: 0.07
Nodes (29): dependencies, argon2, axios, cookie-parser, decimal.js, helmet, @nestjs/event-emitter, @nestjs/passport (+21 more)

### Community 54 - "src/observability.py"

Cohesion: 0.12
Nodes (12): Any, QuantEngineMetrics, Quant Engine Observability Module ================================= Provides: -…, Lightweight in-process Prometheus metrics accumulator., Renders metrics in Prometheus text exposition format., Recursively redacts sensitive keys and values from dictionaries and strings., Formats log records as single-line JSON objects., Configures root logger with the structured JSON formatter. (+4 more)

### Community 55 - "analytics.dto.ts"

Cohesion: 0.12
Nodes (20): AllocationBucketDto, AllocationGroupBy, AllocationRequestDto, AllocationWeightItem, AllocationWeightItemDto, BenchmarkRequestDto, CashFlowItemDto, ConcentrationRatioDto (+12 more)

### Community 56 - "ProviderIngestionService"

Cohesion: 0.14
Nodes (12): ProviderController, Body, Controller, Delete, Get, HttpCode, Param, Post (+4 more)

### Community 58 - "market-data.module.ts"

Cohesion: 0.15
Nodes (11): MARKET_DATA_JOBS, MARKET_DATA_QUEUE, MarketDataModule, Module, FetchCryptoPricesJobPayload, FetchEquityPricesJobPayload, FetchSinglePriceJobPayload, MarketDataProcessor (+3 more)

### Community 59 - "config/tsconfig.json"

Cohesion: 0.22
Nodes (8): compilerOptions, declaration, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.json

### Community 60 - "GroupBy"

Cohesion: 0.14
Nodes (27): GroupBy, Supported portfolio allocation breakdown dimensions., compute_allocation_endpoint(), compute_rebalance_endpoint(), post, Allocation analytics router. Exposes two computation endpoints: POST…, POST /api/v1/allocation/rebalance Accepts current allocation percentages and…, POST /api/v1/allocation/breakdown Accepts a list of portfolio positions with… (+19 more)

### Community 61 - "test_quant_benchmarks.py"

Cohesion: 0.07
Nodes (22): compute_sharpe(), Sharpe Ratio Calculator ======================== Pure-math module for computing…, Sharpe Ratio computation output. Attributes ---------- asset_id : Portfolio or…, Compute the annualised Sharpe Ratio from a series of daily returns. Algorithm…, SharpeResult, Quantitative Analytics Benchmark Verification Suite…, Validates quantitative risk metrics against R package 'PerformanceAnalytics'…, Benchmark: R PerformanceAnalytics::VaR(R, p=0.95, method="historical") With 20… (+14 more)

### Community 64 - "AllocationWeight"

Cohesion: 0.08
Nodes (26): AllocationWeight, compute_rebalance(), Portfolio Rebalance Drift Calculation Engine…, Complete rebalance calculation result. Attributes ---------- portfolio_id :…, Compute portfolio drift and required buy/sell amounts to reach target weights.…, A single bucket weight entry for rebalance input. Attributes ---------- label :…, Rebalance calculation result for a single allocation bucket. Attributes…, RebalanceBucket (+18 more)

### Community 67 - "alert-evaluator.engine.ts"

Cohesion: 0.16
Nodes (21): ConcentrationRuleEvaluator, ConcentrationViolation, Injectable, DrawdownRuleEvaluator, Injectable, DriftViolation, NOTE: This evaluator expects targetWeights keys to match assetWeights keys, TargetDriftRuleEvaluator (+13 more)

### Community 68 - "_post"

Cohesion: 0.12
Nodes (16): _build_payload(), _post(), Integration tests for POST /api/v1/performance/benchmark…, Manual β verification: β = Cov(r_p, r_b) / Var(r_b) computed via NumPy and…, alpha_annualised_pct must equal alpha_annualised × 100., Verify 400/422 responses for invalid inputs., Unequal length series → Pydantic model_validator → 422., Two prices (one return) → insufficient for statistics → 400. (+8 more)

### Community 70 - "WealthCompass Cloud Infrastructure & Deployment Guide"

Cohesion: 0.11
Nodes (18): 1.1 Network Topology & Security Tiering, 1. Cloud Architecture Overview, 2. Infrastructure-as-Code Directory Structure, 3.1 RDS PostgreSQL Multi-AZ, 3.2 ElastiCache Redis Replication Group, 3.3 ECS Fargate Target Tracking Auto-Scaling, 3. High Availability & Auto-Scaling Specification, 4. Bootstrapping Remote State & DynamoDB Locking (+10 more)

### Community 72 - "main.ts"

Cohesion: 0.06
Nodes (24): AppModule, Module, PaginationQueryDto, SortOrder, IsEnum, IsInt, IsOptional, IsString (+16 more)

### Community 74 - "MetricsService"

Cohesion: 0.13
Nodes (7): MetricsInterceptor, Injectable, MetricsService, Injectable, getActiveTraceContext(), DEFAULT_REDACT_KEYS, SentryEvent

### Community 77 - "TestHhiBenchmark"

Cohesion: 0.08
Nodes (14): _normalise_weights(), Validate and normalise asset weights to sum exactly to 1.0. Accepts fractions…, Normalised weights must sum exactly to 1.0., Zero-weight entries excluded from normalised dict., Verify HHI against hand-derived reference values. Formula: HHI = Σ (w_i × 100)²…, 3-asset 50/30/20 — trace: 2500+900+400 = 3800., 5 equal-weight at 20% — HHI = 5 × 400 = 2000., 20 equal-weight at 5% — HHI = 20 × 25 = 500. (+6 more)

### Community 78 - "CashFlow"

Cohesion: 0.06
Nodes (44): _brent_dekker(), CashFlow, compute_xirr(), _newton_raphson(), _npv(), _npv_derivative(), Extended Internal Rate of Return (XIRR) — Numerical Root-Finding Engine…, Output of the XIRR computation. Attributes ---------- xirr: Annualised XIRR as… (+36 more)

### Community 79 - "_post"

Cohesion: 0.11
Nodes (15): _post(), Integration tests for POST /api/v1/performance/twr…, twr_annualised must be non-None for multi-day windows., Single sub-period with a mid-period deposit. BMV=100, EMV=215, deposit 100 on…, Ensure all expected response fields are present., Verify 400 responses for bad inputs., Pydantic min_length=1 on sub_periods → 422 Unprocessable Entity., Sub-period with end_date < start_date must return 400 or 422. (+7 more)

### Community 80 - "compute_correlation"

Cohesion: 0.09
Nodes (20): compute_correlation(), _compute_stats(), CorrelationResult, _pearson(), Pairwise Asset Correlation Matrix Calculator…, Compute Pearson correlation coefficient between two aligned return series.…, Compute the pairwise Pearson correlation matrix for a set of assets. Algorithm…, Pairwise Pearson correlation matrix output. Attributes ---------- asset_ids :… (+12 more)

### Community 81 - "date"

Cohesion: 0.05
Nodes (65): CashFlowEvent, compute_twr(), _modified_dietz(), Time-Weighted Return (TWR) — Sub-Period Compounding Engine…, Output of the TWR computation. Attributes ---------- twr_cumulative: Cumulative…, Computes the Modified Dietz return for a single sub-period. Formula: R = (EMV -…, Computes the Time-Weighted Return (TWR) via sub-period chain-linking. The…, An external cash flow event within a sub-period. Attributes ---------- date:… (+57 more)

### Community 82 - "Performance Benchmark & Database Optimization Report"

Cohesion: 0.11
Nodes (17): 1. Executive Summary, 2.1 Analytics Cache Manager (`AnalyticsCacheManager`), 2.2 Declarative NestJS Cache Interceptor (`@CacheableAnalytics`), 2.3 PostgreSQL & Prisma Query Path Tuning, 2. Optimization Architecture, 3.1 Suite 1: 1,000 Concurrent VU Stress Test (`scripts/k6/portfolio-stress-test.js`), 3.2 Suite 2: Analytics Cache Invalidation & Acceleration Suite (`scripts/k6/analytics-cache-test.js`), 3. Load Testing Methodology & Scenarios (+9 more)

### Community 83 - "mock-benchmark-server.js"

Cohesion: 0.16
Nodes (10): BenchmarkCacheManager, cacheManager, computeDiversification(), computeValuation(), holdings, http, portfolios, server (+2 more)

### Community 85 - "CreateTransactionDto"

Cohesion: 0.08
Nodes (22): TransactionController, Body, Controller, Get, HttpCode, Param, Post, Req (+14 more)

### Community 91 - "[id]/page.tsx"

Cohesion: 0.26
Nodes (12): AlertsPage(), Holding, PortfolioDetail, PortfolioDetailPage(), PortfoliosPage(), StatCard(), StatCardProps, Skeleton() (+4 more)

### Community 92 - "app.module.ts"

Cohesion: 0.21
Nodes (12): CryptoModule, Global, Module, AuthModule, Module, PortfolioModule, Module, ProvidersModule (+4 more)

### Community 93 - "alert.module.ts"

Cohesion: 0.12
Nodes (13): RuleEvaluationSummary, HoldingUpdatedEvent, PortfolioUpdatedEvent, AlertModule, Module, ALERT_JOBS, ALERT_NOTIFICATION_QUEUE, DispatchNotificationPayload (+5 more)

### Community 94 - "expo"

Cohesion: 0.06
Nodes (32): backgroundColor, foregroundImage, adaptiveIcon, package, permissions, expo, android, assetBundlePatterns (+24 more)

### Community 95 - "compute_var"

Cohesion: 0.09
Nodes (18): compute_var(), _quantile(), Value at Risk (VaR) Calculator ================================ Pure-math…, Full VaR computation output covering both methods and both confidence levels.…, Compute the p-th quantile of a pre-sorted list using linear interpolation…, Compute Value at Risk using both Parametric and Historical Simulation methods.…, VaRResult, Parametric VaR uses z-scores: z_0.95 = 1.6448536, z_0.99 = 2.3263479. VaR_param… (+10 more)

### Community 96 - "_post"

Cohesion: 0.10
Nodes (18): _post(), Tests for the allocation analytics engine and HTTP router.…, Full HTTP integration tests for the allocation breakdown endpoint., Standard multi-asset portfolio grouped by asset_class., Sector grouping: missing sector → 'Unassigned / Other'., Geography grouping: 60/30/10 split., Currency grouping: INR/USD/BTC split., Provider grouping: ZERODHA/BINANCE/MANUAL split. (+10 more)

### Community 97 - "_post"

Cohesion: 0.10
Nodes (17): _post(), Tests for the rebalance analytics engine and HTTP router.…, Full HTTP integration tests for the rebalance endpoint., All current == target → requires_rebalance = False., Equity 50% → 60%: buy = 10% × 500,000 = 50,000., HTTP response: total_buy_amount must equal total_sell_amount., Tolerance of 5% — drifts within 5% are in_tolerance., Schema completeness — all expected response fields present. (+9 more)

### Community 98 - "devDependencies"

Cohesion: 0.07
Nodes (29): devDependencies, autoprefixer, jsdom, @playwright/test, postcss, tailwindcss, @testing-library/jest-dom, @testing-library/react (+21 more)

### Community 99 - "compilerOptions"

Cohesion: 0.07
Nodes (26): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+18 more)

### Community 100 - "ExcelExportService"

Cohesion: 0.07
Nodes (26): GenerateCsvReportDto, GeneratePdfReportDto, IsEnum, IsOptional, IsUUID, AuthRequest, ReportController, Body (+18 more)

### Community 101 - "risk/page.tsx"

Cohesion: 0.11
Nodes (16): metadata, metrics, sampleBenchmarkData, sampleEquityData, metadata, quickLinks, metadata, riskMetrics (+8 more)

### Community 102 - "Endpoints"

Cohesion: 0.07
Nodes (30): Alerts `/api/v1/alerts`, Analytics `/api/v1/analytics`, API Contract — Wealth Compass REST API v1, API Versioning, Auth `/api/v1/auth`, Authentication, Deep Readiness Probe (`GET /health/readiness`), Endpoints (+22 more)

### Community 103 - "transaction.service.ts"

Cohesion: 0.22
Nodes (5): InsufficientCashException, InsufficientHoldingException, HoldingService, Injectable, Optional

### Community 104 - "TestDiversificationEndpointSmoke"

Cohesion: 0.08
Nodes (13): HTTP smoke tests for POST /api/v1/risk/diversification., Minimal valid request (weights only, no correlation) → HTTP 200., Response must contain all required fields., portfolio_id in response must match request., hhi_sector = null in response when sector_weights not in request., weighted_avg_correlation = null when no correlation_matrix provided., When sector_weights provided, hhi_sector is not null., With a valid correlation matrix, correlation_data_used = true. (+5 more)

### Community 105 - "dependencies"

Cohesion: 0.08
Nodes (25): dependencies, axios, class-variance-authority, clsx, @hookform/resolvers, next, next-themes, @radix-ui/react-dialog (+17 more)

### Community 106 - "PrismaService"

Cohesion: 0.09
Nodes (14): JwtPayload, JwtStrategy, Injectable, Optional, GenerateReportPayload, REPORT_GENERATION_QUEUE, REPORT_JOBS, ReportJobType (+6 more)

### Community 107 - "AlertController"

Cohesion: 0.23
Nodes (12): AlertController, Body, Controller, Delete, Get, HttpCode, Param, Post (+4 more)

### Community 108 - "AlertService"

Cohesion: 0.29
Nodes (3): AlertService, Injectable, AlertRuleResponseDto

### Community 109 - "PdfReportService"

Cohesion: 0.11
Nodes (16): AllocationEntry, formatINR(), formatPct(), HoldingRow, pdfFonts, pdfMake, PdfReportService, pnlColor() (+8 more)

### Community 110 - "dependencies"

Cohesion: 0.12
Nodes (17): dependencies, axios, expo, expo-constants, expo-secure-store, nativewind, react-native, @react-navigation/native (+9 more)

### Community 111 - "alert.service.ts"

Cohesion: 0.15
Nodes (19): AuthRequest, AlertRuleRecord, EVALUABLE_ALERT_TYPES, AlertLogResponseDto, CreateAlertRuleDto, EvaluateAlertDto, IsBoolean, IsEnum (+11 more)

### Community 112 - "compute_sortino"

Cohesion: 0.14
Nodes (11): compute_sortino(), Sortino Ratio Calculator ========================= Pure-math module for…, Compute the annualised Sortino Ratio from a series of daily returns. Algorithm…, Sortino Ratio computation output. Attributes ---------- asset_id : Portfolio or…, SortinoResult, Sortino Ratio = (R_a - rf_annual) / σ_DD_a σ_DD² = Σ[min(r_i - MAR_daily, 0)²]…, Dataset A has 3 days below the MAR (days 3, 4, 8)., When upside volatility is high, Sortino > Sharpe because Sharpe penalises both… (+3 more)

### Community 113 - "Developer Onboarding & Setup Guide — Wealth Compass Platform"

Cohesion: 0.11
Nodes (18): 1. System Requirements & Prerequisites, 2. Quick Start (3-Command Boot), 3. Comprehensive Step-by-Step Setup, 4. Running the Development Stack, 5.1 Run Automated Tests, 5.2 Deep Health & Readiness Probe, 5. Verification & Testing, 6. Recommended Developer Tooling (+10 more)

### Community 114 - "devDependencies"

Cohesion: 0.13
Nodes (15): devDependencies, @babel/core, babel-jest, jest, jest-expo, @testing-library/react-native, @types/react, typescript (+7 more)

### Community 115 - "otel-tracer.ts"

Cohesion: 0.19
Nodes (8): otelTracer, sanitizeAttributes(), SENSITIVE_ATTRIBUTE_PATTERNS, setActiveTraceContext(), SimpleSpan, Span, traceAsyncOperation(), TraceContext

### Community 116 - "PortfoliosScreen.tsx"

Cohesion: 0.25
Nodes (9): MetricCard(), MetricCardProps, styles, classifyDelta(), formatCurrency(), formatPercent(), Portfolio, PortfoliosScreen() (+1 more)

### Community 117 - "TestRiskPropertyInvariants"

Cohesion: 0.14
Nodes (8): Financial invariants that must hold for ANY valid return series., MDD is always ≤ 0 by definition., 99% VaR ≥ 95% VaR regardless of return distribution., Volatility is non-negative for any input., ρ_ii = 1.0 regardless of the return distribution., When annualised return > rf_annual → Sortino > 0., An asset with constant return has zero covariance with anything → β = 0., TestRiskPropertyInvariants

### Community 118 - "AuthContext.tsx"

Cohesion: 0.22
Nodes (7): AuthContext, AuthContextValue, AuthProvider(), AuthUser, clearAll(), getUser(), saveUser()

### Community 119 - "MainTabs.tsx"

Cohesion: 0.22
Nodes (10): useAuth(), IoniconName, MainTabParamList, Tab, TAB_ICONS, DashboardScreen(), DashboardSummary, styles (+2 more)

### Community 120 - "scripts"

Cohesion: 0.17
Nodes (11): name, private, scripts, build, dev, lint, prisma:generate, prisma:migrate (+3 more)

### Community 121 - "TestEdgeCasesAndErrorHandling"

Cohesion: 0.09
Nodes (12): n_assets counts only assets with weight > threshold., Error handling, boundary inputs, and degenerate portfolio configurations., Empty asset_weights dict must raise ValueError., All-zero weights must raise ValueError., Negative entries stripped; remaining positives proceed normally., All-negative weights raise ValueError after stripping., Providing correlation_matrix but not correlation_asset_ids: The engine requires…, Providing correlation_asset_ids but not correlation_matrix: The engine silently… (+4 more)

### Community 122 - "TestHhiInvariants"

Cohesion: 0.17
Nodes (7): HHI must satisfy hard mathematical bounds in all cases., HHI > 0 for any non-trivial portfolio., HHI ≤ 10,000 for all portfolios., Single asset → HHI = 10,000 (exact upper bound)., Adding more equal-weight assets must monotonically decrease HHI., HHI for N equal-weight assets = 10,000/N (closed-form)., TestHhiInvariants

### Community 123 - "mobile/package.json"

Cohesion: 0.18
Nodes (10): main, name, private, scripts, android, ios, lint, start (+2 more)

### Community 124 - "AlertsScreen.tsx"

Cohesion: 0.24
Nodes (8): EmptyState(), EmptyStateProps, styles, formatDate(), AlertRule, AlertsScreen(), styles, TYPE_LABELS

### Community 125 - "AuthStack.tsx"

Cohesion: 0.24
Nodes (8): AuthStack(), AuthStackParamList, Stack, LoginScreen(), Props, styles, RegisterScreen(), mockNavigation

### Community 126 - "include"

Cohesion: 0.18
Nodes (10): compilerOptions, paths, strict, extends, include, **/_.ts, \**/_.tsx, expo-env.d.ts (+2 more)

### Community 127 - "8. Diversification & Concentration Analytics"

Cohesion: 0.18
Nodes (11): 8.1 Definition, 8.3.1 Formula, 8.3.2 Interpretation, 8.3 Effective N (Equivalent Equal-Weight Portfolio Size), 8.4.1 Formula, 8.4.2 Default Cut-offs and Risk Thresholds, 8.4 Top-N Concentration Ratios, 8.6 Parameters (+3 more)

### Community 128 - "Technical Debt & Architectural Backlog — Wealth Compass Platform"

Cohesion: 0.10
Nodes (19): 1. Overview & Debt Philosophy, 2. Architectural & Service Boundary Debt, 3. Database & TimescaleDB Optimization Debt, 4. Financial Quantitative Edge Cases & Numerical Limitations, 5. Frontend & Mobile Optimization Debt, 6. Operational, Security & Infrastructure Debt, 7. Prioritized Technical Debt Backlog, TD-ARCH-01: Co-Location of Background Workers inside `apps/api` (+11 more)

### Community 129 - "AlertEvaluatorEngine"

Cohesion: 0.31
Nodes (3): AlertEvaluatorEngine, Injectable, InjectQueue

### Community 130 - "health.service.ts"

Cohesion: 0.21
Nodes (10): ApiTags, HealthController, Controller, HealthModule, Module, ComponentHealth, HealthService, LivenessResult (+2 more)

### Community 131 - "app/layout.tsx"

Cohesion: 0.33
Nodes (5): inter, metadata, Providers(), getQueryClient(), makeQueryClient()

### Community 132 - "index.tsx"

Cohesion: 0.39
Nodes (5): App(), setUnauthorizedHandler(), getQueryClient(), RootNavigator(), MainTabs()

### Community 133 - "7. Pairwise Asset Correlation Matrix"

Cohesion: 0.25
Nodes (8): 7.1 Definition, 7.2 Formula, 7.3 Parameters, 7.4 Interpretation, 7.5 Diversification Rule of Thumb, 7.6 Special Cases, 7.7 Limitations, 7. Pairwise Asset Correlation Matrix

### Community 134 - "Production Readiness Review & Final Sign-Off — Wealth Compass Platform"

Cohesion: 0.11
Nodes (17): 1.1 Structural Modularization & Monorepo Topology, 1.2 Type Safety & Static Analysis, 1. Architecture & Code Quality Audit, 2.1 Cryptographic Storage & Encryption at Rest, 2.2 OWASP Top 10 (2021) Compliance Matrix, 2. Security, Cryptography & Compliance Certification, 3.1 Mathematical Soundness & Precision Standards, 3. Quantitative Analytics & Financial Correctness Audit (+9 more)

### Community 135 - "mobile/src/lib/api-client.ts"

Cohesion: 0.38
Nodes (4): apiClient, ApiError, Props, styles

### Community 136 - "TestRiskSummaryEndpoint"

Cohesion: 0.22
Nodes (4): Integration endpoint must produce identical results to standalone modules., When all returns exceed the MAR, Sortino = +inf → router normalises to 9999.0., Integration tests for POST /api/v1/risk/summary., TestRiskSummaryEndpoint

### Community 137 - "TestDrawdownSeriesEndpoint"

Cohesion: 0.29
Nodes (4): Integration tests for POST /api/v1/risk/drawdown-series., Verify the underwater equity curve for a known NAV series., All-positive return series → entire drawdown series is 0.0., TestDrawdownSeriesEndpoint

### Community 138 - "TestCorrelationEndpoint"

Cohesion: 0.29
Nodes (4): Integration tests for POST /api/v1/risk/correlation., Full Dataset E correlation via HTTP must match standalone module., Series of unequal length → 422 validation error., TestCorrelationEndpoint

### Community 139 - "1. Annualised Volatility"

Cohesion: 0.29
Nodes (7): 1.1 Definition, 1.2 Formula, 1.3 Parameters, 1.4 Convention, 1.5 Interpretation, 1.6 Limitations, 1. Annualised Volatility

### Community 140 - "3. Sharpe Ratio"

Cohesion: 0.29
Nodes (7): 3.1 Definition, 3.2 Formula, 3.3 Parameters, 3.4 Risk-Free Rate Convention, 3.5 Interpretation, 3.6 Limitations, 3. Sharpe Ratio

### Community 141 - "4. Sortino Ratio"

Cohesion: 0.29
Nodes (7): 4.1 Definition, 4.2 Formula, 4.3 Denominator Convention, 4.4 Parameters, 4.5 Interpretation, 4.6 Limitations, 4. Sortino Ratio

### Community 142 - "5. Maximum Drawdown (MDD)"

Cohesion: 0.29
Nodes (7): 5.1 Definition, 5.2 Formula, 5.3 Key Metrics, 5.4 Inputs, 5.5 Interpretation, 5.6 Limitations, 5. Maximum Drawdown (MDD)

### Community 143 - "6. Value at Risk (VaR)"

Cohesion: 0.29
Nodes (7): 6.1 Definition, 6.2 Method 1: Parametric VaR (Variance-Covariance), 6.3 Method 2: Historical Simulation VaR, 6.4 Both Methods: Always Computed, 6.5 Comparison: Parametric vs Historical, 6.6 Limitations, 6. Value at Risk (VaR)

### Community 144 - "8.5 Composite Diversification Score (0–100)"

Cohesion: 0.29
Nodes (7): 8.5.1 Motivation, 8.5.2 Component A — Effective-N Concentration Score, 8.5.3 Component B — Correlation Penalty Score, 8.5.4 Final Composite Score, 8.5.5 Score Interpretation Table, 8.5.6 Validation Archetypes, 8.5 Composite Diversification Score (0–100)

### Community 146 - "Risk Methodology Specification"

Cohesion: 0.33
Nodes (5): Financial Conventions Summary, Minimum Data Requirements, Overview, References, Risk Methodology Specification

### Community 147 - "2. Beta (Systematic Risk)"

Cohesion: 0.33
Nodes (6): 2.1 Definition, 2.2 Formula, 2.3 Parameters, 2.4 Interpretation, 2.5 Limitations, 2. Beta (Systematic Risk)

### Community 148 - "TestCompositeScoreInvariants"

Cohesion: 0.12
Nodes (9): Composite score must satisfy strict mathematical and financial invariants., Diversification score ∈ [0, 100] for all portfolios., α + β = 1.0 (partition of unity constraint)., Score = α × comp_a + β × comp_b holds for all result objects., Both sub-scores ∈ [0, 100]., Component B = 50.0 exactly when correlation data is absent., correlation_data_used = False without matrix; True with matrix., More positively correlated assets must produce lower Component B. (+1 more)

### Community 149 - "analytics.controller.ts"

Cohesion: 0.21
Nodes (12): CacheableAnalytics(), Body, HttpCode, Post, AllocationComputeRequest, AllocationResponseDto, DiversificationComputeRequest, DiversificationResponseDto (+4 more)

### Community 150 - "8.2 Herfindahl-Hirschman Index (HHI)"

Cohesion: 0.40
Nodes (5): 8.2.1 Formula, 8.2.2 Boundary Conditions, 8.2.3 Interpretation, 8.2.4 Sector-Level HHI, 8.2 Herfindahl-Hirschman Index (HHI)

### Community 154 - "validate-docs-links.js"

Cohesion: 0.32
Nodes (7): EXCLUDE_DIRS, extractLinks(), fs, getAllMarkdownFiles(), path, ROOT_DIR, validateLinks()

### Community 156 - "compute_beta"

Cohesion: 0.09
Nodes (16): BetaResult, compute_beta(), Beta Calculator =============== Pure-math module for computing the systematic…, Beta computation output. Attributes ---------- asset_id : Portfolio or security…, Compute the portfolio beta against a benchmark. Algorithm --------- 1.…, Benchmark: R stats::lm(R ~ Benchmark) Beta = Cov(R, R_m) / Var(R_m) Both series…, Beta = Cov(portfolio, benchmark) / Var(benchmark). Dataset A vs Dataset B…, Beta from Dataset A/B must match the closed-form Cov/Var formula. (+8 more)

### Community 161 - "TestConcentrationRatioBenchmark"

Cohesion: 0.09
Nodes (12): Verify Top-N Concentration Ratios (CR_N) against hand-computed values. Formula:…, 3-asset portfolio: CR_3 = 100% (top 3 = all assets)., 3-asset portfolio: CR_5 clips to actual_n=3, weight_pct=100%., 80%-dominant portfolio: CR_1 = 80%., 80%-dominant portfolio: CR_3 = 80+10+5 = 95%., 5-asset portfolio: CR_5 = 100% (all assets included)., Equal-weight 5-asset: CR_3 = 60.0%., Single-asset: all CR_N = 100%, actual_n = 1. (+4 more)

### Community 166 - "TestDiversificationEndpointValidation"

Cohesion: 0.10
Nodes (11): Request validation (422) and business-logic validation (400) tests., Request without portfolio_id → HTTP 422., Request without asset_weights → HTTP 422., Empty asset_weights list → HTTP 422 (min_length=1 constraint)., Negative weight (gt=0 Pydantic constraint) → HTTP 422., Zero weight (gt=0 Pydantic constraint) → HTTP 422., correlation_matrix without correlation_asset_ids → HTTP 422., correlation_asset_ids without correlation_matrix → HTTP 422. (+3 more)

### Community 167 - "run-benchmarks.js"

Cohesion: 0.24
Nodes (9): fs, http, K6_BIN, main(), path, runK6(), SERVER_SCRIPT, { spawn } (+1 more)

### Community 168 - "TestEffectiveNBenchmark"

Cohesion: 0.11
Nodes (10): Verify Effective N = 10,000 / HHI and Effective N % of max., 3-asset 50/30/20: Eff N = 10,000/3800 = 2.6316., Eff N % = 2.6316/3 × 100 = 87.7193., 5 equal-weight assets → Eff N = 5.0 exactly., Equal-weight portfolio → Eff N % = 100.0., 20 equal-weight → Eff N = 20., Single asset → Eff N = 1.0., 80%-dominant → Eff N ≈ 1.53 (much less than N=5). (+2 more)

### Community 170 - "mock-api.ts"

Cohesion: 0.26
Nodes (10): errorEnvelope(), setupMockApi(), successEnvelope(), SEED_ALERTS, SEED_ANALYTICS, SEED_HOLDINGS, SEED_PORTFOLIOS, SEED_REPORTS (+2 more)

### Community 171 - "PinoLoggerService"

Cohesion: 0.16
Nodes (4): PinoLoggerService, Injectable, SentryService, Injectable

### Community 172 - "web/src/lib/api-client.ts"

Cohesion: 0.18
Nodes (10): ThemeToggle(), Header(), HeaderProps, navItems, Sidebar(), apiClient, PaginatedResponse, AuthUser (+2 more)

### Community 178 - "EncryptionService"

Cohesion: 0.17
Nodes (4): EncryptedPayload, EncryptionService, Injectable, Optional

### Community 189 - "test-runner.js"

Cohesion: 0.23
Nodes (12): colors, fs, main(), parseJestSummary(), parsePlaywrightSummary(), parsePytestSummary(), parseVitestSummary(), path (+4 more)

### Community 190 - "TestSectorHhiInvariants"

Cohesion: 0.17
Nodes (7): Sector HHI must satisfy its structural properties., hhi_sector = None when no sector_weights given., hhi_sector is a float when sector_weights are provided., Single sector → sector HHI = 10,000., Two 50/50 sectors → sector HHI = 5,000., 10 technology stocks each at 10% look diversified at asset level (HHI=1,000)…, TestSectorHhiInvariants

### Community 191 - "schemas/risk.py"

Cohesion: 0.19
Nodes (14): compute_diversification_analytics(), POST /api/v1/risk/diversification Accepts asset weights and optional…, AssetReturnSeries, ConcentrationRatioDto, DiversificationAssetWeight, DiversificationRequest, DiversificationResponse, BaseModel (+6 more)

### Community 192 - "CorrelationRequest"

Cohesion: 0.29
Nodes (5): CorrelationRequest, model_validator, Request body for POST /api/v1/risk/correlation. Computes the pairwise Pearson…, All asset return series must have the same length., correlation_matrix and correlation_asset_ids must be both provided or both…

### Community 193 - "compute_volatility"

Cohesion: 0.07
Nodes (20): compute_volatility(), Annualised Volatility Calculator ================================== Pure-math…, Annualised volatility output. Attributes ---------- asset_id : Identifier…, Compute annualised volatility from a series of daily periodic returns.…, VolatilityResult, Verify annualised volatility against hand-computed reference values. Dataset A…, Daily volatility must match hand-computed Bessel-corrected std dev., Annual volatility = daily_vol × √252 with strict tolerance. (+12 more)

### Community 194 - "WealthCompass Observability & Reliability Operations Guide"

Cohesion: 0.15
Nodes (12): 1. Observability Architecture Overview, 2.1 Endpoint Specification, 2.2 Deep Readiness Probe Response Contract, 2. Health Check Probes & Service Readiness, 3. Prometheus Metrics Catalog, 4. Sensitive Data Redaction & Financial Compliance, 5. Grafana Dashboard Models, 6. Incident Response & Troubleshooting Runbooks (+4 more)

### Community 195 - ".getMetrics"

Cohesion: 0.26
Nodes (4): ApiOperation, ApiResponse, Get, Res

### Community 196 - ".getHoldingValuation"

Cohesion: 0.24
Nodes (9): Controller, Get, HttpCode, Param, Query, Req, UseGuards, UseInterceptors (+1 more)

### Community 197 - "portfolio-stress-test.js"

Cohesion: 0.22
Nodes (8): cacheHits, cacheMisses, diversificationDuration, holdingsDuration, options, PORTFOLIO_IDS, successfulRequests, valuationDuration

### Community 198 - "main.py"

Cohesion: 0.20
Nodes (10): health_check(), metrics_endpoint(), metrics_middleware(), get, Quant Engine — FastAPI Application Entry Point…, Liveness probe for container orchestration., Prometheus metrics exporter for the Quant Engine., middleware (+2 more)

### Community 199 - "TestDiversificationScoringThresholds"

Cohesion: 0.20
Nodes (6): Enforces the three task-specification validation requirements: 1. single-stock…, VALIDATION REQUIREMENT 1: 'Verify single-stock portfolio yields near-zero…, VALIDATION REQUIREMENT 2: 'Concentrated portfolios receive appropriately low…, VALIDATION REQUIREMENT 3: 'Diverse multi-asset portfolios receive high scores.'…, Structural validation: concentrated score must be materially lower than…, TestDiversificationScoringThresholds

### Community 200 - "analytics-cache-test.js"

Cohesion: 0.29
Nodes (6): cacheHitRate, coldCacheDuration, invalidationSuccess, options, totalTransactions, warmCacheDuration

### Community 201 - "TestEffectiveNInvariants"

Cohesion: 0.20
Nodes (6): Effective N must satisfy its mathematical relationships., Neff ≥ 1 for all portfolios (single-stock lower bound)., Neff ≤ N_assets for all portfolios (equal-weight upper bound)., Effective N % ∈ [0, 100]., Neff % = 100 iff portfolio is exactly equal-weight., TestEffectiveNInvariants

### Community 202 - "TestConcentrationRatioInvariants"

Cohesion: 0.20
Nodes (6): CR_N must satisfy monotonicity and boundary properties., CR_3 ≤ CR_5 ≤ CR_10 for any portfolio., All CR_N values ∈ [0, 100]., CR_N where N ≥ total assets → 100%., actual_n must not exceed total number of assets., TestConcentrationRatioInvariants

### Community 213 - "RiskScreen.tsx"

Cohesion: 0.40
Nodes (4): RISK_METRICS, RiskScreen(), SEVERITY_COLORS, styles

### Community 214 - "4. Benchmark Comparison Metrics"

Cohesion: 0.20
Nodes (10): 4.1 Daily Returns, 4.2 Portfolio Beta (β), 4.3 Jensen's Alpha (α), 4.4 Tracking Error (TE), 4.5 Information Ratio (IR), 4.6 Sharpe Ratio, 4.7 Sortino Ratio, 4.8 Pearson Correlation (ρ) (+2 more)

### Community 215 - "compute_correlation_matrix"

Cohesion: 0.22
Nodes (9): compute_correlation_matrix(), compute_drawdown_series(), post, POST /api/v1/risk/drawdown-series Returns the complete drawdown time series for…, POST /api/v1/risk/correlation Accepts a list of named asset return series (all…, CorrelationResponse, DrawdownSeriesResponse, Drawdown time series response for POST /api/v1/risk/drawdown-series. Each value… (+1 more)

### Community 216 - "AlertEventListener"

Cohesion: 0.33
Nodes (4): AlertEventListener, Injectable, InjectQueue, OnEvent

### Community 217 - "validate-workflows.js"

Cohesion: 0.33
Nodes (4): fs, path, WORKFLOWS_DIR, yaml

### Community 218 - "3. Extended Internal Rate of Return (XIRR)"

Cohesion: 0.29
Nodes (7): 3.1 Purpose, 3.2 Cash Flow Sign Convention, 3.3 NPV Equation, 3.4 Primary Solver: Newton-Raphson, 3.5 Fallback Solver: Brent–Dekker Method, 3.6 Convergence Failure Handling, 3. Extended Internal Rate of Return (XIRR)

### Community 231 - "JwtRefreshStrategy"

Cohesion: 0.33
Nodes (3): JwtRefreshPayload, JwtRefreshStrategy, Injectable

### Community 232 - "ObservabilityModule"

Cohesion: 0.67
Nodes (3): ObservabilityModule, Global, Module

### Community 233 - "RiskSummaryRequest"

Cohesion: 0.20
Nodes (7): DrawdownSeriesRequest, Benchmark returns must be aligned (same length) with portfolio returns., Reject NaN or infinite return values — they produce undefined risk metrics., Request body for POST /api/v1/risk/drawdown-series. Returns the full time…, Request body for POST /api/v1/risk/summary. Computes the full suite of risk…, RiskSummaryRequest, field_validator

## Knowledge Gaps

- **768 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+763 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **59 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `PrismaService` connect `PrismaService` to `provider-ingestion.service.ts`, `AlertEvaluatorEngine`, `health.service.ts`, `auth.module.ts`, `alert-evaluator.engine.ts`, `valuation.engine.ts`, `ExcelExportService`, `transaction.service.ts`, `PortfolioService`, `PdfReportService`, `alert.service.ts`, `EncryptionService`, `CoinGeckoProvider`, `AnalyticsCacheManager`, `market-data.module.ts`, `MarketDataService`, `alert.module.ts`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `compute_diversification()` connect `compute_diversification` to `TestConcentrationRatioBenchmark`, `TestComponentScoresBenchmark`, `TestDiversificationEndpointSmoke`, `compute_drawdown`, `TestConcentrationRatioInvariants`, `TestEffectiveNBenchmark`, `TestEffectiveNInvariants`, `TestHhiBenchmark`, `test_diversification.py`, `src/analytics/__init__.py`, `routers/risk.py`, `TestCompositeScoreInvariants`, `TestEdgeCasesAndErrorHandling`, `TestHhiInvariants`, `test_quant_benchmarks.py`, `TestSectorHhiInvariants`, `schemas/risk.py`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `Investor Portfolio Monitoring & Risk Management System` connect `PRD.md` to `PRODUCT_DISCOVERY.md`, `ARCHITECTURE.md`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `Acceptance Criteria` (e.g. with `1.2 Epic Codes` and `3. Epic 2 — Multi-Provider Data Ingestion & Transaction Recording`) actually correct?**
  _`Acceptance Criteria` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `AllocationWeight` (e.g. with `TestDojHhiConcentrationBenchmarks` and `TestExcelXirrBenchmarks`) actually correct?**
  _`AllocationWeight` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _768 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `provider-ingestion.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08941176470588236 - nodes in this community are weakly interconnected._
