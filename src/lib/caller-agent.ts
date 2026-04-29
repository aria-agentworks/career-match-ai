// src/lib/caller-agent.ts
// Microsoft VibeVoice Powered Caller Agent
// Manages call queue, generates personalized scripts per product, tracks call outcomes
// The actual TTS/Voice call execution happens client-side via VibeVoice

// ========== Types ==========

export interface CallerAgentLead {
  leadId: string;
  firstName: string;
  lastName: string;
  phone: string;
  company: string;
  product: string;
  script: string;
  status: "pending" | "script_ready" | "call_pending" | "call_completed" | "call_failed";
  callOutcome?: string;
  callDuration?: number;
  scheduledAt?: string;
  completedAt?: string;
  errorMessage?: string;
}

export interface CallScript {
  leadId: string;
  product: string;
  opening: string;
  pitch: string;
  handlingObjections: string;
  closing: string;
  fallbackIfNoAnswer: string;
  estimatedDuration: string;
}

export interface CallQueueSummary {
  productId?: string;
  total: number;
  pending: number;
  scriptReady: number;
  callPending: number;
  completed: number;
  failed: number;
  leads: CallerAgentLead[];
}

export interface CallOutcome {
  success: boolean;
  leadId: string;
  outcome: "answered_interested" | "answered_not_interested" | "voicemail" | "no_answer" | "busy" | "wrong_number" | "callback_requested" | "call_failed";
  notes?: string;
  callDuration?: number;
}

export interface ProcessQueueResult {
  processed: number;
  scriptsGenerated: number;
  queued: number;
  errors: string[];
  details: Array<{
    leadId: string;
    action: string;
    message: string;
  }>;
}

// ========== Script Generation ==========

async function generateVoiceScript(
  lead: {
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
    companyName?: string | null;
    industry?: string | null;
    location?: string | null;
    notes?: string | null;
  },
  productConfig: {
    productName: string;
    productTagline: string;
    productUrl: string;
    painPoints: string[];
    valueProposition: string;
    emailAngle: string;
    priceLabel: string;
  },
): Promise<CallScript> {
  const { nvidiaChat } = await import("./smart-brain");

  const prompt = `You are creating a PHONE CALL SCRIPT for an AI voice agent that will call this person.

PERSON: ${lead.firstName} ${lead.lastName}
ROLE: ${lead.jobTitle || "Owner"} at ${lead.companyName || "their company"} (${lead.industry || "unknown"})
CONTEXT: ${lead.notes || "No additional context"}

PRODUCT: ${productConfig.productName} — ${productConfig.productTagline}
URL: ${productConfig.productUrl}
PRICE: ${productConfig.priceLabel}
PAIN POINTS: ${productConfig.painPoints.slice(0, 3).join(", ")}
VALUE PROP: ${productConfig.valueProposition}
APPROACH: ${productConfig.emailAngle}

Create a CONVERSATIONAL phone script (not robotic). The AI voice agent will read this script.

Output ONLY JSON:
{
  "opening": "Hi [firstName], this is Alex from [company]. I'm calling because [specific reason related to their business]. Do you have a quick 30 seconds?",
  "pitch": "The main value proposition tailored to their specific situation. 2-3 sentences max.",
  "handlingObjections": "If they say 'not interested' → [response]. If they say 'send me an email' → [response]. If they say 'too expensive' → [response].",
  "closing": "Would it be okay if I sent you a quick follow-up email with more details? What's the best email to reach you?",
  "fallbackIfNoAnswer": "Leave a voicemail: Hi [firstName], this is Alex from [company]. I was reaching out about [one-line value prop]. You can check it out at [url] or I can email you. Have a great day!",
  "estimatedDuration": "30-45 seconds"
}`;

  try {
    const result = await nvidiaChat(
      [
        {
          role: "system",
          content:
            "You create phone scripts for AI voice agents. Be conversational, natural, and persuasive. Output ONLY valid JSON. No markdown.",
        },
        { role: "user", content: prompt },
      ],
      500,
    );

    let cleaned = result.trim();
    if (cleaned.startsWith("```"))
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in script generation");

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      leadId: "",
      product: productConfig.productName,
      opening: (parsed.opening || "").replace(/\[firstName\]/g, lead.firstName),
      pitch: parsed.pitch || productConfig.valueProposition,
      handlingObjections: parsed.handlingObjections || "Redirect to email follow-up.",
      closing: (parsed.closing || "").replace(/\[url\]/g, productConfig.productUrl),
      fallbackIfNoAnswer: (parsed.fallbackIfNoAnswer || "")
        .replace(/\[firstName\]/g, lead.firstName)
        .replace(/\[url\]/g, productConfig.productUrl),
      estimatedDuration: parsed.estimatedDuration || "30-45 seconds",
    };
  } catch {
    return {
      leadId: "",
      product: productConfig.productName,
      opening: `Hi ${lead.firstName}, this is Alex from ${productConfig.productName}. I'm calling because I think we can help ${lead.companyName || "your business"} with ${productConfig.painPoints[0] || "efficiency"}. Do you have a quick 30 seconds?`,
      pitch: productConfig.valueProposition,
      handlingObjections:
        "If not interested: 'No worries, I'll send a quick email for when the time is right.' If send email: 'Absolutely, what's the best email?'",
      closing: `I'll send you an email with more details at ${productConfig.productUrl}. Thanks for your time, ${lead.firstName}!`,
      fallbackIfNoAnswer: `Hi ${lead.firstName}, this is Alex from ${productConfig.productName}. I was reaching out about helping with ${productConfig.painPoints[0] || "your business"}. Check us out at ${productConfig.productUrl}. Have a great day!`,
      estimatedDuration: "30-45 seconds",
    };
  }
}

