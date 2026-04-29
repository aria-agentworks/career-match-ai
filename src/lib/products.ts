// AriaAgent product catalog — all products this marketing hub can promote

export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  url: string;
  targetAudience: string;
  keyFeatures: string[];
  hashtags: string[];
  pricing: {
    free?: boolean;
    amount: number;      // INR amount (paise handled by razorpay lib)
    currency: string;
    label: string;       // e.g. "$29/mo", "₹499/mo", "Free"
    popular?: boolean;   // Highlight as most popular plan
  };
}

export const PRODUCTS: Record<string, Product> = {
  AriaAgent: {
    id: "ariaagent",
    name: "AriaAgent",
    tagline: "11 Free AI Business Tools — No Signup Required",
    description: "A comprehensive suite of AI-powered business tools including content generators, SEO analyzers, email composers, social media planners, and more. All 11 tools are completely free with no signup required. Visit ariaagent.agency to use them instantly.",
    url: "https://ariaagent.agency",
    targetAudience: "Founders, marketers, content creators, small business owners, indie hackers",
    keyFeatures: [
      "11 free AI tools",
      "No signup required",
      "Content generation",
      "SEO analysis",
      "Email composition",
      "Social media planning",
      "Business name generator",
      "Ad copy writer",
      "Product description generator",
      "Blog post outline creator",
      "Landing page copy generator",
      "Competitor analysis",
    ],
    hashtags: ["#AI", "#FreeAI", "#AITools", "#NoCode", "#IndieHackers", "#SaaS", "#Marketing", "#Productivity", "#AriaAgent"],
    pricing: { free: true, amount: 0, currency: "INR", label: "Free" },
  },
  SalesIntelligenceMCP: {
    id: "sales-intelligence-mcp",
    name: "Sales Intelligence MCP",
    tagline: "Scored 96/100 on Smithery — Your AI-Powered Sales Research Assistant",
    description: "A Model Context Protocol server that gives AI assistants deep sales intelligence capabilities. It provides company research, contact finding, lead scoring, and competitive analysis — all accessible through any MCP-compatible AI tool like Claude Desktop. Scored 96/100 on Smithery.",
    url: "https://mcp.ariaagent.agency",
    targetAudience: "Sales teams, SDRs, account executives, founders doing outbound",
    keyFeatures: [
      "MCP protocol compatible",
      "Works with Claude Desktop",
      "Company research",
      "Contact discovery",
      "Lead scoring",
      "Competitive analysis",
      "Smithery score 96/100",
    ],
    hashtags: ["#MCP", "#SalesIntelligence", "#Claude", "#AI", "#Sales", "#B2B", "#LeadGen", "#Smithery"],
    pricing: { amount: 2499, currency: "INR", label: "$29/mo", popular: false },
  },
  SaaSAuditScanner: {
    id: "saas-audit-scanner",
    name: "SaaS Audit Scanner",
    tagline: "Instantly audit any SaaS product for strengths, weaknesses, and growth opportunities",
    description: "An AI-powered tool that scans any SaaS product and generates a comprehensive audit report covering UX, pricing strategy, market positioning, feature gaps, and actionable improvement recommendations. Perfect for competitive analysis or self-auditing your own product.",
    url: "https://ariaagent.agency",
    targetAudience: "SaaS founders, product managers, UX designers, startup advisors",
    keyFeatures: [
      "Full SaaS audit",
      "UX evaluation",
      "Pricing analysis",
      "Market positioning",
      "Feature gap detection",
      "Actionable recommendations",
    ],
    hashtags: ["#SaaS", "#ProductAudit", "#UX", "#Startup", "#Founders", "#AI"],
    pricing: { amount: 4999, currency: "INR", label: "$49/audit", popular: false },
  },
  ShipProof: {
    id: "shipproof",
    name: "ShipProof",
    tagline: "Video Proof Infrastructure for Enterprise — SHA-256 Verified Shipment Recording",
    description: "API-first platform to record, verify, and prove every shipment. Enterprise-grade video proof infrastructure for ecommerce sellers on Amazon, Flipkart, eBay, Meesho, Myntra, Ajio, Shopify, and Etsy. Features SHA-256 cryptographic hashing, white-label branding, real-time webhooks, bulk processing for 100k+ videos/day, verification certificates, and storefront trust badges. Reduce disputes by 90% with tamper-proof video evidence. One API call to upload, stamp, and verify. SOC2 compliant with 99.99% uptime SLA and sub-100ms API latency.",
    url: "https://shipproof.netlify.app",
    targetAudience: "Ecommerce sellers on Amazon, Flipkart, eBay, Meesho, Myntra, Ajio, Shopify, Etsy, and global marketplaces. D2C brands, 3PL fulfillment centers, warehouse operations managers",
    keyFeatures: [
      "API-first architecture",
      "SHA-256 video hashing",
      "White-label ready",
      "100k+ videos/day",
      "Real-time webhooks",
      "Verification certificates",
      "Storefront trust badges",
      "Bulk processing",
      "SOC2 compliant",
      "99.99% uptime SLA",
      "Buyer verification links",
      "Multi-seller support",
    ],
    hashtags: ["#Ecommerce", "#Shipping", "#ProofOfDelivery", "#DisputeProtection", "#Fulfillment", "#D2C", "#AmazonSeller", "#Shopify", "#API", "#Enterprise"],
    pricing: { amount: 999, currency: "INR", label: "$9.99/mo", popular: true },
  },
  SparkBill: {
    id: "sparkbill",
    name: "SparkBill",
    tagline: "AI-powered invoicing that gets you paid faster",
    description: "An AI invoicing tool that generates professional invoices, tracks payment status, sends automated reminders, and predicts when clients will pay. Designed for freelancers and small agencies who want to spend less time on admin and more time on billable work.",
    url: "https://ariaagent.agency",
    targetAudience: "Freelancers, small agencies, consultants, solopreneurs",
    keyFeatures: [
      "AI invoice generation",
      "Payment tracking",
      "Automated reminders",
      "Payment prediction",
      "Multi-currency support",
    ],
    hashtags: ["#Invoicing", "#Freelance", "#SmallBusiness", "#AI", "#FinTech", "#GetPaid"],
    pricing: { amount: 1499, currency: "INR", label: "$19/mo", popular: false },
  },
  NaiveVoiceAgent: {
    id: "naive-voice-agent",
    name: "Naive AI Voice Agent",
    tagline: "Deploy a human-sounding AI voice agent in minutes",
    description: "Build and deploy AI-powered voice agents that handle phone calls, customer support, appointments, and lead qualification. The voice agent sounds natural and human-like, supports multiple languages, and integrates with your existing phone systems. Perfect for businesses that need 24/7 phone coverage without hiring more staff.",
    url: "https://ariaagent.agency",
    targetAudience: "Small businesses, dental offices, real estate agencies, service businesses",
    keyFeatures: [
      "Natural voice AI",
      "24/7 availability",
      "Multi-language support",
      "Phone system integration",
      "Lead qualification",
      "Appointment scheduling",
    ],
    hashtags: ["#VoiceAI", "#CustomerSupport", "#AI", "#Automation", "#SmallBusiness"],
    pricing: { amount: 4999, currency: "INR", label: "$99/mo", popular: false },
  },
  NaiveLandingPage: {
    id: "naive-landing-page",
    name: "Naive Landing Page",
    tagline: "Generate high-converting landing pages from a single prompt",
    description: "An AI tool that generates complete, responsive landing pages from a simple text description. Input your product details and it creates a full landing page with hero section, features, testimonials, pricing, and CTA — ready to deploy. No coding or design skills needed.",
    url: "https://ariaagent.agency",
    targetAudience: "Founders, marketers, indie hackers, product launchers",
    keyFeatures: [
      "One-prompt generation",
      "Responsive design",
      "SEO optimized",
      "Conversion focused",
      "Multiple templates",
      "Instant deployment",
    ],
    hashtags: ["#LandingPage", "#NoCode", "#AI", "#Marketing", "#Startup", "#Launch"],
    pricing: { amount: 2499, currency: "INR", label: "$29/mo", popular: false },
  },
};

export const PRODUCT_LIST = Object.values(PRODUCTS);

export function getProductById(id: string): Product | undefined {
  return PRODUCT_LIST.find((p) => p.id === id);
}

export function getProductNames(): string[] {
  return PRODUCT_LIST.map((p) => p.name);
}
