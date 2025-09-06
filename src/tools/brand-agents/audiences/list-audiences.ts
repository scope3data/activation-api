import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  ListSyntheticAudiencesParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const listSyntheticAudiencesTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "data-retrieval",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Synthetic Audiences",
  },

  description:
    "List all synthetic audiences for a specific brand agent. Shows audience profiles that can be assigned to campaigns for targeting. These audiences represent customer or prospect profiles for better campaign targeting. Requires authentication.",

  execute: async (
    args: ListSyntheticAudiencesParams,
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

      const audiences = await client.listSyntheticAudiences(apiKey, args.brandAgentId);

      if (audiences.length === 0) {
        return createMCPResponse({
          message: `No synthetic audiences found for brand agent "${brandAgentName}".\n\n` +
                  `🎯 **Why Create Synthetic Audiences?**\n` +
                  `• Better targeting across campaigns\n` +
                  `• Consistent audience definitions\n` +
                  `• Improved campaign performance\n` +
                  `• Cross-publisher audience matching\n\n` +
                  `Create your first synthetic audience to get started with advanced targeting!`,
          success: true,
        });
      }

      let summary = `Found ${audiences.length} synthetic audience${audiences.length === 1 ? '' : 's'} for brand agent **${brandAgentName}**:\n\n`;
      
      audiences.forEach((audience, index) => {
        summary += `**${index + 1}. ${audience.name}**\n`;
        summary += `   • ID: ${audience.id}\n`;
        if (audience.description) {
          summary += `   • Description: ${audience.description}\n`;
        }
        summary += `   • Created: ${new Date(audience.createdAt).toLocaleString()}\n`;
        summary += `   • Updated: ${new Date(audience.updatedAt).toLocaleString()}\n`;
        
        if (index < audiences.length - 1) {
          summary += `\n`;
        }
      });

      summary += `\n🎯 **Audience Management:**\n`;
      summary += `• Use audience IDs when creating or updating campaigns\n`;
      summary += `• Audiences can be shared across multiple campaigns\n`;
      summary += `• Each audience represents a specific target profile\n`;
      summary += `• Consistent audience definitions improve targeting accuracy\n\n`;

      summary += `📊 **Usage Tips:**\n`;
      summary += `• Create different audiences for different campaign objectives\n`;
      summary += `• Use descriptive names to easily identify audience purposes\n`;
      summary += `• Consider creating audience variants for A/B testing\n`;
      summary += `• Monitor campaign performance by audience to optimize targeting\n\n`;

      summary += `🚧 **Current Status:** Basic audience management (stub implementation)\n`;
      summary += `**Coming Soon:**\n`;
      summary += `• Advanced demographic and psychographic profiling\n`;
      summary += `• Behavioral targeting parameters\n`;
      summary += `• Interest and intent mapping\n`;
      summary += `• Lookalike audience generation\n`;
      summary += `• Performance analytics by audience segment`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to fetch synthetic audiences", error);
    }
  },

  name: "list_audiences",
  parameters: z.object({
    brandAgentId: z.string().describe("ID of the brand agent to list audiences for"),
  }),
});