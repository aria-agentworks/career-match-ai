import { PRODUCTS, PRODUCT_LIST } from "./products";

// ========== LLM Backends ==========
// On Vercel, we use Anthropic (primary), NVIDIA NIM, and Withone AI as fallbacks.
// The z-ai-web-dev-sdk only works inside the preview sandbox and causes config
// file errors on Vercel, so it has been removed.

interface LLMResponse {
  content: string;
  model: string;
}

async function queryAnthropic(messages: Array<{ role: string; content: string }>, maxTokens = 4000): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const systemMsg = messages.find(m => m.role === "system")?.content || "";
  const nonSystemMsgs = messages.filter(m => m.role !== "system");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemMsg,
      messages: nonSystemMsgs,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err.substring(0, 300)}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  if (!text) throw new Error("Anthropic returned empty response");
  return { content: text, model: "claude-sonnet-4" };
}

async function queryNvidiaNIM(messages: Array<{ role: string; content: string }>, maxTokens = 4000): Promise<LLMResponse> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY not set");

  const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
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
    throw new Error(`NVIDIA API error ${res.status}: ${err.substring(0, 300)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("NVIDIA returned empty response");
  return { content: text, model: "llama-3.1-405b" };
}

async function queryWithoneAI(messages: Array<{ role: string; content: string }>, maxTokens = 4000): Promise<LLMResponse> {
  const apiKey = process.env.WITHONE_AI_API_KEY;
  if (!apiKey) throw new Error("WITHONE_AI_API_KEY not set");

  const res = await fetch("https://api.withone.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      temperature: 0.7,
      messages,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Withone AI API error ${res.status}: ${err.substring(0, 300)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("Withone AI returned empty response");
  return { content: text, model: "withone-claude" };
}

// Main LLM function with fallback chain: Anthropic → NVIDIA → Withone
export async function queryLLM(messages: Array<{ role: string; content: string }>, maxTokens = 4000): Promise<LLMResponse> {
  const errors: string[] = [];

  // 1. Anthropic Claude (primary)
  try {
    console.log("[Brain] Trying Anthropic Claude...");
    const result = await queryAnthropic(messages, maxTokens);
    console.log(`[Brain] Anthropic succeeded (model: ${result.model})`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Brain] Anthropic failed: ${msg}`);
    errors.push(`Anthropic: ${msg}`);
  }

  // 2. NVIDIA NIM
  try {
    console.log("[Brain] Trying NVIDIA NIM...");
    const result = await queryNvidiaNIM(messages, maxTokens);
    console.log(`[Brain] NVIDIA succeeded (model: ${result.model})`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Brain] NVIDIA failed: ${msg}`);
    errors.push(`NVIDIA: ${msg}`);
  }

  // 3. Withone AI
  try {
    console.log("[Brain] Trying Withone AI...");
    const result = await queryWithoneAI(messages, maxTokens);
    console.log(`[Brain] Withone AI succeeded (model: ${result.model})`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Brain] Withone AI failed: ${msg}`);
    errors.push(`Withone AI: ${msg}`);
  }

  throw new Error(`All LLM backends failed:\n${errors.join("\n")}`);
}

const AVAILABLE_ACTIONS = [
  "TWITTER_CREATE_TWEET",
  "TWITTER_CREATE_THREAD",
  "LINKEDIN_CREATE_POST",
  "DEVTO_CREATE_ARTICLE",
  "REDDIT_CREATE_POST",
  "SLACK_SEND_MESSAGE",
];

