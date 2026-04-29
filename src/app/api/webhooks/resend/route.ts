import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// ===== RESEND WEBHOOK SIGNATURE VERIFICATION =====
// Uses HMAC-SHA256 to verify incoming webhooks are from Resend
// Docs: https://resend.com/docs/api-reference/webhooks/verify

async function verifyResendSignature(
  body: string,
  signature: string,
  timestamp: string
): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[Resend Webhook] No RESEND_WEBHOOK_SECRET set — skipping verification");
    return true; // Allow in dev without secret
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const data = `${timestamp}.${body}`;
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  const sigArray = Array.from(new Uint8Array(sigBuffer));
  const expectedSig = sigArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // Resend sends hex-encoded HMAC — compare with timing-safe comparison
  const sig = signature.replace(/^v1,|v1:/g, "").trim();
  if (sig.length !== expectedSig.length) return false;

  let result = 0;
  for (let i = 0; i < sig.length; i++) {
    result |= sig.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  return result === 0;
}

// ===== FUNNEL STAGE PROMOTION LOGIC =====
// Moves leads through the sales funnel based on engagement signals
// new → contacted → opened → engaged → replied → interested → demo → closed
function promoteFunnelStage(currentStage: string | null | undefined, event: string): string {
  const STAGE_PRIORITY: Record<string, number> = {
    new: 0,
    contacted: 1,
    opened: 2,
    engaged: 3,
    replied: 4,
    interested: 5,
    demo: 6,
    closed_won: 7,
    closed_lost: -1,
    lost: -1,
  };

  const EVENT_STAGE: Record<string, string> = {
    "email.sent": "contacted",
    "email.delivered": "contacted",
    "email.opened": "opened",
    "email.clicked": "engaged",
    "email.replied": "replied",
    "email.bounced": "lost",
    "email.complained": "lost",
  };

  const targetStage = EVENT_STAGE[event] || currentStage || "contacted";
  const currentPriority = STAGE_PRIORITY[currentStage || "new"] ?? 0;
  const targetPriority = STAGE_PRIORITY[targetStage] ?? 0;

  // Only promote forward (never demote unless it's a bounce/complaint)
  if (targetPriority < 0) return targetStage; // bounces/complaints always apply
  return targetPriority > currentPriority ? targetStage : (currentStage || "contacted");
}

// ===== BUYING INTENT SCORING =====
// Each engagement signal adds points to a lead's buying intent score
function calculateBuyingIntent(
  currentIntent: number | null | undefined,
  openCount: number,
  clickCount: number,
  replyCount: number
): number {
  let intent = currentIntent || 0;
  // Opens = weak signal (5 pts each, cap 20)
  // Clicks = strong signal (25 pts each)
  // Reply = strongest signal (50 pts each)
  intent = Math.max(intent, openCount * 5 + clickCount * 25 + replyCount * 50);
  return Math.min(100, intent);
}

