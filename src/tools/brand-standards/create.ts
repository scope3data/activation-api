import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

export const createBrandAgentStandardsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Brand Standards",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Brand Agent Standards",
  },

  description:
    "Create a new brand safety standards agent for a brand agent. The standards agent uses AI to classify content and enforce brand safety rules based on a natural language prompt. You can define safety guidelines, content restrictions, and approval criteria through conversational prompts. The agent will automatically apply to all campaigns within the brand agent. Requires authentication.",

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
          `Brand agent not found. Please check the brand agent ID.: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`,
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

      const standardsAgent = await client.createBrandAgentStandards(
        apiKey,
        input,
      );

      let summary = `✅ **Brand Standards Agent Created Successfully!**\n\n`;
      summary += `**Brand Agent:** ${brandAgentName} (${args.brandAgentId})\n`;
      summary += `**Standards Agent:** ${standardsAgent.name}\n`;
      summary += `**Standards ID:** ${standardsAgent.id}\n`;
      summary += `**Created:** ${new Date(standardsAgent.createdAt).toLocaleString()}\n\n`;

      summary += `🎯 **Targeting Configuration:**\n`;
      summary += `• **Countries:** ${standardsAgent.countries.length > 0 ? standardsAgent.countries.join(", ") : "All countries"}\n`;
      summary += `• **Channels:** ${standardsAgent.channels.length > 0 ? standardsAgent.channels.join(", ") : "All channels"}\n`;
      summary += `• **Languages:** ${standardsAgent.languages.length > 0 ? standardsAgent.languages.join(", ") : "All languages"}\n`;
      summary += `• **Brands:** ${standardsAgent.brands.length > 0 ? standardsAgent.brands.join(", ") : "All brands"}\n\n`;

      summary += `🤖 **AI Safety Prompt:**\n`;
      summary += `"${args.prompt}"\n\n`;

      summary += `📋 **What Happens Next:**\n`;
      summary += `• The AI model is being trained on your safety guidelines\n`;
      summary += `• Once ready, it will automatically classify content for brand safety\n`;
      summary += `• All campaigns in this brand agent will use these standards\n`;
      summary += `• New campaigns will inherit these safety rules automatically\n\n`;

      summary += `🔧 **Management:**\n`;
      summary += `• Use \`update_brand_agent_standards\` to modify the safety prompt\n`;
      summary += `• Use \`list_brand_agent_standards\` to see all configured standards\n`;
      summary += `• Use \`delete_brand_agent_standards\` to archive this agent\n\n`;

      summary += `💡 **Pro Tip:** You can create multiple standards agents for different markets, channels, or safety levels within the same brand agent.`;

      return summary;
    } catch (error) {
      throw new Error(
        `Failed to create brand standards agent: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "brand-standards/create",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to create standards for"),
    brands: z
      .array(z.string())
      .optional()
      .describe(
        "List of specific brands this agent applies to (leave empty for all brands)",
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
        "Name for the brand standards agent (e.g., 'Family-Safe Standards', 'Premium Brand Guidelines')",
      ),
    prompt: z
      .string()
      .describe(
        "Natural language prompt defining the brand safety rules and guidelines. Be specific about what content should be approved or rejected.",
      ),
  }),
});
