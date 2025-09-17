import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { BrandAgentWhereInput } from "../../../types/brand-agent.js";
import type {
  ListBrandAgentsParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import { createMCPResponse } from "../../../utils/error-handling.js";

export const listBrandAgentsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Brand Agents",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Brand Agents",
  },

  description:
    "List all brand agents (advertiser accounts) for the authenticated user. Optionally filter by name or customer ID. Requires authentication.",

  execute: async (
    args: ListBrandAgentsParams,
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

    try {
      // Convert simple parameter format to GraphQL input format
      const whereInput: BrandAgentWhereInput | undefined = args.where
        ? {
            customerId: args.where.customerId
              ? { equals: args.where.customerId }
              : undefined,
            name: args.where.name ? { contains: args.where.name } : undefined,
          }
        : undefined;

      const brandAgents = await client.listBrandAgents(apiKey, whereInput);

      if (brandAgents.length === 0) {
        return createMCPResponse({
          data: {
            brandAgents: [],
            count: 0,
          },
          message:
            "No brand agents found. Create your first brand agent to get started!",
          success: true,
        });
      }

      let summary = `Found ${brandAgents.length} brand agent${brandAgents.length === 1 ? "" : "s"}:\n\n`;

      brandAgents.forEach((agent, index) => {
        summary += `**${index + 1}. ${agent.name}**\n`;
        summary += `   • ID: ${agent.id}\n`;
        if (agent.description) {
          summary += `   • Description: ${agent.description}\n`;
        }
        summary += `   • Customer: ${agent.customerId}\n`;
        summary += `   • Created: ${new Date(agent.createdAt).toLocaleString()}\n`;
        summary += `   • Last Updated: ${new Date(agent.updatedAt).toLocaleString()}\n`;
        if (index < brandAgents.length - 1) {
          summary += `\n`;
        }
      });

      summary += `\n💡 **Tip:** Use the brand agent ID to create campaigns, creatives, or manage settings for any of these agents.`;

      return createMCPResponse({
        data: {
          brandAgents,
          count: brandAgents.length,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to fetch brand agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "brand-agent/list",
  parameters: z.object({
    where: z
      .object({
        customerId: z.number().optional().describe("Filter by customer ID"),
        name: z
          .string()
          .optional()
          .describe("Filter by brand agent name (partial match)"),
      })
      .optional()
      .describe("Optional filters for brand agents"),
  }),
});
