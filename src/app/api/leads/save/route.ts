import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leads } = body as {
      leads: Array<{
        firstName?: string;
        lastName?: string;
        email?: string;
        jobTitle?: string;
        company?: string;
        companyDomain?: string;
        linkedinUrl?: string;
        location?: string;
        seniority?: string;
        industry?: string;
        description?: string;
        source?: string;
        score?: number;
        tags?: string;
        rawData?: string;
      }>;
    };

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { success: false, error: "leads array is required and must be non-empty" },
        { status: 400 }
      );
    }

    const saved: Array<{ id: string; email: string; status: string }> = [];
    const skipped: string[] = [];
    const errors: string[] = [];

    for (const lead of leads) {
      try {
        // Check if lead with same email already exists
        if (lead.email) {
          const existing = await db.lead.findUnique({ where: { email: lead.email } });
          if (existing) {
            skipped.push(lead.email);
            continue;
          }
        }

        const created = await db.lead.create({
          data: {
            firstName: lead.firstName || null,
            lastName: lead.lastName || null,
            email: lead.email || null,
            jobTitle: lead.jobTitle || null,
            companyName: lead.company || null,
            companyDomain: lead.companyDomain || null,
            linkedInUrl: lead.linkedinUrl || null,
            location: lead.location || null,
            seniority: lead.seniority || null,
            industry: lead.industry || null,
            description: lead.description || null,
            source: lead.source || "explee",
            score: lead.score || 0,
            tags: lead.tags || null,
            rawData: lead.rawData ? JSON.stringify(lead.rawData) : null,
            status: "new",
          },
        });

        saved.push({ id: created.id, email: created.email || "", status: "saved" });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        errors.push(`${lead.email || "unknown"}: ${msg}`);
      }
    }

    return NextResponse.json({
      success: true,
      saved,
      skipped,
      errors,
      counts: {
        saved: saved.length,
        skipped: skipped.length,
        errors: errors.length,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
