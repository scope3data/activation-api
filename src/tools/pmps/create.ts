import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const createBrandAgentPMPTool = (client: Scope3ApiClient) =>
  ({
    description:
      "Create a Private Marketplace deal with natural language prompt. The backend will intelligently parse the prompt to extract inventory requirements, targeting, and pricing.",
    execute: async (
      {
        brand_agent_id,
        name,
        prompt,
      }: {
        brand_agent_id: string;
        name?: string;
        prompt: string;
      },
      context: MCPToolExecuteContext,
    ) => {
      // Check session context first, then fall back to environment variable
      let apiKey = context.session?.scope3ApiKey;

      if (!apiKey) {
        apiKey = process.env.SCOPE3_API_KEY;
      }

      if (!apiKey) {
        return createAuthErrorResponse();
      }

      try {
        const pmp = await client.createBrandAgentPMP(apiKey, {
          brandAgentId: brand_agent_id,
          name,
          prompt,
        });

        // Format deal IDs prominently
        const dealIdsList = pmp.dealIds
          .map((d) => `  • **${d.ssp}**: ${d.dealId} (${d.status})`)
          .join("\n");

        const statusIcon = pmp.status === "active" ? "✅" : "⏸️";
        const statusText = pmp.status === "active" ? "Active" : "Paused";

        const response =
          `${statusIcon} **PMP Created Successfully!**\n\n` +
          `**PMP ID:** ${pmp.id}\n` +
          `**Name:** ${pmp.name}\n` +
          `**Status:** ${statusText}\n\n` +
          `**Deal IDs:**\n${dealIdsList}\n\n` +
          `**Summary:**\n${pmp.summary}\n\n` +
          `*Note: Deal IDs marked as 'pending' are being set up and will be active within 24 hours. Active deals are ready for immediate use.*`;

        return createMCPResponse({
          message: response,
          success: true,
        });
      } catch (error) {
        return createErrorResponse("Error creating PMP", error);
      }
    },
    name: "pmp/create",
    parameters: z.object({
      brand_agent_id: z
        .string()
        .describe("Brand agent ID that will own this PMP"),
      name: z
        .string()
        .optional()
        .describe("Optional name for the PMP (auto-generated if not provided)"),
      prompt: z
        .string()
        .describe(
          "Natural language description of PMP requirements (e.g., 'Create PMP with CTV inventory from Hulu and Fox News targeting tall people audience')",
        ),
    }),
  }) as const;

export { createBrandAgentPMPTool as default };
