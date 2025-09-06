import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const listInventoryOptionsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "inventory-management",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Inventory Options",
  },

  description:
    "List all inventory options for a specific campaign. Shows the complete breakdown of publisher products, targeting strategies, budget allocations, and performance metrics. Use this to get an overview of how campaign budget is distributed across different inventory tactics. Requires authentication.",

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
      return createAuthErrorResponse();
    }

    try {
      const inventoryOptions = await client.listInventoryOptions(
        apiKey,
        args.campaignId,
      );

      if (inventoryOptions.length === 0) {
        return createMCPResponse({
          message:
            "📋 **No Inventory Options Found**\n\nThis campaign doesn't have any inventory options configured yet.\n\n**Next Steps:**\n• Use discover_publisher_products to find available inventory\n• Use create_inventory_option to add tactics to your campaign\n• Or set campaign to 'scope3_managed' mode for automatic inventory management",
          success: true,
        });
      }

      let summary = `📋 **Campaign Inventory Options** (${inventoryOptions.length} options)\n\n`;

      // Calculate totals for summary
      const totalBudget = inventoryOptions.reduce(
        (sum, option) => sum + option.budgetAllocation.amount,
        0,
      );

      const totalSpend = inventoryOptions.reduce(
        (sum, option) => sum + (option.performance?.spend || 0),
        0,
      );

      const totalImpressions = inventoryOptions.reduce(
        (sum, option) => sum + (option.performance?.impressions || 0),
        0,
      );

      // Group options by status for better organization
      const activeOptions = inventoryOptions.filter(
        (opt) => opt.status === "active",
      );
      const draftOptions = inventoryOptions.filter(
        (opt) => opt.status === "draft",
      );
      const pausedOptions = inventoryOptions.filter(
        (opt) => opt.status === "paused",
      );
      const completedOptions = inventoryOptions.filter(
        (opt) => opt.status === "completed",
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
      summary += `• **Active Options:** ${activeOptions.length} | **Draft:** ${draftOptions.length} | **Paused:** ${pausedOptions.length}\n\n`;

      // Function to display option details
      const displayOption = (
        option: (typeof inventoryOptions)[0],
        index: number,
      ) => {
        const statusIcon =
          {
            active: "🟢",
            completed: "✅",
            draft: "⚪",
            paused: "🟡",
          }[option.status] || "❓";

        summary += `### ${index + 1}. ${statusIcon} **${option.name}**\n`;

        if (option.description) {
          summary += `*${option.description}*\n\n`;
        }

        // Publisher product info
        summary += `**📦 Publisher Product:**\n`;
        summary += `• ${option.mediaProduct.publisherName} → ${option.mediaProduct.name}\n`;
        summary += `• Type: ${option.mediaProduct.inventoryType.replace(/_/g, " ")} (${option.mediaProduct.deliveryType.replace(/_/g, " ")})\n`;
        summary += `• Formats: ${option.mediaProduct.formats.join(", ")}\n`;

        // Targeting strategy
        summary += `\n**🎯 Targeting:**\n`;
        summary += `• Signal: ${option.targeting.signalType.replace(/_/g, " ")}`;
        if (option.targeting.signalProvider) {
          summary += ` (${option.targeting.signalProvider})`;
        }
        summary += `\n`;

        if (option.targeting.signalConfiguration?.audienceIds?.length) {
          summary += `• Audiences: ${option.targeting.signalConfiguration.audienceIds.length} assigned\n`;
        }

        // Pricing
        summary += `\n**💰 Pricing:**\n`;
        summary += `• Base CPM: $${option.effectivePricing.cpm.toFixed(2)}`;
        if (
          option.effectivePricing.signalCost &&
          option.effectivePricing.signalCost > 0
        ) {
          summary += ` + $${option.effectivePricing.signalCost.toFixed(2)} (signals)`;
        }
        summary += ` = **$${option.effectivePricing.totalCpm.toFixed(2)} effective CPM**\n`;

        // Budget allocation
        summary += `\n**💳 Budget:**\n`;
        summary += `• Allocated: $${option.budgetAllocation.amount.toLocaleString()} ${option.budgetAllocation.currency}`;
        if (option.budgetAllocation.percentage) {
          summary += ` (${option.budgetAllocation.percentage}%)`;
        }
        summary += `\n`;

        if (option.budgetAllocation.dailyCap) {
          summary += `• Daily Cap: $${option.budgetAllocation.dailyCap.toLocaleString()}\n`;
        }
        summary += `• Pacing: ${option.budgetAllocation.pacing.replace(/_/g, " ")}\n`;

        // Performance metrics (if available)
        if (option.performance && option.performance.impressions > 0) {
          summary += `\n**📈 Performance:**\n`;
          summary += `• Impressions: ${option.performance.impressions.toLocaleString()}\n`;
          summary += `• Spend: $${option.performance.spend.toLocaleString()}\n`;
          summary += `• Actual CPM: $${option.performance.cpm.toFixed(2)}\n`;

          if (option.performance.clicks && option.performance.clicks > 0) {
            summary += `• CTR: ${(option.performance.ctr! * 100).toFixed(2)}%\n`;
          }

          if (
            option.performance.conversions &&
            option.performance.conversions > 0
          ) {
            summary += `• Conversions: ${option.performance.conversions}\n`;
            summary += `• CPA: $${option.performance.cpa!.toFixed(2)}\n`;
          }

          // Performance indicators
          const performanceWarnings = [];
          if (option.performance.cpm > option.effectivePricing.totalCpm * 1.2) {
            performanceWarnings.push(
              "⚠️ Actual CPM significantly higher than expected",
            );
          }
          if (option.performance.ctr && option.performance.ctr < 0.001) {
            performanceWarnings.push("⚠️ Low click-through rate");
          }

          if (performanceWarnings.length > 0) {
            summary += `• **Alerts:** ${performanceWarnings.join(", ")}\n`;
          }
        }

        summary += `\n**ID:** ${option.id}\n`;
        summary += `---\n\n`;
      };

      // Display active options first
      if (activeOptions.length > 0) {
        summary += `## 🟢 **Active Options** (${activeOptions.length})\n\n`;
        activeOptions.forEach((option, index) => displayOption(option, index));
      }

      // Display draft options
      if (draftOptions.length > 0) {
        summary += `## ⚪ **Draft Options** (${draftOptions.length})\n\n`;
        draftOptions.forEach((option, index) => displayOption(option, index));
      }

      // Display paused options
      if (pausedOptions.length > 0) {
        summary += `## 🟡 **Paused Options** (${pausedOptions.length})\n\n`;
        pausedOptions.forEach((option, index) => displayOption(option, index));
      }

      // Display completed options
      if (completedOptions.length > 0) {
        summary += `## ✅ **Completed Options** (${completedOptions.length})\n\n`;
        completedOptions.forEach((option, index) =>
          displayOption(option, index),
        );
      }

      // Budget allocation visualization
      if (inventoryOptions.length > 1) {
        summary += `## 💸 **Budget Distribution**\n\n`;
        inventoryOptions
          .sort((a, b) => b.budgetAllocation.amount - a.budgetAllocation.amount)
          .forEach((option) => {
            const percentage = (
              (option.budgetAllocation.amount / totalBudget) *
              100
            ).toFixed(1);
            const bar = "█".repeat(Math.floor(parseInt(percentage) / 5));
            summary += `• **${option.name}:** $${option.budgetAllocation.amount.toLocaleString()} (${percentage}%) ${bar}\n`;
          });
        summary += `\n`;
      }

      // Recommendations
      summary += `## 💡 **Recommendations**\n\n`;

      if (draftOptions.length > 0) {
        summary += `• **${draftOptions.length} draft option(s)** ready for activation\n`;
      }

      const highCpmOptions = inventoryOptions.filter(
        (opt) => opt.effectivePricing.totalCpm > 50,
      );
      if (highCpmOptions.length > 0) {
        summary += `• **${highCpmOptions.length} option(s)** have high CPM (>$50) - consider budget reallocation\n`;
      }

      const performingOptions = inventoryOptions.filter(
        (opt) =>
          opt.performance && opt.performance.ctr && opt.performance.ctr > 0.002,
      );
      if (performingOptions.length > 0) {
        summary += `• **${performingOptions.length} option(s)** showing strong CTR performance - consider increasing budget\n`;
      }

      summary += `\n**Available Actions:**\n`;
      summary += `• Use adjust_inventory_allocation to modify budget distribution\n`;
      summary += `• Use analyze_inventory_performance for detailed performance analysis\n`;
      summary += `• Create new options with create_inventory_option`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to list inventory options", error);
    }
  },

  name: "list_inventory_options",
  parameters: z.object({
    campaignId: z
      .string()
      .describe("ID of the campaign to list inventory options for"),
  }),
});