// System prompt for the Brain
const BRAIN_SYSTEM_PROMPT = `You are the Brain of Aria Marketing Hub — an AI marketing strategist for a solo developer who built multiple products.

YOUR ROLE: Create actionable marketing plans that can be executed by an AI system. You output STRUCTURED PLANS, not advice.

AVAILABLE PRODUCTS:
${PRODUCT_LIST.map(
  (p) => `- ${p.name}: ${p.tagline} (${p.url}) — Target: ${p.targetAudience}`
).join("\n")}

AVAILABLE PLATFORM ACTIONS (these are real Composio tool slugs):
${AVAILABLE_ACTIONS.map((a) => `- ${a}`).join("\n")}

CRITICAL RULES:
1. Every plan must be executable. Each step maps to a real tool action.
2. Content must be platform-appropriate:
   - TWITTER_CREATE_TWEET: Max 280 chars, use hashtags, engaging hook
   - TWITTER_CREATE_THREAD: Array of tweets, each < 280 chars, numbered
   - LINKEDIN_CREATE_POST: Professional tone, 700-1300 chars, value-driven
   - DEVTO_CREATE_ARTICLE: Full markdown article, 800-2000 words, with tags
   - REDDIT_CREATE_POST: Informative, no self-promotion feel, add value
3. NEVER write generic fluff. Every piece of content must be specific to the product.
4. Vary content types: tips, how-tos, comparisons, personal stories, announcements.
5. Always include relevant hashtags for social media posts.
6. For Dev.to articles, write substantial content with proper markdown headers, code blocks, and actionable takeaways.
7. Do NOT use emojis in titles. Use them sparingly in social media body text.

OUTPUT FORMAT: You MUST output valid JSON matching this exact schema:
{
  "plan_name": "Short descriptive name for this plan",
  "goal": "One sentence describing the overall goal",
  "steps": [
    {
      "order": 1,
      "action_slug": "TWITTER_CREATE_TWEET",
      "platform": "twitter",
      "product": "AriaAgent",
      "topic": "Short topic description",
      "params": {
        "text": "The actual tweet content here with hashtags"
      }
    },
    {
      "order": 2,
      "action_slug": "LINKEDIN_CREATE_POST",
      "platform": "linkedin",
      "product": "SalesIntelligenceMCP",
      "topic": "Short topic description",
      "params": {
        "text": "Professional LinkedIn post content"
      }
    },
    {
      "order": 3,
      "action_slug": "DEVTO_CREATE_ARTICLE",
      "platform": "devto",
      "product": "AriaAgent",
      "topic": "Short topic description",
      "params": {
        "title": "Article title",
        "body_markdown": "# Full markdown article here\\n\\n## Section\\n\\nContent...",
        "tags": ["ai", "tools"]
      }
    }
  ]
}

IMPORTANT: The "params" object must contain the exact parameters that the Composio tool action expects. For example:
- TWITTER_CREATE_TWEET expects: { "text": "..." }
- TWITTER_CREATE_THREAD expects: { "tweets": ["tweet1", "tweet2", ...] }
- LINKEDIN_CREATE_POST expects: { "text": "..." }
- DEVTO_CREATE_ARTICLE expects: { "title": "...", "body_markdown": "...", "tags": ["..."] }
- REDDIT_CREATE_POST expects: { "title": "...", "body": "...", "subreddit": "..." }
- SLACK_SEND_MESSAGE expects: { "text": "...", "channel": "..." }

You MUST output ONLY the JSON object, no markdown, no explanation, no code blocks.`;

export interface PlanStepInput {
  order: number;
  action_slug: string;
  platform: string;
  product: string;
  topic: string;
  params: Record<string, unknown>;
}

export interface MarketingPlanOutput {
  plan_name: string;
  goal: string;
  steps: PlanStepInput[];
}

// Generate a full marketing plan from a goal
export async function generatePlan(
  userGoal: string,
  selectedProducts: string[],
  selectedPlatforms: string[]
): Promise<MarketingPlanOutput> {
  const productInfo = selectedProducts
    .map((name) => PRODUCTS[name])
    .filter(Boolean)
    .map((p) => `${p.name}: ${p.tagline} — ${p.description}`)
    .join("\n");

  const platformInfo = selectedPlatforms
    .map((p) => {
      const action = AVAILABLE_ACTIONS.find((a) => a.toLowerCase().includes(p.toLowerCase()));
      return action ? `${p}: ${action}` : null;
    })
    .filter(Boolean)
    .join(", ");

  const userMessage = `Create a marketing plan with the following requirements:

GOAL: ${userGoal}

PRODUCTS TO PROMOTE:
${productInfo}

PLATFORMS: ${platformInfo}

Generate 5-8 steps. Each step must have real, publishable content — not placeholders. The content should be ready to post immediately.`;

  const result = await queryLLM([
    { role: "system", content: BRAIN_SYSTEM_PROMPT },
    { role: "user", content: userMessage },
  ], 4000);

  const raw = result.content;

  // Parse JSON from response (handle potential markdown wrapping)
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const plan: MarketingPlanOutput = JSON.parse(cleaned);
    return plan;
  } catch {
    // Try to extract JSON from the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const plan: MarketingPlanOutput = JSON.parse(jsonMatch[0]);
      return plan;
    }
    throw new Error("Failed to parse plan JSON from Brain response. Raw response:\n" + raw.substring(0, 500));
  }
}

