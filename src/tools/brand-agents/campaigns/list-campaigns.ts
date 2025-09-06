import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  ListBrandAgentCampaignsParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const listBrandAgentCampaignsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "data-retrieval",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Brand Agent Campaigns",
  },

  description:
    "List all campaigns for a specific brand agent (advertiser account). Optionally filter by campaign status. Shows campaign details including budget, creative assignments, and current status. Requires authentication.",

  execute: async (
    args: ListBrandAgentCampaignsParams,
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
      // First, verify the brand agent exists and get its name
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

      const campaigns = await client.listBrandAgentCampaigns(
        apiKey,
        args.brandAgentId,
        args.status,
      );

      if (campaigns.length === 0) {
        let message = `No campaigns found for brand agent "${brandAgentName}"`;
        if (args.status) {
          message += ` with status "${args.status}"`;
        }
        message += `. Create your first campaign to get started!`;
        
        return createMCPResponse({
          message,
          success: true,
        });
      }

      let summary = `Found ${campaigns.length} campaign${campaigns.length === 1 ? '' : 's'} for brand agent **${brandAgentName}**`;
      if (args.status) {
        summary += ` (status: ${args.status})`;
      }
      summary += `:\n\n`;
      
      campaigns.forEach((campaign, index) => {
        summary += `**${index + 1}. ${campaign.name}**\n`;
        summary += `   • ID: ${campaign.id}\n`;
        summary += `   • Status: ${campaign.status}\n`;
        summary += `   • Prompt: ${campaign.prompt.length > 100 ? campaign.prompt.substring(0, 100) + '...' : campaign.prompt}\n`;
        
        if (campaign.budget) {
          summary += `   • Budget: ${campaign.budget.total} ${campaign.budget.currency}`;
          if (campaign.budget.dailyCap) {
            summary += ` (Daily cap: ${campaign.budget.dailyCap})`;
          }
          summary += `\n`;
        }
        
        if (campaign.creativeIds && campaign.creativeIds.length > 0) {
          summary += `   • Creatives: ${campaign.creativeIds.length} assigned\n`;
        } else {
          summary += `   • Creatives: None assigned ⚠️\n`;
        }
        
        if (campaign.audienceIds && campaign.audienceIds.length > 0) {
          summary += `   • Audiences: ${campaign.audienceIds.length} assigned\n`;
        } else {
          summary += `   • Audiences: None assigned\n`;
        }
        
        summary += `   • Created: ${new Date(campaign.createdAt).toLocaleString()}\n`;
        summary += `   • Updated: ${new Date(campaign.updatedAt).toLocaleString()}\n`;
        
        if (index < campaigns.length - 1) {
          summary += `\n`;
        }
      });

      // Add summary statistics
      const statusCounts = campaigns.reduce((counts, campaign) => {
        counts[campaign.status] = (counts[campaign.status] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      summary += `\n📊 **Campaign Status Summary:**\n`;
      Object.entries(statusCounts).forEach(([status, count]) => {
        summary += `   • ${status}: ${count}\n`;
      });

      const campaignsWithCreatives = campaigns.filter(c => c.creativeIds && c.creativeIds.length > 0).length;
      const campaignsWithAudiences = campaigns.filter(c => c.audienceIds && c.audienceIds.length > 0).length;
      
      summary += `\n💡 **Tips:**\n`;
      summary += `   • ${campaignsWithCreatives}/${campaigns.length} campaigns have creatives assigned\n`;
      summary += `   • ${campaignsWithAudiences}/${campaigns.length} campaigns have audiences assigned\n`;
      if (campaignsWithCreatives < campaigns.length) {
        summary += `   • Consider assigning creatives to campaigns without them\n`;
      }
      if (campaignsWithAudiences < campaigns.length) {
        summary += `   • Consider creating synthetic audiences for better targeting`;
      }

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to fetch campaigns", error);
    }
  },

  name: "list_campaigns",
  parameters: z.object({
    brandAgentId: z.string().describe("ID of the brand agent to list campaigns for"),
    status: z
      .string()
      .optional()
      .describe("Optional filter by campaign status (e.g., 'active', 'paused', 'completed')"),
  }),
});