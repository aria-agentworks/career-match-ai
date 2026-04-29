import { NextRequest, NextResponse } from "next/server";
import { runMoneyPrinter, quickTest } from "@/lib/moneyprinter";

// POST /api/automations/moneyprinter
// THE MONEY PRINTER — Revenue-first autonomous outreach
// Trigger manually or via cron

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch { /* empty body is fine */ }

    const products = body.products as string[] | undefined;
    const skipPurge = body.skipPurge as boolean | undefined;
    const quickMode = body.quick as boolean | undefined;

    console.log(`[MoneyPrinter] 🚀 Starting revenue engine...`);

    if (quickMode) {
      // Quick test: one product, fast
      const testProduct = (products?.[0]) || "NaiveVoiceAgent";
      const result = await quickTest(testProduct);
      return NextResponse.json({ success: true, ...result });
    }

    const result = await runMoneyPrinter({
      products,
      skipPurge,
    });

    console.log(`[MoneyPrinter] ✅ Done: ${result.discovered} discovered, ${result.enriched} enriched, ${result.emailed} emailed, ${result.purged} purged`);

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[MoneyPrinter] Fatal error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET /api/automations/moneyprinter — status check
export async function GET() {
  return NextResponse.json({
    status: "ready",
    engine: "moneyprinter-v2",
    description: "Revenue-first autonomous outreach engine",
    trigger: "POST with {products: [...], quick: true} to run",
  });
}