// Generate a single piece of content for a specific platform and product
export async function generateContent(
  platform: string,
  product: string,
  topic: string
): Promise<{
  title?: string;
  body: string;
  hashtags?: string[];
  tags?: string[];
  actionSlug: string;
}> {
  const productInfo = PRODUCTS[product];

  const contentPrompts: Record<string, string> = {
    twitter: `Write a single tweet (max 280 characters) about: ${topic}\n\nProduct: ${productInfo?.name} — ${productInfo?.tagline}\n\nRules:\n- Hook in first line\n- Include 2-3 hashtags from: ${productInfo?.hashtags.join(", ")}\n- Include a call-to-action\n- Mention the product URL if natural: ${productInfo?.url}\n- Keep under 280 chars\n\nOutput ONLY the tweet text, nothing else.`,

    twitter_thread: `Write a Twitter thread (5-7 tweets) about: ${topic}\n\nProduct: ${productInfo?.name} — ${productInfo?.tagline}\nDescription: ${productInfo?.description}\n\nRules:\n- Tweet 1: Strong hook\n- Middle tweets: Value, insights, tips\n- Last tweet: CTA with ${productInfo?.url}\n- Each tweet under 280 chars\n- Use hashtags in tweet 1 and last tweet\n\nOutput as JSON array of strings: ["tweet1", "tweet2", ...]`,

    linkedin: `Write a LinkedIn post about: ${topic}\n\nProduct: ${productInfo?.name} — ${productInfo?.tagline}\nDescription: ${productInfo?.description}\nTarget audience: ${productInfo?.targetAudience}\n\nRules:\n- Professional but authentic tone (not corporate)\n- 700-1300 characters\n- Start with a hook or personal story\n- Include specific value/insight\n- End with a question to drive engagement\n- Mention ${productInfo?.url} naturally\n\nOutput ONLY the post text, nothing else.`,

    devto: `Write a Dev.to article about: ${topic}\n\nProduct: ${productInfo?.name} — ${productInfo?.tagline}\nDescription: ${productInfo?.description}\nKey features: ${productInfo?.keyFeatures?.join(", ")}\n\nRules:\n- 800-2000 words\n- Proper markdown with H2, H3 headers\n- Include code examples if relevant\n- Practical, actionable content\n- Authentic voice (you're the developer)\n- End with a summary and link to ${productInfo?.url}\n- Suggest 4-6 tags\n\nOutput as JSON: { "title": "Article Title", "body_markdown": "# Full article in markdown...", "tags": ["tag1", "tag2"] }`,

    reddit: `Write a Reddit post about: ${topic}\n\nProduct: ${productInfo?.name} — ${productInfo?.tagline}\nDescription: ${productInfo?.description}\n\nRules:\n- Informative, not promotional\n- Share genuine experience or insight\n- Be conversational\n- Include specific details and examples\n- No hard sell\n- Suggest an appropriate subreddit\n\nOutput as JSON: { "title": "Post title", "body": "Post body text", "subreddit": "subreddit_name" }`,

    slack: `Write a Slack message about: ${topic}\n\nProduct: ${productInfo?.name} — ${productInfo?.tagline}\nDescription: ${productInfo?.description}\n\nRules:\n- Short and punchy\n- Use formatting (bold, bullet points)\n- Include a link to ${productInfo?.url}\n\nOutput ONLY the message text.`,
  };

  const prompt = contentPrompts[platform] || contentPrompts.twitter;

  const result = await queryLLM([
    {
      role: "system",
      content:
        "You are a content marketing expert. You write engaging, platform-appropriate content that drives real engagement. Always follow the format rules exactly.",
    },
    { role: "user", content: prompt },
  ], 2000);

  const raw = result.content;
  let cleaned = raw.trim();

  const actionSlugs: Record<string, string> = {
    twitter: "TWITTER_CREATE_TWEET",
    twitter_thread: "TWITTER_CREATE_THREAD",
    linkedin: "LINKEDIN_CREATE_POST",
    devto: "DEVTO_CREATE_ARTICLE",
    reddit: "REDDIT_CREATE_POST",
    slack: "SLACK_SEND_MESSAGE",
  };

  const actionSlug = actionSlugs[platform] || "TWITTER_CREATE_TWEET";

  // For devto and reddit, parse JSON
  if (platform === "devto") {
    let jsonStr = cleaned;
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    try {
      const parsed = JSON.parse(jsonStr);
      return {
        title: parsed.title,
        body: parsed.body_markdown,
        tags: parsed.tags,
        actionSlug,
      };
    } catch {
      // fallback: treat as plain text
    }
  }

  if (platform === "reddit") {
    let jsonStr = cleaned;
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    try {
      const parsed = JSON.parse(jsonStr);
      return {
        title: parsed.title,
        body: parsed.body,
        actionSlug,
      };
    } catch {
      // fallback
    }
  }

  if (platform === "twitter_thread") {
    let jsonStr = cleaned;
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    try {
      const parsed = JSON.parse(jsonStr);
      return {
        body: JSON.stringify(parsed),
        actionSlug,
      };
    } catch {
      // fallback
    }
  }

  // Default: plain text response
  return {
    body: cleaned,
    hashtags: productInfo?.hashtags?.slice(0, 3) || [],
    actionSlug,
  };
}

// ========== Email Outreach Generation ==========

