import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/debug/test-update
export async function GET() {
  try {
    // Get a lead without email
    const leads = await db.lead.findMany({
      where: { targetProduct: "NaiveLandingPage", status: "new" },
      take: 3,
    });

    const noEmailLead = leads.find(l => !l.email || !l.email.includes("@"));

    if (!noEmailLead) {
      return NextResponse.json({ success: true, message: "No leads without email found", totalChecked: leads.length });
    }

    const testEmail = `${(noEmailLead.firstName || 'test').toLowerCase()}@${(noEmailLead.companyDomain || 'test.com').replace(/^(https?:\/\/)?(www\.)?/, '')}`;

    // Try to update
    const before = noEmailLead.email;
    const updated = await db.lead.update({
      where: { id: noEmailLead.id },
      data: { email: testEmail },
    });

    // Verify
    const verify = await db.lead.findUnique({ where: { id: noEmailLead.id } });

    return NextResponse.json({
      success: true,
      leadId: noEmailLead.id,
      name: `${noEmailLead.firstName} ${noEmailLead.lastName}`,
      before,
      testEmail,
      updatedEmail: updated?.email,
      verifyEmail: verify?.email,
      updated: before !== verify?.email,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
