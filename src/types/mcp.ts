// import type { AuthContext } from "./auth.js";

// Signals Agent MCP parameter types
export interface ActivateSignalParams {
  agentId: string;
  signalId: string;
}

// Measurement Source MCP parameter types (stub)
export interface AddMeasurementSourceParams {
  brandAgentId: string;
  configuration?: Record<string, unknown>;
  name: string;
  type: "analytics" | "brand_study" | "conversion_api" | "mmm";
}

export interface AnalyzeTacticsParams {
  analysisType:
    | "attribution"
    | "brand_stories"
    | "efficiency"
    | "optimization"
    | "signals";
  campaignId: string;
  compareSignals?: boolean;
  compareStories?: boolean;
  customDateRange?: {
    end: string;
    start: string;
  };
  timeframe?: "14d" | "30d" | "7d" | "custom";
}

// Brand Agent Creative MCP parameter types
export interface CreateBrandAgentCreativeParams {
  body?: string;
  brandAgentId: string;
  cta?: string;
  headline?: string;
  name: string;
  type: "html5" | "image" | "native" | "video";
  url: string;
}

// Brand Agent MCP parameter types
export interface CreateBrandAgentParams {
  advertiserDomains: string[];
  description?: string;
  externalId?: string;
  name: string;
  nickname?: string;
}

export interface CreateBrandAgentStandardsParams {
  brandAgentId: string;
  brands?: string[];
  channels?: string[];
  countries?: string[];
  languages?: string[];
  name: string;
  prompt: string;
}

export interface CreateBrandAgentStoryParams {
  brandAgentId: string;
  brands?: string[];
  channels?: string[];
  countries?: string[];
  languages?: string[];
  name: string;
  prompt: string;
}

// Campaign MCP parameter types
export interface CreateCampaignParams {
  brandAgentId: string;
  briefValidationThreshold?: number;
  budget: {
    currency?: string;
    dailyCap?: number;
    pacing?: string;
    total: number;
  };
  creativeIds?: string[];
  endDate?: string;
  name: string;
  prompt: string;
  skipBriefValidation?: boolean;
  startDate?: string;
}

// Custom Signal Definition MCP parameter types
export interface CreateCustomSignalParams {
  clusters: Array<{
    channel?: string;
    gdpr?: boolean;
    region: string;
  }>;
  description: string;
  key: string;
  name: string;
}

// Synthetic Audience MCP parameter types (stub)
export interface CreateSyntheticAudienceParams {
  brandAgentId: string;
  description?: string;
  name: string;
}

export interface DeleteBrandAgentParams {
  brandAgentId: string;
}

export interface DeleteBrandAgentStandardsParams {
  standardsId: string;
}

export interface DeleteBrandAgentStoryParams {
  storyId: string;
}

export interface DeleteCustomSignalParams {
  signalId: string;
}

export interface ExportCampaignDataParams {
  brandAgentId?: string;
  campaignIds?: string[];
  compression?: "gzip" | "none";
  datasets: Array<"allocations" | "delivery" | "outcomes" | "tactics">;
  dateRange: {
    end: string;
    start: string;
  };
  format?: "csv" | "json" | "parquet";
  groupBy: Array<
    | "campaign"
    | "creative"
    | "date"
    | "hour"
    | "publisher_product"
    | "signal"
    | "story"
    | "tactic"
  >;
}

// Tool parameter interfaces (legacy - remove if unused)

// FastMCP types compatibility
export interface FastMCPSessionAuth extends Record<string, unknown> {
  customerId?: number;
  scope3ApiKey: string;
  userId?: string;
}

export interface GetBrandAgentParams {
  brandAgentId: string;
}

// Reporting MCP parameter types
export interface GetCampaignSummaryParams {
  campaignId: string;
  dateRange?: {
    end?: string;
    start?: string;
  };
  includeCharts?: boolean;
  verbosity?: "brief" | "detailed" | "executive";
}

export interface GetCustomSignalParams {
  signalId: string;
}

export interface GetSignalsAgentHistoryParams {
  agentId: string;
  limit?: number;
}

export interface GetSignalsAgentParams {
  agentId: string;
}

export interface GetSignalsParams {
  agentIds?: string[];
  brandAgentId: string;
  brief?: string;
}

export interface ListBrandAgentCampaignsParams {
  brandAgentId: string;
  status?: string;
}

export interface ListBrandAgentCreativesParams {
  brandAgentId: string;
}

export interface ListBrandAgentsParams {
  where?: {
    customerId?: number;
    name?: string;
  };
}

// Brand Standards Agent MCP parameter types
export interface ListBrandAgentStandardsParams {
  brandAgentId: string;
}

