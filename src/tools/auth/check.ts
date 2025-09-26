import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { requireSessionAuth } from "../../utils/auth.js";
import { createMCPResponse } from "../../utils/error-handling.js";

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
    // Universal session authentication check
    const { apiKey: _apiKey, customerId } = requireSessionAuth(context);

    const message = `✅ **Authentication Status: Verified**

**Customer ID:** ${customerId}
**API Key:** Valid and active
**Timestamp:** ${new Date().toISOString()}

🔑 Your API key has the required permissions to access Scope3 services.`;

    return createMCPResponse({
      data: {
        apiKeySource: "session",
        authenticated: true,
        customerId,
        timestamp: new Date().toISOString(),
      },
      message,
      success: true,
    });
  },

  name: "auth_check",
  parameters: z.object({}),
});
