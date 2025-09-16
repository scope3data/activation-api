import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createMCPResponse } from "../../utils/error-handling.js";

export const createPMPTool = (client: Scope3ApiClient) =>
  ({
    annotations: {
      category: "PMPs",
      dangerLevel: "medium",
      openWorldHint: true,
      readOnlyHint: false,
      title: "Create PMP",
    },
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
        throw new Error(
          "Authentication required. Please set the SCOPE3_API_KEY environment variable or provide via headers.",
        );
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
          data: {
            pmp,
            configuration: {
              brandAgentId: brand_agent_id,
              name,
              prompt,
            },
            dealIds: pmp.dealIds,
            summary: {
              pmpId: pmp.id,
              pmpName: pmp.name,
              status: pmp.status,
              totalDeals: pmp.dealIds.length,
              activeDeals: pmp.dealIds.filter(d => d.status === "active").length,
              pendingDeals: pmp.dealIds.filter(d => d.status === "pending").length,
              sspList: [...new Set(pmp.dealIds.map(d => d.ssp))],
            },
          },
        });
      } catch (error) {
        throw new Error(
          `Error creating PMP: ${error instanceof Error ? error.message : String(error)}`,
        );
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

export { createPMPTool as default };
