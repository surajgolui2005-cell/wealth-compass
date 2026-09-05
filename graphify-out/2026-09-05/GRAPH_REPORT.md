# Graph Report - Investor Portolio Monitoring and Risk Management System  (2026-09-05)

## Corpus Check
- 267 files · ~169,910 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 3166 nodes · 5871 edges · 189 communities (134 shown, 55 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 380 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `60fb0549`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- CsvProviderAdapter
- PRODUCT_DISCOVERY.md
- PRD.md
- AuthService
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
- compute_diversification
- TransactionController
- xirr.py
- market-data.service.spec.ts
- CreateTransactionDto
- scripts
- workers/package.json
- ui-components/package.json
- MarketDataService
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
- analytics/__init__.py
- env.js
- dev-setup.sh
- rules/graphify.md
- workflows/graphify.md
- class-transformer
- analytics.dto.ts
- alerts/page.tsx
- test_diversification.py
- routers/risk.py
- charts/index.ts
- @nestjs/jwt
- compute_allocation
- @nestjs/throttler
- papaparse
- dependencies
- @prisma/client
- reflect-metadata
- _modified_dietz
- AlphaVantageProvider
- MarketDataProcessor
- config/tsconfig.json
- routers/performance.py
- argon2
- AllocationWeight
- quant-engine
- alert-evaluator.engine.ts
- _post
- ioredis
- @nestjs/common
- @nestjs/core
- main.ts
- @nestjs/bullmq
- zod
- @nestjs/passport
- date
- _post
- compute_correlation
- compute_twr
- portfolio.service.ts
- PortfolioService
- tests/__init__.py
- PrismaService
- decimal.js
- app/__init__.py
- src/__init__.py
- GroupBy
- price-cache.interface.ts
- market-data.module.ts
- alert.module.ts
- expo
- compute_var
- _post
- _post
- devDependencies
- compilerOptions
- ReportService
- TestComponentScoresBenchmark
- Endpoints
- compute_sortino
- TestDiversificationEndpointSmoke
- dependencies
- report.module.ts
- AlertController
- alert.service.ts
- PdfReportService
- dependencies
- CreateAlertRuleDto
- TestHhiBenchmark
- TestCompositeScoreInvariants
- devDependencies
- pdf-report.service.ts
- PortfoliosScreen.tsx
- TestRiskPropertyInvariants
- AuthContext.tsx
- MainTabs.tsx
- scripts
- ExcelExportService
- TestHhiInvariants
- mobile/package.json
- AlertsScreen.tsx
- AuthStack.tsx
- include
- 8. Diversification & Concentration Analytics
- TestDiversificationScoringThresholds
- AlertEvaluatorEngine
- report.controller.ts
- app/layout.tsx
- index.tsx
- 7. Pairwise Asset Correlation Matrix
- AlertEventListener
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
- excel-export.service.spec.ts
- Risk Methodology Specification
- 2. Beta (Systematic Risk)
- RiskScreen.tsx
- main.py
- 8.2 Herfindahl-Hirschman Index (HHI)
- @nestjs/swagger
- passport
- swagger-ui-express
- @types/pdfmake
- expo-notifications
- expo-status-bar
- @expo/vector-icons
- react
- react-native-gesture-handler
- react-native-safe-area-context
- react-native-screens
- @react-navigation/bottom-tabs
- @react-navigation/native-stack
- tailwindcss
- zod
- clsx
- @hookform/resolvers
- next
- @radix-ui/react-avatar
- @radix-ui/react-dialog
- @radix-ui/react-separator
- @radix-ui/react-toast
- @radix-ui/react-tooltip
- react-dom
- react-hook-form
- tailwind-merge
- @testing-library/dom
- zod
- tailwind.config.ts

## God Nodes (most connected - your core abstractions)
1. `compute_diversification()` - 105 edges
2. `Acceptance Criteria` - 52 edges
3. `PrismaService` - 40 edges
4. `compute_drawdown()` - 27 edges
5. `compute_var()` - 25 edges
6. `cn()` - 25 edges
7. `AlphaVantageProvider` - 24 edges
8. `CoinGeckoProvider` - 23 edges
9. `compute_allocation()` - 23 edges
10. `AllocationWeight` - 23 edges

## Surprising Connections (you probably didn't know these)
- `TestAllocationRouterHappyPath` --uses--> `GroupBy`  [INFERRED]
  apps/quant-engine/tests/test_allocation.py → apps/quant-engine/src/analytics/allocation.py
- `TestAllocationRouterValidation` --uses--> `GroupBy`  [INFERRED]
  apps/quant-engine/tests/test_allocation.py → apps/quant-engine/src/analytics/allocation.py
- `TestComputeAllocationUnit` --uses--> `GroupBy`  [INFERRED]
  apps/quant-engine/tests/test_allocation.py → apps/quant-engine/src/analytics/allocation.py
- `TestAllocationRouterHappyPath` --uses--> `PositionRecord`  [INFERRED]
  apps/quant-engine/tests/test_allocation.py → apps/quant-engine/src/analytics/allocation.py
- `TestAllocationRouterValidation` --uses--> `PositionRecord`  [INFERRED]
  apps/quant-engine/tests/test_allocation.py → apps/quant-engine/src/analytics/allocation.py

## Import Cycles
- None detected.

## Communities (189 total, 55 thin omitted)

### Community 0 - "CsvProviderAdapter"
Cohesion: 0.05
Nodes (29): CsvProviderAdapter, Injectable, ManualEntryAdapter, Injectable, MockBrokerProviderAdapter, Injectable, ImportCsvDto, ProviderController (+21 more)

### Community 1 - "PRODUCT_DISCOVERY.md"
Cohesion: 0.07
Nodes (80): 10.1 Technical Risks, 10.2 Business Risks, 10.3 Key Assumptions, 10. Risk & Assumptions Log, 11.1 Product Metrics, 11.2 Technical Metrics, 11.3 Business Metrics, 11.4 Risk & Safety Metrics (+72 more)

### Community 2 - "PRD.md"
Cohesion: 0.10
Nodes (59): 1.1 User Story Format, 1.2 Epic Codes, 1.3 Personas Quick Reference, 1. Document Conventions, 2. Epic 1 — Auth & User Preference Management, 3. Epic 2 — Multi-Provider Data Ingestion & Transaction Recording, 4. Epic 3 — Deterministic Valuation & Holding Engine, 5. Epic 4 — Performance & Risk Analytics Dashboard (+51 more)

### Community 3 - "AuthService"
Cohesion: 0.07
Nodes (31): AuthRequest, AuthController, COOKIE_OPTIONS, Body, Controller, Get, HttpCode, Post (+23 more)

### Community 4 - "Negative / Trade-offs"
Cohesion: 0.05
Nodes (87): ADR-0001: Monorepo Strategy, Compliance Check, Consequences, Constraints, Context, Decision, Directory Layout, Negative / Trade-offs (+79 more)

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
Nodes (20): packages/config/*, packages/config/src/index.ts, packages/shared-types/src/index.ts, packages/ui-components/src/index.ts, compilerOptions, baseUrl, esModuleInterop, forceConsistentCasingInFileNames (+12 more)

### Community 11 - "PortfolioController"
Cohesion: 0.18
Nodes (11): PortfolioController, Body, Controller, Delete, Get, HttpCode, Param, Post (+3 more)

### Community 13 - "devDependencies"
Cohesion: 0.06
Nodes (31): devDependencies, jest, @nestjs/testing, prisma, supertest, ts-jest, ts-node, ts-node-dev (+23 more)

### Community 14 - "compute_benchmark_metrics"
Cohesion: 0.06
Nodes (33): _annualised_std(), BenchmarkMetrics, compute_benchmark_metrics(), _daily_returns(), _downside_std(), Benchmark Comparison Analytics =============================== Mathematical…, Full set of benchmark-relative performance metrics. All return metrics are…, Converts a price series into a series of daily simple returns. r_t = (P_t -… (+25 more)

### Community 15 - "PROJECT_STATE.md"
Cohesion: 0.27
Nodes (18): Architecture Snapshot (Phase 1 Assumptions), Asset Class Tracking, Changelog, Deliverables Produced, Deliverables Produced, Document Registry, Financial Edge Cases Formally Specified, Key Decisions Made in Phase 1 (+10 more)

### Community 16 - "outputs"
Cohesion: 0.14
Nodes (15): ^build, out/**, dependsOn, outputs, cache, persistent, dist/**, dependsOn (+7 more)

### Community 17 - "_post"
Cohesion: 0.08
Nodes (21): _post(), Integration tests for POST /api/v1/performance/xirr…, TC-B04: Five-year multi-cashflow portfolio. Verifies NPV at solution is within…, Response must include solver diagnostics., Custom guess=0.50 should still produce the same XIRR as default., xirr_pct must equal xirr × 100 exactly., Validate convergence fallback and input validation error paths., Single cash flow → Pydantic min_length=2 catches it (422) before route handler… (+13 more)

### Community 18 - "4. Benchmark Comparison Metrics"
Cohesion: 0.06
Nodes (32): 1. Overview & Design Principles, 2.1 Purpose, 2.2 Sub-Period Boundary Rule, 2.3 Modified Dietz Sub-Period Return, 2.4 Chain-Linking, 2.5 Annualisation, 2.6 TWR vs MWR — When to Use Each, 2. Time-Weighted Return (TWR) (+24 more)

### Community 19 - "compute_diversification"
Cohesion: 0.02
Nodes (67): compute_diversification(), Compute portfolio diversification and concentration metrics. Parameters…, n_assets counts only assets with weight > threshold., Verify Effective N = 10,000 / HHI and Effective N % of max., 3-asset 50/30/20: Eff N = 10,000/3800 = 2.6316., Eff N % = 2.6316/3 × 100 = 87.7193., 5 equal-weight assets → Eff N = 5.0 exactly., Equal-weight portfolio → Eff N % = 100.0. (+59 more)

### Community 20 - "TransactionController"
Cohesion: 0.17
Nodes (9): TransactionController, Body, Controller, Get, HttpCode, Param, Post, Req (+1 more)

### Community 21 - "xirr.py"
Cohesion: 0.12
Nodes (20): _brent_dekker(), _newton_raphson(), _npv(), _npv_derivative(), Extended Internal Rate of Return (XIRR) — Numerical Root-Finding Engine…, Output of the XIRR computation. Attributes ---------- xirr: Annualised XIRR as…, Raised when neither Newton-Raphson nor Brent's method can converge on a real…, Net Present Value: Σ CF_i / (1 + r)^t_i Avoids math.pow overflow by checking (1… (+12 more)

### Community 22 - "market-data.service.spec.ts"
Cohesion: 0.10
Nodes (18): BatchPriceResult, CircuitBreakerConfig, CircuitBreakerState, MarketDataProvider, ProviderUnavailableException, AlphaVantageGlobalQuote, CoinGeckoPriceResponse, SYMBOL_TO_COINGECKO_ID (+10 more)

### Community 23 - "CreateTransactionDto"
Cohesion: 0.18
Nodes (11): CreateTransactionDto, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Min, Type (+3 more)

### Community 24 - "scripts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, lint, start, test (+2 more)

### Community 25 - "workers/package.json"
Cohesion: 0.14
Nodes (13): dependencies, @investor-pm/api, @investor-pm/types, @investor-pm/types, name, private, scripts, build (+5 more)

### Community 26 - "ui-components/package.json"
Cohesion: 0.12
Nodes (15): dependencies, @investor-pm/types, @investor-pm/types, react, main, name, peerDependencies, react (+7 more)

### Community 27 - "MarketDataService"
Cohesion: 0.18
Nodes (6): PriceQuote, buildPriceCacheKey(), MarketDataService, Injectable, PriceCacheService, Injectable

### Community 28 - "MarketDataScheduler"
Cohesion: 0.11
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
Cohesion: 0.10
Nodes (28): CalculatorModule, Module, Controller, Get, HttpCode, Param, Query, Req (+20 more)

### Community 38 - "analytics/__init__.py"
Cohesion: 0.03
Nodes (73): Analytics math package for the Wealth Compass Quant Engine. Public API: twr —…, BetaResult, compute_beta(), Beta Calculator =============== Pure-math module for computing the systematic…, Beta computation output. Attributes ---------- asset_id : Portfolio or security…, Compute the portfolio beta against a benchmark. Algorithm --------- 1.…, CorrelationResult, Pairwise Pearson correlation matrix output. Attributes ---------- asset_ids :… (+65 more)

### Community 44 - "analytics.dto.ts"
Cohesion: 0.09
Nodes (40): AnalyticsClientService, Injectable, AnalyticsController, Body, Controller, HttpCode, Post, UseGuards (+32 more)

### Community 45 - "alerts/page.tsx"
Cohesion: 0.05
Nodes (66): nextConfig, LoginForm, loginSchema, RegisterForm, registerSchema, AlertForm, AlertRule, alertSchema (+58 more)

### Community 46 - "test_diversification.py"
Cohesion: 0.03
Nodes (53): _component_a(), _component_b(), _compute_hhi(), ConcentrationRatio, DiversificationResult, _normalise_weights(), Diversification & Concentration Analytics Engine…, Single Top-N concentration ratio result. Attributes ---------- n : The top-N… (+45 more)

### Community 47 - "routers/risk.py"
Cohesion: 0.07
Nodes (49): compute_correlation_matrix(), compute_diversification_analytics(), compute_drawdown_series(), compute_risk_summary(), _map_var_estimate(), post, Risk Analytics Router ===================== Exposes four computation endpoints:…, POST /api/v1/risk/summary Accepts a daily return series for a portfolio and… (+41 more)

### Community 48 - "charts/index.ts"
Cohesion: 0.11
Nodes (37): AllocationDonutChart(), AllocationDonutChartProps, AllocationSlice, CenterLabel(), CustomTooltip(), BenchmarkComparisonChart(), BenchmarkComparisonChartProps, BenchmarkDataPoint (+29 more)

### Community 50 - "compute_allocation"
Cohesion: 0.08
Nodes (27): AllocationBucket, AllocationResult, compute_allocation(), PositionRecord, Asset Allocation Aggregation Engine ===================================== Pure-…, Full allocation breakdown result for a portfolio. Attributes ----------…, Return the classification label for the position on the requested dimension., Aggregate portfolio positions into allocation buckets by the given dimension.… (+19 more)

### Community 53 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, axios, bullmq, cookie-parser, helmet, @investor-pm/config, @investor-pm/types, @nestjs/config (+19 more)

### Community 56 - "_modified_dietz"
Cohesion: 0.18
Nodes (11): CashFlowEvent, _modified_dietz(), Computes the Modified Dietz return for a single sub-period. Formula: R = (EMV -…, An external cash flow event within a sub-period. Attributes ---------- date:…, Unit tests for the _modified_dietz helper function., Single period, no cash flows. R = (EMV - BMV) / BMV = (110 - 100) / 100 = 10%, BMV = 100, EMV = 215, deposit 100 on day 182 of 365-day period. W = (365 - 182)…, When BMV = 0 and no cash flows, denominator = 0. Should return 0.0 instead of… (+3 more)

### Community 59 - "config/tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, declaration, outDir, rootDir, extends, include, src/**/*, ../../tsconfig.json

### Community 60 - "routers/performance.py"
Cohesion: 0.09
Nodes (33): compute_benchmark_endpoint(), compute_twr_endpoint(), compute_xirr_endpoint(), _pct(), post, Performance analytics router. Exposes three computation endpoints: POST…, POST /api/v1/performance/xirr Cash flow sign convention: - **Negative** = money…, POST /api/v1/performance/benchmark Accepts aligned portfolio NAV and benchmark… (+25 more)

### Community 64 - "AllocationWeight"
Cohesion: 0.09
Nodes (26): AllocationWeight, compute_rebalance(), Portfolio Rebalance Drift Calculation Engine…, Complete rebalance calculation result. Attributes ---------- portfolio_id :…, Compute portfolio drift and required buy/sell amounts to reach target weights.…, A single bucket weight entry for rebalance input. Attributes ---------- label :…, Rebalance calculation result for a single allocation bucket. Attributes…, RebalanceBucket (+18 more)

### Community 67 - "alert-evaluator.engine.ts"
Cohesion: 0.16
Nodes (21): ConcentrationRuleEvaluator, ConcentrationViolation, Injectable, DrawdownRuleEvaluator, Injectable, DriftViolation, NOTE: This evaluator expects targetWeights keys to match assetWeights keys, TargetDriftRuleEvaluator (+13 more)

### Community 68 - "_post"
Cohesion: 0.12
Nodes (16): _build_payload(), _post(), Integration tests for POST /api/v1/performance/benchmark…, Manual β verification: β = Cov(r_p, r_b) / Var(r_b) computed via NumPy and…, alpha_annualised_pct must equal alpha_annualised × 100., Verify 400/422 responses for invalid inputs., Unequal length series → Pydantic model_validator → 422., Two prices (one return) → insufficient for statistics → 400. (+8 more)

### Community 72 - "main.ts"
Cohesion: 0.07
Nodes (20): AppModule, Module, PaginationQueryDto, SortOrder, IsEnum, IsInt, IsOptional, IsString (+12 more)

### Community 78 - "date"
Cohesion: 0.12
Nodes (21): CashFlow, compute_xirr(), Converts cash flow dates to year fractions relative to the first date. t_i =…, Computes XIRR (Extended IRR) for a sequence of non-periodic cash flows. The…, A single cash flow event in the XIRR calculation. Attributes ---------- date:…, _year_fractions(), Mathematical invariant: NPV at XIRR rate must equal 0. Verified directly by…, PRD Scenario 3: Portfolio in loss (current value < invested). Invested… (+13 more)

### Community 79 - "_post"
Cohesion: 0.11
Nodes (15): _post(), Integration tests for POST /api/v1/performance/twr…, twr_annualised must be non-None for multi-day windows., Single sub-period with a mid-period deposit. BMV=100, EMV=215, deposit 100 on…, Ensure all expected response fields are present., Verify 400 responses for bad inputs., Pydantic min_length=1 on sub_periods → 422 Unprocessable Entity., Sub-period with end_date < start_date must return 400 or 422. (+7 more)

### Community 80 - "compute_correlation"
Cohesion: 0.08
Nodes (21): compute_correlation(), _compute_stats(), _pearson(), Pairwise Asset Correlation Matrix Calculator…, Compute Pearson correlation coefficient between two aligned return series.…, Compute the pairwise Pearson correlation matrix for a set of assets. Algorithm…, Compute (mean, sample_std) for a return series. std=0 if all identical., Pearson correlation ρ_ij = Cov(i,j) / (σ_i × σ_j) Dataset E: EQ: [ 0.015,… (+13 more)

### Community 81 - "compute_twr"
Cohesion: 0.14
Nodes (17): compute_twr(), Time-Weighted Return (TWR) — Sub-Period Compounding Engine…, Output of the TWR computation. Attributes ---------- twr_cumulative: Cumulative…, Computes the Time-Weighted Return (TWR) via sub-period chain-linking. The…, A single measurement sub-period bracketed by external cash flow events.…, SubPeriod, TwrResult, Unit tests for twr.py — Time-Weighted Return Engine. Test Vectors ------------… (+9 more)

### Community 82 - "portfolio.service.ts"
Cohesion: 0.16
Nodes (12): CreatePortfolioDto, IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength, IsBoolean, IsOptional (+4 more)

### Community 83 - "PortfolioService"
Cohesion: 0.21
Nodes (5): PortfolioService, Injectable, TransactionService, Injectable, Optional

### Community 85 - "PrismaService"
Cohesion: 0.13
Nodes (7): ArgonService, Injectable, JwtPayload, JwtStrategy, Injectable, PrismaService, Injectable

### Community 89 - "GroupBy"
Cohesion: 0.11
Nodes (30): GroupBy, Supported portfolio allocation breakdown dimensions., compute_allocation_endpoint(), compute_rebalance_endpoint(), post, Allocation analytics router. Exposes two computation endpoints: POST…, POST /api/v1/allocation/rebalance Accepts current allocation percentages and…, POST /api/v1/allocation/breakdown Accepts a list of portfolio positions with… (+22 more)

### Community 91 - "price-cache.interface.ts"
Cohesion: 0.13
Nodes (17): ASSET_CLASS_TTL_MAP, buildPriceMetaKey(), CACHE_TTL, CachedPriceEntry, MARKET_DATA_JOBS, MARKET_DATA_QUEUE, PRICE_CACHE_KEY_PREFIX, PriceCacheMetadata (+9 more)

### Community 92 - "market-data.module.ts"
Cohesion: 0.13
Nodes (14): AnalyticsModule, Module, AuthModule, Module, JwtRefreshPayload, JwtRefreshStrategy, Injectable, MarketDataModule (+6 more)

### Community 93 - "alert.module.ts"
Cohesion: 0.12
Nodes (13): RuleEvaluationSummary, HoldingUpdatedEvent, PortfolioUpdatedEvent, AlertModule, Module, ALERT_JOBS, ALERT_NOTIFICATION_QUEUE, DispatchNotificationPayload (+5 more)

### Community 94 - "expo"
Cohesion: 0.06
Nodes (32): backgroundColor, foregroundImage, adaptiveIcon, package, permissions, expo, android, assetBundlePatterns (+24 more)

### Community 95 - "compute_var"
Cohesion: 0.08
Nodes (16): compute_var(), Compute Value at Risk using both Parametric and Historical Simulation methods.…, Parametric VaR uses z-scores: z_0.95 = 1.6448536, z_0.99 = 2.3263479. VaR_param…, Historical 95% VaR must equal the 5th percentile of sorted returns (negated)., Historical VaR amount = var_pct / 100 × portfolio_value., Parametric 95% VaR must match -(mean - 1.6449 × std) × portfolio_value., Parametric 99% VaR must match -(mean - 2.3263 × std) × portfolio_value., 99% VaR ≥ 95% VaR for both methods — monotonicity property. (+8 more)

### Community 96 - "_post"
Cohesion: 0.11
Nodes (17): _post(), Full HTTP integration tests for the allocation breakdown endpoint., Standard multi-asset portfolio grouped by asset_class., Sector grouping: missing sector → 'Unassigned / Other'., Geography grouping: 60/30/10 split., Currency grouping: INR/USD/BTC split., Provider grouping: ZERODHA/BINANCE/MANUAL split., Verify schema completeness — all expected fields present. (+9 more)

### Community 97 - "_post"
Cohesion: 0.10
Nodes (16): _post(), Full HTTP integration tests for the rebalance endpoint., All current == target → requires_rebalance = False., Equity 50% → 60%: buy = 10% × 500,000 = 50,000., HTTP response: total_buy_amount must equal total_sell_amount., Tolerance of 5% — drifts within 5% are in_tolerance., Schema completeness — all expected response fields present., Default tolerance is 2% when not specified. (+8 more)

### Community 98 - "devDependencies"
Cohesion: 0.07
Nodes (27): devDependencies, autoprefixer, jsdom, postcss, tailwindcss, @testing-library/jest-dom, @testing-library/react, @testing-library/user-event (+19 more)

### Community 99 - "compilerOptions"
Cohesion: 0.07
Nodes (26): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+18 more)

### Community 100 - "ReportService"
Cohesion: 0.14
Nodes (13): ReportController, Body, Controller, Get, HttpCode, Param, Post, Query (+5 more)

### Community 101 - "TestComponentScoresBenchmark"
Cohesion: 0.08
Nodes (14): Verify Component A, Component B, and composite score against hand traces. Score…, 3-asset 50/30/20: comp_a = 87.7193., Without correlation data: comp_b = 50 (neutral assumption)., Score = 0.60×87.7193 + 0.40×50 = 72.6316., 5-asset equal-weight with known matrix: rho_bar = 0.22., rho_bar=0.22 → comp_b = (1-0.22)/2 × 100 = 39.0., Score = 0.60×100 + 0.40×39.0 = 75.6., Key boundary archetype (RISK_METHODOLOGY.md §8.5.6): 20-asset equal-weight with… (+6 more)

### Community 102 - "Endpoints"
Cohesion: 0.08
Nodes (24): Alerts `/api/v1/alerts`, Analytics `/api/v1/analytics`, API Contract — Wealth Compass REST API v1, API Versioning, Auth `/api/v1/auth`, Authentication, Endpoints, Error (+16 more)

### Community 103 - "compute_sortino"
Cohesion: 0.11
Nodes (13): compute_sortino(), Compute the annualised Sortino Ratio from a series of daily returns. Algorithm…, Sortino Ratio = (R_a - rf_annual) / σ_DD_a σ_DD² = Σ[min(r_i - MAR_daily, 0)²]…, Dataset A has 3 days below the MAR (days 3, 4, 8)., When upside volatility is high, Sortino > Sharpe because Sharpe penalises both…, Per Sortino & Price (1994), the downside deviation uses N, not N-1. Verify by…, Multi-regime return series: 5-day bull, 3-day crash, 5-day recovery. Verifies…, The crash period should produce the largest drawdown. (+5 more)

### Community 104 - "TestDiversificationEndpointSmoke"
Cohesion: 0.08
Nodes (13): HTTP smoke tests for POST /api/v1/risk/diversification., Minimal valid request (weights only, no correlation) → HTTP 200., Response must contain all required fields., portfolio_id in response must match request., hhi_sector = null in response when sector_weights not in request., weighted_avg_correlation = null when no correlation_matrix provided., When sector_weights provided, hhi_sector is not null., With a valid correlation matrix, correlation_data_used = true. (+5 more)

### Community 105 - "dependencies"
Cohesion: 0.09
Nodes (23): dependencies, axios, class-variance-authority, lucide-react, next-themes, @radix-ui/react-dropdown-menu, @radix-ui/react-label, @radix-ui/react-slot (+15 more)

### Community 106 - "report.module.ts"
Cohesion: 0.16
Nodes (8): GenerateReportPayload, REPORT_GENERATION_QUEUE, REPORT_JOBS, ReportJobType, ReportSchedulerProcessor, Processor, ReportModule, Module

### Community 107 - "AlertController"
Cohesion: 0.23
Nodes (12): AlertController, Body, Controller, Delete, Get, HttpCode, Param, Post (+4 more)

### Community 108 - "alert.service.ts"
Cohesion: 0.18
Nodes (6): AlertRuleRecord, AlertService, EVALUABLE_ALERT_TYPES, Injectable, AlertLogResponseDto, AlertRuleResponseDto

### Community 109 - "PdfReportService"
Cohesion: 0.23
Nodes (4): formatINR(), formatPct(), PdfReportService, Injectable

### Community 110 - "dependencies"
Cohesion: 0.12
Nodes (17): dependencies, axios, expo, expo-constants, expo-secure-store, nativewind, react-native, @react-navigation/native (+9 more)

### Community 111 - "CreateAlertRuleDto"
Cohesion: 0.21
Nodes (15): CreateAlertRuleDto, EvaluateAlertDto, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString (+7 more)

### Community 112 - "TestHhiBenchmark"
Cohesion: 0.12
Nodes (9): Verify HHI against hand-derived reference values. Formula: HHI = Σ (w_i × 100)²…, 3-asset 50/30/20 — trace: 2500+900+400 = 3800., 5 equal-weight at 20% — HHI = 5 × 400 = 2000., 20 equal-weight at 5% — HHI = 20 × 25 = 500., 2-asset 70/30 — HHI = 4900+900 = 5800., 80%-dominant 5-asset — HHI = 6538., Single-asset → HHI = 10,000 (maximum possible)., Fraction weights (0.5, 0.3, 0.2) and percentage weights (50, 30, 20) must yield… (+1 more)

### Community 113 - "TestCompositeScoreInvariants"
Cohesion: 0.12
Nodes (9): Composite score must satisfy strict mathematical and financial invariants., Diversification score ∈ [0, 100] for all portfolios., α + β = 1.0 (partition of unity constraint)., Score = α × comp_a + β × comp_b holds for all result objects., Both sub-scores ∈ [0, 100]., Component B = 50.0 exactly when correlation data is absent., correlation_data_used = False without matrix; True with matrix., More positively correlated assets must produce lower Component B. (+1 more)

### Community 114 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, @babel/core, babel-jest, jest, jest-expo, @testing-library/react-native, @types/react, typescript (+7 more)

### Community 115 - "pdf-report.service.ts"
Cohesion: 0.16
Nodes (12): AllocationEntry, HoldingRow, pdfFonts, pdfMake, pnlColor(), PortfolioReportData, RiskMetrics, TransactionRow (+4 more)

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

### Community 121 - "ExcelExportService"
Cohesion: 0.32
Nodes (3): InjectQueue, ExcelExportService, Injectable

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
Nodes (10): compilerOptions, paths, strict, extends, include, **/*.ts, **/*.tsx, expo-env.d.ts (+2 more)

### Community 127 - "8. Diversification & Concentration Analytics"
Cohesion: 0.18
Nodes (11): 8.1 Definition, 8.3.1 Formula, 8.3.2 Interpretation, 8.3 Effective N (Equivalent Equal-Weight Portfolio Size), 8.4.1 Formula, 8.4.2 Default Cut-offs and Risk Thresholds, 8.4 Top-N Concentration Ratios, 8.6 Parameters (+3 more)

### Community 128 - "TestDiversificationScoringThresholds"
Cohesion: 0.20
Nodes (6): Enforces the three task-specification validation requirements: 1. single-stock…, VALIDATION REQUIREMENT 1: 'Verify single-stock portfolio yields near-zero…, VALIDATION REQUIREMENT 2: 'Concentrated portfolios receive appropriately low…, VALIDATION REQUIREMENT 3: 'Diverse multi-asset portfolios receive high scores.'…, Structural validation: concentrated score must be materially lower than…, TestDiversificationScoringThresholds

### Community 129 - "AlertEvaluatorEngine"
Cohesion: 0.31
Nodes (3): AlertEvaluatorEngine, Injectable, InjectQueue

### Community 130 - "report.controller.ts"
Cohesion: 0.39
Nodes (7): GenerateCsvReportDto, GeneratePdfReportDto, IsEnum, IsOptional, IsUUID, AuthRequest, IsDateString

### Community 131 - "app/layout.tsx"
Cohesion: 0.33
Nodes (5): inter, metadata, Providers(), getQueryClient(), makeQueryClient()

### Community 132 - "index.tsx"
Cohesion: 0.39
Nodes (5): App(), setUnauthorizedHandler(), getQueryClient(), RootNavigator(), MainTabs()

### Community 133 - "7. Pairwise Asset Correlation Matrix"
Cohesion: 0.25
Nodes (8): 7.1 Definition, 7.2 Formula, 7.3 Parameters, 7.4 Interpretation, 7.5 Diversification Rule of Thumb, 7.6 Special Cases, 7.7 Limitations, 7. Pairwise Asset Correlation Matrix

### Community 134 - "AlertEventListener"
Cohesion: 0.33
Nodes (4): AlertEventListener, Injectable, InjectQueue, OnEvent

### Community 135 - "mobile/src/lib/api-client.ts"
Cohesion: 0.38
Nodes (4): apiClient, ApiError, Props, styles

### Community 136 - "TestRiskSummaryEndpoint"
Cohesion: 0.29
Nodes (3): When all returns exceed the MAR, Sortino = +inf → router normalises to 9999.0., Integration tests for POST /api/v1/risk/summary., TestRiskSummaryEndpoint

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

### Community 145 - "excel-export.service.spec.ts"
Cohesion: 0.40
Nodes (3): buildMockPrisma(), defaultMockPrisma(), RFC-4180

### Community 146 - "Risk Methodology Specification"
Cohesion: 0.33
Nodes (5): Financial Conventions Summary, Minimum Data Requirements, Overview, References, Risk Methodology Specification

### Community 147 - "2. Beta (Systematic Risk)"
Cohesion: 0.33
Nodes (6): 2.1 Definition, 2.2 Formula, 2.3 Parameters, 2.4 Interpretation, 2.5 Limitations, 2. Beta (Systematic Risk)

### Community 148 - "RiskScreen.tsx"
Cohesion: 0.40
Nodes (4): RISK_METRICS, RiskScreen(), SEVERITY_COLORS, styles

### Community 149 - "main.py"
Cohesion: 0.40
Nodes (4): health_check(), get, Quant Engine — FastAPI Application Entry Point…, Liveness probe for container orchestration.

### Community 150 - "8.2 Herfindahl-Hirschman Index (HHI)"
Cohesion: 0.40
Nodes (5): 8.2.1 Formula, 8.2.2 Boundary Conditions, 8.2.3 Interpretation, 8.2.4 Sector-Level HHI, 8.2 Herfindahl-Hirschman Index (HHI)

## Knowledge Gaps
- **569 isolated node(s):** `name`, `version`, `private`, `dev`, `build` (+564 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **55 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `compute_diversification()` connect `compute_diversification` to `TestComponentScoresBenchmark`, `analytics/__init__.py`, `TestDiversificationEndpointSmoke`, `test_diversification.py`, `routers/risk.py`, `TestHhiBenchmark`, `TestCompositeScoreInvariants`, `TestHhiInvariants`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Why does `PrismaService` connect `PrismaService` to `AlertEvaluatorEngine`, `alert-evaluator.engine.ts`, `valuation.engine.ts`, `transaction.service.ts`, `report.module.ts`, `alert.service.ts`, `PdfReportService`, `portfolio.service.ts`, `PortfolioService`, `pdf-report.service.ts`, `market-data.service.spec.ts`, `ExcelExportService`, `price-cache.interface.ts`, `market-data.module.ts`, `alert.module.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `PositionRecord` connect `compute_allocation` to `_post`, `GroupBy`, `analytics/__init__.py`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `Acceptance Criteria` (e.g. with `1.2 Epic Codes` and `3. Epic 2 — Multi-Provider Data Ingestion & Transaction Recording`) actually correct?**
  _`Acceptance Criteria` has 8 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `version`, `private` to the rest of the system?**
  _569 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `CsvProviderAdapter` be split into smaller, more focused modules?**
  _Cohesion score 0.05434173669467787 - nodes in this community are weakly interconnected._
- **Should `PRODUCT_DISCOVERY.md` be split into smaller, more focused modules?**
  _Cohesion score 0.0691358024691358 - nodes in this community are weakly interconnected._