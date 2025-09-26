import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";
import type { Tactic } from "../../types/tactics.js";

import { TacticBigQueryService } from "../../services/tactic-bigquery-service.js";
import { requireSessionAuth } from "../../utils/auth.js";
import { createMCPResponse } from "../../utils/error-handling.js";

export const listTacticsTool = (_client: Scope3ApiClient) => ({
  annotations: {
    category: "Tactics",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Tactics",
  },

  description:
    "List all tactics for a specific campaign with comprehensive details. Shows publisher products, simplified targeting (media product + brand story + signal), budget allocations, performance metrics, and actionable recommendations. Includes budget distribution visualization and performance alerts. Use this to get an overview of how campaign budget is distributed across different tactics. Requires authentication.",

  execute: async (
    args: {
      campaignId: string;
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Universal session authentication check
    const { apiKey, customerId: _customerId } = requireSessionAuth(context);

    try {
      const bigQueryService = new TacticBigQueryService();
      const tacticRecords = await bigQueryService.listTactics(
        args.campaignId,
        apiKey,
      );

      // Convert BigQuery records to Tactic objects
      const tactics: Tactic[] = tacticRecords.map((record) => ({
        brandStoryId: record.brand_story_id || undefined,
        budgetAllocation: {
          amount: record.budget_amount,
          currency: record.budget_currency,
          dailyCap: record.budget_daily_cap || undefined,
          pacing: record.budget_pacing as "asap" | "even" | "front_loaded",
          percentage: record.budget_percentage || undefined,
        },
        campaignId: record.campaign_id,
        createdAt: new Date(record.created_at),
        description: record.description,
        effectivePricing: {
          cpm: record.cpm,
          currency: record.budget_currency,
          signalCost: record.signal_cost || undefined,
          totalCpm: record.total_cpm,
        },
        id: record.id,
        mediaProduct: {
          basePricing: {
            fixedCpm: undefined,
            floorCpm: record.cpm,
            model: "auction" as "auction" | "fixed_cpm",
            targetCpm: undefined,
          },
          createdAt: new Date(),
          deliveryType: "non_guaranteed" as "guaranteed" | "non_guaranteed",
          description: "Media product description",
          formats: ["display", "video"] as (
            | "audio"
            | "display"
            | "html5"
            | "native"
            | "video"
          )[],
          id: record.media_product_id,
          inventoryType: "run_of_site" as
            | "premium"
            | "run_of_site"
            | "targeted_package",
          name: "Media Product",
          productId: record.media_product_id,
          publisherId: record.sales_agent_id,
          publisherName: "Publisher", // Mock data since we don't have full media product in BigQuery yet
          supportedTargeting: ["demographic", "geographic"],
          updatedAt: new Date(),
        },
        name: record.name,
        performance: undefined as undefined, // Performance data not available in tactics table
        signalId: record.signal_id || undefined,
        status: record.status as "active" | "completed" | "draft" | "paused",
        targeting: {
          inheritFromCampaign: !record.signal_id,
          overrides: undefined,
          signalConfiguration: record.signal_id
            ? {
                audienceIds: [],
                customParameters: {},
                segments: [record.signal_id],
              }
            : undefined,
          signalProvider: record.signal_id ? "scope3" : undefined,
          signalType: record.signal_id
            ? "scope3"
            : ("none" as "buyer" | "none" | "scope3" | "third_party"),
        },
        updatedAt: new Date(record.updated_at),
      }));

      if (tactics.length === 0) {
        return createMCPResponse({
          data: {
            campaignId: args.campaignId,
            count: 0,
            summary: {
              activeTactics: 0,
              completedTactics: 0,
              draftTactics: 0,
              pausedTactics: 0,
              totalBudget: 0,
              totalImpressions: 0,
              totalSpend: 0,
              totalTactics: 0,
            },
            tactics: [],
          },
          message:
            "📋 **No Tactics Found**\n\nThis campaign doesn't have any tactics configured yet.\n\n**Next Steps:**\n• Use discover_publisher_products to find available inventory\n• Use create_tactic to add tactics to your campaign\n• Or set campaign to 'scope3_managed' mode for automatic tactic management",
          success: true,
        });
      }

      let summary = `📋 **Campaign Tactics** (${tactics.length} tactics)\n\n`;

      // Calculate totals for summary
      const totalBudget = tactics.reduce(
        (sum, tactic) => sum + tactic.budgetAllocation.amount,
        0,
      );

      const totalSpend = tactics.reduce(
        (sum, tactic) => sum + (tactic.performance?.spend ?? 0),
        0,
      );

      const totalImpressions = tactics.reduce(
        (sum, tactic) => sum + (tactic.performance?.impressions ?? 0),
        0,
      );

      // Group tactics by status for better organization
      const activeTactics = tactics.filter(
        (tactic) => tactic.status === "active",
      );
      const draftTactics = tactics.filter(
        (tactic) => tactic.status === "draft",
      );
      const pausedTactics = tactics.filter(
        (tactic) => tactic.status === "paused",
      );
      const completedTactics = tactics.filter(
        (tactic) => tactic.status === "completed",
      );

      // Summary statistics
      summary += `## 📊 **Overview**\n`;
      summary += `• **Total Budget Allocated:** $${totalBudget.toLocaleString()}\n`;
      if (totalSpend > 0) {
        summary += `• **Total Spend:** $${totalSpend.toLocaleString()} (${((totalSpend / totalBudget) * 100).toFixed(1)}% of budget)\n`;
      }
      if (totalImpressions > 0) {
        summary += `• **Total Impressions:** ${totalImpressions.toLocaleString()}\n`;
      }
      summary += `• **Active Tactics:** ${activeTactics.length} | **Draft:** ${draftTactics.length} | **Paused:** ${pausedTactics.length}\n\n`;

      // Function to display tactic details
      const displayTactic = (tactic: (typeof tactics)[0], index: number) => {
        const statusIcon =
          {
            active: "🟢",
            completed: "✅",
            draft: "⚪",
            failed: "🔴",
            paused: "🟡",
            pending_approval: "🟠",
          }[tactic.status] || "❓";

        summary += `### ${index + 1}. ${statusIcon} **${tactic.name}**\n`;

        if (tactic.description) {
          summary += `*${tactic.description}*\n\n`;
        }

        // Publisher product info
        summary += `**📦 Publisher Product:**\n`;
        summary += `• ${tactic.mediaProduct.publisherName} → ${tactic.mediaProduct.name}\n`;
        summary += `• Type: ${tactic.mediaProduct.inventoryType.replace(/_/g, " ")} (${tactic.mediaProduct.deliveryType.replace(/_/g, " ")})\n`;
        summary += `• Formats: ${tactic.mediaProduct.formats.join(", ")}\n`;

        // Simplified targeting strategy
        summary += `\n**🎯 Targeting:**\n`;
        summary += `• Brand Story ID: ${tactic.brandStoryId}\n`;

        if (tactic.signalId) {
          summary += `• Signal ID: ${tactic.signalId}\n`;
        } else {
          summary += `• Signal: None (basic targeting)\n`;
        }

        // Pricing
        summary += `\n**💰 Pricing:**\n`;
        summary += `• Base CPM: $${tactic.effectivePricing.cpm.toFixed(2)}`;
        if (
          tactic.effectivePricing.signalCost &&
          tactic.effectivePricing.signalCost > 0
        ) {
          summary += ` + $${tactic.effectivePricing.signalCost.toFixed(2)} (signals)`;
        }
        summary += ` = **$${tactic.effectivePricing.totalCpm.toFixed(2)} effective CPM**\n`;

        // Budget allocation
        summary += `\n**💳 Budget:**\n`;
        summary += `• Allocated: $${tactic.budgetAllocation.amount.toLocaleString()} ${tactic.budgetAllocation.currency}`;
        if (tactic.budgetAllocation.percentage) {
          summary += ` (${tactic.budgetAllocation.percentage}%)`;
        }
        summary += `\n`;

        if (tactic.budgetAllocation.dailyCap) {
          summary += `• Daily Cap: $${tactic.budgetAllocation.dailyCap.toLocaleString()}\n`;
        }
        summary += `• Pacing: ${tactic.budgetAllocation.pacing.replace(/_/g, " ")}\n`;

        // Performance metrics (if available)
        const perf = tactic.performance;
        if (perf && perf.impressions > 0) {
          summary += `\n**📈 Performance:**\n`;
          summary += `• Impressions: ${perf.impressions.toLocaleString()}\n`;
          summary += `• Spend: $${perf.spend.toLocaleString()}\n`;
          summary += `• Actual CPM: $${perf.cpm.toFixed(2)}\n`;

          if (perf.clicks && perf.clicks > 0) {
            summary += `• CTR: ${(perf.ctr! * 100).toFixed(2)}%\n`;
          }

          if (perf.conversions && perf.conversions > 0) {
            summary += `• Conversions: ${perf.conversions}\n`;
            summary += `• CPA: $${perf.cpa!.toFixed(2)}\n`;
          }

          // Performance indicators
          const performanceWarnings = [];
          if (perf.cpm > tactic.effectivePricing.totalCpm * 1.2) {
            performanceWarnings.push(
              "⚠️ Actual CPM significantly higher than expected",
            );
          }
          if (perf.ctr && perf.ctr < 0.001) {
            performanceWarnings.push("⚠️ Low click-through rate");
          }

          if (performanceWarnings.length > 0) {
            summary += `• **Alerts:** ${performanceWarnings.join(", ")}\n`;
          }
        }

        summary += `\n**ID:** ${tactic.id}\n`;
        summary += `---\n\n`;
      };

      // Display active tactics first
      if (activeTactics.length > 0) {
        summary += `## 🟢 **Active Tactics** (${activeTactics.length})\n\n`;
        activeTactics.forEach((tactic, index) => displayTactic(tactic, index));
      }

      // Display draft tactics
      if (draftTactics.length > 0) {
        summary += `## ⚪ **Draft Tactics** (${draftTactics.length})\n\n`;
        draftTactics.forEach((tactic, index) => displayTactic(tactic, index));
      }

      // Display paused tactics
      if (pausedTactics.length > 0) {
        summary += `## 🟡 **Paused Tactics** (${pausedTactics.length})\n\n`;
        pausedTactics.forEach((tactic, index) => displayTactic(tactic, index));
      }

      // Display completed tactics
      if (completedTactics.length > 0) {
        summary += `## ✅ **Completed Tactics** (${completedTactics.length})\n\n`;
        completedTactics.forEach((tactic, index) =>
          displayTactic(tactic, index),
        );
      }

      // Budget allocation visualization
      if (tactics.length > 1) {
        summary += `## 💸 **Budget Distribution**\n\n`;
        tactics
          .sort((a, b) => b.budgetAllocation.amount - a.budgetAllocation.amount)
          .forEach((tactic) => {
            const percentage = (
              (tactic.budgetAllocation.amount / totalBudget) *
              100
            ).toFixed(1);
            const bar = "█".repeat(Math.floor(parseInt(percentage) / 5));
            summary += `• **${tactic.name}:** $${tactic.budgetAllocation.amount.toLocaleString()} (${percentage}%) ${bar}\n`;
          });
        summary += `\n`;
      }

      // Recommendations
      summary += `## 💡 **Recommendations**\n\n`;

      if (draftTactics.length > 0) {
        summary += `• **${draftTactics.length} draft tactic(s)** ready for activation\n`;
      }

      const highCpmTactics = tactics.filter(
        (tactic) => tactic.effectivePricing.totalCpm > 50,
      );
      if (highCpmTactics.length > 0) {
        summary += `• **${highCpmTactics.length} tactic(s)** have high CPM (>$50) - consider budget reallocation\n`;
      }

      const performingTactics = tactics.filter(
        (tactic) =>
          tactic.performance &&
          tactic.performance.ctr &&
          tactic.performance.ctr > 0.002,
      );
      if (performingTactics.length > 0) {
        summary += `• **${performingTactics.length} tactic(s)** showing strong CTR performance - consider increasing budget\n`;
      }

      summary += `\n**Available Actions:**\n`;
      summary += `• Use campaign/update with tacticAdjustments to modify budget distribution\n`;
      summary += `• Use reporting/export-data for detailed performance analysis\n`;
      summary += `• Create new tactics with tactic/create`;

      return createMCPResponse({
        data: {
          campaignId: args.campaignId,
          count: tactics.length,
          groupedTactics: {
            active: activeTactics,
            completed: completedTactics,
            draft: draftTactics,
            paused: pausedTactics,
          },
          recommendations: {
            draftTacticsToActivate: draftTactics.length,
            highCpmTactics: tactics.filter(
              (t) => t.effectivePricing.totalCpm > 50,
            ).length,
            performingTactics: tactics.filter(
              (t) =>
                t.performance && t.performance.ctr && t.performance.ctr > 0.002,
            ).length,
          },
          summary: {
            activeTactics: activeTactics.length,
            averageCpm:
              totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0,
            budgetUtilization:
              totalBudget > 0 ? (totalSpend / totalBudget) * 100 : 0,
            completedTactics: completedTactics.length,
            draftTactics: draftTactics.length,
            pausedTactics: pausedTactics.length,
            totalBudget,
            totalImpressions,
            totalSpend,
            totalTactics: tactics.length,
          },
          tactics,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to list tactics: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "tactic_list",
  parameters: z.object({
    campaignId: z.string().describe("ID of the campaign to list tactics for"),
  }),
});
