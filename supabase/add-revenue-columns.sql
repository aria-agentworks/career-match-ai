-- ============================================================
-- Migration: Add revenue tracking columns to Lead & EmailOutreach
-- Date: Auto-generated
-- Notes: Uses IF NOT EXISTS guards so this is safe to re-run.
--        Run in Supabase SQL Editor or via your preferred tool.
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- Lead table — new columns for funnel & engagement tracking
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Lead'
      AND column_name  = 'funnel_stage'
  ) THEN
    ALTER TABLE "Lead" ADD COLUMN "funnel_stage" TEXT DEFAULT 'new';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Lead'
      AND column_name  = 'buying_intent'
  ) THEN
    ALTER TABLE "Lead" ADD COLUMN "buying_intent" INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Lead'
      AND column_name  = 'open_count'
  ) THEN
    ALTER TABLE "Lead" ADD COLUMN "open_count" INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Lead'
      AND column_name  = 'click_count'
  ) THEN
    ALTER TABLE "Lead" ADD COLUMN "click_count" INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Lead'
      AND column_name  = 'reply_count'
  ) THEN
    ALTER TABLE "Lead" ADD COLUMN "reply_count" INTEGER DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'Lead'
      AND column_name  = 'last_engagement_at'
  ) THEN
    ALTER TABLE "Lead" ADD COLUMN "last_engagement_at" TIMESTAMPTZ;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- EmailOutreach table — new columns for delivery & reply detail
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'EmailOutreach'
      AND column_name  = 'delivered_at'
  ) THEN
    ALTER TABLE "EmailOutreach" ADD COLUMN "delivered_at" TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'EmailOutreach'
      AND column_name  = 'clicked_at'
  ) THEN
    ALTER TABLE "EmailOutreach" ADD COLUMN "clicked_at" TIMESTAMPTZ;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'EmailOutreach'
      AND column_name  = 'clicked_url'
  ) THEN
    ALTER TABLE "EmailOutreach" ADD COLUMN "clicked_url" TEXT;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'EmailOutreach'
      AND column_name  = 'reply_body'
  ) THEN
    ALTER TABLE "EmailOutreach" ADD COLUMN "reply_body" TEXT;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────
-- Backfill defaults on existing rows (optional but recommended)
-- ────────────────────────────────────────────────────────────

UPDATE "Lead"
SET "funnel_stage"  = COALESCE("funnel_stage",  'new'),
    "buying_intent" = COALESCE("buying_intent",  0),
    "open_count"    = COALESCE("open_count",     0),
    "click_count"   = COALESCE("click_count",    0),
    "reply_count"   = COALESCE("reply_count",    0)
WHERE "funnel_stage"  IS NULL
   OR "buying_intent" IS NULL
   OR "open_count"    IS NULL
   OR "click_count"   IS NULL
   OR "reply_count"   IS NULL;

COMMIT;
