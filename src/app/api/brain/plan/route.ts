import { NextRequest, NextResponse } from "next/server";
import { generatePlan } from "@/lib/brain";
import { db } from "@/lib/db";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { goal, products, platforms } = body;

    if (!goal || typeof goal !== "string") {
      return NextResponse.json({ error: "Goal is required" }, { status: 400 });
    }

    const selectedProducts = Array.isArray(products) && products.length > 0
      ? products
      : ["AriaAgent"];

    const selectedPlatforms = Array.isArray(platforms) && platforms.length > 0
      ? platforms
      : ["twitter", "linkedin"];

    const validProducts = ["AriaAgent", "SalesIntelligenceMCP", "SaaSAuditScanner", "DateWise", "SparkBill", "NaiveVoiceAgent", "NaiveLandingPage"];
    const filteredProducts = selectedProducts.filter((p: string) => validProducts.includes(p));
    if (filteredProducts.length === 0) {
      return NextResponse.json({ error: "No valid products selected" }, { status: 400 });
    }

    const plan = await generatePlan(goal, filteredProducts, selectedPlatforms);

    // Create the plan with steps using our Supabase-compatible db wrapper
    const savedPlan = await db.marketingPlan.create({
      data: {
        name: plan.plan_name,
        goal: plan.goal,
        status: "draft",
        rawResponse: JSON.stringify(plan),
        steps: plan.steps.map((step) => ({
          stepOrder: step.order,
          actionSlug: step.action_slug,
          platform: step.platform,
          product: step.product,
          topic: step.topic,
          params: JSON.stringify(step.params),
          status: "pending",
        })),
      },
      include: { steps: true },
    });

    return NextResponse.json({
      success: true,
      plan: {
        id: savedPlan.id,
        name: savedPlan.name,
        goal: savedPlan.goal,
        status: savedPlan.status,
        steps: (savedPlan.steps || []).map((s) => ({
          id: s.id,
          order: s.stepOrder,
          actionSlug: s.actionSlug,
          platform: s.platform,
          product: s.product,
          topic: s.topic,
          status: s.status,
        })),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const cause = error instanceof Error && error.cause ? String(error.cause) : undefined;
    console.error("[brain/plan] Error:", message, cause || "");
    return NextResponse.json({ error: message, cause, debug: { backend: {
      hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
      hasNvidia: !!process.env.NVIDIA_API_KEY,
      hasWithoneAI: !!process.env.WITHONE_AI_API_KEY,
    }}}, { status: 500 });
  }
}
