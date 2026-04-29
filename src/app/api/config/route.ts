import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    let config = await db.autoPostConfig.findFirst();
    if (!config) {
      config = await db.autoPostConfig.create({
        data: {
          enabled: false,
          platforms: "twitter,linkedin",
          products: "AriaAgent",
          postFrequency: "daily",
          postTime: "09:00",
          timezone: "UTC",
        },
      });
    }
    return NextResponse.json({ success: true, config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { enabled, platforms, products, postFrequency, postTime, timezone } = body;

    let config = await db.autoPostConfig.findFirst();
    if (!config) {
      config = await db.autoPostConfig.create({
        data: {
          enabled: enabled ?? false,
          platforms: platforms || "twitter,linkedin",
          products: products || "AriaAgent",
          postFrequency: postFrequency || "daily",
          postTime: postTime || "09:00",
          timezone: timezone || "UTC",
        },
      });
    } else {
      config = await db.autoPostConfig.update({
        where: { id: config.id },
        data: {
          enabled: enabled ?? config.enabled,
          platforms: platforms ?? config.platforms,
          products: products ?? config.products,
          postFrequency: postFrequency ?? config.postFrequency,
          postTime: postTime ?? config.postTime,
          timezone: timezone ?? config.timezone,
        },
      });
    }

    return NextResponse.json({ success: true, config });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
