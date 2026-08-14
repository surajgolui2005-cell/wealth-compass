# ADR-0003: Quant Service Engine

| Field          | Value                                            |
|----------------|--------------------------------------------------|
| **ADR ID**     | 0003                                             |
| **Title**      | Quant Service Engine — Python FastAPI Microservice |
| **Status**     | Accepted                                         |
| **Date**       | 2026-08-13                                       |
| **Deciders**   | Principal Architecture Team                      |
| **Supersedes** | —                                                |
| **Superseded by** | —                                             |
| **Ref**        | [ARCHITECTURE.md](file:///c:/Users/suraj/project/Investor%20Portolio%20Monitoring%20and%20Risk%20Management%20System/docs/architecture/ARCHITECTURE.md#L1.2) §1.2, §2, §3.4, §12 |

---

## Context

The Investor Portfolio Monitoring & Risk Management System (IPMS) requires sophisticated, institutional-grade quantitative risk and performance calculations:

- **Value at Risk (VaR)** & **Conditional Value at Risk (CVaR)**: Calculated using Historical Simulation at 95% and 99% confidence levels, requiring a rolling window of at least 252 trading days of historical return matrices.
- **Performance Metrics**: Annualised Sharpe Ratio, Sortino Ratio (measuring downside risk), annualised volatility (standard deviation of daily returns), and Cumulative Annual Growth Rate (CAGR).
- **Internal Rate of Return (XIRR)**: Calculated via numerical root-finding algorithms (e.g., Newton-Raphson method) for irregular transaction cash flows.
- **Beta & Correlation**: Portfolio Beta relative to a benchmark index (e.g., Nifty 50 or S&P 500) and a Pearson pairwise correlation matrix across all assets to identify concentration risk clusters.
- **What-If Scenario Simulation**: Applying historic macro stress events (e.g., 2008 Financial Crisis, 2020 COVID Market Crash) to current portfolio allocations.

These operations are highly CPU-bound, rely heavily on matrix operations (vectorised returns), and require high mathematical precision. 

Node.js, while excellent for handling asynchronous I/O-bound REST APIs and event-driven orchestration, is single-threaded and lacks a robust, battle-tested ecosystem of numerical computing and quantitative analysis libraries. Running these computations in the primary NestJS process would block the event loop, causing severe latency spikes for all API requests. 

We need to decide on the architecture and technology stack for the quantitative computation engine to maintain performance isolation, mathematical correctness, and high developer velocity.

### Constraints

- All financial mathematical computations must maintain IEEE 754 double-precision float consistency.
- CPU-intensive tasks must not block the transactional API Gateway and I/O worker processes.
- The quant engine must expose clear API contracts, preferably auto-generated, to facilitate service-to-service communication.
- The chosen solution must not introduce redundant or custom implementations of complex financial equations.

---

## Decision

**We will implement the quantitative calculations in a dedicated Python 3.12 microservice using FastAPI 0.111, with NumPy, Pandas, SciPy, and QuantLib-Python.**

The Python microservice is deployed as an internal-only container (`apps/quant-engine`) with no public internet routing. The NestJS API Gateway and BullMQ background workers communicate with it synchronously via REST endpoints. To avoid transferring massive historical price datasets across the network, the Python service maintains its own read-only connection pool to the TimescaleDB replica database to query price history matrices directly.

---

## Options Considered

### Option A: Python FastAPI Microservice (Selected)

**Description:** A lightweight, high-performance web service built with Python 3.12 and FastAPI. It relies on standard data-science packages: NumPy for multi-dimensional array operations, Pandas for time-series alignment, SciPy for statistical distribution modeling, and the QuantLib-Python wrapper for institutional-grade cash flow analytics and numerical root-finding.

| Criteria | Assessment |
|---|---|
| Code sharing / Types | ⚠️ Requires schema generation (`Pydantic` models mapped to TypeScript DTOs via automation tools) to sync backend type changes |
| Performance Isolation | ✅ Excellent — CPU-intensive matrix operations are isolated to the Python process, keeping the API gateway responsive |
| Math Library Ecosystem | ✅ Exceptional — NumPy, Pandas, and QuantLib-Python are industry-standard, eliminating the need to write custom formulas |
| Computational Speed | ✅ Highly optimised — NumPy operations execute in vectorised C/Fortran routines, bypassing Python interpreter overhead |
| Horizontal Scalability | ✅ Easy — Kubernetes Horizontal Pod Autoscaler (HPA) can scale Python pods independently based on CPU utilization |
| Internal REST Latency | ⚠️ Adds a network hop (< 10ms roundtrip) for synchronous computations |

### Option B: In-Process Node.js Quant Engine (using `mathjs`, simple npm libraries)

**Description:** Keep calculations in-process within the NestJS modular monolith. Utilize Node.js math libraries (like `mathjs`, `simple-statistics`, and custom JS algorithms) to compute metrics.

| Criteria | Assessment |
|---|---|
| Code sharing / Types | ✅ Excellent — Native TypeScript integration with zero serialization overhead or network hops |
| Performance Isolation | ❌ Terrible — CPU-bound loops for VaR and correlation matrices block the Node.js event loop, degrading API response times |
| Math Library Ecosystem | ❌ Weak — Node.js lacks professional financial math frameworks like QuantLib or robust time-series alignment toolkits like Pandas |
| Operational Complexity | ✅ Low — One less runtime language, container, and configuration to maintain |

**Why not selected:** The lack of professional financial library support would force us to implement and audit our own math algorithms (e.g., custom Newton-Raphson solvers for XIRR, custom historical correlation matrices). This creates high risk for financial precision bugs. Additionally, the event-loop-blocking nature of these math tasks would limit vertical API scaling.

### Option C: Go-based Quant Microservice

**Description:** Build a microservice using Go (Golang). Write computations using packages like `gonum` for matrix math or custom Go financial packages.

| Criteria | Assessment |
|---|---|
| Performance | ✅ Exceptional — Compile-time optimization, native concurrency, and low memory footprint |
| Math Library Ecosystem | ⚠️ Moderate — Go has the `gonum` package, but it is far less mature for financial time-series analysis compared to Python's Pandas and lacks a native QuantLib binding |
| Developer Velocity | ❌ Lower — Go requires writing verbose boilerplate code for matrix manipulation; the data science community in Go is small, meaning less documentation and reference examples |

**Why not selected:** While Go would offer superior runtime performance and lower memory usage, developer velocity would suffer. Building historical simulation VaR and scenario mapping in Go requires significantly more custom code than Python, where a few Pandas operations accomplish the same task safely.

### Option D: Rust-based Quant Microservice (using `polars` / `gonum` equivalents)

**Description:** Build a highly optimised, memory-safe, compiled microservice using Rust, utilizing `polars` for time-series alignment and numerical crates.

| Criteria | Assessment |
|---|---|
| Performance / Safety | ✅ Industry-best — Compile-time memory safety, sub-millisecond latencies, and high performance |
| Developer Velocity | ❌ Poor — High cognitive load for a small team, steep learning curve, and slower compilation speeds |
| Math Library Ecosystem | ⚠️ Growing but limited — `polars` is powerful, but financial analytics bindings are sparse compared to Python |

**Why not selected:** Rust is highly attractive for institutional high-frequency trading platforms, but at our scale (retail portfolio tracking), it represents premature optimization. The development overhead of Rust's borrow checker and strict types would slow down the team's ability to ship MVP features.

---

## Consequences

### Positive

- **True Performance Isolation**: Long-running or heavy CPU requests (e.g., calculating risk for a portfolio with 100+ assets across 5 years of daily history) will not impact the responsiveness of the HTTP API Gateway.
- **Institutional Accuracy**: Utilizing QuantLib and SciPy guarantees that our financial computations match industry-standard tooling, protecting us from rounding, calculation, or implementation drift.
- **Fast vectorised operations**: Vectorised matrix manipulation in NumPy and Pandas is significantly faster than iterative JavaScript arrays, reducing latency for complex correlation matrices.
- **Independent Scaling**: Under high loads (e.g., market crashes causing many users to check their VaR score), the Python microservice can scale horizontally from 2 to 10+ pods via Kubernetes, without wasting resources scaling the API gateway.
- **Service-to-Service Security**: The Quant Engine is protected from direct public access. It only accepts internal HTTP requests from the NestJS cluster, authenticated via a short-lived asymmetric RS256 JWT, minimizing the threat surface.

### Negative / Trade-offs

- **Infrastructure overhead**: The team must manage a polyglot codebase with two runtimes (Node.js and Python), separate package managers (`pnpm` vs `pip` + virtual environments), and separate linting/testing suites (`eslint`/`jest` vs `ruff`/`pytest`).
- **Data Serialization cost**: Requests must be serialized to JSON, transmitted over the local network, and deserialized in Python. Mitigation: The payload is kept small (JSON with weights and asset references); the Python service pulls raw daily returns directly from TimescaleDB via its own high-speed `asyncpg` connection pool.
- **Type synchronization**: Changes to input/output DTOs must be updated in both the NestJS API code and Python Pydantic models. Mitigation: Automated contract tests enforce schema alignment.

### Neutral

- The quant engine is stateless. It reads price historical data from TimescaleDB, performs calculations, caches the result in Redis (with a 1-hour TTL keyed by `userId` and portfolio hash), and returns the JSON response.

---

## Compliance Check

| Requirement | Met? | Notes |
|---|---|---|
| **Financial precision** | ✅ | Relies on double-precision IEEE 754 floats via NumPy/Pandas and battle-tested QuantLib algorithms, minimizing manual implementation errors. |
| **Developer velocity** | ✅ | Small Python files leverage high-level expressions (Pandas dataframes) to compute complex metrics like Sharpe, Beta, and Covariance in under 10 lines of code. |
| **System scalability** | ✅ | Separates CPU-intensive execution from I/O execution, allowing independent scaling of Python pods behind a private internal load balancer. |

---

*ADR-0003 — Accepted 2026-08-13*
