const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, PageNumber,
  BorderStyle, WidthType, ShadingType, PageBreak,
  TableOfContents, SectionType, Tab, TabStopType, TabStopPosition
} = require("docx");

// ── DM-1 Deep Cyan Palette ──
const C = {
  bg: "162235",
  primary: "FFFFFF",
  accent: "37DCF2",
  titleColor: "FFFFFF",
  subtitleColor: "B0B8C0",
  metaColor: "90989F",
  footerColor: "687078",
  headerBg: "1B6B7A",
  headerText: "FFFFFF",
  accentLine: "1B6B7A",
  innerLine: "C8DDE2",
  surface: "EDF3F5",
};

// ── Reusable formatting ──
const BODY_SIZE = 24;       // 12pt
const H1_SIZE = 32;         // 16pt
const H2_SIZE = 28;         // 14pt
const LINE_SPACING = 312;   // 1.3x
const CALIBRI = "Calibri";

function bodyPara(text, opts = {}) {
  return new Paragraph({
    spacing: { line: LINE_SPACING, after: 120 },
    alignment: AlignmentType.LEFT,
    ...opts.paraOpts,
    children: [
      new TextRun({
        text,
        font: CALIBRI,
        size: BODY_SIZE,
        color: "333333",
        ...opts.runOpts,
      }),
    ],
  });
}

function bodyParaRuns(runs, paraOpts = {}) {
  return new Paragraph({
    spacing: { line: LINE_SPACING, after: 120 },
    alignment: AlignmentType.LEFT,
    ...paraOpts,
    children: runs.map(r =>
      new TextRun({
        font: CALIBRI,
        size: BODY_SIZE,
        color: "333333",
        ...r,
      })
    ),
  });
}

function heading1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 200, line: LINE_SPACING },
  });
}

function heading2(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 160, line: LINE_SPACING },
  });
}

function accentBar() {
  // Thin cyan accent separator
  return new Paragraph({
    spacing: { before: 60, after: 60 },
    border: {
      bottom: { color: C.accent, space: 4, size: 6, style: BorderStyle.SINGLE },
    },
    children: [],
  });
}

function emptyPara(count = 1) {
  const paras = [];
  for (let i = 0; i < count; i++) {
    paras.push(new Paragraph({ children: [] }));
  }
  return paras;
}

// ── Table helpers ──
function headerCell(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: C.headerBg },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { line: LINE_SPACING },
        children: [
          new TextRun({
            text,
            font: CALIBRI,
            size: 22,
            bold: true,
            color: C.headerText,
          }),
        ],
      }),
    ],
  });
}

function dataCell(text, width, opts = {}) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    shading: { type: ShadingType.CLEAR, fill: opts.shade || C.primary },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    borders: {
      bottom: { color: C.innerLine, space: 0, size: 1, style: BorderStyle.SINGLE },
    },
    children: [
      new Paragraph({
        spacing: { line: LINE_SPACING },
        children: [
          new TextRun({
            text,
            font: CALIBRI,
            size: 20,
            color: "333333",
            bold: opts.bold || false,
          }),
        ],
      }),
    ],
  });
}

// ── Build Cover Section (R1: left-aligned, full-page bg) ──
function buildCoverSection() {
  // Calculate spacing to vertically center content on the page.
  // Page height ~16838 twips (A4). We'll use before spacing to push content down.
  const coverChildren = [
    // Large top spacing to push content into center
    new Paragraph({ spacing: { before: 4800 }, children: [] }),
    // Title
    new Paragraph({
      spacing: { after: 160 },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: "Aria Marketing Hub v2.0",
          font: CALIBRI,
          size: 52,
          bold: true,
          color: C.titleColor,
        }),
      ],
    }),
    // Accent line
    new Paragraph({
      spacing: { after: 200 },
      border: {
        bottom: { color: C.accent, space: 4, size: 12, style: BorderStyle.SINGLE },
      },
      children: [],
    }),
    // Subtitle
    new Paragraph({
      spacing: { after: 300 },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: "Multi-Agent Revenue Engine \u2014 Architecture Design Document",
          font: CALIBRI,
          size: 28,
          color: C.subtitleColor,
        }),
      ],
    }),
    // Meta lines
    new Paragraph({
      spacing: { after: 80 },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: "Confidential",
          font: CALIBRI,
          size: 22,
          color: C.metaColor,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: "April 2026",
          font: CALIBRI,
          size: 22,
          color: C.metaColor,
        }),
      ],
    }),
    new Paragraph({
      spacing: { after: 80 },
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({
          text: "Enterprise-Grade Autonomous Marketing System",
          font: CALIBRI,
          size: 22,
          color: C.metaColor,
        }),
      ],
    }),
  ];

  return {
    properties: {
      page: {
        margin: { top: 0, bottom: 0, left: 1440, right: 1440 },
        size: { width: 11906, height: 16838 },
      },
      type: SectionType.CONTINUOUS,
    },
    headers: {
      default: new Header({ children: [] }),
    },
    footers: {
      default: new Footer({ children: [] }),
    },
    children: coverChildren,
  };
}

// ── Build TOC Section ──
function buildTocSection() {
  return {
    properties: {
      page: {
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      },
      type: SectionType.NEXT_PAGE,
    },
    headers: {
      default: new Header({ children: [] }),
    },
    footers: {
      default: new Footer({ children: [] }),
    },
    children: [
      new Paragraph({
        spacing: { after: 300 },
        children: [
          new TextRun({
            text: "Table of Contents",
            font: CALIBRI,
            size: H1_SIZE,
            bold: true,
            color: C.accentLine,
          }),
        ],
      }),
      new TableOfContents("TOC", {
        hyperlink: true,
        headingStyleRange: "1-3",
      }),
    ],
  };
}

