// import type { AuthContext } from "./auth.js";

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

// Brand Agent Campaign MCP parameter types
export interface CreateBrandAgentCampaignParams {
  audienceIds?: string[];
  brandAgentId: string;
  budget?: {
    currency: string;
    dailyCap?: number;
    pacing?: string;
    total: number;
  };
  creativeIds?: string[];

  // Inventory management configuration
  inventoryManagement?: {
    autoDiscoverProducts?: boolean;
    autoOptimize?: boolean;
    budgetSplit?: {
      guaranteed: number;
      nonGuaranteed: number;
    };
    mode: "hybrid" | "scope3_managed" | "user_managed";
    optimizationGoal?:
      | "clicks"
      | "conversions"
      | "cost_efficiency"
      | "impressions";
    preferredSignals?: ("buyer" | "scope3" | "third_party")[];
  };

  name: string;
  prompt: string;
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
  name: string;
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

// Tool parameter interfaces
export interface CreateCampaignParams {
  name: string;
  prompt: string;
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

export interface ExportCampaignDataParams {
  brandAgentId?: string;
  campaignIds?: string[];
  compression?: "gzip" | "none";
  datasets: Array<"allocations" | "delivery" | "events" | "tactics">;
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

// FastMCP types compatibility
export interface FastMCPSessionAuth extends Record<string, unknown> {
  customerId?: number;
  scope3ApiKey: string;
  userId?: string;
}

export interface GetAmpAgentsParams {
  where?: {
    customerId?: number;
    name?: string;
  };
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

export interface ListMeasurementSourcesParams {
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
  name?: string;
  prompt: string;
}

export interface UpdateMeasurementSourceParams {
  configuration?: Record<string, unknown>;
  name?: string;
  sourceId: string;
  status?: "active" | "error" | "inactive";
  type?: "analytics" | "brand_study" | "conversion_api" | "mmm";
}

export interface UpdateSyntheticAudienceParams {
  audienceId: string;
  description?: string;
  name?: string;
}
