# Risk Methodology Specification

**Wealth Compass — Quant Engine**
**Version:** 1.0.0
**Status:** Approved for Production
**Date:** 2026-08-25

---

## Overview

This document provides the formal mathematical specifications, financial conventions, input requirements, and known limitations for each quantitative risk measure implemented in the Wealth Compass Quant Engine risk sub-package (`src/analytics/risk/`).

All modules are implemented in pure Python (stdlib only, no numpy/scipy) to guarantee deterministic, portable, dependency-free computation.

---

## 1. Annualised Volatility

**Module:** `src/analytics/risk/volatility.py`

### 1.1 Definition

Volatility measures the dispersion of an asset's periodic returns around their mean. It quantifies the degree of uncertainty in a portfolio's future return.

### 1.2 Formula

Given $N$ daily returns $\{r_1, r_2, \ldots, r_N\}$:

$$\bar{r} = \frac{1}{N}\sum_{i=1}^{N} r_i$$

$$\sigma_d^2 = \frac{\sum_{i=1}^{N}(r_i - \bar{r})^2}{N - 1} \quad \text{(Bessel corrected)}$$

$$\sigma_d = \sqrt{\sigma_d^2}$$

$$\sigma_a = \sigma_d \times \sqrt{252} \quad \text{(annualised)}$$

### 1.3 Parameters

| Parameter       | Type        | Default | Description                              |
| --------------- | ----------- | ------- | ---------------------------------------- |
| `asset_id`      | str         | —       | Asset/portfolio identifier               |
| `daily_returns` | list[float] | —       | Simple daily returns. Min 2 observations |

### 1.4 Convention

