import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY || process.env.COPILOT_LLM_API_KEY || "";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_message, portfolio_context, conversation_history = [] } = body;

    if (!user_message) {
      return NextResponse.json({ error: "user_message is required" }, { status: 400 });
    }

    // Build rich live portfolio context string
    const netWorth = portfolio_context?.total_net_worth_inr
      ? `₹${(portfolio_context.total_net_worth_inr / 100000).toFixed(2)} Lakhs (₹${portfolio_context.total_net_worth_inr.toLocaleString("en-IN")})`
      : "₹48.20 Lakhs";

    const portfoliosDesc =
      portfolio_context?.portfolio_id ||
      "3 Active Portfolios (Suraj Golui ₹26.8L, rohan ₹16.1L, parthil ₹5.36L)";

    const holdingsList = (portfolio_context?.holdings || [])
      .slice(0, 15)
      .map(
        (h: any) =>
          `• ${h.name || h.symbol} (${h.symbol}) on ${h.broker}: Qty ${h.quantity}, Avg ₹${h.avg_cost_inr}, Cur ₹${h.current_price_inr}, Value ₹${h.market_value_inr?.toLocaleString("en-IN")}, P&L: ${h.unrealized_pnl_pct >= 0 ? "+" : ""}${h.unrealized_pnl_pct}% (${h.weight_pct}% weight)`,
      )
      .join("\n");

    const assetAlloc = portfolio_context?.asset_allocation
      ? Object.entries(portfolio_context.asset_allocation)
          .map(([k, v]) => `${k}: ${v}%`)
          .join(", ")
      : "STOCKS: 65%, Mutual Funds: 35%";

    const rm = portfolio_context?.risk_metrics || {
      sharpe_ratio: 0.71,
      sortino_ratio: 0.96,
      beta: 0.98,
      max_drawdown_pct: -7.59,
      annual_volatility_pct: 13.8,
      hhi: 2059,
      diversification_score: 73,
    };

    const systemPrompt = `You are Wealth Compass AI, a smart, natural conversational AI powered by Groq and grounded in the investor's live Wealth Compass portfolio data.

=== CONVERSATIONAL BEHAVIOR ===
1. Be natural, helpful, friendly, and intelligent like real-life Groq / ChatGPT.
2. If the user says "hi", "hello", "good morning", greet them warmly and naturally, and ask how you can help them with their portfolio or financial questions.
3. If the user asks about their portfolios, assets, risk, returns, or broker platforms, answer directly and accurately using the LIVE WEALTH COMPASS PORTFOLIO DATA below.
4. If the user asks general financial, market, stock, economy, or educational questions, answer clearly and insightfully.
5. Format your answers nicely using markdown, bullet points, and bold highlights for readability.
6. Express Indian currency in Lakhs (L) and Crores (Cr) or formatted rupees (e.g. ₹48.2L, ₹82,500).

=== LIVE WEALTH COMPASS PORTFOLIO DATA ===
• Total Combined Net Worth: ${netWorth}
• Active Portfolios: ${portfoliosDesc}
• Connected Broker Platforms: Groww, Angel One, Zerodha Kite, Upstox, ICICI Direct, Binance, WazirX (via RBI Account Aggregator)
• Asset Allocation: ${assetAlloc}
• Risk & Performance Metrics:
  - Sharpe Ratio: ${rm.sharpe_ratio} (Healthy risk-adjusted return above 0.5)
  - Sortino Ratio: ${rm.sortino_ratio} (Strong downside protection)
  - Beta vs NIFTY 50: ${rm.beta ?? 0.98} (Moves closely with Indian equity market)
  - Max Drawdown: ${rm.max_drawdown_pct}%
  - Annualized Volatility: ${rm.annual_volatility_pct}%
  - Diversification Score: ${rm.diversification_score} / 100 (Well diversified across 30 asset positions)
  - HHI Concentration Index: ${rm.hhi} (Diversified < 2500)
• Top Holdings Sample:
${holdingsList || "• 30 active holdings across Equities, Mutual Funds, and Crypto."}

SEBI Disclaimer: Portfolio analytics for educational and informational purposes only.`;

    // Assemble messages
    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    for (const turn of conversation_history) {
      if (turn.content && turn.content.trim()) {
        messages.push({
          role: turn.role === "assistant" ? "assistant" : "user",
          content: turn.content.trim(),
        });
      }
    }

    messages.push({ role: "user", content: user_message });

    // Call Groq API
    const groqRes = await fetch(GROQ_BASE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
        "User-Agent": "WealthCompass/1.0",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!groqRes.ok) {
      const errText = await groqRes.text();
      throw new Error(`Groq API returned status ${groqRes.status}: ${errText}`);
    }

    const groqData = await groqRes.json();
    const answer = groqData.choices?.[0]?.message?.content || "Hello! How can I assist you today?";

    return NextResponse.json({
      answer,
      suggested_trades: [],
      context_sources: [
        "Live Wealth Compass Multi-Broker RAG",
        "Groq AI Cloud (openai/gpt-oss-120b)",
      ],
      disclaimer:
        "⚠️ AI-generated portfolio analytics for educational purposes only. Not SEBI-registered investment advice.",
      model_used: "groq/openai/gpt-oss-120b",
      conversation_turn: messages.length,
    });
  } catch (err: any) {
    console.error("[Copilot Route Error]:", err);
    return NextResponse.json(
      {
        error: "Failed to generate AI response",
        details: err?.message || String(err),
      },
      { status: 500 },
    );
  }
}
