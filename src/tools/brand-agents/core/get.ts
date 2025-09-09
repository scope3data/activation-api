import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  GetBrandAgentParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const getBrandAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "data-retrieval",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Get Brand Agent",
  },

  description:
    "Get detailed information about a specific brand agent (advertiser account) by ID. Requires authentication.",

  execute: async (
    args: GetBrandAgentParams,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check session context first, then fall back to environment variable
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      return createAuthErrorResponse();
    }

    try {
      const brandAgent = await client.getBrandAgent(apiKey, args.brandAgentId);

      let summary = `**Brand Agent Details**\n\n`;
      summary += `• **Name:** ${brandAgent.name}\n`;
      summary += `• **ID:** ${brandAgent.id}\n`;
      if (brandAgent.description) {
        summary += `• **Description:** ${brandAgent.description}\n`;
      }
      summary += `• **Customer ID:** ${brandAgent.customerId}\n`;
      summary += `• **Created:** ${new Date(brandAgent.createdAt).toLocaleString()}\n`;
      summary += `• **Last Updated:** ${new Date(brandAgent.updatedAt).toLocaleString()}\n\n`;

      summary += `**Available Actions:**\n`;
      summary += `• Create campaigns for this brand agent\n`;
      summary += `• Add creatives to this brand agent\n`;
      summary += `• Set brand standards and safety rules\n`;
      summary += `• Create synthetic audiences for targeting\n`;
      summary += `• Configure measurement sources\n`;
      summary += `• Update brand agent details\n`;
      summary += `• Delete brand agent (removes all associated data)`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to fetch brand agent", error);
    }
  },

  name: "brand-agent/get",
  parameters: z.object({
    brandAgentId: z.string().describe("ID of the brand agent to retrieve"),
  }),
});
