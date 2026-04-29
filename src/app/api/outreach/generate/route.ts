import { NextRequest, NextResponse } from "next/server";
import { generatePersonalizedEmail } from "@/lib/brain";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leadId, leadData, product } = body as {
      leadId?: string;
      leadData?: Record<string, unknown>;
      product: string;
    };

    if (!product) {
      return NextResponse.json({ success: false, error: "product is required" }, { status: 400 });
    }

    // Determine lead data
    let resolvedLeadData: {
      firstName: string;
      lastName: string;
      company?: string;
      jobTitle?: string;
      industry?: string;
      location?: string;
      linkedinUrl?: string;
      description?: string;
    };

    if (leadId) {
      const lead = await db.lead.findUnique({ where: { id: leadId } });
      if (!lead) {
        return NextResponse.json({ success: false, error: "Lead not found" }, { status: 404 });
      }
      resolvedLeadData = {
        firstName: lead.firstName || "",
        lastName: lead.lastName || "",
        company: lead.companyName || undefined,
        jobTitle: lead.jobTitle || undefined,
        industry: lead.industry || undefined,
        location: lead.location || undefined,
        linkedinUrl: lead.linkedInUrl || undefined,
        description: lead.description || undefined,
      };
    } else if (leadData) {
      resolvedLeadData = {
        firstName: String(leadData.firstName || ""),
        lastName: String(leadData.lastName || ""),
        company: leadData.company ? String(leadData.company) : undefined,
        jobTitle: leadData.jobTitle ? String(leadData.jobTitle) : undefined,
        industry: leadData.industry ? String(leadData.industry) : undefined,
        location: leadData.location ? String(leadData.location) : undefined,
        linkedinUrl: leadData.linkedinUrl ? String(leadData.linkedinUrl) : undefined,
        description: leadData.description ? String(leadData.description) : undefined,
      };
    } else {
      return NextResponse.json(
        { success: false, error: "Either leadId or leadData is required" },
        { status: 400 }
      );
    }

    if (!resolvedLeadData.firstName && !resolvedLeadData.lastName) {
      return NextResponse.json(
        { success: false, error: "Lead must have at least a first or last name" },
        { status: 400 }
      );
    }

    const email = await generatePersonalizedEmail(resolvedLeadData, product);

    return NextResponse.json({
      success: true,
      subject: email.subject,
      body: email.body,
      product,
      leadId: leadId || null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