// Brand Story Agent MCP parameter types
export interface ListBrandAgentStoriesParams {
  brandAgentId: string;
}

export interface ListCustomSignalsParams {
  channel?: string;
  region?: string;
  seatId?: string;
}

export interface ListMeasurementSourcesParams {
  brandAgentId: string;
}

export interface ListSignalsAgentsParams {
  brandAgentId: string;
}

export interface ListSyntheticAudiencesParams {
  brandAgentId: string;
}

export interface MCPToolAnnotations {
  openWorldHint?: boolean;
  readOnlyHint?: boolean;
  title: string;
}

// MCP tool execution context (compatible with FastMCP)
export interface MCPToolExecuteContext {
  session?: {
    customerId?: number;
    scope3ApiKey?: string;
    userId?: string;
  };
}

// Scoring Outcome MCP parameter types
export interface ProvideScoringOutcomesParams {
  campaignId: string;
  creativeId?: string;
  exposureRange: {
    end: string; // ISO date string
    start: string; // ISO date string
  };
  performanceIndex: number; // 100 = expected, 1000 = 10x performance
  tacticId?: string;
}

export interface RegisterSignalsAgentParams {
  brandAgentId: string;
  config?: Record<string, unknown>;
  description?: string;
  endpointUrl: string;
  name: string;
}

export interface RegisterWebhookParams {
  brandAgentId: string;
  endpoint: {
    authentication?: {
      credentials: string;
      type: "basic" | "bearer" | "hmac";
    };
    headers?: Record<string, string>;
    method?: "POST" | "PUT";
    url: string;
  };
  eventTypes: string[];
  filters?: {
    campaigns?: string[];
    metrics?: string[];
    minSeverity?: "critical" | "info" | "warning";
  };
  retryPolicy?: {
    backoffMultiplier?: number;
    maxBackoffSeconds?: number;
    maxRetries?: number;
  };
}

// Response interface for better typing (tools return JSON strings for Claude Desktop compatibility)
export interface ToolResponse {
  data?: Record<string, unknown>;
  error?: string;
  errorCode?: string;
  message: string;
  success: boolean;
}

export interface UnregisterSignalsAgentParams {
  agentId: string;
}

// Legacy interface - use UpdateCampaignParams instead
export interface UpdateBrandAgentCampaignParams {
  audienceIds?: string[];
  budget?: {
    currency?: string;
    dailyCap?: number;
    pacing?: string;
    total?: number;
  };
  campaignId: string;
  creativeIds?: string[];
  name?: string;
  prompt?: string;
  status?: string;
}

export interface UpdateBrandAgentCreativeParams {
  body?: string;
  creativeId: string;
  cta?: string;
  headline?: string;
  name?: string;
  type?: "html5" | "image" | "native" | "video";
  url?: string;
}

export interface UpdateBrandAgentParams {
  advertiserDomains?: string[];
  brandAgentId: string;
  description?: string;
  name?: string;
  tacticSeedDataCoop?: boolean;
}

export interface UpdateBrandAgentStandardsParams {
  name?: string;
  prompt: string;
  standardsId: string;
}

export interface UpdateBrandAgentStoryParams {
  name?: string;
  prompt: string;
  storyId: string;
}

export interface UpdateCampaignParams {
  campaignId: string;
  changeRequest?: string;
  name?: string;
  prompt?: string;
  reason?: string;
  tacticAdjustments?: Array<{
    budgetAllocation?: {
      amount?: number;
      dailyCap?: number;
      pacing?: "asap" | "even" | "front_loaded";
      percentage?: number;
    };
    tacticId: string;
  }>;
}

export interface UpdateCustomSignalParams {
  clusters?: Array<{
    channel?: string;
    gdpr?: boolean;
    region: string;
  }>;
  description?: string;
  name?: string;
  signalId: string;
}

export interface UpdateMeasurementSourceParams {
  configuration?: Record<string, unknown>;
  name?: string;
  sourceId: string;
  status?: "active" | "error" | "inactive";
  type?: "analytics" | "brand_study" | "conversion_api" | "mmm";
}

export interface UpdateSignalsAgentParams {
  agentId: string;
  config?: Record<string, unknown>;
  description?: string;
  endpointUrl?: string;
  name?: string;
  status?: "active" | "inactive" | "suspended";
}

export interface UpdateSyntheticAudienceParams {
  audienceId: string;
  description?: string;
  name?: string;
}

// Brief Validation MCP parameter types
export interface ValidateBriefParams {
  brandAgentId?: string;
  brief: string;
  threshold?: number;
}
