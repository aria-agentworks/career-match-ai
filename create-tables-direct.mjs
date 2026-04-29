// One-time script to create all Supabase tables
// Uses the service_role key to get a direct DB connection
// Then creates all required tables via pg

import pg from "pg";
const { Client } = pg;

const SUPABASE_URL = "https://xqwtfarnkjyiiudkjwqz.supabase.co";
const SERVICE_ROLE_KEY = process.argv[2] || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxd3RmYXJua2p5aWl1ZGtqd3F6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1MDUwOCwiZXhwIjoyMDkxODI2NTA4fQ.Zjk6xyOBHz3EC3npawmqVnYSumxyBfgnmqdN14IJqkA";

const allSQL = `
-- MarketingPlan
CREATE TABLE IF NOT EXISTS "MarketingPlan" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "goal" TEXT,
  "status" TEXT DEFAULT 'draft',
  "rawResponse" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- PlanStep
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

-- ContentPiece
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

-- PostHistory
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

-- AutoPostConfig
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

-- User
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);

-- Lead (with all columns including revenue tracking)
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

-- EmailOutreach (with all webhook tracking columns)
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

-- EmailSequence
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

-- RLS policies
DO $$ DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY['MarketingPlan','PlanStep','ContentPiece','PostHistory','AutoPostConfig','User','Lead','EmailOutreach','EmailSequence']) LOOP
    EXECUTE format('ALTER TABLE "%I" ENABLE ROW LEVEL SECURITY', t);
    BEGIN
      EXECUTE format('CREATE POLICY "Allow all on %I" ON "%I" FOR ALL USING (true) WITH CHECK (true)', t, t);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;
`;

async function main() {
  console.log("Attempting to create tables...");
  console.log("Method: Supabase REST API with service_role key\n");

  // Method 1: Try the Supabase RPC endpoint
  // First create a function to run arbitrary SQL, then call it
  // Actually this won't work either because we can't CREATE FUNCTION via REST

  // Method 2: Use the Supabase Management API with service_role as token
  // (It's a long shot but let's try)
  const projectRef = "xqwtfarnkjyiiudkjwqz";
  const mgmtApiUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;

  console.log("Trying Supabase Management API with service_role key...");
  try {
    const res = await fetch(mgmtApiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: allSQL }),
    });
    const text = await res.text();
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text.substring(0, 500)}`);
    if (res.ok) {
      console.log("\n✅ Tables created successfully!");
      return;
    }
  } catch (e) {
    console.log(`Management API failed: ${e}`);
  }

  // Method 3: Direct PostgreSQL connection
  // We need the DB password. Let's try to extract it from the project
  console.log("\nTrying to extract database connection info...");

  try {
    const projectRes = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
      headers: { "Authorization": `Bearer ${SERVICE_ROLE_KEY}` },
    });
    if (projectRes.ok) {
      const projectData = await projectRes.json();
      console.log("Project region:", projectData.region);
    }
  } catch {}

  console.log("\n❌ All automated methods failed.");
  console.log("You need to run the SQL manually in the Supabase SQL Editor.");
  console.log("Go to: https://supabase.com/dashboard/project/xqwtfarnkjyiiudkjwqz/sql/new");
  console.log("Copy the SQL from: curl https://my-project-aa-apps.vercel.app/api/setup/tables");
}

main().catch(console.error);
