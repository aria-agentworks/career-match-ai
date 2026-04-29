import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { PRODUCTS } from "@/lib/products";

export async function GET() {
  const product = "DateWise";
  const logs: string[] = [];

  const leads = await db.lead.findMany({
    where: { targetProduct: product, status: "new" },
    take: 100,
  });
  logs.push(`Fetched ${leads.length} new ${product} leads`);

  const leadsWithEmail = leads
    .filter(l => l.email && l.email.includes("@"))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 3);
  logs.push(`Leads with valid emails: ${leadsWithEmail.length}`);
  for (const l of leadsWithEmail) {
    logs.push(`  - ${l.firstName} ${l.lastName} | ${l.email} | id: ${l.id} | score: ${l.score}`);
  }

  if (leadsWithEmail.length === 0) {
    return NextResponse.json({ logs, sent: 0 });
  }

  const lead = leadsWithEmail[0];
  logs.push(`Checking lead: ${lead.id}`);

  const existingOutreach = await db.emailOutreach.findFirst({
    where: { leadId: lead.id, status: "sent" },
  });
  logs.push(`Existing outreach: ${existingOutreach ? 'YES blocked' : 'NO proceed'}`);

  logs.push(`Attempting to send to ${lead.email}...`);
  try {
    const result = await sendEmail({
      to: lead.email,
      subject: "Test from debug",
      html: "<p>Test</p>",
      replyTo: "hello@ariaagent.agency",
    });
    logs.push(`Send: success=${result.success}, id=${result.emailId}, err=${result.error}`);

    if (result.success) {
      await db.emailOutreach.create({
        data: {
          leadId: lead.id, toEmail: lead.email,
          toName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim(),
          subject: "Test", body: "Test", product, status: "sent",
          sentAt: new Date().toISOString(), stepNumber: 1,
        },
      });
      await db.lead.update({
        where: { id: lead.id },
        data: { status: "contacted", emailSent: true, emailSentAt: new Date().toISOString() },
      });
      logs.push("SUCCESS - lead contacted");
    }
  } catch (err: unknown) {
    logs.push(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }

  return NextResponse.json({ logs });
}
