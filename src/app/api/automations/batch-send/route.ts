import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { PRODUCTS } from "@/lib/products";

// POST /api/automations/batch-send
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { product, maxSends = 3 } = body;
    if (!product) return NextResponse.json({ error: "product required" }, { status: 400 });

    const productInfo = PRODUCTS[product];
    const results = { checked: 0, sent: 0, failed: 0, skipped: 0, errors: [] as string[] };

    const sequence = await db.emailSequence.findFirst({ where: { product, isActive: true } });
    let stepOne: { subject: string; body: string } | null = null;
    if (sequence) {
      try { const steps = JSON.parse(sequence.steps || "[]"); stepOne = steps.find((s: { stepNumber: number }) => s.stepNumber === 1) || null; } catch { /* */ }
    }

    const leads = await db.lead.findMany({ where: { targetProduct: product, status: "new" }, take: 200 });
    const withEmail = leads.filter(l => l.email && l.email.includes("@")).slice(0, maxSends);
    results.checked = withEmail.length;

    for (const lead of withEmail) {
      const existing = await db.emailOutreach.findFirst({ where: { leadId: lead.id, status: "sent" } });
      if (existing) { results.skipped++; continue; }

      let subject: string, body: string;
      if (stepOne) {
        subject = stepOne.subject.replace(/\{\{firstName\}\}/gi, lead.firstName || "there").replace(/\{\{company\}\}/gi, lead.companyName || "your company");
        body = stepOne.body.replace(/\{\{firstName\}\}/gi, lead.firstName || "there").replace(/\{\{lastName\}\}/gi, lead.lastName || "").replace(/\{\{company\}\}/gi, lead.companyName || "your company").replace(/\{\{role\}\}/gi, lead.jobTitle || "your role");
      } else {
        subject = `Quick thought for ${lead.companyName || "your team"}`;
        body = `Hi ${lead.firstName || "there"},\n\nCheck out ${productInfo?.name}: ${productInfo?.url}\n\nBest`;
      }

      const r = await sendEmail({
        to: lead.email, subject,
        html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;line-height:1.6;"><p style="margin-bottom:16px">${body.replace(/\n/g, "<br>")}</p><hr style="border:none;border-top:1px solid #eee;margin:20px 0"/><p style="font-size:13px;color:#888">${productInfo?.tagline || ""}<br/><a href="${productInfo?.url || ""}" style="color:#4F46E5">${productInfo?.url || ""}</a></p></div>`,
        replyTo: "hello@ariaagent.agency",
      });

      await db.emailOutreach.create({
        data: { leadId: lead.id, sequenceId: sequence?.id || null, toEmail: lead.email, toName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim(), subject, body, product, status: r.success ? "sent" : "failed", sentAt: r.success ? new Date().toISOString() : null, resendId: r.emailId || null, errorMessage: r.error || null, stepNumber: 1 },
      });

      if (r.success) {
        await db.lead.update({ where: { id: lead.id }, data: { status: "contacted", emailSent: true, emailSentAt: new Date().toISOString() } });
        results.sent++;
      } else { results.failed++; results.errors.push(`${lead.email}: ${r.error}`); }
    }
    return NextResponse.json({ success: true, ...results });
  } catch (error: unknown) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
