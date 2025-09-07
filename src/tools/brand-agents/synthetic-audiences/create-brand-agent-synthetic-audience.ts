import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const createBrandAgentSyntheticAudienceTool = (
  client: Scope3ApiClient,
) => ({
  annotations: {
    category: "audience-management",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Brand Agent Synthetic Audience",
  },

  description:
    "Create a new synthetic audience agent for a brand agent. The synthetic audience agent uses AI to define target audience profiles, demographics, and behavioral characteristics based on a natural language prompt. You can describe your target audience, their interests, preferences, and behaviors through conversational prompts. The agent will automatically inform campaign targeting within the brand agent. Requires authentication.",

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

      const syntheticAudience = await client.createBrandAgentSyntheticAudience(
        apiKey,
        input,
      );

      let summary = `✅ **Synthetic Audience Created Successfully!**\n\n`;
      summary += `**Brand Agent:** ${brandAgentName} (${args.brandAgentId})\n`;
      summary += `**Synthetic Audience:** ${syntheticAudience.name}\n`;
      summary += `**Audience ID:** ${syntheticAudience.id}\n`;
      summary += `**Created:** ${new Date(syntheticAudience.createdAt).toLocaleString()}\n\n`;

      summary += `🎯 **Targeting Configuration:**\n`;
      summary += `• **Countries:** ${syntheticAudience.countries.length > 0 ? syntheticAudience.countries.join(", ") : "All countries"}\n`;
      summary += `• **Channels:** ${syntheticAudience.channels.length > 0 ? syntheticAudience.channels.join(", ") : "All channels"}\n`;
      summary += `• **Languages:** ${syntheticAudience.languages.length > 0 ? syntheticAudience.languages.join(", ") : "All languages"}\n`;
      summary += `• **Brands:** ${syntheticAudience.brands.length > 0 ? syntheticAudience.brands.join(", ") : "All brands"}\n\n`;

      summary += `👥 **Audience Definition Prompt:**\n`;
      summary += `"${args.prompt}"\n\n`;

      summary += `📋 **What Happens Next:**\n`;
      summary += `• The AI model is learning your target audience profile and characteristics\n`;
      summary += `• Once ready, it will inform campaign targeting and content creation\n`;
      summary += `• All campaigns in this brand agent can leverage this audience definition\n`;
      summary += `• New campaigns will consider this audience profile in strategy development\n\n`;

      summary += `🎨 **Audience Applications:**\n`;
      summary += `• **Campaign Targeting:** Inform campaign audience selection\n`;
      summary += `• **Campaign Strategy:** Guide campaign messaging and positioning\n`;
      summary += `• **Content Creation:** Influence creative direction and tone\n`;
      summary += `• **Market Segmentation:** Help identify relevant customer segments\n\n`;

      summary += `🔧 **Management:**\n`;
      summary += `• Use \`update_brand_agent_synthetic_audience\` to refine the audience definition\n`;
      summary += `• Use \`list_brand_agent_synthetic_audiences\` to see all configured audiences\n`;
      summary += `• Use \`delete_brand_agent_synthetic_audience\` to archive this agent\n\n`;

      summary += `💡 **Pro Tip:** You can create multiple synthetic audiences for different market segments, demographics, or behavioral profiles within the same brand agent.`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        "Failed to create brand synthetic audience",
        error,
      );
    }
  },

  name: "create_brand_agent_synthetic_audience",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to create a synthetic audience for"),
    brands: z
      .array(z.string())
      .optional()
      .describe(
        "List of specific brands this synthetic audience applies to (leave empty for all brands)",
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
        "Name for the synthetic audience (e.g., 'Tech Enthusiasts', 'Luxury Shoppers')",
      ),
    prompt: z
      .string()
      .describe(
        "Natural language prompt defining the target audience profile, demographics, and behavioral characteristics. Describe your target audience, their interests, preferences, behaviors, and motivations.",
      ),
  }),
});
