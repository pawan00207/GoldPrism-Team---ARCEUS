import { NextRequest, NextResponse } from "next/server";
import { getZai } from "@/lib/zai";

export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are GoldPrism Quantitative AI Agent (developed by Team ARCEUS for Hack in Hills '26: Track 03 - Commodity Derivatives Intelligence).
You assist quantitative researchers, bullion dealers, and commodity traders in analyzing MCX Gold calendar spreads, calculating fine-gold purity normalizations, running X-Ray waterfall spread decompositions, and determining the cheapest contract for a given physical gold exposure.

Your core capabilities:
1. GoldPrism Commodity Derivatives Intelligence:
   - MCX Gold Contract Master:
     * GOLDM: 100g trading unit, quoted per 10g, 995 fine purity (0.995), early expiry window (3rd-5th).
     * GOLDTEN: 10g trading unit, quoted per 10g, 999 fine purity (0.999), month-end expiry window (27th-31st).
     * GOLDGUINEA: 8g trading unit, quoted per 8g, 999 fine purity (0.999), month-end expiry window (27th-31st).
     * GOLDPETAL: 1g trading unit, quoted per 1g, 999 fine purity (0.999), month-end expiry window (27th-31st).
   - Normalization formula: price_999_per_g = (quoted_price / quote_unit_g) * (purity_fine / 999.0)
   - 5 Sources of Noise in MCX Gold Spreads: purity differences, contract size differences, expiry carry windows, settlement artifacts, and transaction costs.
   - X-Ray Waterfall Decomposition:
     Raw Spread = Structural Basis + Expiry Carry + Settlement Artifact + Gross Residual
     Net Edge = Gross Residual - Paired Round-Trip Transaction Costs
   - 4 Disciplined Verdicts:
     * TRADABLE: Net edge > cost hurdle (e.g. > 5 bps), clean data, verified contract specs.
     * WATCH: Net edge > 0 but thin (below cost hurdle).
     * NO EDGE: Residual is noise (Net edge <= 0). "The only tool that tells you when NOT to trade, and proves it."
     * BLOCKED: Untrusted settlement price, date mismatch, or data quality gate failure.
   - Best Vehicle Ranking: Evaluates exposure mismatch percentage, round-trip costs, lot granularity, and liquidity for target exposures (e.g. 8g, 10g, 50g, 100g, 500g, 1,000g).

2. General Quantitative Research & Preserved Capabilities:
   - Global market coverage: equities (US/HK/CN), crypto (BTC, ETH), indexes, risk metrics (Sharpe, Sortino, VaR, Max DD).
   - 456+ Alpha factors (Qlib158, alpha101, GTJA191, Academic, and GoldPrism Commodity Spreads).
   - Multi-agent swarm orchestration and behavioral trade journal analysis.

Response style:
- Precise, quantitative, transparent, and mathematically rigorous.
- Cite specific contract codes, grams, purity ratios, and basis points (bps).
- Never claim unverified profitability or live order routing; this is an institutional-grade research platform.
- Today is ${new Date().toDateString()}.`;

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required" },
        { status: 400 }
      );
    }

    const lastMsg = messages[messages.length - 1]?.content || "";

    // Check if external ZAI key is configured
    if (!process.env.ZAI_API_KEY) {
      // Deterministic Quantitative Assistant Response when API key is unconfigured
      const lower = lastMsg.toLowerCase();
      let responseText = "";

      if (lower.includes("x-ray") || lower.includes("waterfall") || lower.includes("spread")) {
        responseText = `### 🔍 GoldPrism X-Ray Spread Decomposition
Raw spreads between MCX Gold contracts frequently mislead retail traders. For example, a raw gap of **100.0 bps** between GOLDTEN and GOLDM decomposes into:
- **Structural Basis**: \`-48.0 bps\` (adjusting for GOLDM's 995 purity vs GOLDTEN's 999 fine purity)
- **Expiry Carry**: \`-28.0 bps\` (staggered delivery windows: GOLDM expires 3rd–5th while GOLDTEN expires 27th–31st)
- **Settlement Artifact**: \`-20.0 bps\` (thin volume settlement price anomaly)
- **Gross Residual**: \`+4.0 bps\`
- **Transaction Hurdle**: \`-5.2 bps\` (brokerage ₹60/lot round-trip + CTT 0.01% sell-side + GST + 2 bps slippage/leg)
- **Net Actionable Edge**: \`-1.2 bps\`

**Verdict: NO EDGE**  
*Capital preserved. "The only tool that tells you when NOT to trade, and proves it."*

*(Configure \`ZAI_API_KEY\` in your environment variables for continuous custom prompt generation).*`;
      } else if (lower.includes("contract") || lower.includes("spec") || lower.includes("goldm") || lower.includes("purity")) {
        responseText = `### 📋 MCX Gold Contract Master Specifications
- **GOLDM**: 100g lot, quoted per 10g, **995 purity** (0.995), expires 3rd–5th.
- **GOLDTEN**: 10g lot, quoted per 10g, **999 purity** (0.999), expires 27th–31st.
- **GOLDGUINEA**: 8g lot, quoted per 8g, **999 purity** (0.999), expires 27th–31st *(historical 996 discrepancy resolved)*.
- **GOLDPETAL**: 1g lot, quoted per 1g, **999 purity** (0.999), expires 27th–31st.

**Purity Normalization Formula:**
$$\\text{Price}_{999} = \\left(\\frac{\\text{Quoted Price}}{\\text{Quote Unit (g)}}\\right) \\times \\left(\\frac{\\text{Purity}}{999.0}\\right)$$`;
      } else if (lower.includes("vehicle") || lower.includes("best") || lower.includes("exposure") || lower.includes("hedge")) {
        responseText = `### 🏆 Best Vehicle Selection (50g Exposure Target)
When hedging a **50g physical gold exposure**:
1. **GOLDTEN** (Rank #1): 5 lots = exactly 50g (**0.0% mismatch**). Lowest net friction, tightest hedge tracking.
2. **GOLDPETAL** (Rank #2): 50 lots = 50g (0.0% mismatch), but higher aggregate brokerage per lot.
3. **GOLDGUINEA** (Rank #3): 6 lots = 48g (4.0% mismatch) or 7 lots = 56g.
4. **GOLDM** (Rank #4): 1 lot = 100g (**100.0% mismatch** penalty due to indivisible contract size).`;
      } else {
        responseText = `### ⚡ GoldPrism Quantitative Research Engine
I am the GoldPrism intelligence agent grounded in the Team ARCEUS quantitative framework:
- **X-Ray Waterfall**: Purges basis, carry, and artifacts to isolate true net edge.
- **MCX Bhavcopy Ingestion**: Auditable pipeline with SHA-256 hashes and date-match gates.
- **Four-State Verdict**: \`TRADABLE\`, \`WATCH\`, \`NO EDGE\`, and \`BLOCKED\`.
- **Best-Vehicle Ranking**: Cost & mismatch optimization across GOLDM, GOLDTEN, GOLDGUINEA, and GOLDPETAL.

*Note: Real-time cloud LLM reasoning can be activated by adding \`ZAI_API_KEY\` to \`.env.local\`.*`;
      }

      return NextResponse.json({
        content: responseText,
        usage: null,
      });
    }

    const zai = await getZai();

    const completion = await zai.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...messages.map(
          (m: { role: "system" | "user" | "assistant"; content: string }) => ({
            role: m.role,
            content: m.content,
          })
        ),
      ],
      temperature: 0.6,
      max_tokens: 1200,
      thinking: { type: "disabled" },
    });

    const content =
      completion.choices?.[0]?.message?.content ??
      "I couldn't generate a response. Please try again.";

    return NextResponse.json({
      content,
      usage: completion.usage ?? null,
    });
  } catch (err) {
    console.error("Agent API error:", err);
    return NextResponse.json(
      {
        error: "Failed to reach the agent. Please configure ZAI_API_KEY or retry.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
