import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { PRODUCTS } from "@/lib/products";

export async function GET() {
  const productStats: Record<string, { total: number; noEmail: number; withEmail: number; withDomain: number }> = {};

  for (const product of Object.keys(PRODUCTS)) {
    const leads = await db.lead.findMany({
      where: { targetProduct: product, status: "new" },
      take: 200,
    });

    const withEmail = leads.filter(l => l.email && l.email.includes("@")).length;
    const noEmail = leads.filter(l => !l.email || !l.email.includes("@")).length;
    const withDomain = leads.filter(l => l.companyDomain && l.firstName && l.lastName).length;

    productStats[product] = { total: leads.length, noEmail, withEmail, withDomain };
  }

  const outreach = await db.emailOutreach.findMany({ take: 100 });
  const latestOutreach = outreach.slice(0, 3).map(o => ({
    to: o.toEmail,
    status: o.status,
    product: o.product,
    step: o.stepNumber,
    date: o.sentAt || o.createdAt,
  }));

  return NextResponse.json({ productStats, totalOutreach: outreach.length, latestOutreach });
}
