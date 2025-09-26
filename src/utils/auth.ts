import type {
  FastMCPSessionAuth,
  MCPToolExecuteContext,
} from "../types/mcp.js";

/**
 * Universal session authentication check for MCP tools
 * Extracts and validates customer ID and API key from session
 */
export const requireSessionAuth = (
  context: MCPToolExecuteContext,
): { apiKey: string; customerId: number } => {
  const customerId = context.session?.customerId;
  const apiKey = context.session?.scope3ApiKey;

  if (!customerId || !apiKey) {
    throw new Error(
      "Authentication required. Please provide valid API key in headers (x-scope3-api-key or Authorization: Bearer).",
    );
  }

  return { apiKey, customerId };
};

export const getAuthContext = (request?: {
  headers?: Record<string, string>;
}): FastMCPSessionAuth => {
  const canLog =
    process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

  let apiKey: string | undefined;

  // Only use HTTP headers for authentication
  if (request && request.headers) {
    // Try custom header first
    if (request.headers["x-scope3-api-key"]) {
      apiKey = request.headers["x-scope3-api-key"];
      if (canLog) {
        console.log("[Auth Debug] Using x-scope3-api-key header");
      }
    }
    // Then try authorization header
    else if (request.headers.authorization) {
      const authHeader = request.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        apiKey = authHeader.substring(7);
        if (canLog) {
          console.log("[Auth Debug] Using Bearer token");
        }
      }
    }
  }

  if (!apiKey) {
    if (canLog) {
      console.log("[Auth Debug] No API key found in headers");
    }
    throw new Error(
      "API key required in headers (x-scope3-api-key or Authorization: Bearer)",
    );
  }

  return {
    scope3ApiKey: apiKey,
  };
};
