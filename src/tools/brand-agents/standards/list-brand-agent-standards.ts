import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const listBrandAgentStandardsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "brand-safety",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Brand Agent Standards",
  },

  description:
    "List all brand safety standards agents for a brand agent. Brand standards agents define safety rules and filtering criteria using AI-powered prompts. Each agent has a primary model that contains the current safety guidelines and can be applied across campaigns. Requires authentication.",

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

      const standardsAgents = await client.listBrandAgentStandards(
        apiKey,
        args.brandAgentId,
      );

      let summary = `**Brand Standards for ${brandAgentName}**\n\n`;
      summary += `**Brand Agent ID:** ${args.brandAgentId}\n`;
      summary += `**Found:** ${standardsAgents.length} standards agent${standardsAgents.length === 1 ? "" : "s"}\n\n`;

      if (standardsAgents.length === 0) {
        summary += `⚠️  **No Brand Standards Configured**\n\n`;
        summary += `This brand agent currently has no brand safety standards agents.\n\n`;
        summary += `**Next Steps:**\n`;
        summary += `• Use \`create_brand_agent_standards\` to create a new standards agent\n`;
        summary += `• Define safety rules through natural language prompts\n`;
        summary += `• Configure targeting (countries, channels, languages)\n\n`;
        summary += `**Benefits:**\n`;
        summary += `• AI-powered content filtering and classification\n`;
        summary += `• Consistent brand safety across all campaigns\n`;
        summary += `• Automatic application to new campaigns`;
      } else {
        standardsAgents.forEach((agent, index) => {
          const primaryModel = agent.models.find(
            (model) => model.status === "PRIMARY",
          );

          summary += `**${index + 1}. ${agent.name}**\n`;
          summary += `   • **ID:** ${agent.id}\n`;
          summary += `   • **Countries:** ${agent.countries.length > 0 ? agent.countries.join(", ") : "All"}\n`;
          summary += `   • **Channels:** ${agent.channels.length > 0 ? agent.channels.join(", ") : "All"}\n`;
          summary += `   • **Languages:** ${agent.languages.length > 0 ? agent.languages.join(", ") : "All"}\n`;

          if (primaryModel) {
            summary += `   • **Current Prompt:** "${primaryModel.prompt.substring(0, 100)}${primaryModel.prompt.length > 100 ? "..." : ""}"\n`;
            summary += `   • **Last Updated:** ${new Date(primaryModel.updatedAt).toLocaleString()}\n`;
          } else {
            summary += `   • **Status:** ⚠️  No primary model configured\n`;
          }

          summary += `   • **Created:** ${new Date(agent.createdAt).toLocaleString()}\n\n`;
        });

        summary += `📋 **Management Options:**\n`;
        summary += `• \`create_brand_agent_standards\` - Create a new standards agent\n`;
        summary += `• \`update_brand_agent_standards\` - Update existing agent prompt\n`;
        summary += `• \`delete_brand_agent_standards\` - Archive a standards agent\n\n`;

        summary += `🛡️ **How Standards Work:**\n`;
        summary += `• Each agent uses AI to classify content against brand safety rules\n`;
        summary += `• Primary model contains the current active safety guidelines\n`;
        summary += `• Standards automatically apply to all campaigns in this brand agent\n`;
        summary += `• Multiple standards agents can target different markets/channels`;
      }

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        "Failed to list brand standards agents",
        error,
      );
    }
  },

  name: "list_brand_agent_standards",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to list standards for"),
  }),
});
