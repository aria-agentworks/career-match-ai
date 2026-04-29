import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import { db } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { to, toName, subject, body: emailBody, product, leadId } = body as {
      to: string;
      toName?: string;
      subject: string;
      body: string;
      product?: string;
      leadId?: string;
    };

    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { success: false, error: "to, subject, and body are required" },
        { status: 400 }
      );
    }

    // Send the email via Resend
    const htmlBody = emailBody
      .replace(/\n/g, "<br>")
      .replace(/{{firstName}}/gi, toName?.split(" ")[0] || "there")
      .replace(/{{company}}/gi, "");

    const result = await sendEmail({
      to,
      subject,
      html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${htmlBody}
      </div>`,
    });

    // Save to EmailOutreach table
    const outreach = await db.emailOutreach.create({
      data: {
        leadId: leadId || null,
        toEmail: to,
        toName: toName || null,
        subject,
        body: emailBody,
        product: product || null,
        status: result.success ? "sent" : "failed",
        sentAt: result.success ? new Date().toISOString() : null,
        resendId: result.emailId || null,
        errorMessage: result.error || null,
      },
    });

    // Update lead status if leadId provided
    if (leadId && result.success) {
      try {
        await db.lead.update({
          where: { id: leadId },
          data: { 
            status: "contacted",
            emailSent: true,
            emailSentAt: new Date().toISOString(),
          },
        });
      } catch {
        // Non-critical: don't fail if lead update fails
      }
    }

    return NextResponse.json({
      success: result.success,
      outreachId: outreach.id,
      emailId: result.emailId,
      error: result.error,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
