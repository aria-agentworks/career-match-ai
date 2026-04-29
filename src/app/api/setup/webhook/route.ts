import { NextResponse } from "next/server";

// POST /api/setup/webhook
// Programmatically registers the Resend webhook via API
export async function POST(request: Request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (!apiKey || apiKey === "re_xxxxxxxxxxxx") {
      return NextResponse.json(
        { success: false, error: "RESEND_API_KEY not configured" },
        { status: 400 }
      );
    }

    // Parse optional custom URL from body
    let endpointUrl = "https://career-match-aa-aa-apps.vercel.app/api/webhooks/resend";
    try {
      const body = await request.json();
      if (body?.url) endpointUrl = body.url;
    } catch { /* use default URL */ }

    const events = [
      "email.sent",
      "email.delivered",
      "email.opened",
      "email.clicked",
      "email.replied",
      "email.bounced",
      "email.complained",
    ];

    // Create webhook via Resend API
    const response = await fetch("https://api.resend.com/webhooks", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: endpointUrl,
        events,
        name: "Aria Revenue Tracker",
      }),
    });

    const data = await response.json();
    console.log("[Webhook Setup] Resend response:", JSON.stringify(data));

    if (!response.ok) {
      // If webhook already exists, list existing ones
      if (data?.message?.includes("already") || response.status === 422) {
        const listRes = await fetch("https://api.resend.com/webhooks", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
        });
        const existing = await listRes.json();
        return NextResponse.json({
          success: true,
          message: "Webhook may already exist",
          existing: existing.webhooks || [],
          suggestedUrl: endpointUrl,
          events,
          secretConfigured: !!webhookSecret,
          action: "Check Resend dashboard to confirm or update the webhook URL",
        });
      }

      return NextResponse.json(
        { success: false, error: data?.message || `HTTP ${response.status}`, details: data },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      webhook: data,
      url: endpointUrl,
      events,
      secretConfigured: !!webhookSecret,
      nextStep: webhookSecret
        ? "Webhook is fully configured. Revenue tracking is now active."
        : "WARNING: RESEND_WEBHOOK_SECRET not set in Vercel env. Add it for signature verification.",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Webhook Setup] Error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// GET /api/setup/webhook
// Check current webhook status
export async function GET() {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (!apiKey || apiKey === "re_xxxxxxxxxxxx") {
      return NextResponse.json(
        { success: false, error: "RESEND_API_KEY not configured" },
        { status: 400 }
      );
    }

    // List existing webhooks
    const response = await fetch("https://api.resend.com/webhooks", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    return NextResponse.json({
      webhooks: data.webhooks || [],
      secretConfigured: !!webhookSecret,
      secretPrefix: webhookSecret ? webhookSecret.substring(0, 10) + "..." : "NOT SET",
      status: "ok",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
