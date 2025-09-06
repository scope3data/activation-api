import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  UpdateBrandAgentCreativeParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const updateBrandAgentCreativeTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "creative-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Update Brand Agent Creative",
  },

  description:
    "Update an existing creative asset's details including name, type, URL, headline, body text, or call-to-action. This tool supports partial updates - only provide the fields you want to change. Changes affect all campaigns using this creative. Requires authentication.",

  execute: async (
    args: UpdateBrandAgentCreativeParams,
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
      const updateInput: any = {};
      const changes: string[] = [];
      
      // Build update input with only provided fields
      if (args.name !== undefined) {
        updateInput.name = args.name;
        changes.push(`Name updated to: "${args.name}"`);
      }
      if (args.type !== undefined) {
        updateInput.type = args.type;
        changes.push(`Type updated to: ${args.type}`);
      }
      if (args.url !== undefined) {
        updateInput.url = args.url;
        changes.push(`URL updated`);
      }
      if (args.headline !== undefined) {
        updateInput.headline = args.headline;
        changes.push(args.headline ? `Headline updated to: "${args.headline}"` : 'Headline removed');
      }
      if (args.body !== undefined) {
        updateInput.body = args.body;
        changes.push(args.body ? `Body text updated` : 'Body text removed');
      }
      if (args.cta !== undefined) {
        updateInput.cta = args.cta;
        changes.push(args.cta ? `Call-to-action updated to: "${args.cta}"` : 'Call-to-action removed');
      }

      // Check if there are actually fields to update
      if (Object.keys(updateInput).length === 0) {
        return createMCPResponse({
          message: "No changes specified. Please provide at least one field to update (name, type, url, headline, body, or cta).",
          success: false,
        });
      }

      const updatedCreative = await client.updateBrandAgentCreative(
        apiKey,
        args.creativeId,
        updateInput,
      );

      let summary = `✅ Creative Updated Successfully!\n\n`;
      summary += `**Updated Creative:**\n`;
      summary += `• **Name:** ${updatedCreative.name}\n`;
      summary += `• **ID:** ${updatedCreative.id}\n`;
      summary += `• **Brand Agent ID:** ${updatedCreative.brandAgentId}\n`;
      summary += `• **Type:** ${updatedCreative.type}\n`;
      summary += `• **URL:** ${updatedCreative.url}\n`;
      
      if (updatedCreative.headline) {
        summary += `• **Headline:** ${updatedCreative.headline}\n`;
      }
      if (updatedCreative.body) {
        summary += `• **Body:** ${updatedCreative.body}\n`;
      }
      if (updatedCreative.cta) {
        summary += `• **Call-to-Action:** ${updatedCreative.cta}\n`;
      }
      
      summary += `• **Last Updated:** ${new Date(updatedCreative.updatedAt).toLocaleString()}\n`;

      summary += `\n**Changes Made:**\n`;
      changes.forEach((change, index) => {
        summary += `   ${index + 1}. ${change}\n`;
      });

      // Add type-specific guidance if type was changed
      if (args.type) {
        summary += `\n**Type Change Guidance:**\n`;
        switch (args.type) {
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
            if (!updatedCreative.headline || !updatedCreative.body) {
              summary += `• ⚠️ Consider adding headline and body text for better native performance\n`;
            }
            break;
          case 'html5':
            summary += `• HTML5 creatives support rich interactive experiences\n`;
            summary += `• Ensure compatibility across different devices\n`;
            break;
        }
      }

      summary += `\n⚠️ **Impact:** These changes will affect all campaigns currently using this creative.`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to update creative", error);
    }
  },

  name: "update_creative",
  parameters: z.object({
    creativeId: z.string().describe("ID of the creative to update"),
    name: z
      .string()
      .optional()
      .describe("New name for the creative"),
    type: z
      .enum(['image', 'video', 'native', 'html5'])
      .optional()
      .describe("New creative type: image, video, native, or html5"),
    url: z
      .string()
      .optional()
      .describe("New URL where the creative asset is hosted"),
    headline: z
      .string()
      .optional()
      .describe("New headline text (use empty string to remove)"),
    body: z
      .string()
      .optional()
      .describe("New body text (use empty string to remove)"),
    cta: z
      .string()
      .optional()
      .describe("New call-to-action text (use empty string to remove)"),
  }),
});