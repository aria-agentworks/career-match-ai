// Explee Lead Discovery API Wrapper
// Docs: https://api.explee.com

const EXPLEE_BASE_URL = "https://api.explee.com";

function getApiKey(): string {
  const key = process.env.EXPLEE_API_KEY;
  if (!key) {
    throw new Error("EXPLEE_API_KEY environment variable is not set");
  }
  return key;
}

async function expleeRequest<T>(
  endpoint: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
  } = {}
): Promise<T> {
  const apiKey = getApiKey();
  const { method = "POST", body } = options;

  const headers: Record<string, string> = {
    "X-API-Key": apiKey,
    "Content-Type": "application/json",
  };

  const response = await fetch(`${EXPLEE_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `Explee API error (${response.status}): ${errorText}`
    );
  }

  return response.json() as Promise<T>;
}

// ==================== TYPES ====================

export interface CompanyResult {
  name: string;
  domain: string;
  description?: string;
  industry?: string;
  employees?: string;
  location?: string;
  website?: string;
  linkedin_url?: string;
  founded_year?: number;
  technologies?: string[];
  [key: string]: unknown;
}

export interface PeopleResult {
  first_name: string;
  last_name: string;
  full_name?: string;
  email?: string;
  job_title?: string;
  company?: string;
  company_domain?: string;
  seniority?: string;
  department?: string;
  location?: string;
  linkedin_url?: string;
  photo_url?: string;
  [key: string]: unknown;
}

export interface SearchCompaniesResponse {
  success?: boolean;
  companies?: CompanyResult[];
  results?: CompanyResult[];
  total?: number;
  limit?: number;
  offset?: number;
}

export interface SearchPeopleResponse {
  success?: boolean;
  people?: PeopleResult[];
  results?: PeopleResult[];
  total?: number;
  limit?: number;
  offset?: number;
}

export interface FindEmailResponse {
  email: string;
  email_status: "valid" | "invalid" | "unknown" | "risky";
  meta?: {
    credits_charged: number;
    remaining_balance: number;
  };
  [key: string]: unknown;
}

export interface BatchFindEmailResponse {
  task_id: string;
  status: string;
  [key: string]: unknown;
}

export interface BatchEmailStatusResponse {
  task_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  results?: Array<{
    first_name: string;
    last_name: string;
    company_domain: string;
    email?: string;
    email_status?: string;
    error?: string;
  }>;
  progress?: {
    total: number;
    completed: number;
    failed: number;
  };
  [key: string]: unknown;
}

export interface NlToFiltersResponse {
  focus: "people" | "companies" | "both";
  companies_filters?: Record<string, unknown>;
  people_filters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface CompanyFilters {
  definition?: string;
  industries?: string[];
  locations?: string[];
  employees_range?: string;
  technologies?: string[];
  keywords?: string[];
  revenue_range?: string;
  [key: string]: unknown;
}

export interface PeopleFilters {
  job_titles?: string[];
  seniority?: string[];
  departments?: string[];
  locations?: string[];
  [key: string]: unknown;
}

// ==================== API FUNCTIONS ====================

/**
 * Search for companies matching a definition.
 * First 100 results are free.
 */
export async function searchCompanies(
  definition: string,
  filters?: CompanyFilters,
  limit: number = 20
): Promise<SearchCompaniesResponse> {
  // Explee API expects a filters object with definition inside
  return expleeRequest<SearchCompaniesResponse>(
    "/public/api/v1/search/companies",
    {
      method: "POST",
      body: {
        filters: {
          definition,
          ...filters,
        },
        limit,
      },
    }
  );
}

/**
 * Search for people at companies matching filters.
 * First 100 results are free.
 */
export async function searchPeople(
  jobTitles: string[],
  companyDefinition?: string,
  filters?: {
    peopleFilters?: PeopleFilters;
    companyFilters?: CompanyFilters;
  },
  limit: number = 20
): Promise<SearchPeopleResponse> {
  const peopleFilters: Record<string, unknown> = {
    ...filters?.peopleFilters,
  };
  if (jobTitles.length > 0) {
    peopleFilters.job_titles = jobTitles;
  }

  const companyFilters: Record<string, unknown> = {
    ...filters?.companyFilters,
  };
  if (companyDefinition) {
    companyFilters.definition = companyDefinition;
  }

  // Explee API expects people_filters and company_filters at top level
  return expleeRequest<SearchPeopleResponse>(
    "/public/api/v1/search/people",
    {
      method: "POST",
      body: {
        people_filters: peopleFilters,
        company_filters: companyFilters,
        limit,
      },
    }
  );
}

/**
 * Find people at specific company domains.
 */
export async function searchPeopleByDomains(
  domains: string[],
  jobTitles?: string[],
  peoplePerCompany: number = 3
): Promise<SearchPeopleResponse> {
  return expleeRequest<SearchPeopleResponse>(
    "/public/api/v1/search/people-by-domains",
    {
      method: "POST",
      body: {
        domains,
        job_titles: jobTitles || [],
        people_per_company: peoplePerCompany,
      },
    }
  );
}

/**
 * Find email address for a specific person.
 * Charges credits per lookup.
 */
export async function findEmail(
  firstName: string,
  lastName: string,
  companyDomain: string,
  preset: string = "basic"
): Promise<FindEmailResponse> {
  return expleeRequest<FindEmailResponse>(
    "/public/api/v1/enrich/email",
    {
      method: "POST",
      body: {
        first_name: firstName,
        last_name: lastName,
        company_domain: companyDomain,
        preset,
      },
    }
  );
}

/**
 * Batch find email addresses (async).
 * Returns a task_id that can be polled.
 */
export async function batchFindEmail(
  contacts: Array<{
    first_name: string;
    last_name: string;
    company_domain: string;
  }>,
  preset: string = "basic"
): Promise<BatchFindEmailResponse> {
  return expleeRequest<BatchFindEmailResponse>(
    "/public/api/v1/enrich/email/batch",
    {
      method: "POST",
      body: {
        contacts,
        preset,
      },
    }
  );
}

/**
 * Check the status of a batch email lookup task.
 */
export async function getBatchStatus(
  taskId: string
): Promise<BatchEmailStatusResponse> {
  const apiKey = getApiKey();
  const response = await fetch(`${EXPLEE_BASE_URL}/public/api/v1/enrich/email/batch/${taskId}`, {
    method: "GET",
    headers: {
      "X-API-Key": apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(`Explee API error (${response.status}): ${errorText}`);
  }

  return response.json() as Promise<BatchEmailStatusResponse>;
}

/**
 * Convert a natural language query to structured search filters.
 */
export async function nlToFilters(
  query: string
): Promise<NlToFiltersResponse> {
  return expleeRequest<NlToFiltersResponse>(
    "/public/api/v1/search/nl-to-filters",
    {
      method: "POST",
      body: {
        query,
      },
    }
  );
}
