import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { success: false, error: "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required" },
        { status: 400 }
      );
    }

    // Use the service_role client (bypasses RLS)
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      db: { schema: "public" },
    });

    const results: string[] = [];

    // Strategy: Use the Supabase RPC endpoint to call exec_sql
    // First, try to create a helper function using raw SQL via the REST API
    // PostgREST doesn't support DDL, but we can try to use the _exec endpoint

    // Actually, the best approach: use fetch to the Supabase REST API's
    // undocumented exec endpoint that accepts the service_role key

    // We'll create a temporary RPC function first, then call it
    // But we can't create functions without DDL...

    // FINAL APPROACH: Use the service_role key to make a direct SQL request
    // to the Supabase /pg/query endpoint (available in newer Supabase versions)
    const urlMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (!urlMatch) {
      return NextResponse.json(
        { success: false, error: "Could not extract project ref from SUPABASE_URL" },
        { status: 400 }
      );
    }

    // Try the Supabase SQL execution endpoint (works with service_role key)
    const execEndpoint = `${supabaseUrl}/rest/v1/rpc/`;

    // First, create the exec_sql function itself via a trick:
    // We'll use the management API if available, otherwise fall back to direct approach
    const managementToken = process.env.SUPABASE_MANAGEMENT_TOKEN;
    const projectRef = urlMatch[1];

    const allCreateStatements = [
      // ===== MarketingPlan =====
      `CREATE TABLE IF NOT EXISTS "MarketingPlan" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "goal" TEXT,
        "status" TEXT DEFAULT 'draft',
        "rawResponse" TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );`,

      // ===== PlanStep =====
      `CREATE TABLE IF NOT EXISTS "PlanStep" (
        "id" TEXT PRIMARY KEY,
        "planId" TEXT NOT NULL,
        "stepOrder" INTEGER DEFAULT 0,
        "actionSlug" TEXT,
        "platform" TEXT,
        "product" TEXT,
        "topic" TEXT,
        "params" TEXT,
        "status" TEXT DEFAULT 'pending',
        "errorMessage" TEXT,
        "resultData" TEXT,
        "contentId" TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );`,

      // ===== ContentPiece =====
      `CREATE TABLE IF NOT EXISTS "ContentPiece" (
        "id" TEXT PRIMARY KEY,
        "platform" TEXT,
        "product" TEXT,
        "topic" TEXT,
        "title" TEXT,
        "body" TEXT,
        "hashtags" TEXT,
        "scheduledAt" TIMESTAMPTZ,
        "postedAt" TIMESTAMPTZ,
        "postStatus" TEXT DEFAULT 'draft',
        "postedUrl" TEXT,
        "externalId" TEXT,
        "errorMessage" TEXT,
        "planStepId" TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );`,

      // ===== PostHistory =====
      `CREATE TABLE IF NOT EXISTS "PostHistory" (
        "id" TEXT PRIMARY KEY,
        "platform" TEXT,
        "product" TEXT,
        "actionSlug" TEXT,
        "title" TEXT,
        "body" TEXT,
        "postedAt" TIMESTAMPTZ DEFAULT NOW(),
        "postedUrl" TEXT,
        "externalId" TEXT,
        "status" TEXT DEFAULT 'pending',
        "errorMessage" TEXT,
        "triggerType" TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW()
      );`,

      // ===== AutoPostConfig =====
      `CREATE TABLE IF NOT EXISTS "AutoPostConfig" (
        "id" TEXT PRIMARY KEY,
        "enabled" BOOLEAN DEFAULT false,
        "platforms" TEXT DEFAULT '[]',
        "products" TEXT DEFAULT '[]',
        "postFrequency" TEXT DEFAULT 'daily',
        "postTime" TEXT DEFAULT '09:00',
        "timezone" TEXT DEFAULT 'UTC',
        "lastRunAt" TIMESTAMPTZ,
        "nextRunAt" TIMESTAMPTZ,
        "lastRunStatus" TEXT,
        "lastRunMessage" TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );`,

      // ===== User =====
      `CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT PRIMARY KEY,
        "email" TEXT NOT NULL,
        "name" TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );`,

      // ===== Lead =====
      `CREATE TABLE IF NOT EXISTS "Lead" (
        "id" TEXT PRIMARY KEY,
        "firstName" TEXT,
        "lastName" TEXT,
        "email" TEXT,
        "jobTitle" TEXT,
        "companyName" TEXT,
        "companyDomain" TEXT,
        "linkedInUrl" TEXT,
        "location" TEXT,
        "seniority" TEXT,
        "industry" TEXT,
        "description" TEXT,
        "source" TEXT,
        "status" TEXT DEFAULT 'new',
        "score" INTEGER DEFAULT 0,
        "relevanceScore" REAL,
        "tags" TEXT,
        "notes" TEXT,
        "rawData" TEXT,
        "phone" TEXT,
        "website" TEXT,
        "targetProduct" TEXT,
        "emailSent" BOOLEAN DEFAULT false,
        "emailSentAt" TIMESTAMPTZ,
        "linkedinDmSent" BOOLEAN DEFAULT false,
        "followUpCount" INTEGER DEFAULT 0,
        "lastFollowUpAt" TIMESTAMPTZ,
        "funnel_stage" TEXT DEFAULT 'new',
        "buying_intent" INTEGER DEFAULT 0,
        "open_count" INTEGER DEFAULT 0,
        "click_count" INTEGER DEFAULT 0,
        "reply_count" INTEGER DEFAULT 0,
        "last_engagement_at" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );`,

      // ===== EmailOutreach =====
      `CREATE TABLE IF NOT EXISTS "EmailOutreach" (
        "id" TEXT PRIMARY KEY,
        "leadId" TEXT,
        "sequenceId" TEXT,
        "stepNumber" INTEGER DEFAULT 1,
        "toEmail" TEXT NOT NULL,
        "toName" TEXT,
        "subject" TEXT,
        "body" TEXT,
        "product" TEXT,
        "status" TEXT DEFAULT 'draft',
        "sentAt" TIMESTAMPTZ,
        "deliveredAt" TIMESTAMPTZ,
        "openedAt" TIMESTAMPTZ,
        "clickedAt" TIMESTAMPTZ,
        "clickedUrl" TEXT,
        "repliedAt" TIMESTAMPTZ,
        "replyBody" TEXT,
        "bouncedAt" TIMESTAMPTZ,
        "resendId" TEXT,
        "errorMessage" TEXT,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );`,

      // ===== EmailSequence =====
      `CREATE TABLE IF NOT EXISTS "EmailSequence" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "description" TEXT,
        "product" TEXT NOT NULL,
        "steps" TEXT NOT NULL,
        "intervalDays" INTEGER DEFAULT 3,
        "isActive" BOOLEAN DEFAULT true,
        "totalSent" INTEGER DEFAULT 0,
        "totalReplies" INTEGER DEFAULT 0,
        "totalConversions" INTEGER DEFAULT 0,
        "createdAt" TIMESTAMPTZ DEFAULT NOW(),
        "updatedAt" TIMESTAMPTZ DEFAULT NOW()
      );`,
    ];

    // RLS disable + policies for all tables
    const tables = [
      "MarketingPlan", "PlanStep", "ContentPiece", "PostHistory",
      "AutoPostConfig", "User", "Lead", "EmailOutreach", "EmailSequence"
    ];

    const rlsStatements = tables.map(t => [
      `DO $$ BEGIN ALTER TABLE "${t}" ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
      `DO $$ BEGIN CREATE POLICY "Allow all on ${t}" ON "${t}" FOR ALL USING (true) WITH CHECK (true); EXCEPTION WHEN OTHERS THEN NULL; END $$;`,
    ]).flat();

    const allSQL = [...allCreateStatements, ...rlsStatements].join("\n\n");

    if (managementToken) {
      // Use Supabase Management API
      const apiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${managementToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: allSQL }),
        });

        if (res.ok) {
          const data = await res.json();
          results.push(`All tables created via Management API`);
        } else {
          const errText = await res.text();
          results.push(`Management API error: ${res.status} ${errText.substring(0, 200)}`);
        }
      } catch (e: unknown) {
        results.push(`Management API failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else {
      results.push("No SUPABASE_MANAGEMENT_TOKEN - cannot create tables via REST API. Use Supabase SQL Editor to run the migration.");
      results.push("Go to: https://supabase.com/dashboard/project/" + projectRef + "/sql");
    }

    return NextResponse.json({
      success: true,
      message: "Setup initiated",
      steps: results,
      sql: allSQL,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ success: false, error: `Setup failed: ${message}` }, { status: 500 });
  }
}

