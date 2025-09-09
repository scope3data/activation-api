import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const adjustTacticAllocationTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "tactic-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Adjust Tactic Allocation",
  },

  description:
    "Adjust budget allocation for tactics within a campaign. Can update budget amounts, percentages, daily caps, or pacing strategies. Supports bulk updates across multiple tactics. Use this to rebalance budget based on performance or changing priorities. Requires authentication.",

  execute: async (
    args: {
      adjustments: Array<{
        budgetAllocation?: {
          amount?: number;
          dailyCap?: number;
          pacing?: "asap" | "even" | "front_loaded";
          percentage?: number;
        };
        tacticId: string;
      }>;
      reason?: string;
    },
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
      const updatedTactics = [];
      const errors = [];

      // Process each adjustment
      for (const adjustment of args.adjustments) {
        try {
          const updateInput = {
            budgetAllocation: adjustment.budgetAllocation,
          };

          // Remove undefined values
          if (updateInput.budgetAllocation) {
            Object.keys(updateInput.budgetAllocation).forEach((key) => {
              if (
                (updateInput.budgetAllocation as Record<string, unknown>)[
                  key
                ] === undefined
              ) {
                delete (
                  updateInput.budgetAllocation as Record<string, unknown>
                )[key];
              }
            });
          }

          const updatedTactic = await client.updateTactic(
            apiKey!,
            adjustment.tacticId,
            updateInput,
          );

          updatedTactics.push(updatedTactic);
        } catch (error) {
          errors.push({
            error: error instanceof Error ? error.message : String(error),
            tacticId: adjustment.tacticId,
          });
        }
      }

      if (errors.length > 0 && updatedTactics.length === 0) {
        return createErrorResponse(
          "Failed to update any tactics",
          new Error(
            `Errors: ${errors.map((e) => `${e.tacticId}: ${e.error}`).join(", ")}`,
          ),
        );
      }

      let summary = `✅ **Budget Allocation Updated Successfully!**\n\n`;

      if (args.reason) {
        summary += `**Reason for Adjustment:** ${args.reason}\n\n`;
      }

      // Calculate new totals
      const totalNewBudget = updatedTactics.reduce(
        (sum, tactic) => sum + tactic.budgetAllocation.amount,
        0,
      );

      if (updatedTactics.length > 0) {
        summary += `## 📊 **Updated Tactics** (${updatedTactics.length})\n\n`;

        updatedTactics.forEach((tactic, index) => {
          summary += `### ${index + 1}. **${tactic.name}**\n`;

          // Publisher product
          summary += `**Publisher:** ${tactic.mediaProduct.publisherName} → ${tactic.mediaProduct.name}\n`;

          // Signal strategy
          summary += `**Signal:** ${tactic.targeting.signalType.replace(/_/g, " ")}`;
          if (tactic.targeting.signalProvider) {
            summary += ` (${tactic.targeting.signalProvider})`;
          }
          summary += `\n`;

          // Updated budget allocation
          summary += `\n**💳 New Budget Allocation:**\n`;
          summary += `• **Budget:** $${tactic.budgetAllocation.amount.toLocaleString()} ${tactic.budgetAllocation.currency}`;

          if (tactic.budgetAllocation.percentage) {
            summary += ` (${tactic.budgetAllocation.percentage}% of campaign)`;
          }
          summary += `\n`;

          if (tactic.budgetAllocation.dailyCap) {
            summary += `• **Daily Cap:** $${tactic.budgetAllocation.dailyCap.toLocaleString()}\n`;
          }

          summary += `• **Pacing:** ${tactic.budgetAllocation.pacing.replace(/_/g, " ")}\n`;

          // Effective pricing and projections
          summary += `• **Effective CPM:** $${tactic.effectivePricing.totalCpm.toFixed(2)}\n`;
          const projectedImpressions = Math.floor(
            (tactic.budgetAllocation.amount /
              tactic.effectivePricing.totalCpm) *
              1000,
          );
          summary += `• **Projected Impressions:** ~${projectedImpressions.toLocaleString()}\n`;

          // Performance comparison (if available)
          if (tactic.performance && tactic.performance.spend > 0) {
            const remainingBudget =
              tactic.budgetAllocation.amount - tactic.performance.spend;
            const spendPercentage =
              (tactic.performance.spend / tactic.budgetAllocation.amount) * 100;

            summary += `\n**📈 Current Performance:**\n`;
            summary += `• **Spent:** $${tactic.performance.spend.toLocaleString()} (${spendPercentage.toFixed(1)}%)\n`;
            summary += `• **Remaining:** $${remainingBudget.toLocaleString()}\n`;

            if (tactic.performance.impressions > 0) {
              summary += `• **Delivered:** ${tactic.performance.impressions.toLocaleString()} impressions\n`;
              summary += `• **Actual CPM:** $${tactic.performance.cpm.toFixed(2)}\n`;
            }

            // Performance alerts
            if (
              tactic.performance.cpm >
              tactic.effectivePricing.totalCpm * 1.2
            ) {
              summary += `• ⚠️ **Alert:** Actual CPM is ${((tactic.performance.cpm / tactic.effectivePricing.totalCpm - 1) * 100).toFixed(1)}% higher than expected\n`;
            }
          }

          summary += `\n**ID:** ${tactic.id}\n`;
          summary += `**Status:** ${tactic.status}\n`;
          summary += `**Updated:** ${new Date(tactic.updatedAt).toLocaleString()}\n`;
          summary += `---\n\n`;
        });

        // Summary statistics
        summary += `## 📈 **Allocation Summary**\n\n`;
        summary += `• **Total Budget (Updated Tactics):** $${totalNewBudget.toLocaleString()}\n`;

        // Budget distribution
        if (updatedTactics.length > 1) {
          summary += `\n**Budget Distribution:**\n`;
          updatedTactics
            .sort(
              (a, b) => b.budgetAllocation.amount - a.budgetAllocation.amount,
            )
            .forEach((tactic) => {
              const percentage = (
                (tactic.budgetAllocation.amount / totalNewBudget) *
                100
              ).toFixed(1);
              const bar = "█".repeat(Math.floor(parseInt(percentage) / 5));
              summary += `• **${tactic.name}:** ${percentage}% ${bar}\n`;
            });
        }

        // Optimization insights
        summary += `\n## 💡 **Optimization Insights**\n\n`;

        const highBudgetTactics = updatedTactics.filter(
          (tactic) => tactic.budgetAllocation.amount > totalNewBudget * 0.4,
        );
        if (highBudgetTactics.length > 0) {
          summary += `• **${highBudgetTactics.length} tactic(s)** now have high budget concentration (>40%)\n`;
        }

        const lowCpmTactics = updatedTactics.filter(
          (tactic) => tactic.effectivePricing.totalCpm < 20,
        );
        if (lowCpmTactics.length > 0) {
          summary += `• **${lowCpmTactics.length} tactic(s)** have cost-effective CPM (<$20) - good value\n`;
        }

        const performingTactics = updatedTactics.filter(
          (tactic) =>
            tactic.performance &&
            tactic.performance.ctr &&
            tactic.performance.ctr > 0.002,
        );
        if (performingTactics.length > 0) {
          summary += `• **${performingTactics.length} tactic(s)** showing strong CTR performance\n`;
        }

        // Pacing analysis
        const frontLoadedTactics = updatedTactics.filter(
          (tactic) => tactic.budgetAllocation.pacing === "front_loaded",
        );
        const asapTactics = updatedTactics.filter(
          (tactic) => tactic.budgetAllocation.pacing === "asap",
        );

        if (frontLoadedTactics.length > 0 || asapTactics.length > 0) {
          summary += `• **Aggressive Pacing:** ${frontLoadedTactics.length + asapTactics.length} tactic(s) using accelerated spend\n`;
        }
      }

      // Report any errors
      if (errors.length > 0) {
        summary += `\n## ⚠️ **Errors** (${errors.length})\n\n`;
        errors.forEach((error, index) => {
          summary += `${index + 1}. **Tactic ID:** ${error.tacticId}\n`;
          summary += `   **Error:** ${error.error}\n\n`;
        });
      }

      // Next steps
      summary += `\n## 📋 **Next Steps**\n\n`;
      summary += `• Monitor updated tactics with list_tactics\n`;
      summary += `• Track performance changes with analyze_tactic_performance\n`;
      summary += `• Consider activating any draft tactics if budget allows\n`;

      if (
        updatedTactics.some((tactic) => tactic.budgetAllocation.pacing === "asap")
      ) {
        summary += `• ⚠️ Monitor ASAP paced tactics closely to avoid overspend\n`;
      }

      const totalEffectiveCpm =
        updatedTactics.reduce(
          (sum, tactic) =>
            sum + tactic.effectivePricing.totalCpm * tactic.budgetAllocation.amount,
          0,
        ) / totalNewBudget;

      summary += `\n**🎯 Weighted Average CPM:** $${totalEffectiveCpm.toFixed(2)}`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        "Failed to adjust tactic allocation",
        error,
      );
    }
  },

  name: "adjust_tactic_allocation",
  parameters: z.object({
    adjustments: z
      .array(
        z.object({
          budgetAllocation: z
            .object({
              amount: z
                .number()
                .min(0)
                .optional()
                .describe("New budget amount"),
              dailyCap: z
                .number()
                .min(0)
                .optional()
                .describe("New daily spending cap"),
              pacing: z
                .enum(["even", "asap", "front_loaded"])
                .optional()
                .describe("New pacing strategy"),
              percentage: z
                .number()
                .min(0)
                .max(100)
                .optional()
                .describe("New percentage of campaign budget"),
            })
            .optional()
            .describe("Budget allocation updates"),
          tacticId: z.string().describe("ID of the tactic to update"),
        }),
      )
      .min(1)
      .describe("Array of adjustments to make to tactics"),
    reason: z
      .string()
      .optional()
      .describe(
        "Optional reason for the budget adjustment (for documentation)",
      ),
  }),
});