const EMAIL_SYSTEM_PROMPT = `You are an expert cold email copywriter for a solo developer who built multiple products. Your emails are:
- Professional but conversational (not corporate or salesy)
- Short and punchy (50-150 words)
- Personalized with the recipient's name, company, and role
- Provide genuine value in the first email (no hard sell)
- Include a clear but soft call-to-action
- Never use spammy language, urgency tricks, or clickbait
- Sound like a real person, not a marketing template

AVAILABLE PRODUCTS:
${PRODUCT_LIST.map(
  (p) => `- ${p.name}: ${p.tagline} — ${p.description} (${p.url})`
).join("\n")}

You MUST output ONLY valid JSON, no markdown, no explanation, no code blocks.`;

// Generate a single personalized cold email for a lead
export async function generatePersonalizedEmail(
  leadData: {
    firstName: string;
    lastName: string;
    company?: string;
    jobTitle?: string;
    industry?: string;
    location?: string;
    linkedinUrl?: string;
    description?: string;
  },
  product: string
): Promise<{ subject: string; body: string }> {
  const productInfo = PRODUCTS[product];
  const leadName = `${leadData.firstName} ${leadData.lastName}`.trim();
  const companyContext = leadData.company ? ` at ${leadData.company}` : "";
  const roleContext = leadData.jobTitle ? ` as a ${leadData.jobTitle}` : "";

  const userPrompt = `Write a cold outreach email with the following context:

RECIPIENT: ${leadName}${roleContext}${companyContext}
${leadData.industry ? `INDUSTRY: ${leadData.industry}` : ""}
${leadData.location ? `LOCATION: ${leadData.location}` : ""}
${leadData.description ? `ABOUT THEIR COMPANY: ${leadData.description}` : ""}

PRODUCT TO PROMOTE: ${productInfo?.name || product}
PRODUCT DESCRIPTION: ${productInfo?.description || "N/A"}
PRODUCT URL: ${productInfo?.url || "N/A"}

This is the FIRST email in a cold outreach sequence. Do NOT hard sell. Open with a genuine observation or value proposition related to their role/company. Be concise. End with a soft CTA like asking a question or suggesting a quick chat.

Output JSON:
{
  "subject": "Short, personalized email subject line",
  "body": "The full email body in plain text (no HTML). Keep it 50-150 words."
}`;

  const result = await queryLLM([
    { role: "system", content: EMAIL_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ], 1000);

  let cleaned = result.content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    return { subject: parsed.subject, body: parsed.body };
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return { subject: parsed.subject, body: parsed.body };
    }
    throw new Error("Failed to parse email JSON from Brain response");
  }
}

// Generate a multi-step drip sequence
export async function generateSequence(
  product: string,
  goal: string,
  stepCount: number = 4
): Promise<{
  name: string;
  description: string;
  steps: Array<{ stepNumber: number; subject: string; body: string; waitDays: number }>;
}> {
  const productInfo = PRODUCTS[product];

  const userPrompt = `Create a ${stepCount}-step email drip sequence with the following details:

PRODUCT: ${productInfo?.name || product}
PRODUCT DESCRIPTION: ${productInfo?.description || "N/A"}
PRODUCT URL: ${productInfo?.url || "N/A"}
GOAL: ${goal}

Create a ${stepCount}-step drip campaign. Each step should:
- Step 1: Cold intro with value (no hard sell, personalized opening)
- Step 2: Case study or social proof relevant to their role
- Step 3: Specific benefit/insight for their use case
${stepCount >= 4 ? "- Step 4: Gentle follow-up with a soft CTA" : ""}
${stepCount >= 5 ? "- Step 5: Final attempt with a relevant resource or offer" : ""}

Use placeholders like {{firstName}}, {{company}}, {{role}} for personalization.

Output JSON:
{
  "name": "Short sequence name",
  "description": "One-line description of this sequence",
  "steps": [
    {
      "stepNumber": 1,
      "subject": "Subject line for step 1",
      "body": "Full email body (50-150 words)",
      "waitDays": 3
    }
  ]
}`;

  const result = await queryLLM([
    { role: "system", content: EMAIL_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ], 2000);

  let cleaned = result.content.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    return {
      name: parsed.name,
      description: parsed.description,
      steps: parsed.steps.map((s: { stepNumber: number; subject: string; body: string; waitDays: number }) => ({
        stepNumber: s.stepNumber,
        subject: s.subject,
        body: s.body,
        waitDays: s.waitDays || 3,
      })),
    };
  } catch {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        name: parsed.name,
        description: parsed.description,
        steps: parsed.steps.map((s: { stepNumber: number; subject: string; body: string; waitDays: number }) => ({
          stepNumber: s.stepNumber,
          subject: s.subject,
          body: s.body,
          waitDays: s.waitDays || 3,
        })),
      };
    }
    throw new Error("Failed to parse sequence JSON from Brain response");
  }
}
