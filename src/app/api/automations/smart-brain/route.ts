import { NextRequest, NextResponse } from "next/server";
import { runSmartBrain } from "@/lib/smart-brain";

// POST /api/automations/smart-brain
// NVIDIA-powered intelligence engine — discover, research, score, email
// The Corain pipeline: Expand → Discover → Research → Fusion Score → Personalize → Send

// Vercel: allow up to 300s for NVIDIA LLM pipeline
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await request.json();
    } catch { /* empty body ok */ }

    const product = body.product as string | undefined;

    if (!product) {
      return NextResponse.json({
        success: false,
        error: "Specify a product. Available: NaiveVoiceAgent, NaiveLandingPage, SparkBill, AriaAgent, SalesIntelligenceMCP, SaaSAuditScanner, DateWise",
      }, { status: 400 });
    }

    console.log(`[SmartBrain] Running NVIDIA intelligence for: ${product}`);
    const result = await runSmartBrain(product);

    console.log(`[SmartBrain] Done: ${result.leadsDiscovered} discovered, ${result.leadsResearched} researched, ${result.leadsEmailed} emailed`);

    return NextResponse.json({ success: true, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[SmartBrain] Fatal:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "ready",
    engine: "nvidia-smart-brain",
    pipeline: "Expand → Discover → Research → Score → Personalize → Send",
    nvidiaModels: {
      embeddings: "nvidia/nv-embed-v1 (4096-dim)",
      llm: "meta/llama-3.1-405b-instruct",
    },
    trigger: "POST with {product: 'NaiveVoiceAgent'} to run",
  });
}
