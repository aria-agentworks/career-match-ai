import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sequenceId, leadIds } = body as {
      sequenceId: string;
      leadIds: string[];
    };

    if (!sequenceId || !leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "sequenceId and leadIds array are required" },
        { status: 400 }
      );
    }

    // Get the sequence
    const sequence = await db.emailSequence.findUnique({ where: { id: sequenceId } });
    if (!sequence) {
      return NextResponse.json({ success: false, error: "Sequence not found" }, { status: 404 });
    }

    let steps: Array<{ stepNumber: number; subject: string; body: string; waitDays: number }> = [];
    try {
      steps = JSON.parse(sequence.steps || "[]");
    } catch {
      return NextResponse.json({ success: false, error: "Invalid sequence steps" }, { status: 500 });
    }

    if (steps.length === 0) {
      return NextResponse.json({ success: false, error: "Sequence has no steps" }, { status: 400 });
    }

    const firstStep = steps[0];
    const results: Array<{
      leadId: string;
      email: string;
      success: boolean;
      outreachId?: string;
      error?: string;
    }> = [];
    let sentCount = 0;

    // Send first step to all leads
    for (const leadId of leadIds) {
      const lead = await db.lead.findUnique({ where: { id: leadId } });
      if (!lead || !lead.email) {
        results.push({ leadId, email: "N/A", success: false, error: "Lead not found or has no email" });
        continue;
      }

      // Personalize the email
      const personalizedBody = firstStep.body
        .replace(/{{firstName}}/gi, lead.firstName || "there")
        .replace(/{{lastName}}/gi, lead.lastName || "")
        .replace(/{{company}}/gi, lead.company || "your company")
        .replace(/{{role}}/gi, lead.jobTitle || "your role");

      const personalizedSubject = firstStep.subject
        .replace(/{{firstName}}/gi, lead.firstName || "there")
        .replace(/{{company}}/gi, lead.company || "your company");

      const emailResult = await sendEmail({
        to: lead.email,
        subject: personalizedSubject,
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${personalizedBody.replace(/\n/g, "<br>")}
        </div>`,
      });

      // Save outreach record
      const outreach = await db.emailOutreach.create({
        data: {
          leadId: lead.id,
          sequenceId: sequence.id,
          stepNumber: 1,
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

      // Update lead status
      if (emailResult.success) {
        await db.lead.update({
          where: { id: lead.id },
          data: { status: "contacted" },
        });
        sentCount++;
      }

      results.push({
        leadId: lead.id,
        email: lead.email,
        success: emailResult.success,
        outreachId: outreach.id,
        error: emailResult.error,
      });
    }

    // Update sequence stats
    await db.emailSequence.update({
      where: { id: sequence.id },
      data: { totalSent: (sequence.totalSent || 0) + sentCount },
    });

    return NextResponse.json({
      success: true,
      results,
      sentCount,
      failedCount: results.length - sentCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
