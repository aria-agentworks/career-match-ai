import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _supabase: SupabaseClient | null = null

function getSupabase(): SupabaseClient {
  if (_supabase) return _supabase
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables')
  }
  _supabase = createClient(url, key)
  return _supabase
}

function cuid(): string {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

// ========== COLUMN NAME MAPPING ==========
// Supabase columns use lowercase-no-underscore naming (e.g., "firstname", "companyname", "createdat")
// Code uses camelCase (e.g., "firstName", "companyName", "createdAt").
// Revenue fields use snake_case in both code and DB (e.g., "funnel_stage", "buying_intent").

// Known columns with special names (typos, etc.)
const COLUMN_OVERRIDES: Record<string, string> = {
  resendid: 'resentid',  // DB has typo: "resentid" instead of "resendid"
}

// camelCase code key -> actual DB column name
function toColumnName(key: string): string {
  // snake_case keys pass through as-is (e.g., funnel_stage, buying_intent)
  if (key.includes('_')) return key
  return COLUMN_OVERRIDES[key.replace(/([A-Z])/g, (m) => m.toLowerCase())] ||
    key.replace(/([A-Z])/g, (m) => m.toLowerCase())
}

// Map all keys in a record for INSERT/UPDATE (code -> DB)
function mapKeys<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  const mapped: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    mapped[toColumnName(key)] = value
  }
  return mapped
}

// Map where clause keys (code -> DB)
function mapWhereKeys(where: WhereClause): WhereClause {
  const mapped: WhereClause = {}
  for (const [key, value] of Object.entries(where)) {
    mapped[toColumnName(key)] = value
  }
  return mapped
}

// Normalize response records: DB column names -> camelCase code keys
// Pre-built dictionary mapping lowercase DB column names to camelCase code field names
const SPLIT_MAP: Record<string, string> = {
  // Lead table
  'firstname': 'firstName', 'lastname': 'lastName', 'jobtitle': 'jobTitle',
  'companyname': 'companyName', 'companydomain': 'companyDomain',
  'linkedinurl': 'linkedInUrl', 'relevancescore': 'relevanceScore',
  'rawdata': 'rawData', 'targetproduct': 'targetProduct',
  'emailsent': 'emailSent', 'emailsentat': 'emailSentAt',
  'linkedindmsent': 'linkedinDmSent', 'followupcount': 'followUpCount',
  'lastfollowupat': 'lastFollowUpAt', 'lastengagementat': 'lastEngagementAt',
  'buyingintent': 'buyingIntent', 'opencount': 'openCount',
  'clickcount': 'clickCount', 'replycount': 'replyCount',
  // EmailOutreach table
  'leadid': 'leadId', 'sequenceid': 'sequenceId', 'stepnumber': 'stepNumber',
  'toemail': 'toEmail', 'toname': 'toName', 'errormessage': 'errorMessage',
  'sentat': 'sentAt', 'deliveredat': 'deliveredAt', 'openedat': 'openedAt',
  'clickedat': 'clickedAt', 'clickedurl': 'clickedUrl', 'repliedat': 'repliedAt',
  'replybody': 'replyBody', 'bouncedat': 'bouncedAt', 'resentid': 'resendId',
  // EmailSequence table
  'intervaldays': 'intervalDays', 'isactive': 'isActive',
  'totalsent': 'totalSent', 'totalreplies': 'totalReplies',
  'totalconversions': 'totalConversions',
  // PlanStep table
  'planid': 'planId', 'steporder': 'stepOrder', 'actionslug': 'actionSlug',
  'resultdata': 'resultData', 'planstepid': 'planStepId',
  // MarketingPlan table
  'rawresponse': 'rawResponse',
  // PostHistory table
  'poststatus': 'postStatus', 'postedurl': 'postedUrl', 'postedat': 'postedAt',
  'triggertype': 'triggerType',
  // AutoPostConfig table
  'postfrequency': 'postFrequency', 'posttime': 'postTime',
  'lastrunat': 'lastRunAt', 'nextrunat': 'nextRunAt',
  'lastrunstatus': 'lastRunStatus', 'lastrunmessage': 'lastRunMessage',
  // ContentPiece table
  'scheduledat': 'scheduledAt',
  // Generic timestamps
  'createdat': 'createdAt', 'updatedat': 'updatedAt',
}

