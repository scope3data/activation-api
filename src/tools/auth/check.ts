import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createMCPResponse } from "../../utils/error-handling.js";

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
    // Check session context first, then fall back to environment variable
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      throw new Error(
        "Authentication required. Please set the SCOPE3_API_KEY environment variable or provide via headers.",
      );
    }

    const customerId = await client.getCustomerId(apiKey);

    const message = `✅ **Authentication Status: Verified**

**Customer ID:** ${customerId}
**API Key:** Valid and active
**Timestamp:** ${new Date().toISOString()}

🔑 Your API key has the required permissions to access Scope3 services.`;

    return createMCPResponse({
      message,
      success: true,
      data: {
        authenticated: true,
        customerId,
        timestamp: new Date().toISOString(),
        apiKeySource: context.session?.scope3ApiKey ? "session" : "environment",
      },
    });
  },

  name: "auth/check",
  parameters: z.object({}),
});
