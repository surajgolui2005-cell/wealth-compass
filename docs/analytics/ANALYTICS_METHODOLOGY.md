# Analytics Methodology

**Document ID:** AM-001  
**Version:** 1.0.0  
**Service:** `apps/quant-engine` — Python FastAPI Microservice  
**Last Updated:** 2026-08-15  
**Status:** Active

---

## Table of Contents

1. [Overview & Design Principles](#1-overview--design-principles)
2. [Time-Weighted Return (TWR)](#2-time-weighted-return-twr)
3. [Extended Internal Rate of Return (XIRR)](#3-extended-internal-rate-of-return-xirr)
4. [Benchmark Comparison Metrics](#4-benchmark-comparison-metrics)
5. [Numerical Precision & Floating-Point Policy](#5-numerical-precision--floating-point-policy)
6. [Edge Cases & Failure Modes](#6-edge-cases--failure-modes)
7. [References & Standards](#7-references--standards)

---

## 1. Overview & Design Principles

The `quant-engine` is a dedicated Python 3.13 FastAPI microservice (ADR-0003) that
provides institutional-grade performance and risk analytics computations for the
Investor Portfolio Monitoring & Risk Management System (IPMS).

### Design Principles

| Principle                    | Implementation                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------- |
| **Mathematical correctness** | All formulas sourced from CFA Institute GIPS 2020 and peer-reviewed literature               |
| **No custom reinvention**    | SciPy and NumPy provide battle-tested numerical solvers; we wrap, not replace them           |
| **Performance isolation**    | CPU-bound matrix operations execute in the Python process, keeping the NestJS API responsive |
| **Fail-safe fallback**       | XIRR convergence failure -> TWR display; insufficient data -> annotated partial result       |
| **No state mutation**        | All analytics functions are pure — they read data from DB/cache and return results           |

### Service Architecture

```
NestJS API Gateway
       |  Internal REST (RS256 JWT)
       v
 quant-engine (FastAPI)
   +-- src/analytics/twr.py       <- Time-Weighted Return
   +-- src/analytics/xirr.py      <- Extended IRR (Newton-Raphson + Brent)
   +-- src/analytics/benchmark.py <- Beta, Alpha, Sharpe, Sortino, TE
       |  asyncpg read-only pool
       v
  TimescaleDB Replica (MarketPrice time-series)
```

---

## 2. Time-Weighted Return (TWR)

**Source File:** `apps/quant-engine/src/analytics/twr.py`  
**Standard:** GIPS 2020 §2.A.2 (Modified Dietz method)

### 2.1 Purpose

TWR measures the compound growth rate of a portfolio **independent of the timing and
magnitude of external cash flows** (deposits and withdrawals). It is the correct
metric when comparing a portfolio manager's performance to a benchmark, because it
eliminates the distortion caused by investor-controlled cash movements.

> **Key Property:** If a large deposit is made just before a market rally, TWR does
> not artificially inflate the return. Money-Weighted Return (MWR/XIRR) would inflate
> it; TWR would not.

### 2.2 Sub-Period Boundary Rule

A new sub-period **must** begin on every day that has an external cash flow:

```
Timeline:
---------+------------------+------------------------------+-----> t
      Jan 1             Apr 15                          Dec 31
      (start)       (deposit 50,000)                    (end)

Sub-period 1: Jan 1 -> Apr 14   (BMV1 = initial, EMV1 = value just before deposit)
Sub-period 2: Apr 15 -> Dec 31  (BMV2 = value after deposit, EMV2 = final value)
```

### 2.3 Modified Dietz Sub-Period Return

For each sub-period i:

    R_i = (EMV_i - BMV_i - CF_i) / (BMV_i + SUM[CF_j * W_j])

Where:

| Symbol  | Meaning                                                    |
| ------- | ---------------------------------------------------------- |
| `BMV_i` | Beginning Market Value of sub-period i                     |
| `EMV_i` | Ending Market Value of sub-period i                        |
| `CF_i`  | Net external cash flows during sub-period i                |
| `CF_j`  | Individual cash flow j within period i                     |
| `W_j`   | Time-weight of cash flow j = `(D_i - d_j) / D_i`           |
| `D_i`   | Total calendar days in sub-period i                        |
| `d_j`   | Calendar days from start of sub-period to cash flow date j |

**Weight interpretation:** A cash flow arriving at the start has weight ~1.0 (works
for the full period). A cash flow at the end has weight ~0.0 (no time to compound).

### 2.4 Chain-Linking

    TWR_cumulative = PRODUCT[(1 + R_i) for i in 1..n] - 1

### 2.5 Annualisation

    TWR_annualised = (1 + TWR_cumulative) ^ (365.25 / D_total) - 1

`365.25` is the Gregorian average year (handles leap years correctly).

### 2.6 TWR vs MWR — When to Use Each

| Metric         | Use When                                                   |
| -------------- | ---------------------------------------------------------- |
| **TWR**        | Evaluating manager skill independent of cash flow timing   |
| **XIRR (MWR)** | Measuring the investor's actual personal annualised return |

---

## 3. Extended Internal Rate of Return (XIRR)

**Source File:** `apps/quant-engine/src/analytics/xirr.py`  
**Standard:** GIPS 2020 §2.A.6; Excel XIRR specification

### 3.1 Purpose

XIRR computes the annualised IRR for **non-periodic** cash flows on irregular dates.
It answers: _"What single annual rate makes the NPV of all my cash flows equal zero?"_

### 3.2 Cash Flow Sign Convention

| Transaction Type               | Sign                                           |
| ------------------------------ | ---------------------------------------------- |
| BUY, DEPOSIT                   | **Negative** (money leaves the investor)       |
| SELL, DIVIDEND, WITHDRAWAL     | **Positive** (money enters the investor)       |
| Current Portfolio Market Value | **Positive** (final cash flow on today's date) |

### 3.3 NPV Equation

XIRR finds rate `r` satisfying:

    NPV(r) = SUM[ CF_i / (1 + r)^(t_i) ] = 0

Where:

    t_i = (d_i - d_0).days / 365.25

### 3.4 Primary Solver: Newton-Raphson

    r_{n+1} = r_n - NPV(r_n) / NPV'(r_n)

First derivative:

    NPV'(r) = -SUM[ CF_i * t_i / (1 + r)^(t_i + 1) ]

**Parameters:**

- Initial guess: `r_0 = 0.10` (10%)
- Convergence criterion: `|NPV(r)| < 1e-9`
- Maximum iterations: **1,000** (per PRD US-RISK-01 Scenario 4)

Newton-Raphson converges **quadratically** near the root (~5–20 iterations for
well-behaved cash flows with a single sign change).

### 3.5 Fallback Solver: Brent–Dekker Method

When Newton-Raphson diverges or hits max iterations, we fall back to
`scipy.optimize.brentq` with bracket `[−0.9999, 100.0]`.

Brent's method is **guaranteed to converge** if a sign change in NPV exists in the bracket:

- Lower bound −0.9999: near-total loss floor
- Upper bound 100.0: +10,000% covers all realistic returns

### 3.6 Convergence Failure Handling

If both solvers fail, `XirrConvergenceError` is raised. The NestJS API:

1. Falls back to displaying TWR
2. Logs the event for analytics review
3. Displays: _"XIRR could not be calculated — showing TWR: X.X%"_

This satisfies PRD US-RISK-01 Scenario 4.

---

## 4. Benchmark Comparison Metrics

**Source File:** `apps/quant-engine/src/analytics/benchmark.py`  
**Standard:** CFA Institute; Grinold & Kahn (2000)

All metrics are computed from **daily return series** aligned on the same dates.

### 4.1 Daily Returns

    r_t = (P_t - P_{t-1}) / P_{t-1}

### 4.2 Portfolio Beta (β)

    β = Cov(r_p, r_b) / Var(r_b)

- β > 1: amplifies benchmark moves
- β < 1: attenuates benchmark moves
- β < 0: moves inversely to benchmark

### 4.3 Jensen's Alpha (α)

    α_daily = E[r_p] - [r_f + β × (E[r_b] - r_f)]

Annualised via compounding:

    α_annualised = (1 + α_daily)^252 - 1

Daily risk-free rate:

    r_f_daily = (1 + R_f_annual)^(1/252) - 1

**Default risk-free rate:** 6.5% p.a. (2026 Indian 10Y G-Sec yield).

### 4.4 Tracking Error (TE)

    TE_daily = std(r_p - r_b)  [sample std, ddof=1]
    TE_annualised = TE_daily × sqrt(252)

### 4.5 Information Ratio (IR)

    IR = (E[r_p - r_b] × 252) / TE_annualised

IR > 0.5 = consistent outperformance. Returns `None` when TE = 0.

### 4.6 Sharpe Ratio

    Sharpe = (E[r_p] - r_f_daily) / std(r_p) × sqrt(252)

### 4.7 Sortino Ratio

    Sortino = (E[r_p] - r_f_daily) / σ_downside × sqrt(252)

Where `σ_downside = std(r_p | r_p < r_f_daily)` (downside deviation only).

### 4.8 Pearson Correlation (ρ)

    ρ = Cov(r_p, r_b) / (σ_p × σ_b)    [clamped to [-1, 1]]

### 4.9 Annualisation Convention

All daily metrics annualised with **252 trading days**. Crypto uses the same factor
for cross-asset consistency (noted limitation: crypto trades 365 days).

---

## 5. Numerical Precision & Floating-Point Policy

| Layer                      | Precision                | Rationale                                       |
| -------------------------- | ------------------------ | ----------------------------------------------- |
| **XIRR solver**            | IEEE 754 double (64-bit) | Sufficient for root-finding convergence to 1e-9 |
| **TWR**                    | IEEE 754 double          | 10,000 sub-period chain: rounding error < 1e-12 |
| **NumPy operations**       | `float64` (default)      | Vectorised C routines, full double precision    |
| **NestJS ValuationEngine** | `Decimal.js` (28-digit)  | Monetary amounts, cost basis, P&L               |

**Why not Decimal in Python?**  
Return ratios (XIRR, Sharpe) are inherently approximate. IEEE 754 double (15–17
significant digits) is more than sufficient. Monetary precision is handled in NestJS
via `Decimal.js`.

---

## 6. Edge Cases & Failure Modes

| Scenario                 | Module         | Behaviour                             |
| ------------------------ | -------------- | ------------------------------------- |
| Single cash flow         | `xirr.py`      | `ValueError`                          |
| All cash flows same sign | `xirr.py`      | `ValueError`                          |
| XIRR non-convergence     | `xirr.py`      | `XirrConvergenceError` → TWR fallback |
| Empty TWR sub-periods    | `twr.py`       | `ValueError`                          |
| Out-of-order sub-periods | `twr.py`       | `ValueError`                          |
| Zero BMV (no capital)    | `twr.py`       | Modified Dietz returns 0.0            |
| Mismatched series length | `benchmark.py` | `ValueError`                          |
| <3 price observations    | `benchmark.py` | `ValueError`                          |
| Zero benchmark variance  | `benchmark.py` | β = `nan`                             |
| No downside observations | `benchmark.py` | Sortino = `nan`                       |
| Negative prices          | `benchmark.py` | `ValueError`                          |
| Portfolio = benchmark    | `benchmark.py` | β=1, α=0, ρ=1, TE=0, IR=None          |

---

## 7. References & Standards

| Reference                                                           | Relevance                         |
| ------------------------------------------------------------------- | --------------------------------- |
| CFA Institute, _GIPS 2020_                                          | TWR §2.A.2; IRR §2.A.6            |
| Bacon, C., _Practical Risk-Adjusted Performance Measurement_ (2012) | Sharpe, Sortino, IR               |
| Grinold & Kahn, _Active Portfolio Management_ (2000)                | Alpha, IR, Tracking Error         |
| Jensen, M. (1968), _Performance of Mutual Funds_                    | Jensen's Alpha derivation         |
| Sharpe, W. (1994), _The Sharpe Ratio_                               | Sharpe Ratio definition           |
| Sortino & van der Meer (1991), _Downside Risk_                      | Sortino Ratio                     |
| Brent, R.P. (1973), _Algorithms for Minimization_                   | Brent-Dekker fallback solver      |
| Microsoft Excel XIRR specification                                  | Sign convention, 365.25 day-count |
| SEBI Circular, Mutual Fund NAV (2018)                               | WAC basis for MF units            |

---

_AM-001 — v1.0.0 — Investor Portfolio Monitoring & Risk Management System_
