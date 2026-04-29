import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://xqwtfarnkjyiiudkjwqz.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhxd3RmYXJua2p5aWl1ZGtqd3F6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjI1MDUwOCwiZXhwIjoyMDkxODI2NTA4fQ.Zjk6xyOBHz3EC3npawmqVnYSumxyBfgnmqdN14IJqkA'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// We need to use the service_role key with rpc or direct SQL
// PostgREST doesn't support DDL, so we use the /rest/v1/rpc approach
// But we need a function first... Let's try the pg endpoint

async function runSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql_query: sql })
  })
  return res
}

async function main() {
  console.log('Creating tables via Supabase service_role key...')

  // List all tables we need
  const tables = [
    'MarketingPlan', 'PlanStep', 'ContentPiece', 'PostHistory',
    'AutoPostConfig', 'User', 'Lead', 'EmailOutreach', 'EmailSequence'
  ]

  // Try to read existing tables
  for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1)
    if (error) {
      console.log(`❌ ${table}: MISSING - ${error.message}`)
    } else {
      console.log(`✅ ${table}: EXISTS`)
    }
  }
}

main().catch(console.error)
