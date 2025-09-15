import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createMCPResponse } from "../../utils/error-handling.js";

export const listTacticsTool = (client: Scope3ApiClient) => ({
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
      const tactics = await client.listTactics(apiKey, args.campaignId);

      if (tactics.length === 0) {
        return createMCPResponse({
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
        (sum, tactic) => sum + (tactic.performance?.spend || 0),
        0,
      );

      const totalImpressions = tactics.reduce(
        (sum, tactic) => sum + (tactic.performance?.impressions || 0),
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
            paused: "🟡",
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
        if (tactic.performance && tactic.performance.impressions > 0) {
          summary += `\n**📈 Performance:**\n`;
          summary += `• Impressions: ${tactic.performance.impressions.toLocaleString()}\n`;
          summary += `• Spend: $${tactic.performance.spend.toLocaleString()}\n`;
          summary += `• Actual CPM: $${tactic.performance.cpm.toFixed(2)}\n`;

          if (tactic.performance.clicks && tactic.performance.clicks > 0) {
            summary += `• CTR: ${(tactic.performance.ctr! * 100).toFixed(2)}%\n`;
          }

          if (
            tactic.performance.conversions &&
            tactic.performance.conversions > 0
          ) {
            summary += `• Conversions: ${tactic.performance.conversions}\n`;
            summary += `• CPA: $${tactic.performance.cpa!.toFixed(2)}\n`;
          }

          // Performance indicators
          const performanceWarnings = [];
          if (tactic.performance.cpm > tactic.effectivePricing.totalCpm * 1.2) {
            performanceWarnings.push(
              "⚠️ Actual CPM significantly higher than expected",
            );
          }
          if (tactic.performance.ctr && tactic.performance.ctr < 0.001) {
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
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to list tactics: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "tactic/list",
  parameters: z.object({
    campaignId: z.string().describe("ID of the campaign to list tactics for"),
  }),
});
