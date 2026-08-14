# System Architecture Document
## Investor Portfolio Monitoring & Risk Management System

---

| Metadata           | Value                                                                    |
|--------------------|--------------------------------------------------------------------------|
| **Document ID**    | SA-001                                                                   |
| **Version**        | 1.0.0                                                                    |
| **Phase**          | Phase 3 — System Architecture & Technical Design                         |
| **Status**         | Approved for Phase 4                                                     |
| **Author(s)**      | Principal Architecture Team                                              |
| **Created**        | 2026-08-13                                                               |
| **Last Updated**   | 2026-08-13                                                               |
| **Depends On**     | PD-001 (Product Discovery), PRD-001 (Product Requirements)               |

---

## Table of Contents

1. [System Overview & Architectural Philosophy](#1-system-overview--architectural-philosophy)
2. [Technology Stack Decisions](#2-technology-stack-decisions)
3. [C4 Architecture Diagrams](#3-c4-architecture-diagrams)
   - [3.1 Level 1 — System Context Diagram](#31-level-1--system-context-diagram)
   - [3.2 Level 2 — Container Diagram](#32-level-2--container-diagram)
   - [3.3 Level 3 — Component Diagram (NestJS API)](#33-level-3--component-diagram-nestjs-api)
   - [3.4 Level 3 — Component Diagram (Python Quant Engine)](#34-level-3--component-diagram-python-quant-engine)
4. [Bounded Context Map](#4-bounded-context-map)
5. [Data Flow Pipeline Architecture](#5-data-flow-pipeline-architecture)
   - [5.1 End-to-End Pipeline Overview](#51-end-to-end-pipeline-overview)
   - [5.2 Stage 1 — Raw Data Ingestion](#52-stage-1--raw-data-ingestion)
   - [5.3 Stage 2 — Normalisation](#53-stage-2--normalisation)
   - [5.4 Stage 3 — Persistence](#54-stage-3--persistence)
   - [5.5 Stage 4 — Calculation](#55-stage-4--calculation)
   - [5.6 Stage 5 — Analytics](#56-stage-5--analytics)
   - [5.7 Stage 6 — Insights & Alerting](#57-stage-6--insights--alerting)
6. [Synchronous vs. Asynchronous Workflow Design](#6-synchronous-vs-asynchronous-workflow-design)
   - [6.1 Synchronous REST/OpenAPI Flows](#61-synchronous-restopenapi-flows)
   - [6.2 Asynchronous BullMQ Queue Flows](#62-asynchronous-bullmq-queue-flows)
   - [6.3 Queue Topology](#63-queue-topology)
7. [Security & Isolation Boundaries](#7-security--isolation-boundaries)
8. [Infrastructure & Deployment Topology](#8-infrastructure--deployment-topology)
9. [Inter-Service Communication Contracts](#9-inter-service-communication-contracts)
10. [Observability Architecture](#10-observability-architecture)
11. [Architecture Decision Records (ADR) Summary](#11-architecture-decision-records-adr-summary)
12. [Open Questions Resolved](#12-open-questions-resolved)

---

## 1. System Overview & Architectural Philosophy

### 1.1 Guiding Principles

| Principle | Application |
|-----------|-------------|
| **Domain-Driven Design (DDD)** | Business logic is partitioned into bounded contexts aligned to PRD Epics |
| **Separation of Concerns** | Transactional business logic (NestJS) is strictly isolated from compute-intensive quant calculations (Python FastAPI) |
| **Async-First for I/O-Bound Work** | All external provider syncs and report generation are executed as background BullMQ jobs; no user-facing request blocks on I/O |
| **Read-Only External Access** | System never acquires write/trade permissions on any financial provider (D-002) |
| **Defence in Depth** | Multiple layers of security: network boundary, service-level auth, field-level encryption |
| **Graceful Degradation** | Price feed failures serve stale data with freshness indicators; quant engine unavailability falls back to last computed metrics |
| **Observability by Design** | OpenTelemetry instrumentation at every service boundary from day one |

### 1.2 Architectural Pattern: Modular Monolith + Quant Microservice

```
+------------------------------------------------------------------+
|               MODULAR MONOLITH  (NestJS / Node.js)              |
|                                                                  |
|  +---------+  +---------+  +---------+  +---------+  +-------+  |
|  |  Auth   |  |Ingest.  |  |Valuat.  |  |  Alert  |  |Report |  |
|  | Context |  | Context |  | Context |  | Context |  |Context|  |
|  +---------+  +---------+  +---------+  +---------+  +-------+  |
|                   | Internal Domain Events (in-process)         |
|             +-----+-------------------------------------+        |
|             |    Shared Kernel (Core Domain)            |        |
|             +-------------------------------------------+        |
+----------------------------+-------------------------------------+
                             | REST/HTTP  (internal network only)
                             v
+------------------------------------------------------------------+
|          QUANT MICROSERVICE  (Python FastAPI)                    |
|                                                                  |
|  VaR Engine | Sharpe/Sortino | Beta/Correlation | XIRR | Scenario|
+------------------------------------------------------------------+
```

**Rationale for Modular Monolith (NestJS):**
- All business contexts share a single PostgreSQL transactional boundary — avoids distributed transaction complexity
- NestJS module system enforces strict domain isolation via module boundaries and barrel exports
- Simpler operational model for MVP and V1.0; modules can be extracted to independent microservices in V2.0+ if needed
- Single deployment unit reduces latency and infrastructure cost at early scale

**Rationale for Python Quant Microservice:**
- NumPy/Pandas/SciPy/QuantLib are the de-facto standard for financial matrix computations
- VaR (Historical Simulation), Sharpe Ratio, correlation matrices, and XIRR require vectorised operations not idiomatic in Node.js
- Horizontal scaling of the CPU-intensive quant tier is independent from the I/O-bound API tier
- Clear language boundary prevents cognitive overload in a single codebase

---

## 2. Technology Stack Decisions

> Resolves all Phase 2 Open Questions (OQ-006 through OQ-010).

| Layer | Technology | Version | Decision Rationale |
|-------|-----------|---------|-------------------|
| **API Framework** | NestJS (Node.js) | 10.x | TypeScript-native, module-based, OpenAPI support, BullMQ integration |
| **Quant Engine** | Python FastAPI | 0.111.x | Async, OpenAPI-native, ideal for CPU-bound compute endpoints |
| **Primary Database** | PostgreSQL | 16.x | ACID compliance, JSONB support, strong ecosystem |
| **Time-Series DB** | TimescaleDB (PostgreSQL extension) | 2.x | Optimised hypertables for price tick storage; same connection pool |
| **Cache / PubSub** | Redis | 7.x | BullMQ backing store; price cache; PubSub for real-time price events |
| **Job Queue** | BullMQ (over Redis) | 5.x | Priority queues, retries, rate limiting, cron scheduling — native TypeScript |
| **Message Broker** | Redis PubSub (internal events) + BullMQ Queues (job dispatch) | — | Avoids Kafka/RabbitMQ operational overhead at MVP scale |
| **Secret Management** | HashiCorp Vault | 1.16.x | TOTP secrets, API keys, OAuth tokens — HSM-backed KMS wrap |
| **TOTP Storage** | HashiCorp Vault (Encrypted KV) | — | TOTP secrets never touch application DB; stored in Vault KV v2 |
| **PDF Generation** | Puppeteer (headless Chromium) | latest | Pixel-perfect layouts, full CSS support, chart screenshot capability |
| **Auth** | Passport.js + JWT + TOTP (otplib) | — | Industry standard; TOTP via RFC 6238-compliant otplib |
| **ORM** | TypeORM | 0.3.x | TypeScript decorators, migration support, PostgreSQL-optimised |
| **API Spec** | OpenAPI 3.1 | — | Generated from NestJS decorators via @nestjs/swagger |
| **Frontend** | Next.js 14 (App Router) | 14.x | SSR for SEO; RSC for performance; React ecosystem |
| **Mobile** | React Native (V1.0) | — | Code reuse with web; large ecosystem |
| **Quant Libraries** | NumPy, Pandas, SciPy, QuantLib-Python | — | VaR/CVaR, Sharpe, Beta, Sortino, XIRR, Monte Carlo |
| **Container Runtime** | Docker + Docker Compose (dev) / Kubernetes (prod) | — | Standard container orchestration |
| **CI/CD** | GitHub Actions | — | Native OIDC, matrix builds, Docker layer caching |

---

## 3. C4 Architecture Diagrams

### 3.1 Level 1 — System Context Diagram

> Describes who uses the system and what external systems it depends on.

```mermaid
C4Context
  title System Context — Investor Portfolio Monitoring & Risk Management System

  Person(investor, "Investor", "Retail / HNW investor managing multi-asset portfolio across Indian and global markets")
  Person(ca, "CA / Tax Advisor", "Chartered Accountant reviewing exported tax reports on behalf of investor")

  System(ipms, "IPMS Platform", "Unified portfolio monitoring, risk analytics, and alerting system. Web app + API backend.")

  System_Ext(zerodha, "Zerodha Kite Connect", "Indian equity brokerage — OAuth 2.0 read-only API")
  System_Ext(groww, "Groww Partner API", "Mutual fund and equity holdings")
  System_Ext(icici, "ICICI Direct Breeze API", "Equity holdings and transactions")
  System_Ext(binance, "Binance REST API v3", "Crypto spot balances and trade history")
  System_Ext(wazirx, "WazirX REST API", "Crypto spot balances")
  System_Ext(coingecko, "CoinGecko API", "Crypto prices — primary")
  System_Ext(amfi, "AMFI NAV Feed", "Mutual fund NAV data — EOD")
  System_Ext(yahoo, "Yahoo Finance API", "NSE/BSE equity prices")
  System_Ext(oxr, "Open Exchange Rates", "Foreign exchange rates")
  System_Ext(vault, "HashiCorp Vault", "Secret management — API keys, TOTP secrets, OAuth tokens")
  System_Ext(email_svc, "AWS SES / SendGrid", "Transactional email delivery")
  System_Ext(push_svc, "Firebase Cloud Messaging", "Push notification delivery")
  System_Ext(sentry, "Sentry", "Error tracking and alerting")
  System_Ext(otel, "OpenTelemetry Collector", "Distributed tracing aggregation")

  Rel(investor, ipms, "Uses", "HTTPS — Web Browser / Mobile App")
  Rel(ca, ipms, "Downloads reports from", "HTTPS")

  Rel(ipms, zerodha, "Fetches holdings and transactions", "HTTPS REST OAuth2")
  Rel(ipms, groww, "Fetches MF and equity holdings", "HTTPS REST OAuth2")
  Rel(ipms, icici, "Fetches holdings and transactions", "HTTPS REST API Key")
  Rel(ipms, binance, "Fetches crypto balances and history", "HTTPS REST HMAC-signed")
  Rel(ipms, wazirx, "Fetches crypto balances", "HTTPS REST API Key")
  Rel(ipms, coingecko, "Fetches crypto prices", "HTTPS REST")
  Rel(ipms, amfi, "Fetches MF NAVs", "HTTPS daily batch")
  Rel(ipms, yahoo, "Fetches equity prices", "HTTPS REST")
  Rel(ipms, oxr, "Fetches FX rates", "HTTPS REST")
  Rel(ipms, vault, "Reads and writes secrets", "HTTPS mTLS")
  Rel(ipms, email_svc, "Sends alert and report emails", "HTTPS API")
  Rel(ipms, push_svc, "Sends push notifications", "HTTPS API")
  Rel(ipms, sentry, "Reports errors", "HTTPS SDK")
  Rel(ipms, otel, "Exports traces and metrics", "gRPC OTLP")
```

---

### 3.2 Level 2 — Container Diagram

> Describes the major deployable units (containers) within the IPMS platform.

```mermaid
C4Container
  title Container Diagram — IPMS Platform

  Person(investor, "Investor", "Web Browser or Mobile App")

  Container_Boundary(ipms, "IPMS Platform") {

    Container(web_app, "Web Application", "Next.js 14 / React", "Server-side rendered investor dashboard. Portfolio view, risk analytics, alerts, reports.")

    Container(api_gateway, "API Gateway / NestJS Core", "NestJS 10, Node.js 20, TypeScript", "Modular monolith. Handles all REST API requests, auth validation, domain orchestration, BullMQ job dispatch.")

    Container(bullmq_workers, "Background Worker Pool", "NestJS BullMQ Workers, Node.js 20", "Consumes jobs from Redis queues. Executes provider syncs, risk computation triggers, report generation, alert evaluation.")

    Container(quant_engine, "Quant Engine", "Python 3.12, FastAPI 0.111", "Dedicated CPU-bound microservice. Computes VaR, CVaR, Sharpe, Sortino, Beta, Correlation Matrix, XIRR, Max Drawdown.")

    ContainerDb(postgres, "PostgreSQL 16 + TimescaleDB", "PostgreSQL 16 + TimescaleDB extension", "Primary relational store: users, portfolios, holdings, transactions, alerts, provider credentials. TimescaleDB hypertables for price history.")

    ContainerDb(redis, "Redis 7", "Redis 7 Cluster mode", "BullMQ job queue backing store. Price cache. Redis PubSub for real-time price broadcast. Rate-limit counters.")

    Container(vault_agent, "Vault Agent Sidecar", "HashiCorp Vault Agent", "Manages dynamic secret injection. Renews leases. API keys, TOTP secrets, OAuth tokens delivered to app via environment or memory.")
  }

  System_Ext(providers, "Financial Data Providers", "Zerodha, Groww, ICICI, Binance, WazirX, CoinGecko, AMFI, Yahoo Finance, OXR")
  System_Ext(notify, "Notification Services", "AWS SES, Firebase Cloud Messaging")

  Rel(investor, web_app, "Views dashboard, configures alerts", "HTTPS TLS 1.3")
  Rel(web_app, api_gateway, "API calls", "HTTPS REST / JSON, Internal")
  Rel(investor, api_gateway, "Direct API calls (mobile/PWA)", "HTTPS REST / JSON")

  Rel(api_gateway, postgres, "Reads/writes domain data", "TCP PostgreSQL protocol, TLS")
  Rel(api_gateway, redis, "Job dispatch, cache reads/writes", "TCP Redis protocol, TLS")
  Rel(api_gateway, quant_engine, "Sync risk computation on-demand", "HTTP REST — Internal network only")
  Rel(api_gateway, vault_agent, "Requests secrets", "Unix socket / localhost")

  Rel(bullmq_workers, postgres, "Reads/writes sync results, metrics", "TCP PostgreSQL protocol, TLS")
  Rel(bullmq_workers, redis, "Dequeues jobs, publishes results", "TCP Redis protocol, TLS")
  Rel(bullmq_workers, quant_engine, "Dispatches async risk computation jobs", "HTTP REST — Internal network only")
  Rel(bullmq_workers, providers, "Fetches market data, holdings, transactions", "HTTPS REST")
  Rel(bullmq_workers, notify, "Dispatches alert notifications", "HTTPS API")
  Rel(bullmq_workers, vault_agent, "Requests provider API keys/OAuth tokens", "Unix socket / localhost")

  Rel(quant_engine, postgres, "Reads price history for computation (read-only)", "TCP PostgreSQL protocol, TLS")
```

---

### 3.3 Level 3 — Component Diagram (NestJS API Modular Monolith)

> Describes the modules (bounded contexts) within the NestJS API gateway container.

```mermaid
C4Component
  title Component Diagram — NestJS API Modular Monolith

  Container_Boundary(api, "NestJS API — Modular Monolith") {

    Component(auth_module, "Auth Module", "NestJS Module", "User registration, login, JWT issuance, TOTP MFA validation, session management, password reset. Guards all protected routes.")

    Component(user_module, "User and Preferences Module", "NestJS Module", "User profile management, currency preference, risk tolerance, notification settings, account deletion.")

    Component(provider_module, "Provider Integration Module", "NestJS Module", "OAuth 2.0 flow orchestration, API key management via Vault, provider connection CRUD, sync job scheduling.")

    Component(portfolio_module, "Portfolio Module", "NestJS Module", "Holdings CRUD, manual asset entry, CSV import, transaction management, cost-basis computation. Portfolio snapshot reads.")

    Component(price_module, "Price Feed Module", "NestJS Module", "Price cache reads from Redis. FX rate lookups. Price staleness detection. Publishes price events to Redis PubSub.")

    Component(valuation_module, "Valuation Engine Module", "NestJS Module", "Computes current market value of each holding using prices. Aggregates to portfolio-level net worth. Unrealised P&L calculation.")

    Component(risk_module, "Risk Analytics Module", "NestJS Module", "Orchestrates risk computation: calls Quant Engine for VaR/CVaR/Sharpe. Reads back results, persists to DB. Exposes risk score API.")

    Component(alert_module, "Alert Engine Module", "NestJS Module", "Alert definition CRUD. Alert evaluation orchestration. Cooldown state management. Dispatches notification jobs to BullMQ.")

    Component(report_module, "Report and Export Module", "NestJS Module", "Enqueues report generation jobs. Serves completed report downloads. PDF via Puppeteer and CSV generation.")

    Component(notification_module, "Notification Module", "NestJS Module", "Abstracts email via AWS SES, push via FCM, SMS notification delivery. Manages delivery receipts and retry logic.")

    Component(shared_kernel, "Shared Kernel", "NestJS Shared Module", "Cross-cutting: domain event bus, base repository interfaces, common DTOs, encryption utilities, logging interceptors, OpenTelemetry instrumentation.")
  }

  ContainerDb(postgres, "PostgreSQL + TimescaleDB", "Primary data store")
  ContainerDb(redis, "Redis", "Queue + Cache + PubSub")
  Container(quant_engine, "Python Quant Engine", "FastAPI")
  Container(vault, "Vault Agent", "Secret delivery")

  Rel(auth_module, postgres, "Reads/writes user credentials, sessions", "TypeORM")
  Rel(auth_module, vault, "Reads TOTP secrets", "Vault SDK")
  Rel(user_module, postgres, "Reads/writes user profiles and preferences", "TypeORM")
  Rel(provider_module, vault, "Reads/writes OAuth tokens, API keys", "Vault SDK")
  Rel(provider_module, redis, "Dispatches sync jobs to PriceSyncQueue", "BullMQ")
  Rel(portfolio_module, postgres, "Reads/writes holdings, transactions", "TypeORM")
  Rel(price_module, redis, "Reads price cache, publishes to PubSub", "ioredis")
  Rel(price_module, postgres, "Reads/writes price history via TimescaleDB", "TypeORM")
  Rel(valuation_module, price_module, "Requests current prices", "In-process")
  Rel(valuation_module, portfolio_module, "Reads holdings", "In-process")
  Rel(risk_module, quant_engine, "POST /compute/risk — synchronous on-demand", "HTTP REST")
  Rel(risk_module, postgres, "Persists risk metrics", "TypeORM")
  Rel(alert_module, postgres, "Reads/writes alert definitions, history", "TypeORM")
  Rel(alert_module, redis, "Dispatches notification jobs to AlertQueue", "BullMQ")
  Rel(report_module, redis, "Dispatches report jobs to ReportQueue", "BullMQ")
  Rel(notification_module, postgres, "Reads user notification preferences", "TypeORM")
  Rel(shared_kernel, postgres, "Base repository contracts", "TypeORM")
```

---

### 3.4 Level 3 — Component Diagram (Python Quant Engine)

> Describes the internal computation modules of the Python FastAPI microservice.

```mermaid
C4Component
  title Component Diagram — Python FastAPI Quant Engine

  Container_Boundary(quant, "Python Quant Engine — FastAPI") {

    Component(api_layer, "FastAPI Router Layer", "FastAPI", "REST endpoint definitions. Request validation via Pydantic v2. Routes: POST /compute/risk, POST /compute/xirr, POST /compute/scenario, GET /health")

    Component(var_engine, "VaR and CVaR Engine", "Python / NumPy / Pandas", "Historical Simulation VaR at 95% and 99% confidence. Expected Shortfall. Requires min 252 trading days. Returns INR-denominated loss estimates.")

    Component(perf_engine, "Performance Metrics Engine", "Python / NumPy / SciPy", "Sharpe Ratio annualised, Sortino Ratio downside only, XIRR via Newton-Raphson, CAGR, Max Drawdown, Volatility annualised std dev.")

    Component(beta_corr_engine, "Beta and Correlation Engine", "Python / NumPy / Pandas", "Portfolio Beta vs benchmark index. Pearson pairwise correlation matrix across all holdings. Identifies highly correlated position clusters.")

    Component(scenario_engine, "Scenario and What-If Engine", "Python / NumPy", "Applies historical stress scenarios. Computes portfolio impact given user-supplied allocation delta.")

    Component(data_fetcher, "Price History Data Fetcher", "Python / asyncpg", "Read-only connection to TimescaleDB. Fetches rolling 252-day price return series. No writes. Separate connection pool from NestJS.")

    Component(cache_layer, "Computation Cache", "Python / Redis", "Caches computed risk snapshots keyed by userId and portfolioHash. TTL 1 hour. Prevents redundant recomputation within freshness window.")

    Component(auth_guard, "Service-to-Service Auth", "Python / JWT", "Validates internal JWT issued by NestJS API. Ensures Quant Engine is never directly exposed to public internet.")
  }

  ContainerDb(timescale, "TimescaleDB read-only", "Price history hypertables")
  ContainerDb(redis_cache, "Redis", "Computation result cache")

  Rel(api_layer, auth_guard, "Validates inbound JWT on every request", "In-process middleware")
  Rel(api_layer, var_engine, "Dispatches VaR computation request", "In-process")
  Rel(api_layer, perf_engine, "Dispatches performance metric computation", "In-process")
  Rel(api_layer, beta_corr_engine, "Dispatches beta and correlation request", "In-process")
  Rel(api_layer, scenario_engine, "Dispatches scenario simulation", "In-process")
  Rel(var_engine, data_fetcher, "Requests rolling price return series", "In-process")
  Rel(perf_engine, data_fetcher, "Requests historical returns", "In-process")
  Rel(beta_corr_engine, data_fetcher, "Requests returns and benchmark series", "In-process")
  Rel(data_fetcher, timescale, "SELECT price returns — read only", "asyncpg / TLS")
  Rel(api_layer, cache_layer, "Check cache before compute, write after", "Redis SDK")
  Rel(cache_layer, redis_cache, "GET/SET computation results", "Redis protocol / TLS")
```

---

## 4. Bounded Context Map

> Maps the six strategic bounded contexts of the system, their ownership, and cross-context relationships.

```mermaid
graph TB
  subgraph AuthCtx["Identity and Access Context"]
    A1[User Aggregate]
    A2[Session Aggregate]
    A3[TOTP Credential VO]
  end

  subgraph IngCtx["Data Ingestion Context"]
    I1[ProviderConnection Aggregate]
    I2[SyncJob Entity]
    I3[RawProviderData VO]
  end

  subgraph PortCtx["Portfolio and Valuation Context"]
    P1[Portfolio Aggregate]
    P2[Holding Entity]
    P3[Transaction Entity]
    P4[AssetMaster Reference Data]
    P5[PriceSnapshot VO]
  end

  subgraph RiskCtx["Risk and Analytics Context"]
    R1[RiskSnapshot Aggregate]
    R2[PerformanceMetrics VO]
    R3[QuantComputationRequest VO]
  end

  subgraph AlertCtx["Alert and Notification Context"]
    AL1[AlertDefinition Aggregate]
    AL2[AlertHistory Entity]
    AL3[NotificationDelivery VO]
  end

  subgraph ReportCtx["Report and Export Context"]
    RE1[ReportJob Entity]
    RE2[ReportTemplate VO]
    RE3[ExportFile VO]
  end

  AuthCtx -->|"User identity shared — Conformist"| PortCtx
  AuthCtx -->|"User identity shared — Conformist"| AlertCtx
  AuthCtx -->|"User identity shared — Conformist"| ReportCtx
  AuthCtx -->|"User identity shared — Conformist"| IngCtx

  IngCtx -->|"Publishes HoldingsSyncedEvent — Event Publisher"| PortCtx
  IngCtx -->|"Publishes PriceTickEvent — Event Publisher"| AlertCtx

  PortCtx -->|"Provides PortfolioSnapshot — Open Host Service"| RiskCtx
  PortCtx -->|"Provides transaction data — Open Host Service"| ReportCtx

  RiskCtx -->|"Publishes RiskUpdatedEvent — Event Publisher"| AlertCtx
  RiskCtx -->|"Provides risk metrics — Open Host Service"| ReportCtx
```

### 4.1 Context Relationship Patterns

| Relationship | Pattern | Description |
|---|---|---|
| Auth → All other contexts | **Shared Kernel (Conformist)** | `UserId` and `UserPreferences` are a shared type. Other contexts accept Auth's model. |
| Ingestion → Portfolio | **Event-Published (Downstream)** | Ingestion publishes `HoldingsSyncedEvent`; Portfolio context consumes and applies to holdings. |
| Ingestion → Alert | **Event-Published (Downstream)** | Alert engine subscribes to `PriceTickEvent` via Redis PubSub for real-time price alert evaluation. |
| Portfolio → Risk | **Open Host Service** | Portfolio exposes a well-defined `PortfolioSnapshot` read model consumed by Risk context. |
| Portfolio → Report | **Open Host Service** | Report context reads holdings and transactions via Portfolio's published read model. |
| Risk → Alert | **Event-Published (Downstream)** | Risk publishes `RiskMetricsUpdatedEvent`; Alert engine evaluates risk score change alerts. |
| Risk → Report | **Open Host Service** | Report context reads latest risk snapshot for inclusion in generated reports. |

### 4.2 Anti-Corruption Layers

| Boundary | ACL Location | Purpose |
|---|---|---|
| External Provider APIs → Ingestion Context | `ProviderAdapterFactory` in Ingestion module | Translates provider-specific DTOs into canonical `RawHolding` domain objects |
| CoinGecko API → Price Feed | `CoinGeckoPriceAdapter` | Maps CoinGecko response to canonical `CryptoPrice` value object |
| AMFI NAV Feed → Price Feed | `AmfiNavParser` | Parses AMFI pipe-delimited text into canonical `MFNav` value object |
| Python Quant Engine → Risk Context | `QuantEngineGateway` in Risk module | Translates `PortfolioSnapshot` to Quant Engine request DTO; maps response to `RiskSnapshot` |

---

## 5. Data Flow Pipeline Architecture

### 5.1 End-to-End Pipeline Overview

```mermaid
flowchart LR
  subgraph External["External Data Sources"]
    PR1["Brokerages\nZerodha, Groww,\nICICI Direct"]
    PR2["Crypto Exchanges\nBinance, WazirX"]
    PR3["Market Data\nCoinGecko, Yahoo,\nAMFI, OXR"]
    PR4["Manual Entry\nUser input,\nCSV import"]
  end

  subgraph Stage1["Stage 1 Raw Ingestion"]
    IN1["Provider Sync\nBullMQ Workers"]
    IN2["Price Feed\nBullMQ Workers"]
    IN3["Manual Entry\nAPI endpoint"]
  end

  subgraph Stage2["Stage 2 Normalisation\nACL Adapters"]
    NR1["RawHolding\nCanonical Model"]
    NR2["CryptoPrice\nEquityPrice\nMFNav Canonical"]
    NR3["FXRate\nCanonical"]
  end

  subgraph Stage3["Stage 3 Persistence"]
    DB1["PostgreSQL\nHoldings, Txns"]
    DB2["TimescaleDB\nPrice History"]
    DB3["Redis Cache\nLive Price Cache"]
  end

  subgraph Stage4["Stage 4 Calculation\nBullMQ Job"]
    CA1["Valuation Engine\nNestJS"]
    CA2["Python Quant Engine\nFastAPI"]
    CA3["XIRR and CAGR\nEngine"]
  end

  subgraph Stage5["Stage 5 Analytics\nAggregation"]
    AN1["Portfolio\nNet Worth"]
    AN2["Risk Snapshot\nVaR, Sharpe, Beta"]
    AN3["Performance\nMetrics XIRR/CAGR"]
  end

  subgraph Stage6["Stage 6 Insights\nand Alerting"]
    AL1["Alert Evaluator\nBullMQ"]
    AL2["Notification\nDispatcher"]
    AL3["Report Generator\nPuppeteer"]
    AL4["Dashboard\nAPI Response"]
  end

  PR1 --> IN1
  PR2 --> IN1
  PR3 --> IN2
  PR4 --> IN3

  IN1 --> NR1
  IN2 --> NR2
  IN2 --> NR3
  IN3 --> NR1

  NR1 --> DB1
  NR2 --> DB2
  NR2 --> DB3
  NR3 --> DB3

  DB1 --> CA1
  DB2 --> CA2
  DB3 --> CA1
  CA1 --> CA2

  CA2 --> AN1
  CA2 --> AN2
  CA3 --> AN3

  AN1 --> AL4
  AN2 --> AL1
  AN3 --> AL4
  AN2 --> AL3

  AL1 --> AL2
  AL2 -->|"Email / Push"| User["Investor"]
  AL3 -->|"PDF / CSV"| User
  AL4 -->|"REST API"| User
```

---

### 5.2 Stage 1 — Raw Data Ingestion

```mermaid
sequenceDiagram
  participant Scheduler as BullMQ Cron Scheduler
  participant Worker as Sync Worker BullMQ
  participant Vault as HashiCorp Vault Agent
  participant Provider as External Provider API
  participant Queue as BullMQ Queue
  participant DB as PostgreSQL

  Scheduler->>Queue: Enqueue ProviderSyncJob userId, providerId, priority
  Note over Scheduler: Every 15 min for live providers<br/>EOD for batch providers

  Queue->>Worker: Dequeue ProviderSyncJob
  Worker->>Vault: GET secret for userId and providerId
  Vault-->>Worker: Decrypted credential in memory only never logged

  Worker->>Provider: GET /holdings with OAuth token or HMAC-signed
  Provider-->>Worker: Raw holdings response in provider-specific format

  Worker->>Worker: Apply Anti-Corruption Layer via ProviderAdapterFactory
  Note over Worker: Maps to canonical RawHolding[]<br/>Validates required fields<br/>Detects duplicates

  Worker->>DB: Upsert normalised holdings and transactions
  Worker->>DB: Update ProviderConnection lastSyncAt and syncStatus SUCCESS

  Worker->>Queue: Enqueue ValuationComputeJob userId
  Note over Queue: Triggers Stage 4 immediately after sync
```

**Ingestion Rate Limiting:**

| Provider | Max Rate | Strategy |
|---|---|---|
| Zerodha Kite Connect | 3 req/sec | Token bucket rate limiter in BullMQ limiter config |
| Binance REST API | 1200 req/min weight | Weight-aware request scheduler |
| CoinGecko Free Tier | 10–30 calls/min | Per-minute BullMQ rate limiter |
| AMFI NAV Feed | 1x/day | EOD cron job at 21:30 IST |
| Yahoo Finance | ~2000 req/hr | Bulk symbol batching (max 100 symbols/request) |

---

### 5.3 Stage 2 — Normalisation

```mermaid
flowchart TD
  subgraph ACL["Anti-Corruption Layer — ProviderAdapterFactory"]
    Z["ZerodhaAdapter\n.toCanonical position"]
    G["GrowwAdapter\n.toCanonical holding"]
    B["BinanceAdapter\n.toCanonical balance"]
    W["WazirxAdapter\n.toCanonical balance"]
    M["ManualEntryAdapter\n.toCanonical dto"]
  end

  subgraph Canonical["Canonical Domain Models"]
    RH["RawHolding\nuserId assetType symbol\nisin exchange quantity\ncostBasis currency\npurchaseDate providerRef"]

    CP["CryptoPrice\nsymbol coingeckoId\npriceUsd priceInr\nmarketCapInr timestamp"]

    EP["EquityPrice\nticker exchange\nopenPrice closePrice\nvolume timestamp"]

    FX["FXRate\nbaseCurrency quoteCurrency\nrate source timestamp"]
  end

  Z --> RH
  G --> RH
  B --> RH
  W --> RH
  M --> RH

  CG["CoinGecko API Response"] --> CP
  YF["Yahoo Finance API Response"] --> EP
  OXR["OXR API Response"] --> FX
```

**Normalisation rules:**
- All quantities stored as `DECIMAL(20, 8)` — supports fractional crypto at satoshi-level precision
- All monetary amounts stored in original currency with FX rate snapshot at time of ingestion
- Cost basis stored per transaction; aggregated cost basis computed at query time using user's preferred method (FIFO/LIFO/Avg)
- Timestamps normalised to UTC ISO-8601 with millisecond precision

---

### 5.4 Stage 3 — Persistence

**Database Schema (simplified ERD):**

```
USERS
  id (uuid PK)
  email (varchar UK, encrypted)
  password_hash (bcrypt)
  phone_encrypted (varchar)
  status (enum)
  created_at (timestamp)

USER_PREFERENCES
  id (uuid PK)
  user_id (uuid FK -> USERS)
  home_currency (char 3)
  risk_tolerance (enum)
  timezone (varchar)
  notification_settings (jsonb)

PROVIDER_CONNECTIONS
  id (uuid PK)
  user_id (uuid FK -> USERS)
  provider_code (varchar)
  vault_secret_path (varchar)
  status (enum)
  last_sync_at (timestamp)
  last_sync_status (enum)

HOLDINGS
  id (uuid PK)
  user_id (uuid FK -> USERS)
  provider_connection_id (uuid FK nullable)
  asset_type (varchar)
  symbol (varchar)
  isin (varchar nullable)
  quantity (DECIMAL 20,8)
  avg_cost_basis (DECIMAL 20,8)
  cost_currency (char 3)
  cost_basis_method (enum FIFO/LIFO/AVG)
  is_manual (boolean)
  updated_at (timestamp)

TRANSACTIONS
  id (uuid PK)
  holding_id (uuid FK -> HOLDINGS)
  user_id (uuid FK -> USERS)
  type (enum BUY/SELL/DIVIDEND/SPLIT/BONUS)
  quantity (DECIMAL 20,8)
  price_per_unit (DECIMAL 20,8)
  currency (char 3)
  fx_rate_to_home (DECIMAL 10,6)
  transacted_at (timestamp)
  provider_ref_id (varchar)

RISK_SNAPSHOTS
  id (uuid PK)
  user_id (uuid FK -> USERS)
  var_95_1d (DECIMAL 20,2)
  cvar_95_1d (DECIMAL 20,2)
  sharpe_ratio (DECIMAL 10,4)
  sortino_ratio (DECIMAL 10,4)
  beta (DECIMAL 10,4)
  max_drawdown (DECIMAL 10,4)
  volatility_annual (DECIMAL 10,4)
  portfolio_risk_score (integer 0-100)
  concentration_risk (jsonb)
  correlation_matrix (jsonb)
  computed_at (timestamp)
  price_history_days_used (integer)

ALERT_DEFINITIONS
  id (uuid PK)
  user_id (uuid FK -> USERS)
  name (varchar)
  alert_type (enum)
  condition (jsonb)
  channels (jsonb)
  is_active (boolean)
  cooldown_duration (interval)
  last_triggered_at (timestamp)

ALERT_HISTORY
  id (uuid PK)
  alert_id (uuid FK -> ALERT_DEFINITIONS)
  triggered_at (timestamp)
  delivered_at (timestamp)
  delivery_status (enum)
  triggered_values (jsonb)

-- TimescaleDB Hypertables (partitioned by time):
EQUITY_PRICES (ticker, exchange, close_price, open_price, volume, price_time)
CRYPTO_PRICES (symbol, price_usd, price_inr, market_cap_inr, price_time)
MF_NAVS (isin, nav, nav_date, ingested_at)
FX_RATES (base_currency, quote_currency, rate, source, rate_time)
```

**TimescaleDB Configuration:**
- `equity_prices`, `crypto_prices`, `fx_rates` partitioned as hypertables by time column (7-day chunks)
- Continuous aggregates for OHLCV 1-hour and 1-day rollups
- Compression policy: chunks older than 90 days automatically compressed
- Retention policy: raw tick data retained 2 years; daily aggregates retained 10 years

---

### 5.5 Stage 4 — Calculation

```mermaid
sequenceDiagram
  participant Worker as BullMQ Worker
  participant NestJS as NestJS Valuation Module
  participant Redis as Redis Cache
  participant Python as Python Quant Engine FastAPI
  participant TimescaleDB as TimescaleDB
  participant DB as PostgreSQL

  Worker->>NestJS: Invoke ValuationComputeJob userId

  NestJS->>DB: SELECT holdings and transactions WHERE userId
  NestJS->>Redis: GET prices by symbol batch MGET
  Note over NestJS: Cache HIT: use cached price<br/>Cache MISS: read from TimescaleDB latest

  NestJS->>NestJS: Compute holding-level valuations
  Note over NestJS: currentValue = quantity x currentPrice x fxRate<br/>unrealisedPnL = currentValue - costBasis<br/>weight = currentValue / totalPortfolioValue

  NestJS->>DB: UPSERT portfolio_snapshots with net_worth and asset_allocation
  NestJS->>Python: POST /compute/risk with holdings and priceReturns and benchmarkReturns

  Python->>Redis: GET risk_cache by userId and portfolioHash
  alt Cache HIT under 1 hour stale
    Redis-->>Python: Cached RiskSnapshot
    Python-->>NestJS: 200 riskMetrics fromCache true
  else Cache MISS
    Python->>TimescaleDB: SELECT returns for last 252 trading days via asyncpg
    TimescaleDB-->>Python: Returns matrix holdings by days
    Python->>Python: Compute VaR Historical Sim 95%
    Python->>Python: Compute CVaR Sharpe Sortino Beta MaxDD Corr Matrix
    Python->>Redis: SET risk_cache by userId and portfolioHash TTL 3600
    Python-->>NestJS: 200 riskMetrics computedAt
  end

  NestJS->>DB: UPSERT risk_snapshots VaR Sharpe Beta
  NestJS->>Worker: Job COMPLETE
  Worker->>Worker: Enqueue AlertEvaluationJob userId
```

---

### 5.6 Stage 5 — Analytics

The analytics layer aggregates computed outputs into read-model projections optimised for API response:

| Read Model | Populated From | Key Fields |
|---|---|---|
| `PortfolioDashboardView` | ValuationEngine outputs | totalNetWorth, assetAllocation[], topGainers[], topLosers[], dailyChangeAbs, dailyChangePct, lastUpdatedAt |
| `RiskDashboardView` | RiskSnapshot (PostgreSQL) | riskScore 0-100, var95_1d_inr, sharpeRatio, beta, maxDrawdown, concentrationRisk[], correlationMatrix[][] |
| `PerformanceView` | Performance metrics computed on request | xirr, cagr, absoluteReturn, realisedGainLoss, unrealisedGainLoss, dividendIncome, benchmarkComparison[] |
| `HoldingDetailView` | ValuationEngine + TransactionEngine | currentPrice, priceChange1D, costBasis, avgCostPerUnit, unrealisedPnL, portfolioWeight, xirr holding-level |

---

### 5.7 Stage 6 — Insights & Alerting

```mermaid
sequenceDiagram
  participant Queue as BullMQ AlertQueue
  participant Evaluator as Alert Evaluator Worker
  participant DB as PostgreSQL
  participant Redis as Redis PubSub and Cooldown State
  participant Dispatcher as Notification Dispatcher
  participant SES as AWS SES
  participant FCM as Firebase Cloud Messaging

  Queue->>Evaluator: Dequeue AlertEvaluationJob userId
  Evaluator->>DB: SELECT active alert_definitions WHERE userId
  Evaluator->>DB: SELECT latest portfolio_snapshot and risk_snapshot WHERE userId

  loop For each AlertDefinition
    Evaluator->>Evaluator: Evaluate condition against current values
    Note over Evaluator: currentPrice less than threshold<br/>drawdown greater than 10%<br/>riskScore change greater than 10 pts

    alt Condition BREACHED
      Evaluator->>Redis: GET cooldown by alertId to check if in cooldown
      alt NOT in cooldown
        Evaluator->>DB: INSERT alert_history triggered_at and triggered_values
        Evaluator->>Redis: SET cooldown by alertId with TTL cooldownSeconds
        Evaluator->>Queue: Enqueue NotificationJob alertId and channels
      else In cooldown window
        Note over Evaluator: Suppress duplicate alert
      end
    end
  end

  Queue->>Dispatcher: Dequeue NotificationJob
  Dispatcher->>DB: SELECT alert details and user notification preferences

  par Email delivery
    Dispatcher->>SES: Send alert email HTML template
    SES-->>Dispatcher: 200 MessageId
    Dispatcher->>DB: UPDATE delivery_status DELIVERED delivered_at NOW
  and Push notification
    Dispatcher->>FCM: Send push notification FCM v1 API
    FCM-->>Dispatcher: 200 success
  end
```

---

## 6. Synchronous vs. Asynchronous Workflow Design

### 6.1 Synchronous REST/OpenAPI Flows

> Used when the user is waiting for a response — must complete within SLA.

| Endpoint | Module | Max Latency | What It Does |
|---|---|---|---|
| `POST /auth/login` | Auth | < 300ms | Validates credentials, issues JWT. No I/O beyond DB read. |
| `GET /portfolio/dashboard` | Portfolio + Valuation | < 200ms | Reads materialised portfolio snapshot from PostgreSQL. No live computation. |
| `GET /portfolio/holdings/:id` | Portfolio | < 100ms | Single holding detail read. Joins latest price from Redis cache. |
| `GET /risk/snapshot` | Risk | < 200ms | Reads latest persisted risk snapshot. Does NOT trigger computation. |
| `POST /risk/refresh` | Risk | < 1000ms | Triggers synchronous call to Quant Engine only if no fresh snapshot (< 1hr) exists in cache. |
| `GET /alerts` | Alert | < 100ms | Lists user's alert definitions from DB. |
| `POST /alerts` | Alert | < 200ms | Creates new alert definition. Returns immediately. |
| `GET /providers` | Provider | < 100ms | Lists connected provider statuses with last sync timestamps. |
| `POST /providers/:id/sync` | Provider | < 500ms | Validates provider, **enqueues** a sync job, returns `{ jobId }`. Does NOT wait for sync. |
| `POST /reports/generate` | Report | < 300ms | Validates params, **enqueues** report generation job, returns `{ jobId }`. |
| `GET /reports/:jobId/status` | Report | < 100ms | Polls job status. Returns download URL when COMPLETE. |

> **Critical Rule:** No synchronous API endpoint performs external HTTP calls to financial providers. All provider I/O is exclusively asynchronous via BullMQ.

---

### 6.2 Asynchronous BullMQ Queue Flows

> Used for all I/O-heavy, long-running, or background operations.

```mermaid
flowchart TD
  subgraph Triggers["Job Triggers"]
    T1["BullMQ Cron\nevery 15 min"]
    T2["POST /providers sync\nuser-initiated"]
    T3["Completed SyncJob\ncascades downstream"]
    T4["BullMQ Cron\n21:30 IST daily"]
    T5["POST /reports/generate"]
    T6["Redis PubSub\nPriceTickEvent"]
  end

  subgraph Queues["BullMQ Named Queues Redis-backed"]
    Q1["price-sync-queue\nNORMAL priority"]
    Q2["provider-sync-queue\nHIGH for user-initiated"]
    Q3["valuation-queue\nHIGH priority"]
    Q4["risk-compute-queue\nNORMAL priority"]
    Q5["alert-eval-queue\nHIGH priority"]
    Q6["report-queue\nLOW priority"]
    Q7["notification-queue\nCRITICAL priority"]
  end

  subgraph Workers["BullMQ Worker Processes NestJS"]
    W1["PriceSyncWorker\nx2 instances"]
    W2["ProviderSyncWorker\nx3 instances"]
    W3["ValuationWorker\nx2 instances"]
    W4["RiskComputeWorker\nx2 instances"]
    W5["AlertEvaluator\nx2 instances"]
    W6["ReportWorker\nx1 instance"]
    W7["NotificationDispatcher\nx2 instances"]
  end

  T1 --> Q1
  T2 --> Q2
  T3 --> Q3
  T3 --> Q5
  T4 --> Q1
  T5 --> Q6
  T6 --> Q5

  Q1 --> W1
  Q2 --> W2
  Q3 --> W3
  Q4 --> W4
  Q5 --> W5
  Q6 --> W6
  Q7 --> W7

  W2 -->|"on complete"| Q3
  W3 -->|"on complete"| Q4
  W4 -->|"on complete"| Q5
  W5 -->|"on breach"| Q7
```

---

### 6.3 Queue Topology

| Queue Name | Priority | Concurrency | Retry Policy | Rate Limit | Purpose |
|---|---|---|---|---|---|
| `price-sync-queue` | NORMAL | 5 | 3 retries, exp backoff (2^n x 1s) | Per-provider rate limit | Fetches live prices from CoinGecko, Yahoo, AMFI |
| `provider-sync-queue` | HIGH (user) / LOW (cron) | 3 | 3 retries, exp backoff (2^n x 5s) | 1 sync/user/provider/15min | Syncs holdings from brokerages and exchanges |
| `valuation-queue` | HIGH | 5 | 2 retries | None | Recomputes net worth and holding valuations |
| `risk-compute-queue` | NORMAL | 3 | 2 retries, fixed 10s delay | 1/user/hour (dedup by jobId) | Calls Python Quant Engine for full risk metrics |
| `alert-eval-queue` | HIGH | 10 | 1 retry | None | Evaluates all active alerts against latest portfolio data |
| `report-queue` | LOW | 1 | 1 retry | None | Generates PDF/CSV reports via Puppeteer |
| `notification-queue` | CRITICAL | 5 | 5 retries, exp backoff | Per-channel rate limit | Dispatches emails, push notifications, SMS |

**Job Deduplication:** `risk-compute-queue` uses BullMQ's `jobId` deduplication keyed by `userId`. A new risk computation job for the same user is dropped if one is already pending or processing, preventing queue flooding on rapid consecutive syncs.

---

## 7. Security & Isolation Boundaries

### 7.1 Network Boundary Architecture

```mermaid
flowchart TB
  subgraph Internet["Public Internet"]
    U["Investors\nWeb and Mobile"]
    Ext["External Providers\nZerodha, Binance, etc."]
  end

  subgraph DMZ["DMZ / Public Layer"]
    CDN["CDN Cloudflare\nDDoS protection, TLS termination, WAF"]
    LB["Load Balancer\nAWS ALB / nginx\nTLS 1.3 termination"]
    WEB["Next.js Web App\nPublic subnet"]
  end

  subgraph Private["Private Network VPC Internal"]
    API["NestJS API Cluster\nPrivate subnet"]
    WORKERS["BullMQ Workers\nPrivate subnet"]
    QUANT["Python Quant Engine\nPrivate subnet NOT internet exposed"]
    REDIS["Redis Cluster\nIsolated subnet"]
    PG["PostgreSQL Primary and Replica\nIsolated DB subnet"]
    VAULT["HashiCorp Vault Cluster\nIsolated subnet"]
  end

  U -->|"HTTPS"| CDN
  CDN --> LB
  LB --> WEB
  LB --> API
  Ext -->|"HTTPS outbound only"| WORKERS

  WEB -->|"HTTPS internal"| API
  API -->|"TCP TLS internal only"| REDIS
  API -->|"TCP TLS internal only"| PG
  API -->|"HTTP internal network only no public route"| QUANT
  API -->|"HTTPS mTLS"| VAULT
  WORKERS -->|"TCP TLS internal"| REDIS
  WORKERS -->|"TCP TLS internal"| PG
  WORKERS -->|"HTTP internal only"| QUANT
  WORKERS -->|"HTTPS mTLS"| VAULT
  QUANT -->|"TCP TLS read-only"| PG
  QUANT -->|"TCP TLS"| REDIS
```

> **Critical Rule:** The Python Quant Engine has **zero public internet exposure**. It accepts connections only from the NestJS API and BullMQ Workers within the private VPC subnet. No external IP or port exists for the Quant Engine.

---

### 7.2 Authentication & Authorisation Architecture

```mermaid
flowchart LR
  REQ["API Request"]
  JWTGuard["NestJS JwtAuthGuard\nPassport.js"]
  JWT["Validate JWT\nRS256 signed\nVerify exp iss aud"]
  TOTP["TOTP MFA Guard\notplib RFC 6238\nFor sensitive operations"]
  RBAC["Role Guard\nUSER or ADMIN\nResource ownership check"]
  Handler["Route Handler"]
  Reject["401 Unauthorized"]
  Reject2["403 Forbidden"]

  REQ --> JWTGuard
  JWTGuard --> JWT
  JWT -->|"Valid"| TOTP
  JWT -->|"Invalid"| Reject
  TOTP -->|"MFA required and valid"| RBAC
  TOTP -->|"Not required"| RBAC
  RBAC -->|"Authorised and owns resource"| Handler
  RBAC -->|"Forbidden"| Reject2
```

**Service-to-Service Auth (NestJS to Python Quant Engine):**
- NestJS issues a short-lived internal JWT (RS256, 5-minute TTL, `aud: quant-engine`) on each request
- Python Quant Engine validates this JWT using the shared public key
- No API key or basic auth — cryptographic verification prevents spoofing

### 7.3 Encryption Strategy

| Data Category | At Rest | In Transit | Key Management |
|---|---|---|---|
| User passwords | bcrypt (cost 12) — never stored plaintext | N/A | N/A |
| OAuth refresh tokens | AES-256-GCM via Vault KV v2 | TLS 1.3 | Vault-managed, auto-rotated 90-day |
| Provider API keys | AES-256-GCM via Vault KV v2 | TLS 1.3 | Vault-managed, auto-rotated 90-day |
| TOTP secrets | Vault KV v2 (dedicated path) | TLS 1.3 + mTLS | Vault-managed |
| User PII (email, phone) | AES-256-GCM field-level encryption | TLS 1.3 | Application-level KMS-backed key |
| Portfolio data | PostgreSQL TDE | TLS 1.3 | Cloud KMS (AWS KMS or GCP KMS) |
| Price history | TimescaleDB encrypted tablespace | TLS 1.3 | Cloud KMS |
| Redis data | Redis AUTH + TLS | TLS 1.3 | Cloud KMS for persistence encryption |

### 7.4 OWASP Top 10 Controls

| OWASP Risk | Control Implemented |
|---|---|
| A01 Broken Access Control | Resource ownership enforced in every repository query (`WHERE user_id = :userId`). RBAC guards on sensitive endpoints. |
| A02 Cryptographic Failures | AES-256-GCM for all secrets. bcrypt for passwords. TLS 1.3 everywhere. No MD5/SHA1. |
| A03 Injection | TypeORM parameterised queries everywhere. No raw SQL concatenation. Input validated with class-validator DTOs. |
| A04 Insecure Design | Read-only API principle (D-002). No write access to any brokerage. |
| A05 Security Misconfiguration | Infrastructure as Code (Terraform). Secrets in Vault, never in env files. Docker security scanning via Trivy. |
| A06 Vulnerable Components | Snyk and Dependabot weekly scans. Automated PR for dependency updates. |
| A07 Auth Failures | JWT RS256. TOTP MFA. Max login attempts (5) with exponential lockout. OTP expiry 5 minutes. |
| A08 Software Integrity | SBOM generated at each build. Docker image signing via cosign. |
| A09 Logging Failures | All auth events, data access, and API errors logged to ELK. No PII in logs. Correlation IDs on every request. |
| A10 SSRF | All outbound HTTP calls restricted to allowlisted provider domains. No user-supplied URLs followed. |

---

## 8. Infrastructure & Deployment Topology

### 8.1 Monorepo Structure

```
investor-portfolio-system/
├── apps/
│   ├── api/                     # NestJS Modular Monolith
│   │   ├── src/
│   │   │   ├── auth/            # Auth bounded context
│   │   │   ├── users/           # User and Preferences context
│   │   │   ├── providers/       # Data Ingestion context
│   │   │   ├── portfolio/       # Portfolio and Valuation context
│   │   │   ├── risk/            # Risk Analytics context (orchestration)
│   │   │   ├── alerts/          # Alert Engine context
│   │   │   ├── reports/         # Report and Export context
│   │   │   ├── notifications/   # Notification delivery
│   │   │   ├── price-feed/      # Price feed cache and TimescaleDB reads
│   │   │   └── shared/          # Shared Kernel (events, base repos, utils)
│   │   └── Dockerfile
│   ├── workers/                 # BullMQ worker process (separate deployment)
│   │   ├── src/
│   │   │   ├── price-sync/
│   │   │   ├── provider-sync/
│   │   │   ├── valuation/
│   │   │   ├── risk-compute/
│   │   │   ├── alert-eval/
│   │   │   ├── report-gen/
│   │   │   └── notification/
│   │   └── Dockerfile
│   ├── quant-engine/            # Python FastAPI Quant Microservice
│   │   ├── app/
│   │   │   ├── routers/         # FastAPI route definitions
│   │   │   ├── engines/         # VaR, Sharpe, Beta, XIRR engines
│   │   │   ├── adapters/        # asyncpg DB adapter (read-only)
│   │   │   ├── cache/           # Redis cache layer
│   │   │   └── auth/            # JWT guard middleware
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── web/                     # Next.js 14 Frontend
│       ├── app/                 # App Router pages
│       ├── components/
│       └── Dockerfile
├── packages/
│   ├── shared-types/            # Canonical TypeScript DTOs shared between api and web
│   ├── ui-components/           # Shared React component library
│   └── config/                  # Shared ESLint, TypeScript, Jest configs
├── infra/
│   ├── terraform/               # Infrastructure as Code
│   ├── k8s/                     # Kubernetes manifests
│   └── docker-compose.yml       # Local development full-stack
└── docs/
    ├── architecture/
    ├── api/
    ├── adr/
    └── product/
```

### 8.2 Kubernetes Deployment Architecture (Production)

```mermaid
flowchart TB
  subgraph K8s["Kubernetes Cluster"]
    subgraph Ingress["Ingress Layer"]
      NGINX["NGINX Ingress Controller\ncert-manager Let's Encrypt"]
    end

    subgraph AppNS["Namespace ipms-app"]
      WEB["web Deployment Next.js\nReplicas 2-5 HPA"]
      API["api Deployment NestJS\nReplicas 2-10 HPA"]
      WORKER["workers Deployment BullMQ\nReplicas 2-6 KEDA ScaledObject"]
      QUANT["quant-engine Deployment FastAPI\nReplicas 2-4 HPA CPU"]
      VAULT_AGENT["Vault Agent Injector\nSidecar per pod"]
    end

    subgraph DataNS["Namespace ipms-data StatefulSets"]
      PG_PRIMARY["PostgreSQL Primary\nStatefulSet 1 replica"]
      PG_REPLICA["PostgreSQL Read Replica\nStatefulSet 1-2 replicas"]
      REDIS_CLUSTER["Redis Cluster\nStatefulSet 3 shards"]
    end

    subgraph MonNS["Namespace ipms-monitoring"]
      PROM["Prometheus"]
      GRAFANA["Grafana"]
      OTEL_COL["OpenTelemetry Collector"]
      LOKI["Loki Log Aggregation"]
    end
  end

  NGINX --> WEB
  NGINX --> API
  API --> QUANT
  API --> REDIS_CLUSTER
  API --> PG_PRIMARY
  WORKER --> PG_PRIMARY
  WORKER --> REDIS_CLUSTER
  WORKER --> QUANT
  QUANT --> PG_REPLICA
  QUANT --> REDIS_CLUSTER

  API -.->|"metrics"| PROM
  WORKER -.->|"metrics"| PROM
  QUANT -.->|"metrics"| PROM
  API -.->|"traces"| OTEL_COL
  WORKER -.->|"traces"| OTEL_COL
```

> **KEDA:** The workers deployment scales based on BullMQ queue depth (Redis list length), not CPU. Worker capacity grows in direct proportion to job backlog, not to server load.

---

## 9. Inter-Service Communication Contracts

### 9.1 NestJS to Python Quant Engine (Internal REST)

**Endpoint:** `POST /compute/risk`

```typescript
// Request — NestJS QuantEngineGateway sends:
interface QuantRiskRequest {
  userId: string;
  portfolioHash: string;          // SHA-256 of holdings state for cache keying
  holdings: HoldingForQuant[];
  homeCurrency: string;           // 'INR' | 'USD' | etc.
  benchmarkSymbol: string;        // 'NIFTY50' | 'SP500'
  computeOptions: {
    varConfidence: 0.95 | 0.99;
    varHorizonDays: number;       // 1 (default)
    minHistoryDays: number;       // 252 (default)
    includeCorrelationMatrix: boolean;
    includeScenarios: boolean;
  };
}

interface HoldingForQuant {
  holdingId: string;
  symbol: string;
  assetType: 'EQUITY' | 'CRYPTO' | 'MF';
  weightPct: number;              // current portfolio weight
  priceHistoryDays: number;       // available days of history
}
```

```python
# Response — Python Quant Engine returns:
class QuantRiskResponse(BaseModel):
    userId: str
    portfolioHash: str
    computedAt: datetime
    fromCache: bool
    priceHistoryDaysUsed: int
    var_95_1d_inr: Decimal
    var_99_1d_inr: Decimal
    cvar_95_1d_inr: Decimal
    sharpeRatio: Decimal
    sortinoRatio: Decimal
    betaVsBenchmark: Decimal
    maxDrawdownPct: Decimal
    annualisedVolatilityPct: Decimal
    portfolioRiskScore: int         # 0-100 computed score
    concentrationRisk: list[ConcentrationItem]
    correlationMatrix: list[list[float]] | None
    warnings: list[str]             # e.g., "< 252 days history — VaR may be less reliable"
```

### 9.2 Redis PubSub — Price Event Schema

**Channel:** `price:tick:{assetType}` e.g. `price:tick:crypto`, `price:tick:equity`

```json
{
  "eventType": "PRICE_TICK",
  "assetType": "CRYPTO",
  "symbol": "BTC",
  "priceInr": 5234567.89,
  "priceUsd": 62450.00,
  "changePercent1D": -2.34,
  "publishedAt": "2026-08-13T07:15:00.000Z",
  "source": "coingecko"
}
```

**Subscribers:**
- Alert Evaluator Worker — evaluates price alerts in near real-time
- Price Feed Module — updates Redis hot cache per-symbol

### 9.3 BullMQ Job Schemas

```typescript
interface ProviderSyncJobData {
  userId: string;
  providerConnectionId: string;
  providerCode: 'zerodha' | 'groww' | 'icici' | 'binance' | 'wazirx';
  triggeredBy: 'CRON' | 'USER' | 'SYSTEM';
  priority: 'HIGH' | 'NORMAL' | 'LOW';
}

interface ValuationJobData {
  userId: string;
  triggeredBySync: boolean;
  forceRefresh: boolean;
}

interface RiskComputeJobData {
  userId: string;
  portfolioSnapshotId: string;
  triggeredByValuation: boolean;
}

interface AlertEvalJobData {
  userId: string;
  trigger: 'RISK_UPDATED' | 'PRICE_TICK' | 'VALUATION_COMPLETE' | 'SCHEDULED';
  priceTickPayload?: PriceTickEvent;
}

interface NotificationJobData {
  userId: string;
  alertId: string;
  alertType: string;
  channels: ('EMAIL' | 'PUSH' | 'SMS')[];
  templateData: Record<string, unknown>;
}
```

---

## 10. Observability Architecture

```mermaid
flowchart LR
  subgraph Services["Services instrumented with OpenTelemetry SDK"]
    A["NestJS API"]
    W["BullMQ Workers"]
    Q["Python Quant Engine"]
    WEB["Next.js RUM"]
  end

  subgraph Collect["Collection Layer"]
    OTEL["OpenTelemetry Collector\nOTLP gRPC receiver"]
  end

  subgraph Backends["Observability Backends"]
    TEMPO["Grafana Tempo\nDistributed Traces"]
    PROM["Prometheus\nMetrics"]
    LOKI["Loki\nStructured Logs"]
    GRAFANA["Grafana Dashboards\nUnified view"]
    SENTRY["Sentry\nError Tracking"]
    PD["PagerDuty\nP1 Alerts"]
    SLACK["Slack\nP2 and P3 Alerts"]
  end

  A -->|"OTLP gRPC"| OTEL
  W -->|"OTLP gRPC"| OTEL
  Q -->|"OTLP gRPC"| OTEL
  WEB -->|"RUM events"| OTEL

  OTEL --> TEMPO
  OTEL --> PROM
  OTEL --> LOKI

  TEMPO --> GRAFANA
  PROM --> GRAFANA
  LOKI --> GRAFANA

  A -->|"SDK"| SENTRY
  W -->|"SDK"| SENTRY

  PROM -->|"AlertManager rules"| PD
  PROM -->|"AlertManager rules"| SLACK
```

**Key Instrumentation Points:**

| Instrumentation | What is Traced / Measured |
|---|---|
| All NestJS HTTP requests | Trace ID, span per controller, DB query spans, cache hit/miss |
| BullMQ job lifecycle | Job enqueue time, processing time, retry count, failure reason |
| Python Quant Engine calls | Computation duration per metric type, cache hit rate, price history rows fetched |
| External provider API calls | Response time, status code, retry count per provider |
| PostgreSQL queries | Query duration, table, index usage via TypeORM instrumentation |
| Redis operations | Command latency, cache hit/miss ratio per key pattern |
| Alert delivery | End-to-end latency from breach detection to delivery confirmation |

---

## 11. Architecture Decision Records (ADR) Summary

> Full ADR documents to be written in `docs/adr/` directory.

| ADR | Title | Decision | Status |
|---|---|---|---|
| ADR-001 | Backend Framework | NestJS (TypeScript) Modular Monolith | Accepted |
| ADR-002 | Quant Computation | Python FastAPI Microservice (not in-process) | Accepted |
| ADR-003 | Message Queue | BullMQ over Redis (not Kafka / RabbitMQ) | Accepted |
| ADR-004 | Primary Database | PostgreSQL 16 + TimescaleDB extension | Accepted |
| ADR-005 | Secret Management | HashiCorp Vault (TOTP, API keys, OAuth tokens — not application DB) | Accepted |
| ADR-006 | PDF Generation | Puppeteer / Headless Chromium (not wkhtmltopdf / ReportLab) | Accepted |
| ADR-007 | VaR Methodology | Historical Simulation (not Parametric) — aligns with D-005 | Accepted |
| ADR-008 | Monorepo Structure | Turborepo-managed monorepo (api, workers, quant-engine, web, shared packages) | Accepted |
| ADR-009 | Service Discovery | Kubernetes internal DNS (not Consul / Eureka) | Accepted |
| ADR-010 | Auth Token Strategy | RS256 JWT (not HS256) — asymmetric for service-to-service verification | Accepted |

---

## 12. Open Questions Resolved

> All Phase 2 Architecture open questions (OQ-006 to OQ-010) are resolved.

| Question ID | Question | Resolution | Rationale |
|---|---|---|---|
| **OQ-006** | API framework: FastAPI vs NestJS? | **Both** — NestJS as modular monolith for business logic; FastAPI as dedicated quant microservice | NestJS excels at I/O-bound orchestration; Python FastAPI excels at CPU-bound matrix computation |
| **OQ-007** | Message queue: RabbitMQ vs Kafka vs AWS SQS? | **BullMQ over Redis** | Sufficient throughput for MVP/V1.0 scale; zero additional infrastructure (Redis already required for cache); native TypeScript integration; rich job management (retries, priorities, cron, deduplication) |
| **OQ-008** | TOTP secret storage: application DB vs dedicated secrets vault? | **HashiCorp Vault KV v2** — never in application DB | TOTP secrets are authentication credentials, not business data. Vault provides HSM-backed encryption, access auditing, automatic lease rotation, and complete isolation from application DB. |
| **OQ-009** | VaR computation: in-app Python engine vs external quant library? | **In-app Python engine with NumPy/Pandas + QuantLib-Python** in dedicated FastAPI microservice | FastAPI encapsulates all quant computation. QuantLib-Python for bond valuation and XIRR. NumPy/Pandas for Historical Simulation VaR, Sharpe, Beta. |
| **OQ-010** | PDF generation: Puppeteer vs wkhtmltopdf vs ReportLab? | **Puppeteer (headless Chromium)** | Pixel-perfect rendering of React-generated charts. Full CSS/JS support. Reports embed live chart images. wkhtmltopdf has poor CSS support; ReportLab requires bespoke layout code. |

---

## Appendix A — Full Portfolio Sync Sequence (End-to-End)

```mermaid
sequenceDiagram
  actor User
  participant Web as Next.js Web App
  participant API as NestJS API
  participant Queue as BullMQ Redis
  participant SyncWorker as Provider Sync Worker
  participant Vault as HashiCorp Vault
  participant Provider as Zerodha Kite Connect
  participant ValWorker as Valuation Worker
  participant RiskWorker as Risk Compute Worker
  participant QuantEngine as Python Quant Engine FastAPI
  participant AlertWorker as Alert Evaluator Worker
  participant DB as PostgreSQL and TimescaleDB
  participant Redis as Redis Cache and PubSub
  participant Notify as Notification Dispatcher

  User->>Web: Click Sync Now for Zerodha
  Web->>API: POST /providers/id/sync
  API->>Queue: Enqueue ProviderSyncJob HIGH priority userId and providerId
  API-->>Web: 202 Accepted with jobId
  Web-->>User: Sync started optimistic UI

  Queue->>SyncWorker: Dequeue ProviderSyncJob
  SyncWorker->>Vault: GET secret for userId and provider zerodha
  Vault-->>SyncWorker: OAuth access_token decrypted in-memory only
  SyncWorker->>Provider: GET /portfolio/holdings with Bearer token
  Provider-->>SyncWorker: 200 positions and holdings array
  SyncWorker->>SyncWorker: ZerodhaAdapter.toCanonical on positions
  SyncWorker->>DB: UPSERT holdings and transactions
  SyncWorker->>DB: UPDATE provider_connections last_sync_at NOW
  SyncWorker->>Queue: Enqueue ValuationJob userId

  Queue->>ValWorker: Dequeue ValuationJob
  ValWorker->>DB: SELECT holdings WHERE userId
  ValWorker->>Redis: MGET price by symbol for all symbols
  ValWorker->>ValWorker: Compute holding valuations and net worth
  ValWorker->>DB: UPSERT portfolio_snapshots
  ValWorker->>Queue: Enqueue RiskComputeJob userId

  Queue->>RiskWorker: Dequeue RiskComputeJob
  RiskWorker->>Redis: GET risk_cache by userId and portfolioHash
  Note over RiskWorker: Cache MISS
  RiskWorker->>QuantEngine: POST /compute/risk with holdings and homeCurrency
  QuantEngine->>DB: SELECT price_returns last 252 days read-only replica
  QuantEngine->>QuantEngine: Compute VaR Sharpe Beta Correlation Matrix
  QuantEngine->>Redis: SET risk_cache by userId TTL 3600
  QuantEngine-->>RiskWorker: 200 riskMetrics
  RiskWorker->>DB: UPSERT risk_snapshots
  RiskWorker->>Queue: Enqueue AlertEvalJob userId

  Queue->>AlertWorker: Dequeue AlertEvalJob
  AlertWorker->>DB: SELECT active alert_definitions WHERE userId
  AlertWorker->>AlertWorker: Evaluate all conditions
  Note over AlertWorker: Portfolio drawdown greater than 10% BREACHED
  AlertWorker->>Redis: GET cooldown by alertId MISS not in cooldown
  AlertWorker->>DB: INSERT alert_history
  AlertWorker->>Redis: SET cooldown by alertId TTL 3600
  AlertWorker->>Queue: Enqueue NotificationJob email and push

  Queue->>Notify: Dequeue NotificationJob
  Notify->>Notify: Send email via AWS SES
  Notify->>Notify: Send push via Firebase Cloud Messaging
  Notify->>DB: UPDATE alert_history delivered_at and status DELIVERED

  Web->>API: GET /providers/id/sync/jobId/status polling
  API-->>Web: 200 status COMPLETE lastSyncAt timestamp
  Web-->>User: Portfolio synced dashboard updated
```

---

## Appendix B — Quant Engine OpenAPI Contract (Excerpt)

```yaml
openapi: 3.1.0
info:
  title: IPMS Quant Engine API
  version: 1.0.0
  description: >
    Internal-only. Not publicly exposed.
    Accessible only from NestJS API and BullMQ Workers
    within the private VPC subnet.

security:
  - InternalJWT: []

paths:
  /compute/risk:
    post:
      summary: Compute full risk metrics for a portfolio snapshot
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/QuantRiskRequest'
      responses:
        '200':
          description: Risk metrics computed successfully
        '422':
          description: Insufficient price history — min 252 days required
        '503':
          description: TimescaleDB unavailable

  /compute/xirr:
    post:
      summary: Compute XIRR for a series of irregular cash flows
      responses:
        '200':
          description: XIRR computed successfully
        '422':
          description: XIRR non-convergent (no real solution exists)

  /health:
    get:
      summary: Health check — no auth required
      security: []
      responses:
        '200':
          description: "OK { status, db_connected, redis_connected, version }"

components:
  securitySchemes:
    InternalJWT:
      type: http
      scheme: bearer
      bearerFormat: JWT
      description: >
        RS256 JWT issued by NestJS API.
        Audience must be 'quant-engine'.
        Maximum TTL 5 minutes.
        Public key shared via Kubernetes secret mount.
```

---

*End of System Architecture Document — SA-001 v1.0.0*

*Next Phase: Phase 4 — Development Environment & CI/CD Setup*