// ── Build Body Section ──
function buildBodySection() {
  const children = [];

  // ═══════════════════════════════════════════
  // SECTION 1: Executive Summary
  // ═══════════════════════════════════════════
  children.push(heading1("1. Executive Summary"));
  children.push(accentBar());
  children.push(
    bodyPara(
      "The Aria Marketing Hub v2.0 represents a complete architectural redesign that moves from a monolithic marketing system to a multi-agent framework. This transformation is driven by a critical insight: treating all seven products with a single generic pipeline produces poor results. The previous system sent 476+ emails with zero revenue generated, exposing fundamental flaws in the one-size-fits-all approach to lead generation and outreach."
    )
  );
  children.push(
    bodyPara(
      "The new architecture gives each product its own dedicated Lead Agent with a full workflow spanning lead discovery, personalized email outreach, and closing. Rather than sharing a single generic pipeline, each agent operates independently with product-specific Ideal Customer Profiles (ICPs), search keywords, email templates, and scoring thresholds. This specialization ensures that every lead interaction is contextually relevant and highly targeted."
    )
  );
  children.push(
    bodyPara(
      "A shared NVIDIA Brain layer provides hybrid search intelligence combining keyword search, vector search, and Reciprocal Rank Fusion (RRF) that all agents leverage. This central intelligence layer eliminates redundant search infrastructure while enabling each agent to benefit from state-of-the-art embedding and reasoning models. The brain handles the heavy lifting of lead discovery, company research, fusion scoring, and personalized email generation."
    )
  );
  children.push(
    bodyPara(
      "A new Caller Agent powered by Microsoft VibeVoice handles phone outreach for leads with verified phone numbers, adding a critical multi-channel dimension to the system. The Revenue Commander meta-agent orchestrates everything, running a five-phase cognitive loop (Observe, Diagnose, Decide, Execute, Report) to optimize resource allocation across all agents. Additionally, the Social Media Brain layer integrates 17 Claude-based skills from the open-source social-media-skills framework to enhance content intelligence across all products."
    )
  );

  // ═══════════════════════════════════════════
  // SECTION 2: Architecture Overview
  // ═══════════════════════════════════════════
  children.push(heading1("2. Architecture Overview"));
  children.push(accentBar());
  children.push(
    bodyPara(
      "The Aria Marketing Hub v2.0 is built on a five-layer architecture that separates concerns while enabling shared intelligence and centralized orchestration. Each layer serves a distinct purpose, and together they form a cohesive system capable of autonomous, enterprise-grade marketing operations."
    )
  );

  children.push(heading2("2.1 Layer 1: NVIDIA Brain \u2014 Shared Intelligence"));
  children.push(
    bodyPara(
      "At the foundation sits the NVIDIA Brain layer, a shared intelligence infrastructure powered by the NVIDIA NIM API. This layer provides two core capabilities: NV-Embed v1 for generating high-quality embeddings and Meta Llama 3.1 405B Instruct for advanced LLM reasoning. All seven Lead Agents and the Caller Agent depend on this layer for lead discovery, company research, fusion scoring, and email generation. By centralizing AI capabilities, the system avoids redundant API calls and maintains consistent intelligence quality across all products."
    )
  );

  children.push(heading2("2.2 Layer 2: Product Lead Agents"));
  children.push(
    bodyPara(
      "The second layer comprises seven specialized Lead Agents, each owning the full marketing pipeline for their respective product. Every agent follows the same five-step workflow (ICP definition, query expansion, lead discovery, scoring, and outreach) but with product-specific configurations including unique ICPs, search keywords, value propositions, email templates, and scoring thresholds. This separation ensures maximum relevance and personalization in every customer interaction."
    )
  );

  children.push(heading2("2.3 Layer 3: Caller Agent"));
  children.push(
    bodyPara(
      "A single shared Caller Agent handles voice outreach for all products. Powered by Microsoft VibeVoice (free, open-source), this agent receives leads with verified phone numbers from any Product Lead Agent, generates personalized voice scripts tailored to the specific product, synthesizes natural-sounding speech, makes outbound calls, and reports outcomes back to the Revenue Commander."
    )
  );

  children.push(heading2("2.4 Layer 4: Revenue Commander"));
  children.push(
    bodyPara(
      "The Revenue Commander is the strategic meta-agent that oversees the entire system. Running a five-phase cognitive loop (Observe, Diagnose, Decide, Execute, Report), it monitors pipeline health, identifies problems across all agents, makes strategic decisions about resource allocation, and generates comprehensive reports. It determines which products need new leads, which leads need escalation, and where to focus system resources for maximum revenue impact."
    )
  );

  children.push(heading2("2.5 Layer 5: Social Media Brain"));
  children.push(
    bodyPara(
      "The topmost layer enhances content intelligence by integrating 17 Claude-based skills from the social-media-skills open-source framework. These skills enable each Lead Agent to create social proof content, LinkedIn posts, and supporting materials that amplify email and phone outreach effectiveness."
    )
  );

  children.push(heading2("2.6 Key Design Principles"));
  children.push(
    bodyParaRuns([
      { text: "Separation of Concerns: ", bold: true },
      { text: "Each product agent owns its pipeline independently, preventing cross-product interference." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Shared Intelligence: ", bold: true },
      { text: "The NVIDIA Brain provides centralized AI capabilities, reducing cost and ensuring consistency." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Independent Pipelines: ", bold: true },
      { text: "Agents operate autonomously, so a failure in one product pipeline does not affect others." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Centralized Oversight: ", bold: true },
      { text: "The Revenue Commander maintains a holistic view and orchestrates resources across all agents." },
    ])
  );

  // ═══════════════════════════════════════════
  // SECTION 3: NVIDIA Brain
  // ═══════════════════════════════════════════
  children.push(heading1("3. NVIDIA Brain \u2014 Shared Intelligence Layer"));
  children.push(accentBar());
  children.push(
    bodyPara(
      "The NVIDIA Brain is the shared intelligence foundation that powers all agents in the system. Every Lead Agent, the Caller Agent, and the Revenue Commander depend on this layer for core AI capabilities. The brain is implemented as a modular pipeline that transforms raw search queries into scored, enriched leads ready for personalized outreach."
    )
  );

  children.push(heading2("3.1 Embeddings: NV-Embed v1"));
  children.push(
    bodyPara(
      "NVIDIA NV-Embed v1 model accessed via the NIM API generates high-dimensional vector representations of text. These embeddings power the vector search component of the hybrid search system, enabling semantic matching between lead descriptions and product ICPs. The model produces 4096-dimensional vectors that capture nuanced meaning, allowing the system to find leads that match intent rather than just keywords."
    )
  );

  children.push(heading2("3.2 LLM Reasoning: Llama 3.1 405B Instruct"));
  children.push(
    bodyPara(
      "Meta Llama 3.1 405B Instruct serves as the reasoning engine for complex tasks including company intelligence extraction, email generation, ICP formulation, and strategic decision-making support for the Revenue Commander. This model is accessed through the NVIDIA NIM API, providing enterprise-grade inference with consistent quality and low latency."
    )
  );

  children.push(heading2("3.3 Hybrid Search Pipeline"));
  children.push(
    bodyParaRuns([
      { text: "The hybrid search system combines two complementary approaches:" },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Keyword Search: ", bold: true },
      { text: "Traditional text matching that captures explicit product names, job titles, and industry terms." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Vector Search: ", bold: true },
      { text: "Semantic similarity matching using NV-Embed v1 embeddings that captures intent and context." },
    ])
  );
  children.push(
    bodyPara(
      "Both searches run in parallel and their results are merged using Reciprocal Rank Fusion (RRF), a technique that assigns higher rankings to results appearing in both result sets. The merged results undergo cosine similarity re-ranking against the product ICP, followed by deduplication to ensure no duplicate companies reach the scoring stage."
    )
  );

  children.push(heading2("3.4 Query Expansion"));
  children.push(
    bodyPara(
      "A single product or ICP query is automatically expanded into four distinct search angles: pain point (problems the target audience faces), buyer intent (signals that indicate readiness to purchase), competitive (alternative solutions the audience may be evaluating), and local (geographic or market-specific context). This expansion dramatically increases the diversity and quality of discovered leads."
    )
  );

  children.push(heading2("3.5 Company Intelligence"));
  children.push(
    bodyPara(
      "For each discovered lead, the brain conducts deep company research extracting: industry classification, technology stack, identified pain points, buying signals (funding rounds, hiring patterns, product launches), and growth signals (revenue trajectory, market expansion). This intelligence feeds directly into the fusion scoring model and is used to personalize outreach emails."
    )
  );

  children.push(heading2("3.6 Fusion Scoring"));
  children.push(
    bodyPara(
      "The fusion scoring model evaluates each lead across five weighted signals: ICP Fit (how closely the company matches the ideal customer profile), Buying Intent (strength of purchase readiness signals), Recency (freshness of the lead data), Company Size (alignment with target company scale), and Engagement Signals (website visits, content downloads, social activity). Each signal contributes to a composite score that produces a verdict: Hot, Warm, Lukewarm, or Cold."
    )
  );

  children.push(heading2("3.7 Email Generation"));
  children.push(
    bodyPara(
      "Hyper-personalized cold emails are generated with strict constraints: maximum three sentences, company-specific context drawn from the intelligence module, a clear value proposition aligned with the product angle, and a soft call-to-action. Each email references specific details about the prospect's company to demonstrate genuine research and increase response rates."
    )
  );

  // ═══════════════════════════════════════════
  // SECTION 4: Product Lead Agents
  // ═══════════════════════════════════════════
  children.push(heading1("4. Product Lead Agents \u2014 Detailed Specifications"));
  children.push(accentBar());
  children.push(
    bodyPara(
      "Each of the seven Product Lead Agents follows the same five-step workflow but is configured with product-specific ICPs, search queries, email templates, and scoring thresholds. The table below provides a high-level overview, followed by detailed specifications for each agent."
    )
  );

  // Agent overview table
  const agentData = [
    ["1", "AriaAgent", "Marketing agencies, SaaS founders, growth hackers", "AI marketing automation, automated outreach tools", "Replace 5 marketing tools with 1 AI agent that works 24/7", "Consolidation and always-on capability"],
    ["2", "Sales Intelligence MCP", "B2B SaaS sales teams, RevOps leaders", "Sales intelligence tools, CRM automation, B2B prospecting", "Turn Claude/ChatGPT into your sales research co-pilot", "AI-powered sales research"],
    ["3", "SaaS Audit Scanner", "CTOs, VP Engineering, security engineers", "SaaS security audit, application security scanner", "Find security gaps before hackers do", "Proactive security automation"],
    ["4", "ShipProof (NEW)", "Ecommerce sellers on Amazon, Flipkart, Shopify, eBay, etc.", "Ecommerce fulfillment proof, shipping dispute protection", "Reduce disputes by 90% with cryptographic video proof", "Dispute elimination and trust"],
    ["5", "SparkBill", "Freelancers, small business owners, agencies", "Invoice automation software, billing tool small business", "Generate professional invoices in seconds, get paid faster", "Speed and payment acceleration"],
    ["6", "Naive AI Voice Agent", "Customer support teams, call centers, SMBs", "AI voice agent, customer support automation", "AI phone agent that sounds human \u2014 handles calls 24/7", "Human-like voice automation"],
    ["7", "Naive Landing Page", "Startups, digital marketers, agencies", "AI landing page builder, instant website generator", "Launch conversion-optimized landing pages in 60 seconds", "Speed and conversion optimization"],
  ];

  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell("#", 5),
        headerCell("Product Name", 14),
        headerCell("Target ICP", 21),
        headerCell("Search Keywords", 25),
        headerCell("Key Value Proposition", 20),
        headerCell("Email Angle", 15),
      ],
    }),
  ];

  agentData.forEach((row, idx) => {
    const shade = idx % 2 === 0 ? C.primary : C.surface;
    tableRows.push(
      new TableRow({
        children: [
          dataCell(row[0], 5, { shade, bold: true }),
          dataCell(row[1], 14, { shade, bold: true }),
          dataCell(row[2], 21, { shade }),
          dataCell(row[3], 25, { shade }),
          dataCell(row[4], 20, { shade }),
          dataCell(row[5], 15, { shade }),
        ],
      })
    );
  });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    })
  );

  // Agent 1
  children.push(heading2("4.1 Agent 1: AriaAgent"));
  children.push(
    bodyParaRuns([
      { text: "Target ICP: ", bold: true },
      { text: "Marketing agencies, SaaS founders, growth hackers" },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Search Keywords: ", bold: true },
      { text: '"AI marketing automation", "marketing AI platform", "automated outreach tools"' },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Value Proposition: ", bold: true },
      { text: "Replace 5 marketing tools with 1 AI agent that works 24/7. AriaAgent handles the entire marketing workflow from lead discovery to personalized outreach, eliminating the need for separate tools for email, social media, analytics, CRM, and content creation." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Scoring Emphasis: ", bold: true },
      { text: "Tech adoption signals (usage of marketing automation tools, AI-powered platforms), marketing tool spend (indicates budget and willingness to invest), and team size (agencies with 5+ marketers see the highest consolidation benefit)." },
    ])
  );

  // Agent 2
  children.push(heading2("4.2 Agent 2: Sales Intelligence MCP"));
  children.push(
    bodyParaRuns([
      { text: "Target ICP: ", bold: true },
      { text: "B2B SaaS sales teams, Revenue Operations leaders, sales enablement managers" },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Search Keywords: ", bold: true },
      { text: '"sales intelligence tools", "CRM automation", "B2B prospecting"' },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Value Proposition: ", bold: true },
      { text: "Turn Claude/ChatGPT into your sales research co-pilot. The MCP server provides structured access to company data, contact information, and buying signals directly within AI chat interfaces." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Scoring Emphasis: ", bold: true },
      { text: "Team size greater than 10 sales reps (larger teams benefit more from automation), current CRM usage (Salesforce, HubSpot, Pipedrive users are primed for enhancement), and sales tech stack complexity." },
    ])
  );

  // Agent 3
  children.push(heading2("4.3 Agent 3: SaaS Audit Scanner"));
  children.push(
    bodyParaRuns([
      { text: "Target ICP: ", bold: true },
      { text: "CTOs, VP Engineering, security engineers, SaaS founders" },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Search Keywords: ", bold: true },
      { text: '"SaaS security audit", "application security scanner", "penetration testing"' },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Value Proposition: ", bold: true },
      { text: "Find security gaps before hackers do \u2014 automated continuous scanning. The scanner identifies vulnerabilities in SaaS applications, APIs, and infrastructure on an ongoing basis, providing actionable remediation guidance." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Scoring Emphasis: ", bold: true },
      { text: "Security posture indicators (SOC 2 compliance, bug bounty programs, security team hiring), compliance requirements (HIPAA, GDPR, PCI-DSS), and recent security incidents or funding rounds that suggest growth." },
    ])
  );

  // Agent 4
  children.push(heading2("4.4 Agent 4: ShipProof (NEW \u2014 Replaces DateWise)"));
  children.push(
    bodyParaRuns([
      { text: "Status: ", bold: true, color: C.accentLine },
      { text: "HIGHEST REVENUE POTENTIAL PRODUCT \u2014 Enterprise ecommerce scale", bold: true, color: C.accentLine },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Target ICP: ", bold: true },
      { text: "Ecommerce sellers on Amazon, Flipkart, eBay, Meesho, Myntra, Ajio, Shopify, Etsy, and global marketplaces. This includes individual sellers, small-to-medium businesses, and enterprise ecommerce operations." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Search Keywords: ", bold: true },
      { text: '"ecommerce fulfillment proof", "order verification video", "shipping dispute protection", "packing video proof", "delivery confirmation video"' },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Value Proposition: ", bold: true },
      { text: "Reduce disputes by 90% with cryptographic video proof of every shipment. ShipProof captures verifiable video evidence during the packing process, creating an immutable record that protects sellers from fraudulent buyer claims." },
    ])
  );
  children.push(heading2("4.4.1 ShipProof Key Features"));
  const featureList = [
    "SHA-256 cryptographic hashing ensures video integrity and tamper-proof verification",
    "White-label solution allows marketplaces and logistics companies to brand the proof system",
    "Scale capacity of 100,000+ videos per day meets enterprise-level demand",
    "Verification certificates provide shareable proof for each shipment",
    "Storefront trust badges display proof-of-shipment credibility to buyers",
  ];
  featureList.forEach((f) => {
    children.push(
      bodyParaRuns([{ text: `\u2022  ${f}` }])
    );
  });
  children.push(heading2("4.4.2 ShipProof Pricing"));
  children.push(
    bodyParaRuns([
      { text: "Free Tier: ", bold: true },
      { text: "5 videos per month for individual sellers testing the system." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Pro Tier ($9.99/mo): ", bold: true },
      { text: "50 videos per month for growing sellers with moderate dispute volumes." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Business Tier ($29.99/mo): ", bold: true },
      { text: "500+ videos per month for high-volume sellers and small businesses." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Scoring Emphasis: ", bold: true },
      { text: "Order volume (sellers shipping 100+ orders/month benefit most), dispute rate (sellers with dispute rates above 2% have urgent need), platform presence (multi-platform sellers have higher dispute exposure), and cross-border selling (international shipments have 3x higher dispute rates)." },
    ])
  );

  // Agent 5
  children.push(heading2("4.5 Agent 5: SparkBill"));
  children.push(
    bodyParaRuns([
      { text: "Target ICP: ", bold: true },
      { text: "Freelancers, small business owners, agencies, consultants" },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Search Keywords: ", bold: true },
      { text: '"invoice automation software", "billing tool small business", "automatic invoicing"' },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Value Proposition: ", bold: true },
      { text: "Generate professional invoices in seconds and get paid faster. SparkBill automates the entire billing workflow from invoice creation through payment tracking, reducing the average payment collection time by 40%." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Scoring Emphasis: ", bold: true },
      { text: "Service-based business indicators (consulting, agency, freelance), manual billing processes (current use of spreadsheets or manual invoice creation), and payment collection challenges (late payments mentioned in reviews or job postings)." },
    ])
  );

  // Agent 6
  children.push(heading2("4.6 Agent 6: Naive AI Voice Agent"));
  children.push(
    bodyParaRuns([
      { text: "Target ICP: ", bold: true },
      { text: "Customer support teams, call centers, SMBs needing phone automation" },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Search Keywords: ", bold: true },
      { text: '"AI voice agent", "customer support automation", "AI phone answering"' },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Value Proposition: ", bold: true },
      { text: "AI phone agent that sounds human \u2014 handles calls 24/7. The Naive AI Voice Agent provides natural-sounding voice interactions that can handle customer inquiries, schedule appointments, route calls, and provide basic support without human intervention." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Scoring Emphasis: ", bold: true },
      { text: "Support call volume (businesses handling 50+ calls/day see immediate ROI), staffing costs (teams spending over $5,000/month on phone support), and multi-language needs (businesses serving international customers)." },
    ])
  );

  // Agent 7
  children.push(heading2("4.7 Agent 7: Naive Landing Page"));
  children.push(
    bodyParaRuns([
      { text: "Target ICP: ", bold: true },
      { text: "Startups, digital marketers, agencies, indie hackers" },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Search Keywords: ", bold: true },
      { text: '"AI landing page builder", "instant website generator", "landing page creator"' },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Value Proposition: ", bold: true },
      { text: "Launch conversion-optimized landing pages in 60 seconds with AI. The platform generates complete, responsive landing pages from a simple text description, including copy, layout, forms, and analytics integration." },
    ])
  );
  children.push(
    bodyParaRuns([
      { text: "Scoring Emphasis: ", bold: true },
      { text: "Marketing budget (teams with dedicated marketing spend are ready to invest), current website quality (outdated or non-optimized sites indicate need), and growth stage (early-stage startups and rapidly scaling companies have the highest urgency)." },
    ])
  );

  // ═══════════════════════════════════════════
  // SECTION 5: Caller Agent
  // ═══════════════════════════════════════════
  children.push(heading1("5. Caller Agent \u2014 Voice Outreach Layer"));
  children.push(accentBar());
  children.push(
    bodyPara(
      "The Caller Agent adds a critical multi-channel dimension to the Aria Marketing Hub by enabling voice outreach for leads with verified phone numbers. This agent is powered by Microsoft VibeVoice, a completely free and open-source voice synthesis engine available at github.com/microsoft/VibeVoice."
    )
  );

  children.push(heading2("5.1 Microsoft VibeVoice Capabilities"));
  const voiceCaps = [
    "Voice Cloning: Clone any voice from just 10 seconds of audio sample, enabling personalized caller voices",
    "Long-Form Generation: Generate up to 90 minutes of continuous audio from a single text input",
    "Multi-Language Support: Over 50 languages supported, enabling global outreach without language barriers",
    "Real-Time Streaming: Audio can be streamed in real-time for live conversation scenarios",
    "Local Execution: Runs entirely locally with no API costs, ensuring data privacy and zero per-call charges",
  ];
  voiceCaps.forEach((v) => {
    children.push(bodyParaRuns([{ text: `\u2022  ${v}` }]));
  });

  children.push(heading2("5.2 Caller Agent Workflow"));
  children.push(
    bodyPara(
      "The Caller Agent operates through a five-stage workflow. First, it receives a lead with a verified phone number from any Product Lead Agent. Second, it generates a personalized voice script tailored to the specific product and the lead's company context. Third, it synthesizes the script into natural-sounding speech using VibeVoice. Fourth, it makes the outbound call to the lead. Fifth, it reports the call outcome back to the Revenue Commander for pipeline tracking and strategic decision-making."
    )
  );

  children.push(heading2("5.3 Product-Specific Voice Scripts"));
  children.push(
    bodyPara(
      "Voice scripts are dynamically generated based on the source product agent. For example, ShipProof sellers hear about dispute reduction and proof-of-delivery benefits, while SaaS Audit Scanner prospects hear about automated vulnerability detection and compliance. This product-specific scripting ensures every call delivers relevant, compelling messaging."
    )
  );

  children.push(heading2("5.4 Integration Architecture"));
  children.push(
    bodyPara(
      "When any Lead Agent discovers a lead with a verified phone number during the NVIDIA Brain research phase, it automatically passes the lead to the Caller Agent queue. Phone numbers are sourced from two channels: the NVIDIA Brain's Company Intelligence module (which extracts phone numbers during deep company research) and Explee data enrichment (which provides verified contact information for discovered companies)."
    )
  );

  children.push(heading2("5.5 Call Outcome Tracking"));
  children.push(
    bodyPara(
      "The Caller Agent maintains detailed call outcome tracking with the following classifications: Connected (live conversation with the prospect), Voicemail Left (message delivered), Interested (prospect expressed interest in learning more), Callback Requested (prospect asked for a follow-up call at a specific time), and Not Interested (prospect declined). All outcomes are reported to the Revenue Commander to inform subsequent cycle decisions."
    )
  );

  // ═══════════════════════════════════════════
  // SECTION 6: Revenue Commander
  // ═══════════════════════════════════════════
  children.push(heading1("6. Revenue Commander \u2014 Orchestration Meta-Agent"));
  children.push(accentBar());
  children.push(
    bodyPara(
      "The Revenue Commander is the strategic brain of the Aria Marketing Hub, overseeing all seven Lead Agents and the Caller Agent. It runs a five-phase cognitive loop on a daily cycle (triggered by Vercel Hobby cron) to monitor system health, identify problems, make strategic decisions, execute actions, and generate reports."
    )
  );

  children.push(heading2("6.1 Phase 1: Observe"));
  children.push(
    bodyPara(
      "The Commander captures a complete pipeline snapshot including: total lead counts by status (new, contacted, replied, closed), funnel stage distribution across all products, email event metrics (opens, clicks, bounces, replies), per-product performance metrics (open rate, reply rate, revenue generated), hot leads that have clicked or replied within the last 24 hours, and stuck leads that have been contacted but show zero engagement after 3+ days."
    )
  );

  children.push(heading2("6.2 Phase 2: Diagnose"));
  children.push(
    bodyPara(
      "Using the observed data, the Commander identifies specific problems with severity classifications. Critical issues include: zero emails sent for any product, zero replies across the entire system, bounce rate exceeding 20%, completely empty pipeline, and zero email opens. Warning issues include: low open rate below 15%, high proportion of stuck leads, and per-product gaps where one product significantly underperforms others."
    )
  );

  children.push(heading2("6.3 Phase 3: Decide"));
  children.push(
    bodyPara(
      "The decision engine combines fast-path rules for critical issues with LLM-powered strategic reasoning. The defined actions include:"
    )
  );
  const actions = [
    "RUN_MONEY_PRINTER: Trigger new lead discovery for priority products that need pipeline replenishment",
    "PURGE_AND_REDISCOVER: Remove low-quality leads (Cold verdict, bounced emails) and discover fresh replacements",
    "ESCALATE_HOT_LEADS: Send targeted closing emails to leads that have shown engagement (clicked or replied)",
    "PURGE_STUCK_LEADS: Mark unresponsive leads as Lost after multiple contact attempts with zero engagement",
    "FOCUS_ON_WINNER: Shift discovery resources to the best-performing product to maximize revenue potential",
  ];
  actions.forEach((a) => {
    children.push(bodyParaRuns([{ text: `\u2022  ${a}` }]));
  });

  children.push(heading2("6.4 Phase 4: Execute"));
  children.push(
    bodyPara(
      "Decisions are carried out by invoking the appropriate pipeline through the NVIDIA Brain. For example, a RUN_MONEY_PRINTER decision for ShipProof triggers the Smart Brain pipeline with ShipProof's ICP, search keywords, and email templates. The execution phase respects Vercel Hobby's 10-second function limit by using a queued execution model."
    )
  );

  children.push(heading2("6.5 Phase 5: Report"));
  children.push(
    bodyPara(
      "After execution, the Commander generates a comprehensive CommanderReport containing: a prioritized list of alerts with severity levels, an AI-generated summary of system health and actions taken, specific next steps for the next cycle, and per-product performance comparisons. This report enables human oversight and historical trend analysis."
    )
  );

  // ═══════════════════════════════════════════
  // SECTION 7: Social Media Brain
  // ═══════════════════════════════════════════
  children.push(heading1("7. Social Media Brain Enhancement"));
  children.push(accentBar());
  children.push(
    bodyPara(
      "The Social Media Brain layer integrates charlie947's open-source social-media-skills framework (MIT License, github.com/charlie947/social-media-skills) to enhance content intelligence across all products. This framework provides 17 specialized skills for AI-powered content generation and social media management."
    )
  );

  children.push(heading2("7.1 Skill Categories"));

  // Skills table
  const skillsData = [
    ["Voice & Profile Setup", "Defines brand personality, tone, and visual identity for each product"],
    ["Hook & Post Generation", "Creates attention-grabbing social content optimized for platform algorithms"],
    ["Carousel Maker", "Designs multi-slide carousel posts for Instagram and LinkedIn"],
    ["Reels Scripter", "Generates short-form video scripts for Instagram Reels and TikTok"],
    ["Niche Research", "Identifies trending topics and conversations per product vertical"],
    ["Content Planning", "Creates structured publishing calendars with optimal posting schedules"],
    ["Analytics Insights", "Tracks content performance and identifies what resonates with target audiences"],
  ];

  const skillsRows = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell("Skill Category", 30),
        headerCell("Description", 70),
      ],
    }),
  ];

  skillsData.forEach((row, idx) => {
    const shade = idx % 2 === 0 ? C.primary : C.surface;
    skillsRows.push(
      new TableRow({
        children: [
          dataCell(row[0], 30, { shade, bold: true }),
          dataCell(row[1], 70, { shade }),
        ],
      })
    );
  });

  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: skillsRows }));

  children.push(heading2("7.2 Integration with Lead Agents"));
  children.push(
    bodyPara(
      "Each Lead Agent can leverage these social media skills to create supporting content that enhances outreach effectiveness. For example, before sending a cold email, an agent can generate a relevant LinkedIn post that establishes social proof. The Content Planning skill ensures consistent publishing schedules, while Analytics Insights helps agents refine their messaging based on what content drives the most engagement in each product vertical."
    )
  );

  // ═══════════════════════════════════════════
  // SECTION 8: Data Flow
  // ═══════════════════════════════════════════
  children.push(heading1("8. Data Flow & Communication Patterns"));
  children.push(accentBar());
  children.push(
    bodyPara(
      "The complete data flow through the Aria Marketing Hub follows a structured, cyclic pattern driven by the Revenue Commander. Below is the end-to-end sequence that occurs on each daily cycle."
    )
  );

  children.push(heading2("8.1 Daily Cycle Sequence"));
  const flowSteps = [
    "The Revenue Commander triggers a cycle via Vercel Hobby cron (scheduled once daily).",
    "The Commander runs the Observe phase, capturing a full pipeline snapshot from Supabase including lead counts, email events, and per-product metrics.",
    "The Commander runs the Diagnose phase, identifying problems such as empty pipelines, low open rates, or stuck leads.",
    "The Commander runs the Decide phase, determining which actions to take. A typical decision is RUN_MONEY_PRINTER for priority products with empty or depleted pipelines.",
    "The NVIDIA Brain's Smart Brain pipeline runs for selected products: ICP Generation, Query Expansion (4 search angles), Lead Discovery (hybrid search), Company Research (deep intelligence extraction), Deduplication, Save to Supabase database, and Send Emails to the top 5 highest-scoring leads.",
    "Product Lead Agents pick up their respective leads and begin running independent follow-up sequences based on email engagement signals.",
    "Leads with verified phone numbers are automatically queued for the Caller Agent, which generates product-specific voice scripts and initiates outbound calls.",
    "Resend webhooks (HMAC verified) process incoming email events including opens, clicks, bounces, and replies, updating lead status in the Supabase database.",
    "The Revenue Commander reads updated metrics on the next cycle and decides the appropriate actions based on the latest pipeline state.",
    "The Caller Agent reports all call outcomes (connected, voicemail, interested, callback, not interested) back to the Revenue Commander for tracking and decision-making.",
  ];
  flowSteps.forEach((step, i) => {
    children.push(
      bodyParaRuns([
        { text: `Step ${i + 1}: `, bold: true },
        { text: step },
      ])
    );
  });

  children.push(heading2("8.2 Event-Driven Updates"));
  children.push(
    bodyPara(
      "In addition to the daily cycle, the system processes real-time events through the Resend webhook. When a prospect opens an email, clicks a link, or replies, the webhook immediately updates the lead record in Supabase. These events are available for the Revenue Commander's next Observe phase and can trigger immediate follow-up actions from the corresponding Product Lead Agent."
    )
  );

  // ═══════════════════════════════════════════
  // SECTION 9: Implementation Plan
  // ═══════════════════════════════════════════
  children.push(heading1("9. Implementation Plan"));
  children.push(accentBar());
  children.push(
    bodyPara(
      "The migration from the current monolithic system to the multi-agent architecture will be executed in six phases, each building upon the previous one to minimize risk and ensure continuous system availability."
    )
  );

  // Implementation table
  const implData = [
    ["Phase 1", "Product Data Update", "Replace DateWise with ShipProof in the product configuration. Update all ICPs, search keywords, email templates, and scoring thresholds for the new ShipProof agent. Update the remaining six agents with refined ICPs based on market research."],
    ["Phase 2", "Smart Brain Refactor", "Refactor the existing Smart Brain pipeline from a single-product model to a per-product pipeline. Each product gets its own pipeline configuration while sharing the underlying NVIDIA Brain infrastructure."],
    ["Phase 3", "Lead Agent Framework", "Build the Lead Agent framework with a shared base class that encapsulates the common five-step workflow. Implement per-product configuration objects that customize each agent's behavior."],
    ["Phase 4", "Caller Agent Integration", "Integrate Microsoft VibeVoice for the Caller Agent. Implement voice script generation, call execution, and outcome tracking. Connect the Caller Agent to the lead queue from all Product Lead Agents."],
    ["Phase 5", "Revenue Commander Enhancement", "Enhance the Revenue Commander to support multi-agent monitoring. Implement the full five-phase cognitive loop with per-product visibility and cross-agent resource allocation."],
    ["Phase 6", "Deploy & Test", "Deploy the complete system with ShipProof as the priority product. Run a two-week validation period measuring pipeline health, email engagement, and call outcomes before scaling to all seven products."],
  ];

  const implRows = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell("Phase", 12),
        headerCell("Milestone", 25),
        headerCell("Description", 63),
      ],
    }),
  ];

  implData.forEach((row, idx) => {
    const shade = idx % 2 === 0 ? C.primary : C.surface;
    implRows.push(
      new TableRow({
        children: [
          dataCell(row[0], 12, { shade, bold: true }),
          dataCell(row[1], 25, { shade, bold: true }),
          dataCell(row[2], 63, { shade }),
        ],
      })
    );
  });

  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: implRows }));

  // ═══════════════════════════════════════════
  // SECTION 10: Technical Stack
  // ═══════════════════════════════════════════
  children.push(heading1("10. Technical Stack & Dependencies"));
  children.push(accentBar());
  children.push(
    bodyPara(
      "The Aria Marketing Hub v2.0 is built on a modern, cost-optimized technology stack designed for reliability within the constraints of Vercel Hobby tier hosting."
    )
  );

  // Stack table
  const stackData = [
    ["Runtime", "Next.js 14 on Vercel Hobby (10-second function execution limit)"],
    ["Database", "Supabase (PostgreSQL) for all lead, product, and pipeline data storage"],
    ["Email", "Resend with DKIM/SPF verification and full domain authentication"],
    ["AI / LLM", "NVIDIA NIM API (NV-Embed v1 for embeddings, Llama 3.1 405B for reasoning); Claude as fallback"],
    ["Voice", "Microsoft VibeVoice (local execution, 100% free, open-source)"],
    ["Lead Data", "Explee API for company contact enrichment; NVIDIA Brain web search for lead discovery"],
    ["Webhooks", "Resend webhook endpoint with HMAC signature verification for real-time email event processing"],
    ["Deployment", "Vercel Hobby with cron-triggered daily cycles; queued execution for long-running pipelines"],
  ];

  const stackRows = [
    new TableRow({
      tableHeader: true,
      children: [
        headerCell("Component", 25),
        headerCell("Technology", 75),
      ],
    }),
  ];

  stackData.forEach((row, idx) => {
    const shade = idx % 2 === 0 ? C.primary : C.surface;
    stackRows.push(
      new TableRow({
        children: [
          dataCell(row[0], 25, { shade, bold: true }),
          dataCell(row[1], 75, { shade }),
        ],
      })
    );
  });

  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: stackRows }));

  children.push(
    bodyPara(
      "This stack prioritizes free-tier and open-source tools wherever possible, ensuring that the system can operate at scale without prohibitive infrastructure costs. The NVIDIA NIM API provides enterprise-grade AI capabilities, while Vercel Hobby handles deployment with automatic scaling and zero-downtime deployments."
    )
  );

  // ── Assemble Body Section ──
  return {
    properties: {
      page: {
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      },
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({
                text: "Aria Marketing Hub v2.0 \u2014 Architecture Design Document",
                font: CALIBRI,
                size: 16,
                color: C.footerColor,
                italics: true,
              }),
            ],
          }),
        ],
      }),
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "Page ",
                font: CALIBRI,
                size: 18,
                color: C.footerColor,
              }),
              new TextRun({
                children: [PageNumber.CURRENT],
                font: CALIBRI,
                size: 18,
                color: C.footerColor,
              }),
            ],
          }),
        ],
      }),
    },
    children,
  };
}

// ── Main ──
async function main() {
  const doc = new Document({
    creator: "Aria Marketing Hub",
    title: "Aria Marketing Hub v2.0 - Multi-Agent Architecture Design Document",
    description: "Enterprise-Grade Autonomous Marketing System",
    styles: {
      default: {
        document: {
          run: {
            font: CALIBRI,
            size: BODY_SIZE,
          },
        },
        heading1: {
          run: {
            font: CALIBRI,
            size: H1_SIZE,
            bold: true,
            color: C.accentLine,
          },
        },
        heading2: {
          run: {
            font: CALIBRI,
            size: H2_SIZE,
            bold: true,
            color: C.accentLine,
          },
        },
        heading3: {
          run: {
            font: CALIBRI,
            size: 26,
            bold: true,
            color: "444444",
          },
        },
      },
    },
    sections: [
      buildCoverSection(),
      buildTocSection(),
      buildBodySection(),
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync("/home/z/my-project/download/Multi-Agent-Architecture-Design.docx", buffer);
  console.log("Document generated successfully!");
}

main().catch((err) => {
  console.error("Error generating document:", err);
  process.exit(1);
});
