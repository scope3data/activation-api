import { FastMCP } from "fastmcp";
import { fetch } from "undici";
import { z } from "zod";

interface Agent {
  customerId: number;
  id: string;
  models: AgentModel[];
  name: string;
  type: string;
}

// GraphQL response interfaces
interface AgentModel {
  id: string;
  name: string;
}

interface AgentsData {
  agents: Agent[];
}

// Define the authentication type - can be undefined for unauthenticated sessions
type AuthContext =
  | {
      customerId?: number;
      scope3ApiKey: string;
      userId?: string;
    }
  | undefined;

interface GraphQLResponse<T = unknown> {
  data?: T;
  errors?: Array<{ [key: string]: unknown; message: string }>;
}

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

// GraphQL query for Agents (using the pattern from existing working code)
const AGENTS_QUERY = `
  query Agents($where: AgentWhereInput) {
    agents(where: $where) {
      type
      id
      customerId
      name
      models {
        id
        name
      }
    }
  }
`;

// Helper function to make GraphQL requests to Scope3
async function makeScope3GraphQLRequest<T = unknown>(
  query: string,
  variables = {},
  apiKey?: string,
): Promise<GraphQLResponse<T>> {
  if (!apiKey) {
    throw new Error("Scope3 API key is required for this operation");
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "User-Agent": "MCP-Scope3-Server/1.0.0",
  };

  try {
    const response = await fetch(config.scope3GraphQLUrl, {
      body: JSON.stringify({ query, variables }),
      headers,
      method: "POST",
    });

    if (!response.ok) {
      // Sanitize error response to prevent information disclosure
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed - please check your API key");
      } else if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      } else {
        throw new Error("Request failed - please verify your parameters");
      }
    }

    const result = (await response.json()) as GraphQLResponse<T>;

    if (result.errors) {
      // Sanitize GraphQL errors to prevent information disclosure
      throw new Error("Invalid request parameters or query");
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      // Re-throw the sanitized error without exposing internal details
      throw error;
    }
    throw new Error("Request processing failed");
  }
}

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
      const result = await makeScope3GraphQLRequest<AgentsData>(
        AGENTS_QUERY,
        { where: {} },
        apiKey,
      );
      return JSON.stringify({
        authenticated: true,
        data: result.data,
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

// Start the server with configurable options
server.start({
  httpStream: {
    endpoint: config.endpoint as `/${string}`,
    port: config.port,
  },
  transportType: "httpStream",
});
