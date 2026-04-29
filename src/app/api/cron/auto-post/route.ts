import { NextResponse } from "next/server";
import { generateContent } from "@/lib/brain";
import { executeTool } from "@/lib/composio";
import { db } from "@/lib/db";
import { PRODUCTS, PRODUCT_LIST } from "@/lib/products";

export async function GET() {
  try {
    const config = await db.autoPostConfig.findFirst();
    if (!config || !config.enabled) {
      return NextResponse.json({ success: false, message: "Auto-posting is disabled" });
    }

    const platforms = config.platforms.split(",").map((p) => p.trim());
    const products = config.products.split(",").map((p) => p.trim());

    const randomProduct = products[Math.floor(Math.random() * products.length)];
    const randomPlatform = platforms[Math.floor(Math.random() * platforms.length)];

    const productInfo = PRODUCTS[randomProduct];
    if (!productInfo) {
      return NextResponse.json({ success: false, message: `Unknown product: ${randomProduct}` });
    }

    const topics = [
      `${productInfo.name}: ${productInfo.tagline}`,
      `How ${productInfo.name} can help ${productInfo.targetAudience}`,
      `Why I built ${productInfo.name} — a ${productInfo.keyFeatures?.slice(0, 2).join(" and ")} tool`,
      `${productInfo.keyFeatures?.[0]} — the feature that saves hours`,
    ];
    const topic = topics[Math.floor(Math.random() * topics.length)];

    const content = await generateContent(randomPlatform, randomProduct, topic);

    let toolParams: Record<string, unknown> = {};
    switch (content.actionSlug) {
      case "TWITTER_CREATE_TWEET":
        toolParams = { text: content.body };
        break;
      case "LINKEDIN_CREATE_POST":
        toolParams = { text: content.body };
        break;
      case "DEVTO_CREATE_ARTICLE":
        toolParams = { title: content.title, body_markdown: content.body, tags: content.tags };
        break;
      default:
        toolParams = { text: content.body };
    }

    const result = await executeTool(content.actionSlug, toolParams);

    await db.autoPostConfig.update({
      where: { id: config.id },
      data: {
        lastRunAt: new Date().toISOString(),
        lastRunStatus: result.success ? "success" : "failed",
        lastRunMessage: result.success
          ? `Posted to ${randomPlatform} for ${randomProduct}`
          : result.error,
      },
    });

    await db.postHistory.create({
      data: {
        platform: randomPlatform,
        product: randomProduct,
        actionSlug: content.actionSlug,
        title: content.title || null,
        body: content.body,
        postedUrl: result.success ? result.postedUrl : null,
        externalId: result.success ? result.externalId : null,
        status: result.success ? "success" : "failed",
        errorMessage: result.success ? null : result.error,
        triggerType: "auto",
      },
    });

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Auto-posted to ${randomPlatform} for ${randomProduct}`
        : `Auto-post failed: ${result.error}`,
      platform: randomPlatform,
      product: randomProduct,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    try {
      const config = await db.autoPostConfig.findFirst();
      if (config) {
        await db.autoPostConfig.update({
          where: { id: config.id },
          data: {
            lastRunAt: new Date().toISOString(),
            lastRunStatus: "failed",
            lastRunMessage: message,
          },
        });
      }
    } catch {
      // Ignore config update failure
    }

    return NextResponse.json({ success: false, error: message });
  }
}
