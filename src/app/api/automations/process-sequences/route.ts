import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";
import { PRODUCTS } from "@/lib/products";

// POST /api/automations/process-sequences
// Batched follow-up processor — accepts ?product=X to process one product at a time
// This avoids Vercel's 10s function timeout
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const targetProduct = searchParams.get("product");

    const now = new Date();
    const results = { processed: 0, sent: 0, failed: 0, skipped: 0, product: targetProduct || "all", errors: [] as string[] };

    // Find active sequences (filter by product if specified)
    const whereClause: Record<string, unknown> = { isActive: true };
    if (targetProduct) whereClause.product = targetProduct;

    const sequences = await db.emailSequence.findMany({ where: whereClause });

    for (const sequence of sequences) {
      let steps: Array<{ stepNumber: number; subject: string; body: string; waitDays: number }> = [];
      try { steps = JSON.parse(sequence.steps || "[]"); } catch { continue; }
      if (steps.length === 0) continue;

      const productInfo = PRODUCTS[sequence.product];
      const productUrl = productInfo?.url || "https://ariaagent.agency";

      // Find sent outreach for this product that might need follow-up
      // Only process the MOST RECENT outreach per lead to avoid duplicates
      const sentOutreaches = await db.emailOutreach.findMany({
        where: { product: sequence.product, status: "sent" },
        orderBy: { createdAt: "desc" },
        take: 50, // Batch limit to stay within Vercel timeout
      });

      // Dedupe by leadId — only process the latest outreach per lead
      const seen = new Set<string>();
      const uniqueOutreaches = sentOutreaches.filter(o => {
        if (!o.leadId || seen.has(o.leadId)) return false;
        seen.add(o.leadId);
        return true;
      });

      for (const outreach of uniqueOutreaches) {
        const currentStep = outreach.stepNumber || 1;
        const nextStep = currentStep + 1;

        const nextStepData = steps.find(s => s.stepNumber === nextStep);
        if (!nextStepData) { results.skipped++; continue; }

        // Check if next step already sent
        const alreadySent = await db.emailOutreach.findFirst({
          where: { leadId: outreach.leadId, stepNumber: nextStep },
        });
        if (alreadySent) { results.skipped++; continue; }

        // Check timing
        const sentDate = new Date(outreach.sentAt || outreach.createdAt);
        const waitMs = (nextStepData.waitDays || 3) * 24 * 60 * 60 * 1000;
        if (now < new Date(sentDate.getTime() + waitMs)) { results.skipped++; continue; }

        // Get lead
        const lead = outreach.leadId ? await db.lead.findUnique({ where: { id: outreach.leadId } }) : null;
        if (!lead?.email) continue;

        // Skip if already replied or converted
        if (lead.status === "replied" || lead.status === "converted") { results.processed++; continue; }

        results.processed++;

        // Personalize
        const body = nextStepData.body
          .replace(/{{firstName}}/gi, lead.firstName || "there")
          .replace(/{{lastName}}/gi, lead.lastName || "")
          .replace(/{{company}}/gi, lead.companyName || "your company")
          .replace(/{{role}}/gi, lead.jobTitle || "your role");

        const subject = nextStepData.subject
          .replace(/{{firstName}}/gi, lead.firstName || "there")
          .replace(/{{company}}/gi, lead.companyName || "your company");

        // Inject CTA if missing
        let emailBody = body;
        if (!emailBody.includes(productUrl) && !emailBody.includes("http")) {
          emailBody += `\n\nLearn more: ${productUrl}`;
        }

        const emailHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
          <p style="margin-bottom: 16px;">${emailBody.replace(/\n/g, "<br>")}</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${productUrl}" style="background-color: #4F46E5; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 15px; display: inline-block;">Try ${productInfo?.name || "it"} Free</a>
          </div>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">${productInfo?.tagline || ""}</p>
        </div>`;

        const emailResult = await sendEmail({
          to: lead.email,
          subject,
          html: emailHtml,
          replyTo: "hello@ariaagent.agency",
        });

        await db.emailOutreach.create({
          data: {
            leadId: lead.id,
            sequenceId: sequence.id,
            stepNumber: nextStep,
            toEmail: lead.email,
            toName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || null,
            subject,
            body: emailBody,
            product: sequence.product,
            status: emailResult.success ? "sent" : "failed",
            sentAt: emailResult.success ? new Date().toISOString() : null,
            resendId: emailResult.emailId || null,
            errorMessage: emailResult.error || null,
          },
        });

        if (emailResult.success) {
          results.sent++;
          await db.lead.update({
            where: { id: lead.id },
            data: { followUpCount: (lead.followUpCount || 0) + 1, lastFollowUpAt: new Date().toISOString() },
          });
        } else {
          results.failed++;
        }
      }
    }

    return NextResponse.json({ success: true, ...results, timestamp: now.toISOString() });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
