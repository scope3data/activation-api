import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  MCPToolExecuteContext,
  UpdateBrandAgentParams,
} from "../../../types/mcp.js";

import { createMCPResponse } from "../../../utils/error-handling.js";

export const updateBrandAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Brand Agents",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Update Brand Agent",
  },

  description:
    "Update the name or description of an existing brand agent (advertiser account). This only updates metadata - campaigns, creatives, and other resources remain unchanged. Requires authentication.",

  execute: async (
    args: UpdateBrandAgentParams,
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
      const updateInput: {
        description?: string;
        name?: string;
        tacticSeedDataCoop?: boolean;
      } = {};

      if (args.name !== undefined) {
        updateInput.name = args.name;
      }
      if (args.description !== undefined) {
        updateInput.description = args.description;
      }
      if (args.tacticSeedDataCoop !== undefined) {
        updateInput.tacticSeedDataCoop = args.tacticSeedDataCoop;
      }

      // Check if there are actually fields to update
      if (Object.keys(updateInput).length === 0) {
        return createMCPResponse({
          data: {
            brandAgentId: args.brandAgentId,
            changes: {},
          },
          error: "INVALID_REQUEST",
          message:
            "No changes specified. Please provide at least a name, description, or tacticSeedDataCoop setting to update.",
          success: false,
        });
      }

      const updatedBrandAgent = await client.updateBrandAgent(
        apiKey,
        args.brandAgentId,
        updateInput,
      );

      let summary = `✅ Brand Agent Updated Successfully!\n\n`;
      summary += `**Updated Brand Agent:**\n`;
      summary += `• **Name:** ${updatedBrandAgent.name}\n`;
      summary += `• **ID:** ${updatedBrandAgent.id}\n`;
      if (updatedBrandAgent.description) {
        summary += `• **Description:** ${updatedBrandAgent.description}\n`;
      }
      summary += `• **Customer ID:** ${updatedBrandAgent.customerId}\n`;
      summary += `• **Last Updated:** ${new Date(updatedBrandAgent.updatedAt).toLocaleString()}\n\n`;

      summary += `**Changes Made:**\n`;
      if (args.name !== undefined) {
        summary += `• Name updated to: "${args.name}"\n`;
      }
      if (args.description !== undefined) {
        summary += `• Description updated to: "${args.description}"\n`;
      }
      if (args.tacticSeedDataCoop !== undefined) {
        const status = args.tacticSeedDataCoop ? "enabled" : "disabled";
        summary += `• Tactic Seed Data Cooperative: ${status}\n`;
      }

      summary += `\nℹ️ **Note:** All campaigns, creatives, and other resources associated with this brand agent remain unchanged.`;

      return createMCPResponse({
        data: {
          brandAgent: updatedBrandAgent,
          changes: {
            description: args.description,
            name: args.name,
            tacticSeedDataCoop: args.tacticSeedDataCoop,
          },
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to update brand agent: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "brand_agent_update",
  parameters: z.object({
    brandAgentId: z.string().describe("ID of the brand agent to update"),
    description: z
      .string()
      .optional()
      .describe("New description for the brand agent"),
    name: z.string().optional().describe("New name for the brand agent"),
    tacticSeedDataCoop: z
      .boolean()
      .optional()
      .describe("Enable/disable tactic seed data cooperative participation"),
  }),
});
