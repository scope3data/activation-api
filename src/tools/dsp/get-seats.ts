import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { requireSessionAuth } from "../../utils/auth.js";
import { createMCPResponse } from "../../utils/error-handling.js";

export const getDSPSeatsTool = (client: Scope3ApiClient) =>
  ({
    annotations: {
      category: "System",
      dangerLevel: "low",
      openWorldHint: true,
      readOnlyHint: true,
      title: "Get DSP Seats",
    },
    description:
      "Search for available DSP seats to add to brand agent for PMP creation",
    execute: async (
      { dsp, search_term }: { dsp: string; search_term?: string },
      context: MCPToolExecuteContext,
    ) => {
      // Universal session authentication check
      const { apiKey, customerId: _customerId } = requireSessionAuth(context);

      try {
        const seats = await client.getDSPSeats(apiKey, dsp, search_term);

        if (seats.length === 0) {
          const message = search_term
            ? `No DSP seats found for "${dsp}" matching "${search_term}".`
            : `No DSP seats found for "${dsp}".`;
          return createMCPResponse({
            message,
            success: true,
          });
        }

        const seatsTable = seats
          .map(
            (seat) =>
              `• **${seat.seatName}** (ID: ${seat.seatId})\n  Seat ID: ${seat.id}`,
          )
          .join("\n");

        const response =
          `## Available DSP Seats for ${dsp}\n\n${seatsTable}\n\n` +
          `Found ${seats.length} seat(s). Use the seat IDs to add them to a brand agent before creating PMPs.`;

        return createMCPResponse({
          message: response,
          success: true,
        });
      } catch (error) {
        throw new Error(
          `Error searching DSP seats: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    name: "dsp_get_seats",
    parameters: z.object({
      dsp: z
        .string()
        .describe(
          "DSP name (e.g., 'DV360', 'Amazon DSP', 'The Trade Desk', 'Xandr')",
        ),
      search_term: z
        .string()
        .optional()
        .describe("Optional search term to filter seats by name"),
    }),
  }) as const;

export { getDSPSeatsTool as default };
