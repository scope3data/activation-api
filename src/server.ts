import { FastMCP } from "fastmcp";
import { z } from "zod";

import { Scope3ApiClient } from "./scope3-client.js";

// Define the authentication type - can be undefined for unauthenticated sessions
type AuthContext =
  | {
      customerId?: number;
      scope3ApiKey: string;
      userId?: string;
    }
  | undefined;

// Configuration interface for better maintainability
interface ServerConfig {
  endpoint: string;
  port: number;
  scope3GraphQLUrl: string;
}

const config: ServerConfig = {
  endpoint: process.env.MCP_ENDPOINT || "/mcp",
  port: parseInt(process.env.MCP_PORT || "8080", 10),
  scope3GraphQLUrl:
    process.env.SCOPE3_GRAPHQL_URL || "https://api.scope3.com/api/graphql",
};

// Create a shared instance of the Scope3 API client
const scope3Client = new Scope3ApiClient(config.scope3GraphQLUrl);

const server = new FastMCP<AuthContext>({
  authenticate: async (request) => {
    // Extract API key from various header formats
    const extractApiKey = (): string | undefined => {
      const headers = request.headers;

      // Try custom header variations (case-insensitive)
      const customHeaderVariations = [
        "x-scope3-api-key",
        "X-Scope3-Api-Key",
        "X-SCOPE3-API-KEY",
      ];

      for (const header of customHeaderVariations) {
        const value = headers[header];
        if (value && typeof value === "string") {
          return value;
        }
      }

      // Try Authorization header (Bearer token)
      const authHeader = headers["authorization"] || headers["Authorization"];
      if (authHeader && typeof authHeader === "string") {
        const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch) {
          return bearerMatch[1];
        }
      }

      return undefined;
    };

    let apiKey = extractApiKey();

    if (!apiKey) {
      // Return undefined to allow unauthenticated sessions
      return undefined;
    }

    // Validate the API key format
    if (typeof apiKey !== "string" || apiKey.trim().length === 0) {
      throw new Error("Invalid Scope3 API key format");
    }

    // Clean and decode the API key
    apiKey = apiKey.trim();
    try {
      // Only decode if it looks like it might be URL-encoded
      if (apiKey.includes("%")) {
        apiKey = decodeURIComponent(apiKey);
      }
    } catch {
      // If decoding fails, continue with original key
      // Note: URL decoding failed, continuing with original key
    }

    // Basic API key validation (adjust pattern based on your actual keys)
    if (apiKey.length < 10) {
      throw new Error("API key appears to be too short");
    }

    // Return the authentication context
    return {
      scope3ApiKey: apiKey,
      userId: "authenticated-user",
    };
  },
  name: "Scope3 API Server",
  version: "1.0.0",
});

server.addTool({
  annotations: {
    openWorldHint: false,
    readOnlyHint: true,
    title: "Check Authentication Status",
  },
  description: "Check if the current session is authenticated",
  execute: async (args, context) => {
    const session = context.session;
    return JSON.stringify({
      authenticated: session !== undefined,
      hasApiKey: session?.scope3ApiKey !== undefined,
      userId: session?.userId || null,
    });
  },
  name: "check_auth",
  parameters: z.object({}),
});

server.addTool({
  annotations: {
    openWorldHint: true, // This tool interacts with external Scope3 API
    readOnlyHint: true, // This tool doesn't modify anything
    title: "Get Scope3 AMP Agents",
  },
  description:
    "Get all agents and their models from Scope3 API. Requires authentication via x-scope3-api-key header.",
  execute: async (args, context) => {
    const apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      return JSON.stringify({
        authenticated: false,
        error: "Authentication required",
        message:
          "This tool requires a Scope3 API key. Please provide it via the 'x-scope3-api-key' header or 'Authorization: Bearer <key>' header.",
      });
    }

    try {
      // Let the API key determine what data the user can access
      const agents = await scope3Client.getAgents(apiKey, {});
      return JSON.stringify({
        authenticated: true,
        data: { agents },
        success: true,
      });
    } catch (error) {
      // Sanitize error response - don't expose internal error details
      let message = "Unable to fetch agents";
      if (error instanceof Error) {
        // Only expose safe, user-friendly error messages
        if (error.message.includes("Authentication failed")) {
          message = "Authentication failed - please check your API key";
        } else if (error.message.includes("temporarily unavailable")) {
          message = "Service temporarily unavailable - please try again later";
        } else if (error.message.includes("Invalid request")) {
          message = "Invalid request - please check your parameters";
        }
      }

      return JSON.stringify({
        authenticated: true,
        error: "API request failed",
        message,
      });
    }
  },
  name: "get_amp_agents",
  parameters: z.object({}),
});

// Start the server with configurable options (skip in test environment)
if (process.env.NODE_ENV !== "test") {
  server.start({
    httpStream: {
      endpoint: config.endpoint as `/${string}`,
      port: config.port,
    },
    transportType: "httpStream",
  });
}