// GET endpoint returns the SQL for manual execution
export async function GET() {
  const sql = `-- Aria Marketing Hub - Database Setup
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/xqwtfarnkjyiiudkjwqz/sql/new

-- ===== MarketingPlan =====
CREATE TABLE IF NOT EXISTS "MarketingPlan" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "goal" TEXT,
  "status" TEXT DEFAULT 'draft',
  "rawResponse" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ===== PlanStep =====
CREATE TABLE IF NOT EXISTS "PlanStep" (
  "id" TEXT PRIMARY KEY,
  "planId" TEXT NOT NULL,
  "stepOrder" INTEGER DEFAULT 0,
  "actionSlug" TEXT,
  "platform" TEXT,
  "product" TEXT,
  "topic" TEXT,
  "params" TEXT,
  "status" TEXT DEFAULT 'pending',
  "errorMessage" TEXT,
  "resultData" TEXT,
  "contentId" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ===== ContentPiece =====
CREATE TABLE IF NOT EXISTS "ContentPiece" (
  "id" TEXT PRIMARY KEY,
  "platform" TEXT,
  "product" TEXT,
  "topic" TEXT,
  "title" TEXT,
  "body" TEXT,
  "hashtags" TEXT,
  "scheduledAt" TIMESTAMPTZ,
  "postedAt" TIMESTAMPTZ,
  "postStatus" TEXT DEFAULT 'draft',
  "postedUrl" TEXT,
  "externalId" TEXT,
  "errorMessage" TEXT,
  "planStepId" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ===== PostHistory =====
CREATE TABLE IF NOT EXISTS "PostHistory" (
  "id" TEXT PRIMARY KEY,
  "platform" TEXT,
  "product" TEXT,
  "actionSlug" TEXT,
  "title" TEXT,
  "body" TEXT,
  "postedAt" TIMESTAMPTZ DEFAULT NOW(),
  "postedUrl" TEXT,
  "externalId" TEXT,
  "status" TEXT DEFAULT 'pending',
  "errorMessage" TEXT,
  "triggerType" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ===== AutoPostConfig =====
CREATE TABLE IF NOT EXISTS "AutoPostConfig" (
  "id" TEXT PRIMARY KEY,
  "enabled" BOOLEAN DEFAULT false,
  "platforms" TEXT DEFAULT '[]',
  "products" TEXT DEFAULT '[]',
  "postFrequency" TEXT DEFAULT 'daily',
  "postTime" TEXT DEFAULT '09:00',
  "timezone" TEXT DEFAULT 'UTC',
  "lastRunAt" TIMESTAMPTZ,
  "nextRunAt" TIMESTAMPTZ,
  "lastRunStatus" TEXT,
  "lastRunMessage" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ===== User =====
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Lead =====
CREATE TABLE IF NOT EXISTS "Lead" (
  "id" TEXT PRIMARY KEY,
  "firstName" TEXT,
  "lastName" TEXT,
  "email" TEXT,
  "jobTitle" TEXT,
  "companyName" TEXT,
  "companyDomain" TEXT,
  "linkedInUrl" TEXT,
  "location" TEXT,
  "seniority" TEXT,
  "industry" TEXT,
  "description" TEXT,
  "source" TEXT,
  "status" TEXT DEFAULT 'new',
  "score" INTEGER DEFAULT 0,
  "relevanceScore" REAL,
  "tags" TEXT,
  "notes" TEXT,
  "rawData" TEXT,
  "phone" TEXT,
  "website" TEXT,
  "targetProduct" TEXT,
  "emailSent" BOOLEAN DEFAULT false,
  "emailSentAt" TIMESTAMPTZ,
  "linkedinDmSent" BOOLEAN DEFAULT false,
  "followUpCount" INTEGER DEFAULT 0,
  "lastFollowUpAt" TIMESTAMPTZ,
  "funnel_stage" TEXT DEFAULT 'new',
  "buying_intent" INTEGER DEFAULT 0,
  "open_count" INTEGER DEFAULT 0,
  "click_count" INTEGER DEFAULT 0,
  "reply_count" INTEGER DEFAULT 0,
  "last_engagement_at" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ===== EmailOutreach =====
CREATE TABLE IF NOT EXISTS "EmailOutreach" (
  "id" TEXT PRIMARY KEY,
  "leadId" TEXT,
  "sequenceId" TEXT,
  "stepNumber" INTEGER DEFAULT 1,
  "toEmail" TEXT NOT NULL,
  "toName" TEXT,
  "subject" TEXT,
  "body" TEXT,
  "product" TEXT,
  "status" TEXT DEFAULT 'draft',
  "sentAt" TIMESTAMPTZ,
  "deliveredAt" TIMESTAMPTZ,
  "openedAt" TIMESTAMPTZ,
  "clickedAt" TIMESTAMPTZ,
  "clickedUrl" TEXT,
  "repliedAt" TIMESTAMPTZ,
  "replyBody" TEXT,
  "bouncedAt" TIMESTAMPTZ,
  "resendId" TEXT,
  "errorMessage" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ===== EmailSequence =====
CREATE TABLE IF NOT EXISTS "EmailSequence" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "product" TEXT NOT NULL,
  "steps" TEXT NOT NULL,
  "intervalDays" INTEGER DEFAULT 3,
  "isActive" BOOLEAN DEFAULT true,
  "totalSent" INTEGER DEFAULT 0,
  "totalReplies" INTEGER DEFAULT 0,
  "totalConversions" INTEGER DEFAULT 0,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- ===== Enable RLS and create open policies =====
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['MarketingPlan','PlanStep','ContentPiece','PostHistory','AutoPostConfig','User','Lead','EmailOutreach','EmailSequence']) LOOP
    EXECUTE format('ALTER TABLE "%I" ENABLE ROW LEVEL SECURITY', t);
    BEGIN
      EXECUTE format('CREATE POLICY "Allow all on %I" ON "%I" FOR ALL USING (true) WITH CHECK (true)', t, t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;`;

  return new NextResponse(sql, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
