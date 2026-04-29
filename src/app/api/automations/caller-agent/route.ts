// src/app/api/automations/caller-agent/route.ts
// POST — Trigger the caller agent (process queue)
// GET  — Get call queue status

import { NextRequest, NextResponse } from "next/server";
import { processCallQueue, getCallQueue, reportCallOutcome } from "@/lib/caller-agent";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, leadId, outcome, notes, callDuration } = body;

    // ===== Action: report outcome =====
    if (action === "report_outcome") {
      if (!leadId) {
        return NextResponse.json(
          { success: false, error: "leadId is required for report_outcome action" },
          { status: 400 },
        );
      }
      if (!outcome) {
        return NextResponse.json(
          { success: false, error: "outcome is required for report_outcome action" },
          { status: 400 },
        );
      }

      const result = await reportCallOutcome(leadId, outcome, notes, callDuration);

      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 },
        );
      }

      return NextResponse.json({
        success: true,
        message: `Call outcome recorded: ${outcome}`,
        leadId,
        outcome,
      });
    }

    // ===== Action: process queue (default) =====
    const result = await processCallQueue();

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[CallerAgent API] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId") || undefined;

    const queue = await getCallQueue(productId);

    // Compute summary
    const summary = {
      total: queue.length,
      pending: queue.filter((l) => l.status === "pending").length,
      scriptReady: queue.filter((l) => l.status === "script_ready").length,
      callPending: queue.filter((l) => l.status === "call_pending").length,
      completed: queue.filter((l) => l.status === "call_completed").length,
      failed: queue.filter((l) => l.status === "call_failed").length,
      byProduct: {} as Record<string, number>,
    };

    for (const lead of queue) {
      summary.byProduct[lead.product] = (summary.byProduct[lead.product] || 0) + 1;
    }

    return NextResponse.json({
      success: true,
      summary,
      leads: queue,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[CallerAgent API] GET Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
