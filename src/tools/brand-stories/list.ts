import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createMCPResponse } from "../../utils/error-handling.js";

export const listBrandAgentBrandStoriesTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Brand Stories",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Brand Agent Brand Stories",
  },

  description:
    "List all brand stories for a brand agent. Brand stories are AI-powered target audience definitions using natural language prompts. Each story has a primary model that contains the current audience definition and can be applied to campaign targeting and content creation. Requires authentication.",

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
      throw new Error(
        "Authentication required. Please set the SCOPE3_API_KEY environment variable or provide via headers.",
      );
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
        throw new Error(
          `Brand agent not found. Please check the brand agent ID: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
        );
      }

      const brandStories = await client.listBrandAgentSyntheticAudiences(
        apiKey,
        args.brandAgentId,
      );

      let summary = `**Brand Stories for ${brandAgentName}**\n\n`;
      summary += `**Brand Agent ID:** ${args.brandAgentId}\n`;
      summary += `**Found:** ${brandStories.length} brand stor${brandStories.length === 1 ? "y" : "ies"}\n\n`;

      if (brandStories.length === 0) {
        summary += `⚠️  **No Brand Stories Configured**\n\n`;
        summary += `This brand agent currently has no brand stories.\n\n`;
        summary += `**Next Steps:**\n`;
        summary += `• Use \`create_brand_agent_brand_story\` to create a new brand story\n`;
        summary += `• Define target audience through natural language prompts\n`;
        summary += `• Configure targeting (countries, channels, languages)\n\n`;
        summary += `**Benefits:**\n`;
        summary += `• AI-powered audience insights and targeting\n`;
        summary += `• Consistent audience profiles across all campaigns\n`;
        summary += `• Automatic application to campaign strategies`;
      } else {
        brandStories.forEach((story, index) => {
          const primaryModel = story.models.find(
            (model) => model.status === "PRIMARY",
          );

          summary += `**${index + 1}. ${story.name}**\n`;
          summary += `   • **ID:** ${story.id}\n`;
          summary += `   • **Countries:** ${story.countries.length > 0 ? story.countries.join(", ") : "All"}\n`;
          summary += `   • **Channels:** ${story.channels.length > 0 ? story.channels.join(", ") : "All"}\n`;
          summary += `   • **Languages:** ${story.languages.length > 0 ? story.languages.join(", ") : "All"}\n`;

          if (primaryModel) {
            summary += `   • **Current Definition:** "${primaryModel.prompt.substring(0, 100)}${primaryModel.prompt.length > 100 ? "..." : ""}"\n`;
            summary += `   • **Last Updated:** ${new Date(primaryModel.updatedAt).toLocaleString()}\n`;
          } else {
            summary += `   • **Status:** ⚠️  No primary model configured\n`;
          }

          summary += `   • **Created:** ${new Date(story.createdAt).toLocaleString()}\n\n`;
        });

        summary += `📋 **Management Options:**\n`;
        summary += `• \`create_brand_agent_brand_story\` - Create a new brand story\n`;
        summary += `• \`update_brand_agent_brand_story\` - Update existing brand story prompt\n`;
        summary += `• \`delete_brand_agent_brand_story\` - Archive a brand story\n\n`;

        summary += `🎯 **How Brand Stories Work:**\n`;
        summary += `• Each story uses AI to define target audience profiles\n`;
        summary += `• Primary model contains the current active audience definition\n`;
        summary += `• Brand stories inform campaign targeting and content creation\n`;
        summary += `• Multiple brand stories can target different markets/channels`;
      }

      return createMCPResponse({
        data: {
          brandAgentId: args.brandAgentId,
          brandAgentName,
          brandStories,
          count: brandStories.length,
          statistics: {
            totalModels: brandStories.reduce(
              (sum, story) => sum + story.models.length,
              0,
            ),
            totalStories: brandStories.length,
            withoutPrimaryModel: brandStories.filter(
              (story) =>
                !story.models.some((model) => model.status === "PRIMARY"),
            ).length,
            withPrimaryModel: brandStories.filter((story) =>
              story.models.some((model) => model.status === "PRIMARY"),
            ).length,
          },
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to list brand stories: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "brand_story_list",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to list brand stories for"),
  }),
});
