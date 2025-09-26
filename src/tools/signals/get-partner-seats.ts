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

export const getPartnerSeatsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Signals",
    dangerLevel: "low",
    readOnlyHint: true,
    title: "Get Partner Seats",
  },
  description: "Get brand agent seats (advertisers) accessible to your API key",
  execute: async (
    params: Record<string, never>,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Universal session authentication check
    const { apiKey, customerId: _customerId } = requireSessionAuth(context);

    try {
      const customSignalsClient = new CustomSignalsClient();
      const seats = await customSignalsClient.getPartnerSeats(client, apiKey);

      const summary = `Found ${seats.length} accessible brand agent seats`;
      const details = seats
        .map(
          (seat) =>
            `• **${seat.name}** (${seat.id}) - Customer ID: ${seat.customerId}`,
        )
        .join("\n");

      let message = `📊 **Partner Seats Overview**\n\n`;
      message += `**${summary}**\n\n`;
      if (seats.length > 0) {
        message += `**Accessible Seats:**\n${details}\n\n`;
        message += `Use \`signals/get-seat-segments\` to view segments deployed on specific seats.`;
      } else {
        message += `No brand agent seats are accessible with your API key.`;
      }

      return createMCPResponse({
        data: {
          count: seats.length,
          seats,
        },
        message,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to get partner seats", error);
    }
  },
  name: "signals_get_partner_seats",
  parameters: z.object({}),
});
