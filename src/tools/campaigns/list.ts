import { BigQuery } from "@google-cloud/bigquery";
import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { requireSessionAuth } from "../../utils/auth.js";
import { AuthenticationService } from "../../services/auth-service.js";
import { CreativeSyncService } from "../../services/creative-sync-service.js";
import { NotificationService } from "../../services/notification-service.js";
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
    // Universal session authentication check
    const { apiKey: _apiKey, customerId: _customerId } =
      requireSessionAuth(context);

    try {
      // Initialize services for sync health and notifications
      const authService = new AuthenticationService(new BigQuery());
      const creativeSyncService = new CreativeSyncService(authService);
      const notificationService = new NotificationService(authService);

      // Get customer info from auth service
      const customerId = await authService.getCustomerIdFromToken(_apiKey);
      if (!customerId) {
        throw new Error("Unable to determine customer ID from API key");
      }

      // For now, use the basic method with brandAgentId
      const campaigns = await client.listBrandAgentCampaigns(
        _customerId,
        args.brandAgentId || "",
      );

      // Enhance campaigns with sync health and notification data
      if (campaigns && campaigns.length > 0) {
        for (const campaign of campaigns) {
          try {
            // Get notification summary for this campaign
            const notifications =
              await notificationService.getCampaignNotifications(
                campaign.id,
                customerId,
              );
            campaign.notifications = notifications;

            // Calculate creative sync health (simplified for list view)
            // Note: In a real implementation, this would be optimized with batch queries
            if (campaign.creativeIds && campaign.creativeIds.length > 0) {
              let creativesFullySynced = 0;
              let creativesWithIssues = 0;
              let creativesNotSynced = 0;

              for (const creativeId of campaign.creativeIds.slice(0, 10)) {
                // Limit for performance
                try {
                  const syncStatus =
                    await creativeSyncService.getCreativeSyncStatus(creativeId);
                  if (syncStatus.length === 0) {
                    creativesNotSynced++;
                  } else {
                    const approved = syncStatus.filter(
                      (s) => s.approvalStatus === "approved",
                    ).length;
                    const rejected = syncStatus.filter(
                      (s) => s.approvalStatus === "rejected",
                    ).length;

                    if (approved === syncStatus.length) {
                      creativesFullySynced++;
                    } else if (rejected > 0) {
                      creativesWithIssues++;
                    }
                  }
                } catch {
                  // Skip individual creative sync status errors
                  creativesNotSynced++;
                }
              }

              // Determine overall health status
              const totalCreatives = campaign.creativeIds.length;
              let healthStatus: "critical" | "healthy" | "warning" = "healthy";

              if (
                creativesWithIssues > 0 ||
                creativesNotSynced > totalCreatives / 2
              ) {
                healthStatus =
                  creativesWithIssues > totalCreatives / 2
                    ? "critical"
                    : "warning";
              }

              campaign.creativeSyncHealth = {
                status: healthStatus,
                summary: {
                  creativesFullySynced,
                  creativesNotSynced,
                  creativesPartiallySynced: Math.max(
                    0,
                    totalCreatives -
                      creativesFullySynced -
                      creativesWithIssues -
                      creativesNotSynced,
                  ),
                  creativesWithIssues,
                },
              };
            }
          } catch (error) {
            console.warn(
              `Failed to get sync health for campaign ${campaign.id}:`,
              error,
            );
            // Continue without sync health - not critical for campaign list
          }
        }
      }

      if (!campaigns || campaigns.length === 0) {
        const emptyMessage =
          args.brandAgentId || args.status || args.dateRange || args.budgetRange
            ? "No campaigns match filters"
            : "No campaigns found";

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

      // Calculate health and notification summary
      const healthySummary = campaigns.filter(
        (c) => c.creativeSyncHealth?.status === "healthy",
      ).length;
      const warningsSummary = campaigns.filter(
        (c) => c.creativeSyncHealth?.status === "warning",
      ).length;
      const criticalSummary = campaigns.filter(
        (c) => c.creativeSyncHealth?.status === "critical",
      ).length;
      const totalNotifications = campaigns.reduce(
        (sum, c) => sum + (c.notifications?.unread || 0),
        0,
      );

      let summary = `📊 **Found ${campaigns.length} campaigns**

💰 **Budget**: $${(totalBudget / 100).toLocaleString()} | **Spend**: $${(totalSpend / 100).toLocaleString()} (${totalBudget > 0 ? ((totalSpend / totalBudget) * 100).toFixed(1) : "0"}%)

🔄 **Creative Sync Health**:`;

      if (healthySummary > 0) summary += ` ✅ ${healthySummary} healthy`;
      if (warningsSummary > 0) summary += ` ⚠️ ${warningsSummary} warnings`;
      if (criticalSummary > 0) summary += ` 🔴 ${criticalSummary} critical`;

      if (totalNotifications > 0) {
        summary += `\n🔔 **${totalNotifications} unread notifications** across campaigns`;
      }

      // Add individual campaign details
      summary += `\n\n---\n\n`;

      campaigns.forEach((campaign, index) => {
        const healthEmoji =
          campaign.creativeSyncHealth?.status === "healthy"
            ? "✅"
            : campaign.creativeSyncHealth?.status === "warning"
              ? "⚠️"
              : campaign.creativeSyncHealth?.status === "critical"
                ? "🔴"
                : "⚫";

        const notificationBadge =
          campaign.notifications?.unread && campaign.notifications.unread > 0
            ? ` 🔔${campaign.notifications.unread}`
            : "";

        summary += `${index + 1}. ${healthEmoji} **${campaign.name}**${notificationBadge}\n`;
        summary += `   💰 $${((campaign.budget?.total || 0) / 100).toLocaleString()} | Status: ${campaign.status}\n`;

        if (campaign.creativeSyncHealth) {
          const health = campaign.creativeSyncHealth;
          summary += `   🎨 Creatives: ${health.summary.creativesFullySynced} synced`;
          if (health.summary.creativesWithIssues > 0) {
            summary += `, ${health.summary.creativesWithIssues} issues`;
          }
          if (health.summary.creativesNotSynced > 0) {
            summary += `, ${health.summary.creativesNotSynced} not synced`;
          }
          summary += `\n`;
        }

        summary += `\n`;
      });

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
            // Add health and notification summaries
            healthSummary: {
              critical: criticalSummary,
              healthy: healthySummary,
              unknown:
                campaigns.length -
                healthySummary -
                warningsSummary -
                criticalSummary,
              warning: warningsSummary,
            },
            notificationSummary: {
              campaignsWithNotifications: campaigns.filter(
                (c) => (c.notifications?.unread || 0) > 0,
              ).length,
              totalUnread: totalNotifications,
            },
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

  name: "campaign_list",
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
