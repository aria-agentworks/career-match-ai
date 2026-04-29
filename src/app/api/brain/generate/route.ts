import { NextRequest, NextResponse } from "next/server";
import { generateContent } from "@/lib/brain";
import { executeTool } from "@/lib/composio";
import { db } from "@/lib/db";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { platform, product, topic, publishImmediately } = body;

    if (!platform || !product || !topic) {
      return NextResponse.json(
        { error: "Platform, product, and topic are required" },
        { status: 400 }
      );
    }

    const content = await generateContent(platform, product, topic);

    let toolParams: Record<string, unknown> = {};
    switch (content.actionSlug) {
      case "TWITTER_CREATE_TWEET":
        toolParams = { text: content.body };
        break;
      case "TWITTER_CREATE_THREAD":
        toolParams = { tweets: JSON.parse(content.body) };
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

    // Save as draft
    const contentPiece = await db.contentPiece.create({
      data: {
        platform,
        product,
        topic,
        title: content.title || null,
        body:
          typeof toolParams.text === "string"
            ? toolParams.text
            : typeof toolParams.body_markdown === "string"
              ? toolParams.body_markdown
              : typeof toolParams.body === "string"
                ? toolParams.body
                : JSON.stringify(toolParams),
        hashtags: content.hashtags?.join(",") || null,
        postStatus: "draft",
      },
    });

    // If publish immediately, post it
    let postedUrl: string | undefined;
    let postedSuccess = false;
    let postedError: string | undefined;

    if (publishImmediately) {
      const result = await executeTool(content.actionSlug, toolParams);

      if (result.success) {
        postedUrl = result.postedUrl;
        postedSuccess = true;

        await db.contentPiece.update({
          where: { id: contentPiece.id },
          data: {
            postStatus: "posted",
            postedAt: new Date().toISOString(),
            postedUrl: result.postedUrl || null,
            externalId: result.externalId || null,
          },
        });

        await db.postHistory.create({
          data: {
            platform,
            product,
            actionSlug: content.actionSlug,
            title: content.title || null,
            body: content.body,
            postedUrl: result.postedUrl || null,
            externalId: result.externalId || null,
            status: "success",
            triggerType: "manual",
          },
        });
      } else {
        postedError = result.error;
        await db.contentPiece.update({
          where: { id: contentPiece.id },
          data: {
            postStatus: "failed",
            errorMessage: result.error,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      content: {
        id: contentPiece.id,
        platform,
        product,
        topic,
        title: content.title,
        body: content.body,
        actionSlug: content.actionSlug,
        params: toolParams,
        postStatus: contentPiece.postStatus,
      },
      posted: publishImmediately
        ? { success: postedSuccess, url: postedUrl, error: postedError }
        : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