function normalizeRecord(row: Record<string, unknown>): Record<string, unknown> {
  if (!row) return row
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    // Preserve id and snake_case keys as-is (e.g., funnel_stage, buying_intent, open_count)
    if (key === 'id' || key.includes('_')) {
      result[key] = value
      continue
    }
    // Look up in split map for lowercase-concatenated column names
    if (SPLIT_MAP[key]) {
      result[SPLIT_MAP[key]] = value
      continue
    }
    // Default: keep as-is for unmapped keys (e.g., description, tags, notes, etc.)
    result[key] = value
  }
  return result
}

function normalizeRecords<T>(rows: T[]): T[] {
  return rows.map(row => normalizeRecord(row as Record<string, unknown>) as unknown as T)
}

// ========== Helper types ==========

interface WhereClause {
  [key: string]: unknown
}

interface OrderByClause {
  [key: string]: 'asc' | 'desc'
}

interface QueryOptions {
  where?: WhereClause
  orderBy?: OrderByClause
  take?: number
  select?: string
  include?: Record<string, unknown>
}

// ========== Base CRUD operations ==========

async function findAll<T>(table: string, options: QueryOptions = {}): Promise<T[]> {
  let query = getSupabase().from(table).select(options.select || '*')

  if (options.where) {
    const mappedWhere = mapWhereKeys(options.where)
    for (const [key, value] of Object.entries(mappedWhere)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value)
      }
    }
  }

  if (options.orderBy) {
    for (const [key, direction] of Object.entries(options.orderBy)) {
      query = query.order(toColumnName(key), { ascending: direction === 'asc' })
    }
  }

  if (options.take) {
    query = query.limit(options.take)
  }

  const { data, error } = await query
  if (error) throw new Error(`Supabase findAll error on ${table}: ${error.message}`)
  return normalizeRecords<T>((data || []) as T[])
}

async function findById<T>(table: string, id: string): Promise<T | null> {
  const { data, error } = await getSupabase().from(table).select('*').eq('id', id).single()
  if (error) {
    if (error.code === 'PGRST116') return null // not found
    throw new Error(`Supabase findById error on ${table}: ${error.message}`)
  }
  return normalizeRecord(data as Record<string, unknown>) as T
}

async function findFirst<T>(table: string, options: QueryOptions = {}): Promise<T | null> {
  let query = getSupabase().from(table).select('*')

  if (options.where) {
    const mappedWhere = mapWhereKeys(options.where)
    for (const [key, value] of Object.entries(mappedWhere)) {
      if (value !== undefined && value !== null) {
        query = query.eq(key, value)
      }
    }
  }

  if (options.orderBy) {
    for (const [key, direction] of Object.entries(options.orderBy)) {
      query = query.order(toColumnName(key), { ascending: direction === 'asc' })
    }
  }

  query = query.limit(1)
  const { data, error } = await query
  if (error) throw new Error(`Supabase findFirst error on ${table}: ${error.message}`)
  return data && data.length > 0 ? normalizeRecord(data[0] as Record<string, unknown>) as T : null
}

async function create<T>(table: string, record: Record<string, unknown>): Promise<T> {
  if (!record.id) {
    record.id = cuid()
  }
  const mappedRecord = mapKeys(record)
  const { data, error } = await getSupabase().from(table).insert(mappedRecord).select('*').single()
  if (error) throw new Error(`Supabase create error on ${table}: ${error.message}`)
  return normalizeRecord(data as Record<string, unknown>) as T
}

async function createMany<T>(table: string, records: Record<string, unknown>[]): Promise<T[]> {
  const withIds = records.map(r => r.id ? r : { ...r, id: cuid() })
  const mappedRecords = withIds.map(r => mapKeys(r))
  const { data, error } = await getSupabase().from(table).insert(mappedRecords).select('*')
  if (error) throw new Error(`Supabase createMany error on ${table}: ${error.message}`)
  return normalizeRecords<T>((data || []) as T[])
}

async function update<T>(table: string, id: string, data: Record<string, unknown>): Promise<T> {
  const mappedData = mapKeys(data)
  const { data: result, error } = await getSupabase().from(table).update(mappedData).eq('id', id).select('*').single()
  if (error) throw new Error(`Supabase update error on ${table}: ${error.message}`)
  return normalizeRecord(result as Record<string, unknown>) as T
}

