// import type { AuthContext } from "./auth.js";

// Measurement Source MCP parameter types (stub)
export interface AddMeasurementSourceParams {
  brandAgentId: string;
  configuration?: Record<string, unknown>;
  name: string;
  type: "analytics" | "brand_study" | "conversion_api" | "mmm";
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
  description?: string;
  name: string;
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

export interface GetBrandStandardsParams {
  brandAgentId: string;
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

// Brand Standards MCP parameter types
export interface SetBrandStandardsParams {
  brandAgentId: string;
  contentCategories?: string[];
  domainAllowlist?: string[];
  domainBlocklist?: string[];
  keywordFilters?: string[];
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
  brandAgentId: string;
  description?: string;
  name?: string;
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
