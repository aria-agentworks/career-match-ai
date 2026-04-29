// src/lib/razorpay.ts
// Razorpay Payment Integration — Orders, Verification, Subscriptions, Payment Links, Webhooks
// Uses native fetch — no external npm packages required

const RAZORPAY_BASE = "https://api.razorpay.com/v1";

// ========== Types ==========

export interface RazorpayOrder {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  offer_id: string | null;
  status: string;
  attempts: number;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpayOrderResult {
  success: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  receipt?: string;
  error?: string;
}

export interface RazorpayVerifyResult {
  success: boolean;
  error?: string;
}

export interface RazorpaySubscription {
  id: string;
  entity: string;
  plan_id: string;
  customer_id: string;
  status: string;
  current_start: number;
  current_end: number;
  total_count: number;
  paid_count: number;
  short_url: string;
  notes: Record<string, string>;
  created_at: number;
}

export interface RazorpaySubscriptionResult {
  success: boolean;
  subscriptionId?: string;
  shortUrl?: string;
  status?: string;
  error?: string;
}

export interface RazorpayPaymentLink {
  id: string;
  entity: string;
  url: string;
  short_url: string;
  reference_id: string;
  amount: number;
  currency: string;
  description: string;
  status: string;
  created_at: number;
}

export interface RazorpayPaymentLinkResult {
  success: boolean;
  paymentUrl?: string;
  shortUrl?: string;
  linkId?: string;
  error?: string;
}

export interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment: {
      entity: {
        id: string;
        entity: string;
        amount: number;
        currency: string;
        status: string;
        order_id: string;
        invoice_id: string | null;
        international: boolean;
        method: string;
        amount_refunded: number;
        refund_status: string | null;
        captured: boolean;
        description: string;
        card_id: string | null;
        bank: string | null;
        wallet: string | null;
        vpa: string | null;
        email: string;
        contact: string;
        customer_id: string;
        token: string | null;
        notes: Record<string, string>;
        fee: number;
        tax: number;
        error_code: string | null;
        error_description: string | null;
        created_at: number;
      };
    };
  };
}

// ========== Auth Helpers ==========

function getAuthHeader(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables are required");
  }

  const authString = `${keyId}:${keySecret}`;
  const encoded = Buffer.from(authString).toString("base64");
  return `Basic ${encoded}`;
}

async function razorpayRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
  } = {},
): Promise<T> {
  const url = `${RAZORPAY_BASE}${path}`;
  const method = options.method || "GET";

  const fetchOptions: RequestInit = {
    method,
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  };

  if (options.body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    fetchOptions.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorBody = await response.text();
      let errorMessage = `Razorpay API error: ${response.status}`;
      try {
        const parsed = JSON.parse(errorBody);
        errorMessage = parsed?.error?.description || parsed?.message || errorMessage;
      } catch {
        // keep default error message
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data as T;
  } catch (error: unknown) {
    if (error instanceof Error) {
      throw new Error(`Razorpay request failed: ${error.message}`);
    }
    throw new Error("Razorpay request failed with unknown error");
  }
}

// ========== HMAC-SHA256 Verification ==========

async function hmacSha256(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return Buffer.from(signature).toString("hex");
}

// ========== Core Functions ==========

/**
 * Create a Razorpay order for a payment
 * @param amount - Amount in INR (will be converted to paise internally)
 * @param productId - Product identifier for receipt tracking
 * @param customerEmail - Customer email for record keeping
 * @param customerName - Customer name for receipt
 */
export async function createOrder(
  amount: number,
  productId: string,
  customerEmail: string,
  customerName: string,
): Promise<RazorpayOrderResult> {
  try {
    const receipt = `rcpt_${productId}_${Date.now()}`;
    const amountInPaise = Math.round(amount * 100); // Convert INR to paise

    const order = await razorpayRequest<RazorpayOrder>("/orders", {
      method: "POST",
      body: {
        amount: amountInPaise,
        currency: "INR",
        receipt,
        notes: {
          productId,
          customerEmail,
          customerName,
          createdAt: new Date().toISOString(),
        },
      },
    });

    return {
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create order";
    return { success: false, error: message };
  }
}

/**
 * Verify a Razorpay payment signature
 * @param paymentId - Razorpay payment ID
 * @param orderId - Razorpay order ID
 * @param signature - Razorpay signature from frontend
 */
export async function verifyPayment(
  paymentId: string,
  orderId: string,
  signature: string,
): Promise<RazorpayVerifyResult> {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      return { success: false, error: "RAZORPAY_KEY_SECRET not configured" };
    }

    const data = `${orderId}|${paymentId}`;
    const expectedSignature = await hmacSha256(data, secret);

    if (expectedSignature === signature) {
      return { success: true };
    }

    return { success: false, error: "Invalid payment signature" };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment verification failed";
    return { success: false, error: message };
  }
}