async function count(table: string, where?: WhereClause): Promise<number> {
  try {
    let query = getSupabase().from(table).select('id', { count: 'exact', head: true })
    if (where) {
      const mappedWhere = mapWhereKeys(where)
      for (const [key, value] of Object.entries(mappedWhere)) {
        if (value !== undefined && value !== null) {
          query = query.eq(key, value)
        }
      }
    }
    const { count: c, error } = await query
    if (error) throw new Error(`Supabase count error on ${table}: ${JSON.stringify(error)}`)
    return c || 0
  } catch (err: unknown) {
    // Fallback: count by fetching all IDs
    console.error(`Count fallback for ${table}:`, err)
    try {
      let query = getSupabase().from(table).select('id')
      if (where) {
        const mappedWhere = mapWhereKeys(where)
        for (const [key, value] of Object.entries(mappedWhere)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value)
          }
        }
      }
      const { data, error } = await query
      if (error) return 0
      return data?.length || 0
    } catch {
      return 0
    }
  }
}

async function remove(table: string, id: string): Promise<void> {
  const { error } = await getSupabase().from(table).delete().eq('id', id)
  if (error) throw new Error(`Supabase delete error on ${table}: ${error.message}`)
}

// ========== Table-specific interfaces ==========

export interface PlanStepRow {
  id: string
  planId: string
  stepOrder: number
  actionSlug: string
  platform: string
  product: string
  topic: string
  params: string
  status: string
  errorMessage?: string | null
  resultData?: string | null
  contentId?: string | null
  createdAt: string
  updatedAt: string
}

export interface MarketingPlanRow {
  id: string
  name: string
  goal: string
  status: string
  rawResponse?: string | null
  createdAt: string
  updatedAt: string
  steps?: PlanStepRow[]
}

export interface ContentPieceRow {
  id: string
  platform: string
  product: string
  topic: string
  title?: string | null
  body: string
  hashtags?: string | null
  scheduledAt?: string | null
  postedAt?: string | null
  postStatus: string
  postedUrl?: string | null
  externalId?: string | null
  errorMessage?: string | null
  planStepId?: string | null
  createdAt: string
  updatedAt: string
}

export interface PostHistoryRow {
  id: string
  platform: string
  product: string
  actionSlug: string
  title?: string | null
  body: string
  postedAt: string
  postedUrl?: string | null
  externalId?: string | null
  status: string
  errorMessage?: string | null
  triggerType: string
  createdAt: string
}

export interface AutoPostConfigRow {
  id: string
  enabled: boolean
  platforms: string
  products: string
  postFrequency: string
  postTime: string
  timezone: string
  lastRunAt?: string | null
  nextRunAt?: string | null
  lastRunStatus?: string | null
  lastRunMessage?: string | null
  createdAt: string
  updatedAt: string
}

export interface UserRow {
  id: string
  email: string
  name?: string | null
  createdAt: string
  updatedAt: string
}

