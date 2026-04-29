// src/lib/orchestrator.ts
// The Autonomous Marketing Loop Engine
// Run cycle: Discover → Enrich → Contact → Follow-up → Detect Replies → Close

import { db, LeadRow } from "./db";
import { sendEmail } from "./email";
import { generatePersonalizedEmail, generateSequence, queryLLM } from "./brain";
import { searchPeople, nlToFilters, findEmail } from "./explee";
import { PRODUCTS } from "./products";

// Validate email: must be ASCII-only and proper format
function isValidEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const [local, domain] = email.split("@");
  if (!local || !domain || !domain.includes(".")) return false;
  // Reject non-ASCII characters (Chinese names, etc.)
  if (!/^[\x00-\x7F]+$/.test(email)) return false;
  // Basic local part validation
  if (!/^[a-zA-Z0-9._%+\-]+$/.test(local)) return false;
  return true;
}

// Per-product target personas for lead discovery
const PRODUCT_TARGETS: Record<string, {
  companyQuery: string;
  jobTitles: string[];
  outreachGoal: string;
  idealCustomerProfile: string;
}> = {
  AriaAgent: {
    companyQuery: "digital marketing agencies, content creation platforms, SaaS startups under 50 employees",
    jobTitles: ["Founder", "CEO", "VP Marketing", "Head of Growth", "Marketing Director", "Content Manager"],
    outreachGoal: "Get founders and marketers to use the free AI tools",
    idealCustomerProfile: "Founders and marketing leaders at small-to-mid SaaS companies who need content tools but can't afford enterprise solutions"
  },
  SalesIntelligenceMCP: {
    companyQuery: "B2B SaaS companies, sales tech startups, CRM companies",
    jobTitles: ["Founder", "CEO", "VP Sales", "Head of Sales", "Sales Director", "SDR Manager"],
    outreachGoal: "Get sales teams using the MCP server for AI-powered sales research",
    idealCustomerProfile: "Sales leaders at B2B companies who use Claude/AI tools and need better sales intelligence"
  },
  SaaSAuditScanner: {
    companyQuery: "SaaS startups, venture-backed companies, product-led growth companies",
    jobTitles: ["Founder", "CEO", "CTO", "VP Product", "Product Manager"],
    outreachGoal: "Get SaaS founders to audit their products",
    idealCustomerProfile: "SaaS founders who are iterating on product-market fit and want competitive intelligence"
  },
  ShipProof: {
    companyQuery: "Amazon sellers, Flipkart sellers, ecommerce brands, D2C brands, Shopify stores, marketplace sellers",
    jobTitles: ["Founder", "CEO", "Operations Manager", "Fulfillment Director", "Ecommerce Manager", "Warehouse Manager"],
    outreachGoal: "Get ecommerce sellers using video proof infrastructure to reduce disputes",
    idealCustomerProfile: "Ecommerce sellers on Amazon, Flipkart, eBay, Meesho, Myntra, Ajio, or Shopify who lose money to fake buyer disputes and chargebacks"
  },
  SparkBill: {
    companyQuery: "freelance platforms, creative agencies, consulting businesses",
    jobTitles: ["Founder", "CEO", "Freelancer", "Agency Owner", "Consultant"],
    outreachGoal: "Get freelancers and agencies using AI invoicing",
    idealCustomerProfile: "Freelancers and small agency owners who spend too much time on invoicing and payment tracking"
  },
  NaiveVoiceAgent: {
    companyQuery: "dental practices, real estate agencies, home services, healthcare clinics",
    jobTitles: ["Founder", "CEO", "Office Manager", "Practice Manager", "Operations Director"],
    outreachGoal: "Get local businesses deploying AI voice agents",
    idealCustomerProfile: "Small business owners who need 24/7 phone coverage but can't afford to hire more staff"
  },
  NaiveLandingPage: {
    companyQuery: "SaaS startups, indie hackers, product launchers",
    jobTitles: ["Founder", "CEO", "VP Marketing", "Head of Growth", "Product Manager"],
    outreachGoal: "Get founders using AI-generated landing pages",
    idealCustomerProfile: "Indie hackers and startup founders who need to ship landing pages quickly for product launches"
  }
};

