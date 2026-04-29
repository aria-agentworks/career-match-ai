// src/lib/lead-agent.ts
// Per-Product Lead Agent Framework
// Each Aria product gets its own lead agent with product-specific ICP, scoring, and email angles
// Uses NVIDIA Smart Brain for intelligence + Supabase for persistence + Resend for outreach

// ========== Types ==========

export interface LeadAgentConfig {
  productId: string;
  productName: string;
  productTagline: string;
  productUrl: string;
  targetProduct: string;
  targetRoles: string[];
  targetIndustries: string[];
  targetLocations: string[];
  searchQueries: string[];
  painPoints: string[];
  valueProposition: string;
  emailAngle: string;
  scoringWeights: {
    icpFit: number;
    buyingIntent: number;
    recency: number;
    size: number;
    engagement: number;
  };
  maxLeadsPerRun: number;
  razorpayPriceId: string;
  priceLabel: string;
}

export interface AgentRunResult {
  productId: string;
  productName: string;
  leadsDiscovered: number;
  leadsScored: number;
  leadsEmailed: number;
  leadsQueuedForCall: number;
  details: Array<{
    action: string;
    count: number;
    message: string;
  }>;
  errors: string[];
  topLeads: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    score: number;
    status: string;
  }>;
}

export interface AgentStatus {
  productId: string;
  productName: string;
  productTagline: string;
  totalLeads: number;
  contactedLeads: number;
  emailedLeads: number;
  callerQueuedLeads: number;
  paidLeads: number;
  lastRunAt: string | null;
  averageScore: number;
}

// ========== Product Agent Configurations ==========

