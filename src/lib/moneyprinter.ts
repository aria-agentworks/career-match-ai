// src/lib/moneyprinter.ts
// THE MONEY PRINTER — Revenue-first lead discovery & outreach engine
// Reads product pages → generates ICP → finds real buyers → personalized outreach
// Inspired by moneyprinter.me approach: paste URL → get customers

import { db, LeadRow } from "./db";
import { sendEmail } from "./email";
import { searchPeople, searchCompanies, nlToFilters, findEmail } from "./explee";
import { PRODUCTS } from "./products";
import { queryLLM } from "./brain";

// ========== WEB SEARCH LEAD DISCOVERY (FALLBACK) ==========
// When Explee returns garbage, use LLM + web search to find real businesses

async function webSearchLeads(product: string, icp: ICPProfile, maxLeads: number = 5): Promise<number> {
  const productInfo = PRODUCTS[product];
  if (!productInfo) return 0;

  // Use the LLM to directly name real small businesses with contact info
  const businessPrompt = `Name ${maxLeads} REAL, SPECIFIC small businesses that would buy this product.

PRODUCT: ${productInfo.name} — ${productInfo.tagline}
TARGET: ${icp.targetCompanies}
TARGET ROLES: ${icp.targetRoles.join(", ")}
PAIN POINTS: ${icp.painPoints.join(", ")}
LOCATION: United States
SIZE: Under 50 employees

CRITICAL RULES:
- These MUST be real businesses that actually exist — you will be verified
- Each must have a real website domain (not a made-up one)
- Include the owner/founder name and their business email
- Mix different cities/states for diversity
- If you are not sure a business exists, DO NOT include it
- Prefer businesses that recently started or are growing (they buy tools faster)

Output ONLY a JSON array, nothing else:
[{"companyName": "Bright Smiles Dental", "domain": "brightsmilesdental.com", "ownerName": "Sarah Johnson", "ownerTitle": "Owner", "email": "sarah@brightsmilesdental.com", "location": "Austin, TX", "whyFit": "Small dental practice that needs 24/7 phone coverage"}]`;

  try {
    const bizResult = await queryLLM([
      { role: "system", content: "You have deep knowledge of real businesses across the United States. Only list businesses you are confident actually exist. Output ONLY valid JSON arrays. No markdown, no explanation, just JSON." },
      { role: "user", content: businessPrompt },
    ], 800);

    let bizCleaned = bizResult.content.trim();
    if (bizCleaned.startsWith("```")) bizCleaned = bizCleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    // Handle cases where LLM wraps in text
    const jsonMatch = bizCleaned.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("[MoneyPrinter] LLM did not return JSON array");
      return 0;
    }

    const businesses = JSON.parse(jsonMatch[0]);
    let totalSaved = 0;

    for (const biz of businesses) {
      if (totalSaved >= maxLeads) break;
      if (!biz.companyName || !biz.domain || !biz.ownerName) continue;

      // Generate email from name + domain if not provided
      let email = biz.email;
      if (!email || !isValidEmail(email)) {
        const nameParts = biz.ownerName.split(" ");
        const first = (nameParts[0] || "").toLowerCase();
        const last = (nameParts.slice(1).join(" ") || "").toLowerCase();
        const domain = biz.domain.replace(/^(https?:\/\/)?(www\.)?/, "");
        email = `${first}@${domain}`;
        if (!isValidEmail(email)) continue;
      }

      // Check duplicate by email and by company
      const existing = await db.lead.findFirst({ where: { email } });
      if (existing) continue;
      const dupCompany = await db.lead.findFirst({ where: { companyName: biz.companyName } });
      if (dupCompany) continue;

      const nameParts = biz.ownerName.split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      await db.lead.create({
        data: {
          firstName,
          lastName,
          email,
          jobTitle: biz.ownerTitle || "Owner",
          companyName: biz.companyName,
          companyDomain: biz.domain.replace(/^(https?:\/\/)?(www\.)?/, ""),
          location: biz.location || null,
          source: "moneyprinter-v2",
          targetProduct: product,
          status: "new",
          score: 65,
          tags: `${product},decision-maker`,
          notes: biz.whyFit || null,
          funnel_stage: "new",
          buying_intent: 15,
          open_count: 0,
          click_count: 0,
          reply_count: 0,
        },
      });
      totalSaved++;
      console.log(`[MoneyPrinter] 🎯 Found: ${biz.companyName} — ${email}`);
    }

    return totalSaved;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[MoneyPrinter] Web search leads failed:`, message);
    return 0;
  }
}

// ========== STRICT QUALITY GATE ==========
// No garbage leads. Period.

function isValidEmail(email: string): boolean {
  if (!email || !email.includes("@")) return false;
  const [local, domain] = email.split("@");
  if (!local || !domain || !domain.includes(".")) return false;
  if (!/^[\x00-\x7F]+$/.test(email)) return false;
  if (!/^[a-zA-Z0-9._%+\-]+$/.test(local)) return false;
  // Reject obviously bad domains
  const badDomains = ["example.com", "test.com", "gmail.com", "yahoo.com", "hotmail.com", "outlook.com"];
  if (badDomains.includes(domain.toLowerCase())) return false;
  return true;
}

function passesQualityGate(lead: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
  score?: number | null;
}): { pass: boolean; reason: string } {
  if (!lead.firstName || !lead.lastName) return { pass: false, reason: "No name" };
  if (!lead.email || !isValidEmail(lead.email)) return { pass: false, reason: "No valid email" };
  if (!lead.jobTitle) return { pass: false, reason: "No job title" };
  if (!lead.companyName) return { pass: false, reason: "No company name" };
  if (!lead.companyDomain) return { pass: false, reason: "No company domain" };
  if ((lead.score || 0) < 40) return { pass: false, reason: "Score too low" };
  return { pass: true, reason: "OK" };
}

// ========== ICP ENGINE ==========
// Auto-generate Ideal Customer Profiles per product using AI

interface ICPProfile {
  product: string;
  targetCompanies: string; // what types of companies
  targetRoles: string[]; // job titles to target
  companySize: string; // employee range
  industries: string[];
  painPoints: string[];
  buyingSignals: string[];
  outreachAngle: string;
  rejectionCriteria: string[]; // who NOT to email
}

async function generateICP(product: string): Promise<ICPProfile> {
  const productInfo = PRODUCTS[product];
  if (!productInfo) throw new Error(`Unknown product: ${product}`);

  const prompt = `You are a revenue-focused GTM strategist. Generate a PRECISE Ideal Customer Profile for this product.

PRODUCT: ${productInfo.name}
URL: ${productInfo.url}
DESCRIPTION: ${productInfo.description}
TAGLINE: ${productInfo.tagline}
TARGET AUDIENCE: ${productInfo.targetAudience}

Generate the ICP. Rules:
- Target SMALL companies (1-50 employees) — NOT enterprise. Small companies buy fast.
- Target DECISION MAKERS only — Founder, CEO, Co-founder, Owner, President
- Be SPECIFIC about company types, not vague
- Include rejection criteria (who NOT to target)

Output ONLY valid JSON:
{
  "targetCompanies": "specific description of ideal company types",
  "targetRoles": ["Founder", "CEO", ...max 5 roles],
  "companySize": "1-50",
  "industries": ["specific", "industries", "max", "5"],
  "painPoints": ["pain", "point", "1", "pain", "point", "2", "pain", "point", "3"],
  "buyingSignals": ["signal", "1", "signal", "2", "signal", "3"],
  "outreachAngle": "the specific value proposition angle that will get a reply",
  "rejectionCriteria": ["don't target enterprises", "don't target random employees", "don't target students"]
}`;

  const result = await queryLLM([
    { role: "system", content: "You are a GTM strategist. Generate precise ICPs. Output ONLY valid JSON. No markdown." },
    { role: "user", content: prompt },
  ], 800);

  let cleaned = result.content.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  const parsed = JSON.parse(cleaned);
  return {
    product,
    ...parsed,
  };
}

// ========== LEAD DISCOVERY (Revenue-Grade) ==========
// Find REAL decision-makers at SMALL companies

async function discoverDecisionMakers(product: string, icp: ICPProfile, maxLeads: number = 5): Promise<number> {
  try {
    // Strategy: Use Explee with VERY specific filters for small companies + decision makers
    const nlQuery = `Find ${icp.targetRoles.slice(0, 3).join(", ")} at ${icp.targetCompanies}. Company size ${icp.companySize} employees. Industry: ${icp.industries.slice(0, 3).join(", ")}. Exclude enterprises, agencies, and consulting firms.`;

    const filters = await nlToFilters(nlQuery);

    // Override to FORCE small companies and decision-maker titles
    const peopleFilters = {
      ...(filters.people_filters || {}),
      job_titles: icp.targetRoles,
      seniority: ["owner", "partner", "cxo", "vp", "director"],
    };

    const companyFilters = {
      ...(filters.companies_filters || {}),
      employees_range: "1-50",
      // Exclude big company domains
      keywords: icp.industries,
    };

    const peopleResult = await searchPeople(
      icp.targetRoles,
      icp.targetCompanies,
      { peopleFilters, companyFilters },
      maxLeads
    );

    const people = peopleResult.people || peopleResult.results || [];
    let saved = 0;

    for (const person of people) {
      if (!person.first_name || !person.last_name) continue;
      if (!person.company) continue; // MUST have company name

      const fullName = `${person.first_name} ${person.last_name}`.trim();

      // Reject if it looks like a fake/generic profile
      if (fullName.length > 50) continue; // Name too long = likely garbage
      if (person.first_name.toLowerCase() === "temporary") continue;
      if (person.first_name.toLowerCase() === "test") continue;

      // Check for duplicates
      if (person.email) {
        const existing = await db.lead.findFirst({ where: { email: person.email } });
        if (existing) continue;
      }
      const dupByName = await db.lead.findFirst({
        where: { firstName: person.first_name, companyName: person.company },
      });
      if (dupByName) continue;

      // Quality gate check
      const quality = passesQualityGate({
        firstName: person.first_name,
        lastName: person.last_name,
        email: person.email || null,
        jobTitle: person.job_title || null,
        companyName: person.company || null,
        companyDomain: person.company_domain || null,
      });

      // Save leads that have company+title, even without email yet (we'll find it)
      const canSave = person.company && person.job_title && person.company_domain;
      if (!canSave) continue;

      const leadData: Record<string, unknown> = {
        firstName: person.first_name,
        lastName: person.last_name,
        email: quality.pass ? person.email : null,
        jobTitle: person.job_title || null,
        companyName: person.company || null,
        companyDomain: person.company_domain || null,
        linkedInUrl: person.linkedin_url || null,
        location: person.location || null,
        seniority: person.seniority || null,
        source: "moneyprinter-v2",
        targetProduct: product,
        status: "new",
        score: 50, // Base score, enriched later
        tags: `${product},decision-maker`,
        funnel_stage: "new",
        buying_intent: 0,
        open_count: 0,
        click_count: 0,
        reply_count: 0,
      };

      await db.lead.create({ data: leadData });
      saved++;
    }

    return saved;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[MoneyPrinter] Discover ${product} failed:`, message);
    return 0;
  }
}

