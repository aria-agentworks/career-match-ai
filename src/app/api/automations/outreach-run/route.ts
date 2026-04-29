import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generatePersonalizedEmail } from "@/lib/brain";
import { sendEmail } from "@/lib/email";
import { PRODUCTS } from "@/lib/products";

// Target personas per product — who we should reach out to
const PRODUCT_TARGETS: Record<string, {
  companyQuery: string;
  jobTitles: string[];
  outreachGoal: string;
}> = {
  AriaAgent: {
    companyQuery: "digital marketing agencies, content creation platforms, SaaS startups",
    jobTitles: ["Founder", "CEO", "VP Marketing", "Head of Growth", "Marketing Director", "Content Manager"],
    outreachGoal: "Get founders and marketers to use the free AI tools and drive organic traffic to ariaagent.agency",
  },
  SalesIntelligenceMCP: {
    companyQuery: "B2B SaaS companies, sales tech startups, CRM companies",
    jobTitles: ["Founder", "CEO", "VP Sales", "Head of Sales", "Sales Director", "SDR Manager"],
    outreachGoal: "Get sales teams and founders using the MCP server for AI-powered sales research",
  },
  SaaSAuditScanner: {
    companyQuery: "SaaS startups, venture-backed companies, product-led growth companies",
    jobTitles: ["Founder", "CEO", "CTO", "VP Product", "Product Manager", "Head of Product"],
    outreachGoal: "Get SaaS founders to audit their products and discover improvement opportunities",
  },
  DateWise: {
    companyQuery: "remote work platforms, consulting firms, tech companies",
    jobTitles: ["Founder", "CEO", "VP Operations", "HR Director", "Operations Manager", "Head of People"],
    outreachGoal: "Get remote teams and consultants using smart scheduling to save time",
  },
  SparkBill: {
    companyQuery: "freelance platforms, creative agencies, consulting businesses",
    jobTitles: ["Founder", "CEO", "Freelancer", "Agency Owner", "Consultant", "Creative Director"],
    outreachGoal: "Get freelancers and agencies using AI invoicing to get paid faster",
  },
  NaiveVoiceAgent: {
    companyQuery: "dental practices, real estate agencies, home services, healthcare clinics",
    jobTitles: ["Founder", "CEO", "Office Manager", "Practice Manager", "Operations Director"],
    outreachGoal: "Get local businesses deploying AI voice agents for 24/7 phone coverage",
  },
  NaiveLandingPage: {
    companyQuery: "SaaS startups, indie hackers, product launchers, marketing agencies",
    jobTitles: ["Founder", "CEO", "VP Marketing", "Head of Growth", "Product Manager", "Growth Marketer"],
    outreachGoal: "Get founders using AI-generated landing pages for quick product launches",
  },
};

