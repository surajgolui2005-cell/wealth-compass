# Product Discovery Document
## Investor Portfolio Monitoring & Risk Management System

---

| Metadata         | Value                                      |
|------------------|--------------------------------------------|
| **Document ID**  | PD-001                                     |
| **Version**      | 1.0.0                                      |
| **Phase**        | Phase 1 — Product Discovery                |
| **Status**       | Approved for Phase 2                       |
| **Author(s)**    | Product & Architecture Team                |
| **Created**      | 2026-08-12                                 |
| **Last Updated** | 2026-08-12                                 |

---

## Table of Contents

1. [Problem Statement & Solution Vision](#1-problem-statement--solution-vision)
2. [Market Context & Opportunity](#2-market-context--opportunity)
3. [User Personas](#3-user-personas)
4. [User Journey Map](#4-user-journey-map)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [Feature Scope Matrix — MVP vs V1.0 vs V2.0](#7-feature-scope-matrix--mvp-vs-v10-vs-v20)
8. [Data Model Overview](#8-data-model-overview)
9. [Integration Landscape](#9-integration-landscape)
10. [Risk & Assumptions Log](#10-risk--assumptions-log)
11. [Success Metrics & KPIs](#11-success-metrics--kpis)
12. [Glossary](#12-glossary)

---

## 1. Problem Statement & Solution Vision

### 1.1 The Problem

Modern investors — from retail to high-net-worth individuals (HNWIs) — routinely hold assets across a fragmented ecosystem of platforms: multiple brokerages, cryptocurrency exchanges, banks, real estate portals, and fixed-income instruments. This fragmentation creates three compounding pain points:

| Pain Point | Description | Impact |
|---|---|---|
| **Visibility Fragmentation** | No single view of total wealth across asset classes | Blind spots in net-worth calculation; delayed rebalancing decisions |
| **Risk Blindness** | Concentration risk, currency risk, and drawdown risk go unmeasured across silos | Catastrophic loss events not foreseen until too late |
| **Operational Inefficiency** | Manual aggregation via spreadsheets is error-prone and time-consuming | HNWIs spend 4-8 hours/week on manual reconciliation |
| **Latency of Insight** | Market-moving events require minutes/hours to assess portfolio impact | Missed exit windows, suboptimal rebalancing timing |
| **Tax & Compliance Gap** | Unrealised/realised gain tracking is scattered across providers | Tax surprises at year-end; incorrect cost-basis reporting |

### 1.2 Target Problem Scope

This system explicitly addresses the portfolio management and risk visibility gap for individuals holding assets across:

- **Equities** (Stocks, ETFs, Mutual Funds)
- **Fixed Income** (Bonds, Fixed Deposits)
- **Alternatives** (Crypto, Real Estate)
- **Liquidity** (Cash, Money Market)

### 1.3 Solution Vision

> *"A single, intelligence-augmented financial command centre that unifies every dollar, coin, property, and bond an investor owns — delivering real-time net worth, quantified risk exposure, and proactive alerts — so investors can make confident, data-driven decisions in seconds, not hours."*

### 1.4 Core Value Propositions

1. **Unified Wealth View** — Aggregate all assets in one dashboard regardless of custodian or asset class.
2. **Real-Time Risk Quantification** — Continuously compute VaR, Sharpe ratio, beta, drawdown, and concentration risk across the full portfolio.
3. **Proactive Intelligence** — Alert investors before thresholds are breached, not after.
4. **Institutional-Grade Analytics for Retail** — Bring hedge-fund-level quantitative tools to individual investors.
5. **Privacy-First Architecture** — Read-only API integrations; no brokerage credentials stored in plaintext.

---

## 2. Market Context & Opportunity

### 2.1 Market Size

| Segment | Global TAM (2026 est.) | CAGR |
|---|---|---|
| Wealth Management Software | $7.2B | 14.2% |
| Personal Finance Management (PFM) Apps | $1.8B | 12.8% |
| RegTech / Risk Analytics (Retail) | $3.1B | 18.4% |

### 2.2 Competitive Landscape

| Competitor | Strengths | Gaps We Address |
|---|---|---|
| **Mint / YNAB** | Strong budgeting, US-centric | No investment risk analytics, no crypto/real estate |
| **Personal Capital (Empower)** | Good net-worth view | Limited international assets, shallow risk metrics |
| **Sharesight** | Excellent equity tracking | No crypto, no real estate, no real-time risk |
| **CoinTracker** | Strong crypto | No equities, no real estate, no unified risk |
| **Kubera** | Multi-asset net worth | No quantitative risk, no alerting engine |

### 2.3 Differentiation

Our system is the only retail-facing platform that:
- Combines **all 8 asset classes** in a single risk-adjusted view
- Provides **sub-second quantitative analytics** (VaR, Sharpe, Beta, Max Drawdown)
- Delivers **configurable threshold-based alerting** across all asset types
- Is built with an **open integration architecture** for global brokerages and exchanges

---

## 3. User Personas

### Persona 1 — Alex: The High-Net-Worth Wealth Accumulator

```
Name   : Alex Chen
Age    : 42
Role   : CFO, Tech Company
City   : Mumbai, India
Net Worth: INR 8-15 Crore (~$1-2M USD)
Portfolio Mix: Equities 40% | Real Estate 30% | Bonds 15% | FDs 10% | Cash 5%
Platforms: Zerodha, HDFC Securities, CAMS, multiple FD banks
```

**Goals:**
- Understand true net worth in a single number updated daily
- Identify asset class concentration before it becomes a problem
- Track unrealised gains for tax-loss harvesting at year-end
- Benchmark portfolio return against Nifty 50 and global indices

**Frustrations:**
- Spends Sunday evenings reconciling spreadsheets across 6 portals
- Cannot see how an RBI rate hike impacts his bond + FD holdings simultaneously
- Real estate appreciation is estimated, not tracked with market comps
- No single view of portfolio-level risk

**Behaviours:**
- Logs in weekly for a portfolio review; needs weekly summary email
- Rebalances quarterly; wants rebalancing suggestions based on target allocation
- Has a CA who needs exportable tax reports

**Technical Comfort:** Medium — comfortable with apps, does not want complex setup

---

### Persona 2 — Maya: The Active Crypto & Equities Trader

```
Name   : Maya Nair
Age    : 29
Role   : Freelance Developer
City   : Bengaluru, India
Net Worth: INR 50L-2 Crore (~$60K-240K USD)
Portfolio Mix: Crypto 45% | Equities/ETFs 35% | Cash 15% | FDs 5%
Platforms: Binance, WazirX, Zerodha, ICICI Direct
```

**Goals:**
- Monitor live P&L across crypto exchanges and equity brokers in real time
- Get instant alerts when a coin/stock drops more than X% in a day
- Track cost basis and realised gains meticulously for crypto tax compliance
- Understand portfolio correlation — does her BTC position move with her FAANG stocks?

**Frustrations:**
- Crypto markets move 24/7; she wakes up to surprises without alert coverage
- Cost-basis tracking on crypto (wash sales, airdrops, staking rewards) is a nightmare
- Her equity portfolio risk tools are completely separate from crypto
- Cannot see the combined drawdown risk across her full portfolio

**Behaviours:**
- Logs in daily, often multiple times; uses mobile primarily
- Runs analytical queries — "What's my Sharpe ratio if I cut BTC exposure by 20%?"
- Highly engaged with notifications; wants granular alert configuration

**Technical Comfort:** High — developer background, comfortable with APIs and data

---

### Persona 3 — Raj: The Conservative Fixed-Income & Real Estate Investor

```
Name   : Raj Sharma
Age    : 58
Role   : Retired Government Officer
City   : Delhi, India
Net Worth: INR 3-6 Crore (~$360K-720K USD)
Portfolio Mix: Real Estate 50% | FDs 30% | Bonds/Govt Sec 15% | Mutual Funds 5%
Platforms: Post Office, SBI, LIC, local property
```

**Goals:**
- Track FD maturity dates and reinvestment opportunities proactively
- Understand the real return on FDs after factoring in inflation
- Monitor real estate market valuation changes in his localities
- Ensure portfolio generates sufficient income for retirement cash flow

**Frustrations:**
- Loses track of FD maturity dates spread across 4 banks
- No tool helps him compare post-tax FD returns vs. government bonds
- Cannot model the income stream from his portfolio for the next 10 years

**Behaviours:**
- Weekly logins; prefers desktop, simple UI
- Wants reminder notifications 30/60/90 days before FD maturities
- Needs printable/exportable summaries for family record-keeping

**Technical Comfort:** Low — needs guided onboarding and minimal friction

---

### Persona 4 — Priya: The Mutual Fund SIP Accumulator

```
Name   : Priya Iyer
Age    : 34
Role   : Marketing Manager
City   : Chennai, India
Net Worth: INR 20L-50L (~$24K-60K USD)
Portfolio Mix: Mutual Funds (SIPs) 60% | Stocks 20% | FD 10% | Cash 10%
Platforms: Groww, Kuvera, Zerodha Coin
```

**Goals:**
- See overall XIRR/CAGR across all SIPs in one place
- Understand if she is on track for her 10-year wealth target
- Get guided insights such as "Your large-cap allocation is 70%; consider diversifying"
- Track dividend and growth variants separately

**Frustrations:**
- Each mutual fund platform shows a different return calculation
- Cannot see how all her SIPs combine into a single sector/geography exposure
- Has no idea what her combined expense ratio is

**Technical Comfort:** Medium-low — accustomed to fintech apps, wants simplicity

---

## 4. User Journey Map

### 4.1 Journey Overview

```
Stage 1: Onboarding
    |
Stage 2: Provider Connection
    |
Stage 3: Portfolio View
    |
Stage 4: Risk Assessment
    |
Stage 5: Alert Configuration
    |
Stage 6: Ongoing Monitoring
```

---

### Stage 1: Onboarding

**Actor:** New User (any persona)

| Step | User Action | System Response | Success Criteria |
|---|---|---|---|
| 1.1 | Lands on marketing page, clicks "Get Started" | Renders registration form | Page loads < 1s |
| 1.2 | Enters name, email, phone; sets password | Sends email OTP verification | OTP delivered < 30s |
| 1.3 | Verifies OTP | Creates account; starts guided setup wizard | Account created |
| 1.4 | Selects investor profile (Conservative / Balanced / Aggressive) | Pre-fills risk tolerance parameters | Profile saved |
| 1.5 | Selects home currency (INR / USD / EUR / GBP) | All portfolio values normalized to chosen currency | Currency set |

**Pain Points Addressed:** Cold-start friction, multi-step forms
**Design Principle:** Less than 3 minutes to complete onboarding; progress saved at each step

---

### Stage 2: Provider Connection

**Actor:** Authenticated User

| Step | User Action | System Response | Success Criteria |
|---|---|---|---|
| 2.1 | Clicks "Connect Provider" | Displays supported brokers/exchanges/banks by category | Provider list loads < 500ms |
| 2.2 | Selects provider (e.g., Zerodha) | Redirects to OAuth / API key input flow | Secure redirect |
| 2.3 | Grants read-only permissions via OAuth | System fetches holdings, transactions, positions | Data sync < 30s |
| 2.4 | Manually adds unsupported asset (e.g., Real Estate, FD) | Guided manual entry form | Entry validated & saved |
| 2.5 | Reviews imported holdings for accuracy | Shows imported assets with edit capability | 100% of assets shown |
| 2.6 | Confirms import | Assets added to portfolio; initial valuation computed | Portfolio value shown |

**Pain Points Addressed:** Complex API setup, manual data entry burden
**Design Principle:** OAuth-first; API keys as fallback; manual entry always available

---

### Stage 3: Portfolio View

**Actor:** Authenticated User with connected providers

| Step | User Action | System Response | Success Criteria |
|---|---|---|---|
| 3.1 | Opens Dashboard | Renders unified net-worth ticker with asset breakdown | First paint < 500ms |
| 3.2 | Views asset allocation chart | Interactive donut/treemap by asset class, sector, geography | Chart renders < 200ms |
| 3.3 | Drills into an asset class (e.g., Crypto) | Shows individual holdings, live prices, P&L | Data fresh < 1 min old |
| 3.4 | Selects a specific holding (e.g., BTC) | Shows holding detail: cost basis, XIRR, % of portfolio | Detail loads < 300ms |
| 3.5 | Switches time range (1D / 1W / 1M / 1Y / All) | Portfolio value chart updates for selected range | Chart update < 200ms |
| 3.6 | Views benchmarking | Compares portfolio return vs. selected benchmarks (Nifty50, S&P 500, BTC) | Benchmark data current |

---

### Stage 4: Risk Assessment

**Actor:** Authenticated User (primarily Alex and Maya)

| Step | User Action | System Response | Success Criteria |
|---|---|---|---|
| 4.1 | Navigates to "Risk" tab | Displays overall Risk Score (0-100) with breakdown | Score computed < 1s |
| 4.2 | Reviews concentration risk | Heatmap of over-allocated positions relative to targets | Clear visual risk signal |
| 4.3 | Reviews Value-at-Risk (VaR) | Shows 1-day 95% VaR in currency and % terms | VaR freshness < 1 hour |
| 4.4 | Reviews volatility metrics | Sharpe Ratio, Beta vs. index, Max Drawdown, Sortino Ratio | Metrics current |
| 4.5 | Runs "What-If" scenario | User adjusts allocation sliders; system recomputes risk live | Recomputation < 500ms |
| 4.6 | Views correlation matrix | Shows pairwise asset correlation heatmap | Matrix renders clearly |

---

### Stage 5: Alert Configuration

**Actor:** Authenticated User

| Step | User Action | System Response | Success Criteria |
|---|---|---|---|
| 5.1 | Navigates to "Alerts" section | Lists existing alerts and "Create Alert" button | Page loads < 300ms |
| 5.2 | Creates price alert (e.g., BTC < $50,000) | Saves alert; begins monitoring | Alert active < 5s |
| 5.3 | Creates drawdown alert (e.g., Portfolio drops > 10%) | Saves portfolio-level alert | Alert active < 5s |
| 5.4 | Creates FD maturity alert (e.g., 30 days before maturity) | Saves maturity reminder | Reminder scheduled |
| 5.5 | Selects notification channels (email, push, SMS) | Saves preference per alert | Preference saved |
| 5.6 | Alert triggers | User receives notification within threshold breach | Latency < 60s from event |

---

### Stage 6: Ongoing Monitoring

**Actor:** Returning User

| Step | User Action | System Response | Success Criteria |
|---|---|---|---|
| 6.1 | Opens app / receives daily digest | Dashboard shows overnight changes, top movers | Digest delivered by 8am |
| 6.2 | Reviews monthly performance report | Auto-generated PDF/web report with P&L summary | Report generated |
| 6.3 | Exports data for CA/Tax filing | Downloads CSV/PDF of transactions, gains, dividends | Export < 10s |
| 6.4 | Views rebalancing suggestions | System suggests trades to restore target allocation | Suggestions displayed |

---

## 5. Functional Requirements

> **Notation:** `[MVP]` = Minimum Viable Product, `[V1]` = Version 1.0, `[V2]` = Version 2.0

---

### FR-1: User Authentication & Account Management `[MVP]`

**Description:** The system shall provide secure user registration, login, and account management.

**Acceptance Criteria:**
- AC-1.1: Users can register with email + password with email verification via OTP.
- AC-1.2: System supports MFA (TOTP-based authenticator app).
- AC-1.3: Password reset flow via verified email link (expires in 15 minutes).
- AC-1.4: Session tokens expire after 30 minutes of inactivity; refresh tokens valid for 7 days.
- AC-1.5: Users can manage profile settings: name, currency preference, timezone, notification preferences.
- AC-1.6: Account deletion permanently removes all PII within 30 days (GDPR/DPDP compliance).

---

### FR-2: Asset Provider Integration `[MVP]`

**Description:** The system shall integrate with external financial data providers via secure APIs.

**Acceptance Criteria:**
- AC-2.1: OAuth 2.0 flow for supported brokerages (Zerodha, Groww, ICICI Direct — MVP list).
- AC-2.2: Read-only API key integration for crypto exchanges (Binance, WazirX, Coinbase — MVP list).
- AC-2.3: Provider connection status displayed with last-sync timestamp.
- AC-2.4: Automatic background sync every 15 minutes for live-price providers.
- AC-2.5: End-of-day sync for providers with batch APIs.
- AC-2.6: Graceful error handling when provider APIs are unavailable; last known data is served with a staleness indicator.
- AC-2.7: Support for disconnect/re-connect provider without data loss.

---

### FR-3: Manual Asset Entry `[MVP]`

**Description:** The system shall allow users to manually add assets not covered by automated integrations.

**Supported Manual Asset Types:**

| Asset Class | Required Fields | Optional Fields |
|---|---|---|
| **Stock/ETF** (manual) | Ticker, Exchange, Quantity, Purchase Price, Purchase Date | Broker Name, Notes |
| **Mutual Fund** | ISIN / Fund Name, Units, NAV at purchase, Purchase Date | Folio Number, AMC Name |
| **Bond** | Issuer, Face Value, Coupon Rate, Maturity Date, Purchase Price | ISIN, Credit Rating |
| **Fixed Deposit** | Bank Name, Principal, Interest Rate, Start Date, Maturity Date, Compounding Frequency | Account Number (masked) |
| **Crypto** (manual) | Token Symbol, Quantity, Purchase Price (USD/INR), Purchase Date | Exchange Name, Wallet Address |
| **Real Estate** | Property Name, Location, Purchase Price, Purchase Date, Property Type | Current Estimated Value, Rental Income/Month |
| **Cash / Bank Account** | Bank Name, Account Type, Balance, Currency | Account Number (masked) |

**Acceptance Criteria:**
- AC-3.1: All manual entry forms include field-level validation.
- AC-3.2: Users can add, edit, and delete any manually entered asset.
- AC-3.3: Bulk CSV import supported for manual assets.
- AC-3.4: Real estate valuation can be updated manually; system timestamps each update.

---

### FR-4: Unified Portfolio Dashboard `[MVP]`

**Description:** The system shall present a consolidated, real-time view of the user's entire portfolio.

**Acceptance Criteria:**
- AC-4.1: Dashboard displays total portfolio value in user's home currency.
- AC-4.2: Asset allocation breakdown shown as interactive chart (donut, treemap) by: Asset Class, Sector, Geography, Currency.
- AC-4.3: Individual holdings list sortable by: Name, Value, Gain/Loss (currency), Gain/Loss (%), Weight.
- AC-4.4: Portfolio value historical chart with time ranges: 1D, 1W, 1M, 3M, 6M, 1Y, 3Y, All.
- AC-4.5: Top gainers / losers widget (1D and 1W).
- AC-4.6: All monetary values displayed in home currency with FX conversion shown.
- AC-4.7: Data freshness indicator (timestamp of last update per asset class).
- AC-4.8: Portfolio snapshot can be shared as a read-only link.

---

### FR-5: Multi-Asset Price Feed `[MVP]`

**Description:** The system shall source and maintain real-time and end-of-day price data for all supported asset types.

| Asset Class | Price Source | Update Frequency |
|---|---|---|
| Stocks (NSE/BSE) | NSE/BSE market feed, Yahoo Finance API | Real-time (market hours), EOD |
| ETFs | Same as stocks | Real-time (market hours), EOD |
| Mutual Funds | AMFI NAV feed | End of day (post 9 PM IST) |
| Bonds | CCIL / RBI Data | End of day |
| Crypto | CoinGecko / Binance API | Every 1 minute |
| Fixed Deposits | User-defined (accrual calculated) | Daily accrual |
| Real Estate | Manual update + Proptech API (V1) | Manual / API-driven |
| Cash | User-defined + FX rates | Daily |
| FX Rates | Open Exchange Rates / ECB | Every 30 minutes |

**Acceptance Criteria:**
- AC-5.1: Price fetch failures trigger automated retry with exponential backoff (max 3 retries).
- AC-5.2: Stale prices (> 24 hours old) flagged with a visual warning indicator.
- AC-5.3: FX rate applied at time of display for multi-currency portfolios.

---

### FR-6: Performance Analytics `[MVP]`

**Description:** The system shall compute and display portfolio and holding-level performance metrics.

**Metrics to Compute:**

| Metric | Scope | Formula Basis |
|---|---|---|
| **Absolute Return** | Holding, Asset Class, Total Portfolio | (Current Value - Cost Basis) / Cost Basis |
| **XIRR** | Holding, Portfolio | Time-weighted IRR across all cash flows |
| **CAGR** | Holding, Portfolio | Annualised compound growth rate |
| **Realised Gain/Loss** | Holding (sold) | Sale Price - Cost Basis (FIFO/LIFO/Average) |
| **Unrealised Gain/Loss** | Holding (held) | Current Value - Cost Basis |
| **Dividend Income** | Holding, Portfolio | Sum of dividend cash flows |
| **Expense Ratio (MF)** | Mutual Fund holdings | Weighted average TER |

**Acceptance Criteria:**
- AC-6.1: Users can select cost-basis methodology: FIFO, LIFO, or Average Cost.
- AC-6.2: All performance metrics recomputed on each portfolio data refresh.
- AC-6.3: Benchmark comparison: user selects up to 3 benchmarks for overlay (Nifty50, S&P 500, Nasdaq, BTC, Gold).

---

### FR-7: Risk Analytics Engine `[MVP]`

**Description:** The system shall quantify portfolio risk using standard financial risk metrics.

**Risk Metrics:**

| Metric | Description | Scope |
|---|---|---|
| **Value at Risk (VaR)** | 1-day, 95% confidence level, Historical Simulation method | Portfolio, Asset Class |
| **Conditional VaR (CVaR)** | Expected Shortfall beyond VaR threshold | Portfolio |
| **Portfolio Beta** | Sensitivity to benchmark index movement | Portfolio, Equity holdings |
| **Sharpe Ratio** | Risk-adjusted return (annualised) | Portfolio, Equity/Crypto |
| **Sortino Ratio** | Downside risk-adjusted return | Portfolio |
| **Max Drawdown** | Largest peak-to-trough decline in window | Portfolio, Holding |
| **Volatility** | Annualised standard deviation of returns | Portfolio, Asset Class |
| **Concentration Risk** | % weight of top 5 / top 10 holdings | Portfolio |
| **Correlation Matrix** | Pairwise Pearson correlation of holdings | Portfolio |

**Acceptance Criteria:**
- AC-7.1: All risk metrics recomputed on each full portfolio data sync.
- AC-7.2: VaR computation uses minimum 252 trading days of historical price data.
- AC-7.3: Risk Score (0-100) displayed prominently: Low (0-30), Medium (31-60), High (61-100).
- AC-7.4: Risk metrics displayed with plain-English explanation tooltips for non-expert users.
- AC-7.5: Risk computation triggered on-demand via "Refresh Risk" button.

---

### FR-8: Alert & Notification Engine `[MVP]`

**Description:** The system shall monitor portfolio conditions and notify users when configurable thresholds are breached.

**Alert Types:**

| Alert Type | Trigger Condition | Delivery |
|---|---|---|
| **Price Alert** | Asset price crosses user-defined threshold (above/below) | Push, Email, SMS |
| **Portfolio Drawdown Alert** | Portfolio value drops by X% from recent high | Push, Email |
| **Asset Allocation Drift Alert** | Asset class weight deviates > X% from target | Email, Push |
| **FD Maturity Alert** | X days before Fixed Deposit maturity date | Email, Push, SMS |
| **Risk Score Change Alert** | Portfolio Risk Score changes by > 10 points | Push, Email |
| **Sync Failure Alert** | Provider sync fails for > 2 consecutive attempts | Push, Email |
| **Bond Coupon Payment Alert** | X days before coupon payment date | Email |

**Acceptance Criteria:**
- AC-8.1: Users can configure unlimited alerts (subject to fair-use policy per plan).
- AC-8.2: Each alert has: name, condition, threshold, notification channels, active/paused toggle.
- AC-8.3: Alert delivery latency <= 60 seconds from threshold breach detection.
- AC-8.4: Alert history log retained for 12 months.
- AC-8.5: Duplicate alert suppression: same alert not re-fired within a configurable cooldown window (default: 1 hour).

---

### FR-9: Data Export & Reporting `[MVP]`

**Description:** The system shall provide comprehensive data export for tax, compliance, and personal record-keeping.

**Export Formats:**

| Report Type | Format | Scope |
|---|---|---|
| **Full Portfolio Snapshot** | CSV, PDF | All holdings at current date |
| **Transaction History** | CSV, PDF | Date range selectable |
| **Realised Gains Report** | CSV, PDF | By financial year (India: Apr-Mar) |
| **Dividend / Income Report** | CSV | By financial year |
| **FD Interest Accrual Report** | CSV, PDF | By financial year |

**Acceptance Criteria:**
- AC-9.1: All exports include export timestamp and data-as-of date.
- AC-9.2: CSV exports conform to standard formats importable into Excel and popular tax tools.
- AC-9.3: PDF reports include branding, page numbers, and table of contents.
- AC-9.4: Export generation completes within 10 seconds for portfolios up to 500 holdings.

---

### FR-10: Multi-Currency Support `[MVP]`

**Description:** The system shall support portfolios containing assets denominated in multiple currencies.

**Acceptance Criteria:**
- AC-10.1: User sets a home (base) currency at onboarding; changeable in settings.
- AC-10.2: All displayed monetary values converted to home currency using live FX rates.
- AC-10.3: Original asset currency and converted value displayed on hover/detail view.
- AC-10.4: Currency exposure breakdown available as a separate chart widget.
- AC-10.5: FX gain/loss tracked separately from asset price gain/loss.

---

### FR-11: Rebalancing Advisor `[V1.0]`

**Description:** The system shall suggest trades to restore a user-defined target asset allocation.

**Acceptance Criteria:**
- AC-11.1: Users define target allocation by Asset Class (e.g., Equity 50%, Bonds 20%, Crypto 10%, Cash 20%).
- AC-11.2: System computes current vs. target drift and displays visual gap analysis.
- AC-11.3: System generates actionable rebalancing suggestions (what to buy/sell by how much).
- AC-11.4: Rebalancing considers minimising transaction costs (suggests selling from overweight before buying underweight).
- AC-11.5: "What-If" rebalancing simulator lets users model outcomes before executing.

---

### FR-12: Tax Optimisation Insights `[V1.0]`

**Description:** The system shall surface tax-loss harvesting opportunities and capital gains summaries.

**Acceptance Criteria:**
- AC-12.1: Identify holdings with unrealised losses eligible for tax-loss harvesting.
- AC-12.2: Display estimated short-term vs. long-term capital gains tax liability (India: STCG/LTCG).
- AC-12.3: Alert user when holding approaches the LTCG holding threshold (India: 1 year for equities).
- AC-12.4: Wash sale rule warnings for Indian and international tax regimes.

---

### FR-13: Goal-Based Investment Tracking `[V1.0]`

**Description:** The system shall allow users to define financial goals and track portfolio progress toward them.

**Acceptance Criteria:**
- AC-13.1: Users create goals: name, target amount, target date, linked asset classes.
- AC-13.2: System projects goal achievement probability using Monte Carlo simulation.
- AC-13.3: Shortfall alerting: notify when projected trajectory misses goal by > 20%.
- AC-13.4: Support SIP contribution planning for mutual fund goals.

---

### FR-14: AI-Powered Portfolio Insights `[V2.0]`

**Description:** The system shall provide AI-generated, natural-language portfolio insights and recommendations.

**Acceptance Criteria:**
- AC-14.1: Daily AI-generated "Portfolio Health" summary in plain English.
- AC-14.2: Conversational query interface: "What is my BTC exposure as % of net worth?"
- AC-14.3: AI detects unusual patterns (e.g., "Your FD allocation has grown 40% while equities fell — consider rebalancing").
- AC-14.4: All AI outputs include confidence level and data source attribution.
- AC-14.5: AI recommendations are strictly informational; system explicitly disclaims investment advice.

---

### FR-15: Collaborative Portfolio Sharing `[V2.0]`

**Description:** The system shall allow users to share portfolio views with trusted advisors or family members.

**Acceptance Criteria:**
- AC-15.1: Users can generate read-only shareable links with expiry (1 day, 7 days, 30 days, permanent).
- AC-15.2: Shared views can mask specific holdings or asset classes.
- AC-15.3: Multi-user household mode: aggregate family portfolios with per-member breakdown.
- AC-15.4: Advisor role: granted read-only access with annotation capability; cannot make changes.

---

## 6. Non-Functional Requirements

### NFR-1: Performance & Latency

| Metric | Target | Measurement Method |
|---|---|---|
| Dashboard first meaningful paint | < 500ms (P95) | Lighthouse / Real User Monitoring |
| API response time (read) | < 200ms (P95) | APM (Datadog / New Relic) |
| Risk metric computation | < 1 second (P95) | Internal telemetry |
| Alert delivery from event detection | < 60 seconds | End-to-end latency trace |
| Export generation (up to 500 holdings) | < 10 seconds | Load test |
| Bulk data sync (initial import) | < 60 seconds per provider | Sync instrumentation |
| Database query latency | < 50ms (P99) | DB APM |

---

### NFR-2: Scalability

| Metric | Target |
|---|---|
| Concurrent active users (MVP launch) | 5,000 |
| Concurrent active users (V1.0) | 50,000 |
| Holdings per user | Up to 10,000 |
| API requests per second | 10,000 RPS (V1.0) |
| Price feed ingest rate | 1M price ticks/day |
| Horizontal auto-scaling trigger | CPU > 70% sustained for 2 minutes |

**Architecture Implication:** Stateless API services behind load balancer; read replicas for analytics queries; event-driven background workers for sync and risk computation.

---

### NFR-3: Availability & Reliability

| Metric | Target |
|---|---|
| System uptime (SLA) | 99.9% (max 8.7 hours downtime/year) |
| Planned maintenance window | Weekly, Sunday 2-4 AM IST |
| RTO (Recovery Time Objective) | < 4 hours |
| RPO (Recovery Point Objective) | < 1 hour |
| External provider dependency failure | Graceful degradation; last known data served |
| Data backup frequency | Hourly incremental, daily full |

---

### NFR-4: Security

| Requirement | Standard / Implementation |
|---|---|
| Data encryption at rest | AES-256 |
| Data encryption in transit | TLS 1.3 minimum |
| Password hashing | bcrypt with cost factor >= 12 |
| API key storage | Encrypted at rest using HSM-backed KMS |
| OAuth token storage | Encrypted refresh tokens; access tokens never persisted |
| Session management | HTTPOnly, Secure, SameSite=Strict cookies |
| Penetration testing | Annual third-party pentest; quarterly internal scan |
| OWASP Top 10 compliance | Mandatory; verified at each release |
| Secret management | HashiCorp Vault / AWS Secrets Manager |
| Read-only API principle | System never holds write permissions to any brokerage |

---

### NFR-5: Data Privacy & Compliance

| Requirement | Details |
|---|---|
| GDPR compliance | EU users: explicit consent, right to erasure, data portability |
| India DPDP Act 2023 | Data localisation for Indian users; consent framework |
| Data retention policy | Active user data: indefinite. Deleted account data: purged within 30 days |
| PII fields | Encrypted at field level in database |
| Audit logging | All data access events logged with user ID, timestamp, IP |
| Third-party data sharing | Zero sharing with ad networks; anonymised analytics only |

---

### NFR-6: Observability & Monitoring

| Component | Tool / Approach |
|---|---|
| Application Performance Monitoring | Datadog / New Relic |
| Error tracking | Sentry |
| Log aggregation | ELK Stack / Loki + Grafana |
| Infrastructure metrics | Prometheus + Grafana dashboards |
| Uptime monitoring | Pingdom / Better Uptime |
| Alert escalation | PagerDuty (P1 alerts), Slack (P2/P3) |
| Distributed tracing | OpenTelemetry |
| Business metrics dashboard | Internal ops dashboard updated every 5 min |

---

### NFR-7: Maintainability & Code Quality

| Requirement | Standard |
|---|---|
| Test coverage (unit) | >= 80% line coverage |
| Test coverage (integration) | Key flows covered: auth, sync, risk, alerts |
| Code review policy | 2 approvals required for main branch merge |
| Static analysis | ESLint / Pylint / SonarQube gate at CI |
| Dependency vulnerability scanning | Snyk / Dependabot weekly scan |
| API versioning | Semantic versioning; deprecated APIs supported for 6 months |
| Documentation | All public APIs documented in OpenAPI 3.1 spec |

---

### NFR-8: Accessibility

| Requirement | Standard |
|---|---|
| WCAG compliance level | WCAG 2.1 AA |
| Screen reader compatibility | ARIA labels on all interactive elements |
| Keyboard navigation | All features operable via keyboard |
| Colour contrast ratio | >= 4.5:1 for all text |
| Focus indicators | Visible focus ring on all focusable elements |

---

### NFR-9: Internationalisation (i18n)

| Requirement | MVP Scope |
|---|---|
| Languages supported | English (MVP); Hindi, Tamil, Kannada (V1.0) |
| Number formatting | Locale-aware (1,00,000 for IN; 100,000 for US) |
| Date formatting | Locale-aware (DD/MM/YYYY for IN; MM/DD/YYYY for US) |
| Currency display | Symbol + amount in home currency; ISO code for foreign currencies |
| RTL language support | Arabic, Hebrew (V2.0) |

---

### NFR-10: Mobile Responsiveness

| Requirement | Standard |
|---|---|
| Responsive breakpoints | Mobile (<= 480px), Tablet (481-1024px), Desktop (> 1024px) |
| Progressive Web App (PWA) | Offline capability for last-synced portfolio view |
| Native mobile apps | iOS and Android (V1.0) |
| Touch targets | >= 44px x 44px (Apple HIG standard) |
| Mobile performance | Lighthouse mobile score >= 85 |

---

## 7. Feature Scope Matrix — MVP vs V1.0 vs V2.0

> **Legend:** YES = Included | PARTIAL = Partial | NO = Not included

### 7.1 Authentication & User Management

| Feature | MVP | V1.0 | V2.0 |
|---|---|---|---|
| Email + Password registration | YES | YES | YES |
| Email OTP verification | YES | YES | YES |
| MFA (TOTP) | YES | YES | YES |
| Google / Apple OAuth login | NO | YES | YES |
| Biometric login (mobile) | NO | YES | YES |
| Multi-user household mode | NO | NO | YES |
| Advisor / sub-user roles | NO | NO | YES |

---

### 7.2 Asset Integration

| Feature | MVP | V1.0 | V2.0 |
|---|---|---|---|
| Zerodha OAuth integration | YES | YES | YES |
| Groww integration | YES | YES | YES |
| ICICI Direct integration | YES | YES | YES |
| CAMS / KFintech MF data | YES | YES | YES |
| Binance API (Crypto) | YES | YES | YES |
| WazirX API (Crypto) | YES | YES | YES |
| Coinbase API (Crypto) | NO | YES | YES |
| Interactive Brokers (Global) | NO | YES | YES |
| Fidelity / Schwab (US) | NO | NO | YES |
| Manual asset entry (all classes) | YES | YES | YES |
| CSV bulk import | YES | YES | YES |
| Real estate proptech API (Housing.com) | NO | YES | YES |
| Open Banking (Account Aggregator) | NO | YES | YES |
| Crypto wallet address tracking | NO | YES | YES |
| DeFi protocol tracking | NO | NO | YES |

---

### 7.3 Portfolio Dashboard

| Feature | MVP | V1.0 | V2.0 |
|---|---|---|---|
| Unified net-worth ticker | YES | YES | YES |
| Asset allocation pie / donut chart | YES | YES | YES |
| Asset allocation treemap | NO | YES | YES |
| Holdings table (sortable, filterable) | YES | YES | YES |
| Portfolio value history chart | YES | YES | YES |
| Sector allocation breakdown | PARTIAL | YES | YES |
| Geography allocation breakdown | NO | YES | YES |
| Currency exposure breakdown | PARTIAL | YES | YES |
| Benchmark comparison overlay | PARTIAL | YES | YES |
| Dark mode | NO | YES | YES |
| Customisable widget layout | NO | NO | YES |
| Shareable read-only portfolio link | NO | YES | YES |

---

### 7.4 Asset Class Coverage

| Asset Class | MVP | V1.0 | V2.0 |
|---|---|---|---|
| **Stocks (NSE/BSE)** | YES | YES | YES |
| **ETFs** | YES | YES | YES |
| **Mutual Funds** | YES | YES | YES |
| **Bonds / Govt Securities** | PARTIAL (Manual) | YES | YES |
| **Crypto (Top 100 coins)** | YES | YES | YES |
| **Cash / Bank Accounts** | YES | YES | YES |
| **Fixed Deposits** | YES | YES | YES |
| **Real Estate** | PARTIAL (Manual) | YES (API) | YES |
| **US Stocks / ADRs** | NO | YES | YES |
| **International MFs / ETFs** | NO | YES | YES |
| **Commodities (Gold, Silver)** | NO | YES | YES |
| **Options / Derivatives** | NO | NO | YES |
| **DeFi / Staking** | NO | NO | YES |
| **Private Equity / Unlisted** | NO | NO | YES |
| **NPS / EPF (Retirement)** | NO | YES | YES |

---

### 7.5 Performance Analytics

| Feature | MVP | V1.0 | V2.0 |
|---|---|---|---|
| Absolute Return | YES | YES | YES |
| XIRR / CAGR | YES | YES | YES |
| Realised Gain/Loss | YES | YES | YES |
| Unrealised Gain/Loss | YES | YES | YES |
| Dividend Income tracking | YES | YES | YES |
| Cost-basis methods (FIFO/LIFO/Avg) | YES | YES | YES |
| Mutual Fund expense ratio tracking | PARTIAL | YES | YES |
| FX gain/loss separation | NO | YES | YES |
| Attribution analysis (sector/geo) | NO | YES | YES |
| Factor-based performance attribution | NO | NO | YES |

---

### 7.6 Risk Analytics

| Feature | MVP | V1.0 | V2.0 |
|---|---|---|---|
| Risk Score (0-100) | YES | YES | YES |
| Value at Risk (VaR 95%) | YES | YES | YES |
| Conditional VaR (CVaR) | NO | YES | YES |
| Portfolio Beta | YES | YES | YES |
| Sharpe Ratio | YES | YES | YES |
| Sortino Ratio | NO | YES | YES |
| Maximum Drawdown | YES | YES | YES |
| Volatility | YES | YES | YES |
| Concentration Risk heatmap | YES | YES | YES |
| Correlation Matrix | NO | YES | YES |
| Stress Testing (2008/2020 scenarios) | NO | YES | YES |
| Monte Carlo Simulation | NO | YES | YES |
| What-If Scenario Builder | PARTIAL (Basic) | YES | YES |
| ESG Risk Score | NO | NO | YES |
| Liquidity Risk Score | NO | YES | YES |

---

### 7.7 Alerts & Notifications

| Feature | MVP | V1.0 | V2.0 |
|---|---|---|---|
| Price alerts (above/below) | YES | YES | YES |
| Portfolio drawdown alert | YES | YES | YES |
| FD maturity reminders | YES | YES | YES |
| Asset allocation drift alert | YES | YES | YES |
| Risk score change alert | YES | YES | YES |
| Provider sync failure alert | YES | YES | YES |
| Bond coupon date reminder | YES | YES | YES |
| Email notifications | YES | YES | YES |
| In-app push notifications | YES | YES | YES |
| SMS notifications | NO | YES | YES |
| WhatsApp notifications | NO | YES | YES |
| Telegram bot integration | NO | NO | YES |
| Smart alert deduplication | YES | YES | YES |
| Alert cooldown configuration | PARTIAL (Fixed 1hr) | YES (Configurable) | YES |

---

### 7.8 Tax & Compliance

| Feature | MVP | V1.0 | V2.0 |
|---|---|---|---|
| Transaction history export (CSV) | YES | YES | YES |
| Realised gains report (CSV/PDF) | YES | YES | YES |
| STCG / LTCG classification (India) | YES | YES | YES |
| Tax-loss harvesting alerts | NO | YES | YES |
| Capital gains tax liability estimate | NO | YES | YES |
| LTCG threshold date tracking | NO | YES | YES |
| Crypto P&L report (ITR format) | NO | YES | YES |
| US tax reporting (1099-B equivalent) | NO | NO | YES |
| Direct CA/Tax tool integration | NO | NO | YES |

---

### 7.9 Goals & Planning

| Feature | MVP | V1.0 | V2.0 |
|---|---|---|---|
| Goal creation (name, target, date) | NO | YES | YES |
| Goal progress tracking | NO | YES | YES |
| Monte Carlo goal projection | NO | YES | YES |
| SIP planner for goals | NO | YES | YES |
| Retirement income modelling | NO | NO | YES |
| Estate planning view | NO | NO | YES |

---

### 7.10 AI & Intelligence

| Feature | MVP | V1.0 | V2.0 |
|---|---|---|---|
| Automated rebalancing suggestions | NO | YES | YES |
| Daily AI portfolio health digest | NO | NO | YES |
| Natural language query (chatbot) | NO | NO | YES |
| Anomaly detection | NO | NO | YES |
| Personalised insights feed | NO | YES | YES |
| AI-generated risk narrative | NO | NO | YES |
| News sentiment + portfolio impact | NO | NO | YES |

---

### 7.11 Platform & Infrastructure

| Feature | MVP | V1.0 | V2.0 |
|---|---|---|---|
| Web application (responsive) | YES | YES | YES |
| Progressive Web App (PWA) | NO | YES | YES |
| Native iOS app | NO | YES | YES |
| Native Android app | NO | YES | YES |
| REST API (for integrations) | NO | YES | YES |
| Webhook support | NO | NO | YES |
| White-label / API licensing | NO | NO | YES |

---

## 8. Data Model Overview

> High-level logical data model for engineering reference — detailed ERD in Phase 2 Architecture document.

### Core Entities

```
User
 |-- UserProfile (preferences, currency, risk tolerance)
 |-- ProviderConnections (OAuth tokens, API keys — encrypted)
 |-- Alerts (user-configured thresholds)
 |-- Goals (V1.0)

Portfolio
 |-- Holdings (per asset, per user)
 |    |-- Transactions (buy/sell/dividend events)
 |    |-- PriceHistory (time-series snapshot)
 |-- RiskMetrics (computed, timestamped)
 |-- PerformanceMetrics (computed, timestamped)

AssetMaster
 |-- Equity (ticker, ISIN, exchange, sector, industry)
 |-- MutualFund (ISIN, AMC, category, sub-category, TER)
 |-- Bond (ISIN, issuer, maturity, coupon rate, credit rating)
 |-- CryptoToken (symbol, CoinGecko ID, network)
 |-- RealEstate (property ID, location, type)
 |-- FixedDeposit (user-defined; no master data needed)

PriceFeed
 |-- EquityPrice (ticker, exchange, price, volume, timestamp)
 |-- CryptoPrice (symbol, price_usd, price_inr, timestamp)
 |-- MFNav (ISIN, nav, nav_date)
 |-- FXRate (base_currency, quote_currency, rate, timestamp)
 |-- BondPrice (ISIN, yield, clean_price, timestamp)

Alert
 |-- AlertDefinition (type, condition, threshold, channels)
 |-- AlertHistory (triggered_at, delivered_at, status)
```

---

## 9. Integration Landscape

### 9.1 Brokerage Integrations (MVP)

| Provider | Integration Method | Data Available | Authentication |
|---|---|---|---|
| Zerodha (India) | Kite Connect API | Holdings, Positions, Orders, P&L | OAuth 2.0 |
| Groww (India) | Partner API | MF holdings, Equity holdings | OAuth 2.0 |
| ICICI Direct (India) | Breeze API | Holdings, Transactions | API Key |
| CAMS (India) | CAMS Online API | MF Holdings, Transactions | OAuth |
| KFintech (India) | KFintech API | MF Holdings, NAVs | OAuth |

### 9.2 Crypto Exchange Integrations (MVP)

| Exchange | Integration Method | Data Available | Authentication |
|---|---|---|---|
| Binance | REST API v3 | Spot balance, Trade history, P&L | Read-only API Key + Secret |
| WazirX | REST API | Spot balance, Trade history | Read-only API Key |

### 9.3 Market Data Sources

| Data Type | Provider (Primary) | Provider (Fallback) |
|---|---|---|
| NSE/BSE Equity Prices | NSE data feed / Yahoo Finance | Alpha Vantage |
| Mutual Fund NAV | AMFI NAV data (free) | CAMS API |
| Crypto Prices | CoinGecko API | Binance WebSocket |
| Forex Rates | Open Exchange Rates | ECB Statistical Data Warehouse |
| Bond Yields | CCIL India | RBI DBIE API |
| US Equity Prices | Yahoo Finance API | Alpha Vantage |

---

## 10. Risk & Assumptions Log

### 10.1 Technical Risks

| Risk ID | Risk Description | Probability | Impact | Mitigation |
|---|---|---|---|---|
| TR-1 | Brokerage API rate limits during sync | High | Medium | Request queuing, exponential backoff, API response caching |
| TR-2 | Crypto exchange API downtime (24/7 nature) | Medium | High | Multi-source price feeds; graceful degradation with stale data |
| TR-3 | Real-time price latency exceeds 200ms SLA | Medium | Medium | Edge caching, CDN, WebSocket price feeds |
| TR-4 | VaR computation too slow for large portfolios (> 1000 holdings) | Low | High | Pre-compute nightly; incremental update on sync |
| TR-5 | OAuth token expiry causing silent sync failures | High | Medium | Token refresh monitoring; proactive re-auth prompts |

### 10.2 Business Risks

| Risk ID | Risk Description | Probability | Impact | Mitigation |
|---|---|---|---|---|
| BR-1 | Regulatory classification as investment advisor (SEBI) | Medium | Very High | Explicit "informational only" disclaimer; no buy/sell recommendations in MVP |
| BR-2 | User trust erosion from data breach | Low | Critical | AES-256, read-only API access, annual penetration testing |
| BR-3 | Low provider adoption of OAuth partnerships | Medium | High | Manual entry as always-available fallback; prioritise most-used providers |
| BR-4 | Real estate valuation data quality and coverage | High | Medium | Manual user-updated valuations in MVP; proptech API in V1.0 |

### 10.3 Key Assumptions

| ID | Assumption | Validation Step |
|---|---|---|
| A-1 | Zerodha Kite Connect provides sufficient read-only data for MVP needs | Confirmed via API docs review in Phase 2 |
| A-2 | AMFI NAV data is freely accessible with no licensing cost | Confirmed — AMFI NAV is publicly available |
| A-3 | Target users are comfortable granting read-only broker API access | Validate via user research in Phase 2 |
| A-4 | India DPDP Act does not prohibit storing encrypted broker credentials | Require legal review in Phase 2 |
| A-5 | CoinGecko free tier sufficient for MVP price data volume | Validate volume assumptions; paid tier budget for V1.0 |

---

## 11. Success Metrics & KPIs

### 11.1 Product Metrics

| Metric | MVP Target (3 months post-launch) | V1.0 Target (12 months) |
|---|---|---|
| Monthly Active Users (MAU) | 1,000 | 20,000 |
| Registered Users | 2,500 | 50,000 |
| Provider Connections (avg per user) | 2.1 | 3.5 |
| Day-7 Retention | >= 40% | >= 55% |
| Day-30 Retention | >= 20% | >= 35% |
| Alerts configured per active user | >= 3 | >= 5 |
| Portfolio sync success rate | >= 95% | >= 98% |
| NPS (Net Promoter Score) | >= 40 | >= 55 |

### 11.2 Technical Metrics

| Metric | Target | Measurement |
|---|---|---|
| API P95 latency | < 200ms | APM |
| Dashboard load time (P95) | < 500ms | RUM |
| Risk computation time (P95) | < 1 second | Internal telemetry |
| System uptime | >= 99.9% | Uptime monitoring |
| Alert delivery rate (on-time) | >= 99% | Alert pipeline telemetry |
| Data sync failure rate | < 2% | Sync pipeline metrics |

### 11.3 Business Metrics

| Metric | MVP Target | V1.0 Target |
|---|---|---|
| Free-to-paid conversion rate | 8% | 15% |
| Monthly Recurring Revenue (MRR) | INR 5L | INR 50L |
| Customer Acquisition Cost (CAC) | < INR 800 | < INR 500 |
| Customer Lifetime Value (CLV) | > INR 5,000 | > INR 12,000 |
| Churn rate (monthly) | < 5% | < 3% |
| Support ticket rate | < 5% of MAU | < 2% of MAU |

### 11.4 Risk & Safety Metrics

| Metric | Target |
|---|---|
| Security incidents (P0) | 0 per year |
| Data breach events | 0 per year |
| False positive alert rate | < 0.5% |
| Regulatory complaints | 0 per quarter |

---

## 12. Glossary

| Term | Definition |
|---|---|
| **VaR** | Value at Risk — the maximum loss expected over a given time horizon at a specified confidence level |
| **CVaR** | Conditional Value at Risk (Expected Shortfall) — the expected loss given that VaR has been exceeded |
| **Sharpe Ratio** | (Portfolio Return minus Risk-Free Rate) / Portfolio Std Dev; measures risk-adjusted return |
| **Sortino Ratio** | Sharpe variant that penalises only downside volatility |
| **Beta** | Measure of portfolio sensitivity to market index movements |
| **Max Drawdown** | Largest percentage drop from a historical peak to trough |
| **XIRR** | Extended Internal Rate of Return — IRR calculation for irregular cash flows |
| **CAGR** | Compound Annual Growth Rate |
| **FIFO** | First-In, First-Out — cost basis accounting method |
| **LTCG** | Long-Term Capital Gains (India: equity held > 1 year) |
| **STCG** | Short-Term Capital Gains (India: equity held <= 1 year) |
| **NAV** | Net Asset Value — per-unit value of a mutual fund |
| **TER** | Total Expense Ratio — annual fund management cost as % of AUM |
| **AUM** | Assets Under Management |
| **HNW** | High-Net-Worth individual (> INR 5 Crore liquid net worth) |
| **AMFI** | Association of Mutual Funds in India |
| **OAuth 2.0** | Industry-standard protocol for secure delegated access |
| **MFA** | Multi-Factor Authentication |
| **AES-256** | Advanced Encryption Standard with 256-bit key — industry standard encryption |
| **RTO** | Recovery Time Objective — maximum acceptable downtime duration |
| **RPO** | Recovery Point Objective — maximum acceptable data loss window |
| **DPDP** | Digital Personal Data Protection Act, 2023 (India) |
| **SEBI** | Securities and Exchange Board of India |
| **PWA** | Progressive Web App — web app with native app capabilities |
| **APM** | Application Performance Monitoring |
| **RUM** | Real User Monitoring |
| **SLA** | Service Level Agreement |
| **EOD** | End of Day |

---

*End of Product Discovery Document — PD-001 v1.0.0*

*Next Phase: Phase 2 — System Architecture and Technical Design*
