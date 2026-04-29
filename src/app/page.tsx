"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Brain,
  Play,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Settings,
  BarChart3,
  FileText,
  Calendar,
  RefreshCw,
  Zap,
  ExternalLink,
  ChevronRight,
  Globe,
  Wifi,
  WifiOff,
  Trash2,
  Eye,
  Pencil,
  Users,
  Mail,
  Search,
  Copy,
  GitBranch,
  MessageSquarePlus,
  Save,
  Check,
  X,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Types
interface PlanStep {
  id: string;
  order: number;
  actionSlug: string;
  platform: string;
  product: string;
  topic: string;
  status: string;
}

interface Plan {
  id: string;
  name: string;
  goal: string;
  status: string;
  steps: PlanStep[];
  createdAt?: string;
}

interface PostHistoryItem {
  id: string;
  platform: string;
  product: string;
  actionSlug: string;
  title?: string;
  body: string;
  postedAt: string;
  postedUrl?: string;
  status: string;
  errorMessage?: string;
  triggerType: string;
}

interface HealthData {
  composioConfigured: boolean;
  products: { id: string; name: string }[];
  connectedAccounts: { count: number; accounts: unknown[]; error: string | null };
  availableTools: { count: number; tools: unknown[]; error: string | null };
  stats: {
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    totalPlans: number;
    completedPlans: number;
    draftPosts: number;
  };
  autoPost: {
    enabled: boolean;
    lastRunAt: string | null;
    lastRunStatus: string | null;
    lastRunMessage: string | null;
  } | null;
}

interface LeadResult {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  name?: string;
  email?: string;
  job_title?: string;
  company?: string;
  company_domain?: string;
  domain?: string;
  seniority?: string;
  location?: string;
  linkedin_url?: string;
  industry?: string;
  employees?: string;
  description?: string;
  [key: string]: unknown;
}

interface BatchEmailResult {
  first_name: string;
  last_name: string;
  company_domain: string;
  email?: string;
  email_status?: string;
  error?: string;
}

interface DraftItem {
  id: string;
  platform: string;
  product: string;
  topic: string;
  title?: string;
  body: string;
  postStatus: string;
  createdAt: string;
}

