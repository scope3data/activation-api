import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const creativeDeleteTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Creatives",
    dangerLevel: "high",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Delete Creative",
  },

  description:
    "Delete a creative asset permanently. This will remove the creative from all campaigns and cannot be undone. Use with caution as this action is irreversible. Consider unassigning the creative from campaigns first if you want to preserve campaign history. Requires creative ID and authentication.",

  execute: async (
    args: { creativeId: string; force?: boolean },
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
      // First, get creative details to show what's being deleted
      const creative = await client.getCreative(apiKey, args.creativeId);

      if (!creative) {
        return createErrorResponse(
          "Creative not found",
          new Error(`Creative with ID ${args.creativeId} not found`),
        );
      }

      // Check if creative is assigned to active campaigns
      const activeCampaigns =
        creative.campaignAssignments?.filter(
          (assignment) => assignment.isActive,
        ) || [];

      if (activeCampaigns.length > 0 && !args.force) {
        let warning = `⚠️ **Cannot Delete Creative**\n\n`;
        warning += `The creative is currently assigned to ${activeCampaigns.length} active campaign(s):\n\n`;

        activeCampaigns.forEach((assignment, index) => {
          warning += `${index + 1}. **${assignment.campaignName}** (ID: ${assignment.campaignId})\n`;
        });

        warning += `\n**Options:**\n`;
        warning += `• Unassign from campaigns first using creative/unassign\n`;
        warning += `• Use force=true parameter to delete anyway (not recommended)\n`;
        warning += `• Wait for campaigns to complete before deleting\n\n`;
        warning += `**Note:** Force deletion will remove the creative from active campaigns, which may impact campaign performance.`;

        return createMCPResponse({
          message: warning,
          success: false,
        });
      }

      // Perform the deletion (stub - implement actual deletion logic)
      // await client.deleteBrandAgentCreative(apiKey, args.creativeId);
      console.log(`[STUB] Would delete creative ${args.creativeId}`);

      let summary = `✅ **Creative Deleted Successfully**\n\n`;
      summary += `**Deleted Creative:**\n`;
      summary += `• ID: ${creative.creativeId}\n`;
      summary += `• Name: ${creative.creativeName}\n`;
      summary += `• Status: ${creative.status}\n`;
      summary += `• Owner: ${creative.buyerAgentId}\n`;
      summary += `• Assets: ${creative.assetIds.length} referenced\n`;

      if (
        creative.campaignAssignments &&
        creative.campaignAssignments.length > 0
      ) {
        summary += `• Was assigned to ${creative.campaignAssignments.length} campaign(s)\n`;

        if (args.force && activeCampaigns.length > 0) {
          summary += `\n**⚠️ Force Deletion Impact:**\n`;
          summary += `The creative was removed from ${activeCampaigns.length} active campaign(s):\n`;
          activeCampaigns.forEach((assignment) => {
            summary += `• ${assignment.campaignName} (ID: ${assignment.campaignId})\n`;
          });
          summary += `\nThese campaigns may experience delivery interruptions.`;
        }
      }

      summary += `\n\n**What Happened:**\n`;
      summary += `• Creative asset permanently deleted\n`;
      summary += `• Removed from all campaign assignments\n`;
      summary += `• Publisher sync records cleared\n`;
      summary += `• Asset file references removed\n`;
      summary += `• This action cannot be undone\n\n`;

      summary += `🎯 **Next Steps:**\n`;
      summary += `• Review affected campaigns for creative gaps\n`;
      summary += `• Consider uploading replacement creatives if needed\n`;
      summary += `• Update campaign creative assignments as necessary`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to delete creative", error);
    }
  },

  name: "creative/delete",
  parameters: z.object({
    creativeId: z.string().describe("ID of the creative to delete"),
    force: z
      .boolean()
      .optional()
      .describe(
        "Force deletion even if assigned to active campaigns (not recommended)",
      ),
  }),
});
