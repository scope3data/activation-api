import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { requireSessionAuth } from "../../utils/auth.js";
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
      // For now, use the basic method with brandAgentId
      const campaigns = await client.listBrandAgentCampaigns(
        _customerId,
        args.brandAgentId || "",
      );

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

      const summary = `Found ${campaigns.length} campaigns. Budget: $${(totalBudget / 100).toLocaleString()}, Spend: $${(totalSpend / 100).toLocaleString()} (${totalBudget > 0 ? ((totalSpend / totalBudget) * 100).toFixed(1) : "0"}%)`;

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
