// src/lib/multichannel.ts
// Multi-channel outreach templates and strategies for X, LinkedIn, Reddit
// Generates outreach content for each channel based on product and lead

import { queryLLM } from "./brain";
import { PRODUCTS } from "./products";

interface MultiChannelMessage {
  channel: "twitter" | "linkedin" | "reddit";
  content: string;
  handle?: string;
  action: "dm" | "comment" | "post" | "connection_request";
  status: "draft" | "ready" | "sent";
}

interface MultiChannelPlan {
  leadId: string;
  leadName: string;
  product: string;
  messages: MultiChannelMessage[];
  notes: string;
}

// Generate multi-channel outreach plan for a lead
export async function generateMultiChannelPlan(lead: {
  firstName: string;
  lastName: string;
  jobTitle?: string;
  companyName?: string;
  linkedInUrl?: string;
  twitterHandle?: string;
  industry?: string;
}, product: string): Promise<MultiChannelPlan> {
  const productInfo = PRODUCTS[product];
  if (!productInfo) throw new Error(`Unknown product: ${product}`);

  const result = await queryLLM([
    {
      role: "system",
      content: `You are a multi-channel outreach strategist. Create personalized outreach messages for different platforms. Each message should feel authentic and platform-native. NEVER sound like a marketer.

Rules:
- Twitter/X DMs: Max 280 chars, casual, reference something specific about their work
- LinkedIn: Professional but warm, reference mutual interests or their content
- Reddit: Helpful, no self-promotion, add genuine value first
- Always mention something specific about the person's work/company
- Include the product naturally, not as a hard sell`
    },
    {
      role: "user",
      content: `Create a multi-channel outreach plan:

PERSON: ${lead.firstName} ${lead.lastName}
ROLE: ${lead.jobTitle || "Unknown"}
COMPANY: ${lead.companyName || "Unknown"}
${lead.linkedInUrl ? `LINKEDIN: ${lead.linkedInUrl}` : ""}
${lead.twitterHandle ? `TWITTER: @${lead.twitterHandle}` : ""}

PRODUCT: ${productInfo.name} — ${productInfo.tagline}
DESCRIPTION: ${productInfo.description}
URL: ${productInfo.url}

Generate 3 outreach messages (one per channel: Twitter DM, LinkedIn connection/message, Reddit engagement). Make each one unique and personalized.

Output JSON:
{
  "messages": [
    {"channel": "twitter", "content": "...", "action": "dm"},
    {"channel": "linkedin", "content": "...", "action": "connection_request"},
    {"channel": "reddit", "content": "...", "action": "comment"}
  ],
  "notes": "Strategy notes for this lead"
}`
    }
  ], 1000);

  let cleaned = result.content.trim();
  if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

  const parsed = JSON.parse(cleaned);
  return {
    leadId: "",
    leadName: `${lead.firstName} ${lead.lastName}`,
    product,
    messages: parsed.messages || [],
    notes: parsed.notes || "",
  };
}