// ========== Core Functions ==========

/**
 * Queue a lead for phone outreach via the Caller Agent
 */
export async function queueLeadForCall(
  leadId: string,
  phone: string,
  productId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await import("./db");

    if (!phone || typeof phone !== "string" || phone.trim().length < 7) {
      return { success: false, error: "Valid phone number is required (min 7 digits)" };
    }

    // Update the lead with caller queue status
    await db.lead.update({
      where: { id: leadId },
      data: {
        phone: phone.trim(),
        caller_queued: true,
        caller_status: "pending",
      },
    });

    console.log(`[CallerAgent] Queued lead ${leadId} (${phone}) for product ${productId}`);

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to queue lead";
    return { success: false, error: message };
  }
}

/**
 * Generate a personalized voice call script for a specific lead and product
 */
export async function generateCallScript(
  lead: {
    id: string;
    firstName: string;
    lastName: string;
    jobTitle?: string | null;
    companyName?: string | null;
    industry?: string | null;
    location?: string | null;
    notes?: string | null;
  },
  productConfig: {
    productName: string;
    productTagline: string;
    productUrl: string;
    painPoints: string[];
    valueProposition: string;
    emailAngle: string;
    priceLabel: string;
  },
): Promise<CallScript> {
  const script = await generateVoiceScript(lead, productConfig);
  script.leadId = lead.id;
  return script;
}

/**
 * Get the call queue — leads that are queued for phone outreach
 * Optionally filter by product ID
 */
