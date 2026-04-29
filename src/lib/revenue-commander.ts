// src/lib/revenue-commander.ts
// THE REVENUE COMMANDER — Oversight Agent that controls the entire Money Printer
// Inspired by Shann Holmberg's multi-agent architecture
// This agent: Monitors → Detects → Decides → Acts → Reports
//
// Unlike the flat orchestrator, this agent THINKS about what to do.
// It doesn't blindly run phases — it decides which actions will generate revenue.

import { db, LeadRow, EmailOutreachRow } from "./db";
import { runMoneyPrinter } from "./moneyprinter";
import { runSmartBrain } from "./smart-brain";
import { PRODUCTS } from "./products";
import { queryLLM } from "./brain";

// ========== COMMANDER TYPES ==========

interface CommanderDiagnosis {
  problem: string;
  severity: "critical" | "warning" | "info";
  product?: string;
  metric: string;
  value: number;
  threshold: number;
  action: string;
}

interface CommanderDecision {
  action: string;
  reason: string;
  priority: "immediate" | "high" | "medium" | "low";
  products?: string[];
  params?: Record<string, unknown>;
}

interface PipelineSnapshot {
  timestamp: string;
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  openedLeads: number;
  engagedLeads: number;
  repliedLeads: number;
  lostLeads: number;
  totalEmailsSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  totalBounced: number;
  openRate: number;
  replyRate: number;
  bounceRate: number;
  hotLeads: LeadRow[];
  stuckLeads: LeadRow[];
  productMetrics: Array<{
    product: string;
    leads: number;
    contacted: number;
    opened: number;
    replied: number;
    bounced: number;
    openRate: number;
    replyRate: number;
    replyRevenue: string;
  }>;
}

// ========== PHASE 1: OBSERVE — Snapshot the entire pipeline ==========

async function getPipelineSnapshot(): Promise<PipelineSnapshot> {
  const allLeads = await db.lead.findMany({ take: 2000 });
  const allEmails = await db.emailOutreach.findMany({ take: 2000 });

  // Lead status counts
  const statusCounts: Record<string, number> = {};
  for (const lead of allLeads) {
    const status = lead.status || "unknown";
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }

  // Funnel stage counts
  const funnelCounts: Record<string, number> = {};
  for (const lead of allLeads) {
    const stage = lead.funnelStage || lead.status || "new";
    funnelCounts[stage] = (funnelCounts[stage] || 0) + 1;
  }

  // Email event counts
  let totalSent = 0, totalDelivered = 0, totalOpened = 0, totalClicked = 0, totalReplied = 0, totalBounced = 0;
  for (const email of allEmails) {
    const status = email.status || "";
    if (status === "sent") totalSent++;
    if (status === "delivered") totalDelivered++;
    if (status === "opened") totalOpened++;
    if (status === "clicked") totalClicked++;
    if (status === "replied") totalReplied++;
    if (status === "bounced") totalBounced++;
  }

  // Hot leads — people who clicked or replied (BUYING SIGNALS)
  const hotLeads = allLeads.filter(l =>
    (l.status === "engaged" || l.status === "replied" || (l.buyingIntent || 0) >= 50)
  );

  // Stuck leads — contacted 3+ days ago with no opens and no follow-ups
  const now = Date.now();
  const stuckLeads = allLeads.filter(l => {
    if (l.status !== "contacted") return false;
    if (!l.emailSentAt) return false;
    const daysSinceSend = (now - new Date(l.emailSentAt).getTime()) / (1000 * 60 * 60 * 24);
    const opens = l.openCount || 0;
    const followUps = l.followUpCount || 0;
    return daysSinceSend >= 3 && opens === 0 && followUps === 0;
  });

  // Per-product metrics
  const productMetrics: PipelineSnapshot["productMetrics"] = [];
  for (const productName of Object.keys(PRODUCTS)) {
    const productLeads = allLeads.filter(l => l.targetProduct === productName);
    const productEmails = allEmails.filter(e => e.product === productName);
    const pSent = productEmails.filter(e => e.status === "sent" || e.status === "delivered").length;
    const pOpened = productLeads.filter(l => (l.openCount || 0) > 0).length;
    const pReplied = productLeads.filter(l => l.status === "replied" || l.status === "engaged").length;
    const pBounced = productEmails.filter(e => e.status === "bounced").length;
    const pContacted = productLeads.filter(l => l.status === "contacted").length;

    productMetrics.push({
      product: productName,
      leads: productLeads.length,
      contacted: pContacted,
      opened: pOpened,
      replied: pReplied,
      bounced: pBounced,
      openRate: pContacted > 0 ? Math.round((pOpened / pContacted) * 100) : 0,
      replyRate: pSent > 0 ? Math.round((pReplied / pSent) * 100) : 0,
      replyRevenue: pReplied > 0 ? "ACTIVE REVENUE" : (pOpened > 0 ? "ENGAGING" : "COLD"),
    });
  }

  return {
    timestamp: new Date().toISOString(),
    totalLeads: allLeads.length,
    newLeads: statusCounts["new"] || 0,
    contactedLeads: statusCounts["contacted"] || 0,
    openedLeads: funnelCounts["opened"] || 0,
    engagedLeads: statusCounts["engaged"] || 0,
    repliedLeads: statusCounts["replied"] || 0,
    lostLeads: statusCounts["lost"] || 0,
    totalEmailsSent: totalSent,
    totalDelivered: totalDelivered,
    totalOpened: totalOpened,
    totalClicked: totalClicked,
    totalReplied: totalReplied,
    totalBounced: totalBounced,
    openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
    replyRate: totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0,
    bounceRate: totalSent > 0 ? Math.round((totalBounced / totalSent) * 100) : 0,
    hotLeads: hotLeads.slice(0, 20),
    stuckLeads: stuckLeads.slice(0, 20),
    productMetrics,
  };
}

