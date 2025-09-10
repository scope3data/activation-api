import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const checkAuthTool = (client: Scope3ApiClient) => ({
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

      const customerId = await client.getCustomerId(apiKey);

      return createMCPResponse({
        message: `Authentication successful. Customer ID: ${customerId}`,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Authentication check failed", error);
    }
  },

  name: "auth/check",
  parameters: z.object({}),
});
