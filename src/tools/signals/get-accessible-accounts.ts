import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { CustomSignalsClient } from "../../services/custom-signals-client.js";
import { requireSessionAuth } from "../../utils/auth.js";
import {
  createAuthErrorResponse as _createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const getAccessibleAccountsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Signals",
    dangerLevel: "low",
    readOnlyHint: true,
    title: "Get Accessible Accounts",
  },
  description:
    "Get customer accounts that your provider account can manage signals/segments for",
  execute: async (
    params: Record<string, never>,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Universal session authentication check
    const { apiKey, customerId: _customerId } = requireSessionAuth(context);

    try {
      const customSignalsClient = new CustomSignalsClient();
      const accounts = await customSignalsClient.getPartnerSeats(
        client,
        apiKey,
      );

      const summary = `Found ${accounts.length} accessible customer accounts`;
      const details = accounts
        .map(
          (account) =>
            `• **${account.name}** (${account.id}) - Customer ID: ${account.customerId}`,
        )
        .join("\n");

      let message = `📊 **Accessible Accounts Overview**\n\n`;
      message += `**${summary}**\n\n`;
      if (accounts.length > 0) {
        message += `**Accessible Accounts:**\n${details}\n\n`;
        message += `Use \`signals/get-seat-segments\` to view segments deployed on specific accounts.`;
      } else {
        message += `No customer accounts are accessible with your provider account.`;
      }

      return createMCPResponse({
        data: {
          accounts,
          count: accounts.length,
        },
        message,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to get accessible accounts", error);
    }
  },
  name: "signals_get_accessible_accounts",
  parameters: z.object({}),
});

// Deprecated alias for backward compatibility
export const getPartnerSeatsTool = getAccessibleAccountsTool;
