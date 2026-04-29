import { NextRequest, NextResponse } from "next/server";
import { executeStep } from "@/lib/executor";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stepId } = body;

    if (!stepId) {
      return NextResponse.json({ error: "stepId is required" }, { status: 400 });
    }

    const step = await db.planStep.findUnique({
      where: { id: stepId },
    });

    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 });
    }

    await db.planStep.update({
      where: { id: stepId },
      data: { status: "running" },
    });

    const result = await executeStep(step);

    return NextResponse.json({
      success: result.success,
      stepId: result.stepId,
      postedUrl: result.postedUrl,
      error: result.error,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
