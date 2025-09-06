import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  CreateBrandAgentCampaignParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const createBrandAgentCampaignTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "campaign-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Brand Agent Campaign",
  },

  description:
    "Create a new campaign within a brand agent (advertiser account). The campaign will be owned by the specified brand agent and can optionally include creatives and audiences that belong to the same brand agent. Follows the create/update pattern for creative assignment. Requires authentication.",

  execute: async (
    args: CreateBrandAgentCampaignParams,
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
      // First, verify the brand agent exists
      let brandAgentName: string;
      try {
        const brandAgent = await client.getBrandAgent(apiKey, args.brandAgentId);
        brandAgentName = brandAgent.name;
      } catch (fetchError) {
        return createErrorResponse(
          "Brand agent not found. Please check the brand agent ID.",
          fetchError,
        );
      }

      const campaignInput = {
        brandAgentId: args.brandAgentId,
        name: args.name,
        prompt: args.prompt,
        budget: args.budget,
        creativeIds: args.creativeIds || [],
        audienceIds: args.audienceIds || [],
      };

      const campaign = await client.createBrandAgentCampaign(apiKey, campaignInput);

      let summary = `✅ Campaign Created Successfully!\n\n`;
      summary += `**Campaign Details:**\n`;
      summary += `• **Name:** ${campaign.name}\n`;
      summary += `• **ID:** ${campaign.id}\n`;
      summary += `• **Brand Agent:** ${brandAgentName} (${campaign.brandAgentId})\n`;
      summary += `• **Prompt:** ${campaign.prompt}\n`;
      
      if (campaign.budget) {
        summary += `• **Budget:** ${campaign.budget.total} ${campaign.budget.currency}`;
        if (campaign.budget.dailyCap) {
          summary += ` (Daily cap: ${campaign.budget.dailyCap} ${campaign.budget.currency})`;
        }
        summary += `\n`;
        if (campaign.budget.pacing) {
          summary += `• **Pacing:** ${campaign.budget.pacing}\n`;
        }
      }
      
      summary += `• **Status:** ${campaign.status}\n`;
      summary += `• **Created:** ${new Date(campaign.createdAt).toLocaleString()}\n`;

      // Show creative assignments
      if (campaign.creativeIds && campaign.creativeIds.length > 0) {
        summary += `\n**Assigned Creatives:**\n`;
        campaign.creativeIds.forEach((creativeId, index) => {
          summary += `   ${index + 1}. Creative ID: ${creativeId}\n`;
        });
      } else {
        summary += `\n⚠️ **No creatives assigned.** Use update_campaign to assign creatives later.\n`;
      }

      // Show audience assignments
      if (campaign.audienceIds && campaign.audienceIds.length > 0) {
        summary += `\n**Assigned Audiences:**\n`;
        campaign.audienceIds.forEach((audienceId, index) => {
          summary += `   ${index + 1}. Audience ID: ${audienceId}\n`;
        });
      } else {
        summary += `\n💡 **No audiences assigned.** Consider creating synthetic audiences for better targeting.\n`;
      }

      summary += `\n**Next Steps:**\n`;
      summary += `• Assign creatives to the campaign if not done already\n`;
      summary += `• Create or assign synthetic audiences for targeting\n`;
      summary += `• Review and adjust campaign settings as needed\n`;
      summary += `• Activate the campaign when ready\n\n`;
      
      summary += `Campaign is ready for further configuration and activation!`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to create campaign", error);
    }
  },

  name: "create_campaign",
  parameters: z.object({
    brandAgentId: z.string().describe("ID of the brand agent that will own this campaign"),
    name: z.string().describe("Name of the campaign"),
    prompt: z
      .string()
      .describe("Natural language description of campaign objectives and strategy"),
    budget: z
      .object({
        total: z.number().describe("Total campaign budget"),
        currency: z.string().default("USD").describe("Budget currency (default: USD)"),
        dailyCap: z.number().optional().describe("Optional daily spending limit"),
        pacing: z.string().optional().describe("Budget pacing strategy (e.g., 'even', 'asap')"),
      })
      .optional()
      .describe("Campaign budget configuration"),
    creativeIds: z
      .array(z.string())
      .optional()
      .describe("Optional array of creative IDs to assign (must belong to same brand agent)"),
    audienceIds: z
      .array(z.string())
      .optional()
      .describe("Optional array of synthetic audience IDs to assign (must belong to same brand agent)"),
  }),
});