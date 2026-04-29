const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_BASE_URL = "https://api.resend.com";
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export async function sendEmail({
  to,
  subject,
  html,
  replyTo,
}: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<{ success: boolean; emailId?: string; error?: string }> {
  if (!RESEND_API_KEY || RESEND_API_KEY === "re_xxxxxxxxxxxx") {
    // No real API key configured — simulate success for development
    console.log(`[Email] RESEND_API_KEY not configured. Would send to: ${to}, subject: ${subject}`);
    return {
      success: true,
      emailId: `dev_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      error: undefined,
    };
  }

  try {
    const body: Record<string, unknown> = {
      from: FROM_EMAIL,
      to: [to],
      subject,
      html,
    };

    if (replyTo) {
      body.reply_to = replyTo;
    }

    const response = await fetch(`${RESEND_BASE_URL}/emails`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data?.message || data?.error?.message || `HTTP ${response.status}`;
      return { success: false, error: errorMsg };
    }

    return {
      success: true,
      emailId: data.id,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error sending email";
    return { success: false, error: message };
  }
}