export interface LeadRow {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  jobTitle?: string | null;
  companyName?: string | null;
  companyDomain?: string | null;
  linkedInUrl?: string | null;
  location?: string | null;
  seniority?: string | null;
  industry?: string | null;
  description?: string | null;
  source?: string | null;
  status?: string | null;
  score?: number | null;
  relevanceScore?: number | null;
  tags?: string | null;
  notes?: string | null;
  rawData?: string | null;
  phone?: string | null;
  website?: string | null;
  targetProduct?: string | null;
  emailSent?: boolean | null;
  emailSentAt?: string | null;
  linkedinDmSent?: boolean | null;
  followUpCount?: number | null;
  lastFollowUpAt?: string | null;
  // Revenue tracking fields
  funnelStage?: string | null;
  buyingIntent?: number | null;
  openCount?: number | null;
  clickCount?: number | null;
  replyCount?: number | null;
  lastEngagementAt?: string | null;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface EmailOutreachRow {
  id: string;
  leadId?: string | null;
  sequenceId?: string | null;
  stepNumber?: number | null;
  toEmail: string;
  toName?: string | null;
  subject?: string | null;
  body?: string | null;
  product?: string | null;
  status?: string | null;
  sentAt?: string | null;
  deliveredAt?: string | null;
  openedAt?: string | null;
  clickedAt?: string | null;
  clickedUrl?: string | null;
  repliedAt?: string | null;
  replyBody?: string | null;
  bouncedAt?: string | null;
  resendId?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmailSequenceRow {
  id: string;
  name: string;
  description?: string | null;
  product: string;
  steps: string; // JSON string
  intervalDays?: number | null;
  isActive?: boolean | null;
  totalSent?: number | null;
  totalReplies?: number | null;
  totalConversions?: number | null;
  createdAt: string;
  updatedAt: string;
}

// ========== Prisma-compatible db object ==========

export const db = {
  // ===== MarketingPlan =====
  marketingPlan: {
    async findMany(options: QueryOptions = {}): Promise<MarketingPlanRow[]> {
      const plans = await findAll<MarketingPlanRow>('marketingplan', {
        where: options.where,
        orderBy: options.orderBy || { createdAt: 'desc' },
        take: options.take,
      })

      // If include.steps is requested, fetch steps manually
      if (options.include?.steps) {
        for (const plan of plans) {
          const steps = await findAll<PlanStepRow>('planstep', {
            where: { planId: plan.id },
            orderBy: { stepOrder: 'asc' },
          })
          plan.steps = steps
        }
      }

      return plans
    },

    async findUnique(args: { where: { id: string } }): Promise<MarketingPlanRow | null> {
      return findById<MarketingPlanRow>('marketingplan', args.where.id)
    },

    async create(args: {
      data: Record<string, unknown>
      include?: Record<string, unknown>
    }): Promise<MarketingPlanRow> {
      const { steps, ...planData } = args.data as Record<string, unknown>
      const plan = await create<MarketingPlanRow>('marketingplan', planData as Record<string, unknown>)

      // If steps were provided, create them
      if (Array.isArray(steps)) {
        const stepsWithPlanId = steps.map((s: Record<string, unknown>) => ({
          ...s,
          planId: plan.id,
        }))
        const createdSteps = await createMany<PlanStepRow>('planstep', stepsWithPlanId)
        plan.steps = createdSteps
      }

      return plan
    },

    async update(args: {
      where: { id: string }
      data: Record<string, unknown>
    }): Promise<MarketingPlanRow> {
      return update<MarketingPlanRow>('marketingplan', args.where.id, args.data)
    },

    async count(where?: WhereClause): Promise<number> {
      return count('marketingplan', where)
    },
  },

  // ===== PlanStep =====
  planStep: {
    async findMany(options: QueryOptions = {}): Promise<PlanStepRow[]> {
      return findAll<PlanStepRow>('planstep', {
        where: options.where,
        orderBy: options.orderBy || { stepOrder: 'asc' },
      })
    },

    async findUnique(args: { where: { id: string } }): Promise<PlanStepRow | null> {
      return findById<PlanStepRow>('planstep', args.where.id)
    },

    async findFirst(options: QueryOptions = {}): Promise<PlanStepRow | null> {
      return findFirst<PlanStepRow>('planstep', options)
    },

    async create(args: { data: Record<string, unknown> }): Promise<PlanStepRow> {
      return create<PlanStepRow>('planstep', args.data)
    },

    async update(args: {
      where: { id: string }
      data: Record<string, unknown>
    }): Promise<PlanStepRow> {
      return update<PlanStepRow>('planstep', args.where.id, args.data)
    },

    async count(where?: WhereClause): Promise<number> {
      return count('planstep', where)
    },
  },

  // ===== ContentPiece =====
  contentPiece: {
    async findMany(options: QueryOptions = {}): Promise<ContentPieceRow[]> {
      return findAll<ContentPieceRow>('contentpiece', options)
    },

    async findUnique(args: { where: { id: string } }): Promise<ContentPieceRow | null> {
      return findById<ContentPieceRow>('contentpiece', args.where.id)
    },

    async findFirst(options: QueryOptions = {}): Promise<ContentPieceRow | null> {
      return findFirst<ContentPieceRow>('contentpiece', options)
    },

    async create(args: { data: Record<string, unknown> }): Promise<ContentPieceRow> {
      return create<ContentPieceRow>('contentpiece', args.data)
    },

    async update(args: {
      where: { id: string }
      data: Record<string, unknown>
    }): Promise<ContentPieceRow> {
      return update<ContentPieceRow>('contentpiece', args.where.id, args.data)
    },

    async count(where?: WhereClause): Promise<number> {
      return count('contentpiece', where)
    },
  },

  // ===== PostHistory =====
  postHistory: {
    async findMany(options: QueryOptions = {}): Promise<PostHistoryRow[]> {
      return findAll<PostHistoryRow>('posthistory', {
        where: options.where,
        orderBy: options.orderBy || { postedAt: 'desc' },
        take: options.take,
      })
    },

    async create(args: { data: Record<string, unknown> }): Promise<PostHistoryRow> {
      return create<PostHistoryRow>('posthistory', args.data)
    },

    async count(where?: WhereClause): Promise<number> {
      return count('posthistory', where)
    },
  },

  // ===== AutoPostConfig =====
  autoPostConfig: {
    async findFirst(options: QueryOptions = {}): Promise<AutoPostConfigRow | null> {
      return findFirst<AutoPostConfigRow>('autopostconfig', options)
    },

    async create(args: { data: Record<string, unknown> }): Promise<AutoPostConfigRow> {
      return create<AutoPostConfigRow>('autopostconfig', args.data)
    },

    async update(args: {
      where: { id: string }
      data: Record<string, unknown>
    }): Promise<AutoPostConfigRow> {
      return update<AutoPostConfigRow>('autopostconfig', args.where.id, args.data)
    },
  },

  // ===== AppUser (was "User" but renamed to avoid PostgreSQL reserved keyword) =====
  user: {
    async findMany(options: QueryOptions = {}): Promise<UserRow[]> {
      return findAll<UserRow>('appuser', options)
    },

    async findUnique(args: { where: { id: string } | { email: string } }): Promise<UserRow | null> {
      if ('id' in args.where) return findById<UserRow>('appuser', args.where.id)
      return findFirst<UserRow>('appuser', { where: { email: args.where.email } })
    },

    async create(args: { data: Record<string, unknown> }): Promise<UserRow> {
      return create<UserRow>('appuser', args.data)
    },

    async count(where?: WhereClause): Promise<number> {
      return count('appuser', where)
    },
  },

  // ===== Lead =====
  lead: {
    async findMany(options: QueryOptions = {}): Promise<LeadRow[]> {
      return findAll<LeadRow>('lead', {
        where: options.where,
        orderBy: options.orderBy || { createdAt: 'desc' },
        take: options.take,
      })
    },

    async findUnique(args: { where: { id: string } | { email: string } }): Promise<LeadRow | null> {
      if ('id' in args.where) return findById<LeadRow>('lead', args.where.id)
      return findFirst<LeadRow>('lead', { where: { email: args.where.email } })
    },

    async findFirst(options: QueryOptions = {}): Promise<LeadRow | null> {
      return findFirst<LeadRow>('lead', options)
    },

    async create(args: { data: Record<string, unknown> }): Promise<LeadRow> {
      return create<LeadRow>('lead', args.data)
    },

    async createMany(args: { data: Record<string, unknown>[] }): Promise<LeadRow[]> {
      return createMany<LeadRow>('lead', args.data)
    },

    async update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<LeadRow> {
      return update<LeadRow>('lead', args.where.id, { ...args.data, updatedAt: new Date().toISOString() })
    },

    async count(where?: WhereClause): Promise<number> {
      return count('lead', where)
    },

    async remove(id: string): Promise<void> {
      return remove('lead', id)
    },
  },

  // ===== EmailOutreach =====
  emailOutreach: {
    async findMany(options: QueryOptions = {}): Promise<EmailOutreachRow[]> {
      return findAll<EmailOutreachRow>('emailoutreach', {
        where: options.where,
        orderBy: options.orderBy || { createdAt: 'desc' },
        take: options.take,
      })
    },

    async findUnique(args: { where: { id: string } }): Promise<EmailOutreachRow | null> {
      return findById<EmailOutreachRow>('emailoutreach', args.where.id)
    },

    async findFirst(options: QueryOptions = {}): Promise<EmailOutreachRow | null> {
      return findFirst<EmailOutreachRow>('emailoutreach', options)
    },

    async create(args: { data: Record<string, unknown> }): Promise<EmailOutreachRow> {
      return create<EmailOutreachRow>('emailoutreach', args.data)
    },

    async update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<EmailOutreachRow> {
      return update<EmailOutreachRow>('emailoutreach', args.where.id, { ...args.data, updatedAt: new Date().toISOString() })
    },

    async count(where?: WhereClause): Promise<number> {
      return count('emailoutreach', where)
    },
  },

  // ===== EmailSequence =====
  emailSequence: {
    async findMany(options: QueryOptions = {}): Promise<EmailSequenceRow[]> {
      return findAll<EmailSequenceRow>('emailsequence', {
        where: options.where,
        orderBy: options.orderBy || { createdAt: 'desc' },
        take: options.take,
      })
    },

    async findUnique(args: { where: { id: string } }): Promise<EmailSequenceRow | null> {
      return findById<EmailSequenceRow>('emailsequence', args.where.id)
    },

    async findFirst(options: QueryOptions = {}): Promise<EmailSequenceRow | null> {
      return findFirst<EmailSequenceRow>('emailsequence', options)
    },

    async create(args: { data: Record<string, unknown> }): Promise<EmailSequenceRow> {
      return create<EmailSequenceRow>('emailsequence', args.data)
    },

    async update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<EmailSequenceRow> {
      return update<EmailSequenceRow>('emailsequence', args.where.id, { ...args.data, updatedAt: new Date().toISOString() })
    },

    async count(where?: WhereClause): Promise<number> {
      return count('emailsequence', where)
    },
  },
}
