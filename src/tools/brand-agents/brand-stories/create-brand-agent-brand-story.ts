import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const createBrandAgentBrandStoryTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "audience-management",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Brand Agent Brand Story",
  },

  description:
    "Create a new brand story for a brand agent. Brand stories are AI-powered target audience definitions that use natural language prompts to define audience profiles, demographics, and behavioral characteristics. You can describe your target audience, their interests, preferences, and behaviors through conversational prompts. The brand story will automatically inform campaign targeting within the brand agent. Requires authentication.",

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

      const brandStory = await client.createBrandAgentSyntheticAudience(
        apiKey,
        input,
      );

      let summary = `✅ **Brand Story Created Successfully!**\n\n`;
      summary += `**Brand Agent:** ${brandAgentName} (${args.brandAgentId})\n`;
      summary += `**Brand Story:** ${brandStory.name}\n`;
      summary += `**Story ID:** ${brandStory.id}\n`;
      summary += `**Created:** ${new Date(brandStory.createdAt).toLocaleString()}\n\n`;

      summary += `🎯 **Targeting Configuration:**\n`;
      summary += `• **Countries:** ${brandStory.countries.length > 0 ? brandStory.countries.join(", ") : "All countries"}\n`;
      summary += `• **Channels:** ${brandStory.channels.length > 0 ? brandStory.channels.join(", ") : "All channels"}\n`;
      summary += `• **Languages:** ${brandStory.languages.length > 0 ? brandStory.languages.join(", ") : "All languages"}\n`;
      summary += `• **Brands:** ${brandStory.brands.length > 0 ? brandStory.brands.join(", ") : "All brands"}\n\n`;

      summary += `📖 **Brand Story Prompt:**\n`;
      summary += `"${args.prompt}"\n\n`;

      summary += `📋 **What Happens Next:**\n`;
      summary += `• The AI model is learning your target audience profile and characteristics\n`;
      summary += `• Once ready, it will inform campaign targeting and content creation\n`;
      summary += `• All campaigns in this brand agent can leverage this audience definition\n`;
      summary += `• New campaigns will consider this audience profile in strategy development\n\n`;

      summary += `🎨 **Brand Story Applications:**\n`;
      summary += `• **Campaign Targeting:** Inform campaign audience selection\n`;
      summary += `• **Campaign Strategy:** Guide campaign messaging and positioning\n`;
      summary += `• **Content Creation:** Influence creative direction and tone\n`;
      summary += `• **Market Segmentation:** Help identify relevant customer segments\n\n`;

      summary += `🔧 **Management:**\n`;
      summary += `• Use \`update_brand_agent_brand_story\` to refine the brand story definition\n`;
      summary += `• Use \`list_brand_agent_brand_stories\` to see all configured brand stories\n`;
      summary += `• Use \`delete_brand_agent_brand_story\` to archive this story\n\n`;

      summary += `💡 **Pro Tip:** You can create multiple brand stories for different market segments, demographics, or behavioral profiles within the same brand agent.`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to create brand story", error);
    }
  },

  name: "create_brand_agent_brand_story",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to create a brand story for"),
    brands: z
      .array(z.string())
      .optional()
      .describe(
        "List of specific brands this brand story applies to (leave empty for all brands)",
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
        "Name for the brand story (e.g., 'Tech Enthusiasts', 'Luxury Shoppers')",
      ),
    prompt: z
      .string()
      .describe(
        "Natural language prompt defining the target audience profile, demographics, and behavioral characteristics for this brand story. Describe your target audience, their interests, preferences, behaviors, and motivations.",
      ),
  }),
});
