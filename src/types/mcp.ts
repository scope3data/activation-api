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
