// src/app/api/payments/webhook/route.ts
// POST /api/payments/webhook — Razorpay webhook handler for payment.captured events

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, processWebhookEvent } from "@/lib/razorpay";
import type { RazorpayWebhookPayload } from "@/lib/razorpay";

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const signature = request.headers.get("X-Razorpay-Signature");

    if (!signature) {
      console.error("[Webhook] Missing X-Razorpay-Signature header");
      return NextResponse.json(
        { success: false, error: "Missing signature header" },
        { status: 400 },
      );
    }

    // Verify webhook signature
    const isValid = await verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.error("[Webhook] Invalid signature — rejecting webhook");
      return NextResponse.json(
        { success: false, error: "Invalid signature" },
        { status: 401 },
      );
    }

    // Parse the webhook payload
    let payload: RazorpayWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as RazorpayWebhookPayload;
    } catch {
      console.error("[Webhook] Failed to parse JSON body");
      return NextResponse.json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 },
      );
    }

    // Log the event for debugging
    console.log(`[Webhook] Received Razorpay event: ${payload.event}`);

    // Process the event
    const result = await processWebhookEvent(payload);

    if (!result.success) {
      console.error("[Webhook] Event processing failed:", result.error);
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      event: payload.event,
      processed: true,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[Webhook] Unhandled error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
