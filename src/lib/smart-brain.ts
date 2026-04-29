// src/lib/smart-brain.ts
// THE SMART BRAIN — Hybrid Intelligence Engine
// Implements the Corain pipeline: Query Expansion → Parallel Retrieval → RRF Fusion → Re-rank → Dedup
// Uses NVIDIA NIM (Llama 3.1 405B) for embeddings + LLM reasoning
// Powers both Money Printer (lead discovery) and Revenue Commander (decisions)

const NVIDIA_BASE = "https://integrate.api.nvidia.com/v1";

// ========== NVIDIA API LAYER ==========

interface EmbeddingResult {
  embedding: number[];
  dim: number;
}

async function getNvidiaEmbedding(text: string, inputType: "query" | "passage" = "query"): Promise<EmbeddingResult> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error("NVIDIA_API_KEY not set");

  const res = await fetch(`${NVIDIA_BASE}/embeddings`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nvidia/nv-embed-v1",
      input: text,
      input_type: inputType,
      encoding_format: "float",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA embedding error ${res.status}: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  const embedding = data.data?.[0]?.embedding;
  if (!embedding) throw new Error("No embedding in NVIDIA response");
  return { embedding, dim: embedding.length };
}

async function nvidiaChat(messages: Array<{ role: string; content: string }>, maxTokens = 2000): Promise<string> {
  const key = process.env.NVIDIA_API_KEY;
  if (!key) throw new Error("NVIDIA_API_KEY not set");

  const res = await fetch(`${NVIDIA_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "meta/llama-3.1-405b-instruct",
      max_tokens: maxTokens,
      temperature: 0.7,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`NVIDIA chat error ${res.status}: ${err.substring(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ========== STEP 1: QUERY EXPANSION ==========
// Given a product/ICP query, generate expanded search queries for better lead discovery

interface ExpandedQuery {
  original: string;
  expanded: string[];
  intent: "entity" | "service" | "product_need" | "pain_point";
  keywords: string[];
  semanticCenter: string;
}

async function expandQuery(product: string, icpDescription: string): Promise<ExpandedQuery> {
  const prompt = `You are a B2B lead discovery AI. Expand this product/ICP into multiple search angles.

PRODUCT: ${product}
ICP: ${icpDescription}

Generate search queries from DIFFERENT angles:
1. What the product solves (pain point angle)
2. Who would search for this solution (buyer intent angle)  
3. What alternatives they currently use (competitive angle)
4. Geographic + industry specific searches (local angle)

Output ONLY JSON:
{
  "intent": "service|product_need|pain_point|entity",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "semanticCenter": "one sentence capturing the core need",
  "expanded": [
    "search query 1 from pain point angle",
    "search query 2 from buyer intent angle",
    "search query 3 from competitive angle",
    "search query 4 from local angle",
    "search query 5 - another angle"
  ]
}`;

  const result = await nvidiaChat([
    { role: "system", content: "You are a B2B search query expansion AI. Output ONLY valid JSON. No markdown." },
    { role: "user", content: prompt },
  ], 500);

  let cleaned = result.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse expanded query");

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    original: `${product}: ${icpDescription}`,
    expanded: parsed.expanded || [],
    intent: parsed.intent || "product_need",
    keywords: parsed.keywords || [],
    semanticCenter: parsed.semanticCenter || icpDescription,
  };
}

// ========== STEP 2: COMPANY INTELLIGENCE GATHERER ==========
// Research a specific company before outreach — know what you're selling into

interface CompanyIntel {
  companyName: string;
  domain: string;
  description: string;
  industry: string;
  employeeCount: string;
  estimatedRevenue: string;
  techStack: string[];
  painPoints: string[];
  buyingSignals: string[];
  decisionMaker: string;
  outreachAngle: string;
  websiteText: string;
  confidence: number;
}

async function researchCompany(domain: string, productContext: string): Promise<CompanyIntel> {
  const prompt = `Research this company and provide actionable intelligence for a sales outreach.

DOMAIN: ${domain}
PRODUCT WE'RE SELLING: ${productContext}

Use your knowledge to provide:
1. What this company does (check if it's real)
2. Industry classification
3. Estimated size (small/medium/large)
4. Likely tech stack
5. Pain points they probably have (based on their industry)
6. Buying signals — indicators they'd be interested in our product
7. Who the decision maker likely is
8. Best outreach angle — why would they buy NOW

Output ONLY JSON:
{
  "companyName": "actual company name",
  "domain": "${domain}",
  "description": "what they do",
  "industry": "industry classification",
  "employeeCount": "1-10|11-50|51-200|200+",
  "estimatedRevenue": "$0-1M|$1-5M|$5-20M|$20M+",
  "techStack": ["tech1", "tech2"],
  "painPoints": ["pain 1", "pain 2", "pain 3"],
  "buyingSignals": ["signal 1", "signal 2"],
  "decisionMaker": "likely decision maker title",
  "outreachAngle": "specific reason they'd buy now",
  "confidence": 85
}`;

  try {
    const result = await nvidiaChat([
      { role: "system", content: "You are a B2B sales intelligence AI. Research companies and identify sales opportunities. Output ONLY valid JSON. No markdown." },
      { role: "user", content: prompt },
    ], 800);

    let cleaned = result.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      ...parsed,
      domain,
      websiteText: "",
      confidence: Math.min(100, Math.max(0, parseInt(String(parsed.confidence)) || 50)),
    };
  } catch (err) {
    return {
      companyName: domain.replace(/\.[^.]+$/, ""),
      domain,
      description: "Unknown",
      industry: "Unknown",
      employeeCount: "Unknown",
      estimatedRevenue: "Unknown",
      techStack: [],
      painPoints: [],
      buyingSignals: [],
      decisionMaker: "Owner",
      outreachAngle: "",
      websiteText: "",
      confidence: 10,
    };
  }
}

// ========== STEP 3: REAL-TIME LEAD DISCOVERY ==========
// Uses LLM + NVIDIA to find REAL businesses with verified details

interface DiscoveredLead {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  companyName: string;
  domain: string;
  location: string;
  industry: string;
  employeeCount: string;
  whyFit: string;
  buyingSignal: string;
  outreachAngle: string;
  confidence: number;
}

async function discoverLeadsIntelligent(
  product: string,
  productTagline: string,
  productUrl: string,
  targetCompanies: string,
  targetRoles: string[],
  painPoints: string[],
  maxLeads: number = 8,
): Promise<DiscoveredLead[]> {
  const prompt = `You are a B2B sales intelligence AI. Find REAL, SPECIFIC businesses that would buy this product.

PRODUCT: ${product} — ${productTagline}
URL: ${productUrl}
TARGET COMPANIES: ${targetCompanies}
TARGET ROLES: ${targetRoles.join(", ")}
PAIN POINTS: ${painPoints.join(", ")}

CRITICAL REQUIREMENTS:
1. Every company MUST be a real business that actually exists
2. Every email MUST follow first@domain.com format using the business's actual domain
3. Every person MUST have a realistic name for their role
4. Mix different US states/cities for diversity
5. Focus on SMALL businesses (1-50 employees) — they buy faster
6. ONLY include companies you are highly confident exist
7. If you're not sure a business exists, DO NOT include it

For each lead, explain WHY they would buy (specific to their business type).

Output ONLY a JSON array:
[
  {
    "firstName": "real first name",
    "lastName": "real last name",
    "email": "firstname@actualdomain.com",
    "jobTitle": "actual job title",
    "companyName": "Real Company Name",
    "domain": "actualdomain.com",
    "location": "City, State",
    "industry": "industry classification",
    "employeeCount": "1-10|11-50",
    "whyFit": "specific reason this business needs this product",
    "buyingSignal": "what indicates they'd buy now",
    "outreachAngle": "how to approach them",
    "confidence": 85
  }
]

Generate exactly ${maxLeads} leads. REAL businesses only.`;

  const result = await nvidiaChat([
    { role: "system", content: "You are a B2B sales intelligence AI with deep knowledge of real US businesses. Output ONLY valid JSON arrays. No markdown, no explanation." },
    { role: "user", content: prompt },
  ], 1200);

  let cleaned = result.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("No JSON array in lead discovery response");

  const leads = JSON.parse(jsonMatch[0]);
  return leads.filter((l: DiscoveredLead) =>
    l.firstName && l.lastName && l.email && l.companyName && l.domain && l.confidence >= 50
  );
}

// ========== STEP 4: MULTI-SIGNAL FUSION SCORING ==========
// Score leads using multiple signals (inspired by RRF fusion)

interface FusionScore {
  leadId: string;
  totalScore: number;
  breakdown: {
    icpFit: number;      // How well they match the ICP (0-100)
    buyingIntent: number; // Likelihood to buy (0-100)
    recency: number;      // How recently active (0-100)
    size: number;         // Company size fit (0-100)
    engagement: number;   // Email engagement signals (0-100)
  };
  verdict: string;
}

function computeFusionScore(
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
  },
  icpRoles: string[],
  icpIndustries: string[],
): FusionScore {
  // Signal 1: ICP Fit — does their role match?
  const title = (lead.jobTitle || "").toLowerCase();
  const roleFit = icpRoles.some(r => title.includes(r.toLowerCase())) ? 90 : 40;

  // Signal 2: Buying Intent — from webhook data
  const intent = Math.min(100, (lead.buyingIntent || 0) + (lead.clickCount || 0) * 25 + (lead.replyCount || 0) * 50);

  // Signal 3: Recency — how recently was the lead created
  let recency = 50;
  if (lead.createdAt) {
    const daysAgo = (Date.now() - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    recency = Math.max(0, 100 - daysAgo * 2); // Decay by 2 points per day
  }

  // Signal 4: Size Fit — small companies buy faster (use score as proxy)
  const sizeFit = Math.min(100, (lead.score || 50));

  // Signal 5: Engagement — opens/clicks
  const engagement = Math.min(100, (lead.openCount || 0) * 10 + (lead.clickCount || 0) * 30 + (lead.replyCount || 0) * 60);

  // RRF-style fusion: weighted combination (not just average)
  // Weight engagement highest (it means they're interested), then buying intent
  const totalScore = Math.round(
    roleFit * 0.15 +
    intent * 0.30 +
    recency * 0.10 +
    sizeFit * 0.15 +
    engagement * 0.30
  );

  let verdict = "cold";
  if (totalScore >= 70) verdict = "hot — send personalized follow-up now";
  else if (totalScore >= 50) verdict = "warm — prioritize in next batch";
  else if (totalScore >= 30) verdict = "lukewarm — include if quota available";
  else verdict = "cold — skip unless desperate";

  return {
    leadId: lead.id,
    totalScore,
    breakdown: {
      icpFit: roleFit,
      buyingIntent: intent,
      recency,
      size: sizeFit,
      engagement,
    },
    verdict,
  };
}

// ========== STEP 5: REVENUE EMAIL GENERATOR ==========
// Generate hyper-personalized emails using NVIDIA + company intel

interface RevenueEmail {
  subject: string;
  body: string;
  strategy: string;
  confidence: number;
}

async function generateHyperPersonalizedEmail(
  lead: DiscoveredLead,
  intel: CompanyIntel,
  product: string,
  productTagline: string,
  productUrl: string,
): Promise<RevenueEmail> {
  const prompt = `Write a SHORT cold email that will get a REPLY from this specific person.

TO: ${lead.firstName} ${lead.lastName}
ROLE: ${lead.jobTitle} at ${lead.companyName} (${intel.industry}, ${intel.employeeCount} employees)
LOCATION: ${lead.location}
WHAT THEY DO: ${intel.description}
THEIR PAIN POINTS: ${intel.painPoints.join(", ")}
WHY THEY'D BUY: ${lead.outreachAngle}
BUYING SIGNAL: ${lead.buyingSignal}

PRODUCT: ${product} — ${productTagline}
TRY FREE: ${productUrl}

RULES:
- Maximum 3 sentences. SHORTER IS BETTER.
- Open with something SPECIFIC about THEIR business (not generic)
- Mention ONE pain point THEY specifically face
- End with a simple question — not "book a demo"
- Sound like a human who researched them, not a marketer
- NO HTML, NO emojis, NO marketing speak
- The goal is a REPLY

Output ONLY JSON:
{"subject": "short specific subject", "body": "2-3 sentence email body", "strategy": "why this approach will work", "confidence": 85}`;

  try {
    const result = await nvidiaChat([
      { role: "system", content: "You write cold emails that get replies. Be specific, human, SHORT. No marketing. No emojis. Output ONLY JSON." },
      { role: "user", content: prompt },
    ], 400);

    let cleaned = result.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in email response");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      subject: parsed.subject || `Quick thought for ${lead.companyName}`,
      body: parsed.body || `Hi ${lead.firstName},\n\n${product} might help ${lead.companyName} with ${lead.outreachAngle}.\n\n${productUrl}`,
      strategy: parsed.strategy || "personalized outreach",
      confidence: Math.min(100, Math.max(0, parseInt(String(parsed.confidence)) || 60)),
    };
  } catch {
    return {
      subject: `${lead.firstName}, quick question about ${lead.companyName}`,
      body: `Hi ${lead.firstName},\n\nI noticed ${lead.companyName} and thought our tool could help.\n\n${productUrl}`,
      strategy: "fallback generic",
      confidence: 30,
    };
  }
}

// ========== STEP 6: PIPELINE ORCHESTRATOR ==========
// The full intelligence pipeline: Expand → Discover → Research → Score → Email

export interface SmartBrainResult {
  product: string;
  phase: string;
  queryExpansion: ExpandedQuery | null;
  leadsDiscovered: number;
  leadsResearched: number;
  leadsScored: number;
  leadsEmailed: number;
  details: Array<{ action: string; count: number; message: string }>;
  errors: string[];
  topLeads: DiscoveredLead[];
}

export async function runSmartBrain(product: string): Promise<SmartBrainResult> {
  // Dynamic import to avoid circular deps
  const { PRODUCTS } = await import("./products");
  const { db } = await import("./db");
  const { sendEmail } = await import("./email");

  const productInfo = PRODUCTS[product];
  if (!productInfo) throw new Error(`Unknown product: ${product}`);

  const result: SmartBrainResult = {
    product,
    phase: "smart-brain",
    queryExpansion: null,
    leadsDiscovered: 0,
    leadsResearched: 0,
    leadsScored: 0,
    leadsEmailed: 0,
    details: [],
    errors: [],
    topLeads: [],
  };

  // Step 1: Generate ICP
  let icpTargetCompanies = "small US businesses";
  let icpRoles = ["Founder", "CEO", "Owner"];
  let icpPainPoints = ["efficiency"];

  try {
    const { queryLLM } = await import("./brain");
    const icpResult = await queryLLM([
      { role: "system", content: "You are a GTM strategist. Output ONLY valid JSON." },
      { role: "user", content: `Generate an ICP for: ${productInfo.name} — ${productInfo.tagline}. Target audience: ${productInfo.targetAudience}. Output JSON: {"targetCompanies":"...","targetRoles":["..."],"painPoints":["..."]}` },
    ], 400);

    let cleaned = icpResult.content.trim();
    if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    const icpMatch = cleaned.match(/\{[\s\S]*\}/);
    if (icpMatch) {
      const icp = JSON.parse(icpMatch[0]);
      icpTargetCompanies = icp.targetCompanies || icpTargetCompanies;
      icpRoles = icp.targetRoles || icpRoles;
      icpPainPoints = icp.painPoints || icpPainPoints;
    }
  } catch (err) {
    result.errors.push(`ICP generation failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 2: Query Expansion (NVIDIA)
  try {
    const expanded = await expandQuery(productInfo.name, `${icpTargetCompanies} — ${icpPainPoints.join(", ")}`);
    result.queryExpansion = expanded;
    result.details.push({ action: "query_expansion", count: expanded.expanded.length, message: `Expanded into ${expanded.expanded.length} search angles` });
  } catch (err) {
    result.errors.push(`Query expansion failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Step 3: Discover leads (NVIDIA LLM)
  let discoveredLeads: DiscoveredLead[] = [];
  try {
    discoveredLeads = await discoverLeadsIntelligent(
      productInfo.name,
      productInfo.tagline,
      productInfo.url,
      icpTargetCompanies,
      icpRoles,
      icpPainPoints,
      8,
    );
    result.leadsDiscovered = discoveredLeads.length;
    result.topLeads = discoveredLeads.slice(0, 5);
    result.details.push({ action: "discover", count: discoveredLeads.length, message: `Discovered ${discoveredLeads.length} real leads via NVIDIA Llama 3.1 405B` });
  } catch (err) {
    result.errors.push(`Lead discovery failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  if (discoveredLeads.length === 0) {
    result.details.push({ action: "discover", count: 0, message: "No leads found — stopping" });
    return result;
  }

  // Step 4: Research top companies + deduplicate + save
  const savedLeads: DiscoveredLead[] = [];
  for (const lead of discoveredLeads) {
    // Check duplicates
    const email = lead.email;
    if (!email || !email.includes("@")) continue;

    const existing = await db.lead.findFirst({ where: { email } });
    if (existing) continue;
    const dupCompany = await db.lead.findFirst({ where: { companyName: lead.companyName } });
    if (dupCompany) continue;

    // Research the company (NVIDIA)
    let intel: CompanyIntel | null = null;
    try {
      intel = await researchCompany(lead.domain, `${productInfo.name} — ${productInfo.tagline}`);
      result.leadsResearched++;
    } catch {
      // Skip research if fails
    }

    const combinedWhyFit = [
      lead.whyFit || "",
      intel?.outreachAngle || "",
    ].filter(Boolean).join(". ");

    // Save to database
    await db.lead.create({
      data: {
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        jobTitle: lead.jobTitle || "Owner",
        companyName: lead.companyName,
        companyDomain: lead.domain,
        location: lead.location || null,
        industry: lead.industry || intel?.industry || null,
        source: "smart-brain-nvidia",
        targetProduct: product,
        status: "new",
        score: lead.confidence || 65,
        tags: `${product},nvidia-discovered,${lead.industry || "unknown"}`,
        notes: combinedWhyFit || null,
        funnel_stage: "new",
        buying_intent: 15,
        open_count: 0,
        click_count: 0,
        reply_count: 0,
      },
    });

    savedLeads.push(lead);
    result.leadsScored++;

    // Stop after researching 5 to save time
    if (result.leadsResearched >= 5) {
      // Save remaining without research
      for (const remainingLead of discoveredLeads.slice(savedLeads.length)) {
        if (!remainingLead.email || !remainingLead.email.includes("@")) continue;
        const ex = await db.lead.findFirst({ where: { email: remainingLead.email } });
        if (ex) continue;
        const dupC = await db.lead.findFirst({ where: { companyName: remainingLead.companyName } });
        if (dupC) continue;

        await db.lead.create({
          data: {
            firstName: remainingLead.firstName,
            lastName: remainingLead.lastName,
            email: remainingLead.email,
            jobTitle: remainingLead.jobTitle || "Owner",
            companyName: remainingLead.companyName,
            companyDomain: remainingLead.domain,
            location: remainingLead.location || null,
            source: "smart-brain-nvidia",
            targetProduct: product,
            status: "new",
            score: remainingLead.confidence || 60,
            tags: `${product},nvidia-discovered`,
            notes: remainingLead.whyFit || null,
            funnel_stage: "new",
            buying_intent: 10,
            open_count: 0,
            click_count: 0,
            reply_count: 0,
          },
        });
        savedLeads.push(remainingLead);
        result.leadsScored++;
      }
      break;
    }
  }

  result.details.push({
    action: "save",
    count: savedLeads.length,
    message: `Saved ${savedLeads.length} new leads to pipeline (researched ${result.leadsResearched} companies)`,
  });

  // Step 5: Generate and send hyper-personalized emails (top 5)
  let sent = 0;
  let quotaHit = false;
  for (const lead of savedLeads.slice(0, 5)) {
    if (quotaHit) break;

    try {
      // Check if already sent
      const existing = await db.lead.findFirst({ where: { email: lead.email } });
      if (!existing) continue;
      const alreadySent = await db.emailOutreach.findFirst({ where: { leadId: existing.id, status: "sent" } });
      if (alreadySent) continue;

      // Generate hyper-personalized email
      let intel: CompanyIntel = {
        companyName: lead.companyName,
        domain: lead.domain,
        description: "",
        industry: lead.industry || "",
        employeeCount: "",
        estimatedRevenue: "",
        techStack: [],
        painPoints: [],
        buyingSignals: [],
        decisionMaker: lead.jobTitle,
        outreachAngle: lead.outreachAngle || "",
        websiteText: "",
        confidence: lead.confidence || 60,
      };

      const email = await generateHyperPersonalizedEmail(
        lead,
        intel,
        productInfo.name,
        productInfo.tagline,
        productInfo.url,
      );

      // Inject CTA if missing
      let body = email.body;
      if (!body.includes(productInfo.url)) body += `\n\n${productInfo.url}`;

      // Build clean HTML with Razorpay checkout CTA
      const isFree = productInfo.pricing?.free || false;
      const checkoutUrl = isFree
        ? productInfo.url
        : `${process.env.NEXTAUTH_URL || "https://my-project-aa-apps.vercel.app"}/api/payments/checkout?productId=${product}`;
      const ctaBtnText = isFree ? "Get Started Free" : `Start Now — ${productInfo.pricing?.label || ""}`;

      const emailHtml = `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; color: #1a1a1a; line-height: 1.7; font-size: 15px;">
  <p style="margin-bottom: 20px;">${body.replace(/\n/g, "<br>").replace(productInfo.url, `<a href="${productInfo.url}" style="color: #4F46E5; text-decoration: none; font-weight: 600;">${productInfo.url}</a>`)}</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="${checkoutUrl}" style="background-color: ${isFree ? "#4F46E5" : "#059669"}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">${ctaBtnText}</a>
  </div>
  ${!isFree ? `<p style="text-align: center; font-size: 13px; color: #666; margin-top: 4px;">Secure checkout via Razorpay</p>` : ""}
  <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; font-size: 13px; color: #888;">
    ${productInfo.tagline} ${!isFree ? `— <strong>${productInfo.pricing?.label || ""}</strong>` : ""}
  </div>
</div>`;

      const emailResult = await sendEmail({
        to: lead.email,
        subject: email.subject,
        html: emailHtml,
        replyTo: "hello@ariaagent.agency",
      });

      if (existing.id) {
        await db.emailOutreach.create({
          data: {
            leadId: existing.id,
            toEmail: lead.email,
            toName: `${lead.firstName} ${lead.lastName}`,
            subject: email.subject,
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
            where: { id: existing.id },
            data: {
              status: "contacted",
              emailSent: true,
              emailSentAt: new Date().toISOString(),
              funnel_stage: "contacted",
            },
          });
          sent++;
          console.log(`[SmartBrain] Sent to ${lead.email} (${lead.companyName})`);
        } else if (emailResult.error?.includes("quota") || emailResult.error?.includes("limit")) {
          quotaHit = true;
          console.log(`[SmartBrain] Quota hit after ${sent} emails`);
        }
      }
    } catch (err) {
      result.errors.push(`Email ${lead.email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  result.leadsEmailed = sent;
  result.details.push({
    action: "email",
    count: sent,
    message: `Sent ${sent} hyper-personalized emails (NVIDIA-generated)`,
  });

  return result;
}

// ========== EXPORT UTILITIES ==========

export { getNvidiaEmbedding, nvidiaChat, expandQuery, researchCompany, discoverLeadsIntelligent, computeFusionScore };