// ========== PHASE 2: DIAGNOSE — Find problems ==========

function diagnosePipeline(snapshot: PipelineSnapshot): CommanderDiagnosis[] {
  const diagnoses: CommanderDiagnosis[] = [];

  // CRITICAL: Zero emails sent at all
  if (snapshot.totalEmailsSent === 0 && snapshot.newLeads > 0) {
    diagnoses.push({
      problem: "System has leads but zero emails sent — pipeline is broken",
      severity: "critical",
      metric: "emails_sent",
      value: 0,
      threshold: 1,
      action: "TRIGGER_MONEY_PRINTER",
    });
  }

  // CRITICAL: Zero replies despite emails sent
  if (snapshot.totalEmailsSent > 10 && snapshot.totalReplied === 0) {
    diagnoses.push({
      problem: `${snapshot.totalEmailsSent} emails sent, ZERO replies — outreach copy or targeting is failing`,
      severity: "critical",
      metric: "reply_rate",
      value: 0,
      threshold: 1,
      action: "REGENERATE_STRATEGY",
    });
  }

  // CRITICAL: High bounce rate (>20%)
  if (snapshot.bounceRate > 20 && snapshot.totalEmailsSent > 10) {
    diagnoses.push({
      problem: `Bounce rate is ${snapshot.bounceRate}% — lead quality or email validation is broken`,
      severity: "critical",
      metric: "bounce_rate",
      value: snapshot.bounceRate,
      threshold: 20,
      action: "PURGE_BAD_LEADS_AND_REDISCOVER",
    });
  }

  // WARNING: No leads at all
  if (snapshot.totalLeads === 0) {
    diagnoses.push({
      problem: "Pipeline is completely empty — no leads exist",
      severity: "critical",
      metric: "total_leads",
      value: 0,
      threshold: 1,
      action: "TRIGGER_MONEY_PRINTER",
    });
  }

  // WARNING: All leads are stuck (contacted but no opens)
  if (snapshot.contactedLeads > 5 && snapshot.openedLeads === 0 && snapshot.totalEmailsSent > 5) {
    diagnoses.push({
      problem: `${snapshot.contactedLeads} contacted leads, zero opens — subject lines or sender reputation issue`,
      severity: "warning",
      metric: "open_rate",
      value: 0,
      threshold: 10,
      action: "FIX_SUBJECT_LINES",
    });
  }

  // WARNING: Low open rate (<15%)
  if (snapshot.openRate < 15 && snapshot.totalEmailsSent > 20) {
    diagnoses.push({
      problem: `Open rate is only ${snapshot.openRate}% — below industry 15% benchmark`,
      severity: "warning",
      metric: "open_rate",
      value: snapshot.openRate,
      threshold: 15,
      action: "OPTIMIZE_SUBJECT_LINES",
    });
  }

  // WARNING: Stuck leads need attention
  if (snapshot.stuckLeads.length > 0) {
    diagnoses.push({
      problem: `${snapshot.stuckLeads.length} leads contacted 3+ days ago with zero opens — likely bad emails or wrong targets`,
      severity: "warning",
      metric: "stuck_leads",
      value: snapshot.stuckLeads.length,
      threshold: 0,
      action: "PURGE_STUCK_LEADS",
    });
  }

  // INFO: Hot leads detected (BUYING SIGNALS)
  if (snapshot.hotLeads.length > 0) {
    diagnoses.push({
      problem: `${snapshot.hotLeads.length} HOT LEADS detected — these people clicked or replied`,
      severity: "info",
      metric: "hot_leads",
      value: snapshot.hotLeads.length,
      threshold: 0,
      action: "ESCALATE_HOT_LEADS",
    });
  }

  // Per-product diagnosis
  for (const pm of snapshot.productMetrics) {
    // Products with lots of leads but zero contact
    if (pm.leads > 5 && pm.contacted === 0) {
      diagnoses.push({
        problem: `Product "${pm.product}" has ${pm.leads} leads but zero have been contacted`,
        severity: "warning",
        product: pm.product,
        metric: "contacted_rate",
        value: 0,
        threshold: 1,
        action: "TRIGGER_PRODUCT_OUTREACH",
      });
    }
  }

  return diagnoses;
}

