import { db, type PlanStepRow } from "@/lib/db";
import { executeTool } from "@/lib/composio";
import { generateContent } from "@/lib/brain";

interface ExecutionResult {
  stepId: string;
  success: boolean;
  error?: string;
  postedUrl?: string;
  externalId?: string;
}

// Execute a single plan step
export async function executeStep(step: PlanStepRow): Promise<ExecutionResult> {
  let params: Record<string, unknown>;

  try {
    params = JSON.parse(step.params);
  } catch {
    return {
      stepId: step.id,
      success: false,
      error: "Failed to parse step params",
    };
  }

  // Check if content needs to be generated first
  const needsContentGeneration = !params.text && !params.body_markdown && !params.body && !params.tweets;

  let toolParams = { ...params };

  if (needsContentGeneration) {
    try {
      const generated = await generateContent(step.platform, step.product, step.topic);

      switch (step.actionSlug) {
        case "TWITTER_CREATE_TWEET":
          toolParams.text = generated.body;
          break;
        case "TWITTER_CREATE_THREAD":
          toolParams.tweets = JSON.parse(generated.body);
          break;
        case "LINKEDIN_CREATE_POST":
          toolParams.text = generated.body;
          break;
        case "DEVTO_CREATE_ARTICLE":
          toolParams.title = generated.title || step.topic;
          toolParams.body_markdown = generated.body;
          toolParams.tags = generated.tags || ["ai", "tools"];
          break;
        case "REDDIT_CREATE_POST":
          toolParams.title = generated.title || step.topic;
          toolParams.body = generated.body;
          break;
        case "SLACK_SEND_MESSAGE":
          toolParams.text = generated.body;
          break;
        default:
          toolParams.text = generated.body;
      }

      // Update the step params with generated content
      await db.planStep.update({
        where: { id: step.id },
        data: { params: JSON.stringify(toolParams) },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        stepId: step.id,
        success: false,
        error: `Content generation failed: ${message}`,
      };
    }
  }

  // Save content as draft before posting
  try {
    const title = (toolParams.title as string) || step.topic;
    const body = (toolParams.text as string) || (toolParams.body_markdown as string) || (toolParams.body as string) || "";

    await db.contentPiece.create({
      data: {
        platform: step.platform,
        product: step.product,
        topic: step.topic,
        title: title !== step.topic ? title : undefined,
        body,
        postStatus: "posting",
        planStepId: step.id,
      },
    });
  } catch {
    // Non-critical: continue even if draft saving fails
  }

  // Execute the tool via Composio
  const result = await executeTool(step.actionSlug, toolParams);

  if (result.success) {
    await db.planStep.update({
      where: { id: step.id },
      data: {
        status: "success",
        resultData: JSON.stringify(result.data),
      },
    });

    // Update content piece status
    const contentPiece = await db.contentPiece.findFirst({
      where: { planStepId: step.id },
    });
    if (contentPiece) {
      await db.contentPiece.update({
        where: { id: contentPiece.id },
        data: {
          postStatus: "posted",
          postedAt: new Date().toISOString(),
          postedUrl: result.postedUrl || null,
          externalId: result.externalId || null,
        },
      });
    }

    // Save to post history
    const title = (toolParams.title as string) || undefined;
    const body = (toolParams.text as string) || (toolParams.body_markdown as string) || (toolParams.body as string) || "";

    await db.postHistory.create({
      data: {
        platform: step.platform,
        product: step.product,
        actionSlug: step.actionSlug,
        title,
        body,
        postedUrl: result.postedUrl || null,
        externalId: result.externalId || null,
        status: "success",
        triggerType: "plan",
      },
    });

    return {
      stepId: step.id,
      success: true,
      postedUrl: result.postedUrl,
      externalId: result.externalId,
    };
  } else {
    await db.planStep.update({
      where: { id: step.id },
      data: {
        status: "failed",
        errorMessage: result.error || "Unknown error",
      },
    });

    const contentPiece = await db.contentPiece.findFirst({
      where: { planStepId: step.id },
    });
    if (contentPiece) {
      await db.contentPiece.update({
        where: { id: contentPiece.id },
        data: {
          postStatus: "failed",
          errorMessage: result.error || "Unknown error",
        },
      });
    }

    return {
      stepId: step.id,
      success: false,
      error: result.error,
    };
  }
}

// Execute an entire plan — runs all pending steps sequentially
export async function executePlan(planId: string): Promise<{
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: ExecutionResult[];
}> {
  await db.marketingPlan.update({
    where: { id: planId },
    data: { status: "running" },
  });

  const steps = await db.planStep.findMany({
    where: { planId },
    orderBy: { stepOrder: "asc" },
  });

  const results: ExecutionResult[] = [];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;

  for (const step of steps) {
    if (step.status === "success" || step.status === "skipped") {
      skipped++;
      continue;
    }

    await db.planStep.update({
      where: { id: step.id },
      data: { status: "running" },
    });

    try {
      const result = await executeStep(step);
      results.push(result);

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      failed++;
      results.push({
        stepId: step.id,
        success: false,
        error: `Unexpected error: ${message}`,
      });

      await db.planStep.update({
        where: { id: step.id },
        data: { status: "failed", errorMessage: message },
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const allSucceeded = failed === 0;
  const someSucceeded = succeeded > 0;

  await db.marketingPlan.update({
    where: { id: planId },
    data: {
      status: allSucceeded ? "completed" : someSucceeded ? "completed" : "failed",
    },
  });

  return {
    total: steps.length,
    succeeded,
    failed,
    skipped,
    results,
  };
}
