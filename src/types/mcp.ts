// import type { AuthContext } from "./auth.js";

// Tool parameter interfaces
export interface CreateCampaignParams {
  name: string;
  prompt: string;
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

// Response interface for better typing (tools return JSON strings for Claude Desktop compatibility)
export interface ToolResponse {
  data?: Record<string, unknown>;
  error?: string;
  errorCode?: string;
  message: string;
  success: boolean;
}

export interface UpdateCampaignParams {
  campaignId: string;
  name?: string;
  prompt: string;
}

// Brand Agent MCP parameter types
export interface CreateBrandAgentParams {
  name: string;
  description?: string;
}

export interface UpdateBrandAgentParams {
  brandAgentId: string;
  name?: string;
  description?: string;
}

export interface DeleteBrandAgentParams {
  brandAgentId: string;
}

export interface GetBrandAgentParams {
  brandAgentId: string;
}

export interface ListBrandAgentsParams {
  where?: {
    name?: string;
    customerId?: number;
  };
}

// Brand Agent Campaign MCP parameter types
export interface CreateBrandAgentCampaignParams {
  brandAgentId: string;
  name: string;
  prompt: string;
  budget?: {
    total: number;
    currency: string;
    dailyCap?: number;
    pacing?: string;
  };
  creativeIds?: string[];
  audienceIds?: string[];
}

export interface UpdateBrandAgentCampaignParams {
  campaignId: string;
  name?: string;
  prompt?: string;
  budget?: {
    total?: number;
    currency?: string;
    dailyCap?: number;
    pacing?: string;
  };
  creativeIds?: string[];
  audienceIds?: string[];
  status?: string;
}

export interface ListBrandAgentCampaignsParams {
  brandAgentId: string;
  status?: string;
}

// Brand Agent Creative MCP parameter types
export interface CreateBrandAgentCreativeParams {
  brandAgentId: string;
  name: string;
  type: 'image' | 'video' | 'native' | 'html5';
  url: string;
  headline?: string;
  body?: string;
  cta?: string;
}

export interface UpdateBrandAgentCreativeParams {
  creativeId: string;
  name?: string;
  type?: 'image' | 'video' | 'native' | 'html5';
  url?: string;
  headline?: string;
  body?: string;
  cta?: string;
}

export interface ListBrandAgentCreativesParams {
  brandAgentId: string;
}

// Brand Standards MCP parameter types
export interface SetBrandStandardsParams {
  brandAgentId: string;
  domainBlocklist?: string[];
  domainAllowlist?: string[];
  keywordFilters?: string[];
  contentCategories?: string[];
}

export interface GetBrandStandardsParams {
  brandAgentId: string;
}

// Synthetic Audience MCP parameter types (stub)
export interface CreateSyntheticAudienceParams {
  brandAgentId: string;
  name: string;
  description?: string;
}

export interface UpdateSyntheticAudienceParams {
  audienceId: string;
  name?: string;
  description?: string;
}

export interface ListSyntheticAudiencesParams {
  brandAgentId: string;
}

// Measurement Source MCP parameter types (stub)
export interface AddMeasurementSourceParams {
  brandAgentId: string;
  name: string;
  type: 'conversion_api' | 'analytics' | 'brand_study' | 'mmm';
  configuration?: Record<string, any>;
}

export interface UpdateMeasurementSourceParams {
  sourceId: string;
  name?: string;
  type?: 'conversion_api' | 'analytics' | 'brand_study' | 'mmm';
  configuration?: Record<string, any>;
  status?: 'active' | 'inactive' | 'error';
}

export interface ListMeasurementSourcesParams {
  brandAgentId: string;
}
