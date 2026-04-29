import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const plans = await db.marketingPlan.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { steps: true },
    });

    return NextResponse.json({
      success: true,
      plans: plans.map(p => ({
        ...p,
        steps: (p.steps || []).map(s => ({
          ...s,
          order: s.stepOrder,
        })),
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
