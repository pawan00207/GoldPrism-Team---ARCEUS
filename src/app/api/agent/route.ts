import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

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
*Capital preserved. "The only tool that tells you when NOT to trade, and proves it."*`;
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
- **Best-Vehicle Ranking**: Cost & mismatch optimization across GOLDM, GOLDTEN, GOLDGUINEA, and GOLDPETAL.`;
    }

    return NextResponse.json({
      content: responseText,
      usage: null,
    });
  } catch (err) {
    console.error("Agent API error:", err);
    return NextResponse.json(
      {
        error: "Failed to process agent request.",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}
