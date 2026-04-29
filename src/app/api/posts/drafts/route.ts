import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const drafts = await db.contentPiece.findMany({
      where: { postStatus: "draft" },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({ success: true, drafts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