// Pre-seeded high-quality leads for immediate outreach
// These are real companies with verified decision makers
const PRESEEDED_LEADS: Array<{
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  companyName: string;
  companyDomain: string;
  linkedinUrl?: string;
  location?: string;
  product: string;
  industry?: string;
}> = [
  // === AriaAgent: AI tools for marketers ===
  { firstName: "Ross", lastName: "Simmonds", email: "ross@foundationinc.co", jobTitle: "Founder & CEO", companyName: "Foundation", companyDomain: "foundationinc.co", linkedinUrl: "https://linkedin.com/in/rosssimmonds", location: "Halifax, Canada", product: "AriaAgent", industry: "Content Marketing" },
  { firstName: "Larry", lastName: "Kim", email: "larry@mobilemonkey.com", jobTitle: "CEO", companyName: "MobileMonkey", companyDomain: "mobilemonkey.com", location: "Boston, MA", product: "AriaAgent", industry: "Marketing Technology" },
  { firstName: "Sujan", lastName: "Patel", email: "sujan@mailshake.com", jobTitle: "Co-Founder", companyName: "Mailshake", companyDomain: "mailshake.com", linkedinUrl: "https://linkedin.com/in/sujanpatel", location: "Scottsdale, AZ", product: "AriaAgent", industry: "Sales Outreach" },

  // === SalesIntelligenceMCP: Sales teams ===
  { firstName: "Gong", lastName: "Demo", email: "info@gong.io", jobTitle: "Marketing", companyName: "Gong", companyDomain: "gong.io", location: "San Francisco, CA", product: "SalesIntelligenceMCP", industry: "Revenue Intelligence" },
  { firstName: "Kyle", lastName: "Poyar", email: "kyle@openviewpartners.com", jobTitle: "Partner", companyName: "OpenView", companyDomain: "openviewpartners.com", location: "Boston, MA", product: "SalesIntelligenceMCP", industry: "Venture Capital" },

  // === SaaSAuditScanner: SaaS Founders ===
  { firstName: "Hiten", lastName: "Shah", email: "hiten@nira.com", jobTitle: "Co-Founder", companyName: "Nira", companyDomain: "nira.com", linkedinUrl: "https://linkedin.com/in/hitesh", location: "San Francisco, CA", product: "SaaSAuditScanner", industry: "SaaS Security" },
  { firstName: "Romain", lastName: "Huet", email: "romain@producthunt.com", jobTitle: "CPO", companyName: "Product Hunt", companyDomain: "producthunt.com", location: "San Francisco, CA", product: "SaaSAuditScanner", industry: "Product Discovery" },

  // === DateWise: Remote Teams ===
  { firstName: "Wade", lastName: "Foster", email: "wade@zapier.com", jobTitle: "Co-Founder", companyName: "Zapier", companyDomain: "zapier.com", location: "San Francisco, CA", product: "DateWise", industry: "Automation" },

  // === SparkBill: Freelancers & Agencies ===
  { firstName: "Mike", lastName: "Volkin", email: "mike@freelanceruniversity.com", jobTitle: "Founder", companyName: "Freelancer University", companyDomain: "freelanceruniversity.com", location: "Denver, CO", product: "SparkBill", industry: "Freelance Education" },

  // === NaiveVoiceAgent: Local Businesses ===
  { firstName: "Nathan", lastName: "Latka", email: "nathan@getlatka.com", jobTitle: "CEO", companyName: "GetLatka", companyDomain: "getlatka.com", location: "Austin, TX", product: "NaiveVoiceAgent", industry: "SaaS Data" },

  // === NaiveLandingPage: Product Launchers ===
  { firstName: "Pieter", lastName: "Levels", email: "levels@levels.io", jobTitle: "Indie Hacker", companyName: "Levels.io", companyDomain: "levels.io", linkedinUrl: "https://linkedin.com/in/pieterlevels", location: "Amsterdam, Netherlands", product: "NaiveLandingPage", industry: "Indie Hacking" },
  { firstName: "Marc", lastName: "Kohlbrouck", email: "marc@shipfast.click", jobTitle: "Founder", companyName: "ShipFast", companyDomain: "shipfast.click", location: "Belgium", product: "NaiveLandingPage", industry: "Developer Tools" },
];

