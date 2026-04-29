import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";

// Cron endpoint: check for leads that need follow-up emails
// This should be called by a cron job (e.g., Vercel Cron)
export async function GET() {
  try {
    // Get all "contacted" leads that have a last email in a sequence
    const leads = await db.lead.findMany({
      where: { status: "contacted" },
      take: 100,
    });

    if (leads.length === 0) {
      return NextResponse.json({ success: true, message: "No contacted leads to follow up", processed: 0 });
    }

    let processed = 0;
    let sent = 0;

    for (const lead of leads) {
      if (!lead.email) continue;

      // Find the most recent outreach for this lead that has a sequenceId
      const recentOutreach = await db.emailOutreach.findFirst({
        where: { leadId: lead.id, status: "sent" },
        orderBy: { createdAt: "desc" },
      });

      if (!recentOutreach?.sequenceId) continue;

      // Get the sequence
      const sequence = await db.emailSequence.findUnique({
        where: { id: recentOutreach.sequenceId },
      });
      if (!sequence || !sequence.isActive) continue;

      let steps: Array<{ stepNumber: number; subject: string; body: string; waitDays: number }> = [];
      try {
        steps = JSON.parse(sequence.steps || "[]");
      } catch {
        continue;
      }

      const currentStepNumber = (recentOutreach.stepNumber || 1);
      const nextStep = steps.find((s) => s.stepNumber === currentStepNumber + 1);

      if (!nextStep) {
        // No more steps, mark lead as completed or leave as-is
        continue;
      }

      // Check if enough time has passed (use the step's waitDays or the sequence's intervalDays)
      const waitDays = nextStep.waitDays || sequence.intervalDays || 3;
      const sentDate = recentOutreach.sentAt ? new Date(recentOutreach.sentAt) : null;
      if (!sentDate) continue;

      const daysSince = (Date.now() - sentDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSince < waitDays) continue;

      // Send the next step
      const personalizedBody = nextStep.body
        .replace(/{{firstName}}/gi, lead.firstName || "there")
        .replace(/{{lastName}}/gi, lead.lastName || "")
        .replace(/{{company}}/gi, lead.company || "your company")
        .replace(/{{role}}/gi, lead.jobTitle || "your role");

      const personalizedSubject = nextStep.subject
        .replace(/{{firstName}}/gi, lead.firstName || "there")
        .replace(/{{company}}/gi, lead.company || "your company");

      const emailResult = await sendEmail({
        to: lead.email,
        subject: personalizedSubject,
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${personalizedBody.replace(/\n/g, "<br>")}
        </div>`,
      });

      await db.emailOutreach.create({
        data: {
          leadId: lead.id,
          sequenceId: sequence.id,
          stepNumber: nextStep.stepNumber,
          toEmail: lead.email,
          toName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || null,
          subject: personalizedSubject,
          body: personalizedBody,
          product: sequence.product,
          status: emailResult.success ? "sent" : "failed",
          sentAt: emailResult.success ? new Date().toISOString() : null,
          resendId: emailResult.emailId || null,
          errorMessage: emailResult.error || null,
        },
      });

      if (emailResult.success) {
        sent++;
        await db.emailSequence.update({
          where: { id: sequence.id },
          data: { totalSent: (sequence.totalSent || 0) + 1 },
        });
      }

      processed++;
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} leads, sent ${sent} follow-up emails`,
      processed,
      sent,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