// ===== MAIN WEBHOOK HANDLER =====
// POST /api/webhooks/resend
// Receives webhooks from Resend for all email events
export async function POST(request: Request) {
  try {
    // 1. Read raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("resend-signature") || "";
    const timestamp = request.headers.get("resend-timestamp") || "";

    // 2. Verify webhook signature (skip if no secret configured)
    if (timestamp) {
      const isValid = await verifyResendSignature(rawBody, signature, timestamp);
      if (!isValid) {
        console.error("[Resend Webhook] Invalid signature — rejecting request");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // 3. Parse the webhook payload
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const events = Array.isArray(body) ? body : [body];
    const results: Array<{
      event: string;
      emailId: string;
      outreachId?: string;
      leadId?: string;
      action: string;
    }> = [];

    for (const event of events) {
      const eventType = (event.type as string) || "";
      const data = (event.data as Record<string, unknown>) || {};

      // Only process email events
      if (!eventType.startsWith("email.")) continue;

      const emailId = data.email_id as string;
      if (!emailId) continue;

      // Find the outreach record by resendId
      let outreach = await db.emailOutreach.findFirst({
        where: { resendId: emailId },
      });

      // Also try matching by toEmail + subject for older records without resendId
      if (!outreach && data.to) {
        const recipientEmail = Array.isArray(data.to) ? data.to[0] : String(data.to);
        if (recipientEmail) {
          outreach = await db.emailOutreach.findFirst({
            where: { toEmail: recipientEmail },
          });
        }
      }

      if (!outreach) {
        console.log(`[Resend Webhook] No outreach record found for email ${emailId}`);
        continue;
      }

      const outreachUpdate: Record<string, unknown> = {};
      const leadUpdate: Record<string, unknown> = {};

      switch (eventType) {
        // ===== EMAIL SENT =====
        case "email.sent":
          outreachUpdate.status = "sent";
          outreachUpdate.sentAt = data.created_at || new Date().toISOString();
          leadUpdate.funnelStage = promoteFunnelStage(null, eventType);
          break;

        // ===== EMAIL DELIVERED =====
        case "email.delivered":
          outreachUpdate.status = "delivered";
          outreachUpdate.deliveredAt = data.created_at || new Date().toISOString();
          leadUpdate.funnelStage = promoteFunnelStage(null, eventType);
          break;

        // ===== EMAIL OPENED — Strong buying signal =====
        case "email.opened": {
          outreachUpdate.openedAt = data.created_at || new Date().toISOString();
          outreachUpdate.status = "opened";
          
          // Track open count on lead
          const currentOpenCount = ((await db.lead.findUnique({ where: { id: outreach.leadId! } }))?.openCount as number) || 0;
          leadUpdate.openCount = currentOpenCount + 1;
          leadUpdate.funnelStage = promoteFunnelStage(null, eventType);
          leadUpdate.lastEngagementAt = new Date().toISOString();
          
          results.push({
            event: "opened",
            emailId,
            outreachId: outreach.id,
            leadId: outreach.leadId || undefined,
            action: "lead_opened_email",
          });
          break;
        }

        // ===== EMAIL CLICKED — Very strong buying signal =====
        case "email.clicked": {
          outreachUpdate.clickedAt = data.created_at || new Date().toISOString();
          outreachUpdate.clickUrl = data.url || null;
          outreachUpdate.status = "clicked";
          
          const leadForClick = await db.lead.findUnique({ where: { id: outreach.leadId! } });
          const currentClickCount = (leadForClick?.clickCount as number) || 0;
          const currentOpenCount = (leadForClick?.openCount as number) || 0;
          const currentReplyCount = (leadForClick?.replyCount as number) || 0;
          
          leadUpdate.clickCount = currentClickCount + 1;
          leadUpdate.funnelStage = promoteFunnelStage(leadForClick?.funnelStage as string, eventType);
          leadUpdate.buyingIntent = calculateBuyingIntent(
            leadForClick?.buyingIntent as number,
            currentOpenCount,
            currentClickCount + 1,
            currentReplyCount
          );
          leadUpdate.lastEngagementAt = new Date().toISOString();
          leadUpdate.status = "engaged"; // Hot lead!
          
          results.push({
            event: "clicked",
            emailId,
            outreachId: outreach.id,
            leadId: outreach.leadId || undefined,
            action: "lead_clicked_cta",
          });
          break;
        }

        // ===== EMAIL REPLIED — Hottest signal — potential sale =====
        case "email.replied": {
          outreachUpdate.repliedAt = data.created_at || new Date().toISOString();
          outreachUpdate.status = "replied";
          outreachUpdate.replyBody = data.reply_body || data.body || null;
          
          const leadForReply = await db.lead.findUnique({ where: { id: outreach.leadId! } });
          const replyOpenCount = (leadForReply?.openCount as number) || 0;
          const replyClickCount = (leadForReply?.clickCount as number) || 0;
          const replyCount = (leadForReply?.replyCount as number) || 0;
          
          leadUpdate.replyCount = replyCount + 1;
          leadUpdate.funnelStage = promoteFunnelStage(leadForReply?.funnelStage as string, eventType);
          leadUpdate.buyingIntent = calculateBuyingIntent(
            leadForReply?.buyingIntent as number,
            replyOpenCount,
            replyClickCount,
            replyCount + 1
          );
          leadUpdate.status = "replied"; // Reply received!
          leadUpdate.lastEngagementAt = new Date().toISOString();
          
          // Update sequence reply counter
          if (outreach.sequenceId) {
            const seq = await db.emailSequence.findUnique({ where: { id: outreach.sequenceId } });
            if (seq) {
              await db.emailSequence.update({
                where: { id: outreach.sequenceId },
                data: { totalReplies: (seq.totalReplies || 0) + 1 },
              });
            }
          }
          
          results.push({
            event: "replied",
            emailId,
            outreachId: outreach.id,
            leadId: outreach.leadId || undefined,
            action: "LEAD_REPLIED — REVENUE OPPORTUNITY",
          });
          break;
        }

        // ===== EMAIL BOUNCED =====
        case "email.bounced":
          outreachUpdate.status = "bounced";
          outreachUpdate.bouncedAt = data.created_at || new Date().toISOString();
          outreachUpdate.errorMessage = `Bounced: ${data.reason || "unknown"}`;
          leadUpdate.status = "lost";
          leadUpdate.funnelStage = "closed_lost";
          leadUpdate.buyingIntent = 0;
          break;

        // ===== EMAIL COMPLAINED (spam report) =====
        case "email.complained":
          outreachUpdate.status = "bounced";
          outreachUpdate.bouncedAt = data.created_at || new Date().toISOString();
          outreachUpdate.errorMessage = "Marked as spam";
          leadUpdate.status = "lost";
          leadUpdate.funnelStage = "closed_lost";
          leadUpdate.buyingIntent = 0;
          break;

        default:
          console.log(`[Resend Webhook] Unhandled event type: ${eventType}`);
          continue;
      }

      // Apply outreach updates
      if (Object.keys(outreachUpdate).length > 0) {
        await db.emailOutreach.update({
          where: { id: outreach.id },
          data: outreachUpdate,
        });
      }

      // Apply lead updates
      if (outreach.leadId && Object.keys(leadUpdate).length > 0) {
        await db.lead.update({
          where: { id: outreach.leadId },
          data: { ...leadUpdate, updatedAt: new Date().toISOString() },
        });
      }
    }

    // Log revenue-critical events prominently
    const revenueEvents = results.filter(
      (r) => r.action === "lead_clicked_cta" || r.action.includes("REVENUE")
    );
    if (revenueEvents.length > 0) {
      console.log(
        `[Resend Webhook] REVENUE ALERT: ${revenueEvents.length} buying signal(s) detected:`,
        JSON.stringify(revenueEvents)
      );
    }

    return NextResponse.json({
      success: true,
      processed: events.length,
      revenueEvents: revenueEvents.length,
      details: results,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Resend Webhook] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET /api/webhooks/resend
// Health check + test endpoint
export async function GET() {
  return NextResponse.json({
    status: "ok",
    endpoint: "/api/webhooks/resend",
    events: [
      "email.sent",
      "email.delivered",
      "email.opened",
      "email.clicked",
      "email.replied",
      "email.bounced",
      "email.complained",
    ],
    signatureVerification: !!process.env.RESEND_WEBHOOK_SECRET,
    timestamp: new Date().toISOString(),
  });
}
