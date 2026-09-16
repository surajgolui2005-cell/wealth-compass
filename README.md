# Wealth Compass — Institutional Portfolio Monitoring & Quantitative Risk Management System

[![CI Pipeline](https://github.com/wealth-compass/investor-portfolio-system/actions/workflows/ci.yml/badge.svg)](.github/workflows/ci.yml)
[![Docker Packaging](https://github.com/wealth-compass/investor-portfolio-system/actions/workflows/build-docker.yml/badge.svg)](.github/workflows/build-docker.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.4-red.svg)](https://nestjs.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg)](https://nextjs.org/)
[![React Native Expo](https://img.shields.io/badge/Expo-SDK_52-black.svg)](https://expo.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-teal.svg)](https://fastapi.tiangolo.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16_TimescaleDB-336791.svg)](https://www.timescale.com/)
[![Redis](https://img.shields.io/badge/Redis-7_Alpine-red.svg)](https://redis.io/)
[![Tests](https://img.shields.io/badge/Automated_Tests-740+_Passing-brightgreen.svg)](#-testing-pyramid--qa-certification)
[![Security](https://img.shields.io/badge/Security-AES--256--GCM_%7C_Argon2id-success.svg)](#-cybersecurity--compliance-architecture)

An institutional-grade, multi-tenant financial aggregation, quantitative risk analytics, and portfolio monitoring platform engineered specifically for the **Indian Financial Ecosystem** (NSE/BSE, AMFI, RBI Account Aggregator) and global multi-asset portfolios.

---

## 📑 Table of Contents

1. [Executive Summary & Vision](#-executive-summary--vision)
2. [High-Level Architecture](#-high-level-architecture)
3. [Core Feature Matrix](#-core-feature-matrix)
   - [Indian Financial Ecosystem & Multi-Asset Ingestion](#1-indian-financial-ecosystem--multi-asset-ingestion)
   - [Quantitative Risk & Modern Portfolio Theory Engine](#2-quantitative-risk--modern-portfolio-theory-engine)
   - [AI Portfolio Copilot](#3-ai-portfolio-copilot)
   - [Institutional Web Dashboard & Data Visualization](#4-institutional-web-dashboard--data-visualization)
   - [Mobile Companion App & PWA](#5-mobile-companion-app--pwa)
   - [Notification & Proactive Alert Engine](#6-notification--proactive-alert-engine)
4. [Technology Stack](#-technology-stack)
5. [Repository & Monorepo Structure](#-repository--monorepo-structure)
6. [Quick Start & Local Development Setup](#-quick-start--local-development-setup)
   - [Prerequisites](#prerequisites)
   - [3-Command Quick Boot](#3-command-quick-boot)
   - [Detailed Step-by-Step Installation](#detailed-step-by-step-installation)
   - [Port Allocation Map](#port-allocation-map)
7. [Environment Configuration Reference](#-environment-configuration-reference)
8. [Database Schema & Master Data Ledger](#-database-schema--master-data-ledger)
9. [REST API Contract & Endpoints](#-rest-api-contract--endpoints)
10. [Cybersecurity & Compliance Architecture](#-cybersecurity--compliance-architecture)
11. [Testing Pyramid & QA Certification](#-testing-pyramid--qa-certification)
12. [DevOps, CI/CD & Cloud Infrastructure](#-devops-cicd--cloud-infrastructure)
13. [Living Documentation Suite](#-living-documentation-suite)
14. [Contributing Guidelines](#-contributing-guidelines)
15. [License & Acknowledgments](#-license--acknowledgments)

---

## 🌐 Executive Summary & Vision

Wealth Compass was architected to eliminate financial fragmentation for retail investors, high-net-worth individuals (HNIs), family offices, and wealth advisors. Modern investors maintain wealth across fragmented platforms: equities across discount brokers, mutual funds via direct portals, fixed deposits across multiple banks, alternate assets like digital gold and real estate, and crypto holdings.

### Problems Solved:

- **Scattered Net Worth**: Disparate statements, differing valuation standards, and lack of real-time multi-asset aggregation.
- **Flawed Return Metrics**: Flawed Simple Return (CAGR) assumptions that ignore cash inflows/outflows, solved via exact **Time-Weighted Return (TWR)**, **Money-Weighted Return (XIRR)**, and **Modified Dietz**.
- **Floating-Point Financial Inaccuracies**: Elimination of standard IEEE-754 precision drift via strict **Decimal(18,8)** arbitrary-precision arithmetic across every ledger transaction and FIFO tax-lot.
- **Black-Box Risk Visibility**: Institutional risk models (VaR, CVaR, Sharpe, Sortino, Jensen's Alpha, Beta, Herfindahl-Hirschman Index concentration) brought directly to consumer portfolios.
- **Privacy & Security Concerns**: Zero-leak architecture using **AES-256-GCM** authenticated encryption for broker credentials and statements, paired with **Argon2id** password hashing and strict multi-tenant database isolation.

---

## 🏗️ High-Level Architecture

Wealth Compass employs a **clean modular monolith gateway** with dedicated **high-performance quantitative microservices**, an asynchronous **BullMQ event bus**, and a unified frontend ecosystem (Next.js 14 Web + React Native Mobile).

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CLIENT PRESENTATION LAYER                                     │
├───────────────────────────────────┬──────────────────────────────────┬───────────────────────────┤
│        Next.js 14 Web App         │      React Native Expo App       │  REST API Clients / SDKs  │
│  (Tailwind, Shadcn UI, Recharts)  │   (iOS / Android / NativeWind)   │  (OpenAPI v3 / Swagger)   │
└─────────────────┬─────────────────┴─────────────────┬────────────────┴─────────────┬─────────────┘
                  │                                   │                              │
                  └───────────────────────────────────┼──────────────────────────────┘
                                                      │ HTTPS / WSS
                                                      ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             NestJS MODULAR MONOLITH GATEWAY (PORT 3000)                          │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  • Auth & RBAC (Argon2id, Dual JWT, Throttling)    • Provider Ingestion (Zerodha, Groww, CAMS)   │
│  • Multi-Tenant Isolation & Ownership Guards       • Valuation Engine & Cash Flow Ledger         │
│  • FIFO & Weighted Average Lot Matching            • Asynchronous Report Generator (PDF / CSV)   │
│  • AES-256-GCM Credential Cryptoservice            • Pino Structured Logging with Trace Context  │
│  • BullMQ Queue Producers (Sync, Alerts, Reports)  • Prometheus Telemetry Exporter (/metrics)    │
└──────────────┬──────────────────────────────┬──────────────────────────────┬─────────────────────┘
               │                              │                              │
               ▼                              ▼                              ▼
┌──────────────────────────────┐┌──────────────────────────────┐┌──────────────────────────────────┐
│   TIMESCALEDB (POSTGRES 16)  ││       REDIS 7 CLUSTER        ││     PYTHON 3.12 QUANT ENGINE     │
├──────────────────────────────┤├──────────────────────────────┤├──────────────────────────────────┤
│ • 14 Relational Models       ││ • BullMQ Job Queues          ││ • FastAPI Microservice (Port 8000│
│ • Decimal(18,8) Precision    ││ • Multi-Tier Valuation Cache ││ • Historical & Parametric VaR    │
│ • Hypertable Price History   ││ • Session Token Denylist     ││ • CVaR (Expected Shortfall)      │
│ • FIFO Lot Indexes & Cas     ││ • Real-time Lock Manager     ││ • Sharpe, Sortino, CAPM Beta     │
│ • Automated Prisma Migrations││ • Pub/Sub Notification Bus   ││ • HHI Concentration & Markowitz  │
└──────────────────────────────┘└──────────────────────────────┘└────────────────┬─────────────────┘
                                                                                 │
                                                                                 ▼
                                                                ┌──────────────────────────────────┐
                                                                │    AI PORTFOLIO COPILOT (8001)   │
                                                                ├──────────────────────────────────┤
                                                                │ • llama-3.3-70b-versatile(groq)  │
                                                                │ • Deterministic Fallback Engine  │
                                                                │ • Context-Aware Portfolio QA     │
                                                                │ • Rebalancing & Tax Suggestions  │
                                                                └──────────────────────────────────┘
```

---

## 🌟 Core Feature Matrix

### 1. Indian Financial Ecosystem & Multi-Asset Ingestion

- **Broker Integrations**:
  - Direct API connector for **Zerodha (Kite Connect)** and automated statement sync.
  - **Groww, Upstox, ICICI Direct, Angel One** standard trade book CSV/Excel ingestion.
- **CAMS & KFintech CAS Parser**:
  - Automated ingestion of Consolidated Account Statement (CAS) password-protected PDFs.
  - Multi-page text stream parsing with regex layout extractors extracting folios, ISINs, scheme names, transaction types (SIP, Purchase, Redemption, Dividend Reinvestment), units, and NAVs.
- **AMFI Mutual Fund NAV Daily Sync**:
  - Automated daily synchronization with the Association of Mutual Funds in India (AMFI) central registry for ~40,000 active mutual fund schemes.
- **RBI Account Aggregator (AA) Framework**:
  - Support for consent-based financial data aggregation for bank accounts, term deposits, and recurring deposits.
- **Multi-Asset Class Support**:
  - Indian & US Equities, Mutual Funds, Exchange Traded Funds (ETFs).
  - Fixed Income (Government Bonds, Corporate FDs, SGBs - Sovereign Gold Bonds, EPF/PPF).
  - Alternate Assets: Physical / Digital Gold, Real Estate, and Cryptocurrencies (Binance, CoinSwitch).

### 2. Quantitative Risk & Modern Portfolio Theory Engine

- **Value-at-Risk (VaR)**:
  - Parametric (Variance-Covariance) and Historical Simulation VaR at 95% and 99% confidence intervals.
- **Conditional Value-at-Risk (CVaR / Expected Shortfall)**:
  - Tail-risk quantification measuring the expected loss exceeding the VaR cutoff.
- **Risk-Adjusted Performance Metrics**:
  - **Sharpe Ratio** (Excess return per unit of total risk).
  - **Sortino Ratio** (Excess return penalized exclusively by downside semi-variance).
  - **Treynor Ratio** & **Jensen's Alpha** against benchmark indices (NIFTY 50, S&P 500).
  - **CAPM Beta** capturing systematic market sensitivity.
- **Diversification & Concentration Metrics**:
  - **Herfindahl-Hirschman Index (HHI)** for single-stock, sector, and asset class concentration.
  - Asset correlation matrix identifying diversification breakdowns.
- **Modern Portfolio Theory (MPT) Optimization**:
  - Markowitz Mean-Variance optimization, Efficient Frontier generator, Maximum Sharpe and Minimum Volatility portfolio weights.
- **Historical Stress-Testing Engine**:
  - Instant portfolio replay through historical market shocks:
    - _2008 Global Financial Crisis (Lehman Shock)_
    - _2020 COVID-19 Liquidity Crash_
    - _2022 Global Inflation & Rate Hike Shock_
    - _Tech / Growth Selloff_

### 3. AI Portfolio Copilot

- **Hybrid Intelligence Architecture**:
  - Powered by **Google Gemini 1.5 Flash** / OpenAI / Groq LLMs for natural language portfolio advisory.
  - **100% Deterministic Fallback Engine**: If no external API key is provided, the copilot seamlessly runs an offline rule-based financial reasoning engine—guaranteeing zero runtime failures.
- **Context-Aware Analytics**:
  - Analyzes active asset allocations, unrealized tax gains/losses, concentration risks, and portfolio drag.
  - Suggests tax-loss harvesting opportunities under Indian Income Tax provisions (Short-Term Capital Gains vs Long-Term Capital Gains).

### 4. Institutional Web Dashboard & Data Visualization

- **Modern Next.js 14 App Router UI**:
  - Built with React 18, Tailwind CSS, Shadcn UI, and Lucide Icons.
  - Dark/Light mode support with curated slate and emerald color palettes.
- **Interactive Financial Visualizations**:
  - Dynamic Asset Allocation donut charts with Drill-Down by Sector, Market Cap, and Currency.
  - Time-series performance charts comparing portfolio returns against NIFTY 50 and S&P 500.
  - Risk speedometer gauge visualizing real-time portfolio volatility and VaR exposure.
- **Transaction & Tax Lot Ledger**:
  - Complete FIFO buy/sell execution breakdown with realized and unrealized P&L tracking.
- **Executive Reporting & Export**:
  - High-fidelity PDF report generation (Wealth Summary, Capital Gains, Risk Audit) via `pdfmake` and RFC 4180-compliant CSV exports.

### 5. Mobile Companion App & PWA

- **Cross-Platform React Native App**:
  - Engineered with **Expo SDK 52** and **NativeWind v4** for iOS and Android.
  - Biometric authentication (Face ID / Fingerprint via `expo-secure-store`).
  - Push notifications via `expo-notifications` for critical threshold alerts.
- **Progressive Web App (PWA)**:
  - First-class PWA configuration via `next-pwa` enabling mobile home-screen installation directly from the browser with offline capability.

### 6. Notification & Proactive Alert Engine

- **Event-Driven Architecture**:
  - Rule-based triggers evaluated against portfolio state changes and market price updates.
  - Threshold alerts: Drawdown limits, individual position drops (>5%), volatility spikes, and bond/FD maturity warnings.
- **Smart 24-Hour Cooldown Filter**:
  - Prevents alert fatigue using Redis TTL keys to suppress redundant alerts within configurable timeframes.
- **Multi-Channel Dispatch**:
  - In-app notification center, webhooks, and asynchronous email delivery via BullMQ.

---

## 💻 Technology Stack

```
====================================================================================================
LAYER                   TECHNOLOGY STACK                         PURPOSE / NOTES
====================================================================================================
Monorepo Engine         Turborepo 2.0 + pnpm Workspaces          High-speed build caching & linking
Backend Gateway         NestJS 10.4 + TypeScript 5.7             Modular monolith, Hexagonal architecture
Runtime                 Node.js 20 LTS                           Enterprise LTS engine
Relational DB           PostgreSQL 16 + TimescaleDB              Hypertable time-series & relational ACID
ORM & Migrations        Prisma ORM 5.22                          Type-safe schema, migrations & studio
Cache & Event Bus       Redis 7 Alpine + BullMQ 6                Task scheduling, job queues & session cache
Quantitative Engine     Python 3.12 + FastAPI + NumPy / SciPy    Institutional risk models, MPT, VaR/CVaR
AI Copilot              Google Gemini 1.5 Flash / Rule Fallback   Natural language portfolio insights
Web Portal              Next.js 14.2 (App Router) + React 18     SSR/SSG, TanStack Query, Shadcn UI
Styling & Viz           Tailwind CSS + Recharts + Lucide         Glassmorphism theme & financial charts
Mobile Application      React Native (Expo SDK 52) + NativeWind  iOS & Android native client
Security & Crypto       Argon2id + AES-256-GCM + Passport JWT    Bank-grade password & credential security
Observability           Pino JSON Logger + Prometheus + Grafana  Distributed trace IDs, metrics exporter
Containerization        Docker + Docker Compose (Multi-stage)    Reproducible local & prod deployments
Cloud Infrastructure    AWS (Terraform: ECS, RDS, Redis, ALB)    Production-ready Infrastructure as Code
Testing Frameworks      Jest 29 + Vitest 2 + Pytest + Playwright Comprehensive 4-tier testing pyramid
====================================================================================================
```

---

## 📁 Repository & Monorepo Structure

```
.
├── apps/
│   ├── api/                     # NestJS backend API modular monolith (Port 3000)
│   │   ├── prisma/              # Prisma schema, migrations, and seed scripts
│   │   └── src/
│   │       ├── modules/         # Auth, Portfolios, Assets, Providers, Alerts, Reports
│   │       └── common/          # Guards, Filters, Interceptors, Crypto Service
│   ├── web/                     # Next.js 14 App Router frontend portal (Port 3001)
│   │   ├── src/app/             # Pages: Dashboard, Holdings, Risk, Copilot, Analytics
│   │   └── src/components/      # Reusable UI components (Shadcn, Recharts)
│   ├── mobile/                  # React Native Expo SDK 52 companion mobile app
│   │   └── src/                 # Screens, Navigation, Secure Storage, API hooks
│   ├── quant-engine/            # Python 3.12 quantitative analytics service (Port 8000)
│   │   ├── src/                 # FastAPI routes, VaR, CVaR, MPT, Sharpe solvers
│   │   └── tests/               # 360+ Pytest mathematical verification tests
│   └── workers/                 # BullMQ background workers (Sync, Alerts, Reports)
│
├── services/
│   └── analytics/               # AI Portfolio Copilot service (Port 8001)
│       ├── app/                 # FastAPI copilot server with LLM / fallback logic
│       └── tests/               # Copilot unit and scenario evaluation tests
│
├── packages/
│   ├── shared-types/            # Shared TypeScript interfaces, DTOs, and enums
│   ├── config/                  # Shared ESLint, Prettier, and TypeScript configs
│   └── ui-components/           # Reusable component library shared across apps
│
├── infrastructure/
│   ├── docker/                  # Multi-stage production Dockerfiles
│   ├── grafana/                 # Pre-configured Grafana telemetry dashboards
│   └── terraform/               # AWS Production IaC (VPC, ECS, RDS, Redis, CloudFront)
│
├── docs/                        # Complete living documentation suite (ADRs, Runbooks)
├── scripts/                     # Automation utilities & master test runner
├── docker-compose.yml           # Backing service orchestrator (PostgreSQL, Redis, Adminer)
├── pnpm-workspace.yaml          # Workspace configuration
├── turbo.json                   # Turborepo pipeline orchestration
└── README.md                    # Repository master documentation
```

---

## ⚡ Quick Start & Local Development Setup

### Prerequisites

Ensure you have the following installed on your workstation:

- **Node.js**: `v20.x` LTS or later ([Download](https://nodejs.org/))
- **pnpm**: `v8.x` or `v9.x` (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Python**: `3.11` or `3.12` with `pip` and `venv`
- **Docker & Docker Compose**: Docker Desktop or Docker Engine ([Download](https://www.docker.com/))
- **Git**: Latest version

---

### 3-Command Quick Boot

Get the entire backing infrastructure and application stack running in under 3 minutes:

```bash
# 1. Install dependencies across all monorepo workspaces
pnpm install

# 2. Boot backing services (PostgreSQL 16 TimescaleDB & Redis 7 Alpine)
docker-compose up -d

# 3. Launch full monorepo development stack (API, Web, and Workers)
pnpm dev
```

---

### Detailed Step-by-Step Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/wealth-compass/investor-portfolio-system.git
cd "Investor Portolio Monitoring and Risk Management System"
```

#### 2. Configure Environment Variables

Copy the template `.env.example` file to `.env`:

```bash
cp .env.example .env
```

_(Windows PowerShell)_:

```powershell
Copy-Item .env.example .env
```

> [!NOTE]
> The default values in `.env.example` are pre-configured to work out-of-the-box with local Docker containers. No paid API keys are required to run the full platform.

#### 3. Start Database & Redis Backing Services

```bash
docker-compose up -d
```

Verify that the containers are healthy:

```bash
docker-compose ps
```

#### 4. Run Prisma Database Migrations & Seeds

Initialize your PostgreSQL database with the complete 14-table financial schema:

```bash
# Generate Prisma client bindings
pnpm --filter @investor-pm/api prisma:generate

# Run database migrations
pnpm --filter @investor-pm/api prisma:migrate
```

#### 5. Start the Quantitative Engine (Python Microservice)

Open a new terminal to start the high-performance math engine:

```bash
cd apps/quant-engine
python -m venv venv

# Windows:
.\venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn src.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 6. Start the AI Portfolio Copilot Service

In another terminal:

```bash
cd services/analytics
python -m venv venv

# Windows:
.\venv\Scripts\activate
# macOS/Linux:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

#### 7. Launch Full Web & API Development Servers

From the repository root:

```bash
pnpm dev
```

---

### Port Allocation Map

| Service Name                 | Port   | Base URL / Health Endpoint                                                       | Purpose                                           |
| :--------------------------- | :----- | :------------------------------------------------------------------------------- | :------------------------------------------------ |
| **Next.js Web Portal**       | `3001` | [http://localhost:3001](http://localhost:3001)                                   | Primary investor web dashboard & visual analytics |
| **NestJS Backend API**       | `3000` | [http://localhost:3000](http://localhost:3000)                                   | REST API Gateway, auth, ledger, and services      |
| **Swagger API Docs**         | `3000` | [http://localhost:3000/api/docs](http://localhost:3000/api/docs)                 | Interactive OpenAPI v3 API exploration            |
| **API Health Readiness**     | `3000` | [http://localhost:3000/health/readiness](http://localhost:3000/health/readiness) | 3-tier deep readiness probe (DB, Redis, Quant)    |
| **Prometheus Metrics**       | `3000` | [http://localhost:3000/metrics](http://localhost:3000/metrics)                   | Telemetry metrics for Prometheus scraper          |
| **Quant Engine API**         | `8000` | [http://localhost:8000/docs](http://localhost:8000/docs)                         | FastAPI quantitative risk & MPT endpoints         |
| **AI Copilot Service**       | `8001` | [http://localhost:8001](http://localhost:8001)                                   | Gemini / Rule-based portfolio copilot             |
| **PostgreSQL (TimescaleDB)** | `5432` | `localhost:5432`                                                                 | Relational ledger & time-series storage           |
| **Redis Cache & Queues**     | `6379` | `localhost:6379`                                                                 | BullMQ queues and multi-tier valuation cache      |
| **Adminer Database UI**      | `8080` | [http://localhost:8080](http://localhost:8080)                                   | Web-based database management GUI                 |

---

## ⚙️ Environment Configuration Reference

Key variables defined in `.env.example`:

```ini
# Application & Ports
NODE_ENV=development
PORT=3000
API_PORT=3000
WEB_PORT=3001
QUANT_ENGINE_PORT=8000
ADMINER_PORT=8080

# PostgreSQL (TimescaleDB)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_dev_password_only
POSTGRES_DB=investor_pm
DATABASE_URL=postgresql://postgres:postgres_dev_password_only@localhost:5432/investor_pm

# Redis Store
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_URL=redis://localhost:6379

# Microservices
QUANT_ENGINE_URL=http://localhost:8000
ANALYTICS_COPILOT_PORT=8001
NEXT_PUBLIC_COPILOT_URL=http://localhost:8001

# Cryptography & Security Secrets
JWT_SECRET=dev_jwt_secret_key_must_be_at_least_32_characters_long_for_security
JWT_EXPIRES_IN=1d
JWT_REFRESH_SECRET=dev_jwt_refresh_secret_key_must_be_at_least_32_characters_long
JWT_REFRESH_EXPIRES_IN=7d
ENCRYPTION_KEY_AES256=dev_aes256_secret_key_32_bytes_long_!

# Optional Market Data & AI Keys
ALPHA_VANTAGE_API_KEY=
COINGECKO_API_KEY=
COPILOT_LLM_API_KEY=          # Leave empty to use deterministic rule-based fallback
COPILOT_LLM_MODEL=gemini-1.5-flash
```

---

## 🗄️ Database Schema & Master Data Ledger

Wealth Compass employs a relational financial schema managed by Prisma ORM and backed by PostgreSQL 16 with TimescaleDB hypertables.

```mermaid
erDiagram
    USERS ||--o{ PORTFOLIOS : owns
    USERS ||--o{ AUDIT_LOGS : triggers
    USERS ||--o{ ALERT_RULES : configures
    PORTFOLIOS ||--o{ HOLDINGS : contains
    PORTFOLIOS ||--o{ TRANSACTIONS : records
    PORTFOLIOS ||--o{ VALUATION_SNAPSHOTS : tracks
    PORTFOLIOS ||--o{ PERFORMANCE_METRICS : generates
    ASSETS ||--o{ HOLDINGS : classifies
    ASSETS ||--o{ TRANSACTIONS : targets
    ASSETS ||--o{ HISTORICAL_PRICES : catalogs
    TRANSACTIONS ||--o{ TAX_LOTS : matches_fifo
    ALERT_RULES ||--o{ ALERT_NOTIFICATIONS : dispatches

    USERS {
        uuid id PK
        string email UK
        string password_hash
        string full_name
        string role
        boolean is_active
        timestamp created_at
    }

    PORTFOLIOS {
        uuid id PK
        uuid user_id FK
        string name
        string base_currency
        string cost_basis_method
        decimal total_value
        timestamp updated_at
    }

    HOLDINGS {
        uuid id PK
        uuid portfolio_id FK
        uuid asset_id FK
        decimal quantity
        decimal average_buy_price
        decimal current_price
        decimal unrealized_pnl
    }

    TRANSACTIONS {
        uuid id PK
        uuid portfolio_id FK
        uuid asset_id FK
        string type
        decimal quantity
        decimal price
        decimal fees
        timestamp executed_at
    }

    ASSETS {
        uuid id PK
        string isin UK
        string symbol UK
        string name
        string asset_class
        string sector
        string country
    }
```

### Key Schema Characteristics:

1. **Arbitrary Precision**: All amounts, quantities, prices, fees, and valuation metrics use `Decimal(18,8)` to eliminate rounding drift.
2. **Deterministic FIFO Matching**: `tax_lots` records cost basis and open quantity per buy lot, automatically consumed upon sell executions.
3. **Composite Indexing**: Optimized multi-column indexes on `(portfolio_id, asset_id)`, `(user_id, created_at)`, and `(asset_id, date DESC)`.
4. **Tenant Isolation**: Every financial query strictly filters by authenticated `user_id` preventing Insecure Direct Object References (IDOR).

---

## 🔌 REST API Contract & Endpoints

All API endpoints follow strict REST conventions, consume/produce JSON envelopes, and support standard pagination `(?page=1&limit=20)`:

| Module         | Method | Endpoint                              | Description                                   | Auth Required |
| :------------- | :----- | :------------------------------------ | :-------------------------------------------- | :------------ |
| **Auth**       | `POST` | `/api/v1/auth/register`               | Register new investor account                 | No            |
| **Auth**       | `POST` | `/api/v1/auth/login`                  | Authenticate and receive dual JWTs            | No            |
| **Auth**       | `POST` | `/api/v1/auth/refresh`                | Rotate access token with refresh token        | Refresh Token |
| **Auth**       | `GET`  | `/api/v1/auth/me`                     | Fetch authenticated profile details           | Bearer JWT    |
| **Portfolios** | `GET`  | `/api/v1/portfolios`                  | List user portfolios with aggregate metrics   | Bearer JWT    |
| **Portfolios** | `POST` | `/api/v1/portfolios`                  | Create new multi-currency portfolio           | Bearer JWT    |
| **Portfolios** | `GET`  | `/api/v1/portfolios/:id`              | Fetch portfolio summary, holdings & cash      | Bearer JWT    |
| **Holdings**   | `GET`  | `/api/v1/portfolios/:id/holdings`     | Paginated list of active positions            | Bearer JWT    |
| **Ledger**     | `POST` | `/api/v1/portfolios/:id/transactions` | Post new transaction (Buy/Sell/Dividend)      | Bearer JWT    |
| **Valuation**  | `GET`  | `/api/v1/portfolios/:id/valuation`    | Real-time fixed-precision valuation breakdown | Bearer JWT    |
| **Risk**       | `GET`  | `/api/v1/portfolios/:id/risk`         | VaR (95/99), CVaR, Sharpe, Sortino, Beta      | Bearer JWT    |
| **Stress**     | `POST` | `/api/v1/portfolios/:id/stress-test`  | Run historical crisis replay scenario         | Bearer JWT    |
| **Providers**  | `POST` | `/api/v1/providers/cas/upload`        | Upload & parse password-protected CAS PDF     | Bearer JWT    |
| **Providers**  | `POST` | `/api/v1/providers/zerodha/sync`      | Trigger Kite Connect portfolio sync           | Bearer JWT    |
| **Alerts**     | `GET`  | `/api/v1/alerts`                      | List configured alert rules & history         | Bearer JWT    |
| **Alerts**     | `POST` | `/api/v1/alerts`                      | Create drawdown/concentration alert rule      | Bearer JWT    |
| **Reports**    | `POST` | `/api/v1/reports/export`              | Queue asynchronous PDF / CSV generation       | Bearer JWT    |
| **Copilot**    | `POST` | `http://localhost:8001/chat`          | AI Copilot natural language Q&A               | Bearer JWT    |
| **Health**     | `GET`  | `/health/readiness`                   | Deep readiness probe (DB, Redis, Quant)       | No            |
| **Metrics**    | `GET`  | `/metrics`                            | Prometheus metrics scrape endpoint            | No            |

---

## 🔒 Cybersecurity & Compliance Architecture

```mermaid
flowchart TD
    REQ[Inbound Client Request] --> HELMET[Helmet Security Headers\nCSP, HSTS, X-Frame]
    HELMET --> THROTTLE[NestJS Throttler Guard\n100 req/min per IP]
    THROTTLE --> CORS[Strict CORS Policy\nRestricted Origin Whitelist]
    CORS --> AUTH[Passport JWT Guard\nDual Access & Refresh Tokens]
    AUTH --> RBAC[Role-Based Access Control\nUser vs Admin Scopes]
    RBAC --> IDOR[Tenant Isolation Interceptor\nEnforces req.user.id Ownership]
    IDOR --> CRYPTO[AES-256-GCM Cryptoservice\nEncrypted At-Rest Credentials]
    CRYPTO --> DB[(PostgreSQL TimescaleDB)]
    IDOR --> REDIS[(Redis Session Store)]
    IDOR --> SANITIZE[Pino Zero-PII Log Scrubber\nMasks Tokens, Passwords, PAN]
    SANITIZE --> LOGS[Structured JSON Logs]
```

- **Password Storage**: Zero plain-text storage. Hardened with **Argon2id** (memory cost: 65536 KiB, time cost: 3 iterations, parallelism: 4).
- **Session Protection**: Dual JWT scheme with short-lived access tokens (15m) and secure refresh tokens (7d). Stored in `HttpOnly`, `SameSite=Strict`, `Secure` cookies.
- **Data-at-Rest Encryption**: All third-party broker API secrets and statement passwords are encrypted using **AES-256-GCM** with unique 96-bit initialization vectors (IV) and authentication tags.
- **Strict Tenant Isolation**: Every portfolio, transaction, and alert query is scoped to the authenticated `user_id`. Direct object references without tenant ownership return immediate `404/403` errors.
- **Zero-PII Telemetry**: Logging interceptor scrubs PAN numbers, email addresses, phone numbers, and bearer tokens before persisting Pino structured logs.

---

## 🧪 Testing Pyramid & QA Certification

Wealth Compass maintains a comprehensive automated testing pyramid with over **740+ passing tests** across four distinct testing tiers:

```
                  ┌────────────────────────┐
                  │   Playwright E2E       │  18 End-to-End User Journeys
                  │   (Browser Automation) │  (Login, CAS Upload, Dashboard)
                  ├────────────────────────┤
               ┌──┴────────────────────────┴──┐
               │    Vitest Component Tests    │  46 Frontend Component Tests
               │    (Next.js & React Testing) │  (Shadcn UI, Recharts, Hooks)
               ├──────────────────────────────┤
            ┌──┴──────────────────────────────┴──┐
            │       Python Pytest Suites         │  363 Quantitative Math Tests
            │       (FastAPI & Quant Algorithms) │  (VaR, CVaR, XIRR, MPT Solvers)
            ├────────────────────────────────────┤
         ┌──┴────────────────────────────────────┴──┐
         │          Jest Backend Tests              │  346 Unit & Integration Tests
         │          (NestJS API & Services)         │  (Auth, FIFO, Decimal Math)
         └──────────────────────────────────────────┘
```

### Running Automated Test Suites:

```bash
# 1. Execute the unified master test runner (All 4 testing tiers)
pnpm test:all

# 2. Run backend API Jest test suites (346 tests)
pnpm --filter @investor-pm/api test

# 3. Run frontend Vitest component tests (46 tests)
pnpm --filter @investor-pm/web test

# 4. Run Python quantitative engine pytest suite (363 tests)
cd apps/quant-engine && pytest

# 5. Run AI Copilot service tests
cd services/analytics && pytest

# 6. Run headless Playwright E2E browser tests (18 journeys)
pnpm --filter @investor-pm/web test:e2e
```

---

## 🚀 DevOps, CI/CD & Cloud Infrastructure

### Continuous Integration & Delivery (`.github/workflows/`)

DevOps automation is structured into three continuous GitHub Actions pipelines:

1. **`ci.yml`**: Triggers on every Pull Request and push to `main`. Executes parallel linting, typechecking, Prisma schema validation, Jest suites, Vitest suites, and Pytest suites in under 3 minutes with automated pnpm store caching.
2. **`build-docker.yml`**: Multi-stage container builds for API, Web, and Quant Engine. Executes automated **Trivy vulnerability security scans**, blocking any container image with High or Critical CVEs before pushing to GitHub Container Registry (GHCR).
3. **`deploy-staging.yml`**: Automatically applies non-destructive Prisma database migrations (`prisma migrate deploy`), updates AWS ECS Fargate task definitions, and performs deep synthetic health verification with automated rollback upon probe failure.

### Infrastructure as Code (AWS Terraform)

Production infrastructure is codified in [`infrastructure/terraform`](infrastructure/terraform):

- **Networking**: Custom multi-AZ AWS VPC with public and private subnets, NAT Gateways, and route tables.
- **Compute**: Containerized microservices running on serverless **AWS ECS Fargate** behind an Application Load Balancer (ALB).
- **Database**: Multi-AZ **AWS RDS PostgreSQL** with automated point-in-time recovery and automated read replicas.
- **Cache**: Clustered **AWS ElastiCache Redis** with multi-AZ automatic failover.
- **Edge CDN**: **AWS CloudFront CDN** with AWS WAF for edge caching and DDoS mitigation.

---

## 📚 Living Documentation Suite

Wealth Compass maintains dedicated, in-depth architectural and operational guides:

| Document                    | Path                                                                                 | Purpose                                                                          |
| :-------------------------- | :----------------------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| **Developer Setup Guide**   | [`docs/SETUP_GUIDE.md`](docs/SETUP_GUIDE.md)                                         | Workstation setup, `.env` parameter dictionary, and dev workflows                |
| **Troubleshooting Runbook** | [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md)                                 | Diagnostic runbooks for containers, migrations, queues, and math engines         |
| **Master Data Dictionary**  | [`docs/DATA_DICTIONARY.md`](docs/DATA_DICTIONARY.md)                                 | Authoritative reference for all 14 models, data types, precision, and enums      |
| **System Architecture**     | [`docs/architecture/ARCHITECTURE.md`](docs/architecture/ARCHITECTURE.md)             | Complete C4 model, bounded contexts, queue topology, and security boundaries     |
| **REST API Contract**       | [`API_CONTRACT.md`](API_CONTRACT.md)                                                 | Full endpoint contracts, request/response envelopes, pagination, and error codes |
| **Database Specification**  | [`DATABASE.md`](DATABASE.md)                                                         | PostgreSQL relational ERD, indexing strategies, and migration policies           |
| **Cloud Deployment & IaC**  | [`docs/deployment/CLOUD_DEPLOYMENT.md`](docs/deployment/CLOUD_DEPLOYMENT.md)         | AWS ECS Fargate, RDS, ElastiCache, ALB, and CloudFront Terraform manual          |
| **Platform Observability**  | [`docs/operations/OBSERVABILITY.md`](docs/operations/OBSERVABILITY.md)               | Telemetry architecture, metrics dictionary, readiness probes, and Grafana guides |
| **Security Audit Report**   | [`docs/security/SECURITY_AUDIT.md`](docs/security/SECURITY_AUDIT.md)                 | OWASP Top 10 evaluation, AES-256-GCM implementation, and IDOR mitigation         |
| **Performance Benchmarks**  | [`docs/performance/BENCHMARK_RESULTS.md`](docs/performance/BENCHMARK_RESULTS.md)     | K6 load test certification (1,000 VUs, p95 2.03ms, zero failures)                |
| **Analytics Methodology**   | [`docs/analytics/ANALYTICS_METHODOLOGY.md`](docs/analytics/ANALYTICS_METHODOLOGY.md) | Mathematical specifications for TWR, Modified Dietz, and XIRR solvers            |
| **Risk Methodology**        | [`docs/analytics/RISK_METHODOLOGY.md`](docs/analytics/RISK_METHODOLOGY.md)           | Mathematical formulations for VaR, CVaR, Sharpe, Sortino, and Volatility         |

---

## 🤝 Contributing Guidelines

We welcome community contributions! Please adhere to the following workflow:

1. **Fork the Repository** & create a feature branch (`git checkout -b feat/institutional-rebalancing`).
2. **Ensure Code Quality**:
   - Format and lint: `pnpm lint` and `pnpm prettier --check .`
   - Run typechecking: `turbo run build`
3. **Execute Test Suites**:
   - Ensure all 740+ tests pass: `pnpm test:all`
4. **Follow Conventional Commits**:
   - Examples: `feat(api): add amfi daily nav ingestion worker`, `fix(quant): resolve matrix singularity in mpt solver`.
5. **Open a Pull Request**:
   - Provide a clear summary of changes, references to open issues, and testing screenshots.

---

## 📜 License & Acknowledgments

This project is licensed under the **MIT License**. See the [LICENSE](LICENSE) file for complete details.

### Acknowledgments & Ecosystem Partners:

- **Association of Mutual Funds in India (AMFI)** for transparent mutual fund scheme NAV data feeds.
- **National Stock Exchange (NSE)** & **Bombay Stock Exchange (BSE)** for equities and indices.
- **TimescaleDB** & **PostgreSQL** teams for high-performance financial time-series primitives.
- **FastAPI**, **NumPy**, & **SciPy** communities for quantitative scientific computing foundations.

---

<p align="center">
  <b>Wealth Compass</b> — Institutional Precision for Modern Portfolios.<br/>
  Built with ❤️ by the Wealth Compass Engineering Team.
</p>