export interface OrchestratorRunResult {
  phase: string;
  stats: Record<string, number>;
  details: Array<{ product: string; action: string; count: number; message: string }>;
  errors: string[];
  timestamp: string;
}

// ===== PHASE 1: LEAD DISCOVERY =====
// Use Explee to discover new leads per product
async function discoverLeads(product: string, maxPerRun: number = 5): Promise<number> {
  const target = PRODUCT_TARGETS[product];
  if (!target) return 0;

  try {
    // Use natural language to filters for smart discovery
    const filters = await nlToFilters(
      `Find ${target.jobTitles.slice(0, 3).join(", ")} at ${target.companyQuery} that could benefit from ${product}`
    );

    const peopleResult = await searchPeople(
      target.jobTitles,
      target.companyQuery,
      {
        companyFilters: filters.companies_filters as Record<string, unknown> | undefined,
        peopleFilters: filters.people_filters as Record<string, unknown> | undefined,
      },
      maxPerRun
    );

    const people = peopleResult.people || peopleResult.results || [];
    let saved = 0;

    for (const person of people) {
      if (!person.first_name || !person.last_name) continue;

      // Check if already exists by email
      if (person.email) {
        const existing = await db.lead.findFirst({
          where: { email: person.email },
        });
        if (existing) continue;
      }

      // Also check by name + company to avoid duplicates
      const dupByName = await db.lead.findFirst({
        where: {
          firstName: person.first_name,
          companyName: person.company || undefined,
        },
      });
      if (dupByName) continue;

      await db.lead.create({
        data: {
          firstName: person.first_name,
          lastName: person.last_name,
          email: person.email || null,
          jobTitle: person.job_title || null,
          companyName: person.company || null,
          companyDomain: person.company_domain || null,
          linkedInUrl: person.linkedin_url || null,
          location: person.location || null,
          seniority: person.seniority || null,
          source: "explee-automated",
          targetProduct: product,
          status: "new",
          score: 50, // Base score, will be enriched
          tags: product,
        },
      });
      saved++;
    }

    return saved;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Orchestrator] Discover leads for ${product} failed:`, message);
    return 0;
  }
}

// ===== PHASE 2: LEAD ENRICHMENT =====
// Use AI to score and enrich leads (batch-limited for Vercel timeout)
async function enrichLeads(product: string, batchSize: number = 8): Promise<number> {
  const target = PRODUCT_TARGETS[product];
  if (!target) return 0;

  // Get unenriched leads (score <= 50 or null means not yet enriched by AI) — limit batch
  // We fetch all new leads and filter in-memory since Supabase can't do OR on null easily
  const leads = await db.lead.findMany({
    where: { targetProduct: product, status: "new" },
    take: batchSize * 2, // fetch extra to account for already-enriched
  });

  // Filter to only unenriched leads (score < 60)
  const unenriched = leads.filter(l => !l.score || l.score < 60).slice(0, batchSize);

  let enriched = 0;
  for (const lead of unenriched) {
    try {
      const prompt = `Score this lead's relevance for our product on a scale of 0-100. Also suggest the best outreach angle.

LEAD: ${lead.firstName || ""} ${lead.lastName || ""}
ROLE: ${lead.jobTitle || "Unknown"}
COMPANY: ${lead.companyName || "Unknown"}
INDUSTRY: ${lead.industry || "Unknown"}
LOCATION: ${lead.location || "Unknown"}

PRODUCT: ${PRODUCTS[product]?.name || product} — ${PRODUCTS[product]?.tagline || ""}
IDEAL CUSTOMER: ${target.idealCustomerProfile}

Output ONLY JSON:
{
  "score": number (0-100),
  "relevanceNotes": "brief explanation of why this lead is or isn't a good fit",
  "outreachAngle": "suggested specific angle for the cold email",
  "priority": "high" | "medium" | "low"
}`;

      const result = await queryLLM([
        { role: "system", content: "You are a lead scoring AI. Score leads based on fit with the product's ideal customer profile. Be strict - only score 80+ for genuinely good fits. Output ONLY JSON." },
        { role: "user", content: prompt },
      ], 500);

      let cleaned = result.content.trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

      const parsed = JSON.parse(cleaned);
      const score = Math.min(100, Math.max(0, parseInt(String(parsed.score)) || 50));

      await db.lead.update({
        where: { id: lead.id },
        data: {
          score,
          relevanceScore: score,
          notes: parsed.relevanceNotes || null,
        },
      });
      enriched++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Orchestrator] Enrich lead ${lead.id} failed:`, message);
    }
  }

  return enriched;
}