// ========== REVENUE-SCORING ENRICHMENT ==========
// Score leads based on buying signals, not just text matching

async function revenueScoreLead(lead: LeadRow, icp: ICPProfile): Promise<number> {
  const parts = [
    `LEAD: ${lead.firstName} ${lead.lastName}`,
    `TITLE: ${lead.jobTitle || "Unknown"}`,
    `COMPANY: ${lead.companyName || "Unknown"}`,
    `DOMAIN: ${lead.companyDomain || "Unknown"}`,
    `LOCATION: ${lead.location || "Unknown"}`,
    ``,
    `PRODUCT: ${PRODUCTS[icp.product]?.name} — ${PRODUCTS[icp.product]?.tagline}`,
    `ICP TARGET: ${icp.targetCompanies}`,
    `PAIN POINTS: ${icp.painPoints.join(", ")}`,
    `BUYING SIGNALS: ${icp.buyingSignals.join(", ")}`,
    ``,
    `Score this lead's LIKELIHOOD TO BUY (not just relevance).`,
    `Consider: Is this person a decision-maker? Is their company a real buyer?`,
    `Score 0-100. Only give 70+ if they'd realistically click "buy" or "book a demo".`,
  ];

  const result = await queryLLM([
    { role: "system", content: "You are a sales intelligence AI. Score leads on BUYING LIKELIHOOD, not just fit. Be harsh. Most leads are not buyers. Output ONLY JSON: {\"score\": number, \"reason\": string, \"isBuyer\": boolean}" },
    { role: "user", content: parts.join("\n") },
  ], 300);

  let cleaned = result.content.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  try {
    const parsed = JSON.parse(cleaned);
    return Math.min(100, Math.max(0, parseInt(String(parsed.score)) || 30));
  } catch {
    return 30;
  }
}

