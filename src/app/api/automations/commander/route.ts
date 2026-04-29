import { NextRequest, NextResponse } from "next/server";
import { runCommander, commanderStatus } from "@/lib/revenue-commander";

// POST /api/automations/commander
// THE REVENUE COMMANDER — Oversight agent that runs the entire system
// Trigger via cron (every 6 hours) or manually

// Vercel: allow up to 300s for heavy LLM pipeline
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    console.log("[Commander API] Revenue Commander activated...");

    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch { /* empty body is fine */ }

    const statusOnly = body.status as boolean | undefined;

    if (statusOnly) {
      // Status check only — observe and diagnose, don't act
      const status = await commanderStatus();
      return NextResponse.json({ success: true, ...status });
    }

    // Full commander run: observe → diagnose → decide → execute
    const report = await runCommander();

    return NextResponse.json({ success: true, ...report });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Commander API] Fatal error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET /api/automations/commander — quick status
export async function GET() {
  try {
    const status = await commanderStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
