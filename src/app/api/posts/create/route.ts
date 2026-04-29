import { NextRequest, NextResponse } from "next/server";
import { generateContent } from "@/lib/brain";
import { executeTool } from "@/lib/composio";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, product, topic, customContent } = body;

    if (!platform || !product) {
      return NextResponse.json(
        { error: "Platform and product are required" },
        { status: 400 }
      );
    }

    const topicText = topic || `${product} update`;
    const bodyText = customContent || null;

    let content;
    let toolParams: Record<string, unknown> = {};

    if (bodyText) {
      switch (platform) {
        case "twitter":
          content = { body: bodyText, actionSlug: "TWITTER_CREATE_TWEET" };
          toolParams = { text: bodyText };
          break;
        case "linkedin":
          content = { body: bodyText, actionSlug: "LINKEDIN_CREATE_POST" };
          toolParams = { text: bodyText };
          break;
        case "devto":
          content = { body: bodyText, title: topic, actionSlug: "DEVTO_CREATE_ARTICLE" };
          toolParams = { title: topic, body_markdown: bodyText };
          break;
        default:
          content = { body: bodyText, actionSlug: "TWITTER_CREATE_TWEET" };
          toolParams = { text: bodyText };
      }
    } else {
      content = await generateContent(platform, product, topicText);

      switch (content.actionSlug) {
        case "TWITTER_CREATE_TWEET":
          toolParams = { text: content.body };
          break;
        case "LINKEDIN_CREATE_POST":
          toolParams = { text: content.body };
          break;
        case "DEVTO_CREATE_ARTICLE":
          toolParams = {
            title: content.title,
            body_markdown: content.body,
            tags: content.tags,
          };
          break;
        case "REDDIT_CREATE_POST":
          toolParams = { title: content.title, body: content.body };
          break;
        default:
          toolParams = { text: content.body };
      }
    }

    const result = await executeTool(content.actionSlug, toolParams);

    const historyEntry = await db.postHistory.create({
      data: {
        platform,
        product,
        actionSlug: content.actionSlug,
        title: content.title || null,
        body:
          typeof toolParams.text === "string"
            ? toolParams.text
            : typeof toolParams.body_markdown === "string"
              ? toolParams.body_markdown
              : content.body || "",
        postedUrl: result.success ? result.postedUrl : null,
        externalId: result.success ? result.externalId : null,
        status: result.success ? "success" : "failed",
        errorMessage: result.success ? null : result.error,
        triggerType: "manual",
      },
    });

    return NextResponse.json({
      success: result.success,
      postedUrl: result.postedUrl,
      error: result.error,
      historyId: historyEntry.id,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
