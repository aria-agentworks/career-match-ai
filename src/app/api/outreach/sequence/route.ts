import { NextRequest, NextResponse } from "next/server";
import { generateSequence } from "@/lib/brain";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { product, goal, stepCount } = body as {
      product: string;
      goal: string;
      stepCount?: number;
    };

    if (!product || !goal) {
      return NextResponse.json(
        { success: false, error: "product and goal are required" },
        { status: 400 }
      );
    }

    // Generate the sequence with AI
    const sequence = await generateSequence(product, goal, stepCount || 4);

    // Save to database
    const created = await db.emailSequence.create({
      data: {
        name: sequence.name,
        description: sequence.description,
        product,
        steps: JSON.stringify(sequence.steps),
        intervalDays: sequence.steps[0]?.waitDays || 3,
        isActive: true,
        totalSent: 0,
        totalReplies: 0,
        totalConversions: 0,
      },
    });

    return NextResponse.json({
      success: true,
      sequence: {
        id: created.id,
        name: created.name,
        description: created.description,
        product: created.product,
        steps: sequence.steps,
        intervalDays: created.intervalDays,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