- **Annualisation factor:** $T = 252$ trading days per year (global equity market standard).
- **Denominator:** $N - 1$ (Bessel's correction for unbiased sample variance estimator).
- **Return type:** Simple periodic returns $r_t = P_t/P_{t-1} - 1$ are preferred. Log-returns $\ln(P_t/P_{t-1})$ are mathematically equivalent for short holding periods.

### 1.5 Interpretation

| Annualised Volatility | Interpretation                                        |
| --------------------- | ----------------------------------------------------- |
| < 10%                 | Low risk (Government bonds, liquid funds)             |
| 10–20%                | Moderate risk (Large-cap equities)                    |
| 20–40%                | High risk (Small-cap, mid-cap equities)               |
| > 40%                 | Very high risk (Crypto, highly leveraged instruments) |

### 1.6 Limitations

- Assumes i.i.d. (independently and identically distributed) returns. Auto-correlated returns (momentum / mean reversion) cause the $\sqrt{T}$ scaling to be an approximation.
- Does not distinguish upside from downside volatility. Use the Sortino Ratio for asymmetric risk measurement.

---

## 2. Beta (Systematic Risk)

**Module:** `src/analytics/risk/beta.py`

### 2.1 Definition

Beta ($\beta$) measures the sensitivity of a portfolio's returns to movements in the benchmark. It decomposes total risk into **systematic** (market) risk and **idiosyncratic** (specific) risk.

### 2.2 Formula

Given $N$ aligned daily returns for the portfolio $r_p$ and benchmark $r_b$:

$$\text{Cov}(r_p, r_b) = \frac{\sum_{i=1}^{N}(r_{p,i} - \bar{r}_p)(r_{b,i} - \bar{r}_b)}{N - 1}$$

$$\text{Var}(r_b) = \frac{\sum_{i=1}^{N}(r_{b,i} - \bar{r}_b)^2}{N - 1}$$

$$\beta = \frac{\text{Cov}(r_p, r_b)}{\text{Var}(r_b)}$$

### 2.3 Parameters

| Parameter           | Type        | Description                              |
| ------------------- | ----------- | ---------------------------------------- |
| `asset_id`          | str         | Portfolio or security identifier         |
| `benchmark_id`      | str         | Benchmark identifier (e.g. `"NIFTY_50"`) |
| `asset_returns`     | list[float] | Daily portfolio returns (aligned)        |
| `benchmark_returns` | list[float] | Daily benchmark returns (same length)    |

### 2.4 Interpretation

| Beta            | Interpretation                                             |
| --------------- | ---------------------------------------------------------- |
| $\beta < 0$     | Inverse relationship with the benchmark (hedge, arbitrage) |
| $\beta = 0$     | No systematic exposure; return is market-neutral           |
| $0 < \beta < 1$ | Less volatile than the benchmark (defensive portfolio)     |
| $\beta = 1$     | Exactly mirrors benchmark risk                             |
| $\beta > 1$     | More volatile than the benchmark (aggressive portfolio)    |

### 2.5 Limitations

- Beta is **backward-looking** and computed from historical observations. A portfolio's beta can change significantly during regime shifts (market crashes, sector rotations).
- Requires returns to be **aligned on the same dates**. Holidays, circuit breakers, and exchange-specific closures must be handled before passing returns to this module.
- Beta is unstable for portfolios with few holdings or highly concentrated positions.

---

## 3. Sharpe Ratio

**Module:** `src/analytics/risk/sharpe.py`

### 3.1 Definition

The Sharpe Ratio measures risk-adjusted return by expressing the excess return above the risk-free rate per unit of total volatility. It rewards portfolios that generate returns above the risk-free rate without taking excessive risk.

### 3.2 Formula

Given $N$ daily returns and annualised risk-free rate $r_f$:

$$r_{f,d} = \frac{r_f}{252} \quad \text{(daily risk-free rate)}$$

$$e_i = r_i - r_{f,d} \quad \text{(excess daily return)}$$

$$\bar{e} = \frac{1}{N}\sum_{i=1}^{N} e_i$$

$$E_a = \bar{e} \times 252 \quad \text{(annualised excess return)}$$

$$\sigma_a = \sigma_d \times \sqrt{252} \quad \text{(annualised volatility)}$$

$$S = \frac{E_a}{\sigma_a} = \frac{\bar{e} \times \sqrt{252}}{\sigma_d}$$

### 3.3 Parameters

| Parameter               | Type        | Default | Description                                       |
| ----------------------- | ----------- | ------- | ------------------------------------------------- |
| `asset_id`              | str         | —       | Portfolio identifier                              |
| `daily_returns`         | list[float] | —       | Daily returns. Min 2 observations                 |
| `risk_free_rate_annual` | float       | `0.04`  | Annualised risk-free rate (decimal). Default 4.0% |

### 3.4 Risk-Free Rate Convention

For Indian rupee-denominated portfolios, the risk-free rate should be calibrated to:

- **RBI Repo Rate** (prevailing monetary policy rate)
- **91-Day T-Bill yield** (shortest-duration Government of India security)
- Default value of **4.0%** represents a conservative baseline for India.

### 3.5 Interpretation

| Sharpe Ratio   | Interpretation                                               |
| -------------- | ------------------------------------------------------------ |
| $S < 0$        | Portfolio underperforms the risk-free rate                   |
| $0 \leq S < 1$ | Marginal risk-adjusted performance                           |
| $S \geq 1$     | Acceptable (earns more than its volatility in excess return) |
| $S \geq 2$     | Very good                                                    |
| $S \geq 3$     | Excellent (rarely sustained over multi-year periods)         |

### 3.6 Limitations

- Assumes **normally distributed** returns. Heavy tails (leptokurtosis) cause the Sharpe Ratio to overstate risk-adjusted performance.
- Penalises **upside volatility equally** with downside volatility — use Sortino Ratio to address this asymmetry.
- Sensitive to the **measurement frequency** (daily vs weekly vs monthly). This implementation uses daily returns consistently.

---

## 4. Sortino Ratio

**Module:** `src/analytics/risk/sortino.py`

### 4.1 Definition

The Sortino Ratio refines the Sharpe Ratio by penalising only **downside volatility** (returns below the Minimum Acceptable Return / MAR). Upside volatility is not penalised.

### 4.2 Formula

Given $N$ daily returns and annualised MAR $\tau$ (default 4.0%):

$$\tau_d = \frac{\tau}{252} \quad \text{(daily MAR)}$$

$$d_i = \min(r_i - \tau_d,\ 0) \quad \text{(downside deviation, zero-floored)}$$

$$\sigma_{DD}^2 = \frac{1}{N}\sum_{i=1}^{N} d_i^2 \quad \text{(downside variance, full-N denominator)}$$

$$\sigma_{DD} = \sqrt{\sigma_{DD}^2} \quad \text{(daily downside deviation)}$$

$$\sigma_{DD,a} = \sigma_{DD} \times \sqrt{252} \quad \text{(annualised)}$$

$$R_a = \bar{r} \times 252 \quad \text{(annualised portfolio return)}$$

$$\text{So} = \frac{R_a - \tau}{\sigma_{DD,a}}$$

### 4.3 Denominator Convention

Following Sortino & Price (1994), the downside variance uses **N** (full observation count) rather than $N - 1$. This treats downside deviation as a distributional property of the observed return series, not an estimator for a population parameter.

### 4.4 Parameters

| Parameter               | Type        | Default | Description                            |
| ----------------------- | ----------- | ------- | -------------------------------------- |
| `asset_id`              | str         | —       | Portfolio identifier                   |
| `daily_returns`         | list[float] | —       | Daily returns. Min 2 observations      |
| `risk_free_rate_annual` | float       | `0.04`  | Annualised MAR (decimal). Default 4.0% |

### 4.5 Interpretation

| Sortino Ratio          | Interpretation                          |
| ---------------------- | --------------------------------------- |
| $\text{So} < 0$        | Annualised return below MAR             |
| $0 \leq \text{So} < 1$ | Marginal downside-adjusted performance  |
| $\text{So} \geq 1$     | Good — earns more than 1× downside risk |
| $\text{So} \geq 2$     | Excellent downside-adjusted performance |
| $\text{So} = +\infty$  | No period below MAR in the sample       |

### 4.6 Limitations

- Sensitive to the **choice of MAR**. A higher MAR increases the count of downside periods and reduces the ratio.
- Like the Sharpe Ratio, it is **backward-looking** and does not predict future downside.

---

## 5. Maximum Drawdown (MDD)

**Module:** `src/analytics/risk/drawdown.py`

### 5.1 Definition

Maximum Drawdown is the largest peak-to-trough decline in a portfolio's cumulative return over the observation period. It captures the worst historical loss an investor would have experienced if they bought at the worst possible time and sold at the worst possible subsequent time.

### 5.2 Formula

Given a NAV curve $\{V_0, V_1, \ldots, V_T\}$:

$$P_t = \max(V_0, V_1, \ldots, V_t) \quad \text{(running peak)}$$

$$D_t = \frac{V_t - P_t}{P_t} \quad \text{(drawdown at time t, } D_t \leq 0\text{)}$$

$$\text{MDD} = \min_{t \in [0,T]} D_t$$

From a return series, the NAV is reconstructed as:

$$V_t = V_0 \times \prod_{i=1}^{t}(1 + r_i) \quad \text{with } V_0 = 1.0$$

### 5.3 Key Metrics

| Metric              | Description                                                              |
| ------------------- | ------------------------------------------------------------------------ |
| `max_drawdown`      | MDD as a decimal fraction (e.g. $-0.35$)                                 |
| `max_drawdown_pct`  | MDD as a percentage (e.g. $-35.0\%$)                                     |
| `peak_index`        | Index of the last NAV high before the trough                             |
| `trough_index`      | Index of the minimum NAV in the worst drawdown                           |
| `recovery_index`    | First index where NAV recovers to the prior peak (`None` if unrecovered) |
| `drawdown_duration` | `trough_index - peak_index` (periods of sustained loss)                  |
| `recovery_duration` | `recovery_index - trough_index` (periods to full recovery)               |

### 5.4 Inputs

Accepts either:

- **Daily returns** (`returns: list[float]`) — NAV is built internally starting from 1.0.
- **Pre-computed NAV / price levels** (`nav_series: list[float]`) — used directly.

Exactly one must be provided.

### 5.5 Interpretation

| MDD                | Interpretation                                             |
| ------------------ | ---------------------------------------------------------- |
| $> -10\%$          | Low historical drawdown (stable portfolio)                 |
| $-10\%$ to $-30\%$ | Typical equity market correction                           |
| $-30\%$ to $-50\%$ | Major bear market drawdown                                 |
| $< -50\%$          | Severe/catastrophic drawdown (concentrated risk, leverage) |

### 5.6 Limitations

- Captures **end-of-day** losses only; intra-day price extremes are not captured.
- A short observation history may miss historically significant drawdown regimes.
- Does not account for **recovery speed** beyond the binary recovered/unrecovered flag.

---

## 6. Value at Risk (VaR)

**Module:** `src/analytics/risk/var.py`

### 6.1 Definition

Value at Risk is the maximum loss a portfolio is expected to experience over a single trading day with a given confidence level $\alpha$. It is the standard industry measure for market risk capital requirements.

> **VaR$_{95}$ = ₹50,000** means: with 95% confidence, the portfolio will not lose more than ₹50,000 on any single trading day. There is a 5% probability that the loss will exceed this amount.

### 6.2 Method 1: Parametric VaR (Variance-Covariance)

Assumes returns are normally distributed:

$$\mu_d = \frac{1}{N}\sum_{i=1}^{N} r_i$$

$$\sigma_d = \sqrt{\frac{\sum_{i=1}^{N}(r_i - \mu_d)^2}{N-1}}$$

$$\text{VaR}_\alpha^{\text{param}} = -(\mu_d - z_\alpha \cdot \sigma_d) \times P$$

Where:

- $z_\alpha$ is the standard normal quantile at confidence $\alpha$
- $P$ is the total portfolio value in INR

**Standard z-scores:**

| Confidence Level | One-Tailed $z_\alpha$ |
| ---------------- | --------------------- |
| 90%              | 1.2816                |
| 95%              | 1.6449                |
| 99%              | 2.3263                |
| 99.9%            | 3.0902                |

### 6.3 Method 2: Historical Simulation VaR

Makes no distributional assumption. Uses the empirical quantile of the observed return distribution:

$$Q_\alpha = \text{Percentile}(r_1, \ldots, r_N;\ 1-\alpha) \quad \text{(linear interpolation)}$$

$$\text{VaR}_\alpha^{\text{hist}} = \max(-Q_\alpha, 0) \times P$$

At 95% confidence: $Q$ is the 5th percentile of the sorted daily return distribution.
At 99% confidence: $Q$ is the 1st percentile of the sorted daily return distribution.

### 6.4 Both Methods: Always Computed

The module always returns four estimates:

| Estimate        | Method                | Confidence |
| --------------- | --------------------- | ---------- |
| `parametric_95` | Parametric            | 95%        |
| `parametric_99` | Parametric            | 99%        |
| `historical_95` | Historical Simulation | 95%        |
| `historical_99` | Historical Simulation | 99%        |

### 6.5 Comparison: Parametric vs Historical

| Dimension                 | Parametric                 | Historical                       |
| ------------------------- | -------------------------- | -------------------------------- |
| Distributional assumption | Normal distribution        | None                             |
| Tail risk accuracy        | Underestimates heavy tails | Captures observed fat tails      |
| Data requirement          | Low (works with 2+ obs)    | High (needs 250+ obs for 1% VaR) |
| Sensitivity to outliers   | Low                        | High                             |
| Computational cost        | O(N)                       | O(N log N) sort                  |

### 6.6 Limitations

- Both methods compute **1-day VaR**. Multi-day scaling ($\text{VaR}_{T-\text{day}} = \text{VaR}_{1-\text{day}} \times \sqrt{T}$) is an approximation valid only for i.i.d. returns.
- **Parametric VaR** materially underestimates tail risk for portfolios with significant crypto, small-cap, or leveraged exposure.
- **Historical VaR** is limited to events present in the historical observation window. Post-COVID risk regimes require data from that period to be captured.
- Neither method accounts for **liquidity risk** (inability to liquidate at the theoretical price during a market stress event).

---

## 7. Pairwise Asset Correlation Matrix

**Module:** `src/analytics/risk/correlation.py`

### 7.1 Definition

The correlation matrix captures the linear co-movement between each pair of assets in a portfolio. It is a foundational input for Markowitz mean-variance optimisation and portfolio diversification analysis.

### 7.2 Formula

For assets $i$ and $j$ with $N$ aligned daily returns:

$$\bar{r}_i = \frac{1}{N}\sum_{t=1}^{N} r_{i,t}$$

$$\text{Cov}(i,j) = \frac{\sum_{t=1}^{N}(r_{i,t} - \bar{r}_i)(r_{j,t} - \bar{r}_j)}{N - 1}$$

$$\rho_{i,j} = \frac{\text{Cov}(i,j)}{\sigma_i \cdot \sigma_j}$$

The resulting matrix $\mathbf{C}$ is:

- **Symmetric:** $\rho_{i,j} = \rho_{j,i}$
- **Unit diagonal:** $\rho_{i,i} = 1.0$
- **Bounded:** $-1.0 \leq \rho_{i,j} \leq 1.0$

### 7.3 Parameters

| Parameter       | Type                   | Description                                                                    |
| --------------- | ---------------------- | ------------------------------------------------------------------------------ |
| `asset_returns` | dict[str, list[float]] | Mapping of asset ID → aligned daily returns. All series must have equal length |

### 7.4 Interpretation

| Correlation         | Interpretation                                            |
| ------------------- | --------------------------------------------------------- |
| $\rho \approx +1.0$ | Perfect positive co-movement (no diversification benefit) |
| $\rho \approx +0.5$ | Moderate positive correlation (limited diversification)   |
| $\rho \approx 0.0$  | Uncorrelated (maximum diversification benefit)            |
| $\rho \approx -0.5$ | Moderate negative correlation (partial natural hedge)     |
| $\rho \approx -1.0$ | Perfect inverse relationship (maximum hedge)              |

**Typical observed correlations:**

| Asset Pair                        | Typical Correlation Range |
| --------------------------------- | ------------------------- |
| NIFTY 50 / SENSEX                 | $+0.98$ to $+0.99$        |
| Large-cap Equity / Gold           | $-0.20$ to $+0.10$        |
| Equity / Government Bonds (India) | $-0.30$ to $+0.20$        |
| Bitcoin / Ethereum                | $+0.70$ to $+0.90$        |
| Equity / USD/INR FX               | $-0.40$ to $-0.10$        |

### 7.5 Diversification Rule of Thumb

A portfolio with pairwise correlations uniformly near zero provides near-maximum variance reduction. For a portfolio of $N$ equal-weight uncorrelated assets, the portfolio variance is $\sigma^2/N$ (a factor $N$ reduction).

### 7.6 Special Cases

- **Zero-variance asset** (constant daily return): Correlation with all other assets is undefined. The implementation sets off-diagonal cells to 0.0 (treated as uncorrelated) rather than `NaN` to ensure safe serialisation.
- **Single-asset portfolio:** Returns a $1 \times 1$ matrix $[[1.0]]$.

### 7.7 Limitations

- Measures **linear** correlation only. Non-linear dependencies (e.g. tail co-dependence during market crashes — "correlation breakdown") are not captured.
- Pairwise correlations are **non-stationary** and can change dramatically during market stress events. Rolling window correlations (e.g. 60-day or 90-day windows) are preferred for risk monitoring.
- Not sufficient for full portfolio risk — the matrix must be **positive semi-definite** for a valid covariance matrix. Floating-point errors on large matrices may produce slightly non-PSD matrices; regularisation (diagonal loading) may be required for optimisation applications.

---

## 8. Diversification & Concentration Analytics

**Module:** `src/analytics/risk/diversification.py`

### 8.1 Definition

Diversification analytics quantify how well a portfolio's capital is spread across assets that behave independently of one another. Three complementary measures are provided:

1. **Herfindahl-Hirschman Index (HHI)** — weight-based concentration, independent of correlations.
2. **Top-N Concentration Ratios** — cumulative weight of the $N$ largest holdings.
3. **Composite Diversification Score** — blends weight concentration and pairwise return correlation into a single 0–100 metric.

---

### 8.2 Herfindahl-Hirschman Index (HHI)

#### 8.2.1 Formula

For a portfolio of $N$ assets with fractional weights $w_i$ ($w_i \geq 0$, $\sum_{i=1}^{N} w_i = 1$), the HHI is expressed on the **10,000-point scale** (weights in percentage points before squaring):

$$\text{HHI} = \sum_{i=1}^{N} (w_i \times 100)^2 = 10{,}000 \times \sum_{i=1}^{N} w_i^2$$

#### 8.2.2 Boundary Conditions

| Portfolio                            | $\sum w_i^2$ | HHI            |
| ------------------------------------ | ------------ | -------------- |
| Single-asset (maximum concentration) | $1$          | $10{,}000$     |
| $N$ equal-weight assets              | $1/N$        | $10{,}000 / N$ |
| Perfectly dispersed ($N \to \infty$) | $\to 0$      | $\to 0$        |

#### 8.2.3 Interpretation

| HHI Range           | Concentration Level                                       |
| ------------------- | --------------------------------------------------------- |
| $> 8{,}000$         | Highly concentrated (single-stock or near-equivalent)     |
| $4{,}000$–$8{,}000$ | Very concentrated                                         |
| $2{,}500$–$4{,}000$ | Moderate concentration                                    |
| $1{,}000$–$2{,}500$ | Competitive / diversified                                 |
| $< 1{,}000$         | Highly diversified ($> 10$ equal-weight asset equivalent) |

> Thresholds are adapted from the US Department of Justice Horizontal Merger Guidelines (HHI > 2,500 = highly concentrated) and re-calibrated for portfolio analysis.

#### 8.2.4 Sector-Level HHI

When `sector_weights` are provided, a second HHI is computed at the sector-aggregation level using the same formula applied to sector-level weights. This detects sector concentration that is invisible at the individual-holding level (e.g. 10 technology stocks at 5% each appear diversified but produce a Technology sector HHI of $10{,}000$).

---

### 8.3 Effective N (Equivalent Equal-Weight Portfolio Size)

#### 8.3.1 Formula

The Effective Number of Independent Bets measures how many **equally-weighted** assets would produce the same weight concentration as the actual portfolio:

$$N_{\text{eff}} = \frac{1}{\sum_{i=1}^{N} w_i^2} = \frac{10{,}000}{\text{HHI}}$$

**Effective N as a percentage of maximum:**

$$\text{Eff.N\%} = \frac{N_{\text{eff}}}{N} \times 100$$

A value of 100% indicates a perfectly equal-weighted portfolio. Values below 50% indicate a materially top-heavy allocation.

#### 8.3.2 Interpretation

| $N_{\text{eff}}$   | Meaning                                        |
| ------------------ | ---------------------------------------------- |
| $= 1$              | Equivalent to a single-asset portfolio         |
| $= N$              | Perfectly equal-weighted across all $N$ assets |
| $= k$, $1 < k < N$ | Equivalent to $k$ equal-weight assets          |

---

### 8.4 Top-N Concentration Ratios

#### 8.4.1 Formula

The Top-N Concentration Ratio $\text{CR}_N$ is the cumulative weight of the $N$ largest holdings, sorted by weight descending:

$$\text{CR}_N = \sum_{i \in \text{top-}N} w_i \times 100 \quad [\%]$$

#### 8.4.2 Default Cut-offs and Risk Thresholds

| Ratio            | $N$           | Risk Threshold                                             |
| ---------------- | ------------- | ---------------------------------------------------------- |
| $\text{CR}_3$    | Top 3 assets  | $> 60\%$ → significant 3-stock concentration risk          |
| $\text{CR}_5$    | Top 5 assets  | $> 70\%$ → high single-factor exposure                     |
| $\text{CR}_{10}$ | Top 10 assets | $> 80\%$ → insufficient breadth for institutional mandates |

---

### 8.5 Composite Diversification Score (0–100)

#### 8.5.1 Motivation

A pure weight-concentration measure (HHI) ignores whether assets move in lockstep or independently. A portfolio of 10 equally-weighted assets that are perfectly correlated ($\rho = 1.0$) provides no actual risk diversification despite a moderate HHI. The Composite Diversification Score corrects this by blending:

- **Component A** (weight $\alpha = 0.60$): Weight-based concentration via Effective N.
- **Component B** (weight $\beta = 0.40$): Return correlation penalty via weight-averaged pairwise Pearson correlation.

#### 8.5.2 Component A — Effective-N Concentration Score

$$A_{\text{score}} = \min\!\left(\frac{N_{\text{eff}}}{N},\ 1.0\right) \times 100$$

| $A_{\text{score}}$ | Interpretation                                      |
| ------------------ | --------------------------------------------------- |
| 100                | Perfectly equal-weighted (maximum weight diversity) |
| 50–99              | Moderate weight concentration                       |
| $< 50$             | Materially top-heavy allocation                     |

#### 8.5.3 Component B — Correlation Penalty Score

Let $\rho_{i,j}$ be the Pearson correlation between assets $i$ and $j$ over aligned daily return series. The **weight-averaged pairwise correlation** across all $M = \binom{N}{2}$ distinct pairs is:

$$\bar{w}_{i,j} = \frac{w_i + w_j}{2}, \qquad \Sigma_{\text{norm}} = \sum_{i < j} \bar{w}_{i,j}$$

$$\bar{\rho} = \frac{\displaystyle\sum_{i < j} \bar{w}_{i,j} \cdot \rho_{i,j}}{\Sigma_{\text{norm}}}$$

The weighted average correlation $\bar{\rho} \in [-1, 1]$ maps to a 0–100 score via a linear transformation:

$$B_{\text{score}} = \frac{1 - \bar{\rho}}{2} \times 100$$

| $\bar{\rho}$ | $B_{\text{score}}$ | Interpretation                                           |
| ------------ | ------------------ | -------------------------------------------------------- |
| $-1.0$       | 100                | Perfectly hedged (maximum diversification benefit)       |
| $0.0$        | 50                 | Uncorrelated assets (neutral prior / fallback default)   |
| $+0.3$       | 35                 | Typical equity-only portfolio                            |
| $+1.0$       | 0                  | All assets move in lockstep (no diversification benefit) |

**Fallback when correlation data is unavailable:**

When no `correlation_matrix` is provided, $B_{\text{score}}$ defaults to **50** (neutral / uncorrelated assumption). This is the mathematically correct neutral prior. The `correlation_data_used` field in the response indicates whether actual data was used.

#### 8.5.4 Final Composite Score

$$\text{Score} = \alpha \cdot A_{\text{score}} + \beta \cdot B_{\text{score}}$$

| Coefficient                   | Value    | Rationale                                         |
| ----------------------------- | -------- | ------------------------------------------------- |
| $\alpha$ (Effective-N weight) | **0.60** | Primary signal; valid even without return history |
| $\beta$ (Correlation weight)  | **0.40** | Secondary signal; requires aligned return series  |

The partition of unity constraint $\alpha + \beta = 1.0$ is enforced via a compile-time assertion.

#### 8.5.5 Score Interpretation Table

| Range  | Classification      | Typical Archetype                                                                            |
| ------ | ------------------- | -------------------------------------------------------------------------------------------- |
| 85–100 | Excellent           | Broad multi-asset index (equities + bonds + gold + alternatives, $\bar{\rho} \approx -0.25$) |
| 65–85  | Good                | Diversified equity portfolio (20+ stocks, $\bar{\rho} \approx 0.3$)                          |
| 40–65  | Moderate            | Sector-concentrated or market-cap tilted portfolio                                           |
| 10–40  | Poor                | High single-stock or sector risk                                                             |
| 0–10   | Highly Concentrated | Near-single-stock with explicit lockstep correlation data                                    |

#### 8.5.6 Validation Archetypes

| Archetype                             | HHI    | $N_{\text{eff}}$ | Score    | Notes                                      |
| ------------------------------------- | ------ | ---------------- | -------- | ------------------------------------------ |
| Single stock (no corr data)           | 10,000 | 1.0              | 80.0     | $B=50$ (neutral; no pairs exist for $N=1$) |
| 20 equal-weight, $\bar{\rho} = 0.0$   | 500    | 20.0             | 80.0     | $A=100$, $B=50$                            |
| 20 equal-weight, $\bar{\rho} = -0.25$ | 500    | 20.0             | **85.0** | $A=100$, $B=62.5$ — passes >85 threshold   |
| 5 equal-weight, $\bar{\rho} = 0.40$   | 2,000  | 5.0              | 68.0     | $A=100$, $B=30$                            |

---

### 8.6 Parameters

| Parameter               | Type                | Required | Description                                                             |
| ----------------------- | ------------------- | -------- | ----------------------------------------------------------------------- |
| `portfolio_id`          | `str`               | Yes      | Identifier echoed in output for logging/tracing                         |
| `asset_weights`         | `dict[str, float]`  | Yes      | Asset ID → weight. Accepts fractions or %. Auto-normalised to sum = 1.0 |
| `sector_weights`        | `dict[str, float]`  | No       | Sector label → aggregate weight. Enables sector-level HHI               |
| `correlation_matrix`    | `list[list[float]]` | No       | N×N Pearson matrix. Must be provided with `correlation_asset_ids`       |
| `correlation_asset_ids` | `list[str]`         | No       | Ordered asset IDs for matrix rows/columns. Must match matrix dimension  |
| `top_n_ratios`          | `list[int]`         | No       | N cut-off values for $\text{CR}_N$. Default: `[3, 5, 10]`               |

---

### 8.7 Fixed-Precision Arithmetic Rules

| Output Field                             | Rounding         | Justification                                          |
| ---------------------------------------- | ---------------- | ------------------------------------------------------ |
| `hhi`                                    | 2 decimal places | 10,000-point scale; 2dp = 0.01 precision               |
| `effective_n`                            | 4 decimal places | Ratio; 4dp sufficient for display                      |
| `weight_pct` (CR_N)                      | 4 decimal places | Percentage; matches allocation engine convention       |
| `weighted_avg_correlation`               | 6 decimal places | Correlation input to scoring; high precision preserved |
| `diversification_score`                  | 4 decimal places | Exceeds PRD display requirement of 2dp                 |
| `component_a_score`, `component_b_score` | 4 decimal places | Sub-scores for audit/debugging                         |

All intermediate calculations use IEEE 754 double precision. No rounding is applied until output assignment.

---

### 8.8 Limitations

- **HHI is weight-only.** Two assets with identical weights but $\rho = 1.0$ contribute the same HHI as two uncorrelated assets. HHI alone cannot distinguish truly diversified from superficially diversified portfolios.
- **Correlation is backward-looking.** $\bar{\rho}$ is estimated from historical return series. Correlations are non-stationary and spike toward $+1.0$ during market stress events ("correlation breakdown") — precisely when diversification is most needed.
- **Component B requires aligned return history.** Without a pre-computed `correlation_matrix`, $B_{\text{score}}$ defaults to 50. Scores will understate true diversification for well-chosen uncorrelated assets and overstate it for highly-correlated ones.
- **Single-asset special case.** For $N = 1$, there are no off-diagonal pairs ($M = 0$). The engine returns `weighted_avg_correlation = null` and $B_{\text{score}} = 50$ (neutral). Final score = **80** — HHI = 10,000 is the unambiguous concentration signal.
- **Linear correlation only.** Tail co-dependence (copulas), factor exposures, and non-linear dependencies are not captured.

---

## Financial Conventions Summary

| Convention                           | Value                           | Rationale                                              |
| ------------------------------------ | ------------------------------- | ------------------------------------------------------ |
| Trading days per year                | 252                             | Global equity market standard                          |
| Annualisation factor                 | $\sqrt{252}$                    | Square-root-of-time rule for i.i.d. returns            |
| Variance denominator                 | $N - 1$ (Bessel)                | Unbiased sample estimator (except Sortino DD: $N$)     |
| Default risk-free rate               | 4.0% (annualised)               | Proxy for RBI Repo Rate / 91-day T-bill yield          |
| Default VaR confidence levels        | 95% and 99%                     | Basel III standard; RBI Internal Models approach       |
| Default Sortino MAR                  | 4.0% (annualised)               | Matching risk-free rate convention                     |
| Return type                          | Simple periodic                 | $r_t = P_t / P_{t-1} - 1$                              |
| VaR sign convention                  | Positive = loss                 | Standard market risk reporting convention              |
| HHI scale                            | 10,000-point                    | Weights in % before squaring; standard US DOJ scale    |
| Diversification Score scale          | 0–100                           | Higher = better diversified                            |
| Diversification scoring coefficients | $\alpha = 0.60$, $\beta = 0.40$ | Calibrated for meaningful boundary condition behaviour |

---

## Minimum Data Requirements

| Metric                                   | Minimum Observations   | Recommended                               |
| ---------------------------------------- | ---------------------- | ----------------------------------------- |
| Volatility                               | 2                      | 252 (1 year)                              |
| Beta                                     | 2 (per series)         | 252                                       |
| Sharpe Ratio                             | 2                      | 252                                       |
| Sortino Ratio                            | 2                      | 252                                       |
| Maximum Drawdown                         | 2 (NAV) or 1 (return)  | 252+                                      |
| Parametric VaR                           | 2                      | 60                                        |
| Historical VaR (95%)                     | 20                     | 252                                       |
| Historical VaR (99%)                     | 100                    | 504 (2 years)                             |
| Correlation Matrix                       | 2 (aligned per pair)   | 252                                       |
| HHI / Effective N / Top-N                | 1 asset, 1 weight      | — (weight-only, no return history needed) |
| Diversification Score (weight-only)      | 1 asset                | — (Component B defaults to 50)            |
| Diversification Score (with correlation) | 2 assets, 2 return obs | 252 (per asset)                           |

---

## References

1. Hull, J.C. (2022). _Options, Futures, and Other Derivatives_ (11th ed.). Pearson. §15.4.
2. Sharpe, W.F. (1964). Capital Asset Prices: A Theory of Market Equilibrium. _Journal of Finance_, 19(3), 425-442.
3. Sharpe, W.F. (1994). The Sharpe Ratio. _Journal of Portfolio Management_, 21(1), 49-58.
4. Sortino, F.A. & Price, L.N. (1994). Performance Measurement in a Downside Risk Framework. _Journal of Investing_, 3(3), 59-64.
5. Markowitz, H.M. (1952). Portfolio Selection. _Journal of Finance_, 7(1), 77-91.
6. Jorion, P. (2006). _Value at Risk: The New Benchmark for Managing Financial Risk_ (3rd ed.). McGraw-Hill.
7. Magdon-Ismail, M. et al. (2004). On the Maximum Drawdown of a Brownian Motion. _Journal of Applied Probability_, 41, 147-161.
8. Basel Committee on Banking Supervision (2019). _Minimum Capital Requirements for Market Risk (FRTB)_. Bank for International Settlements.
9. Herfindahl, O.C. (1950). _Concentration in the U.S. Steel Industry_ (Doctoral dissertation). Columbia University.
10. Hirschman, A.O. (1964). The Paternity of an Index. _American Economic Review_, 54(5), 761-762.
11. Meucci, A. (2009). Managing Diversification. _Risk Magazine_, 22(5), 74-79.
12. US Department of Justice & Federal Trade Commission (2010). _Horizontal Merger Guidelines_. §5.3 (HHI concentration thresholds).
