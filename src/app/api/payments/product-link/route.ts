// src/app/api/payments/product-link/route.ts
// POST /api/payments/product-link — Generate Razorpay payment link for any product
// Returns a hosted checkout URL that can be embedded in emails

import { NextRequest, NextResponse } from "next/server";
import { getPaymentLink } from "@/lib/razorpay";
import { PRODUCTS } from "@/lib/products";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId } = body;

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { success: false, error: "productId is required" },
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

    if (product.pricing.free) {
      return NextResponse.json({
        success: true,
        paymentUrl: product.url,
        shortUrl: product.url,
        productId: product.id,
        productName: product.name,
        priceLabel: product.pricing.label,
        isFree: true,
      });
    }

    const result = await getPaymentLink(product.id, product.pricing.amount);

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
      productId: product.id,
      productName: product.name,
      priceLabel: product.pricing.label,
      amount: product.pricing.amount,
      isFree: false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[ProductPaymentLink] Error:", message);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