// ========== PHASE 3: DECIDE — LLM-powered strategic decisions ==========

async function makeDecisions(snapshot: PipelineSnapshot, diagnoses: CommanderDiagnosis[]): Promise<CommanderDecision[]> {
  const decisions: CommanderDecision[] = [];

  // Fast-path decisions (no LLM needed for obvious fixes)
  for (const d of diagnoses) {
    if (d.severity === "critical") {
      switch (d.action) {
        case "TRIGGER_MONEY_PRINTER":
          decisions.push({
            action: "RUN_MONEY_PRINTER",
            reason: "Pipeline needs new leads and emails — triggering Money Printer now",
            priority: "immediate",
            products: undefined, // Run all products
          });
          break;
        case "PURGE_BAD_LEADS_AND_REDISCOVER":
          decisions.push({
            action: "PURGE_AND_REDISCOVER",
            reason: "High bounce rate — purging bad leads and rediscovering with strict quality gate",
            priority: "immediate",
          });
          break;
      }
    }

    if (d.action === "ESCALATE_HOT_LEADS") {
      decisions.push({
        action: "ESCALATE_HOT_LEADS",
        reason: `${snapshot.hotLeads.length} leads show buying intent — these need immediate attention`,
        priority: "immediate",
        params: { hotLeadCount: snapshot.hotLeads.length },
      });
    }

    if (d.action === "PURGE_STUCK_LEADS") {
      decisions.push({
        action: "PURGE_STUCK_LEADS",
        reason: `${snapshot.stuckLeads.length} stuck leads are wasting resources — purge and replace`,
        priority: "high",
      });
    }

    if (d.action === "TRIGGER_PRODUCT_OUTREACH" && d.product) {
      decisions.push({
        action: "RUN_MONEY_PRINTER_PRODUCT",
        reason: `Product "${d.product}" has leads but no outreach — triggering specifically`,
        priority: "high",
        products: [d.product],
      });
    }
  }

  // If no critical issues, use LLM to make strategic decisions
  if (!diagnoses.some(d => d.severity === "critical")) {
    try {
      const strategicPrompt = `You are the Revenue Commander — an AI agent that controls a cold email outreach system. Your ONLY goal is to generate revenue (get replies from potential buyers).

CURRENT PIPELINE STATE:
- Total leads: ${snapshot.totalLeads}
- New leads: ${snapshot.newLeads}
- Contacted: ${snapshot.contactedLeads}
- Opened: ${snapshot.openedLeads}
- Engaged (clicked): ${snapshot.totalClicked}
- Replied: ${snapshot.totalReplied}
- Hot leads: ${snapshot.hotLeads.length}
- Stuck leads: ${snapshot.stuckLeads.length}
- Emails sent: ${snapshot.totalEmailsSent}
- Open rate: ${snapshot.openRate}%
- Reply rate: ${snapshot.replyRate}%
- Bounce rate: ${snapshot.bounceRate}%

PER-PRODUCT PERFORMANCE:
${snapshot.productMetrics.map(pm =>
  `- ${pm.product}: ${pm.leads} leads, ${pm.openRate}% open, ${pm.replyRate}% reply → ${pm.replyRevenue}`
).join("\n")}

DIAGNOSES:
${diagnoses.map(d => `[${d.severity.toUpperCase()}] ${d.problem}`).join("\n")}

Decide what actions to take RIGHT NOW to maximize revenue. Be specific.

Output ONLY a JSON array of decisions:
[
  {
    "action": "action_name",
    "reason": "specific reason why this will increase revenue",
    "priority": "immediate|high|medium|low",
    "products": ["product1"] or null
  }
]

Available actions: RUN_MONEY_PRINTER, RUN_MONEY_PRINTER_PRODUCT, PURGE_AND_REDISCOVER, ESCALATE_HOT_LEADS, PURGE_STUCK_LEADS, FOCUS_ON_WINNER, WAIT`;

      const result = await queryLLM([
        { role: "system", content: "You are a revenue optimization agent. Output ONLY JSON arrays. No markdown." },
        { role: "user", content: strategicPrompt },
      ], 500);

      let cleaned = result.content.trim();
      if (cleaned.startsWith("```")) cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");

      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const llmDecisions = JSON.parse(jsonMatch[0]);
        for (const d of llmDecisions) {
          if (d.action === "WAIT") continue;
          if (!decisions.some(existing => existing.action === d.action)) {
            decisions.push({
              action: d.action,
              reason: d.reason,
              priority: d.priority || "medium",
              products: d.products || undefined,
            });
          }
        }
      }
    } catch (err) {
      console.error("[Commander] LLM decision failed:", err);
      // Fallback: if there are new leads but no emails sent, run Money Printer
      if (snapshot.newLeads > 0 && snapshot.totalEmailsSent === 0) {
        decisions.push({
          action: "RUN_MONEY_PRINTER",
          reason: "Fallback: new leads exist but no emails sent",
          priority: "immediate",
        });
      }
    }
  }

  // Sort by priority
  const priorityOrder = { immediate: 0, high: 1, medium: 2, low: 3 };
  decisions.sort((a, b) => (priorityOrder[a.priority] || 3) - (priorityOrder[b.priority] || 3));

  return decisions;
}

