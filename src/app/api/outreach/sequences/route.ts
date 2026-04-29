import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const sequences = await db.emailSequence.findMany({ take: 50 });

    // Parse steps JSON for each sequence
    const enriched = sequences.map((seq) => {
      let parsedSteps: Array<{ stepNumber: number; subject: string; body: string; waitDays: number }> = [];
      try {
        parsedSteps = JSON.parse(seq.steps || "[]");
      } catch {
        // ignore
      }
      return {
        ...seq,
        steps: parsedSteps,
      };
    });

    return NextResponse.json({ success: true, sequences: enriched });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
