import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const listBrandAgentStoriesTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "audience-management",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Brand Agent Stories",
  },

  description:
    "List all brand story agents for a brand agent. Brand story agents define brand narrative, messaging, and audience engagement strategies using AI-powered prompts. Each agent has a primary model that contains the current brand story and can be applied to audience targeting and content creation. Requires authentication.",

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

      const storyAgents = await client.listBrandAgentStories(
        apiKey,
        args.brandAgentId,
      );

      let summary = `**Brand Stories for ${brandAgentName}**\n\n`;
      summary += `**Brand Agent ID:** ${args.brandAgentId}\n`;
      summary += `**Found:** ${storyAgents.length} story agent${storyAgents.length === 1 ? "" : "s"}\n\n`;

      if (storyAgents.length === 0) {
        summary += `⚠️  **No Brand Stories Configured**\n\n`;
        summary += `This brand agent currently has no brand story agents.\n\n`;
        summary += `**Next Steps:**\n`;
        summary += `• Use \`create_brand_agent_story\` to create a new story agent\n`;
        summary += `• Define brand narrative through natural language prompts\n`;
        summary += `• Configure targeting (countries, channels, languages)\n\n`;
        summary += `**Benefits:**\n`;
        summary += `• AI-powered audience insights and messaging\n`;
        summary += `• Consistent brand voice across all campaigns\n`;
        summary += `• Automatic application to campaign strategies`;
      } else {
        storyAgents.forEach((agent, index) => {
          const primaryModel = agent.models.find(
            (model) => model.status === "PRIMARY",
          );

          summary += `**${index + 1}. ${agent.name}**\n`;
          summary += `   • **ID:** ${agent.id}\n`;
          summary += `   • **Countries:** ${agent.countries.length > 0 ? agent.countries.join(", ") : "All"}\n`;
          summary += `   • **Channels:** ${agent.channels.length > 0 ? agent.channels.join(", ") : "All"}\n`;
          summary += `   • **Languages:** ${agent.languages.length > 0 ? agent.languages.join(", ") : "All"}\n`;

          if (primaryModel) {
            summary += `   • **Current Story:** "${primaryModel.prompt.substring(0, 100)}${primaryModel.prompt.length > 100 ? "..." : ""}"\n`;
            summary += `   • **Last Updated:** ${new Date(primaryModel.updatedAt).toLocaleString()}\n`;
          } else {
            summary += `   • **Status:** ⚠️  No primary model configured\n`;
          }

          summary += `   • **Created:** ${new Date(agent.createdAt).toLocaleString()}\n\n`;
        });

        summary += `📋 **Management Options:**\n`;
        summary += `• \`create_brand_agent_story\` - Create a new story agent\n`;
        summary += `• \`update_brand_agent_story\` - Update existing story prompt\n`;
        summary += `• \`delete_brand_agent_story\` - Archive a story agent\n\n`;

        summary += `🎯 **How Stories Work:**\n`;
        summary += `• Each agent uses AI to define brand narrative and messaging\n`;
        summary += `• Primary model contains the current active brand story\n`;
        summary += `• Stories inform audience targeting and content creation\n`;
        summary += `• Multiple story agents can target different markets/channels`;
      }

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to list brand story agents", error);
    }
  },

  name: "list_brand_agent_stories",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to list stories for"),
  }),
});
