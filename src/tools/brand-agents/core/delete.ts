import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  DeleteBrandAgentParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const deleteBrandAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Brand Agents",
    dangerLevel: "high",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Delete Brand Agent",
  },

  description:
    "⚠️ DANGER: Permanently delete a brand agent (advertiser account) and ALL associated data including campaigns, creatives, audiences, standards, and measurement sources. This action cannot be undone. Requires authentication.",

  execute: async (
    args: DeleteBrandAgentParams,
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
      // First, get the brand agent details to show what's being deleted
      let brandAgentName: string;
      try {
        const brandAgent = await client.getBrandAgent(
          apiKey,
          args.brandAgentId,
        );
        brandAgentName = brandAgent.name;
      } catch (fetchError) {
        // If we can't fetch the brand agent, it might not exist
        return createErrorResponse(
          "Brand agent not found or inaccessible",
          fetchError,
        );
      }

      // Perform the deletion
      const success = await client.deleteBrandAgent(apiKey, args.brandAgentId);

      if (!success) {
        return createMCPResponse({
          message:
            "Failed to delete brand agent. The operation was not completed.",
          success: false,
        });
      }

      let summary = `🗑️ **Brand Agent Deleted Successfully**\n\n`;
      summary += `The following brand agent has been permanently deleted:\n`;
      summary += `• **Name:** ${brandAgentName}\n`;
      summary += `• **ID:** ${args.brandAgentId}\n\n`;

      summary += `⚠️ **What was deleted:**\n`;
      summary += `• The brand agent record\n`;
      summary += `• All campaigns owned by this brand agent\n`;
      summary += `• All creatives owned by this brand agent\n`;
      summary += `• All synthetic audiences owned by this brand agent\n`;
      summary += `• All brand standards configurations\n`;
      summary += `• All measurement source configurations\n\n`;

      summary += `❌ **This action cannot be undone.**\n`;
      summary += `The brand agent and all its associated data have been permanently removed from the system.`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to delete brand agent", error);
    }
  },

  name: "brand-agent/delete",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to delete permanently"),
  }),
});