/**
 * Create a Razorpay subscription for recurring payments
 * @param planId - Razorpay plan ID
 * @param customerId - Razorpay customer ID
 */
export async function createSubscription(
  planId: string,
  customerId: string,
): Promise<RazorpaySubscriptionResult> {
  try {
    const subscription = await razorpayRequest<RazorpaySubscription>("/subscriptions", {
      method: "POST",
      body: {
        plan_id: planId,
        customer_id: customerId,
        total_count: 12, // 12 billing cycles (1 year)
        quantity: 1,
        notes: {
          source: "aria-marketing-hub",
          createdAt: new Date().toISOString(),
        },
      },
    });

    return {
      success: true,
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url,
      status: subscription.status,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create subscription";
    return { success: false, error: message };
  }
}

/**
 * Create a Razorpay payment link for easy checkout
 * @param productId - Product identifier
 * @param amount - Amount in INR
 */
export async function getPaymentLink(
  productId: string,
  amount: number,
): Promise<RazorpayPaymentLinkResult> {
  try {
    const amountInPaise = Math.round(amount * 100);
    const referenceId = `plink_${productId}_${Date.now()}`;

    const link = await razorpayRequest<RazorpayPaymentLink>("/payment_links", {
      method: "POST",
      body: {
        amount: amountInPaise,
        currency: "INR",
        accept_partial: false,
        reference_id: referenceId,
        description: `Payment for ${productId}`,
        customer: {
          name: "",
          contact: "",
          email: "",
        },
        notify: {
          sms: true,
          email: true,
        },
        reminder_enable: true,
        notes: {
          productId,
          source: "aria-marketing-hub",
        },
        callback_url: `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/payments/webhook`,
        callback_method: "post",
      },
    });

    return {
      success: true,
      paymentUrl: link.url,
      shortUrl: link.short_url,
      linkId: link.id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create payment link";
    return { success: false, error: message };
  }
}

// ========== Webhook Verification ==========

/**
 * Verify a Razorpay webhook signature
 * @param body - Raw request body as string
 * @param signature - X-Razorpay-Signature header value
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string,
): Promise<boolean> {
  try {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
      console.error("[Razorpay] RAZORPAY_KEY_SECRET not configured for webhook verification");
      return false;
    }

    const expectedSignature = await hmacSha256(body, secret);
    return expectedSignature === signature;
  } catch (error: unknown) {
    console.error("[Razorpay] Webhook signature verification failed:", error);
    return false;
  }
}

/**
 * Process a payment.captured webhook event
 * Saves payment data to Revenue table in Supabase
 */
export async function processWebhookEvent(payload: RazorpayWebhookPayload): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (payload.event !== "payment.captured") {
      return { success: true }; // Not our target event, skip gracefully
    }

    const payment = payload.payload?.payment?.entity;
    if (!payment) {
      return { success: false, error: "Invalid webhook payload: missing payment entity" };
    }

    const { db } = await import("./db");

    // Save payment to Lead table with revenue tracking fields
    // Update existing lead if found by email, otherwise create new
    const existingLead = payment.email
      ? await db.lead.findFirst({ where: { email: payment.email } })
      : null;

    const paymentData = {
      paymentId: payment.id,
      orderId: payment.order_id,
      amount: payment.amount / 100,
      currency: payment.currency,
      method: payment.method,
      captured: payment.captured,
      description: payment.description,
      fee: payment.fee ? payment.fee / 100 : 0,
      tax: payment.tax ? payment.tax / 100 : 0,
    };

    if (existingLead) {
      await db.lead.update({
        where: { id: existingLead.id },
        data: {
          status: "paid",
          funnel_stage: "paid",
          buying_intent: 100,
          score: 100,
          notes: JSON.stringify({
            ...(existingLead.notes ? JSON.parse(existingLead.notes || "{}") : {}),
            razorpay: paymentData,
          }),
          tags: `${existingLead.tags || ""},razorpay-paid,${payment.notes?.productId || "unknown"}`.replace(/^,/, ""),
        },
      });
    } else {
      await db.lead.create({
        data: {
          email: payment.email,
          firstName: payment.notes?.customerName || "Unknown",
          lastName: "",
          companyName: payment.notes?.companyName || "Web Payment",
          notes: JSON.stringify(paymentData),
          source: "razorpay-payment",
          targetProduct: payment.notes?.productId || null,
          status: "paid",
          score: 100,
          funnel_stage: "paid",
          buying_intent: 100,
          tags: `razorpay-paid,${payment.notes?.productId || "unknown"}`,
        },
      });
    }

    console.log(`[Razorpay] Payment captured: ${payment.id} — ₹${payment.amount / 100} from ${payment.email}`);

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    console.error("[Razorpay] Webhook processing error:", message);
    return { success: false, error: message };
  }
}
