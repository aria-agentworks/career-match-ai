import { NextResponse } from "next/server";
import { getPipelineSummary } from "@/lib/orchestrator";

// GET /api/automations/orchestrator/summary
// Pipeline summary for dashboard
export async function GET() {
  try {
    const summary = await getPipelineSummary();
    return NextResponse.json({ success: true, ...summary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