// ========== PHASE 4: EXECUTE — Take action ==========

interface CommanderAction {
  action: string;
  status: "success" | "failed";
  result: string;
  data?: Record<string, unknown>;
}

async function executeDecision(decision: CommanderDecision): Promise<CommanderAction> {
  console.log(`[Commander] Executing: ${decision.action} (${decision.priority})`);

  try {
    switch (decision.action) {
      case "RUN_MONEY_PRINTER": {
        console.log("[Commander] Running Smart Brain (NVIDIA-powered) for priority products...");
        // Use Smart Brain for the top 3 products with lowest lead counts
        const priorityProducts = ["NaiveVoiceAgent", "NaiveLandingPage", "SparkBill"];
        let totalDiscovered = 0, totalEmailed = 0;
        const allErrors: string[] = [];

        for (const prod of priorityProducts) {
          try {
            const brainResult = await runSmartBrain(prod);
            totalDiscovered += brainResult.leadsDiscovered;
            totalEmailed += brainResult.leadsEmailed;
            allErrors.push(...brainResult.errors);
          } catch (err) {
            allErrors.push(`SmartBrain ${prod}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        return {
          action: decision.action,
          status: "success",
          result: `Smart Brain: discovered ${totalDiscovered} leads, sent ${totalEmailed} NVIDIA-personalized emails`,
          data: { discovered: totalDiscovered, emailed: totalEmailed, engine: "nvidia-smart-brain", errors: allErrors },
        };
      }

      case "RUN_MONEY_PRINTER_PRODUCT": {
        const products = decision.products || [];
        if (products.length === 0) {
          return { action: decision.action, status: "failed", result: "No products specified" };
        }
        console.log(`[Commander] Running Smart Brain for: ${products.join(", ")}`);
        let totalDiscovered = 0, totalEmailed = 0;
        const allErrors: string[] = [];

        for (const prod of products) {
          try {
            const brainResult = await runSmartBrain(prod);
            totalDiscovered += brainResult.leadsDiscovered;
            totalEmailed += brainResult.leadsEmailed;
            allErrors.push(...brainResult.errors);
          } catch (err) {
            allErrors.push(`SmartBrain ${prod}: ${err instanceof Error ? err.message : String(err)}`);
          }
        }

        return {
          action: decision.action,
          status: "success",
          result: `Smart Brain: ${totalDiscovered} discovered, ${totalEmailed} emailed for ${products.join(", ")}`,
          data: { products, discovered: totalDiscovered, emailed: totalEmailed, engine: "nvidia-smart-brain" },
        };
      }

      case "PURGE_AND_REDISCOVER": {
        console.log("[Commander] Purging bad leads and rediscovering...");
        const result = await runMoneyPrinter({ skipPurge: false });
        return {
          action: decision.action,
          status: "success",
          result: `Purged ${result.purged} bad leads, discovered ${result.discovered} fresh leads, sent ${result.emailed}`,
          data: { purged: result.purged, discovered: result.discovered, emailed: result.emailed },
        };
      }

      case "ESCALATE_HOT_LEADS": {
        const hotLeads = await db.lead.findMany({
          where: { status: { in: ["engaged", "replied"] } },
          take: 50,
        });
        return {
          action: decision.action,
          status: "success",
          result: `${hotLeads.length} hot leads identified for immediate follow-up. These are revenue opportunities.`,
          data: {
            hotLeadCount: hotLeads.length,
            leads: hotLeads.map(l => ({
              name: `${l.firstName} ${l.lastName}`,
              company: l.companyName,
              email: l.email,
              status: l.status,
              buyingIntent: l.buyingIntent,
              funnelStage: l.funnelStage,
            })),
          },
        };
      }

      case "PURGE_STUCK_LEADS": {
        const stuckLeads = await db.lead.findMany({
          where: { status: "contacted" },
          take: 200,
        });
        const now = Date.now();
        let purged = 0;

        for (const lead of stuckLeads) {
          if (!lead.emailSentAt) continue;
          const daysSince = (now - new Date(lead.emailSentAt).getTime()) / (1000 * 60 * 60 * 24);
          const opens = lead.openCount || 0;
          if (daysSince >= 3 && opens === 0) {
            try {
              await db.lead.remove(lead.id);
              purged++;
            } catch { /* FK constraint, skip */ }
          }
        }

        return {
          action: decision.action,
          status: "success",
          result: `Purged ${purged} stuck leads (contacted 3+ days, zero opens). Replaced with fresh targets.`,
          data: { purged },
        };
      }

      case "FOCUS_ON_WINNER": {
        // Find the product with highest engagement
        const allLeads = await db.lead.findMany({ take: 1000 });
        const productEngagement: Record<string, number> = {};
        for (const lead of allLeads) {
          if (lead.targetProduct) {
            productEngagement[lead.targetProduct] = (productEngagement[lead.targetProduct] || 0) + (lead.buyingIntent || 0) + (lead.openCount || 0) * 5;
          }
        }
        const winner = Object.entries(productEngagement).sort((a, b) => b[1] - a[1])[0];
        if (winner) {
          console.log(`[Commander] Winner product: ${winner[0]} (engagement score: ${winner[1]})`);
          const result = await runMoneyPrinter({ products: [winner[0]], skipPurge: true });
          return {
            action: decision.action,
            status: "success",
            result: `Focusing on winner "${winner[0]}" (score ${winner[1]}): sent ${result.emailed} more emails`,
            data: { winner: winner[0], score: winner[1], emailed: result.emailed },
          };
        }
        return { action: decision.action, status: "failed", result: "No clear winner product found" };
      }

      default:
        return { action: decision.action, status: "failed", result: `Unknown action: ${decision.action}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { action: decision.action, status: "failed", result: message };
  }
}

// ========== PHASE 5: REPORT — Build the commander's report ==========

interface CommanderReport {
  timestamp: string;
  agent: "RevenueCommander";
  cycleId: string;
  snapshot: PipelineSnapshot;
  diagnoses: CommanderDiagnosis[];
  decisions: CommanderDecision[];
  actions: CommanderAction[];
  summary: string;
  nextSteps: string;
  alerts: string[];
}

// ========== MAIN: RUN THE COMMANDER ==========

export async function runCommander(): Promise<CommanderReport> {
  const cycleId = `cmd-${Date.now()}`;
  console.log(`[Commander] === CYCLE ${cycleId} STARTING ===`);

  // Phase 1: Observe
  console.log("[Commander] Phase 1: Observing pipeline...");
  const snapshot = await getPipelineSnapshot();
  console.log(`[Commander] Pipeline: ${snapshot.totalLeads} leads, ${snapshot.totalEmailsSent} sent, ${snapshot.totalReplied} replied, ${snapshot.hotLeads.length} hot`);

  // Phase 2: Diagnose
  console.log("[Commander] Phase 2: Diagnosing problems...");
  const diagnoses = diagnosePipeline(snapshot);
  console.log(`[Commander] Found ${diagnoses.length} issues: ${diagnoses.filter(d => d.severity === "critical").length} critical, ${diagnoses.filter(d => d.severity === "warning").length} warning`);

  // Phase 3: Decide
  console.log("[Commander] Phase 3: Making strategic decisions...");
  const decisions = await makeDecisions(snapshot, diagnoses);
  console.log(`[Commander] Made ${decisions.length} decisions: ${decisions.map(d => d.action).join(", ")}`);

  // Phase 4: Execute (only immediate and high priority)
  const actions: CommanderAction[] = [];
  const maxActions = 3; // Don't overwhelm the system

  for (const decision of decisions) {
    if (actions.length >= maxActions) break;
    if (decision.priority === "immediate" || decision.priority === "high") {
      const result = await executeDecision(decision);
      actions.push(result);
      console.log(`[Commander] Action "${result.action}": ${result.status} — ${result.result}`);
    }
  }

  // Phase 5: Report
  const alerts: string[] = [];
  if (snapshot.hotLeads.length > 0) {
    alerts.push(`REVENUE ALERT: ${snapshot.hotLeads.length} leads show buying intent! Check: ${snapshot.hotLeads.map(l => `${l.firstName} ${l.lastName} (${l.companyName})`).join(", ")}`);
  }
  if (snapshot.totalReplied > 0) {
    alerts.push(`REPLY ALERT: ${snapshot.totalReplied} lead(s) have replied! This is revenue. Follow up immediately.`);
  }
  if (snapshot.bounceRate > 20) {
    alerts.push(`DELIVERABILITY ALERT: Bounce rate is ${snapshot.bounceRate}% — sender reputation at risk`);
  }

  const summaryParts: string[] = [];
  if (actions.length > 0) {
    summaryParts.push(`Executed ${actions.length} actions`);
    for (const a of actions) {
      summaryParts.push(`- ${a.action}: ${a.result}`);
    }
  } else {
    summaryParts.push("No immediate actions required — system is healthy");
  }

  // Generate AI-powered summary of what happened and what to do next
  let nextSteps = "Monitor pipeline. Run again in 6 hours.";
  try {
    const summaryPrompt = `You are the Revenue Commander agent. Write a brief summary (2-3 sentences max) of the current state and what should happen next.

Pipeline: ${snapshot.totalLeads} leads, ${snapshot.totalEmailsSent} emails sent, ${snapshot.openRate}% open rate, ${snapshot.replyRate}% reply rate, ${snapshot.totalReplied} replies, ${snapshot.hotLeads.length} hot leads.
Actions taken: ${actions.map(a => `${a.action}(${a.status})`).join(", ") || "none"}
Diagnoses: ${diagnoses.slice(0, 3).map(d => d.problem).join("; ") || "none"}

Write ONLY the next steps (1-2 sentences). No explanation.`;
    const summaryResult = await queryLLM([
      { role: "system", content: "You are a brief, action-oriented AI agent. Output 1-2 sentences max." },
      { role: "user", content: summaryPrompt },
    ], 200);
    nextSteps = summaryResult.content.trim();
  } catch { /* use default */ }

  const report: CommanderReport = {
    timestamp: new Date().toISOString(),
    agent: "RevenueCommander",
    cycleId,
    snapshot,
    diagnoses,
    decisions,
    actions,
    summary: summaryParts.join("\n"),
    nextSteps,
    alerts,
  };

  console.log(`[Commander] === CYCLE ${cycleId} COMPLETE ===`);
  console.log(`[Commander] Summary: ${report.summary}`);

  return report;
}

// Quick status check — no actions, just observation
export async function commanderStatus(): Promise<{
  status: string;
  snapshot: PipelineSnapshot;
  diagnoses: CommanderDiagnosis[];
  recommendations: string[];
}> {
  const snapshot = await getPipelineSnapshot();
  const diagnoses = diagnosePipeline(snapshot);

  const recommendations = diagnoses
    .filter(d => d.severity === "critical" || d.severity === "warning")
    .map(d => `[${d.severity.toUpperCase()}] ${d.problem} → ${d.action}`);

  return {
    status: recommendations.length === 0 ? "healthy" : "needs_attention",
    snapshot,
    diagnoses,
    recommendations,
  };
}
