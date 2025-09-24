import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { TacticBigQueryService } from "../../services/tactic-bigquery-service.js";
import { createMCPResponse } from "../../utils/error-handling.js";

export const deleteCampaignTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Campaigns",
    dangerLevel: "high",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Delete Campaign",
  },

  description:
    "Delete a campaign permanently. This action cannot be undone and will remove all campaign data including tactics, targeting profiles, and performance history. Active campaigns should be paused first. Use with extreme caution as this will permanently destroy campaign data. Requires campaign ID and authentication.",

  execute: async (
    args: { campaignId: string; force?: boolean; preserveCreatives?: boolean },
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
      // First, get campaign details to show what's being deleted
      const campaign = await client.getBrandAgentCampaign(
        apiKey,
        args.campaignId,
      );

      // Safety checks for active campaigns
      if (campaign.status === "active" && !args.force) {
        let warning = `⚠️ **Cannot Delete Active Campaign**\n\n`;
        warning += `Campaign "${campaign.name}" is currently active and may have:\n`;
        warning += `• Active budget allocation and spending\n`;
        warning += `• Live ad delivery in progress\n`;
        warning += `• Publisher partnerships and commitments\n`;
        warning += `• Ongoing performance data collection\n\n`;

        warning += `**Required Actions:**\n`;
        warning += `1. Pause the campaign first using update_campaign\n`;
        warning += `2. Wait for delivery to fully stop\n`;
        warning += `3. Export any needed performance data\n`;
        warning += `4. Then proceed with deletion\n\n`;
        warning += `**Override:** Use force=true to delete immediately (not recommended)`;

        return createMCPResponse({
          data: {
            campaignId: args.campaignId,
            force: args.force,
            reason: "Cannot delete active campaign",
            status: campaign.status,
          },
          error: "CAMPAIGN_ACTIVE",
          message: warning,
          success: false,
        });
      }

      // Get additional campaign details for comprehensive summary (optional)
      let campaignTactics: Record<string, unknown>[] = [];
      let assignedCreatives: { creativeId: string; creativeName: string }[] =
        [];

      try {
        const tacticService = new TacticBigQueryService();
        campaignTactics = await tacticService.listTactics(
          args.campaignId,
          apiKey,
        );
      } catch {
        // Campaign tactics fetch failed - continue without this data
      }

      try {
        assignedCreatives = await client.getCampaignCreatives(
          apiKey,
          args.campaignId,
        );
      } catch {
        // Campaign creatives fetch failed - continue without this data
      }

      // Perform the deletion
      await client.deleteBrandAgentCampaign(apiKey, args.campaignId);

      let summary = `✅ **Campaign Deleted Successfully**\n\n`;
      summary += `**Deleted Campaign:**\n`;
      summary += `• ID: ${campaign.id}\n`;
      summary += `• Name: "${campaign.name}"\n`;
      summary += `• Status: ${campaign.status}\n`;
      summary += `• Brand Agent: ${campaign.brandAgentId}\n`;

      // Budget information
      if (campaign.budget) {
        summary += `• Total Budget: ${campaign.budget.currency} ${(campaign.budget.total / 100).toLocaleString()}\n`;
        if (campaign.deliverySummary?.today?.spend) {
          const spendPercentage = (
            (campaign.deliverySummary.today.spend / campaign.budget.total) *
            100
          ).toFixed(1);
          summary += `• Budget Utilized: ${campaign.budget.currency} ${(campaign.deliverySummary.today.spend / 100).toLocaleString()} (${spendPercentage}%)\n`;
        }
      }

      // Schedule information
      if (campaign.startDate || campaign.endDate) {
        summary += `• Schedule: `;
        if (campaign.startDate) {
          summary += `${new Date(campaign.startDate).toLocaleDateString()}`;
        }
        if (campaign.endDate) {
          summary += ` → ${new Date(campaign.endDate).toLocaleDateString()}`;
        }
        summary += `\n`;
      }

      // Performance summary (from delivery summary)
      if (campaign.deliverySummary) {
        summary += `\n**Final Performance:**\n`;
        summary += `• Today's Spend: $${(campaign.deliverySummary.today.spend / 100).toLocaleString()}\n`;
        summary += `• Budget Utilized: ${(campaign.deliverySummary.pacing.budgetUtilized * 100).toFixed(1)}%\n`;
        if (campaign.deliverySummary.today.impressions > 0) {
          summary += `• Today's Impressions: ${campaign.deliverySummary.today.impressions.toLocaleString()}\n`;
          summary += `• Avg CPM: $${campaign.deliverySummary.today.averagePrice.toFixed(2)}\n`;
        }
        summary += `• Health Score: ${campaign.deliverySummary.healthScore}\n`;
      }

      // Tactics and creatives impact
      if (campaignTactics && campaignTactics.length > 0) {
        summary += `\n**Deleted Campaign Components:**\n`;
        summary += `• ${campaignTactics.length} tactics removed\n`;
        summary += `• All targeting profiles deleted\n`;
        summary += `• Publisher product allocations cleared\n`;
        summary += `• Performance history archived\n`;
      }

      if (assignedCreatives && assignedCreatives.length > 0) {
        summary += `• ${assignedCreatives.length} creative assignments removed\n`;

        if (args.preserveCreatives) {
          summary += `\n**Creative Assets:**\n`;
          summary += `✅ Creative assets preserved (not deleted)\n`;
          assignedCreatives.forEach((creative) => {
            summary += `• ${creative.creativeName} (ID: ${creative.creativeId}) - still available for other campaigns\n`;
          });
        } else {
          summary += `\n**Creative Assets:**\n`;
          summary += `⚠️ Creative assets unassigned but preserved\n`;
          summary += `Use creative/delete to remove individual assets if needed\n`;
        }
      }

      if (campaign.status === "active" && args.force) {
        summary += `\n**⚠️ Force Deletion Impact:**\n`;
        summary += `• Active ad delivery was immediately stopped\n`;
        summary += `• Publisher partnerships may have been disrupted\n`;
        summary += `• Some spend may have been in-flight during deletion\n`;
        summary += `• Consider checking with publishers about any pending charges\n`;
      }

      summary += `\n**Data Removal:**\n`;
      summary += `• Campaign configuration permanently deleted\n`;
      summary += `• Targeting profiles removed\n`;
      summary += `• Tactic configurations deleted\n`;
      summary += `• Assignment relationships cleared\n`;
      summary += `• Real-time delivery data archived\n`;
      summary += `• This action cannot be undone\n\n`;

      // Warnings and next steps
      summary += `🎯 **Important Notes:**\n`;
      summary += `• Historical performance data may still be available in exports\n`;
      summary += `• Creative assets were preserved and can be reused\n`;
      summary += `• Brand agent configuration was not affected\n`;
      summary += `• Consider exporting final performance reports if needed\n\n`;

      summary += `**Next Steps:**\n`;
      summary += `• Review brand agent for remaining campaigns\n`;
      summary += `• Archive any final performance reports\n`;
      summary += `• Update budget allocations for remaining campaigns if needed`;

      return createMCPResponse({
        data: {
          configuration: {
            campaignId: args.campaignId,
            force: args.force,
            preserveCreatives: args.preserveCreatives,
          },
          creativesData: assignedCreatives || [],
          deletedCampaign: {
            brandAgentId: campaign.brandAgentId,
            id: campaign.id,
            name: campaign.name,
            status: campaign.status,
          },
          removed: {
            creatives: assignedCreatives ? assignedCreatives.length : 0,
            tactics: campaignTactics ? campaignTactics.length : 0,
          },
          tacticsData: campaignTactics || [],
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to delete campaign: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "campaign_delete",
  parameters: z.object({
    campaignId: z.string().describe("ID of the campaign to delete"),
    force: z
      .boolean()
      .optional()
      .describe("Force deletion of active campaigns (not recommended)"),
    preserveCreatives: z
      .boolean()
      .optional()
      .describe("Explicitly preserve creative assets (default: true)"),
  }),
});
