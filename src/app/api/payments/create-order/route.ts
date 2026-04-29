// src/app/api/payments/create-order/route.ts
// POST /api/payments/create-order — Create a Razorpay payment order

import { NextRequest, NextResponse } from "next/server";
import { createOrder } from "@/lib/razorpay";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, productId, customerEmail, customerName } = body;

    // Validate required fields
    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid amount is required (positive number in INR)" },
        { status: 400 },
      );
    }

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid productId is required" },
        { status: 400 },
      );
    }

    if (!customerEmail || typeof customerEmail !== "string" || !customerEmail.includes("@")) {
      return NextResponse.json(
        { success: false, error: "Valid customerEmail is required" },
        { status: 400 },
      );
    }

    if (!customerName || typeof customerName !== "string") {
      return NextResponse.json(
        { success: false, error: "Valid customerName is required" },
        { status: 400 },
      );
    }

    const result = await createOrder(amount, productId.trim(), customerEmail.trim(), customerName.trim());

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Failed to create order" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      amount: result.amount,
      currency: result.currency || "INR",
      razorpayKey: process.env.RAZORPAY_KEY_ID || "",
      receipt: result.receipt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[CreateOrder] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