interface SavedLead {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  companyDomain?: string | null;
  linkedinUrl?: string | null;
  location?: string | null;
  seniority?: string | null;
  industry?: string | null;
  status?: string | null;
  score?: number | null;
  tags?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SequenceData {
  id: string;
  name: string;
  description?: string | null;
  product: string;
  steps: string;
  intervalDays?: number | null;
  isActive?: boolean | null;
  totalSent?: number | null;
  totalReplies?: number | null;
  totalConversions?: number | null;
  createdAt: string;
}

interface SequenceStep {
  stepNumber: number;
  subject: string;
  body: string;
  waitDays: number;
}

// Platform colors
const platformColors: Record<string, string> = {
  twitter: "bg-black text-white dark:bg-white dark:text-black",
  linkedin: "bg-blue-600 text-white",
  devto: "bg-gray-900 text-white",
  reddit: "bg-orange-600 text-white",
  slack: "bg-purple-700 text-white",
};

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  running: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  completed: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  skipped: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const pipelineStatusColors: Record<string, string> = {
  new: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  contacted: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  replied: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  interested: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  converted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  lost: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  unsubscribed: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

interface EmailHistoryItem {
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
  resendId?: string | null;
  errorMessage?: string | null;
  createdAt: string;
}

const PRODUCTS = [
  "AriaAgent",
  "SalesIntelligenceMCP",
  "SaaSAuditScanner",
  "DateWise",
  "SparkBill",
  "NaiveVoiceAgent",
  "NaiveLandingPage",
];

const PLATFORMS = [
  { value: "twitter", label: "Twitter/X" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "devto", label: "Dev.to" },
  { value: "reddit", label: "Reddit" },
  { value: "slack", label: "Slack" },
];

export default function MarketingHub() {
  const [activeTab, setActiveTab] = useState("brain");
  const [loading, setLoading] = useState(false);

  // Brain state
  const [brainGoal, setBrainGoal] = useState("");
  const [brainProducts, setBrainProducts] = useState<string[]>(["AriaAgent"]);
  const [brainPlatforms, setBrainPlatforms] = useState<string[]>(["twitter", "linkedin"]);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<Plan | null>(null);

  // Plans state
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [executingPlanId, setExecutingPlanId] = useState<string | null>(null);

  // Create Post state
  const [postPlatform, setPostPlatform] = useState("twitter");
  const [postProduct, setPostProduct] = useState("AriaAgent");
  const [postTopic, setPostTopic] = useState("");
  const [customContent, setCustomContent] = useState("");
  const [generatingContent, setGeneratingContent] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<{
    id: string;
    body: string;
    title?: string;
    platform: string;
    product: string;
    postStatus: string;
    actionSlug: string;
  } | null>(null);

  // History state
  const [history, setHistory] = useState<PostHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Drafts state
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [publishingDraftId, setPublishingDraftId] = useState<string | null>(null);

  // Settings state
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoPlatforms, setAutoPlatforms] = useState("twitter,linkedin");
  const [autoProducts, setAutoProducts] = useState("AriaAgent");
  const [autoFrequency, setAutoFrequency] = useState("daily");
  const [autoTime, setAutoTime] = useState("09:00");
  const [savingConfig, setSavingConfig] = useState(false);

  // Leads state
  const [leadsQuery, setLeadsQuery] = useState("");
  const [leadsType, setLeadsType] = useState<"companies" | "people" | "domains">("people");
  const [leadsDomains, setLeadsDomains] = useState("");
  const [leadsJobTitles, setLeadsJobTitles] = useState("");
  const [leadsLimit, setLeadsLimit] = useState(20);
  const [leadsResults, setLeadsResults] = useState<LeadResult[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [findingEmailIndex, setFindingEmailIndex] = useState<number | null>(null);

  // Batch email state
  const [batchContacts, setBatchContacts] = useState("");
  const [batchTaskId, setBatchTaskId] = useState<string | null>(null);
  const [batchStatus, setBatchStatus] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<BatchEmailResult[]>([]);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchPolling, setBatchPolling] = useState(false);

  // Pipeline state
  const [savedLeads, setSavedLeads] = useState<SavedLead[]>([]);
  const [loadingSavedLeads, setLoadingSavedLeads] = useState(false);
  const [pipelineCounts, setPipelineCounts] = useState<Record<string, number>>({});
  const [pipelineSearch, setPipelineSearch] = useState("");
  const [pipelineStatusFilter, setPipelineStatusFilter] = useState<string | null>(null);
  const [savingLeads, setSavingLeads] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerLead, setComposerLead] = useState<SavedLead | null>(null);
  const [composerSubject, setComposerSubject] = useState("");
  const [composerBody, setComposerBody] = useState("");
  const [composerProduct, setComposerProduct] = useState("AriaAgent");
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);

  // Sequences state
  const [sequences, setSequences] = useState<SequenceData[]>([]);
  const [loadingSequences, setLoadingSequences] = useState(false);
  const [seqProduct, setSeqProduct] = useState("AriaAgent");
  const [seqGoal, setSeqGoal] = useState("");
  const [seqStepCount, setSeqStepCount] = useState(4);
  const [generatingSequence, setGeneratingSequence] = useState(false);
  const [executeSeqId, setExecuteSeqId] = useState<string | null>(null);
  const [executeLeadIds, setExecuteLeadIds] = useState<string[]>([]);
  const [executingSequence, setExecutingSequence] = useState(false);

  // Email history state
  const [emailHistory, setEmailHistory] = useState<EmailHistoryItem[]>([]);
  const [loadingEmailHistory, setLoadingEmailHistory] = useState(false);

  // Health state
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);

  // Orchestrator state
  const [orchestratorRunning, setOrchestratorRunning] = useState(false);
  const [orchestratorResult, setOrchestratorResult] = useState<{
    timestamp: string;
    stats: Record<string, number>;
    details: Array<{ product: string; action: string; count: number; message: string }>;
    errors: string[];
  } | null>(null);

  // Run full orchestrator
  const handleRunOrchestrator = async () => {
    setOrchestratorRunning(true);
    try {
      const res = await fetch("/api/automations/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: "All", phase: "all", discoverLimit: 5 }),
      });
      const data = await res.json();
      if (data.success) {
        setOrchestratorResult(data);
        toast({
          title: "Autopilot Complete",
          description: `Discovered: ${data.stats.discovered}, Enriched: ${data.stats.enriched}, Emailed: ${data.stats.emailed}, Follow-ups: ${data.stats.followedUp}`
        });
        // Refresh data
        loadSavedLeads();
        loadEmailHistory();
      } else {
        toast({ title: "Autopilot Error", description: data.error || "Failed to run", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to run autopilot", variant: "destructive" });
    } finally {
      setOrchestratorRunning(false);
    }
  };

  // Run specific phase
  const handleRunPhase = async (phase: string) => {
    setOrchestratorRunning(true);
    try {
      const res = await fetch("/api/automations/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: "All", phase, discoverLimit: 5 }),
      });
      const data = await res.json();
      if (data.success) {
        setOrchestratorResult(data);
        toast({
          title: `Phase "${phase}" Complete`,
          description: data.details?.map((d: { message: string }) => d.message).join(", ") || "Done"
        });
        loadSavedLeads();
        loadEmailHistory();
      } else {
        toast({ title: "Error", description: data.error || "Phase failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to run phase", variant: "destructive" });
    } finally {
      setOrchestratorRunning(false);
    }
  };

  // Load health data
  const loadHealth = useCallback(async () => {
    try {
      setLoadingHealth(true);
      const res = await fetch("/api/health");
      const data = await res.json();
      if (data.success) setHealth(data.system);
    } catch {
      toast({ title: "Error", description: "Failed to load system health", variant: "destructive" });
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  // Load plans
  const loadPlans = useCallback(async () => {
    try {
      setLoadingPlans(true);
      const res = await fetch("/api/plans");
      const data = await res.json();
      if (data.success) setPlans(data.plans);
    } catch {
      // silent
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  // Load history
  const loadHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch("/api/posts/history");
      const data = await res.json();
      if (data.success) setHistory(data.history);
    } catch {
      // silent
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  // Load drafts
  const loadDrafts = useCallback(async () => {
    try {
      setLoadingDrafts(true);
      const res = await fetch("/api/posts/drafts");
      const data = await res.json();
      if (data.success) setDrafts(data.drafts);
    } catch {
      // silent
    } finally {
      setLoadingDrafts(false);
    }
  }, []);

  // Load saved leads
  const loadSavedLeads = useCallback(async () => {
    try {
      setLoadingSavedLeads(true);
      const params = new URLSearchParams();
      if (pipelineStatusFilter) params.set("status", pipelineStatusFilter);
      if (pipelineSearch) params.set("search", pipelineSearch);
      const res = await fetch(`/api/leads/saved?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setSavedLeads(data.leads);
        setPipelineCounts(data.counts);
      }
    } catch {
      // silent
    } finally {
      setLoadingSavedLeads(false);
    }
  }, [pipelineStatusFilter, pipelineSearch]);

  // Load sequences
  const loadSequences = useCallback(async () => {
    try {
      setLoadingSequences(true);
      const res = await fetch("/api/outreach/sequences");
      const data = await res.json();
      if (data.success) setSequences(data.sequences);
    } catch {
      // silent
    } finally {
      setLoadingSequences(false);
    }
  }, []);

  // Load email history
  const loadEmailHistory = useCallback(async () => {
    try {
      setLoadingEmailHistory(true);
      const res = await fetch("/api/outreach/history?limit=50");
      const data = await res.json();
      if (data.success) setEmailHistory(data.outreach);
    } catch {
      // silent
    } finally {
      setLoadingEmailHistory(false);
    }
  }, []);

  // Load config
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (data.success && data.config) {
        setAutoEnabled(data.config.enabled);
        setAutoPlatforms(data.config.platforms);
        setAutoProducts(data.config.products);
        setAutoFrequency(data.config.postFrequency);
        setAutoTime(data.config.postTime);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadHealth();
    loadPlans();
    loadHistory();
    loadDrafts();
    loadConfig();
    loadSavedLeads();
    loadSequences();
    loadEmailHistory();
  }, [loadHealth, loadPlans, loadHistory, loadDrafts, loadConfig, loadSavedLeads, loadSequences, loadEmailHistory]);

  // Handle generate plan
  const handleGeneratePlan = async () => {
    if (!brainGoal.trim()) {
      toast({ title: "Enter a goal", description: "Tell the Brain what you want to achieve", variant: "destructive" });
      return;
    }
    setGeneratingPlan(true);
    try {
      const res = await fetch("/api/brain/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: brainGoal,
          products: brainProducts,
          platforms: brainPlatforms,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedPlan(data.plan);
        toast({ title: "Plan Generated", description: `${data.plan.steps.length} steps created` });
        loadPlans();
      } else {
        toast({ title: "Error", description: data.error || "Failed to generate plan", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate plan", variant: "destructive" });
    } finally {
      setGeneratingPlan(false);
    }
  };

  // Handle execute plan
  const handleExecutePlan = async (planId: string) => {
    setExecutingPlanId(planId);
    try {
      const res = await fetch("/api/execute/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (data.success) {
        const { result } = data;
        toast({
          title: "Plan Executed",
          description: `${result.succeeded} succeeded, ${result.failed} failed, ${result.skipped} skipped`,
        });
        loadPlans();
        loadHistory();
      } else {
        toast({ title: "Error", description: data.error || "Execution failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Execution failed", variant: "destructive" });
    } finally {
      setExecutingPlanId(null);
    }
  };

  // Handle generate content
  const handleGenerateContent = async () => {
    setGeneratingContent(true);
    setGeneratedContent(null);
    try {
      const res = await fetch("/api/brain/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: postPlatform,
          product: postProduct,
          topic: postTopic || `${postProduct} tip`,
          publishImmediately: false,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedContent(data.content);
        toast({ title: "Content Generated", description: "Ready to review and publish" });
      } else {
        toast({ title: "Error", description: data.error || "Failed to generate", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate content", variant: "destructive" });
    } finally {
      setGeneratingContent(false);
    }
  };

  // Handle publish generated content
  const handlePublishGenerated = async () => {
    if (!generatedContent) return;
    setGeneratingContent(true);
    try {
      const res = await fetch("/api/posts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: postPlatform,
          product: postProduct,
          topic: postTopic,
          customContent: generatedContent.body,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({
          title: "Published!",
          description: data.postedUrl ? `Posted at ${data.postedUrl}` : "Content published successfully",
        });
        setGeneratedContent(null);
        setPostTopic("");
        loadHistory();
        loadHealth();
      } else {
        toast({ title: "Failed", description: data.error || "Publishing failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to publish", variant: "destructive" });
    } finally {
      setGeneratingContent(false);
    }
  };

  // Handle publish draft
  const handlePublishDraft = async (contentId: string) => {
    setPublishingDraftId(contentId);
    try {
      const res = await fetch("/api/posts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Published!", description: data.postedUrl ? `Posted at ${data.postedUrl}` : "Draft published" });
        loadDrafts();
        loadHistory();
        loadHealth();
      } else {
        toast({ title: "Failed", description: data.error || "Publishing failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to publish draft", variant: "destructive" });
    } finally {
      setPublishingDraftId(null);
    }
  };

  // Handle save config
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: autoEnabled,
          platforms: autoPlatforms,
          products: autoProducts,
          postFrequency: autoFrequency,
          postTime: autoTime,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Settings Saved", description: autoEnabled ? "Auto-posting enabled" : "Auto-posting disabled" });
        loadHealth();
      }
    } catch {
      toast({ title: "Error", description: "Failed to save config", variant: "destructive" });
    } finally {
      setSavingConfig(false);
    }
  };

  // Toggle product selection for Brain
  const toggleProduct = (product: string) => {
    setBrainProducts((prev) =>
      prev.includes(product) ? prev.filter((p) => p !== product) : [...prev, product]
    );
  };

  // Toggle platform selection for Brain
  const togglePlatform = (platform: string) => {
    setBrainPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  // Handle leads search
  const handleLeadsSearch = async () => {
    if (leadsType === "domains") {
      if (!leadsDomains.trim()) {
        toast({ title: "Enter domains", description: "Provide at least one domain (comma-separated)", variant: "destructive" });
        return;
      }
    } else if (!leadsQuery.trim()) {
      toast({ title: "Enter a query", description: "Describe the companies or people you're looking for", variant: "destructive" });
      return;
    }
    setLeadsLoading(true);
    setLeadsResults([]);
    try {
      const domains = leadsType === "domains"
        ? leadsDomains.split(",").map((d) => d.trim()).filter(Boolean)
        : undefined;
      const jobTitles = leadsJobTitles
        ? leadsJobTitles.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined;
      const res = await fetch("/api/leads/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: leadsQuery || undefined,
          type: leadsType,
          domains,
          jobTitles,
          limit: leadsLimit,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setLeadsResults(data.results || []);
        toast({ title: "Leads Found", description: `${data.count} results returned` });
      } else {
        toast({ title: "Search Failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to search leads", variant: "destructive" });
    } finally {
      setLeadsLoading(false);
    }
  };

  // Handle find email for a single lead
  const handleFindEmail = async (index: number) => {
    const lead = leadsResults[index];
    const firstName = lead.first_name || "";
    const lastName = lead.last_name || "";
    const domain = lead.company_domain || lead.domain || "";
    if (!firstName || !lastName || !domain) {
      toast({ title: "Missing Info", description: "Need first name, last name, and company domain to find email", variant: "destructive" });
      return;
    }
    setFindingEmailIndex(index);
    try {
      const res = await fetch("/api/leads/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, companyDomain: domain }),
      });
      const data = await res.json();
      if (data.success && data.email) {
        const updated = [...leadsResults];
        updated[index] = { ...updated[index], email: data.email };
        setLeadsResults(updated);
        toast({ title: "Email Found", description: `${data.email} (${data.emailStatus})` });
      } else {
        toast({ title: "Email Not Found", description: data.error || "Could not find email for this person", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to find email", variant: "destructive" });
    } finally {
      setFindingEmailIndex(null);
    }
  };

  // Handle batch email submit
  const handleBatchSubmit = async () => {
    if (!batchContacts.trim()) {
      toast({ title: "Enter contacts", description: "Provide contacts in JSON format", variant: "destructive" });
      return;
    }
    let contacts: Array<{ first_name: string; last_name: string; company_domain: string }>;
    try {
      contacts = JSON.parse(batchContacts);
      if (!Array.isArray(contacts) || contacts.length === 0) throw new Error("Must be a non-empty array");
    } catch {
      toast({ title: "Invalid JSON", description: "Contacts must be a JSON array of {first_name, last_name, company_domain}", variant: "destructive" });
      return;
    }
    setBatchSubmitting(true);
    setBatchTaskId(null);
    setBatchResults([]);
    setBatchStatus(null);
    try {
      const res = await fetch("/api/leads/email-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts }),
      });
      const data = await res.json();
      if (data.success) {
        setBatchTaskId(data.taskId);
        setBatchStatus(data.status);
        toast({ title: "Batch Submitted", description: `Task ID: ${data.taskId}` });
      } else {
        toast({ title: "Batch Failed", description: data.error || "Unknown error", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to submit batch", variant: "destructive" });
    } finally {
      setBatchSubmitting(false);
    }
  };

  // Poll batch status
  const pollBatchStatus = useCallback(async () => {
    if (!batchTaskId) return;
    setBatchPolling(true);
    try {
      const res = await fetch(`/api/leads/email-batch?taskId=${encodeURIComponent(batchTaskId)}`);
      const data = await res.json();
      if (data.success) {
        setBatchStatus(data.status);
        setBatchResults(data.results || []);
        if (data.status === "completed" || data.status === "failed") {
          setBatchPolling(false);
          return;
        }
        setTimeout(pollBatchStatus, 3000);
      }
    } catch {
      setBatchPolling(false);
    }
  }, [batchTaskId]);

  // Auto-poll when taskId changes
  useEffect(() => {
    if (batchTaskId) {
      pollBatchStatus();
    }
  }, [batchTaskId, pollBatchStatus]);

  // Handle save leads to pipeline
  const handleSaveLeads = async () => {
    if (leadsResults.length === 0) return;
    setSavingLeads(true);
    try {
      const leadsToSave = leadsResults.map((r) => ({
        firstName: r.first_name || null,
        lastName: r.last_name || null,
        email: r.email || null,
        jobTitle: r.job_title || null,
        company: r.company || null,
        companyDomain: r.company_domain || r.domain || null,
        linkedinUrl: r.linkedin_url || null,
        location: r.location || null,
        seniority: r.seniority || null,
        industry: r.industry || null,
        description: r.description || null,
        source: "explee",
      }));
      const res = await fetch("/api/leads/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leads: leadsToSave }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Leads Saved", description: `${data.counts.saved} saved, ${data.counts.skipped} skipped` });
        loadSavedLeads();
      } else {
        toast({ title: "Error", description: data.error || "Failed to save leads", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to save leads", variant: "destructive" });
    } finally {
      setSavingLeads(false);
    }
  };

  // Handle generate AI email
  const handleGenerateEmail = async (lead: SavedLead) => {
    setGeneratingEmail(true);
    try {
      const res = await fetch("/api/outreach/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead.id, product: composerProduct }),
      });
      const data = await res.json();
      if (data.success) {
        setComposerSubject(data.subject);
        setComposerBody(data.body);
      } else {
        toast({ title: "Error", description: data.error || "Failed to generate email", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to generate email", variant: "destructive" });
    } finally {
      setGeneratingEmail(false);
    }
  };

  // Handle send email
  const handleSendEmail = async () => {
    if (!composerLead?.email || !composerSubject || !composerBody) return;
    setSendingEmail(true);
    try {
      const res = await fetch("/api/outreach/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: composerLead.email,
          toName: `${composerLead.firstName || ""} ${composerLead.lastName || ""}`.trim(),
          subject: composerSubject,
          body: composerBody,
          product: composerProduct,
          leadId: composerLead.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Email Sent", description: `Email sent to ${composerLead.email}` });
        setComposerOpen(false);
        setComposerLead(null);
        setComposerSubject("");
        setComposerBody("");
        loadSavedLeads();
        loadEmailHistory();
      } else {
        toast({ title: "Failed", description: data.error || "Failed to send email", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to send email", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  // Handle update lead status
  const handleUpdateLeadStatus = async (leadId: string, newStatus: string) => {
    setUpdatingLeadId(leadId);
    try {
      const res = await fetch(`/api/leads/saved/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        loadSavedLeads();
      } else {
        toast({ title: "Error", description: data.error || "Failed to update", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to update lead", variant: "destructive" });
    } finally {
      setUpdatingLeadId(null);
    }
  };

  // Handle delete lead
  const handleDeleteLead = async (leadId: string) => {
    setDeletingLeadId(leadId);
    try {
      const res = await fetch(`/api/leads/saved/${leadId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Deleted", description: "Lead removed from pipeline" });
        loadSavedLeads();
      }
    } catch {
      toast({ title: "Error", description: "Failed to delete lead", variant: "destructive" });
    } finally {
      setDeletingLeadId(null);
    }
  };

  // Handle create sequence
  const handleCreateSequence = async () => {
    if (!seqGoal.trim()) {
      toast({ title: "Enter a goal", description: "Describe the outreach goal", variant: "destructive" });
      return;
    }
    setGeneratingSequence(true);
    try {
      const res = await fetch("/api/outreach/sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: seqProduct, goal: seqGoal, stepCount: seqStepCount }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Sequence Created", description: `${data.sequence.steps.length} steps generated` });
        setSeqGoal("");
        loadSequences();
      } else {
        toast({ title: "Error", description: data.error || "Failed to create sequence", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to create sequence", variant: "destructive" });
    } finally {
      setGeneratingSequence(false);
    }
  };

  // Handle execute sequence
  const handleExecuteSequence = async (sequenceId: string, leadIds: string[]) => {
    if (leadIds.length === 0) {
      toast({ title: "No leads selected", description: "Select at least one lead", variant: "destructive" });
      return;
    }
    setExecutingSequence(true);
    try {
      const res = await fetch("/api/outreach/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequenceId, leadIds }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Sequence Executed", description: `${data.sentCount} emails sent, ${data.failedCount} failed` });
        setExecuteSeqId(null);
        setExecuteLeadIds([]);
        loadSavedLeads();
        loadSequences();
        loadEmailHistory();
      } else {
        toast({ title: "Error", description: data.error || "Execution failed", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "Failed to execute sequence", variant: "destructive" });
    } finally {
      setExecutingSequence(false);
    }
  };

  // Toggle lead selection for sequence execution
  const toggleSeqLead = (leadId: string) => {
    setExecuteLeadIds((prev) =>
      prev.includes(leadId) ? prev.filter((id) => id !== leadId) : [...prev, leadId]
    );
  };

  // Open composer for a lead
  const openComposer = (lead: SavedLead) => {
    setComposerLead(lead);
    setComposerSubject("");
    setComposerBody("");
    setComposerOpen(true);
  };

  // Copy to clipboard helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: "Copied", description: "Copied to clipboard" });
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Aria Marketing Hub</h1>
                <p className="text-sm text-muted-foreground">AI-Powered Marketing Autopilot</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {health && (
                <Badge variant={health.composioConfigured ? "default" : "destructive"} className="gap-1.5">
                  {health.composioConfigured ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                  {health.composioConfigured ? "Composio Connected" : "Composio Not Connected"}
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={() => { loadHealth(); loadHistory(); loadPlans(); loadDrafts(); }}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Stats Bar */}
      {health && (
        <div className="border-b bg-muted/30">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Posts:</span>
                <span className="font-semibold">{health.stats.successfulPosts}</span>
                <span className="text-muted-foreground">/ {health.stats.totalPosts}</span>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Plans:</span>
                <span className="font-semibold">{health.stats.completedPlans}</span>
                <span className="text-muted-foreground">/ {health.stats.totalPlans}</span>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Connected:</span>
                <span className="font-semibold">{health.connectedAccounts.count}</span>
                <span className="text-muted-foreground">accounts</span>
              </div>
              {health.autoPost?.enabled && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-green-600" />
                  <span className="text-green-600 font-medium">Auto-posting ON</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-8 mb-6">
            <TabsTrigger value="brain" className="gap-1.5">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">Brain</span>
            </TabsTrigger>
            <TabsTrigger value="leads" className="gap-1.5">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Leads</span>
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1.5">
              <GitBranch className="h-4 w-4" />
              <span className="hidden sm:inline">Pipeline</span>
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Plans</span>
            </TabsTrigger>
            <TabsTrigger value="create" className="gap-1.5">
              <Pencil className="h-4 w-4" />
              <span className="hidden sm:inline">Create Post</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">History</span>
            </TabsTrigger>
            <TabsTrigger value="drafts" className="gap-1.5">
              <Eye className="h-4 w-4" />
              <span className="hidden sm:inline">Drafts</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          {/* ==================== BRAIN TAB ==================== */}
          <TabsContent value="brain">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Input */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    AI Brain — Generate a Marketing Plan
                  </CardTitle>
                  <CardDescription>
                    Tell the Brain what you want to achieve. It will create a full executable plan.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="mb-2 block">What&apos;s your marketing goal?</Label>
                    <Textarea
                      placeholder="e.g., Promote AriaAgent's free AI tools to indie hackers on Twitter and LinkedIn this week"
                      value={brainGoal}
                      onChange={(e) => setBrainGoal(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block">Select Products to Promote</Label>
                    <div className="flex flex-wrap gap-2">
                      {PRODUCTS.map((product) => (
                        <Badge
                          key={product}
                          variant={brainProducts.includes(product) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleProduct(product)}
                        >
                          {product}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block">Select Platforms</Label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map((p) => (
                        <Badge
                          key={p.value}
                          variant={brainPlatforms.includes(p.value) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => togglePlatform(p.value)}
                        >
                          {p.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={handleGeneratePlan}
                    disabled={generatingPlan || !brainGoal.trim() || brainProducts.length === 0}
                    className="w-full"
                    size="lg"
                  >
                    {generatingPlan ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Brain is thinking...
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        Generate Marketing Plan
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Generated Plan Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Generated Plan</CardTitle>
                  <CardDescription>
                    {generatedPlan
                      ? `${generatedPlan.steps.length} steps — ${generatedPlan.status}`
                      : "Your plan will appear here after generation"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!generatedPlan && !generatingPlan && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Brain className="h-12 w-12 mb-3 opacity-30" />
                      <p>Enter a goal and click Generate to start</p>
                    </div>
                  )}
                  {generatingPlan && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-12 w-12 mb-3 animate-spin text-primary" />
                      <p className="text-muted-foreground">Claude is creating your marketing plan...</p>
                    </div>
                  )}
                  {generatedPlan && (
                    <div className="space-y-4">
                      <div className="rounded-lg bg-muted p-3">
                        <p className="font-semibold">{generatedPlan.name}</p>
                        <p className="text-sm text-muted-foreground">{generatedPlan.goal}</p>
                      </div>
                      <ScrollArea className="max-h-[400px]">
                        <div className="space-y-2">
                          {generatedPlan.steps.map((step) => (
                            <div
                              key={step.id}
                              className="flex items-start gap-3 rounded-lg border p-3"
                            >
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                                {step.order}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge className={platformColors[step.platform] || ""} variant="secondary">
                                    {step.platform}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">{step.actionSlug}</span>
                                </div>
                                <p className="text-sm font-medium">{step.topic}</p>
                                <p className="text-xs text-muted-foreground">Product: {step.product}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ==================== LEADS TAB ==================== */}
          <TabsContent value="leads">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Search Panel */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Lead Discovery
                  </CardTitle>
                  <CardDescription>
                    Search for companies and people using Explee
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Type Selector */}
                  <div>
                    <Label className="mb-2 block">Search Type</Label>
                    <Select value={leadsType} onValueChange={(v) => setLeadsType(v as typeof leadsType)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="people">People</SelectItem>
                        <SelectItem value="companies">Companies</SelectItem>
                        <SelectItem value="domains">By Domains</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Query Input (for companies/people) */}
                  {leadsType !== "domains" && (
                    <div>
                      <Label className="mb-2 block">Search Query</Label>
                      <Input
                        placeholder={leadsType === "companies" ? 'e.g., AI SaaS companies in US' : 'e.g., AI startup founders in Germany'}
                        value={leadsQuery}
                        onChange={(e) => setLeadsQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLeadsSearch()}
                      />
                    </div>
                  )}

                  {/* Domain Input (for domains type) */}
                  {leadsType === "domains" && (
                    <div>
                      <Label className="mb-2 block">Company Domains</Label>
                      <Input
                        placeholder="stripe.com, github.com, vercel.com"
                        value={leadsDomains}
                        onChange={(e) => setLeadsDomains(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLeadsSearch()}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Separate multiple domains with commas</p>
                    </div>
                  )}

                  {/* Job Titles (for people/domains) */}
                  {(leadsType === "people" || leadsType === "domains") && (
                    <div>
                      <Label className="mb-2 block">Job Titles (optional)</Label>
                      <Input
                        placeholder="CEO, CTO, VP Sales"
                        value={leadsJobTitles}
                        onChange={(e) => setLeadsJobTitles(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Separate multiple titles with commas</p>
                    </div>
                  )}

                  {/* Limit */}
                  <div>
                    <Label className="mb-2 block">Results Limit</Label>
                    <Select value={String(leadsLimit)} onValueChange={(v) => setLeadsLimit(Number(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="100">100</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    onClick={handleLeadsSearch}
                    disabled={leadsLoading}
                    className="w-full"
                    size="lg"
                  >
                    {leadsLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Search Leads
                      </>
                    )}
                  </Button>

                  <Separator />

                  {/* Batch Email Finder */}
                  <div>
                    <Label className="mb-2 block">Batch Email Finder</Label>
                    <Textarea
                      placeholder={`[\n  {"first_name": "Elon", "last_name": "Musk", "company_domain": "tesla.com"},\n  {"first_name": "Satya", "last_name": "Nadella", "company_domain": "microsoft.com"}\n]`}
                      value={batchContacts}
                      onChange={(e) => setBatchContacts(e.target.value)}
                      rows={5}
                      className="font-mono text-xs"
                    />
                  </div>

                  <Button
                    onClick={handleBatchSubmit}
                    disabled={batchSubmitting || batchPolling}
                    variant="outline"
                    className="w-full"
                  >
                    {batchSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : batchPolling ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing... {batchStatus}
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4 mr-2" />
                        Find Emails (Batch)
                      </>
                    )}
                  </Button>

                  {batchTaskId && (
                    <div className="rounded-lg bg-muted p-3 text-xs space-y-1">
                      <p className="font-medium">Batch Status</p>
                      <p>Task ID: <code className="bg-background px-1 py-0.5 rounded">{batchTaskId}</code></p>
                      <p>Status: <Badge variant={batchStatus === "completed" ? "default" : batchStatus === "failed" ? "destructive" : "outline"}>{batchStatus}</Badge></p>
                      {batchResults.length > 0 && (
                        <p>Results: {batchResults.filter((r) => r.email).length}/{batchResults.length} emails found</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Results Panel */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Results</CardTitle>
                      <CardDescription>
                        {leadsResults.length > 0
                          ? `${leadsResults.length} lead${leadsResults.length !== 1 ? "s" : ""} found`
                          : "Search for leads to see results here"
                        }
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {leadsResults.length > 0 && (
                        <>
                          <Badge variant="outline">{leadsType}</Badge>
                          <Button
                            onClick={handleSaveLeads}
                            disabled={savingLeads}
                            size="sm"
                            className="gap-1.5"
                          >
                            {savingLeads ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Save All to Pipeline
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {leadsLoading ? (
                    <div className="flex flex-col items-center justify-center py-16">
                      <Loader2 className="h-10 w-10 mb-3 animate-spin text-primary" />
                      <p className="text-muted-foreground">Searching for leads...</p>
                    </div>
                  ) : leadsResults.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                      <Users className="h-12 w-12 mb-3 opacity-30" />
                      <p>No leads yet. Use the search panel to discover companies and people.</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[600px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">Name</TableHead>
                            <TableHead>Title / Industry</TableHead>
                            <TableHead className="w-[180px]">Company</TableHead>
                            <TableHead className="w-[220px]">Email</TableHead>
                            <TableHead className="w-[60px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {leadsResults.map((lead, index) => {
                            const displayName =
                              lead.full_name ||
                              (lead.first_name && lead.last_name
                                ? `${lead.first_name} ${lead.last_name}`
                                : lead.name || "—");
                            const subtitle =
                              leadsType === "companies"
                                ? lead.industry || "—"
                                : lead.job_title || "—";
                            const companyName =
                              leadsType === "companies"
                                ? lead.domain || "—"
                                : lead.company || lead.company_domain || "—";
                            const isPerson = leadsType !== "companies";

                            return (
                              <TableRow key={index}>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-2">
                                    {displayName}
                                    {lead.linkedin_url && (
                                      <a
                                        href={lead.linkedin_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-muted-foreground hover:text-foreground"
                                      >
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                  </div>
                                  {lead.location && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{lead.location}</p>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary" className="text-xs">{subtitle}</Badge>
                                  {isPerson && lead.seniority && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{lead.seniority}</p>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {companyName !== "—" && (lead.company_domain || lead.domain) && (
                                    <a
                                      href={`https://${lead.company_domain || lead.domain}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-blue-600 hover:underline"
                                    >
                                      {companyName}
                                    </a>
                                  ) || companyName}
                                </TableCell>
                                <TableCell>
                                  {lead.email ? (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-sm truncate">{lead.email}</span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 shrink-0"
                                        onClick={() => copyToClipboard(lead.email!)}
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ) : isPerson ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleFindEmail(index)}
                                      disabled={findingEmailIndex === index}
                                      className="text-xs"
                                    >
                                      {findingEmailIndex === index ? (
                                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                      ) : (
                                        <Mail className="h-3 w-3 mr-1" />
                                      )}
                                      Find Email
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {isPerson && !lead.email && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6"
                                      onClick={() => handleFindEmail(index)}
                                      disabled={findingEmailIndex === index}
                                    >
                                      {findingEmailIndex === index ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Mail className="h-3 w-3" />
                                      )}
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}

                  {/* Batch Email Results */}
                  {batchResults.length > 0 && (
                    <>
                      <Separator className="my-4" />
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Batch Email Results</h4>
                        <ScrollArea className="max-h-[300px]">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Name</TableHead>
                                <TableHead>Company</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {batchResults.map((result, index) => (
                                <TableRow key={index}>
                                  <TableCell className="text-sm">
                                    {result.first_name} {result.last_name}
                                  </TableCell>
                                  <TableCell className="text-sm">{result.company_domain}</TableCell>
                                  <TableCell>
                                    {result.email ? (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-sm truncate">{result.email}</span>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 shrink-0"
                                          onClick={() => copyToClipboard(result.email!)}
                                        >
                                          <Copy className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-muted-foreground">
                                        {result.error || "Not found"}
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell>
                                    <Badge
                                      variant={
                                        result.email_status === "valid"
                                          ? "default"
                                          : result.email
                                          ? "secondary"
                                          : "destructive"
                                      }
                                      className="text-xs"
                                    >
                                      {result.email_status || "N/A"}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollArea>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ==================== PIPELINE TAB ==================== */}
          <TabsContent value="pipeline">
            {/* Autopilot Dashboard */}
            <Card className="mb-6 border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white">
                      <Zap className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Autopilot Engine</CardTitle>
                      <CardDescription>Autonomous marketing loop: Discover → Enrich → Contact → Follow-up</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {orchestratorRunning && (
                      <Badge variant="secondary" className="gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Running...
                      </Badge>
                    )}
                    <Button
                      onClick={handleRunOrchestrator}
                      disabled={orchestratorRunning}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {orchestratorRunning ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Running...</>
                      ) : (
                        <><Play className="h-4 w-4 mr-1" /> Run Autopilot Now</>
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Pipeline Funnel */}
                <div className="grid grid-cols-5 gap-2 mb-4">
                  {[
                    { label: "New", count: pipelineCounts.new || 0, color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
                    { label: "Contacted", count: pipelineCounts.contacted || 0, color: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200" },
                    { label: "Replied", count: pipelineCounts.replied || 0, color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200" },
                    { label: "Interested", count: pipelineCounts.interested || 0, color: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200" },
                    { label: "Converted", count: pipelineCounts.converted || 0, color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200" },
                  ].map((stage) => (
                    <div key={stage.label} className={`text-center p-2 rounded-lg ${stage.color}`}>
                      <div className="text-2xl font-bold">{stage.count}</div>
                      <div className="text-xs font-medium">{stage.label}</div>
                    </div>
                  ))}
                </div>

                {/* Phase Buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <Button variant="outline" size="sm" onClick={() => handleRunPhase("discover")} disabled={orchestratorRunning}>
                    <Users className="h-3 w-3 mr-1" /> Discover
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRunPhase("enrich")} disabled={orchestratorRunning}>
                    <Brain className="h-3 w-3 mr-1" /> Enrich
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRunPhase("email")} disabled={orchestratorRunning}>
                    <Mail className="h-3 w-3 mr-1" /> Send Emails
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRunPhase("followup")} disabled={orchestratorRunning}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Follow Up
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleRunPhase("sequence")} disabled={orchestratorRunning}>
                    <GitBranch className="h-3 w-3 mr-1" /> Setup Sequences
                  </Button>
                </div>

                {/* Last Run Results */}
                {orchestratorResult && (
                  <div className="bg-white dark:bg-gray-900 rounded-lg p-3 text-sm border">
                    <div className="font-medium mb-2">Last Run: {new Date(orchestratorResult.timestamp).toLocaleString()}</div>
                    <div className="flex flex-wrap gap-4">
                      {orchestratorResult.stats && Object.entries(orchestratorResult.stats).map(([key, val]) => (
                        <div key={key}>
                          <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1")}: </span>
                          <span className="font-semibold">{val as number}</span>
                        </div>
                      ))}
                    </div>
                    {orchestratorResult.errors?.length > 0 && (
                      <div className="mt-2 text-red-500 text-xs">
                        Errors: {orchestratorResult.errors.slice(0, 3).join("; ")}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Pipeline Stats */}
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 mb-6">
              {[
                { label: "New", key: "new" },
                { label: "Contacted", key: "contacted" },
                { label: "Replied", key: "replied" },
                { label: "Interested", key: "interested" },
                { label: "Converted", key: "converted" },
                { label: "Lost", key: "lost" },
                { label: "Total", key: "total" },
              ].map(({ label, key }) => (
                <Card
                  key={key}
                  className={`cursor-pointer ${pipelineStatusFilter === key ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setPipelineStatusFilter(pipelineStatusFilter === key ? null : key)}
                >
                  <CardContent className="p-4 text-center">
                    <p className="text-2xl font-bold">{pipelineCounts[key] || 0}</p>
                    <p className="text-xs text-muted-foreground">{label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Search and Filter */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <Input
                  placeholder="Search leads by name, email, company..."
                  value={pipelineSearch}
                  onChange={(e) => setPipelineSearch(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <Button variant="outline" size="sm" onClick={loadSavedLeads}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setPipelineStatusFilter(null); setPipelineSearch(""); }}
              >
                Clear Filters
              </Button>
            </div>

            {/* Lead Table */}
            <Card>
              <CardContent className="p-0">
                {loadingSavedLeads ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : savedLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <GitBranch className="h-12 w-12 mb-3 opacity-30" />
                    <p>No leads in pipeline yet.</p>
                    <p className="text-sm">Save leads from the Leads tab to start building your pipeline.</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[180px]">Name</TableHead>
                          <TableHead className="w-[200px]">Email</TableHead>
                          <TableHead className="w-[140px]">Company</TableHead>
                          <TableHead className="w-[120px]">Role</TableHead>
                          <TableHead className="w-[100px]">Status</TableHead>
                          <TableHead className="w-[100px]">Added</TableHead>
                          <TableHead className="w-[180px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {savedLeads.map((lead) => {
                          const displayName = `${lead.firstName || ""} ${lead.lastName || ""}`.trim() || "—";
                          return (
                            <TableRow key={lead.id}>
                              <TableCell className="font-medium">
                                {displayName}
                                {lead.linkedinUrl && (
                                  <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="ml-1 text-muted-foreground hover:text-foreground">
                                    <ExternalLink className="h-3 w-3 inline" />
                                  </a>
                                )}
                              </TableCell>
                              <TableCell>
                                {lead.email ? (
                                  <span className="text-sm">{lead.email}</span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No email</span>
                                )}
                              </TableCell>
                              <TableCell className="text-sm">{lead.company || "—"}</TableCell>
                              <TableCell className="text-sm">{lead.jobTitle || "—"}</TableCell>
                              <TableCell>
                                <Select
                                  value={lead.status || "new"}
                                  onValueChange={(v) => handleUpdateLeadStatus(lead.id, v)}
                                  disabled={updatingLeadId === lead.id}
                                >
                                  <SelectTrigger className="h-7 text-xs w-[100px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {["new", "contacted", "replied", "interested", "converted", "lost", "unsubscribed"].map((s) => (
                                      <SelectItem key={s} value={s}>
                                        {s.charAt(0).toUpperCase() + s.slice(1)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {new Date(lead.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => openComposer(lead)}
                                    disabled={!lead.email}
                                  >
                                    <Mail className="h-3 w-3" />
                                    Email
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-red-500 hover:text-red-700"
                                    onClick={() => handleDeleteLead(lead.id)}
                                    disabled={deletingLeadId === lead.id}
                                  >
                                    {deletingLeadId === lead.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Trash2 className="h-3 w-3" />
                                    )}
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>

            {/* Email Composer */}
            {composerOpen && composerLead && (
              <Card className="mt-6">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Mail className="h-5 w-5" />
                      Compose Email to {composerLead.firstName} {composerLead.lastName}
                    </CardTitle>
                    <Button variant="ghost" size="icon" onClick={() => setComposerOpen(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardDescription>
                    {composerLead.email} — {composerLead.company || composerLead.jobTitle || "No company"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="mb-2 block">Product</Label>
                      <Select value={composerProduct} onValueChange={setComposerProduct}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCTS.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Button
                        onClick={() => handleGenerateEmail(composerLead)}
                        disabled={generatingEmail}
                        variant="outline"
                        className="w-full h-10 mt-5"
                      >
                        {generatingEmail ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Brain className="h-4 w-4 mr-2" />
                        )}
                        Generate with AI
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="mb-2 block">Subject</Label>
                    <Input
                      value={composerSubject}
                      onChange={(e) => setComposerSubject(e.target.value)}
                      placeholder="Email subject line"
                    />
                  </div>
                  <div>
                    <Label className="mb-2 block">Body</Label>
                    <Textarea
                      value={composerBody}
                      onChange={(e) => setComposerBody(e.target.value)}
                      placeholder="Write your email here, or use AI to generate..."
                      rows={8}
                    />
                  </div>
                  <Button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !composerSubject || !composerBody}
                    className="w-full"
                    size="lg"
                  >
                    {sendingEmail ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Email
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Sequences Section */}
            <Separator className="my-6" />
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <MessageSquarePlus className="h-5 w-5" />
                Email Sequences
              </h3>
              <div className="grid gap-6 lg:grid-cols-3">
                {/* Create Sequence */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Create Sequence</CardTitle>
                    <CardDescription>AI-generate a multi-step drip campaign</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label className="mb-2 block">Product</Label>
                      <Select value={seqProduct} onValueChange={setSeqProduct}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCTS.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-2 block">Goal</Label>
                      <Input
                        value={seqGoal}
                        onChange={(e) => setSeqGoal(e.target.value)}
                        placeholder="e.g., Convert SaaS founders to try SalesIntelligenceMCP"
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block">Steps</Label>
                      <Select value={String(seqStepCount)} onValueChange={(v) => setSeqStepCount(Number(v))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="3">3 steps</SelectItem>
                          <SelectItem value="4">4 steps</SelectItem>
                          <SelectItem value="5">5 steps</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleCreateSequence}
                      disabled={generatingSequence || !seqGoal.trim()}
                      className="w-full"
                    >
                      {generatingSequence ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Brain className="h-4 w-4 mr-2" />
                      )}
                      Generate Sequence
                    </Button>
                  </CardContent>
                </Card>

                {/* Sequences List */}
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-base">Active Sequences</CardTitle>
                    <CardDescription>Your drip campaigns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loadingSequences ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : sequences.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No sequences yet. Create one above.</p>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-[400px]">
                        <div className="space-y-3">
                          {sequences.map((seq) => {
                            let parsedSteps: SequenceStep[] = [];
                            try { parsedSteps = JSON.parse(seq.steps || "[]"); } catch { /* ignore */ }

                            return (
                              <div key={seq.id} className="rounded-lg border p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <h4 className="font-semibold text-sm">{seq.name}</h4>
                                    <p className="text-xs text-muted-foreground">{seq.description}</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{seq.product}</Badge>
                                    <Badge variant={seq.isActive ? "default" : "secondary"}>
                                      {seq.isActive ? "Active" : "Inactive"}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex gap-4 text-xs text-muted-foreground mb-2">
                                  <span>{parsedSteps.length} steps</span>
                                  <span>{seq.totalSent || 0} sent</span>
                                  <span>{seq.totalReplies || 0} replies</span>
                                  <span>{seq.totalConversions || 0} conversions</span>
                                  <span className="ml-auto">Interval: {seq.intervalDays || 3} days</span>
                                </div>
                                <div className="space-y-1">
                                  {parsedSteps.slice(0, 3).map((step) => (
                                    <div key={step.stepNumber} className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <span className="font-mono w-4">{step.stepNumber}.</span>
                                      <span className="truncate">{step.subject}</span>
                                      <span className="ml-auto shrink-0">{step.waitDays}d</span>
                                    </div>
                                  ))}
                                  {parsedSteps.length > 3 && (
                                    <p className="text-xs text-muted-foreground">+{parsedSteps.length - 3} more steps</p>
                                  )}
                                </div>
                                <div className="mt-3 flex gap-2">
                                  {executeSeqId === seq.id ? (
                                    <>
                                      <Button
                                        size="sm"
                                        onClick={() => handleExecuteSequence(seq.id, executeLeadIds)}
                                        disabled={executingSequence || executeLeadIds.length === 0}
                                      >
                                        {executingSequence ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Send className="h-3 w-3 mr-1" />}
                                        Send to {executeLeadIds.length} leads
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => { setExecuteSeqId(null); setExecuteLeadIds([]); }}>
                                        Cancel
                                      </Button>
                                    </>
                                  ) : (
                                    <Button size="sm" variant="outline" onClick={() => setExecuteSeqId(seq.id)}>
                                      <Play className="h-3 w-3 mr-1" />
                                      Execute Sequence
                                    </Button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Lead Selector for Sequence Execution */}
              {executeSeqId && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle className="text-base">Select Leads</CardTitle>
                    <CardDescription>
                      Choose leads to send this sequence to. Click to toggle selection.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[300px]">
                      <div className="space-y-1">
                        {savedLeads
                          .filter((l) => l.email && (l.status === "new" || l.status === "contacted"))
                          .map((lead) => {
                            const selected = executeLeadIds.includes(lead.id);
                            return (
                              <div
                                key={lead.id}
                                className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted ${selected ? "bg-muted" : ""}`}
                                onClick={() => toggleSeqLead(lead.id)}
                              >
                                <div className={`h-4 w-4 rounded border ${selected ? "bg-primary border-primary" : "border-muted-foreground"}`} />
                                <span className="text-sm font-medium flex-1">
                                  {lead.firstName} {lead.lastName}
                                </span>
                                <span className="text-xs text-muted-foreground">{lead.email}</span>
                                <span className="text-xs text-muted-foreground">{lead.company}</span>
                                {selected && <Check className="h-4 w-4 text-primary" />}
                              </div>
                            );
                          })}
                      </div>
                    </ScrollArea>
                    <p className="text-xs text-muted-foreground mt-2">
                      {executeLeadIds.length} lead{executeLeadIds.length !== 1 ? "s" : ""} selected
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Email History */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email History
                </h3>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={loadEmailHistory}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </div>
              <Card>
                <CardContent className="p-0">
                  {loadingEmailHistory ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : emailHistory.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Mail className="h-10 w-10 mb-3 opacity-30" />
                      <p>No emails sent yet.</p>
                      <p className="text-sm">Send emails from the composer or execute a sequence.</p>
                    </div>
                  ) : (
                    <ScrollArea className="max-h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">To</TableHead>
                            <TableHead>Subject</TableHead>
                            <TableHead className="w-[80px]">Product</TableHead>
                            <TableHead className="w-[70px]">Step</TableHead>
                            <TableHead className="w-[80px]">Status</TableHead>
                            <TableHead className="w-[120px]">Sent At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {emailHistory.map((email) => (
                            <TableRow key={email.id}>
                              <TableCell>
                                <div className="text-sm font-medium">{email.toName || email.toEmail}</div>
                                <div className="text-xs text-muted-foreground">{email.toEmail}</div>
                              </TableCell>
                              <TableCell className="text-sm max-w-[250px] truncate">{email.subject || "—"}</TableCell>
                              <TableCell>
                                {email.product && <Badge variant="outline" className="text-xs">{email.product}</Badge>}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {email.stepNumber ? `Step ${email.stepNumber}` : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={email.status === "sent" ? "default" : "destructive"}
                                  className="text-xs"
                                >
                                  {email.status === "sent" ? (
                                    <><CheckCircle2 className="h-3 w-3 mr-1" />Sent</>
                                  ) : (
                                    <><XCircle className="h-3 w-3 mr-1" />Failed</>
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {email.sentAt ? new Date(email.sentAt).toLocaleString() : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ==================== PLANS TAB ==================== */}
          <TabsContent value="plans">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Marketing Plans</CardTitle>
                    <CardDescription>
                      All generated plans and their execution status
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadPlans}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPlans ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : plans.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-3 opacity-30" />
                    <p>No plans yet. Go to the Brain tab to generate one.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {plans.map((plan) => {
                      const total = plan.steps.length;
                      const done = plan.steps.filter((s) => s.status === "success").length;
                      const failed = plan.steps.filter((s) => s.status === "failed").length;
                      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

                      return (
                        <div key={plan.id} className="rounded-lg border p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-semibold">{plan.name}</h3>
                              <p className="text-sm text-muted-foreground">{plan.goal}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={statusColors[plan.status] || ""}>{plan.status}</Badge>
                              {(plan.status === "draft" || plan.status === "failed") && (
                                <Button
                                  size="sm"
                                  onClick={() => handleExecutePlan(plan.id)}
                                  disabled={executingPlanId === plan.id}
                                >
                                  {executingPlanId === plan.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <>
                                      <Play className="h-4 w-4 mr-1" />
                                      Execute
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </div>
                          <Progress value={pct} className="mb-2 h-2" />
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span className="text-green-600">{done} succeeded</span>
                            <span className="text-red-600">{failed} failed</span>
                            <span>{total - done - failed} pending</span>
                            <span className="ml-auto">{pct}% complete</span>
                          </div>
                          <div className="mt-3 space-y-1">
                            {plan.steps.map((step) => (
                              <div
                                key={step.id}
                                className="flex items-center gap-2 text-sm rounded px-2 py-1 hover:bg-muted/50"
                              >
                                {step.status === "success" ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                                ) : step.status === "failed" ? (
                                  <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                                ) : step.status === "running" ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-yellow-600 shrink-0" />
                                ) : (
                                  <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                                )}
                                <span className="font-mono text-xs text-muted-foreground w-6">{step.order}.</span>
                                <Badge className={`${platformColors[step.platform] || ""} text-xs`} variant="secondary">
                                  {step.platform}
                                </Badge>
                                <span className="truncate">{step.topic}</span>
                                {step.errorMessage && (
                                  <span className="text-red-500 text-xs truncate ml-auto" title={step.errorMessage}>
                                    <AlertCircle className="h-3 w-3 inline" />
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== CREATE POST TAB ==================== */}
          <TabsContent value="create">
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Create Post</CardTitle>
                  <CardDescription>
                    Generate AI content or write your own, then publish
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="mb-2 block">Platform</Label>
                      <Select value={postPlatform} onValueChange={setPostPlatform}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PLATFORMS.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-2 block">Product</Label>
                      <Select value={postProduct} onValueChange={setPostProduct}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCTS.map((p) => (
                            <SelectItem key={p} value={p}>
                              {p}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block">Topic (optional)</Label>
                    <Input
                      placeholder="e.g., 5 reasons why AriaAgent beats paid alternatives"
                      value={postTopic}
                      onChange={(e) => setPostTopic(e.target.value)}
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label className="mb-2 block">Or write your own content:</Label>
                    <Textarea
                      placeholder="Type your post content here..."
                      value={customContent}
                      onChange={(e) => setCustomContent(e.target.value)}
                      rows={6}
                    />
                  </div>

                  <div className="flex gap-3">
                    <Button
                      onClick={handleGenerateContent}
                      disabled={generatingContent}
                      variant="outline"
                      className="flex-1"
                    >
                      {generatingContent ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Brain className="h-4 w-4 mr-2" />
                      )}
                      Generate with AI
                    </Button>
                    <Button
                      onClick={handlePublishGenerated}
                      disabled={generatingContent || !generatedContent}
                      className="flex-1"
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Publish Now
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Preview</CardTitle>
                  <CardDescription>
                    {generatedContent ? `Ready to publish` : "Content preview will appear here"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!generatedContent && !generatingContent && (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Pencil className="h-12 w-12 mb-3 opacity-30" />
                      <p>Generate or write content to see a preview</p>
                    </div>
                  )}
                  {generatingContent && (
                    <div className="flex flex-col items-center justify-center py-12">
                      <Loader2 className="h-12 w-12 mb-3 animate-spin text-primary" />
                      <p className="text-muted-foreground">Claude is writing your content...</p>
                    </div>
                  )}
                  {generatedContent && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Badge className={platformColors[generatedContent.platform] || ""} variant="secondary">
                          {generatedContent.platform}
                        </Badge>
                        <Badge variant="outline">{generatedContent.product}</Badge>
                        <Badge variant="outline">{generatedContent.actionSlug}</Badge>
                      </div>
                      {generatedContent.title && (
                        <h3 className="font-semibold text-lg">{generatedContent.title}</h3>
                      )}
                      <div className="rounded-lg bg-muted p-4 whitespace-pre-wrap text-sm max-h-[400px] overflow-y-auto">
                        {generatedContent.body}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ==================== HISTORY TAB ==================== */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Post History</CardTitle>
                    <CardDescription>All posts ever published</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadHistory}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mb-3 opacity-30" />
                    <p>No posts yet. Create your first post!</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[600px]">
                    <div className="space-y-2">
                      {history.map((post) => (
                        <div key={post.id} className="flex items-start gap-3 rounded-lg border p-3">
                          {post.status === "success" ? (
                            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Badge className={platformColors[post.platform] || ""} variant="secondary">
                                {post.platform}
                              </Badge>
                              <Badge variant="outline">{post.product}</Badge>
                              <Badge variant={post.triggerType === "auto" ? "default" : "outline"} className="text-xs">
                                {post.triggerType}
                              </Badge>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {new Date(post.postedAt).toLocaleString()}
                              </span>
                            </div>
                            <p className="text-sm truncate">{post.title || post.body.substring(0, 120)}</p>
                            {post.postedUrl && (
                              <a
                                href={post.postedUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                View post
                              </a>
                            )}
                            {post.errorMessage && (
                              <p className="text-xs text-red-500 mt-1">{post.errorMessage}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== DRAFTS TAB ==================== */}
          <TabsContent value="drafts">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Draft Posts</CardTitle>
                    <CardDescription>Generated but not yet published</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={loadDrafts}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingDrafts ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : drafts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Eye className="h-12 w-12 mb-3 opacity-30" />
                    <p>No drafts. Generate content from the Brain or Create Post tabs.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {drafts.map((draft) => (
                      <div key={draft.id} className="rounded-lg border p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={platformColors[draft.platform] || ""} variant="secondary">
                              {draft.platform}
                            </Badge>
                            <Badge variant="outline">{draft.product}</Badge>
                            <span className="text-xs text-muted-foreground">{draft.topic}</span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handlePublishDraft(draft.id)}
                            disabled={publishingDraftId === draft.id}
                          >
                            {publishingDraftId === draft.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="h-4 w-4 mr-1" />
                                Publish
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="rounded bg-muted p-3 text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">
                          {draft.title && <p className="font-semibold mb-1">{draft.title}</p>}
                          {draft.body.substring(0, 300)}
                          {draft.body.length > 300 && "..."}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">
                          Created: {new Date(draft.createdAt).toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ==================== SETTINGS TAB ==================== */}
          <TabsContent value="settings">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Auto-Post Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Auto-Posting</CardTitle>
                  <CardDescription>
                    Configure automatic posting schedule
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-enable">Enable Auto-Posting</Label>
                    <Switch
                      id="auto-enable"
                      checked={autoEnabled}
                      onCheckedChange={setAutoEnabled}
                    />
                  </div>

                  <Separator />

                  <div>
                    <Label className="mb-2 block">Platforms (comma-separated)</Label>
                    <Input
                      value={autoPlatforms}
                      onChange={(e) => setAutoPlatforms(e.target.value)}
                      placeholder="twitter,linkedin,devto"
                    />
                  </div>

                  <div>
                    <Label className="mb-2 block">Products (comma-separated)</Label>
                    <Input
                      value={autoProducts}
                      onChange={(e) => setAutoProducts(e.target.value)}
                      placeholder="AriaAgent,SalesIntelligenceMCP"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="mb-2 block">Frequency</Label>
                      <Select value={autoFrequency} onValueChange={setAutoFrequency}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="twice_daily">Twice Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="mb-2 block">Post Time (HH:MM)</Label>
                      <Input
                        type="time"
                        value={autoTime}
                        onChange={(e) => setAutoTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button onClick={handleSaveConfig} disabled={savingConfig} className="w-full">
                    {savingConfig ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save Settings
                  </Button>

                  {health?.autoPost?.lastRunAt && (
                    <div className="rounded-lg bg-muted p-3 text-sm">
                      <p className="font-medium mb-1">Last Auto-Post Run</p>
                      <p>
                        Time: {new Date(health.autoPost.lastRunAt).toLocaleString()}
                      </p>
                      <p>
                        Status:{" "}
                        <Badge variant={health.autoPost.lastRunStatus === "success" ? "default" : "destructive"}>
                          {health.autoPost.lastRunStatus}
                        </Badge>
                      </p>
                      {health.autoPost.lastRunMessage && (
                        <p className="text-muted-foreground mt-1">{health.autoPost.lastRunMessage}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* System Health */}
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                  <CardDescription>API connections and tools status</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingHealth ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                  ) : health ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">Composio API</p>
                          <p className="text-sm text-muted-foreground">Connection to Composio platform</p>
                        </div>
                        <Badge variant={health.composioConfigured ? "default" : "destructive"}>
                          {health.composioConfigured ? "Connected" : "Not Configured"}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">Connected Accounts</p>
                          <p className="text-sm text-muted-foreground">
                            {health.connectedAccounts.error || `${health.connectedAccounts.count} accounts linked`}
                          </p>
                        </div>
                        <Badge variant={health.connectedAccounts.count > 0 ? "default" : "outline"}>
                          {health.connectedAccounts.count}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <p className="font-medium">Available Tools</p>
                          <p className="text-sm text-muted-foreground">
                            {health.availableTools.error || `${health.availableTools.count} tools ready`}
                          </p>
                        </div>
                        <Badge variant={health.availableTools.count > 0 ? "default" : "outline"}>
                          {health.availableTools.count}
                        </Badge>
                      </div>

                      <Separator />

                      <div>
                        <p className="font-medium mb-2">Products Available</p>
                        <div className="flex flex-wrap gap-2">
                          {health.products.map((p) => (
                            <Badge key={p.id} variant="secondary">{p.name}</Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="font-medium mb-2">Statistics</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded bg-muted p-2">
                            <p className="text-muted-foreground">Total Posts</p>
                            <p className="font-semibold">{health.stats.totalPosts}</p>
                          </div>
                          <div className="rounded bg-muted p-2">
                            <p className="text-muted-foreground">Successful</p>
                            <p className="font-semibold text-green-600">{health.stats.successfulPosts}</p>
                          </div>
                          <div className="rounded bg-muted p-2">
                            <p className="text-muted-foreground">Failed</p>
                            <p className="font-semibold text-red-600">{health.stats.failedPosts}</p>
                          </div>
                          <div className="rounded bg-muted p-2">
                            <p className="text-muted-foreground">Drafts</p>
                            <p className="font-semibold">{health.stats.draftPosts}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
