import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const checkAuthTool = (_client: Scope3ApiClient) => ({
  annotations: {
    category: "System",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Check Authentication Status",
  },

  description:
    "Check the authentication status of the current API key and return user information.",

  execute: async (
    args: Record<string, never>,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    try {
      // Check session context first, then fall back to environment variable
      let apiKey = context.session?.scope3ApiKey;

      if (!apiKey) {
        apiKey = process.env.SCOPE3_API_KEY;
      }

      if (!apiKey) {
        return createAuthErrorResponse();
      }

      // Authentication has already been validated by FastMCP authenticate function
      // If we have a session with an API key, authentication is successful
      const maskedKey = `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`;

      return createMCPResponse({
        details: {
          keyPrefix: apiKey.substring(0, 6),
          source: context.session?.scope3ApiKey ? "session" : "environment",
        },
        message: `Authentication successful. API key: ${maskedKey}`,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Authentication check failed", error);
    }
  },

  name: "auth/check",
  parameters: z.object({}),
});