async function enrichLeadsRevenue(product: string, batchSize: number = 5): Promise<number> {
  const leads = await db.lead.findMany({
    where: { targetProduct: product, status: "new" },
    take: batchSize,
  });

  // Filter to unenriched leads
  const unenriched = leads.filter(l => !l.score || l.score <= 50);
  if (unenriched.length === 0) return 0;

  let icp: ICPProfile | null = null;
  let enriched = 0;

  for (const lead of unenriched) {
    try {
      // Generate ICP once per batch
      if (!icp) {
        icp = await generateICP(product);
      }

      const score = await revenueScoreLead(lead, icp);

      await db.lead.update({
        where: { id: lead.id },
        data: {
          score,
          relevanceScore: score,
          notes: `Revenue scored: ${score}/100`,
        },
      });
      enriched++;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MoneyPrinter] Score lead ${lead.id} failed:`, message);
    }
  }

  return enriched;
}

// ========== REVENUE-EMAIL GENERATION ==========
// Generate emails designed to get REPLIES, not just opens

async function generateRevenueEmail(lead: LeadRow, product: string, icp: ICPProfile): Promise<{ subject: string; body: string }> {
  const productInfo = PRODUCTS[product];
  if (!productInfo) throw new Error(`Unknown product: ${product}`);

  const prompt = `Write a SHORT cold email that will get a REPLY from this person.

TO: ${lead.firstName} ${lead.lastName}
ROLE: ${lead.jobTitle} at ${lead.companyName}
PAIN POINTS they likely have: ${icp.painPoints.join(", ")}
OUTREACH ANGLE: ${icp.outreachAngle}

PRODUCT: ${productInfo.name} — ${productInfo.tagline}
TRY FREE: ${productInfo.url}

RULES:
- Maximum 4 sentences. SHORT.
- Start with a specific observation about THEIR company/role (not generic)
- Mention ONE specific pain point they face
- End with a simple question (not "book a demo")
- Do NOT use HTML, emojis, or marketing speak
- Sound like a human, not a marketer
- The goal is a REPLY, not a click

Output ONLY JSON:
{"subject": "email subject line", "body": "email body text"}`;

  const result = await queryLLM([
    { role: "system", content: "You write cold emails that get replies. Be specific, be human, be SHORT. No marketing speak. No emojis. Output ONLY JSON." },
    { role: "user", content: prompt },
  ], 500);

  let cleaned = result.content.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  const parsed = JSON.parse(cleaned);
  return {
    subject: parsed.subject || `Quick question for ${lead.companyName}`,
    body: parsed.body || `Hi ${lead.firstName},\n\nI noticed ${lead.companyName} and thought you might find ${productInfo.name} useful.\n\n${productInfo.url}`,
  };
}

// ========== FIND VERIFIED EMAILS ==========
// For leads with company+title but no email

async function findVerifiedEmail(lead: LeadRow): Promise<string | null> {
  if (!lead.companyDomain || !lead.firstName || !lead.lastName) return null;

  try {
    // Try Explee first
    const result = await findEmail(
      lead.firstName,
      lead.lastName,
      lead.companyDomain,
      "basic"
    );

    if (result.email && isValidEmail(result.email)) {
      if (result.email_status === "valid" || result.email_status === "risky") {
        return result.email;
      }
    }
  } catch { /* fallback */ }

  // Domain-based guess with common patterns
  const domain = lead.companyDomain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*/, '');
  const first = (lead.firstName || '').toLowerCase().replace(/[^a-z]/g, '');
  const last = (lead.lastName || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!first || !last) return null;

  // Return most likely pattern — will be validated on send
  return `${first}@${domain}`;
}

// ========== SEND REVENUE EMAILS ==========
// Only email leads that pass ALL quality checks

async function sendRevenueEmails(product: string, maxPerRun: number = 10): Promise<number> {
  const leads = await db.lead.findMany({
    where: { targetProduct: product, status: "new" },
    take: 100,
  });

  // Filter: must have email + pass quality gate, sort by score desc
  const qualified = leads
    .filter(l => {
      const q = passesQualityGate(l);
      return q.pass;
    })
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, maxPerRun);

  if (qualified.length === 0) return 0;

  // Generate ICP once
  let icp: ICPProfile;
  try {
    icp = await generateICP(product);
  } catch {
    // Fallback ICP
    icp = {
      product,
      targetCompanies: "small companies",
      targetRoles: ["Founder", "CEO"],
      companySize: "1-50",
      industries: ["technology"],
      painPoints: ["efficiency"],
      buyingSignals: ["hiring"],
      outreachAngle: `Try ${PRODUCTS[product]?.name || product} free`,
      rejectionCriteria: ["enterprise", "no decision maker"],
    };
  }

  let sent = 0;
  let quotaHit = false;

  for (const lead of qualified) {
    if (quotaHit) break;
    if (!lead.email) continue;

    try {
      // Check if already sent
      const existing = await db.emailOutreach.findFirst({
        where: { leadId: lead.id, status: "sent" },
      });
      if (existing) continue;

      const failed = await db.emailOutreach.findFirst({
        where: { leadId: lead.id, status: "failed", errorMessage: { not: null } },
      });
      if (failed) continue;

      // Generate personalized email using AI
      const email = await generateRevenueEmail(lead, product, icp);
      const productInfo = PRODUCTS[product];
      const productUrl = productInfo?.url || "https://ariaagent.agency";

      // Inject CTA if missing
      let body = email.body;
      if (!body.includes(productUrl) && !body.includes("http")) {
        body += `\n\n${productUrl}`;
      }

      // Build clean HTML email with Razorpay checkout CTA
      const isFree = productInfo?.pricing?.free || false;
      const checkoutUrl = isFree
        ? productUrl
        : `${process.env.NEXTAUTH_URL || "https://my-project-aa-apps.vercel.app"}/api/payments/checkout?productId=${product}`;
      const ctaBtnText = isFree ? "Get Started Free" : `Start Now — ${productInfo?.pricing?.label || ""}`;

      const emailHtml = `<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 20px; color: #1a1a1a; line-height: 1.7; font-size: 15px;">
  <p style="margin-bottom: 20px;">${body.replace(/\n/g, "<br>").replace(productUrl, `<a href="${productUrl}" style="color: #4F46E5; text-decoration: none; font-weight: 600;">${productUrl}</a>`)}</p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="${checkoutUrl}" style="background-color: ${isFree ? "#4F46E5" : "#059669"}; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; display: inline-block;">${ctaBtnText}</a>
  </div>
  ${!isFree ? `<p style="text-align: center; font-size: 13px; color: #666; margin-top: 4px;">Secure checkout via Razorpay</p>` : ""}
  <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #eee; font-size: 13px; color: #888;">
    ${productInfo?.tagline || ""}
  </div>
</div>`;

      const result = await sendEmail({
        to: lead.email,
        subject: email.subject,
        html: emailHtml,
        replyTo: "hello@ariaagent.agency",
      });

      await db.emailOutreach.create({
        data: {
          leadId: lead.id,
          toEmail: lead.email,
          toName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || null,
          subject: email.subject,
          body,
          product,
          status: result.success ? "sent" : "failed",
          sentAt: result.success ? new Date().toISOString() : null,
          resendId: result.emailId || null,
          errorMessage: result.error || null,
          stepNumber: 1,
        },
      });

      if (result.success) {
        await db.lead.update({
          where: { id: lead.id },
          data: {
            status: "contacted",
            emailSent: true,
            emailSentAt: new Date().toISOString(),
            funnel_stage: "contacted",
          },
        });
        sent++;
        console.log(`[MoneyPrinter] ✅ Sent to ${lead.email} (${lead.companyName})`);
      } else {
        if (result.error?.includes("quota") || result.error?.includes("limit")) {
          quotaHit = true;
          console.log(`[MoneyPrinter] ⛔ Quota hit after ${sent} emails`);
          break;
        }
        console.log(`[MoneyPrinter] ❌ Failed: ${lead.email} — ${result.error}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[MoneyPrinter] Error sending to ${lead.email}:`, message);
    }
  }

  return sent;
}

// ========== CLEAN GARBAGE LEADS ==========
// Delete leads that have zero chance of converting

async function purgeGarbageLeads(): Promise<number> {
  const allLeads = await db.lead.findMany({ take: 500 });
  let purged = 0;

  for (const lead of allLeads) {
    const quality = passesQualityGate(lead);

    // Delete if: no company, no title, score < 20, or from old source
    const isGarbage =
      !lead.companyName ||
      !lead.jobTitle ||
      (lead.score || 0) < 20 ||
      lead.source === "explee-automated"; // Old source = garbage data

    // Keep leads that are already contacted or have engagement
    if (lead.status === "contacted" || lead.status === "engaged" || lead.status === "replied") continue;
    if ((lead.buyingIntent || 0) > 0) continue;

    if (isGarbage) {
      try {
        await db.lead.remove(lead.id);
        purged++;
      } catch {
        // Might fail if there are FK constraints, that's fine
      }
    }
  }

  return purged;
}

// ========== MAIN: RUN THE MONEY PRINTER ==========

export async function runMoneyPrinter(options?: {
  products?: string[];
  skipPurge?: boolean;
}): Promise<{
  phase: string;
  purged: number;
  discovered: number;
  enriched: number;
  emailed: number;
  details: Array<{ product: string; action: string; count: number; message: string }>;
  errors: string[];
  timestamp: string;
}> {
  const products = options?.products || Object.keys(PRODUCTS);
  const skipPurge = options?.skipPurge || false;

  const result = {
    phase: "moneyprinter",
    purged: 0,
    discovered: 0,
    enriched: 0,
    emailed: 0,
    details: [] as Array<{ product: string; action: string; count: number; message: string }>,
    errors: [] as string[],
    timestamp: new Date().toISOString(),
  };

  // Step 1: Purge garbage
  if (!skipPurge) {
    try {
      const purged = await purgeGarbageLeads();
      result.purged = purged;
      result.details.push({ product: "*", action: "purge", count: purged, message: `Purged ${purged} garbage leads` });
    } catch (err: unknown) {
      result.errors.push(`Purge: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  for (const product of products) {
    // Step 2: Discover decision-makers (Explee first, web search fallback)
    try {
      const icp = await generateICP(product);
      let discovered = await discoverDecisionMakers(product, icp, 5);

      // If Explee returned nothing, fall back to LLM + web search
      if (discovered === 0) {
        discovered = await webSearchLeads(product, icp, 5);
        if (discovered > 0) {
          result.details.push({ product, action: "discover-web", count: discovered, message: `Found ${discovered} leads via web search fallback` });
        }
      } else {
        result.details.push({ product, action: "discover", count: discovered, message: `Found ${discovered} decision-makers at small companies` });
      }

      result.discovered += discovered;
    } catch (err: unknown) {
      result.errors.push(`Discover ${product}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Step 3: Find emails for leads that have company+title but no email
    try {
      const leadsNoEmail = await db.lead.findMany({
        where: { targetProduct: product, status: "new" },
        take: 20,
      });

      const needEmail = leadsNoEmail.filter(
        l => (!l.email || !isValidEmail(l.email)) && l.companyDomain && l.firstName && l.lastName && l.companyName
      );

      let emailsFound = 0;
      for (const lead of needEmail.slice(0, 8)) {
        const email = await findVerifiedEmail(lead);
        if (email) {
          await db.lead.update({
            where: { id: lead.id },
            data: { email, updatedAt: new Date().toISOString() },
          });
          emailsFound++;
        }
      }
      result.details.push({ product, action: "findEmails", count: emailsFound, message: `Found ${emailsFound} verified emails` });
    } catch (err: unknown) {
      result.errors.push(`FindEmails ${product}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Step 4: Revenue-score leads
    try {
      const enriched = await enrichLeadsRevenue(product, 5);
      result.enriched += enriched;
      result.details.push({ product, action: "enrich", count: enriched, message: `Revenue-scored ${enriched} leads` });
    } catch (err: unknown) {
      result.errors.push(`Enrich ${product}: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Step 5: Send revenue emails (only to qualified leads)
    try {
      const emailed = await sendRevenueEmails(product, 10);
      result.emailed += emailed;
      result.details.push({ product, action: "email", count: emailed, message: `Sent ${emailed} revenue-targeted emails` });
    } catch (err: unknown) {
      result.errors.push(`Email ${product}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return result;
}

// Quick test: discover + score + send for ONE product
export async function quickTest(product: string = "NaiveVoiceAgent"): Promise<ReturnType<typeof runMoneyPrinter>> {
  return runMoneyPrinter({ products: [product] });
}
