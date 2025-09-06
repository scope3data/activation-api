import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  ListBrandAgentCreativesParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const listBrandAgentCreativesTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "data-retrieval",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Brand Agent Creatives",
  },

  description:
    "List all creative assets for a specific brand agent (advertiser account). Shows creative details including type, URLs, and metadata. These creatives can be assigned to any campaign within the same brand agent. Requires authentication.",

  execute: async (
    args: ListBrandAgentCreativesParams,
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

      const creatives = await client.listBrandAgentCreatives(apiKey, args.brandAgentId);

      if (creatives.length === 0) {
        return createMCPResponse({
          message: `No creatives found for brand agent "${brandAgentName}". Create your first creative asset to get started!`,
          success: true,
        });
      }

      let summary = `Found ${creatives.length} creative${creatives.length === 1 ? '' : 's'} for brand agent **${brandAgentName}**:\n\n`;
      
      creatives.forEach((creative, index) => {
        summary += `**${index + 1}. ${creative.name}**\n`;
        summary += `   • ID: ${creative.id}\n`;
        summary += `   • Type: ${creative.type}\n`;
        summary += `   • URL: ${creative.url}\n`;
        
        if (creative.headline) {
          summary += `   • Headline: "${creative.headline}"\n`;
        }
        if (creative.body) {
          const bodyPreview = creative.body.length > 60 ? creative.body.substring(0, 60) + '...' : creative.body;
          summary += `   • Body: "${bodyPreview}"\n`;
        }
        if (creative.cta) {
          summary += `   • CTA: "${creative.cta}"\n`;
        }
        
        summary += `   • Created: ${new Date(creative.createdAt).toLocaleString()}\n`;
        summary += `   • Updated: ${new Date(creative.updatedAt).toLocaleString()}\n`;
        
        if (index < creatives.length - 1) {
          summary += `\n`;
        }
      });

      // Add summary statistics
      const typeCounts = creatives.reduce((counts, creative) => {
        counts[creative.type] = (counts[creative.type] || 0) + 1;
        return counts;
      }, {} as Record<string, number>);

      summary += `\n📊 **Creative Type Summary:**\n`;
      Object.entries(typeCounts).forEach(([type, count]) => {
        summary += `   • ${type}: ${count}\n`;
      });

      const creativesWithHeadlines = creatives.filter(c => c.headline).length;
      const creativesWithBody = creatives.filter(c => c.body).length;
      const creativesWithCTA = creatives.filter(c => c.cta).length;

      summary += `\n📝 **Content Summary:**\n`;
      summary += `   • With headlines: ${creativesWithHeadlines}/${creatives.length}\n`;
      summary += `   • With body text: ${creativesWithBody}/${creatives.length}\n`;
      summary += `   • With call-to-action: ${creativesWithCTA}/${creatives.length}\n`;

      summary += `\n💡 **Usage Tips:**\n`;
      summary += `   • Use creative IDs when creating or updating campaigns\n`;
      summary += `   • Different creative types work better for different campaign objectives\n`;
      summary += `   • Consider creating multiple creative variants for A/B testing\n`;
      
      if (creatives.some(c => c.type === 'native' && (!c.headline || !c.body))) {
        summary += `   • Native creatives work best with both headlines and body text\n`;
      }

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to fetch creatives", error);
    }
  },

  name: "list_creatives",
  parameters: z.object({
    brandAgentId: z.string().describe("ID of the brand agent to list creatives for"),
  }),
});