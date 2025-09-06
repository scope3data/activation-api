import type { FastMCPSessionAuth } from "../types/mcp.js";

export const getAuthContext = (request?: {
  headers?: Record<string, string>;
}): FastMCPSessionAuth => {
  // Only log in HTTP mode to avoid interfering with stdio JSON protocol
  const canLog =
    (process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test") &&
    process.env.MCP_TRANSPORT === "http";

  if (canLog) {
    console.log(
      "[Auth Debug] Checking environment API key:",
      process.env.SCOPE3_API_KEY ? "present" : "missing",
    );
  }

  let apiKey: string | undefined;

  // Priority 1: Environment variable (for stdio mode)
  if (process.env.SCOPE3_API_KEY) {
    apiKey = process.env.SCOPE3_API_KEY;
    if (canLog) {
      console.log("[Auth Debug] Using environment API key");
    }
  }

  // Priority 2: HTTP headers (for HTTP mode)
  else if (request && request.headers) {
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
      console.log("[Auth Debug] No API key found");
    }
    throw new Error("No API key found");
  }

  return {
    scope3ApiKey: apiKey,
  };
};