export const PRODUCT_AGENT_CONFIGS: Record<string, LeadAgentConfig> = {
  AriaAgent: {
    productId: "ariaagent",
    productName: "AriaAgent",
    productTagline: "11 Free AI Business Tools — No Signup Required",
    productUrl: "https://ariaagent.agency",
    targetProduct: "AriaAgent",
    targetRoles: ["Founder", "CEO", "Marketing Director", "Growth Hacker"],
    targetIndustries: ["marketing", "advertising", "saas", "technology"],
    targetLocations: ["US", "UK", "India", "Canada", "Australia"],
    searchQueries: [
      "free AI tools for business",
      "AI content generator",
      "AI marketing tools",
      "business name generator AI",
      "AI SEO tools free",
      "AI ad copy generator",
      "AI blog post generator",
      "landing page copy AI",
      "competitor analysis AI tool",
    ],
    painPoints: [
      "spending too much on multiple SaaS tools",
      "content creation bottlenecks",
      "need quick SEO analysis",
      "struggling with ad copy performance",
      "limited budget for marketing tools",
      "time-consuming manual content writing",
    ],
    valueProposition:
      "11 powerful AI tools completely free — content generation, SEO analysis, email composition, social media planning, and more. No signup, no credit card, instant access.",
    emailAngle:
      "Frame as a discovery of free tools that replace expensive subscriptions — lead with the zero-cost angle and the breadth of tools available.",
    scoringWeights: {
      icpFit: 0.25,
      buyingIntent: 0.25,
      recency: 0.10,
      size: 0.15,
      engagement: 0.25,
    },
    maxLeadsPerRun: 10,
    razorpayPriceId: "price_free",
    priceLabel: "Free",
  },

  SalesIntelligenceMCP: {
    productId: "sales-intelligence-mcp",
    productName: "Sales Intelligence MCP",
    productTagline: "Scored 96/100 on Smithery — Your AI-Powered Sales Research Assistant",
    productUrl: "https://mcp.ariaagent.agency",
    targetProduct: "SalesIntelligenceMCP",
    targetRoles: ["VP Sales", "Sales Director", "SDR Manager", "RevOps"],
    targetIndustries: ["saas", "b2b", "technology"],
    targetLocations: ["US", "UK", "Canada"],
    searchQueries: [
      "MCP server for sales",
      "Claude MCP sales tools",
      "AI sales research assistant",
      "MCP protocol sales intelligence",
      "Smithery MCP tools",
      "AI lead scoring tool",
      "sales intelligence automation",
      "B2B company research AI",
    ],
    painPoints: [
      "manual company research takes hours",
      "SDRs wasting time on unqualified leads",
      "no unified sales intelligence across tools",
      "Claude Desktop users need sales capabilities",
      "inconsistent lead scoring",
      "competitive analysis is manual and slow",
    ],
    valueProposition:
      "Give Claude Desktop deep sales intelligence — company research, contact discovery, lead scoring, and competitive analysis, all through the MCP protocol. Scored 96/100 on Smithery.",
    emailAngle:
      "Frame as a Claude Desktop power-up — if they use Claude for work, this MCP server turns it into a full sales research assistant overnight.",
    scoringWeights: {
      icpFit: 0.30,
      buyingIntent: 0.20,
      recency: 0.10,
      size: 0.15,
      engagement: 0.25,
    },
    maxLeadsPerRun: 8,
    razorpayPriceId: "price_sales_mcp_29",
    priceLabel: "$29/mo",
  },

  SaaSAuditScanner: {
    productId: "saas-audit-scanner",
    productName: "SaaS Audit Scanner",
    productTagline: "Instantly audit any SaaS product for strengths, weaknesses, and growth opportunities",
    productUrl: "https://ariaagent.agency",
    targetProduct: "SaaSAuditScanner",
    targetRoles: ["CTO", "VP Engineering", "Security Engineer", "Founder"],
    targetIndustries: ["saas", "technology", "fintech"],
    targetLocations: ["US", "UK", "India", "Germany", "Canada"],
    searchQueries: [
      "SaaS product audit tool",
      "UX audit for SaaS",
      "SaaS pricing strategy analyzer",
      "product audit AI tool",
      "SaaS competitive analysis",
      "SaaS feature gap analysis",
      "product health check SaaS",
      "startup product audit",
    ],
    painPoints: [
      "don't know why users churn",
      "UX issues hurting conversion",
      "pricing doesn't match market",
      "feature bloat without clear strategy",
      "no systematic way to audit their own product",
      "competitive positioning is unclear",
    ],
    valueProposition:
      "Get an instant comprehensive audit of any SaaS product — UX, pricing strategy, market positioning, feature gaps, and actionable improvement recommendations in minutes, not weeks.",
    emailAngle:
      "Frame as an unbiased second opinion — they've been building for months and need an objective, AI-powered analysis to see what they're missing.",
    scoringWeights: {
      icpFit: 0.30,
      buyingIntent: 0.15,
      recency: 0.10,
      size: 0.15,
      engagement: 0.30,
    },
    maxLeadsPerRun: 8,
    razorpayPriceId: "price_saas_audit_49",
    priceLabel: "$49/audit",
  },

  ShipProof: {
    productId: "shipproof",
    productName: "ShipProof",
    productTagline: "Video Proof Infrastructure for Enterprise — SHA-256 Verified Shipment Recording",
    productUrl: "https://shipproof.netlify.app",
    targetProduct: "ShipProof",
    targetRoles: ["Owner", "Operations Manager", "Fulfillment Director", "CEO"],
    targetIndustries: ["ecommerce", "retail", "d2c", "marketplace_seller"],
    targetLocations: ["India", "US", "UK", "UAE", "Southeast Asia"],
    searchQueries: [
      "amazon seller dispute protection",
      "flipkart seller proof of delivery",
      "shopify store owner shipping",
      "ebay seller buyer dispute",
      "meesho seller delivery proof",
      "myntra seller shipping protection",
      "ecommerce brand fulfillment",
      "d2c brand shipping solution",
      "3pl fulfillment video proof",
      "reduce buyer disputes ecommerce",
    ],
    painPoints: [
      "losing money to fake buyer disputes",
      "no proof of what was shipped",
      "chargebacks eating into margins",
      "marketplace sellers lack delivery evidence",
      "customer claims 'item not as described'",
      "returns fraud on Amazon/Flipkart/Meesho",
    ],
    valueProposition:
      "API-first video proof infrastructure — record, verify, and prove every shipment with SHA-256 cryptographic hashing. Reduce disputes by 90% with tamper-proof video evidence. Works with Amazon, Flipkart, eBay, Meesho, Myntra, and Shopify.",
    emailAngle:
      "Frame around money lost to disputes — lead with specific marketplace pain points (Amazon A-to-Z claims, Flipkart returns, Meesho refunds) and the 90% dispute reduction stat.",
    scoringWeights: {
      icpFit: 0.25,
      buyingIntent: 0.30,
      recency: 0.10,
      size: 0.15,
      engagement: 0.20,
    },
    maxLeadsPerRun: 12,
    razorpayPriceId: "price_shipproof_99",
    priceLabel: "$99/mo",
  },

  SparkBill: {
    productId: "sparkbill",
    productName: "SparkBill",
    productTagline: "AI-powered invoicing that gets you paid faster",
    productUrl: "https://ariaagent.agency",
    targetProduct: "SparkBill",
    targetRoles: ["Freelancer", "Founder", "Agency Owner", "Consultant"],
    targetIndustries: ["services", "freelance", "consulting", "agency"],
    targetLocations: ["US", "UK", "India", "Canada", "Australia", "EU"],
    searchQueries: [
      "freelancer invoicing tool",
      "AI invoice generator",
      "automated invoicing for agencies",
      "payment reminder software",
      "freelancer payment tracking",
      "consultant invoice template AI",
      "get paid faster freelancing",
      "small agency billing software",
    ],
    painPoints: [
      "chasing clients for payment",
      "spending hours on invoicing",
      "forgetting to send reminders",
      "unpredictable cash flow",
      "unprofessional invoice templates",
      "no visibility into who will pay when",
    ],
    valueProposition:
      "AI-powered invoicing that generates professional invoices, tracks payment status, sends automated reminders, and predicts when clients will pay. Stop chasing, start getting paid.",
    emailAngle:
      "Frame around the pain of chasing payments — ask if they know how much time they waste on invoicing and follow-ups. Lead with the AI prediction feature that tells them WHEN they'll get paid.",
    scoringWeights: {
      icpFit: 0.25,
      buyingIntent: 0.25,
      recency: 0.10,
      size: 0.15,
      engagement: 0.25,
    },
    maxLeadsPerRun: 10,
    razorpayPriceId: "price_sparkbill_19",
    priceLabel: "$19/mo",
  },

  NaiveVoiceAgent: {
    productId: "naive-voice-agent",
    productName: "Naive AI Voice Agent",
    productTagline: "Deploy a human-sounding AI voice agent in minutes",
    productUrl: "https://ariaagent.agency",
    targetProduct: "NaiveVoiceAgent",
    targetRoles: ["Customer Support Manager", "Operations Director", "Call Center Manager", "CEO"],
    targetIndustries: ["services", "healthcare", "real estate", "hospitality"],
    targetLocations: ["US", "UK", "India", "Canada", "Australia"],
    searchQueries: [
      "AI voice agent for business",
      "automated phone answering service",
      "AI customer support phone",
      "voice AI for dental offices",
      "AI receptionist small business",
      "voice agent for real estate",
      "24/7 phone coverage AI",
      "AI call center replacement",
      "conversational AI voice agent",
    ],
    painPoints: [
      "missing calls after hours",
      "hiring receptionists is expensive",
      "customers hate hold music",
      "appointment scheduling takes staff time",
      "can't afford 24/7 phone coverage",
      "lead qualification calls are repetitive",
    ],
    valueProposition:
      "Deploy a natural-sounding AI voice agent in minutes — handles phone calls, customer support, appointments, and lead qualification 24/7. Sounds human, works in multiple languages, integrates with your phone system.",
    emailAngle:
      "Frame around the cost of missed calls — calculate how much revenue they lose from missed calls after hours. Lead with 'human-sounding' to address the common objection of robotic AI voice.",
    scoringWeights: {
      icpFit: 0.25,
      buyingIntent: 0.25,
      recency: 0.10,
      size: 0.20,
      engagement: 0.20,
    },
    maxLeadsPerRun: 8,
    razorpayPriceId: "price_naive_voice_99",
    priceLabel: "$99/mo",
  },

  NaiveLandingPage: {
    productId: "naive-landing-page",
    productName: "Naive Landing Page",
    productTagline: "Generate high-converting landing pages from a single prompt",
    productUrl: "https://ariaagent.agency",
    targetProduct: "NaiveLandingPage",
    targetRoles: ["Founder", "Marketing Manager", "Product Manager", "Growth Hacker"],
    targetIndustries: ["saas", "startup", "technology", "marketing"],
    targetLocations: ["US", "UK", "India", "Canada", "EU"],
    searchQueries: [
      "AI landing page generator",
      "generate landing page from text",
      "no code landing page builder AI",
      "startup landing page tool",
      "high converting landing page AI",
      "product launch page generator",
      "landing page from prompt",
      "instant landing page no design",
    ],
    painPoints: [
      "can't design landing pages",
      "waiting weeks for a designer",
      "landing page conversion rates are low",
      "need to launch fast but look professional",
      "testing different landing pages is expensive",
      "don't know how to write landing page copy",
    ],
    valueProposition:
      "Generate complete, responsive, SEO-optimized landing pages from a single text prompt. Hero section, features, testimonials, pricing, and CTA — ready to deploy in seconds. No coding or design skills needed.",
    emailAngle:
      "Frame around speed to launch — 'What if you could go from idea to live landing page in 60 seconds?' Lead with the no-design-skill-required angle and conversion optimization.",
    scoringWeights: {
      icpFit: 0.25,
      buyingIntent: 0.25,
      recency: 0.10,
      size: 0.15,
      engagement: 0.25,
    },
    maxLeadsPerRun: 10,
    razorpayPriceId: "price_naive_lp_29",
    priceLabel: "$29/mo",
  },
};

