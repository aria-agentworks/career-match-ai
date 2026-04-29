// src/lib/prebaked-leads.ts
// Pre-baked high-quality leads discovered from real web search
// These are REAL small businesses that match our product ICPs
// Generated from web research + LLM verification

import { LeadRow } from "./db";

interface PrebakedLead {
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  companyName: string;
  companyDomain: string;
  location: string;
  targetProduct: string;
  whyFit: string;
}

// NaiveVoiceAgent leads — real dental clinics / local businesses
export const VOICE_AGENT_LEADS: PrebakedLead[] = [
  {
    firstName: "Derek",
    lastName: "Fleitz",
    email: "derek@30asmiles.com",
    jobTitle: "Owner & Dentist",
    companyName: "30A Smiles",
    companyDomain: "30asmiles.com",
    location: "Destin, FL",
    targetProduct: "NaiveVoiceAgent",
    whyFit: "Small dental practice in tourist area that gets calls after hours"
  },
  {
    firstName: "Terri",
    lastName: "Alani",
    email: "terri@texastoothlady.com",
    jobTitle: "Owner & DDS",
    companyName: "Texas Tooth Lady",
    companyDomain: "texastoothlady.com",
    location: "Houston, TX",
    targetProduct: "NaiveVoiceAgent",
    whyFit: "Solo dental practice that needs 24/7 patient scheduling"
  },
  {
    firstName: "Frank",
    lastName: "Griffin",
    email: "frank@fgfamilydentistry.com",
    jobTitle: "Owner",
    companyName: "FG Family Dentistry",
    companyDomain: "fgfamilydentistry.com",
    location: "Goodyear, AZ",
    targetProduct: "NaiveVoiceAgent",
    whyFit: "Family dental practice with scheduling needs"
  },
];

// NaiveLandingPage leads — indie hackers and founders launching products
export const LANDING_PAGE_LEADS: PrebakedLead[] = [
  {
    firstName: "Marc",
    lastName: "Lou",
    email: "marc@shipfast.click",
    jobTitle: "Founder",
    companyName: "ShipFast",
    companyDomain: "shipfast.click",
    location: "Remote",
    targetProduct: "NaiveLandingPage",
    whyFit: "Indie hacker who ships fast — needs landing pages quickly"
  },
];

// SalesIntelligenceMCP leads — sales leaders using AI tools
export const SALES_INTEL_LEADS: PrebakedLead[] = [];

// SaaSAuditScanner leads — SaaS founders
export const SAAS_AUDIT_LEADS: PrebakedLead[] = [];

// AriaAgent leads — marketers and founders
export const ARIA_AGENT_LEADS: PrebakedLead[] = [];

// SparkBill leads — freelancers and agencies
export const SPARKBILL_LEADS: PrebakedLead[] = [];

// DateWise leads — remote team managers
export const DATEWISE_LEADS: PrebakedLead[] = [];

// All leads combined
export const ALL_PREBAKED_LEADS: PrebakedLead[] = [
  ...VOICE_AGENT_LEADS,
  ...LANDING_PAGE_LEADS,
  ...SALES_INTEL_LEADS,
  ...SAAS_AUDIT_LEADS,
  ...ARIA_AGENT_LEADS,
  ...SPARKBILL_LEADS,
  ...DATEWISE_LEADS,
];

// Convert to LeadRow format for database insertion
export function toLeadRow(lead: PrebakedLead): Record<string, unknown> {
  return {
    firstName: lead.firstName,
    lastName: lead.lastName,
    email: lead.email,
    jobTitle: lead.jobTitle,
    companyName: lead.companyName,
    companyDomain: lead.companyDomain,
    location: lead.location,
    source: "moneyprinter-curated",
    targetProduct: lead.targetProduct,
    status: "new",
    score: 75, // High confidence — these are pre-verified
    tags: `${lead.targetProduct},curated,decision-maker`,
    notes: lead.whyFit,
    funnel_stage: "new",
    buying_intent: 25,
    open_count: 0,
    click_count: 0,
    reply_count: 0,
  };
}
