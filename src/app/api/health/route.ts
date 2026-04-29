import { NextResponse } from "next/server";
import { isComposioConfigured, getConnectedAccounts, getAvailableTools } from "@/lib/composio";
import { db } from "@/lib/db";
import { PRODUCT_LIST } from "@/lib/products";

export async function GET() {
  try {
    const composioConfigured = isComposioConfigured();

    // Get connected accounts (if Composio is configured)
    let accounts: unknown[] = [];
    let accountsError: string | null = null;
    if (composioConfigured) {
      const result = await getConnectedAccounts();
      accounts = result.accounts as unknown[];
      accountsError = result.error;
    }

    // Get available tools
    let tools: unknown[] = [];
    let toolsError: string | null = null;
    if (composioConfigured) {
      const result = await getAvailableTools(["twitter", "linkedin", "devto", "reddit"]);
      tools = result.tools as unknown[];
      toolsError = result.error;
    }

    // Get recent stats (gracefully handle missing tables)
    let totalPosts = 0, successfulPosts = 0, failedPosts = 0;
    let totalPlans = 0, completedPlans = 0, draftPosts = 0;
    let autoConfig = null;
    let dbReady = true;
    let dbError: string | null = null;

    try {
      totalPosts = await db.postHistory.count();
      successfulPosts = await db.postHistory.count({ where: { status: "success" } });
      failedPosts = await db.postHistory.count({ where: { status: "failed" } });
      totalPlans = await db.marketingPlan.count();
      completedPlans = await db.marketingPlan.count({ where: { status: "completed" } });
      draftPosts = await db.contentPiece.count({ where: { postStatus: "draft" } });
      autoConfig = await db.autoPostConfig.findFirst();
    } catch (err: unknown) {
      dbReady = false;
      dbError = err instanceof Error ? err.message : String(err);
    }

    return NextResponse.json({
      success: true,
      system: {
        composioConfigured,
        products: PRODUCT_LIST.map((p) => ({ id: p.id, name: p.name })),
        connectedAccounts: {
          count: Array.isArray(accounts) ? accounts.length : 0,
          accounts: accounts,
          error: accountsError,
        },
        availableTools: {
          count: Array.isArray(tools) ? tools.length : 0,
          tools: tools,
          error: toolsError,
        },
        stats: {
          totalPosts,
          successfulPosts,
          failedPosts,
          totalPlans,
          completedPlans,
          draftPosts,
        },
        autoPost: autoConfig
          ? {
              enabled: autoConfig.enabled,
              lastRunAt: autoConfig.lastRunAt,
              lastRunStatus: autoConfig.lastRunStatus,
              lastRunMessage: autoConfig.lastRunMessage,
            }
          : null,
        database: {
          ready: dbReady,
          error: dbError,
          needsSetup: !dbReady,
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
