import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  CreateBrandAgentCreativeParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const createBrandAgentCreativeTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "creative-management",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Brand Agent Creative",
  },

  description:
    "Create a new creative asset within a brand agent (advertiser account). The creative will be owned by the specified brand agent and can be used across multiple campaigns within that brand agent. Supports image, video, native, and HTML5 creative types. Requires authentication.",

  execute: async (
    args: CreateBrandAgentCreativeParams,
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

      const creativeInput = {
        brandAgentId: args.brandAgentId,
        name: args.name,
        type: args.type,
        url: args.url,
        headline: args.headline,
        body: args.body,
        cta: args.cta,
      };

      const creative = await client.createBrandAgentCreative(apiKey, creativeInput);

      let summary = `✅ Creative Created Successfully!\n\n`;
      summary += `**Creative Details:**\n`;
      summary += `• **Name:** ${creative.name}\n`;
      summary += `• **ID:** ${creative.id}\n`;
      summary += `• **Brand Agent:** ${brandAgentName} (${creative.brandAgentId})\n`;
      summary += `• **Type:** ${creative.type}\n`;
      summary += `• **URL:** ${creative.url}\n`;
      
      if (creative.headline) {
        summary += `• **Headline:** ${creative.headline}\n`;
      }
      if (creative.body) {
        summary += `• **Body:** ${creative.body}\n`;
      }
      if (creative.cta) {
        summary += `• **Call-to-Action:** ${creative.cta}\n`;
      }
      
      summary += `• **Created:** ${new Date(creative.createdAt).toLocaleString()}\n\n`;
      
      summary += `**Creative Type Information:**\n`;
      switch (creative.type) {
        case 'image':
          summary += `• Image creatives work well for display campaigns\n`;
          summary += `• Ensure the image meets publisher size requirements\n`;
          break;
        case 'video':
          summary += `• Video creatives are ideal for CTV and video campaigns\n`;
          summary += `• Check video duration and format requirements\n`;
          break;
        case 'native':
          summary += `• Native creatives blend with publisher content\n`;
          summary += `• Headlines and body text are especially important\n`;
          break;
        case 'html5':
          summary += `• HTML5 creatives support rich interactive experiences\n`;
          summary += `• Ensure compatibility across different devices\n`;
          break;
      }

      summary += `\n**Next Steps:**\n`;
      summary += `• Assign this creative to campaigns within the same brand agent\n`;
      summary += `• Review creative performance once campaigns are running\n`;
      summary += `• Create additional creative variants for A/B testing\n\n`;
      
      summary += `The creative is ready to be assigned to campaigns!`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to create creative", error);
    }
  },

  name: "create_creative",
  parameters: z.object({
    brandAgentId: z.string().describe("ID of the brand agent that will own this creative"),
    name: z.string().describe("Name of the creative asset"),
    type: z
      .enum(['image', 'video', 'native', 'html5'])
      .describe("Type of creative: image, video, native, or html5"),
    url: z.string().describe("URL where the creative asset is hosted"),
    headline: z
      .string()
      .optional()
      .describe("Optional headline text for the creative"),
    body: z
      .string()
      .optional()
      .describe("Optional body text for the creative"),
    cta: z
      .string()
      .optional()
      .describe("Optional call-to-action text (e.g., 'Learn More', 'Shop Now')"),
  }),
});