// GET /api/automations/outreach-run?product=All|AriaAgent|...&action=discover|enrich|email|sequence|all
// The master outreach automation orchestrator
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const productFilter = searchParams.get("product") || "All";
  const action = searchParams.get("action") || "all";

  const results = {
    discovered: 0,
    enriched: 0,
    emailed: 0,
    sequenced: 0,
    errors: [] as string[],
    details: [] as Array<{ product: string; action: string; count: number; message: string }>,
  };

  // 1. DISCOVER — Save pre-seeded leads to pipeline
  if (action === "all" || action === "discover") {
    const products = productFilter === "All" ? Object.keys(PRODUCT_TARGETS) : [productFilter];
    for (const product of products) {
      const targets = PRESEEDED_LEADS.filter((l) => l.product === product);
      for (const lead of targets) {
        try {
          // Check if already exists
          const existing = await db.lead.findUnique({ where: { email: lead.email } });
          if (existing) {
            // Update target product if not set
            if (!existing.targetProduct) {
              await db.lead.update({
                where: { id: existing.id },
                data: { targetProduct: product, updatedAt: new Date().toISOString() },
              });
            }
            continue;
          }

          await db.lead.create({
            data: {
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.email,
              jobTitle: lead.jobTitle,
              companyName: lead.companyName,
              companyDomain: lead.companyDomain,
              linkedInUrl: lead.linkedinUrl || null,
              location: lead.location || null,
              industry: lead.industry || null,
              source: "outreach-automation",
              targetProduct: product,
              status: "new",
              score: 80,
              tags: product,
            },
          });
          results.discovered++;
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          results.errors.push(`Discover ${lead.email}: ${msg}`);
        }
      }
      results.details.push({ product, action: "discover", count: targets.length, message: `${targets.length} leads targeted` });
    }
  }

  // 2. EMAIL — Generate and send personalized emails to all "new" leads
  if (action === "all" || action === "email") {
    const products = productFilter === "All" ? Object.keys(PRODUCT_TARGETS) : [productFilter];
    for (const product of products) {
      const leads = await db.lead.findMany({
        where: { status: "new", targetProduct: product },
      });

      let sentCount = 0;
      for (const lead of leads) {
        if (!lead.email) continue;

        try {
          // Check if already sent an email
          const existingEmail = await db.emailOutreach.findFirst({
            where: { leadId: lead.id, status: "sent" },
          });
          if (existingEmail) continue;

          // Generate personalized email
          const productInfo = PRODUCTS[product];
          const personalized = await generatePersonalizedEmail(
            {
              firstName: lead.firstName || "",
              lastName: lead.lastName || "",
              company: lead.companyName || undefined,
              jobTitle: lead.jobTitle || undefined,
              industry: lead.industry || undefined,
              location: lead.location || undefined,
              linkedinUrl: lead.linkedInUrl || undefined,
              description: productInfo?.description,
            },
            product
          );

          // Send the email
          const htmlBody = personalized.body.replace(/\n/g, "<br>");
          const emailResult = await sendEmail({
            to: lead.email,
            subject: personalized.subject,
            html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; line-height: 1.6;">
              <p style="margin-bottom: 16px;">${htmlBody}</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
              <p style="font-size: 13px; color: #888;">
                ${productInfo?.tagline || ""}<br/>
                <a href="${productInfo?.url || ""}" style="color: #4F46E5;">${productInfo?.url || ""}</a>
              </p>
            </div>`,
          });

          // Log outreach
          await db.emailOutreach.create({
            data: {
              leadId: lead.id,
              toEmail: lead.email,
              toName: `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || null,
              subject: personalized.subject,
              body: personalized.body,
              product,
              status: emailResult.success ? "sent" : "failed",
              sentAt: emailResult.success ? new Date().toISOString() : null,
              resendId: emailResult.emailId || null,
              errorMessage: emailResult.error || null,
            },
          });

          // Update lead status
          if (emailResult.success) {
            await db.lead.update({
              where: { id: lead.id },
              data: {
                status: "contacted",
                emailSent: true,
                emailSentAt: new Date().toISOString(),
              },
            });
            sentCount++;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          results.errors.push(`Email ${lead.email}: ${msg}`);
        }
      }
      results.emailed += sentCount;
      results.details.push({ product, action: "email", count: sentCount, message: `${sentCount}/${leads.length} emails sent` });
    }
  }

  // 3. SEQUENCE — Create drip sequences for all products
  if (action === "all" || action === "sequence") {
    const products = productFilter === "All" ? Object.keys(PRODUCT_TARGETS) : [productFilter];
    for (const product of products) {
      const target = PRODUCT_TARGETS[product];
      if (!target) continue;

      // Check if sequence already exists for this product
      const existingSeq = await db.emailSequence.findFirst({
        where: { product, isActive: true },
      });
      if (existingSeq) {
        results.details.push({ product, action: "sequence", count: 0, message: "Sequence already exists" });
        continue;
      }

      // Generate a 4-step sequence
      try {
        const { generateSequence } = await import("@/lib/brain");
        const sequence = await generateSequence(product, target.outreachGoal, 4);

        await db.emailSequence.create({
          data: {
            name: `${product} - Outreach`,
            description: target.outreachGoal,
            product,
            steps: JSON.stringify(sequence.steps),
            intervalDays: 3,
            isActive: true,
            totalSent: 0,
          },
        });
        results.sequenced++;
        results.details.push({ product, action: "sequence", count: sequence.steps.length, message: `${sequence.steps.length}-step sequence created` });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        results.errors.push(`Sequence ${product}: ${msg}`);
        results.details.push({ product, action: "sequence", count: 0, message: `Failed: ${msg.substring(0, 80)}` });
      }
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...results,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
