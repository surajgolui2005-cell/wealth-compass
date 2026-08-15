"""
Extended Internal Rate of Return (XIRR) — Numerical Root-Finding Engine
========================================================================

Mathematical Foundation
-----------------------

XIRR is the discount rate ``r`` that satisfies the Net Present Value (NPV)
equation across a set of non-periodic cash flows:

                 n
    NPV(r) = Σ  ─────────────────────  = 0
                CF_i / (1 + r)^((d_i - d_0) / 365.25)
                i=0

Where:
    CF_i = Cash flow amount at time i (negative = outflow, positive = inflow)
    d_i  = Date of cash flow i
    d_0  = Date of the first cash flow (reference date)
    r    = XIRR (annualised internal rate of return)

Convention:
    - Investments (BUY, DEPOSIT) are NEGATIVE cash flows.
    - Proceeds (SELL, DIVIDEND, WITHDRAWAL, current portfolio value) are POSITIVE.
    - The current portfolio value is appended as the final positive cash flow
      on today's date to "close" the IRR equation.

Solver Strategy
---------------

**Primary: Newton-Raphson Method**

    r_{n+1} = r_n - NPV(r_n) / NPV'(r_n)

Where the derivative NPV'(r) is:

                    n
    NPV'(r) = -Σ  CF_i × t_i / ((1 + r)^(t_i + 1))
                   i=0

    t_i = (d_i - d_0).days / 365.25

Newton-Raphson converges quadratically near the root and is the industry standard
(used by Microsoft Excel, LibreOffice Calc, and Bloomberg Portfolio Analytics).

Limitations:
- Requires a reasonable initial guess (default: 0.10 = 10%)
- May diverge for alternating-sign cash flow schedules
- May produce multiple roots when the cash flow sign changes more than once

**Fallback: Brent–Dekker Method (via scipy.optimize.brentq)**

When Newton-Raphson fails to converge within ``max_iterations``, we fall back to
Brent's method, which guarantees convergence given a valid bracket [a, b] where
NPV(a) and NPV(b) have opposite signs. We probe the bracket
``[-0.9999, 100.0]`` (i.e., -99.99% to +10,000% annual return).

This ensures XIRR is always computed unless no real root exists.

Convergence Failure
-------------------
If both solvers fail (e.g., all-positive or all-negative cash flows, or
pathological alternating flows), an ``XirrConvergenceError`` is raised.
The NestJS API should catch this exception and fall back to displaying TWR.

References
----------
    - Almkvist & Berndt (1988), "Gauss, Landen, Ramanujan, ..."
    - Microsoft Excel XIRR specification: https://support.microsoft.com/office
    - Brent, R.P. (1973), "Algorithms for Minimization without Derivatives"
    - GIPS 2020 §2.A.6 on IRR for private equity
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date
from typing import Sequence

from scipy.optimize import brentq


# ── Constants ─────────────────────────────────────────────────────────────────

_DAYS_PER_YEAR: float = 365.25          # Gregorian average
_DEFAULT_GUESS: float = 0.10            # 10% initial Newton-Raphson seed
_TOLERANCE: float = 1e-9               # Convergence criterion on |NPV(r)|
_MAX_ITERATIONS: int = 1_000           # As specified in PRD US-RISK-01 Scenario 4
_BRENT_LOWER: float = -0.9999          # Lower bracket: -99.99% (near-total loss)
_BRENT_UPPER: float = 100.0            # Upper bracket: +10,000% (extreme upside)


# ── Domain Types ──────────────────────────────────────────────────────────────

@dataclass(frozen=True)
class CashFlow:
    """
    A single cash flow event in the XIRR calculation.

    Attributes
    ----------
    date:
        Date on which the cash flow occurs.
    amount:
        Signed cash flow amount in portfolio home currency.
        Negative = money leaving the investor's pocket (BUY, DEPOSIT).
        Positive = money entering the investor's pocket (SELL, DIVIDEND,
                   current portfolio value).
    """

    date: date
    amount: float


@dataclass
class XirrResult:
    """
    Output of the XIRR computation.

    Attributes
    ----------
    xirr:
        Annualised XIRR as a decimal fraction.
        e.g., 0.198 = 19.8% per annum.
    npv_at_solution:
        NPV value at the solution rate. Should be close to 0 (< tolerance).
    solver_used:
        Which numerical solver produced the result.
        "newton_raphson" or "brent_dekker".
    iterations:
        Number of iterations consumed by the primary solver before either
        converging or falling back to Brent's method.
    n_cash_flows:
        Total number of cash flow events processed.
    """

    xirr: float
    npv_at_solution: float
    solver_used: str
    iterations: int
    n_cash_flows: int


class XirrConvergenceError(Exception):
    """
    Raised when neither Newton-Raphson nor Brent's method can converge on a
    real XIRR root. The caller should fall back to displaying TWR.
    """

    pass


# ── Core NPV Functions ─────────────────────────────────────────────────────────

def _year_fractions(flows: Sequence[CashFlow]) -> list[float]:
    """
    Converts cash flow dates to year fractions relative to the first date.

    t_i = (d_i - d_0).days / 365.25
    """
    if not flows:
        return []
    d0 = flows[0].date
    return [(cf.date - d0).days / _DAYS_PER_YEAR for cf in flows]


def _npv(rate: float, amounts: Sequence[float], year_fracs: Sequence[float]) -> float:
    """
    Net Present Value:  Σ CF_i / (1 + r)^t_i

    Avoids math.pow overflow by checking (1 + rate) > 0.
    """
    if rate <= -1.0:
        return float("inf")
    total = 0.0
    for cf, t in zip(amounts, year_fracs):
        total += cf / math.pow(1.0 + rate, t)
    return total


def _npv_derivative(rate: float, amounts: Sequence[float], year_fracs: Sequence[float]) -> float:
    """
    First derivative of NPV w.r.t. rate:  -Σ CF_i × t_i / (1 + r)^(t_i + 1)
    """
    if rate <= -1.0:
        return float("-inf")
    total = 0.0
    for cf, t in zip(amounts, year_fracs):
        total -= cf * t / math.pow(1.0 + rate, t + 1.0)
    return total


# ── Primary Solver: Newton-Raphson ────────────────────────────────────────────

def _newton_raphson(
    amounts: list[float],
    year_fracs: list[float],
    guess: float = _DEFAULT_GUESS,
    tolerance: float = _TOLERANCE,
    max_iterations: int = _MAX_ITERATIONS,
) -> tuple[float, int] | None:
    """
    Newton-Raphson root-finder for XIRR.

    Returns (rate, iterations) on convergence, or None if it fails to converge
    or produces a NaN/Inf intermediate value.
    """
    r = guess
    for i in range(max_iterations):
        npv = _npv(r, amounts, year_fracs)
        if abs(npv) < tolerance:
            return r, i + 1

        deriv = _npv_derivative(r, amounts, year_fracs)
        if deriv == 0.0 or math.isnan(deriv) or math.isinf(deriv):
            return None  # Newton step undefined — defer to fallback

        r_new = r - npv / deriv

        # Guard against divergence into unphysical territory
        if r_new <= -1.0 or math.isnan(r_new) or math.isinf(r_new):
            return None

        if abs(r_new - r) < tolerance:
            return r_new, i + 1

        r = r_new

    return None  # Did not converge within max_iterations


# ── Fallback Solver: Brent–Dekker ─────────────────────────────────────────────

def _brent_dekker(
    amounts: list[float],
    year_fracs: list[float],
    lower: float = _BRENT_LOWER,
    upper: float = _BRENT_UPPER,
    tolerance: float = _TOLERANCE,
) -> float | None:
    """
    Brent–Dekker root-finder via scipy.optimize.brentq.

    Probes the bracket [lower, upper] for a sign change in NPV.
    Returns the rate on success, or None if no sign change exists in the bracket
    (i.e., no real root in the physical range of returns).
    """
    f = lambda r: _npv(r, amounts, year_fracs)  # noqa: E731

    npv_low = f(lower)
    npv_high = f(upper)

    # Brent's method requires a sign change in the bracket
    if npv_low * npv_high > 0:
        return None  # No root in bracket — XIRR not solvable

    try:
        rate = brentq(f, lower, upper, xtol=tolerance, maxiter=500)
        return rate
    except ValueError:
        return None


# ── Public API ────────────────────────────────────────────────────────────────

def compute_xirr(
    cash_flows: Sequence[CashFlow],
    guess: float = _DEFAULT_GUESS,
    tolerance: float = _TOLERANCE,
    max_iterations: int = _MAX_ITERATIONS,
) -> XirrResult:
    """
    Computes XIRR (Extended IRR) for a sequence of non-periodic cash flows.

    The solver first attempts Newton-Raphson, then falls back to Brent's
    method if Newton-Raphson fails to converge.

    Parameters
    ----------
    cash_flows:
        Sequence of CashFlow events sorted chronologically. Must contain
        at least two events with opposite signs (i.e., both outflows and
        inflows must be present). The final cash flow is typically the
        current portfolio market value (positive sign).
    guess:
        Initial rate estimate for Newton-Raphson (default 10%).
    tolerance:
        Convergence criterion on |NPV(r)| (default 1e-9).
    max_iterations:
        Maximum Newton-Raphson iterations before falling back to Brent
        (default 1,000 as specified in PRD US-RISK-01 Scenario 4).

    Returns
    -------
    XirrResult
        The solved XIRR with diagnostics.

    Raises
    ------
    ValueError
        If fewer than 2 cash flows are provided, or all cash flows have the
        same sign (XIRR is mathematically undefined).
    XirrConvergenceError
        If neither Newton-Raphson nor Brent's method converges. The calling
        service should fall back to TWR and surface an appropriate UI message.

    Examples
    --------
    >>> from datetime import date
    >>> flows = [
    ...     CashFlow(date=date(2023, 1, 1), amount=-100_000.0),
    ...     CashFlow(date=date(2023, 7, 1), amount=-50_000.0),
    ...     CashFlow(date=date(2024, 1, 1), amount=10_000.0),
    ...     CashFlow(date=date(2024, 6, 1), amount=185_000.0),
    ... ]
    >>> result = compute_xirr(flows)
    >>> round(result.xirr, 3)
    0.198      # ≈ 19.8% p.a. (indicative per PRD US-RISK-01 Scenario 1)
    """
    flows = list(cash_flows)

    if len(flows) < 2:
        raise ValueError("XIRR requires at least 2 cash flows.")

    amounts = [cf.amount for cf in flows]
    positives = [a for a in amounts if a > 0]
    negatives = [a for a in amounts if a < 0]

    if not positives or not negatives:
        raise ValueError(
            "XIRR requires both positive (inflow) and negative (outflow) cash flows. "
            f"Got {len(positives)} positive and {len(negatives)} negative flows."
        )

    year_fracs = _year_fractions(flows)

    # ── Attempt Newton-Raphson ─────────────────────────────────────────────────
    iterations_used = 0
    nr_result = _newton_raphson(amounts, year_fracs, guess, tolerance, max_iterations)

    if nr_result is not None:
        rate, iterations_used = nr_result
        npv_check = _npv(rate, amounts, year_fracs)
        if abs(npv_check) < tolerance * 1000:  # Loose check — NR converged
            return XirrResult(
                xirr=rate,
                npv_at_solution=npv_check,
                solver_used="newton_raphson",
                iterations=iterations_used,
                n_cash_flows=len(flows),
            )

    # ── Fallback: Brent–Dekker ─────────────────────────────────────────────────
    brent_rate = _brent_dekker(amounts, year_fracs, tolerance=tolerance)

    if brent_rate is not None:
        npv_check = _npv(brent_rate, amounts, year_fracs)
        return XirrResult(
            xirr=brent_rate,
            npv_at_solution=npv_check,
            solver_used="brent_dekker",
            iterations=iterations_used,
            n_cash_flows=len(flows),
        )

    # ── Both solvers failed ────────────────────────────────────────────────────
    raise XirrConvergenceError(
        f"XIRR failed to converge after {iterations_used} Newton-Raphson iterations "
        f"and Brent's method found no root in [{_BRENT_LOWER}, {_BRENT_UPPER}]. "
        "The service should fall back to TWR display."
    )
