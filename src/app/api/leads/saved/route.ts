import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    // If search, fetch all and filter (Supabase free tier doesn't support full-text search easily)
    let leads = await db.lead.findMany({
      where: Object.keys(where).length > 0 ? where : undefined,
      orderBy: { createdAt: "desc" },
      take: 200, // fetch more to allow client-side search filtering
    });

    // Client-side search filtering
    if (search) {
      const q = search.toLowerCase();
      leads = leads.filter(
        (l) =>
          (l.firstName?.toLowerCase().includes(q)) ||
          (l.lastName?.toLowerCase().includes(q)) ||
          (l.email?.toLowerCase().includes(q)) ||
          (l.companyName?.toLowerCase().includes(q)) ||
          (l.jobTitle?.toLowerCase().includes(q))
      );
    }

    const total = leads.length;
    const paginatedLeads = leads.slice((page - 1) * limit, page * limit);

    // Count by status
    const counts = {
      new: 0,
      contacted: 0,
      replied: 0,
      interested: 0,
      converted: 0,
      lost: 0,
      unsubscribed: 0,
      total: 0,
    };

    const allLeads = await db.lead.findMany({ take: 1000 });
    counts.total = allLeads.length;
    for (const lead of allLeads) {
      const s = lead.status || "new";
      if (s in counts) {
        (counts as Record<string, number>)[s]++;
      }
    }

    return NextResponse.json({
      success: true,
      leads: paginatedLeads,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
