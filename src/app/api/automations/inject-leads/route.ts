import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ALL_PREBAKED_LEADS, toLeadRow } from "@/lib/prebaked-leads";

// POST /api/automations/inject-leads
// Inject pre-baked high-quality leads into the database
// Then optionally trigger email sending

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const sendEmails = body.sendEmails === true;
    const product = body.product as string | undefined;

    let injected = 0;
    let skipped = 0;

    const leads = product
      ? ALL_PREBAKED_LEADS.filter(l => l.targetProduct === product)
      : ALL_PREBAKED_LEADS;

    for (const lead of leads) {
      // Check duplicate
      const existing = await db.lead.findFirst({ where: { email: lead.email } });
      if (existing) {
        skipped++;
        continue;
      }

      const dupCompany = await db.lead.findFirst({ where: { companyName: lead.companyName } });
      if (dupCompany) {
        skipped++;
        continue;
      }

      await db.lead.create({ data: toLeadRow(lead) });
      injected++;
      console.log(`[InjectLeads] ✅ ${lead.companyName} — ${lead.email}`);
    }

    const result: Record<string, unknown> = {
      success: true,
      injected,
      skipped,
      total: leads.length,
    };

    // If sendEmails is requested, trigger the money printer for just these products
    if (sendEmails && injected > 0) {
      const products = [...new Set(leads.map(l => l.targetProduct))];
      // Trigger money printer with skipPurge to just send emails
      const mpUrl = `${process.env.VERCEL_URL || "https://career-match-aa-aa-apps.vercel.app"}/api/automations/moneyprinter`;

      // Fire and forget — don't wait for the response
      fetch(mpUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ products, skipPurge: true }),
      }).catch(() => {});

      result.emailTriggered = true;
      result.products = products;
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
