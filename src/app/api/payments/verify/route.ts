// src/app/api/payments/verify/route.ts
// POST /api/payments/verify — Verify a Razorpay payment

import { NextRequest, NextResponse } from "next/server";
import { verifyPayment } from "@/lib/razorpay";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = body;

    // Validate required fields
    if (!razorpayOrderId || typeof razorpayOrderId !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid razorpayOrderId is required" },
        { status: 400 },
      );
    }

    if (!razorpayPaymentId || typeof razorpayPaymentId !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid razorpayPaymentId is required" },
        { status: 400 },
      );
    }

    if (!razorpaySignature || typeof razorpaySignature !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid razorpaySignature is required" },
        { status: 400 },
      );
    }

    const result = await verifyPayment(
      razorpayPaymentId.trim(),
      razorpayOrderId.trim(),
      razorpaySignature.trim(),
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: "Payment verified successfully",
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: result.error || "Payment verification failed",
      },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[VerifyPayment] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
