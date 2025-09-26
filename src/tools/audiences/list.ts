import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  ListSyntheticAudiencesParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";

import { requireSessionAuth } from "../../utils/auth.js";
import { createMCPResponse } from "../../utils/error-handling.js";

export const listSyntheticAudiencesTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "System",
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
    // Universal session authentication check
    const { apiKey, customerId: _customerId } = requireSessionAuth(context);

    try {
      // First, verify the brand agent exists and get its name
      let brandAgentName: string;
      try {
        const brandAgent = await client.getBrandAgent(
          apiKey,
          args.brandAgentId,
        );
        brandAgentName = brandAgent.name;
      } catch (fetchError) {
        throw new Error(
          `Brand agent not found. Please check the brand agent ID: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        );
      }

      const audiences = await client.listSyntheticAudiences(
        apiKey,
        args.brandAgentId,
      );

      if (audiences.length === 0) {
        return createMCPResponse({
          data: {
            audiences: [],
            brandAgentId: args.brandAgentId,
            brandAgentName,
            count: 0,
          },
          message:
            `No synthetic audiences found for brand agent "${brandAgentName}".\n\n` +
            `🎯 **Why Create Synthetic Audiences?**\n` +
            `• Better targeting across campaigns\n` +
            `• Consistent audience definitions\n` +
            `• Improved campaign performance\n` +
            `• Cross-publisher audience matching\n\n` +
            `Create your first synthetic audience to get started with advanced targeting!`,
          success: true,
        });
      }

      let summary = `Found ${audiences.length} synthetic audience${audiences.length === 1 ? "" : "s"} for brand agent **${brandAgentName}**:\n\n`;

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
        data: {
          audiences,
          brandAgentId: args.brandAgentId,
          brandAgentName,
          count: audiences.length,
          summary: {
            newestAudience:
              audiences.length > 0
                ? new Date(
                    Math.max(
                      ...audiences.map((a) => new Date(a.createdAt).getTime()),
                    ),
                  ).toISOString()
                : undefined,
            oldestAudience:
              audiences.length > 0
                ? new Date(
                    Math.min(
                      ...audiences.map((a) => new Date(a.createdAt).getTime()),
                    ),
                  ).toISOString()
                : undefined,
            totalAudiences: audiences.length,
          },
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to fetch synthetic audiences: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "audience_list",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to list audiences for"),
  }),
});