export async function getCallQueue(productId?: string): Promise<CallerAgentLead[]> {
  try {
    const { db } = await import("./db");

    const where: Record<string, unknown> = {
      caller_queued: true,
    };

    if (productId) {
      where.targetProduct = productId;
    }

    const leads = await db.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return leads.map((lead) => ({
      leadId: lead.id,
      firstName: lead.firstName || "Unknown",
      lastName: lead.lastName || "",
      phone: lead.phone || "N/A",
      company: lead.companyName || "Unknown",
      product: lead.targetProduct || "Unknown",
      script: lead.notes || "",
      status:
        (lead.caller_status as CallerAgentLead["status"]) || "pending",
      callOutcome: lead.notes?.includes("call_outcome:")
        ? lead.notes.split("call_outcome:")[1]?.trim()
        : undefined,
    }));
  } catch (error: unknown) {
    console.error(
      "[CallerAgent] Failed to get call queue:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * Process the call queue — generate scripts for all pending leads
 * The actual voice call happens client-side via VibeVoice; this prepares the data
 */
export async function processCallQueue(): Promise<ProcessQueueResult> {
  const { db } = await import("./db");
  const { PRODUCT_AGENT_CONFIGS } = await import("./lead-agent");

  const result: ProcessQueueResult = {
    processed: 0,
    scriptsGenerated: 0,
    queued: 0,
    errors: [],
    details: [],
  };

  console.log("[CallerAgent] Processing call queue...");

  try {
    // Get all leads queued for calls
    const queuedLeads = await db.lead.findMany({
      where: { caller_queued: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    if (queuedLeads.length === 0) {
      result.details.push({
        leadId: "none",
        action: "queue_check",
        message: "No leads in call queue",
      });
      return result;
    }

    result.details.push({
      leadId: "batch",
      action: "queue_check",
      message: `Found ${queuedLeads.length} leads in call queue`,
    });

    // Process each lead
    for (const lead of queuedLeads) {
      try {
        const productId = lead.targetProduct || "AriaAgent";
        const productConfig = PRODUCT_AGENT_CONFIGS[productId];

        if (!productConfig) {
          result.errors.push(
            `Lead ${lead.id}: No product config for ${productId}`,
          );
          continue;
        }

        // Skip leads that already have a script ready
        if (lead.caller_status === "script_ready" || lead.caller_status === "call_completed") {
          result.processed++;
          continue;
        }

        // Generate personalized call script
        const script = await generateVoiceScript(
          {
            firstName: lead.firstName || "there",
            lastName: lead.lastName || "",
            jobTitle: lead.jobTitle,
            companyName: lead.companyName,
            industry: lead.industry,
            location: lead.location,
            notes: lead.notes,
          },
          {
            productName: productConfig.productName,
            productTagline: productConfig.productTagline,
            productUrl: productConfig.productUrl,
            painPoints: productConfig.painPoints,
            valueProposition: productConfig.valueProposition,
            emailAngle: productConfig.emailAngle,
            priceLabel: productConfig.priceLabel,
          },
        );

        // Combine the full script for storage
        const fullScript = [
          `--- OPENING ---\n${script.opening}`,
          `--- PITCH ---\n${script.pitch}`,
          `--- OBJECTION HANDLING ---\n${script.handlingObjections}`,
          `--- CLOSING ---\n${script.closing}`,
          `--- VOICEMAIL FALLBACK ---\n${script.fallbackIfNoAnswer}`,
          `--- ESTIMATED DURATION: ${script.estimatedDuration} ---`,
        ].join("\n\n");

        // Update lead with script and mark as script_ready
        await db.lead.update({
          where: { id: lead.id },
          data: {
            caller_status: "script_ready",
            notes: [
              lead.notes || "",
              `\n\n[CALL_SCRIPT for ${productConfig.productName}]\n${fullScript}`,
            ]
              .filter(Boolean)
              .join(""),
          },
        });

        result.scriptsGenerated++;
        result.processed++;
        result.details.push({
          leadId: lead.id,
          action: "script_generated",
          message: `Generated ${script.estimatedDuration} script for ${lead.firstName} ${lead.lastName} (${productConfig.productName})`,
        });
      } catch (err) {
        result.errors.push(
          `Lead ${lead.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    console.log(
      `[CallerAgent] Queue processed — scripts:${result.scriptsGenerated} processed:${result.processed}`,
    );
  } catch (error: unknown) {
    result.errors.push(
      `Queue processing failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return result;
}

/**
 * Report the outcome of a call attempt
 */
export async function reportCallOutcome(
  leadId: string,
  outcome: CallOutcome["outcome"],
  notes?: string,
  callDuration?: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await import("./db");

    const validOutcomes: string[] = [
      "answered_interested",
      "answered_not_interested",
      "voicemail",
      "no_answer",
      "busy",
      "wrong_number",
      "callback_requested",
      "call_failed",
    ];

    if (!validOutcomes.includes(outcome)) {
      return {
        success: false,
        error: `Invalid outcome: ${outcome}. Valid: ${validOutcomes.join(", ")}`,
      };
    }

    // Determine the new caller_status
    let newStatus: string;
    switch (outcome) {
      case "answered_interested":
      case "callback_requested":
        newStatus = "call_completed";
        break;
      case "answered_not_interested":
      case "wrong_number":
        newStatus = "call_completed";
        break;
      case "voicemail":
      case "no_answer":
      case "busy":
        newStatus = "call_pending"; // Retry later
        break;
      case "call_failed":
        newStatus = "call_failed";
        break;
      default:
        newStatus = "call_completed";
    }

    // Update lead
    await db.lead.update({
      where: { id: leadId },
      data: {
        caller_status: newStatus,
        notes: [
          `call_outcome: ${outcome}`,
          callDuration ? `call_duration: ${callDuration}s` : "",
          notes || "",
        ]
          .filter(Boolean)
          .join(" | "),
        funnel_stage:
          outcome === "answered_interested" || outcome === "callback_requested"
            ? "hot_lead"
            : newStatus === "call_completed"
              ? "contacted"
              : "new",
        buying_intent:
          outcome === "answered_interested"
            ? 80
            : outcome === "callback_requested"
              ? 70
              : outcome === "answered_not_interested"
                ? 10
                : undefined,
      },
    });

    // If interested or callback requested, send a follow-up email
    if (outcome === "answered_interested" || outcome === "callback_requested") {
      try {
        const lead = await db.lead.findUnique({ where: { id: leadId } });
        if (lead?.email) {
          const { sendEmail } = await import("./email");
          const { PRODUCT_AGENT_CONFIGS } = await import("./lead-agent");

          const productId = lead.targetProduct || "AriaAgent";
          const config = PRODUCT_AGENT_CONFIGS[productId];

          if (config) {
            await sendEmail({
              to: lead.email,
              subject: `Great chatting with you, ${lead.firstName || "there"}!`,
              html: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; color: #1a1a1a; line-height: 1.7; font-size: 15px;">
  <p>Hi ${lead.firstName || "there"},</p>
  <p>It was great speaking with you earlier. As promised, here are the details about ${config.productName}:</p>
  <p><strong>${config.productTagline}</strong></p>
  <p>${config.valueProposition}</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="${config.priceLabel === "Free" ? config.productUrl : `${process.env.NEXTAUTH_URL || "https://my-project-aa-apps.vercel.app"}/api/payments/checkout?productId=${config.productId}`}" style="background-color: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">${config.priceLabel === "Free" ? "Get Started Free" : `Start Now — ${config.priceLabel}`}</a>
  </div>
  ${config.priceLabel !== "Free" ? `<p style="text-align: center; font-size: 13px; color: #666; margin-top: 4px;">Secure checkout via Razorpay</p>` : ""}
  <p>Looking forward to hearing from you.</p>
  <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; font-size: 13px; color: #888;">
    ${config.productName} — ${config.productTagline} ${config.priceLabel !== "Free" ? `— <strong>${config.priceLabel}</strong>` : ""}
  </div>
</div>`,
              replyTo: "hello@ariaagent.agency",
            });

            await db.emailOutreach.create({
              data: {
                leadId: lead.id,
                toEmail: lead.email,
                toName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim(),
                subject: `Great chatting with you, ${lead.firstName || "there"}!`,
                body: `Follow-up after phone call. Outcome: ${outcome}.`,
                product: productId,
                status: "sent",
                sentAt: new Date().toISOString(),
                stepNumber: 2,
              },
            });
          }
        }
      } catch (emailErr) {
        console.error(
          "[CallerAgent] Follow-up email failed:",
          emailErr instanceof Error ? emailErr.message : emailErr,
        );
      }
    }

    console.log(
      `[CallerAgent] Call outcome: ${leadId} → ${outcome} (status: ${newStatus})`,
    );

    return { success: true };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to report call outcome";
    return { success: false, error: message };
  }
}
