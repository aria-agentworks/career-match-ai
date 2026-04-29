// src/app/api/payments/link/route.ts
// POST /api/payments/link — Create a Razorpay payment link

import { NextRequest, NextResponse } from "next/server";
import { getPaymentLink } from "@/lib/razorpay";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, amount } = body;

    // Validate required fields
    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid productId is required" },
        { status: 400 },
      );
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid amount is required (positive number in INR)" },
        { status: 400 },
      );
    }

    const result = await getPaymentLink(productId.trim(), amount);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to create payment link" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      paymentUrl: result.paymentUrl,
      shortUrl: result.shortUrl,
      linkId: result.linkId,
      productId,
      amount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[PaymentLink] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