// ===== PHASE 2.5: FIND EMAILS =====
// Find email addresses for leads missing them using Explee + domain guessing fallback
async function findMissingEmails(product: string, maxLookups: number = 20): Promise<number> {
  // Get leads WITHOUT valid emails (any score, prioritized by score)
  const leads = await db.lead.findMany({
    where: { targetProduct: product, status: "new" },
    take: 100,
    orderBy: { score: 'desc' },
  });

  const noEmailLeads = leads
    .filter(l => !l.email || !l.email.includes("@"))
    .filter(l => l.companyDomain && l.firstName && l.lastName)
    .slice(0, maxLookups);

  let found = 0;
  for (const lead of noEmailLeads) {
    try {
      // Try Explee first
      const result = await findEmail(
        lead.firstName,
        lead.lastName,
        lead.companyDomain,
        "basic"
      );

      if (result.email && isValidEmail(result.email) && (result.email_status === "valid" || result.email_status === "risky" || result.email_status === "unknown")) {
        await db.lead.update({
          where: { id: lead.id },
          data: { email: result.email, updatedAt: new Date().toISOString() },
        });
        found++;
        continue;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Orchestrator] Explee email lookup for ${lead.firstName} failed:`, message);
    }

    // Fallback: domain-based email guessing
    const domain = lead.companyDomain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*/, '');
    const first = (lead.firstName || '').toLowerCase();
    const last = (lead.lastName || '').toLowerCase();
    const guesses = [
      `${first}@${domain}`,
      `${first}.${last}@${domain}`,
      `${first}${last}@${domain}`,
      `${first[0]}${last}@${domain}`,
    ];

    // Use the first guess — it will be validated when we try to send
    await db.lead.update({
      where: { id: lead.id },
      data: { email: guesses[0], updatedAt: new Date().toISOString() },
    });
    found++;
  }

  return found;
}

// ===== PHASE 3: SEND INITIAL EMAILS =====
// Send cold emails to new leads using pre-built sequence templates (instant, no LLM needed)
async function sendInitialEmails(product: string, maxPerRun: number = 15): Promise<number> {
  // Get the active sequence for this product (templates are already there)
  const activeSequence = await db.emailSequence.findFirst({
    where: { product, isActive: true },
  });

  interface SequenceStep {
    stepNumber: number;
    subject: string;
    body: string;
    waitDays: number;
  }
  let steps: SequenceStep[] = [];
  if (activeSequence) {
    try { steps = JSON.parse(activeSequence.steps || "[]"); } catch { /* */ }
  }

  const stepOne = steps.find(s => s.stepNumber === 1);
  const productInfo = PRODUCTS[product];

  const leads = await db.lead.findMany({
    where: {
      status: "new",
      targetProduct: product,
    },
    take: 100,
  });

  // Filter to leads WITH valid emails, sorted by score descending
  const leadsWithEmail = leads
    .filter(l => l.email && isValidEmail(l.email))
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, maxPerRun);

  let quotaHit = false;
  let sent = 0;

  for (const lead of leadsWithEmail) {
    if (!lead.email) continue;

    try {
      // Check if email already sent or recently failed (avoid retrying bad emails)
      const existingOutreach = await db.emailOutreach.findFirst({
        where: { leadId: lead.id, status: "sent" },
      });
      if (existingOutreach) continue;

      const failedOutreach = await db.emailOutreach.findFirst({
        where: { 
          leadId: lead.id, 
          status: "failed",
          errorMessage: { not: null }
        },
      });
      if (failedOutreach) continue;

      // Use sequence template (instant) or simple fallback
      let subject: string;
      let body: string;

      if (stepOne) {
        subject = stepOne.subject
          .replace(/\{\{firstName\}\}/gi, lead.firstName || "there")
          .replace(/\{\{company\}\}/gi, lead.companyName || "your company")
          .replace(/\{\{role\}\}/gi, lead.jobTitle || "your role");
        body = stepOne.body
          .replace(/\{\{firstName\}\}/gi, lead.firstName || "there")
          .replace(/\{\{lastName\}\}/gi, lead.lastName || "")
          .replace(/\{\{company\}\}/gi, lead.companyName || "your company")
          .replace(/\{\{role\}\}/gi, lead.jobTitle || "your role");
      } else {
        // Fallback if no sequence template
        subject = `Quick thought for ${lead.companyName || "your team"}`;
        body = `Hi ${lead.firstName || "there"},\n\nI came across ${lead.companyName || "your company"} and thought you might find ${productInfo?.name || "our tool"} useful.\n\n${productInfo?.tagline || ""}\n\nCheck it out: ${productInfo?.url || "ariaagent.agency"}\n\nBest regards`;
      }

      // INJECT CTA: If the body doesn't contain the product URL, append it
      const productUrl = productInfo?.url || "https://ariaagent.agency";
      const pricingLabel = productInfo?.pricing?.label || "";
      const isFree = productInfo?.pricing?.free || false;
      const ctaText = isFree ? `Try ${productInfo?.name || 'it'} Free` : `Start ${productInfo?.name || 'Now'} — ${pricingLabel}`;
      const ctaColor = isFree ? "#4F46E5" : "#059669";

      if (!body.includes(productUrl) && !body.includes('http')) {
        body += `\n\n${isFree ? "Try it free here:" : "Get started:"} ${productUrl}`;
      }

      // Build HTML email with Razorpay checkout CTA button
      const checkoutUrl = isFree ? productUrl : `${process.env.NEXTAUTH_URL || "https://my-project-aa-apps.vercel.app"}/api/payments/checkout?productId=${product}`;
      const emailHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
          <p style="margin-bottom: 16px;">${body.replace(/\n/g, "<br>")}</p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${checkoutUrl}" style="background-color: ${ctaColor}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">${ctaText}</a>
          </div>
          ${!isFree ? `<p style="text-align: center; font-size: 13px; color: #666; margin-top: 4px;">Secure checkout via Razorpay • Cancel anytime</p>` : ""}
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999;">${productInfo?.tagline || ""} ${!isFree ? `— <strong>${pricingLabel}</strong>` : ""}</p>
        </div>`;

      const emailResult = await sendEmail({
        to: lead.email,
        subject,
        html: emailHtml,
        replyTo: "hello@ariaagent.agency",
      });

      await db.emailOutreach.create({
        data: {
          leadId: lead.id,
          sequenceId: activeSequence?.id || null,
          toEmail: lead.email,
          toName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || null,
          subject,
          body,
          product,
          status: emailResult.success ? "sent" : "failed",
          sentAt: emailResult.success ? new Date().toISOString() : null,
          resendId: emailResult.emailId || null,
          errorMessage: emailResult.error || null,
          stepNumber: 1,
        },
      });

      if (emailResult.success) {
        await db.lead.update({
          where: { id: lead.id },
          data: {
            status: "contacted",
            emailSent: true,
            emailSentAt: new Date().toISOString(),
          },
        });
        sent++;
      } else {
        // If quota hit, stop trying more emails
        if (emailResult.error?.includes('quota') || emailResult.error?.includes('limit')) {
          quotaHit = true;
          console.log(`[Orchestrator] Resend quota hit after ${sent} emails`);
          break;
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Orchestrator] Send email to ${lead.email} failed:`, message);
    }
  }

  return sent;
}

// ===== PHASE 4: FOLLOW-UP SEQUENCE MANAGEMENT =====
// Ensure each product has an active drip sequence
async function ensureSequences(product: string): Promise<boolean> {
  const target = PRODUCT_TARGETS[product];
  if (!target) return false;

  try {
    const existing = await db.emailSequence.findFirst({
      where: { product, isActive: true },
    });
    if (existing) return true;

    const sequence = await generateSequence(product, target.outreachGoal, 4);

    await db.emailSequence.create({
      data: {
        name: `${product} - Auto Drip`,
        description: target.outreachGoal,
        product,
        steps: JSON.stringify(sequence.steps),
        intervalDays: 3,
        isActive: true,
        totalSent: 0,
      },
    });
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Orchestrator] Create sequence for ${product} failed:`, message);
    return false;
  }
}

// ===== PHASE 5: PROCESS FOLLOW-UPS =====
// Send follow-up emails to contacted leads who haven't replied
async function processFollowUps(product: string): Promise<number> {
  const now = new Date();
  let sent = 0;

  // Get active sequence for this product
  const sequence = await db.emailSequence.findFirst({
    where: { product, isActive: true },
  });
  if (!sequence) return 0;

  interface SequenceStep {
    stepNumber: number;
    subject: string;
    body: string;
    waitDays: number;
  }

  let steps: SequenceStep[] = [];
  try {
    steps = JSON.parse(sequence.steps || "[]");
  } catch {
    return 0;
  }
  if (steps.length === 0) return 0;

  // Find contacted leads for this product who haven't replied
  const leads = await db.lead.findMany({
    where: {
      targetProduct: product,
      status: "contacted",
    },
  });

  for (const lead of leads) {
    if (!lead.email) continue;

    const followUpCount = lead.followUpCount || 0;
    // Max 3 follow-ups per lead
    if (followUpCount >= 3) continue;

    const nextStep = followUpCount + 2; // Step 1 was initial, step 2 is first follow-up
    const stepData = steps.find((s: SequenceStep) => s.stepNumber === nextStep);
    if (!stepData) continue;

    // Check if this step was already sent
    const alreadySent = await db.emailOutreach.findFirst({
      where: { leadId: lead.id, stepNumber: nextStep, status: "sent" },
    });
    if (alreadySent) continue;

    // Check timing from last email
    const lastOutreach = await db.emailOutreach.findFirst({
      where: { leadId: lead.id, status: "sent" },
      orderBy: { createdAt: "desc" },
    });
    if (!lastOutreach?.sentAt) continue;

    const lastSentDate = new Date(lastOutreach.sentAt);
    const waitMs = (stepData.waitDays || 3) * 24 * 60 * 60 * 1000;
    const dueDate = new Date(lastSentDate.getTime() + waitMs);
    if (now < dueDate) continue;

    // Personalize and send
    const personalizedBody = stepData.body
      .replace(/\{\{firstName\}\}/gi, lead.firstName || "there")
      .replace(/\{\{lastName\}\}/gi, lead.lastName || "")
      .replace(/\{\{company\}\}/gi, lead.companyName || "your company")
      .replace(/\{\{role\}\}/gi, lead.jobTitle || "your role");

    const personalizedSubject = stepData.subject
      .replace(/\{\{firstName\}\}/gi, lead.firstName || "there")
      .replace(/\{\{company\}\}/gi, lead.companyName || "your company");

    const productInfo = PRODUCTS[product];
    const productUrl = productInfo?.url || "https://ariaagent.agency";

    // Inject CTA into follow-up body if missing
    let followUpBody = personalizedBody;
    if (!followUpBody.includes(productUrl) && !followUpBody.includes('http')) {
      followUpBody += `\n\nLearn more: ${productUrl}`;
    }

    const emailHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
        <p style="margin-bottom: 16px;">${followUpBody.replace(/\n/g, "<br>")}</p>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${!productInfo?.pricing?.free ? `${process.env.NEXTAUTH_URL || "https://my-project-aa-apps.vercel.app"}/api/payments/checkout?productId=${product}` : productUrl}" style="background-color: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">Get Started — ${productInfo?.pricing?.label || "Free"}</a>
        </div>
        ${!productInfo?.pricing?.free ? `<p style="text-align: center; font-size: 13px; color: #666; margin-top: 4px;">Secure checkout via Razorpay • Cancel anytime</p>` : ""}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999;">${productInfo?.tagline || ""}</p>
      </div>`;

    const emailResult = await sendEmail({
      to: lead.email,
      subject: personalizedSubject,
      html: emailHtml,
      replyTo: "hello@ariaagent.agency",
    });

    await db.emailOutreach.create({
      data: {
        leadId: lead.id,
        sequenceId: sequence.id,
        stepNumber: nextStep,
        toEmail: lead.email,
        toName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || null,
        subject: personalizedSubject,
        body: personalizedBody,
        product,
        status: emailResult.success ? "sent" : "failed",
        sentAt: emailResult.success ? new Date().toISOString() : null,
        resendId: emailResult.emailId || null,
        errorMessage: emailResult.error || null,
      },
    });

    if (emailResult.success) {
      await db.lead.update({
        where: { id: lead.id },
        data: {
          followUpCount: followUpCount + 1,
          lastFollowUpAt: new Date().toISOString(),
        },
      });
      sent++;
    }
  }

  return sent;
}

// ===== PHASE 6: RESPONSE DETECTION =====
// Check for bounced emails and mark leads accordingly
async function detectBounces(): Promise<number> {
  // Find bounced outreach and mark leads
  const bouncedOutreach = await db.emailOutreach.findMany({
    where: { status: "bounced" },
  });

  let marked = 0;
  for (const outreach of bouncedOutreach) {
    if (!outreach.leadId) continue;
    const lead = await db.lead.findUnique({ where: { id: outreach.leadId } });
    if (!lead || lead.status === "lost") continue;

    await db.lead.update({
      where: { id: lead.id },
      data: { status: "lost" },
    });
    marked++;
  }
  return marked;
}

// ===== PHASE 7: STALE LEAD HANDLING =====
// Mark leads as "lost" if no reply after all follow-ups
async function handleStaleLeads(): Promise<number> {
  const staleLeads = await db.lead.findMany({
    where: { status: "contacted" },
  });

  let marked = 0;
  const now = new Date();

  for (const lead of staleLeads) {
    const followUpCount = lead.followUpCount || 0;
    const lastFollowUp = lead.lastFollowUpAt;

    // If 3+ follow-ups sent and 7 days since last follow-up → mark lost
    if (followUpCount >= 3 && lastFollowUp) {
      const daysSinceFollowUp = (now.getTime() - new Date(lastFollowUp).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceFollowUp >= 7) {
        await db.lead.update({
          where: { id: lead.id },
          data: { status: "lost" },
        });
        marked++;
      }
    }

    // If contacted but 0 follow-ups and 10 days since email → something went wrong, force follow-up
    if (followUpCount === 0 && lead.emailSentAt) {
      const daysSinceEmail = (now.getTime() - new Date(lead.emailSentAt).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceEmail >= 10) {
        // Mark for priority follow-up by setting score high
        await db.lead.update({
          where: { id: lead.id },
          data: { score: 90 }, // Bump score so follow-up picks it up
        });
      }
    }
  }
  return marked;
}

// ===== MAIN ORCHESTRATOR =====
// Runs the full autonomous marketing loop
export async function runOrchestrator(options?: {
  products?: string[];
  phases?: string[];
  discoverLimit?: number;
}): Promise<OrchestratorRunResult> {
  const products = options?.products || Object.keys(PRODUCT_TARGETS);
  const phases = options?.phases || ["discover", "enrich", "email", "sequence", "followup", "bounce", "stale"];
  const discoverLimit = options?.discoverLimit || 20;

  const result: OrchestratorRunResult = {
    phase: "full",
    stats: { discovered: 0, enriched: 0, emailed: 0, sequenced: 0, followedUp: 0, bounced: 0, stale: 0 },
    details: [],
    errors: [],
    timestamp: new Date().toISOString(),
  };

  for (const product of products) {
    // Phase 1: Discover (cap at 200 leads per product)
    if (phases.includes("discover")) {
      try {
        const existingCount = await db.lead.count({ targetProduct: product });
        if (existingCount < 200) {
          const count = await discoverLeads(product, discoverLimit);
          result.stats.discovered += count;
          result.details.push({ product, action: "discover", count, message: `Discovered ${count} new leads (${existingCount} total)` });
        } else {
          result.details.push({ product, action: "discover", count: 0, message: `Skipped — ${existingCount} leads already` });
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Discover ${product}: ${message}`);
      }
    }

    // Phase 2: Enrich
    if (phases.includes("enrich")) {
      try {
        const count = await enrichLeads(product);
        result.stats.enriched += count;
        result.details.push({ product, action: "enrich", count, message: `Enriched ${count} leads` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Enrich ${product}: ${message}`);
      }
    }

    // Phase 2.5: Find emails for leads — ALWAYS runs before sending emails
    if (phases.includes("email")) {
      try {
        const count = await findMissingEmails(product, 10);
        result.stats.emailsFound = (result.stats.emailsFound || 0) + count;
        result.details.push({ product, action: "findEmails", count, message: `Found ${count} emails` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`FindEmails ${product}: ${message}`);
      }
    }

    // Phase 3: Send emails
    if (phases.includes("email")) {
      try {
        const count = await sendInitialEmails(product);
        result.stats.emailed += count;
        result.details.push({ product, action: "email", count, message: `Sent ${count} initial emails` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Email ${product}: ${message}`);
      }
    }

    // Phase 4: Ensure sequences
    if (phases.includes("sequence")) {
      try {
        const created = await ensureSequences(product);
        result.stats.sequenced += created ? 1 : 0;
        result.details.push({ product, action: "sequence", count: created ? 1 : 0, message: created ? "Sequence ready" : "Sequence already exists" });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Sequence ${product}: ${message}`);
      }
    }

    // Phase 5: Process follow-ups
    if (phases.includes("followup")) {
      try {
        const count = await processFollowUps(product);
        result.stats.followedUp += count;
        result.details.push({ product, action: "followup", count, message: `Sent ${count} follow-ups` });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result.errors.push(`Follow-up ${product}: ${message}`);
      }
    }
  }

  // Phase 6: Detect bounces
  if (phases.includes("bounce")) {
    try {
      const count = await detectBounces();
      result.stats.bounced += count;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Bounce detection: ${message}`);
    }
  }

  // Phase 7: Handle stale leads
  if (phases.includes("stale")) {
    try {
      const count = await handleStaleLeads();
      result.stats.stale += count;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(`Stale leads: ${message}`);
    }
  }

  return result;
}

