import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const updateBrandAgentStandardsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Brand Standards",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Update Brand Agent Standards",
  },

  description:
    "Update the safety prompt and configuration for an existing brand standards agent. This creates a new model version with the updated prompt and sets it as the primary/active version. The updated standards will automatically apply to all campaigns within the brand agent. Requires authentication.",

  execute: async (
    args: {
      name?: string;
      prompt: string;
      standardsId: string;
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
      // Use the provided name or create a versioned name
      const modelName =
        args.name ||
        `Updated Standards - ${new Date().toISOString().split("T")[0]}`;

      const updatedModel = await client.updateBrandAgentStandards(
        apiKey,
        args.standardsId,
        modelName,
        args.prompt,
      );

      let summary = `✅ **Brand Standards Updated Successfully!**\n\n`;
      summary += `**Standards Agent ID:** ${args.standardsId}\n`;
      summary += `**Model Name:** ${updatedModel.name}\n`;
      summary += `**Model ID:** ${updatedModel.id}\n`;
      summary += `**Updated:** ${new Date(updatedModel.createdAt).toLocaleString()}\n\n`;

      summary += `🤖 **Updated Safety Prompt:**\n`;
      summary += `"${args.prompt}"\n\n`;

      summary += `📋 **What Happens Next:**\n`;
      summary += `• A new model version has been created with your updated prompt\n`;
      summary += `• This version is now set as the PRIMARY/active model\n`;
      summary += `• The AI is retraining on your updated safety guidelines\n`;
      summary += `• All campaigns will start using the new standards once ready\n`;
      summary += `• Previous model versions are preserved for rollback if needed\n\n`;

      summary += `🔄 **Version Management:**\n`;
      summary += `• Each update creates a new model version\n`;
      summary += `• Only the PRIMARY version is used for active classification\n`;
      summary += `• Previous versions remain available for reference\n\n`;

      summary += `🛡️ **Impact:**\n`;
      summary += `• Updated standards apply to ALL campaigns in this brand agent\n`;
      summary += `• New campaigns automatically inherit the updated safety rules\n`;
      summary += `• Existing campaign classifications will be refreshed\n\n`;

      summary += `🔧 **Next Steps:**\n`;
      summary += `• Use \`list_brand_agent_standards\` to verify the update\n`;
      summary += `• Monitor campaign performance for any classification changes\n`;
      summary += `• Create additional updates as needed to refine safety rules`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        "Failed to update brand standards agent",
        error,
      );
    }
  },

  name: "brand-standards/update",
  parameters: z.object({
    name: z
      .string()
      .optional()
      .describe(
        "Optional name for the new model version (defaults to timestamped name)",
      ),
    prompt: z
      .string()
      .describe(
        "Updated natural language prompt defining the brand safety rules and guidelines",
      ),
    standardsId: z
      .string()
      .describe("ID of the brand standards agent to update"),
  }),
});
