import { Composio } from "@composio/core";

let composioInstance: Composio | null = null;

function getComposio(): Composio | null {
  const apiKey = process.env.COMPOSIO_API_KEY;
  if (!apiKey) {
    return null;
  }

  if (!composioInstance) {
    composioInstance = new Composio({ apiKey });
  }

  return composioInstance;
}

export function isComposioConfigured(): boolean {
  return !!process.env.COMPOSIO_API_KEY;
}

const COMPOSIO_USER_ID = "aria_marketing_hub";

function isSimulateMode(): boolean {
  return process.env.SIMULATE_DELIVERY === "true";
}

// Generate a fake but realistic-looking post URL for simulation
function simulatePostedUrl(actionSlug: string): string {
  const now = Date.now();
  switch (actionSlug) {
    case "TWITTER_CREATE_TWEET":
    case "TWITTER_CREATE_THREAD":
      return `https://x.com/ariaagent/status/${now}`;
    case "LINKEDIN_CREATE_POST":
      return `https://linkedin.com/posts/ariaagent-${now}`;
    case "DEVTO_CREATE_ARTICLE":
      return `https://dev.to/ariaagent/article-${now}`;
    case "REDDIT_CREATE_POST":
      return `https://reddit.com/r/ai/comments/${now}`;
    case "SLACK_SEND_MESSAGE":
      return `slack://message/${now}`;
    default:
      return `https://example.com/post/${now}`;
  }
}

// Execute a Composio tool action — with simulation fallback
export async function executeTool(
  actionSlug: string,
  params: Record<string, unknown>
): Promise<{
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  postedUrl?: string;
  externalId?: string;
}> {
  const composio = getComposio();

  // If Composio is not configured at all, use simulation mode
  if (!composio) {
    if (isSimulateMode()) {
      console.log(`[Composio] Not configured — simulating ${actionSlug}`);
      const fakeUrl = simulatePostedUrl(actionSlug);
      return {
        success: true,
        data: { simulated: true, action: actionSlug },
        postedUrl: fakeUrl,
        externalId: `sim_${Date.now()}`,
      };
    }
    return {
      success: false,
      error: "Composio API key not configured. Add COMPOSIO_API_KEY to your environment variables.",
    };
  }

  try {
    const result = await composio.tools.execute(actionSlug, {
      userId: COMPOSIO_USER_ID,
      arguments: params,
    });

    if (result.successful) {
      const data = result.data as Record<string, unknown> | undefined;
      let postedUrl: string | undefined;
      let externalId: string | undefined;

      if (data) {
        postedUrl =
          (data.url as string) ||
          (data.permalink as string) ||
          (data.link as string) ||
          (data.postUrl as string) ||
          (data.tweetUrl as string) ||
          undefined;

        externalId =
          (data.id as string) ||
          (data.postId as string) ||
          (data.tweetId as string) ||
          (data.articleId as string) ||
          undefined;
      }

      return {
        success: true,
        data: data || {},
        postedUrl,
        externalId,
      };
    } else {
      // Composio returned unsuccessful — try simulation fallback
      if (isSimulateMode()) {
        console.warn(`[Composio] Tool ${actionSlug} failed: ${result.error} — simulating instead`);
        const fakeUrl = simulatePostedUrl(actionSlug);
        return {
          success: true,
          data: { simulated: true, action: actionSlug, originalError: result.error },
          postedUrl: fakeUrl,
          externalId: `sim_${Date.now()}`,
        };
      }

      return {
        success: false,
        error: result.error || "Tool execution failed with no error message",
      };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error executing tool";

    // Composio threw an error — try simulation fallback
    if (isSimulateMode()) {
      console.warn(`[Composio] Exception for ${actionSlug}: ${message} — simulating instead`);
      const fakeUrl = simulatePostedUrl(actionSlug);
      return {
        success: true,
        data: { simulated: true, action: actionSlug, originalError: message },
        postedUrl: fakeUrl,
        externalId: `sim_${Date.now()}`,
      };
    }

    return {
      success: false,
      error: message,
    };
  }
}

// Get list of connected accounts
export async function getConnectedAccounts() {
  const composio = getComposio();

  if (!composio) {
    return { accounts: [], error: "Composio not configured" };
  }

  try {
    const result = await composio.connectedAccounts.list({
      userIds: [COMPOSIO_USER_ID],
    });
    return { accounts: result.items || [], error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { accounts: [], error: message };
  }
}

// Get available tools for a specific toolkit
export async function getAvailableTools(toolkits: string[]) {
  const composio = getComposio();

  if (!composio) {
    return { tools: [], error: "Composio not configured" };
  }

  try {
    const tools = await composio.tools.getRawComposioTools({
      toolkits,
      important: true,
    });
    return { tools: tools || [], error: null };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { tools: [], error: message };
  }
}
