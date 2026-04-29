import { NextRequest, NextResponse } from "next/server";
import { executeTool } from "@/lib/composio";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contentId } = body;

    if (!contentId) {
      return NextResponse.json({ error: "contentId is required" }, { status: 400 });
    }

    const contentPiece = await db.contentPiece.findUnique({
      where: { id: contentId },
    });

    if (!contentPiece) {
      return NextResponse.json({ error: "Content not found" }, { status: 404 });
    }

    const actionSlugs: Record<string, string> = {
      twitter: "TWITTER_CREATE_TWEET",
      linkedin: "LINKEDIN_CREATE_POST",
      devto: "DEVTO_CREATE_ARTICLE",
      reddit: "REDDIT_CREATE_POST",
      slack: "SLACK_SEND_MESSAGE",
    };

    const actionSlug = actionSlugs[contentPiece.platform] || "TWITTER_CREATE_TWEET";
    let params: Record<string, unknown> = {};

    if (contentPiece.platform === "devto") {
      params = {
        title: contentPiece.title || contentPiece.topic,
        body_markdown: contentPiece.body,
        tags: contentPiece.hashtags?.split(",") || ["ai", "tools"],
      };
    } else {
      params = { text: contentPiece.body };
    }

    const result = await executeTool(actionSlug, params);

    if (result.success) {
      await db.contentPiece.update({
        where: { id: contentId },
        data: {
          postStatus: "posted",
          postedAt: new Date().toISOString(),
          postedUrl: result.postedUrl || null,
          externalId: result.externalId || null,
        },
      });

      await db.postHistory.create({
        data: {
          platform: contentPiece.platform,
          product: contentPiece.product,
          actionSlug,
          title: contentPiece.title || null,
          body: contentPiece.body,
          postedUrl: result.postedUrl || null,
          externalId: result.externalId || null,
          status: "success",
          triggerType: "manual",
        },
      });

      return NextResponse.json({
        success: true,
        postedUrl: result.postedUrl,
      });
    } else {
      await db.contentPiece.update({
        where: { id: contentId },
        data: {
          postStatus: "failed",
          errorMessage: result.error,
        },
      });

      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
