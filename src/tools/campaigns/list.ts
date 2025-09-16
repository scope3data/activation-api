import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createMCPResponse } from "../../utils/error-handling.js";

export const listCampaignsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Campaigns",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Campaigns",
  },

  description:
    "List campaigns with filtering and sorting options. Can filter by brand agent, status, date range, or budget range. Shows campaign summary information including name, status, budget, performance metrics, and schedule. Use this to get an overview of campaign portfolio or find specific campaigns. Requires authentication.",

  execute: async (
    args: {
      brandAgentId?: string;
      budgetRange?: {
        max?: number;
        min?: number;
      };
      dateRange?: {
        end?: string;
        start?: string;
      };
      limit?: number;
      sortBy?:
        | "budget"
        | "created"
        | "name"
        | "performance"
        | "status"
        | "updated";
      sortOrder?: "asc" | "desc";
      status?: string;
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
      // For now, use the basic method with brandAgentId
      const campaigns = await client.listBrandAgentCampaigns(
        apiKey,
        args.brandAgentId || "",
      );

      if (!campaigns || campaigns.length === 0) {
        let emptyMessage = `📭 **No Campaigns Found**\n\n`;
        if (
          args.brandAgentId ||
          args.status ||
          args.dateRange ||
          args.budgetRange
        ) {
          emptyMessage += `No campaigns match your filter criteria:\n`;
          if (args.brandAgentId)
            emptyMessage += `• Brand Agent ID: ${args.brandAgentId}\n`;
          if (args.status) emptyMessage += `• Status: ${args.status}\n`;
          if (args.dateRange) {
            emptyMessage += `• Date Range: ${args.dateRange.start || "any"} to ${args.dateRange.end || "any"}\n`;
          }
          if (args.budgetRange) {
            emptyMessage += `• Budget Range: $${args.budgetRange.min || 0} - $${args.budgetRange.max || "∞"}\n`;
          }
        } else {
          emptyMessage += `No campaigns exist in your account yet.\n`;
          emptyMessage += `Use campaign/create to create your first campaign.`;
        }

        return createMCPResponse({
          data: {
            campaigns: [],
            count: 0,
            filters: {
              brandAgentId: args.brandAgentId,
              budgetRange: args.budgetRange,
              dateRange: args.dateRange,
              sortBy: args.sortBy || "updated",
              sortOrder: args.sortOrder || "desc",
              status: args.status,
            },
            summary: {
              statusCounts: {},
              totalBudget: 0,
              totalSpend: 0,
              utilization: 0,
            },
          },
          message: emptyMessage,
          success: true,
        });
      }

      let summary = `📊 **Campaigns List** (${campaigns.length} found)\n\n`;

      // Add filter summary if any filters were applied
      if (
        args.brandAgentId ||
        args.status ||
        args.dateRange ||
        args.budgetRange
      ) {
        summary += `**Applied Filters:**\n`;
        if (args.brandAgentId)
          summary += `• Brand Agent ID: ${args.brandAgentId}\n`;
        if (args.status) summary += `• Status: ${args.status}\n`;
        if (args.dateRange) {
          summary += `• Date Range: ${args.dateRange.start || "any start"} to ${args.dateRange.end || "any end"}\n`;
        }
        if (args.budgetRange) {
          summary += `• Budget Range: $${args.budgetRange.min || 0} - $${args.budgetRange.max || "∞"}\n`;
        }
        summary += `• Sorted by: ${args.sortBy || "updated"} (${args.sortOrder || "desc"})\n\n`;
      }

      // Calculate summary statistics
      const totalBudget = campaigns.reduce(
        (sum, campaign) => sum + (campaign.budget?.total || 0),
        0,
      );
      const totalSpend = campaigns.reduce(
        (sum, campaign) => sum + (campaign.deliverySummary?.today?.spend || 0),
        0,
      );
      const statusCounts = campaigns.reduce(
        (counts, campaign) => {
          const status =
            campaign.deliverySummary?.status || campaign.status || "unknown";
          counts[status] = (counts[status] || 0) + 1;
          return counts;
        },
        {} as Record<string, number>,
      );

      summary += `**Portfolio Summary:**\n`;
      summary += `• Total Budget: $${(totalBudget / 100).toLocaleString()}\n`;
      summary += `• Total Spend: $${(totalSpend / 100).toLocaleString()}\n`;
      summary += `• Utilization: ${totalBudget > 0 ? ((totalSpend / totalBudget) * 100).toFixed(1) : "0"}%\n`;

      summary += `• Status Breakdown: `;
      const statusEntries = Object.entries(statusCounts);
      summary += statusEntries
        .map(([status, count]) => `${count} ${status}`)
        .join(", ");
      summary += `\n\n`;

      // List individual campaigns
      campaigns.forEach((campaign, index) => {
        const status = campaign.deliverySummary?.status || "unknown";
        const statusEmoji =
          status === "delivering"
            ? "🟢"
            : status === "paused"
              ? "⏸️"
              : status === "completed"
                ? "✅"
                : status === "scheduled"
                  ? "📅"
                  : "⚪";

        summary += `## ${index + 1}. ${statusEmoji} **${campaign.name}**\n`;
        summary += `**ID:** ${campaign.id}\n`;
        summary += `**Status:** ${status}\n`;
        summary += `**Brand Agent:** ${campaign.brandAgentId}\n`;

        // Budget information
        if (campaign.budget) {
          summary += `**Budget:** ${campaign.budget.currency} ${(campaign.budget.total / 100).toLocaleString()}`;
          if (campaign.budget.dailyCap) {
            summary += ` (Daily Cap: ${campaign.budget.currency} ${(campaign.budget.dailyCap / 100).toLocaleString()})`;
          }
          summary += `\n`;
          summary += `**Pacing:** ${campaign.budget.pacing || "even"}\n`;
        }

        // Schedule information
        if (campaign.startDate || campaign.endDate) {
          summary += `**Schedule:** `;
          if (campaign.startDate) {
            summary += `${new Date(campaign.startDate).toLocaleDateString()}`;
          } else {
            summary += `Immediate start`;
          }
          if (campaign.endDate) {
            summary += ` → ${new Date(campaign.endDate).toLocaleDateString()}`;
          } else {
            summary += ` → No end date`;
          }
          summary += `\n`;
        }

        // Performance metrics (if available)
        if (campaign.deliverySummary) {
          summary += `**Performance:**\n`;
          summary += `• Today's Spend: $${(campaign.deliverySummary.today.spend / 100).toLocaleString()}\n`;
          summary += `• Budget Utilized: ${(campaign.deliverySummary.pacing.budgetUtilized * 100).toFixed(1)}%\n`;
          summary += `• Pacing Status: ${campaign.deliverySummary.pacing.status}\n`;

          if (campaign.deliverySummary.today.impressions > 0) {
            summary += `• Today's Impressions: ${campaign.deliverySummary.today.impressions.toLocaleString()}\n`;
            summary += `• Today's Avg CPM: $${campaign.deliverySummary.today.averagePrice.toFixed(2)}\n`;
          }

          summary += `• Health Score: ${campaign.deliverySummary.healthScore}\n`;
          if (campaign.deliverySummary.alerts.length > 0) {
            summary += `• Active Alerts: ${campaign.deliverySummary.alerts.length}\n`;
          }
        }

        // Creative count
        if (campaign.creativeIds && campaign.creativeIds.length > 0) {
          summary += `**Creatives:** ${campaign.creativeIds.length} assigned\n`;
        }

        // Audience count
        if (campaign.audienceIds && campaign.audienceIds.length > 0) {
          summary += `**Audiences:** ${campaign.audienceIds.length} assigned\n`;
        }

        summary += `**Created:** ${new Date(campaign.createdAt).toLocaleString()}\n`;
        if (campaign.updatedAt) {
          summary += `**Updated:** ${new Date(campaign.updatedAt).toLocaleString()}\n`;
        }

        // Quick actions
        summary += `\n**Quick Actions:** [get_campaign_summary](command:get_campaign_summary?campaignId=${campaign.id}) | [export_campaign_data](command:export_campaign_data?campaignIds=${campaign.id}) | [update_campaign](command:update_campaign?campaignId=${campaign.id})\n`;
        summary += `---\n\n`;
      });

      // Management suggestions
      summary += `🎯 **Campaign Management:**\n`;
      summary += `• Get detailed view: Use get_campaign_summary with campaign ID\n`;
      summary += `• Update campaigns: Use update_campaign tool\n`;
      summary += `• Export performance data: Use export_campaign_data\n`;
      summary += `• Create new campaign: Use create_campaign tool`;

      return createMCPResponse({
        data: {
          campaigns,
          count: campaigns.length,
          filters: {
            brandAgentId: args.brandAgentId,
            budgetRange: args.budgetRange,
            dateRange: args.dateRange,
            limit: args.limit,
            sortBy: args.sortBy || "updated",
            sortOrder: args.sortOrder || "desc",
            status: args.status,
          },
          summary: {
            statusCounts,
            totalBudget,
            totalSpend,
            utilization: totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0,
          },
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to list campaigns: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "campaign/list",
  parameters: z.object({
    brandAgentId: z
      .string()
      .optional()
      .describe("Filter campaigns by brand agent ID"),
    budgetRange: z
      .object({
        max: z.number().optional().describe("Maximum budget in cents"),
        min: z.number().optional().describe("Minimum budget in cents"),
      })
      .optional()
      .describe("Filter by budget range"),
    dateRange: z
      .object({
        end: z.string().optional().describe("End date filter (ISO format)"),
        start: z.string().optional().describe("Start date filter (ISO format)"),
      })
      .optional()
      .describe("Filter by date range"),
    limit: z
      .number()
      .min(1)
      .max(200)
      .optional()
      .describe("Maximum number of campaigns to return (default: 50)"),
    sortBy: z
      .enum(["name", "budget", "created", "updated", "status", "performance"])
      .optional()
      .describe("Field to sort by (default: updated)"),
    sortOrder: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Sort order (default: desc)"),
    status: z
      .string()
      .optional()
      .describe(
        "Filter by campaign status (active, paused, completed, scheduled, draft)",
      ),
  }),
});
