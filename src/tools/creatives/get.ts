import { z } from "zod";
import { BigQuery } from "@google-cloud/bigquery";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";
import { CreativeSyncService } from "../../services/creative-sync-service.js";
import { AuthenticationService } from "../../services/auth-service.js";

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

      // Get sync status with sales agents
      const authService = new AuthenticationService(new BigQuery());
      const creativeSyncService = new CreativeSyncService(authService);

      let syncStatus: any[] = [];
      let syncStatusSummary = {
        totalRelevantAgents: 0,
        synced: 0,
        approved: 0,
        rejected: 0,
        pending: 0,
      };

      try {
        syncStatus = await creativeSyncService.getCreativeSyncStatus(
          args.creativeId,
        );
        syncStatusSummary = {
          totalRelevantAgents: syncStatus.length,
          synced: syncStatus.filter((s) => s.status === "synced").length,
          approved: syncStatus.filter((s) => s.approvalStatus === "approved")
            .length,
          rejected: syncStatus.filter((s) => s.approvalStatus === "rejected")
            .length,
          pending: syncStatus.filter(
            (s) => !s.approvalStatus || s.approvalStatus === "pending",
          ).length,
        };
      } catch (syncError) {
        console.warn("Failed to fetch sync status:", syncError);
        // Continue without sync status - not critical for creative display
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

      // Sales agent sync status
      if (syncStatus.length > 0) {
        summary += `**Sales Agent Sync Status** (${syncStatus.length} agents):\n`;

        // Group by status for better display
        const synced = syncStatus.filter((s) => s.status === "synced");
        const failed = syncStatus.filter((s) => s.status === "failed");
        const pending = syncStatus.filter((s) => s.status === "pending");

        if (synced.length > 0) {
          summary += `• ✅ **Synced** (${synced.length}):\n`;
          synced.forEach((agent) => {
            const approvalEmoji =
              agent.approvalStatus === "approved"
                ? "✅"
                : agent.approvalStatus === "rejected"
                  ? "❌"
                  : "⏳";
            summary += `  - ${agent.salesAgentName}: ${approvalEmoji} ${agent.approvalStatus || "Pending approval"}\n`;
            if (agent.approvalStatus === "rejected" && agent.rejectionReason) {
              summary += `    Reason: ${agent.rejectionReason}\n`;
            }
          });
        }

        if (pending.length > 0) {
          summary += `• ⏳ **Sync in Progress** (${pending.length}):\n`;
          pending.forEach((agent) => {
            summary += `  - ${agent.salesAgentName}: Syncing...\n`;
          });
        }

        if (failed.length > 0) {
          summary += `• ❌ **Sync Failed** (${failed.length}):\n`;
          failed.forEach((agent) => {
            summary += `  - ${agent.salesAgentName}: ${agent.rejectionReason || "Sync failed"}\n`;
          });
        }

        // Quick summary
        summary += `\n**Sync Summary:**\n`;
        summary += `• Total Sales Agents: ${syncStatusSummary.totalRelevantAgents}\n`;
        summary += `• ✅ Approved: ${syncStatusSummary.approved}\n`;
        summary += `• ⏳ Pending: ${syncStatusSummary.pending}\n`;
        summary += `• ❌ Issues: ${syncStatusSummary.rejected + failed.length}\n\n`;
      } else {
        summary += `**Sales Agent Sync Status:** No sync attempts yet\n`;
        summary += `• Use \`creative/sync_sales_agents\` to sync to compatible sales agents\n\n`;
      }

      // Management options
      summary += `🎯 **Creative Management:**\n`;
      summary += `• Update content: Use creative/update with this creative ID\n`;
      summary += `• Assign to campaigns: Use creative/assign tool\n`;
      summary += `• Approval status: Already shown above in Asset Validation and Publisher Sync sections\n`;
      summary += `• Sync to sales agents: Use creative/sync_sales_agents\n`;
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
          // Add sync status data
          syncStatus: {
            salesAgentSyncStatus: syncStatus,
            syncStatusSummary: syncStatusSummary,
          },
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
            // Add sync status metadata
            salesAgentsSynced: syncStatusSummary.synced,
            salesAgentsApproved: syncStatusSummary.approved,
            salesAgentsPending: syncStatusSummary.pending,
            salesAgentsRejected: syncStatusSummary.rejected,
            hasSyncStatus: syncStatus.length > 0,
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
