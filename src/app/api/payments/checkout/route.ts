// src/app/api/payments/checkout/route.ts
// GET /api/payments/checkout?productId=xxx — Redirect to Razorpay hosted checkout
// This is the URL used in email CTAs — when a lead clicks, they go straight to payment

import { NextRequest, NextResponse } from "next/server";
import { getPaymentLink } from "@/lib/razorpay";
import { PRODUCTS } from "@/lib/products";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { success: false, error: "productId query param is required" },
        { status: 400 },
      );
    }

    const product = PRODUCTS[productId];
    if (!product) {
      return NextResponse.json(
        { success: false, error: `Unknown product: ${productId}` },
        { status: 404 },
      );
    }

    // Free products -> redirect to product page
    if (product.pricing.free) {
      return NextResponse.redirect(product.url, 302);
    }

    // Paid products -> create Razorpay payment link and redirect
    const result = await getPaymentLink(product.id, product.pricing.amount);

    if (!result.success || !result.shortUrl) {
      // Fallback: redirect to product page if payment link fails
      console.error(`[Checkout] Payment link failed for ${productId}: ${result.error}`);
      return NextResponse.redirect(product.url, 302);
    }

    return NextResponse.redirect(result.shortUrl, 302);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[Checkout] Error:", message);
    return NextResponse.redirect("https://ariaagent.agency", 302);
  }
}
