"""
LLM Adapter
===========

Thin async wrapper around any OpenAI-compatible chat completion API.
Reads configuration from environment variables:

    COPILOT_LLM_API_KEY   — API key. When not set, falls back to rule-based response.
    COPILOT_LLM_BASE_URL  — Base URL of the OpenAI-compatible endpoint.
                            Default: https://generativelanguage.googleapis.com/v1beta/openai
    COPILOT_LLM_MODEL     — Model identifier. Default: gemini-1.5-flash

Fallback behaviour
------------------
When COPILOT_LLM_API_KEY is absent (e.g. local dev, CI), the adapter returns a
deterministic rule-based response derived entirely from the system prompt content.
This guarantees:
  - Zero external network calls during unit tests
  - No API key required to run or test the service locally
  - Responses remain mathematically accurate (numbers are extracted from the prompt)
"""

from __future__ import annotations

import logging
import os
import re

import httpx

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

_DEFAULT_BASE_URL = (
    "https://generativelanguage.googleapis.com/v1beta/openai"
)
_DEFAULT_MODEL = "gemini-1.5-flash"
_REQUEST_TIMEOUT_S = 20.0
_RULE_BASED_MODEL_NAME = "rule-based-fallback"


class LLMAdapter:
    """
    Async LLM adapter for OpenAI-compatible chat completion APIs.

    Usage:
        adapter = LLMAdapter()
        response_text = await adapter.chat(messages, system_prompt, user_message)
    """

    def __init__(self) -> None:
        self.api_key: str | None = os.environ.get("COPILOT_LLM_API_KEY") or None
        self.base_url: str = os.environ.get(
            "COPILOT_LLM_BASE_URL", _DEFAULT_BASE_URL
        ).rstrip("/")
        self.model: str = os.environ.get("COPILOT_LLM_MODEL", _DEFAULT_MODEL)

        if self.api_key:
            logger.info("LLMAdapter: using model=%s base_url=%s", self.model, self.base_url)
        else:
            logger.warning(
                "LLMAdapter: COPILOT_LLM_API_KEY not set — using rule-based fallback. "
                "Set the env var to enable live LLM responses."
            )

    @property
    def model_name(self) -> str:
        """Returns the active model identifier for inclusion in responses."""
        return self.model if self.api_key else _RULE_BASED_MODEL_NAME

    async def chat(
        self,
        messages: list[dict],
        system_prompt: str,
        user_message: str,
    ) -> str:
        """
        Send a chat completion request and return the assistant's response text.

        Falls back to rule-based response when API key is not configured.

        Args:
            messages:      Full OpenAI-format messages array (system + history + user).
            system_prompt: The grounded system prompt (used for rule-based fallback).
            user_message:  The current user query (used for rule-based fallback routing).

        Returns:
            The assistant's response as a plain string.

        Raises:
            RuntimeError: If the LLM API returns an unexpected error after retries.
        """
        if not self.api_key:
            return self._rule_based_response(system_prompt, user_message)

        return await self._call_llm_api(messages)

    async def _call_llm_api(self, messages: list[dict]) -> str:
        """Call the OpenAI-compatible /chat/completions endpoint."""
        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": 1024,
            "temperature": 0.1,  # Low temperature → more deterministic, fewer hallucinations
        }

        async with httpx.AsyncClient(timeout=_REQUEST_TIMEOUT_S) as client:
            for attempt in range(1, 4):  # Up to 3 attempts
                try:
                    resp = await client.post(url, json=payload, headers=headers)

                    if resp.status_code in (429, 503):
                        wait = 2 ** attempt
                        logger.warning(
                            "LLM API rate-limited (status=%d), retry %d/3 in %ds",
                            resp.status_code,
                            attempt,
                            wait,
                        )
                        import asyncio
                        await asyncio.sleep(wait)
                        continue

                    resp.raise_for_status()
                    data = resp.json()
                    content: str = data["choices"][0]["message"]["content"]
                    logger.info(
                        "LLM response received: model=%s tokens=%s",
                        self.model,
                        data.get("usage", {}).get("total_tokens", "unknown"),
                    )
                    return content.strip()

                except httpx.TimeoutException:
                    logger.error(
                        "LLM API timed out after %.1fs (attempt %d/3)",
                        _REQUEST_TIMEOUT_S,
                        attempt,
                    )
                    if attempt == 3:
                        raise RuntimeError(
                            "LLM API timed out after 3 attempts. "
                            "Please retry or check COPILOT_LLM_BASE_URL."
                        )

        raise RuntimeError("LLM API failed after 3 attempts.")  # unreachable sentinel

    def _rule_based_response(self, system_prompt: str, user_message: str) -> str:
        """
        Deterministic keyword-routing fallback used when no API key is set.

        Extracts exact metric values from the system_prompt text (which contains
        the verbatim portfolio summary) and returns precise, grounded answers.
        All returned numbers are parsed from the system prompt, not invented.
        """
        q = user_message.lower()

        # ── Risk metric queries ────────────────────────────────────────────────
        if any(kw in q for kw in ("sharpe", "risk-adjusted", "risk adjusted")):
            return self._extract_metric_response(
                system_prompt,
                r"Sharpe Ratio\s*:\s*([+-]?\d+\.?\d*)",
                "Sharpe Ratio",
                "sharpe_ratio",
            )

        if any(kw in q for kw in ("sortino",)):
            return self._extract_metric_response(
                system_prompt,
                r"Sortino Ratio\s*:\s*([+-]?\d+\.?\d*)",
                "Sortino Ratio",
                "sortino_ratio",
            )

        if any(kw in q for kw in ("beta", "market risk", "systematic")):
            return self._extract_metric_response(
                system_prompt,
                r"Beta \(vs benchmark\)\s*:\s*([+-]?\d+\.?\d*|N/A[^\n]*)",
                "Beta",
                "beta",
            )

        if any(kw in q for kw in ("drawdown", "worst", "loss", "peak")):
            return self._extract_metric_response(
                system_prompt,
                r"Max Drawdown\s*:\s*([+-]?\d+\.?\d*%)",
                "Maximum Drawdown",
                "max_drawdown_pct",
            )

        if any(kw in q for kw in ("volatility", "volatile", "vol")):
            return self._extract_metric_response(
                system_prompt,
                r"Annual Volatility\s*:\s*([+-]?\d+\.?\d*%)",
                "Annual Volatility",
                "annual_volatility_pct",
            )

        if any(kw in q for kw in ("hhi", "concentration", "concentrated", "diversif")):
            return self._extract_metric_response(
                system_prompt,
                r"HHI Concentration\s*:\s*([\d.]+ \([^)]+\))",
                "HHI Concentration Score",
                "hhi",
            )

        # ── Holdings / net worth queries ───────────────────────────────────────
        if any(kw in q for kw in ("net worth", "total value", "portfolio value", "worth")):
            return self._extract_metric_response(
                system_prompt,
                r"Portfolio Net Worth\s*:\s*(₹[\d.,]+ (?:Cr|L|[\d,]+))",
                "Total Portfolio Net Worth",
                "total_net_worth_inr",
            )

        if any(kw in q for kw in ("holdings", "positions", "stocks", "assets", "portfolio")):
            # Extract Top Holdings section
            match = re.search(r"Top Holdings:\n((?:  .+\n?)+)", system_prompt)
            if match:
                holdings_text = match.group(1).strip()
                return (
                    "Here are your top holdings by market value:\n\n"
                    f"{holdings_text}\n\n"
                    "Use the Holdings section of your dashboard for the full list."
                )
            return "Your portfolio holdings data is available in your dashboard."

        # ── Allocation / rebalancing queries ───────────────────────────────────
        if any(kw in q for kw in ("allocation", "breakdown", "breakdown", "sector")):
            match = re.search(
                r"Asset Allocation \(Current\):\n((?:  .+\n?)+)", system_prompt
            )
            if match:
                alloc_text = match.group(1).strip()
                return (
                    "Your current asset allocation:\n\n"
                    f"{alloc_text}\n\n"
                    "Compare this with your target allocation using the Drift section above."
                )
            return "Asset allocation data is available in your portfolio dashboard."

        if any(kw in q for kw in ("rebalance", "drift", "target", "over", "under")):
            match = re.search(
                r"DETECTED DRIFT & ALERTS.*?\n((?:  .+\n?)+)", system_prompt, re.DOTALL
            )
            if match:
                drift_text = match.group(1).strip()
                if "No significant" in drift_text:
                    return (
                        "✅ Your portfolio is currently within 5 percentage points of "
                        "your target allocation across all asset classes. "
                        "No rebalancing action is required at this time."
                    )
                return (
                    "Based on your portfolio data, here are the detected rebalancing signals:\n\n"
                    f"{drift_text}\n\n"
                    "Review these carefully before taking any action. All amounts are "
                    "approximate and based on your current portfolio snapshot."
                )
            return (
                "Set a target allocation in your portfolio settings to enable "
                "automated drift detection and rebalancing suggestions."
            )

        # ── Generic fallback ───────────────────────────────────────────────────
        net_worth_match = re.search(
            r"Portfolio Net Worth\s*:\s*(₹[\d.,]+ (?:Cr|L))", system_prompt
        )
        net_worth = net_worth_match.group(1) if net_worth_match else "your portfolio"

        sharpe_match = re.search(
            r"Sharpe Ratio\s*:\s*([+-]?\d+\.?\d*)", system_prompt
        )
        sharpe = f"Sharpe Ratio: {sharpe_match.group(1)}" if sharpe_match else ""

        return (
            f"Your portfolio is valued at {net_worth}. "
            f"{'Risk profile — ' + sharpe + '. ' if sharpe else ''}"
            "For specific analysis, ask about your holdings, asset allocation, "
            "risk metrics (Sharpe, Beta, Drawdown), or rebalancing suggestions."
        )

    @staticmethod
    def _extract_metric_response(
        system_prompt: str,
        pattern: str,
        metric_name: str,
        field_name: str,
    ) -> str:
        """
        Extract a specific metric value from the system prompt using a regex pattern
        and return a formatted answer string.
        """
        match = re.search(pattern, system_prompt, re.IGNORECASE)
        if match:
            value = match.group(1).strip()
            return f"Your **{metric_name}** is **{value}**."
        return (
            f"The {metric_name} ({field_name}) is not available in your current "
            "portfolio snapshot. Ensure the Quant Engine has sufficient return "
            "history to compute this metric."
        )
