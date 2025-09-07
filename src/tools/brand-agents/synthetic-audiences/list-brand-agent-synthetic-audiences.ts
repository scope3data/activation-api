import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const listBrandAgentSyntheticAudiencesTool = (
  client: Scope3ApiClient,
) => ({
  annotations: {
    category: "audience-management",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Brand Agent Synthetic Audiences",
  },

  description:
    "List all synthetic audience agents for a brand agent. Synthetic audience agents define target audience profiles using AI-powered prompts. Each agent has a primary model that contains the current audience definition and can be applied to campaign targeting and content creation. Requires authentication.",

  execute: async (
    args: { brandAgentId: string },
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
        const brandAgent = await client.getBrandAgent(
          apiKey,
          args.brandAgentId,
        );
        brandAgentName = brandAgent.name;
      } catch (fetchError) {
        return createErrorResponse(
          "Brand agent not found. Please check the brand agent ID.",
          fetchError,
        );
      }

      const syntheticAudiences = await client.listBrandAgentSyntheticAudiences(
        apiKey,
        args.brandAgentId,
      );

      let summary = `**Synthetic Audiences for ${brandAgentName}**\n\n`;
      summary += `**Brand Agent ID:** ${args.brandAgentId}\n`;
      summary += `**Found:** ${syntheticAudiences.length} synthetic audience${syntheticAudiences.length === 1 ? "" : "s"}\n\n`;

      if (syntheticAudiences.length === 0) {
        summary += `⚠️  **No Synthetic Audiences Configured**\n\n`;
        summary += `This brand agent currently has no synthetic audience agents.\n\n`;
        summary += `**Next Steps:**\n`;
        summary += `• Use \`create_brand_agent_synthetic_audience\` to create a new synthetic audience\n`;
        summary += `• Define target audience through natural language prompts\n`;
        summary += `• Configure targeting (countries, channels, languages)\n\n`;
        summary += `**Benefits:**\n`;
        summary += `• AI-powered audience insights and targeting\n`;
        summary += `• Consistent audience profiles across all campaigns\n`;
        summary += `• Automatic application to campaign strategies`;
      } else {
        syntheticAudiences.forEach((agent, index) => {
          const primaryModel = agent.models.find(
            (model) => model.status === "PRIMARY",
          );

          summary += `**${index + 1}. ${agent.name}**\n`;
          summary += `   • **ID:** ${agent.id}\n`;
          summary += `   • **Countries:** ${agent.countries.length > 0 ? agent.countries.join(", ") : "All"}\n`;
          summary += `   • **Channels:** ${agent.channels.length > 0 ? agent.channels.join(", ") : "All"}\n`;
          summary += `   • **Languages:** ${agent.languages.length > 0 ? agent.languages.join(", ") : "All"}\n`;

          if (primaryModel) {
            summary += `   • **Current Definition:** "${primaryModel.prompt.substring(0, 100)}${primaryModel.prompt.length > 100 ? "..." : ""}"\n`;
            summary += `   • **Last Updated:** ${new Date(primaryModel.updatedAt).toLocaleString()}\n`;
          } else {
            summary += `   • **Status:** ⚠️  No primary model configured\n`;
          }

          summary += `   • **Created:** ${new Date(agent.createdAt).toLocaleString()}\n\n`;
        });

        summary += `📋 **Management Options:**\n`;
        summary += `• \`create_brand_agent_synthetic_audience\` - Create a new synthetic audience\n`;
        summary += `• \`update_brand_agent_synthetic_audience\` - Update existing audience prompt\n`;
        summary += `• \`delete_brand_agent_synthetic_audience\` - Archive a synthetic audience\n\n`;

        summary += `🎯 **How Synthetic Audiences Work:**\n`;
        summary += `• Each agent uses AI to define target audience profiles\n`;
        summary += `• Primary model contains the current active audience definition\n`;
        summary += `• Audiences inform campaign targeting and content creation\n`;
        summary += `• Multiple synthetic audiences can target different markets/channels`;
      }

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        "Failed to list brand synthetic audiences",
        error,
      );
    }
  },

  name: "list_brand_agent_synthetic_audiences",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to list synthetic audiences for"),
  }),
});