// ========== Product-Specific Lead Scoring ==========

function scoreLeadWithWeights(
  lead: {
    id: string;
    companyName?: string | null;
    jobTitle?: string | null;
    score?: number | null;
    buyingIntent?: number | null;
    openCount?: number | null;
    clickCount?: number | null;
    replyCount?: number | null;
    status?: string | null;
    createdAt?: string | null;
    industry?: string | null;
    location?: string | null;
  },
  config: LeadAgentConfig,
): { totalScore: number; breakdown: Record<string, number> } {
  const weights = config.scoringWeights;

  // Signal 1: ICP Fit — role and industry match
  const title = (lead.jobTitle || "").toLowerCase();
  const roleMatch = config.targetRoles.some((r) =>
    title.includes(r.toLowerCase()),
  );
  const industryMatch = lead.industry
    ? config.targetIndustries.some((ind) =>
        (lead.industry || "").toLowerCase().includes(ind.toLowerCase()),
      )
    : false;
  const icpFit = (roleMatch ? 70 : 30) + (industryMatch ? 30 : 0);

  // Signal 2: Buying Intent — from engagement signals
  const buyingIntent = Math.min(
    100,
    (lead.buyingIntent || 0) +
      (lead.clickCount || 0) * 25 +
      (lead.replyCount || 0) * 50,
  );

  // Signal 3: Recency — decay over time
  let recency = 50;
  if (lead.createdAt) {
    const daysAgo =
      (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    recency = Math.max(0, 100 - daysAgo * 2);
  }

  // Signal 4: Size Fit — small/medium companies convert faster
  const sizeFit = Math.min(100, lead.score || 50);

  // Signal 5: Engagement — opens, clicks, replies
  const engagement = Math.min(
    100,
    (lead.openCount || 0) * 10 +
      (lead.clickCount || 0) * 30 +
      (lead.replyCount || 0) * 60,
  );

  const totalScore = Math.round(
    icpFit * weights.icpFit +
    buyingIntent * weights.buyingIntent +
    recency * weights.recency +
    sizeFit * weights.size +
    engagement * weights.engagement,
  );

  return {
    totalScore,
    breakdown: { icpFit, buyingIntent, recency, sizeFit, engagement },
  };
}

// ========== Product-Specific Email Generation ==========

async function generateProductEmail(
  lead: {
    firstName: string;
    lastName: string;
    email: string;
    jobTitle?: string | null;
    companyName?: string | null;
    location?: string | null;
    industry?: string | null;
    notes?: string | null;
    phone?: string | null;
  },
  config: LeadAgentConfig,
): Promise<{ subject: string; body: string; html: string }> {
  const { nvidiaChat } = await import("./smart-brain");

  const prompt = `Write a SHORT, hyper-personalized cold email for this lead.

TO: ${lead.firstName} ${lead.lastName}
ROLE: ${lead.jobTitle || "Owner"} at ${lead.companyName || "their company"} (${lead.industry || "unknown industry"})
LOCATION: ${lead.location || "unknown"}
CONTEXT: ${lead.notes || "No additional context"}

PRODUCT: ${config.productName} — ${config.productTagline}
URL: ${config.productUrl}
PRICE: ${config.priceLabel}
PAIN POINTS THEY LIKELY HAVE: ${config.painPoints.slice(0, 3).join(", ")}
VALUE PROP: ${config.valueProposition}
EMAIL ANGLE: ${config.emailAngle}

RULES:
- Maximum 3 sentences. SHORTER IS BETTER.
- Open with something SPECIFIC about their role/company/industry (not generic)
- Mention ONE pain point they specifically face
- End with a simple question — not "book a demo"
- Sound like a human who researched them, not a marketer
- NO HTML, NO emojis, NO marketing speak
- The goal is a REPLY
- Mention the price (${config.priceLabel}) if relevant

Output ONLY JSON:
{"subject": "short specific subject line", "body": "2-3 sentence plain text email body"}`;

  try {
    const result = await nvidiaChat(
      [
        {
          role: "system",
          content:
            "You write cold emails that get replies. Be specific, human, SHORT. No marketing. No emojis. Output ONLY JSON.",
        },
        { role: "user", content: prompt },
      ],
      400,
    );

    let cleaned = result.trim();
    if (cleaned.startsWith("```"))
      cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in email generation");

    const parsed = JSON.parse(jsonMatch[0]);
    const subject = parsed.subject || `${lead.firstName}, quick question`;
    const body = parsed.body || `Hi ${lead.firstName},\n\n${config.valueProposition}\n\n${config.productUrl}`;

    // Ensure URL is in the body
    let finalBody = body;
    if (!finalBody.includes(config.productUrl)) {
      finalBody += `\n\n${config.productUrl}`;
    }

    // Build payment CTA — every email has a Razorpay checkout link
    const isFree = config.priceLabel === "Free";
    const ctaText = isFree ? "Get Started Free" : `Start for ${config.priceLabel}`;
    const ctaUrl = `${process.env.NEXTAUTH_URL || "https://career-match-aa-aa-apps.vercel.app"}/api/payments/product-link?productId=${config.productId}`;

    const html = `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; color: #1a1a1a; line-height: 1.7; font-size: 15px;">
  <p style="margin-bottom: 20px;">${finalBody
    .replace(/\n/g, "<br>")
    .replace(
      config.productUrl,
      `<a href="${config.productUrl}" style="color: #059669; text-decoration: none; font-weight: 600;">${config.productUrl}</a>`,
    )}</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="${ctaUrl}" style="background-color: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">${ctaText}</a>
  </div>
  ${!isFree ? `<p style="text-align: center; font-size: 13px; color: #666; margin-top: 4px;">Secure checkout via Razorpay • Cancel anytime</p>` : ""}
  <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; font-size: 13px; color: #888;">
    ${config.productTagline} ${!isFree ? `— <strong>${config.priceLabel}</strong>` : "— Free forever"}
  </div>
</div>`;

    return { subject, body: finalBody, html };
  } catch {
    const fallbackBody = `Hi ${lead.firstName},\n\n${config.valueProposition}\n\n${config.productUrl}`;
    const ctaText2 = config.priceLabel === "Free" ? "Get Started Free" : `Start for ${config.priceLabel}`;
    const isFree2 = config.priceLabel === "Free";
    const ctaUrl2 = isFree2 ? config.productUrl : `${process.env.NEXTAUTH_URL || "https://my-project-aa-apps.vercel.app"}/api/payments/checkout?productId=${config.productId}`;
    return {
      subject: `${lead.firstName}, quick thought on ${config.productName}`,
      body: fallbackBody,
      html: `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; color: #1a1a1a; line-height: 1.7; font-size: 15px;">
  <p>${fallbackBody.replace(/\n/g, "<br>")}</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="${ctaUrl2}" style="background-color: #059669; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">${ctaText2}</a>
  </div>
  <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee; font-size: 13px; color: #888;">
    ${config.productTagline} — ${config.priceLabel}
  </div>
</div>`,
    };
  }
}

// ========== Main Agent Runner ==========

export async function runProductLeadAgent(productId: string): Promise<AgentRunResult> {
  const config = PRODUCT_AGENT_CONFIGS[productId];
  if (!config) {
    throw new Error(
      `Unknown product ID: ${productId}. Available: ${Object.keys(PRODUCT_AGENT_CONFIGS).join(", ")}`,
    );
  }

  // Dynamic imports to avoid circular dependencies
  const { db } = await import("./db");
  const { sendEmail } = await import("./email");
  const { expandQuery, discoverLeadsIntelligent } = await import("./smart-brain");

  const result: AgentRunResult = {
    productId: config.productId,
    productName: config.productName,
    leadsDiscovered: 0,
    leadsScored: 0,
    leadsEmailed: 0,
    leadsQueuedForCall: 0,
    details: [],
    errors: [],
    topLeads: [],
  };

  console.log(`[LeadAgent:${config.productId}] Starting product-specific lead agent...`);

  // ===== STEP 1: Query Expansion with product-specific search patterns =====
  let expandedQueries: string[] = [];
  try {
    const icpDescription = [
      `Target roles: ${config.targetRoles.join(", ")}`,
      `Industries: ${config.targetIndustries.join(", ")}`,
      `Pain points: ${config.painPoints.slice(0, 3).join(", ")}`,
      `Locations: ${config.targetLocations.join(", ")}`,
    ].join(" — ");

    const expanded = await expandQuery(config.productName, icpDescription);
    expandedQueries = [...expanded.expanded, ...config.searchQueries].slice(0, 10);
    result.details.push({
      action: "query_expansion",
      count: expandedQueries.length,
      message: `Expanded into ${expandedQueries.length} product-specific search queries`,
    });
    console.log(`[LeadAgent:${config.productId}] Queries: ${expandedQueries.slice(0, 3).join(", ")}...`);
  } catch (err) {
    result.errors.push(
      `Query expansion failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    expandedQueries = config.searchQueries;
  }

  // ===== STEP 2: Discover leads using product-specific ICP =====
  let discoveredLeads: Awaited<ReturnType<typeof discoverLeadsIntelligent>> = [];
  try {
    const targetCompanies = [
      `Companies in ${config.targetIndustries.join(", ")}`,
      config.targetLocations.length > 0 ? `in ${config.targetLocations.join(", ")}` : "",
      `looking for ${config.painPoints[0]}`,
    ]
      .filter(Boolean)
      .join(" ");

    discoveredLeads = await discoverLeadsIntelligent(
      config.productName,
      config.productTagline,
      config.productUrl,
      targetCompanies,
      config.targetRoles,
      config.painPoints,
      config.maxLeadsPerRun,
    );

    result.leadsDiscovered = discoveredLeads.length;
    result.details.push({
      action: "lead_discovery",
      count: discoveredLeads.length,
      message: `Discovered ${discoveredLeads.length} leads matching ${config.productName} ICP`,
    });
    console.log(`[LeadAgent:${config.productId}] Discovered ${discoveredLeads.length} leads`);
  } catch (err) {
    result.errors.push(
      `Lead discovery failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return result;
  }

  if (discoveredLeads.length === 0) {
    result.details.push({
      action: "lead_discovery",
      count: 0,
      message: "No leads discovered — stopping agent run",
    });
    return result;
  }

  // ===== STEP 3: Deduplicate, save, and score with product-specific weights =====
  const savedLeads: typeof discoveredLeads = [];

  for (const lead of discoveredLeads) {
    if (!lead.email || !lead.email.includes("@")) continue;

    try {
      // Dedup by email and company
      const existingEmail = await db.lead.findFirst({ where: { email: lead.email } });
      if (existingEmail) continue;

      const existingCompany = await db.lead.findFirst({
        where: { companyName: lead.companyName },
      });
      if (existingCompany) continue;

      // Create the lead in the database
      const savedLead = await db.lead.create({
        data: {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          jobTitle: lead.jobTitle || "Owner",
          companyName: lead.companyName,
          companyDomain: lead.domain,
          location: lead.location || null,
          industry: lead.industry || null,
          source: `lead-agent-${config.productId}`,
          targetProduct: config.productId,
          status: "new",
          score: lead.confidence || 60,
          tags: `${config.productId},lead-agent,${lead.industry || "unknown"}`,
          notes: [lead.whyFit, lead.outreachAngle, lead.buyingSignal].filter(Boolean).join(" | "),
          funnel_stage: "new",
          buying_intent: 15,
          open_count: 0,
          click_count: 0,
          reply_count: 0,
          phone: null,
        },
      });

      // Score with product-specific weights
      const { totalScore } = scoreLeadWithWeights(savedLead, config);

      await db.lead.update({
        where: { id: savedLead.id },
        data: { score: totalScore },
      });

      savedLeads.push(lead);
      result.leadsScored++;

      result.topLeads.push({
        id: savedLead.id,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        company: lead.companyName,
        score: totalScore,
        status: "new",
      });
    } catch (err) {
      result.errors.push(
        `Save lead ${lead.email}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Sort top leads by score
  result.topLeads.sort((a, b) => b.score - a.score);
  result.details.push({
    action: "save_score",
    count: savedLeads.length,
    message: `Saved and scored ${savedLeads.length} leads with ${config.productId} weights`,
  });

  // ===== STEP 4: Generate product-specific emails and send top 5 =====
  const top5Leads = savedLeads.slice(0, 5);
  let emailsSent = 0;
  let quotaHit = false;

  for (const lead of top5Leads) {
    if (quotaHit) break;

    try {
      // Check if already emailed
      const existingLead = await db.lead.findFirst({ where: { email: lead.email } });
      if (!existingLead) continue;

      const alreadySent = await db.emailOutreach.findFirst({
        where: { leadId: existingLead.id, status: "sent" },
      });
      if (alreadySent) continue;

      // Generate product-specific email
      const email = await generateProductEmail(
        {
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          jobTitle: lead.jobTitle,
          companyName: lead.companyName,
          location: lead.location,
          industry: lead.industry,
          notes: lead.outreachAngle || lead.whyFit,
          phone: null,
        },
        config,
      );

      // Send via Resend
      const emailResult = await sendEmail({
        to: lead.email,
        subject: email.subject,
        html: email.html,
        replyTo: "hello@ariaagent.agency",
      });

      // Record outreach
      await db.emailOutreach.create({
        data: {
          leadId: existingLead.id,
          toEmail: lead.email,
          toName: `${lead.firstName} ${lead.lastName}`,
          subject: email.subject,
          body: email.body,
          product: config.productId,
          status: emailResult.success ? "sent" : "failed",
          sentAt: emailResult.success ? new Date().toISOString() : null,
          resendId: emailResult.emailId || null,
          errorMessage: emailResult.error || null,
          stepNumber: 1,
        },
      });

      if (emailResult.success) {
        await db.lead.update({
          where: { id: existingLead.id },
          data: {
            status: "contacted",
            emailSent: true,
            emailSentAt: new Date().toISOString(),
            funnel_stage: "contacted",
          },
        });
        emailsSent++;
        console.log(
          `[LeadAgent:${config.productId}] Emailed ${lead.email} (${lead.companyName})`,
        );
      } else if (emailResult.error?.includes("quota") || emailResult.error?.includes("limit")) {
        quotaHit = true;
        result.errors.push(`Email quota hit after ${emailsSent} sends`);
      }
    } catch (err) {
      result.errors.push(
        `Email ${lead.email}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  result.leadsEmailed = emailsSent;
  result.details.push({
    action: "email",
    count: emailsSent,
    message: `Sent ${emailsSent} product-tailored emails for ${config.productName}`,
  });

  // ===== STEP 5: Queue leads with phone numbers for Caller Agent =====
  let queuedForCall = 0;
  for (const lead of savedLeads) {
    try {
      const existingLead = await db.lead.findFirst({ where: { email: lead.email } });
      if (!existingLead) continue;

      // Mark for caller agent (even without phone, we queue them — phone can be added later)
      await db.lead.update({
        where: { id: existingLead.id },
        data: {
          caller_queued: true,
          caller_status: "pending",
        },
      });
      queuedForCall++;
    } catch (err) {
      result.errors.push(
        `Queue call ${lead.email}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  result.leadsQueuedForCall = queuedForCall;
  if (queuedForCall > 0) {
    result.details.push({
      action: "caller_queue",
      count: queuedForCall,
      message: `Queued ${queuedForCall} leads for voice agent outreach`,
    });
  }

  console.log(
    `[LeadAgent:${config.productId}] Complete — discovered:${result.leadsDiscovered} scored:${result.leadsScored} emailed:${result.leadsEmailed} queued:${result.leadsQueuedForCall}`,
  );

  return result;
}

// ========== Agent Status Dashboard ==========

export async function getAllAgentStatuses(): Promise<AgentStatus[]> {
  const { db } = await import("./db");

  const statuses: AgentStatus[] = [];

  for (const [productId, config] of Object.entries(PRODUCT_AGENT_CONFIGS)) {
    try {
      const [allLeads, contactedLeads, emailedLeads, queuedLeads, paidLeads] =
        await Promise.all([
          db.lead.count({ targetProduct: productId }),
          db.lead.count({ targetProduct: productId, status: "contacted" }),
          db.lead.count({
            targetProduct: productId,
            emailSent: true,
          }),
          db.lead.count({
            targetProduct: productId,
            caller_queued: true,
          }),
          db.lead.count({
            targetProduct: productId,
            status: "paid",
          }),
        ]);

      // Get recent leads for average score
      const recentLeads = await db.lead.findMany({
        where: { targetProduct: productId },
        take: 20,
        orderBy: { createdAt: "desc" },
      });

      const averageScore =
        recentLeads.length > 0
          ? Math.round(
              recentLeads.reduce((sum, l) => sum + (l.score || 0), 0) / recentLeads.length,
            )
          : 0;

      const lastLead = recentLeads[0];

      statuses.push({
        productId,
        productName: config.productName,
        productTagline: config.productTagline,
        totalLeads: allLeads,
        contactedLeads,
        emailedLeads,
        callerQueuedLeads: queuedLeads,
        paidLeads,
        lastRunAt: lastLead?.createdAt || null,
        averageScore,
      });
    } catch (err) {
      statuses.push({
        productId,
        productName: config.productName,
        productTagline: config.productTagline,
        totalLeads: 0,
        contactedLeads: 0,
        emailedLeads: 0,
        callerQueuedLeads: 0,
        paidLeads: 0,
        lastRunAt: null,
        averageScore: 0,
      });
    }
  }

  return statuses;
}
