import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const adjustInventoryAllocationTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "inventory-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Adjust Inventory Allocation",
  },

  description:
    "Adjust budget allocation for inventory options within a campaign. Can update budget amounts, percentages, daily caps, or pacing strategies. Supports bulk updates across multiple options. Use this to rebalance budget based on performance or changing priorities. Requires authentication.",

  execute: async (
    args: {
      adjustments: Array<{
        budgetAllocation?: {
          amount?: number;
          dailyCap?: number;
          pacing?: "asap" | "even" | "front_loaded";
          percentage?: number;
        };
        optionId: string;
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
      const updatedOptions = [];
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

          const updatedOption = await client.updateInventoryOption(
            apiKey!,
            adjustment.optionId,
            updateInput,
          );

          updatedOptions.push(updatedOption);
        } catch (error) {
          errors.push({
            error: error instanceof Error ? error.message : String(error),
            optionId: adjustment.optionId,
          });
        }
      }

      if (errors.length > 0 && updatedOptions.length === 0) {
        return createErrorResponse(
          "Failed to update any inventory options",
          new Error(
            `Errors: ${errors.map((e) => `${e.optionId}: ${e.error}`).join(", ")}`,
          ),
        );
      }

      let summary = `✅ **Budget Allocation Updated Successfully!**\n\n`;

      if (args.reason) {
        summary += `**Reason for Adjustment:** ${args.reason}\n\n`;
      }

      // Calculate new totals
      const totalNewBudget = updatedOptions.reduce(
        (sum, option) => sum + option.budgetAllocation.amount,
        0,
      );

      if (updatedOptions.length > 0) {
        summary += `## 📊 **Updated Options** (${updatedOptions.length})\n\n`;

        updatedOptions.forEach((option, index) => {
          summary += `### ${index + 1}. **${option.name}**\n`;

          // Publisher product
          summary += `**Publisher:** ${option.mediaProduct.publisherName} → ${option.mediaProduct.name}\n`;

          // Signal strategy
          summary += `**Signal:** ${option.targeting.signalType.replace(/_/g, " ")}`;
          if (option.targeting.signalProvider) {
            summary += ` (${option.targeting.signalProvider})`;
          }
          summary += `\n`;

          // Updated budget allocation
          summary += `\n**💳 New Budget Allocation:**\n`;
          summary += `• **Budget:** $${option.budgetAllocation.amount.toLocaleString()} ${option.budgetAllocation.currency}`;

          if (option.budgetAllocation.percentage) {
            summary += ` (${option.budgetAllocation.percentage}% of campaign)`;
          }
          summary += `\n`;

          if (option.budgetAllocation.dailyCap) {
            summary += `• **Daily Cap:** $${option.budgetAllocation.dailyCap.toLocaleString()}\n`;
          }

          summary += `• **Pacing:** ${option.budgetAllocation.pacing.replace(/_/g, " ")}\n`;

          // Effective pricing and projections
          summary += `• **Effective CPM:** $${option.effectivePricing.totalCpm.toFixed(2)}\n`;
          const projectedImpressions = Math.floor(
            (option.budgetAllocation.amount /
              option.effectivePricing.totalCpm) *
              1000,
          );
          summary += `• **Projected Impressions:** ~${projectedImpressions.toLocaleString()}\n`;

          // Performance comparison (if available)
          if (option.performance && option.performance.spend > 0) {
            const remainingBudget =
              option.budgetAllocation.amount - option.performance.spend;
            const spendPercentage =
              (option.performance.spend / option.budgetAllocation.amount) * 100;

            summary += `\n**📈 Current Performance:**\n`;
            summary += `• **Spent:** $${option.performance.spend.toLocaleString()} (${spendPercentage.toFixed(1)}%)\n`;
            summary += `• **Remaining:** $${remainingBudget.toLocaleString()}\n`;

            if (option.performance.impressions > 0) {
              summary += `• **Delivered:** ${option.performance.impressions.toLocaleString()} impressions\n`;
              summary += `• **Actual CPM:** $${option.performance.cpm.toFixed(2)}\n`;
            }

            // Performance alerts
            if (
              option.performance.cpm >
              option.effectivePricing.totalCpm * 1.2
            ) {
              summary += `• ⚠️ **Alert:** Actual CPM is ${((option.performance.cpm / option.effectivePricing.totalCpm - 1) * 100).toFixed(1)}% higher than expected\n`;
            }
          }

          summary += `\n**ID:** ${option.id}\n`;
          summary += `**Status:** ${option.status}\n`;
          summary += `**Updated:** ${new Date(option.updatedAt).toLocaleString()}\n`;
          summary += `---\n\n`;
        });

        // Summary statistics
        summary += `## 📈 **Allocation Summary**\n\n`;
        summary += `• **Total Budget (Updated Options):** $${totalNewBudget.toLocaleString()}\n`;

        // Budget distribution
        if (updatedOptions.length > 1) {
          summary += `\n**Budget Distribution:**\n`;
          updatedOptions
            .sort(
              (a, b) => b.budgetAllocation.amount - a.budgetAllocation.amount,
            )
            .forEach((option) => {
              const percentage = (
                (option.budgetAllocation.amount / totalNewBudget) *
                100
              ).toFixed(1);
              const bar = "█".repeat(Math.floor(parseInt(percentage) / 5));
              summary += `• **${option.name}:** ${percentage}% ${bar}\n`;
            });
        }

        // Optimization insights
        summary += `\n## 💡 **Optimization Insights**\n\n`;

        const highBudgetOptions = updatedOptions.filter(
          (opt) => opt.budgetAllocation.amount > totalNewBudget * 0.4,
        );
        if (highBudgetOptions.length > 0) {
          summary += `• **${highBudgetOptions.length} option(s)** now have high budget concentration (>40%)\n`;
        }

        const lowCpmOptions = updatedOptions.filter(
          (opt) => opt.effectivePricing.totalCpm < 20,
        );
        if (lowCpmOptions.length > 0) {
          summary += `• **${lowCpmOptions.length} option(s)** have cost-effective CPM (<$20) - good value\n`;
        }

        const performingOptions = updatedOptions.filter(
          (opt) =>
            opt.performance &&
            opt.performance.ctr &&
            opt.performance.ctr > 0.002,
        );
        if (performingOptions.length > 0) {
          summary += `• **${performingOptions.length} option(s)** showing strong CTR performance\n`;
        }

        // Pacing analysis
        const frontLoadedOptions = updatedOptions.filter(
          (opt) => opt.budgetAllocation.pacing === "front_loaded",
        );
        const asapOptions = updatedOptions.filter(
          (opt) => opt.budgetAllocation.pacing === "asap",
        );

        if (frontLoadedOptions.length > 0 || asapOptions.length > 0) {
          summary += `• **Aggressive Pacing:** ${frontLoadedOptions.length + asapOptions.length} option(s) using accelerated spend\n`;
        }
      }

      // Report any errors
      if (errors.length > 0) {
        summary += `\n## ⚠️ **Errors** (${errors.length})\n\n`;
        errors.forEach((error, index) => {
          summary += `${index + 1}. **Option ID:** ${error.optionId}\n`;
          summary += `   **Error:** ${error.error}\n\n`;
        });
      }

      // Next steps
      summary += `\n## 📋 **Next Steps**\n\n`;
      summary += `• Monitor updated inventory options with list_inventory_options\n`;
      summary += `• Track performance changes with analyze_inventory_performance\n`;
      summary += `• Consider activating any draft options if budget allows\n`;

      if (
        updatedOptions.some((opt) => opt.budgetAllocation.pacing === "asap")
      ) {
        summary += `• ⚠️ Monitor ASAP paced options closely to avoid overspend\n`;
      }

      const totalEffectiveCpm =
        updatedOptions.reduce(
          (sum, opt) =>
            sum + opt.effectivePricing.totalCpm * opt.budgetAllocation.amount,
          0,
        ) / totalNewBudget;

      summary += `\n**🎯 Weighted Average CPM:** $${totalEffectiveCpm.toFixed(2)}`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        "Failed to adjust inventory allocation",
        error,
      );
    }
  },

  name: "adjust_inventory_allocation",
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
          optionId: z.string().describe("ID of the inventory option to update"),
        }),
      )
      .min(1)
      .describe("Array of adjustments to make to inventory options"),
    reason: z
      .string()
      .optional()
      .describe(
        "Optional reason for the budget adjustment (for documentation)",
      ),
  }),
});
