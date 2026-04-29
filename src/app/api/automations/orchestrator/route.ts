import { NextResponse } from "next/server";
import { runOrchestrator } from "@/lib/orchestrator";

// GET /api/automations/orchestrator?product=All&phase=all
// The master autonomous loop — call via cron-job.org every 6 hours
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get("product") || "All";
    const phase = searchParams.get("phase") || "all";

    const products = product === "All" ? undefined : [product];
    const phases = phase === "all" ? undefined : [phase];

    const result = await runOrchestrator({ products, phases });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST /api/automations/orchestrator
// Manual trigger with options
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { product, products, phase, phases, discoverLimit } = body;

    // Handle both singular and plural, both string and array
    const parsedProducts = Array.isArray(products)
      ? products
      : product === "All" || !product
        ? undefined
        : [product];
    const parsedPhases = Array.isArray(phases)
      ? phases
      : phase === "all" || !phase
        ? undefined
        : [phase];

    const result = await runOrchestrator({
      products: parsedProducts,
      phases: parsedPhases,
      discoverLimit: discoverLimit || 20,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