// Get pipeline summary for dashboard
export async function getPipelineSummary() {
  const allLeads = await db.lead.findMany({ take: 1000 });
  const allEmails = await db.emailOutreach.findMany({ take: 1000 });
  const allSequences = await db.emailSequence.findMany({ where: { isActive: true } });

  const statusCounts: Record<string, number> = {};
  const productCounts: Record<string, number> = {};

  for (const lead of allLeads) {
    const status = lead.status || "unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
    if (lead.targetProduct) {
      productCounts[lead.targetProduct] = (productCounts[lead.targetProduct] || 0) + 1;
    }
  }

  const sentEmails = allEmails.filter(e => e.status === "sent").length;
  const failedEmails = allEmails.filter(e => e.status === "failed").length;
  const repliedEmails = allEmails.filter(e => e.repliedAt).length;

  return {
    totalLeads: allLeads.length,
    statusCounts,
    productCounts,
    totalEmailsSent: sentEmails,
    totalEmailsFailed: failedEmails,
    totalReplies: repliedEmails,
    activeSequences: allSequences.length,
    avgFollowUpCount: allLeads.length > 0
      ? (allLeads.reduce((sum, l) => sum + (l.followUpCount || 0), 0) / allLeads.length).toFixed(1)
      : "0",
    lastActivity: allEmails.length > 0 ? allEmails[0].createdAt : null,
  };
}
