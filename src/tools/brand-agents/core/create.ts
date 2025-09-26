import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  CreateBrandAgentParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import { requireSessionAuth } from "../../../utils/auth.js";
import { createMCPResponse } from "../../../utils/error-handling.js";

export const createBrandAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Brand Agents",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Brand Agent",
  },

  description:
    "Create a new brand agent (advertiser account). This creates the top-level container that will own campaigns, creatives, audiences, standards, and measurement sources. Requires authentication.",

  execute: async (
    args: CreateBrandAgentParams,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Universal session authentication check
    const { apiKey, customerId: _customerId } = requireSessionAuth(context);

    try {
      const brandAgent = await client.createBrandAgent(apiKey, {
        advertiserDomains: args.advertiserDomains,
        description: args.description,
        externalId: args.externalId,
        name: args.name,
        nickname: args.nickname,
      });

      let summary = `✅ Brand Agent Created Successfully!\n\n`;
      summary += `**Brand Agent Details:**\n`;
      summary += `• ID: ${brandAgent.id}\n`;
      summary += `• Name: ${brandAgent.name}\n`;
      if (brandAgent.description) {
        summary += `• Description: ${brandAgent.description}\n`;
      }
      summary += `• Customer ID: ${brandAgent.customerId}\n`;
      summary += `• Created: ${new Date(brandAgent.createdAt).toLocaleString()}\n\n`;

      summary += `**What's Next?**\n`;
      summary += `You can now:\n`;
      summary += `• Set brand standards for this agent\n`;
      summary += `• Create campaigns within this brand agent\n`;
      summary += `• Add creatives to this brand agent\n`;
      summary += `• Create synthetic audiences for targeting\n`;
      summary += `• Configure measurement sources\n\n`;

      summary += `Use the brand agent ID \`${brandAgent.id}\` for all subsequent operations.`;

      return createMCPResponse({
        data: { brandAgent },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to create brand agent: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "brand_agent_create",
  parameters: z.object({
    advertiserDomains: z
      .array(z.string())
      .describe(
        "Domains where users will be sent from all campaigns/creatives",
      ),
    description: z
      .string()
      .optional()
      .describe("Optional description of the brand agent"),
    externalId: z
      .string()
      .optional()
      .describe(
        "Your internal ID for this brand agent (e.g., client code or account ID)",
      ),
    name: z.string().describe("Name of the brand agent (advertiser account)"),
    nickname: z
      .string()
      .optional()
      .describe(
        "Friendly name for easy identification (e.g., 'Nike' for 'Nike c/o Kinesso')",
      ),
  }),
});
