import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createMCPResponse } from "../../utils/error-handling.js";

export const creativeGetTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Creatives",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Get Creative",
  },

  description:
    "Get comprehensive information about a creative asset including content details, format specifications, asset validation status, campaign assignments, and publisher approval/sync status. All approval information is included in this single tool. Useful for reviewing creative assets before assignment or troubleshooting creative issues. Requires creative ID and authentication.",

  execute: async (
    args: { creativeId: string },
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
      const creative = await client.getCreative(apiKey, args.creativeId);

      if (!creative) {
        throw new Error(
          `Creative not found: Creative with ID ${args.creativeId} not found`,
        );
      }

      let summary = `✅ **Creative Details**\n\n`;
      summary += `**Basic Information:**\n`;
      summary += `• ID: ${creative.creativeId}\n`;
      summary += `• Name: ${creative.creativeName}\n`;
      summary += `• Status: ${creative.status}\n`;
      summary += `• Owner: ${creative.buyerAgentId}\n`;
      summary += `• Assembly Method: ${creative.assemblyMethod}\n`;
      summary += `• Created: ${new Date(creative.createdDate).toLocaleString()}\n`;
      summary += `• Updated: ${new Date(creative.lastModifiedDate).toLocaleString()}\n\n`;

      // Creative content and assets
      summary += `**Creative Content:**\n`;
      summary += `• Asset Count: ${creative.assetIds.length}\n`;
      if (creative.assetIds.length > 0) {
        summary += `• Asset IDs: ${creative.assetIds.join(", ")}\n`;
      }

      if (creative.format) {
        summary += `• Format: ${creative.format.formatId} (${creative.format.type})\n`;
      }

      if (creative.content) {
        if (creative.content.htmlSnippet) {
          summary += `• HTML Snippet: Available\n`;
        }
        if (creative.content.vastTag) {
          summary += `• VAST Tag: Available\n`;
        }
        if (creative.content.snippet) {
          summary += `• Third-party Snippet: ${creative.content.snippetType || "Unknown type"}\n`;
        }
      }
      summary += `\n`;

      // Asset validation status
      if (creative.assetValidation) {
        summary += `**Asset Validation:**\n`;
        summary += `• All Assets Valid: ${creative.assetValidation.allAssetsValid ? "✅" : "❌"}\n`;
        if (creative.assetValidation.invalidAssets?.length) {
          summary += `• Invalid Assets: ${creative.assetValidation.invalidAssets.length}\n`;
          creative.assetValidation.invalidAssets.forEach((invalid) => {
            summary += `  - ${invalid.assetId}: ${invalid.error} (${invalid.errorMessage})\n`;
          });
        }
        if (creative.assetValidation.validatedAt) {
          summary += `• Last Validated: ${new Date(creative.assetValidation.validatedAt).toLocaleString()}\n`;
        }
        summary += `\n`;
      }

      // Campaign assignments
      if (
        creative.campaignAssignments &&
        creative.campaignAssignments.length > 0
      ) {
        summary += `**Campaign Assignments** (${creative.campaignAssignments.length}):\n`;
        creative.campaignAssignments.forEach((assignment, index) => {
          const statusEmoji = assignment.isActive ? "🟢" : "⚪";
          summary += `${index + 1}. ${statusEmoji} **${assignment.campaignName}** (ID: ${assignment.campaignId})\n`;
          summary += `   Assigned: ${new Date(assignment.assignedDate).toLocaleString()}\n`;
          if (assignment.publishersSynced?.length) {
            summary += `   Synced to Publishers: ${assignment.publishersSynced.join(", ")}\n`;
          }
        });
        summary += `\n`;
      } else {
        summary += `**Campaign Assignments:** None\n\n`;
      }

      // Management options
      summary += `🎯 **Creative Management:**\n`;
      summary += `• Update content: Use creative/update with this creative ID\n`;
      summary += `• Assign to campaigns: Use creative/assign tool\n`;
      summary += `• Approval status: Already shown above in Asset Validation and Publisher Sync sections\n`;
      summary += `• Sync to publishers: Use creative/sync_publishers\n`;
      summary += `• Revise creative: Use creative/revise for modifications`;

      return createMCPResponse({
        data: {
          assignments: {
            activeCampaigns:
              creative.campaignAssignments?.filter((a) => a.isActive) || [],
            campaigns: creative.campaignAssignments || [],
            publishersSyncedTo: [
              ...new Set(
                creative.campaignAssignments?.flatMap(
                  (a) => a.publishersSynced || [],
                ) || [],
              ),
            ],
          },
          content: {
            assemblyMethod: creative.assemblyMethod,
            assetIds: creative.assetIds,
            content: creative.content,
            format: creative.format,
          },
          creative,
          metadata: {
            activeCampaignAssignments:
              creative.campaignAssignments?.filter((a) => a.isActive).length ||
              0,
            allAssetsValid: creative.assetValidation?.allAssetsValid || false,
            assetCount: creative.assetIds.length,
            campaignAssignmentCount: creative.campaignAssignments?.length || 0,
            creativeId: args.creativeId,
            hasAssets: creative.assetIds.length > 0,
            hasCampaignAssignments:
              (creative.campaignAssignments?.length || 0) > 0,
            hasValidation: !!creative.assetValidation,
            invalidAssetCount:
              creative.assetValidation?.invalidAssets?.length || 0,
          },
          validation: creative.assetValidation,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to get creative details: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "creative_get",
  parameters: z.object({
    creativeId: z.string().describe("ID of the creative to retrieve"),
  }),
});
