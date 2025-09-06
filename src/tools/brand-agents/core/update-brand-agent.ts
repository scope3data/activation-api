import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  UpdateBrandAgentParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const updateBrandAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "brand-agent-management",
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
      return createAuthErrorResponse();
    }

    try {
      const updateInput: { name?: string; description?: string } = {};
      
      if (args.name !== undefined) {
        updateInput.name = args.name;
      }
      if (args.description !== undefined) {
        updateInput.description = args.description;
      }

      // Check if there are actually fields to update
      if (Object.keys(updateInput).length === 0) {
        return createMCPResponse({
          message: "No changes specified. Please provide at least a name or description to update.",
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

      summary += `\nℹ️ **Note:** All campaigns, creatives, and other resources associated with this brand agent remain unchanged.`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to update brand agent", error);
    }
  },

  name: "update_brand_agent",
  parameters: z.object({
    brandAgentId: z.string().describe("ID of the brand agent to update"),
    name: z
      .string()
      .optional()
      .describe("New name for the brand agent"),
    description: z
      .string()
      .optional()
      .describe("New description for the brand agent"),
  }),
});