import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const createBrandAgentStoryTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "audience-management",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Brand Agent Story",
  },

  description:
    "Create a new brand story agent for a brand agent. The story agent uses AI to define brand narrative, messaging strategy, and audience engagement approaches based on a natural language prompt. You can describe your brand story, target audience insights, and messaging preferences through conversational prompts. The agent will automatically inform campaign strategies within the brand agent. Requires authentication.",

  execute: async (
    args: {
      brandAgentId: string;
      brands?: string[];
      channels?: string[];
      countries?: string[];
      languages?: string[];
      name: string;
      prompt: string;
    },
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

      const input = {
        brandAgentId: args.brandAgentId,
        brands: args.brands || [],
        channelCodes: args.channels || [],
        countryCodes: args.countries || [],
        languages: args.languages || [],
        name: args.name,
        prompt: args.prompt,
      };

      const storyAgent = await client.createBrandAgentStory(apiKey, input);

      let summary = `✅ **Brand Story Agent Created Successfully!**\n\n`;
      summary += `**Brand Agent:** ${brandAgentName} (${args.brandAgentId})\n`;
      summary += `**Story Agent:** ${storyAgent.name}\n`;
      summary += `**Story ID:** ${storyAgent.id}\n`;
      summary += `**Created:** ${new Date(storyAgent.createdAt).toLocaleString()}\n\n`;

      summary += `🎯 **Targeting Configuration:**\n`;
      summary += `• **Countries:** ${storyAgent.countries.length > 0 ? storyAgent.countries.join(", ") : "All countries"}\n`;
      summary += `• **Channels:** ${storyAgent.channels.length > 0 ? storyAgent.channels.join(", ") : "All channels"}\n`;
      summary += `• **Languages:** ${storyAgent.languages.length > 0 ? storyAgent.languages.join(", ") : "All languages"}\n`;
      summary += `• **Brands:** ${storyAgent.brands.length > 0 ? storyAgent.brands.join(", ") : "All brands"}\n\n`;

      summary += `📖 **Brand Story Prompt:**\n`;
      summary += `"${args.prompt}"\n\n`;

      summary += `📋 **What Happens Next:**\n`;
      summary += `• The AI model is learning your brand story and messaging strategy\n`;
      summary += `• Once ready, it will inform audience targeting and content creation\n`;
      summary += `• All campaigns in this brand agent can leverage this story\n`;
      summary += `• New campaigns will consider this narrative in strategy development\n\n`;

      summary += `🎨 **Story Applications:**\n`;
      summary += `• **Audience Targeting:** Inform synthetic audience creation\n`;
      summary += `• **Campaign Strategy:** Guide campaign messaging and positioning\n`;
      summary += `• **Content Creation:** Influence creative direction and tone\n`;
      summary += `• **Market Segmentation:** Help identify relevant customer segments\n\n`;

      summary += `🔧 **Management:**\n`;
      summary += `• Use \`update_brand_agent_story\` to refine the brand narrative\n`;
      summary += `• Use \`list_brand_agent_stories\` to see all configured stories\n`;
      summary += `• Use \`delete_brand_agent_story\` to archive this agent\n\n`;

      summary += `💡 **Pro Tip:** You can create multiple story agents for different market segments, product lines, or campaign themes within the same brand agent.`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to create brand story agent", error);
    }
  },

  name: "create_brand_agent_story",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to create a story for"),
    brands: z
      .array(z.string())
      .optional()
      .describe(
        "List of specific brands this story applies to (leave empty for all brands)",
      ),
    channels: z
      .array(z.string())
      .optional()
      .describe(
        "List of channels to target (e.g., ['web', 'social', 'mobile'])",
      ),
    countries: z
      .array(z.string())
      .optional()
      .describe("List of country codes to target (e.g., ['US', 'CA', 'GB'])"),
    languages: z
      .array(z.string())
      .optional()
      .describe("List of language codes to target (e.g., ['en', 'es', 'fr'])"),
    name: z
      .string()
      .describe(
        "Name for the brand story agent (e.g., 'Premium Lifestyle Story', 'Tech Innovation Narrative')",
      ),
    prompt: z
      .string()
      .describe(
        "Natural language prompt defining the brand story, messaging strategy, and audience insights. Describe your brand narrative, target audience characteristics, and communication preferences.",
      ),
  }),
});
