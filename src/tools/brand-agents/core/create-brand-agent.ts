import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  CreateBrandAgentParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const createBrandAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "brand-agent-management",
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
    // Check session context first, then fall back to environment variable
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      return createAuthErrorResponse();
    }

    try {
      const brandAgent = await client.createBrandAgent(apiKey, {
        name: args.name,
        description: args.description,
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
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to create brand agent", error);
    }
  },

  name: "create_brand_agent",
  parameters: z.object({
    name: z.string().describe("Name of the brand agent (advertiser account)"),
    description: z
      .string()
      .optional()
      .describe("Optional description of the brand agent"),
  }),
});