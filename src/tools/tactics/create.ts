import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createMCPResponse } from "../../utils/error-handling.js";

export const createTacticTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Tactics",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Tactic",
  },

  description:
    "Create a new tactic by combining a publisher media product with a brand story and signal. Simplified targeting approach focusing on the core components: media product + brand story + signal configuration. Includes budget allocation and effective pricing. Requires authentication.",

  execute: async (
    args: {
      brandStoryId: string;
      budgetAllocation: {
        amount: number;
        currency?: string;
        dailyCap?: number;
        pacing?: "asap" | "even" | "front_loaded";
        percentage?: number;
      };
      campaignId: string;
      cpm: number;
      description?: string;
      mediaProductId: string;
      name: string;
      signalId?: string;
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
      const tacticInput = {
        brandStoryId: args.brandStoryId,
        budgetAllocation: {
          amount: args.budgetAllocation.amount,
          currency: args.budgetAllocation.currency || "USD",
          dailyCap: args.budgetAllocation.dailyCap,
          pacing: args.budgetAllocation.pacing || "even",
          percentage: args.budgetAllocation.percentage,
        },
        campaignId: args.campaignId,
        cpm: args.cpm,
        description: args.description,
        mediaProductId: args.mediaProductId,
        name: args.name,
        signalId: args.signalId,
      };

      const tactic = await client.createTactic(apiKey, tacticInput);

      let summary = `✅ **Tactic Created Successfully!**\n\n`;

      // Header with option details
      summary += `## 🎯 **${tactic.name}**\n\n`;

      if (tactic.description) {
        summary += `**Description:** ${tactic.description}\n\n`;
      }

      // Publisher product information
      const product = tactic.mediaProduct;
      summary += `### 📦 **Publisher Product**\n`;
      summary += `• **Publisher:** ${product.publisherName}\n`;
      summary += `• **Product:** ${product.name}\n`;
      summary += `• **Type:** ${product.inventoryType.replace(/_/g, " ")} • ${product.deliveryType.replace(/_/g, " ")}\n`;
      summary += `• **Formats:** ${product.formats.join(", ")}\n`;

      // Base pricing
      if (
        product.basePricing.model === "fixed_cpm" &&
        product.basePricing.fixedCpm
      ) {
        summary += `• **Base Price:** $${product.basePricing.fixedCpm.toFixed(2)} CPM\n`;
      } else if (product.basePricing.model === "auction") {
        summary += `• **Base Price:** Auction`;
        if (product.basePricing.floorCpm) {
          summary += ` (floor: $${product.basePricing.floorCpm.toFixed(2)})`;
        }
        summary += `\n`;
      }

      summary += `\n`;

      // Simplified targeting strategy
      summary += `### 🎯 **Targeting Strategy**\n`;
      summary += `• **Brand Story ID:** ${tactic.brandStoryId}\n`;
      summary += `• **CPM:** $${args.cpm.toFixed(2)}\n`;

      if (tactic.signalId) {
        summary += `• **Signal ID:** ${tactic.signalId}\n`;
      } else {
        summary += `• **Signal:** None (basic targeting)\n`;
      }

      summary += `\n`;

      // Effective pricing (after signals)
      summary += `### 💰 **Effective Pricing**\n`;
      summary += `• **Base CPM:** $${tactic.effectivePricing.cpm.toFixed(2)}\n`;

      if (
        tactic.effectivePricing.signalCost &&
        tactic.effectivePricing.signalCost > 0
      ) {
        summary += `• **Signal Cost:** +$${tactic.effectivePricing.signalCost.toFixed(2)}\n`;
      }

      summary += `• **🏷️ Total Effective CPM:** $${tactic.effectivePricing.totalCpm.toFixed(2)}\n\n`;

      // Budget allocation
      summary += `### 💳 **Budget Allocation**\n`;
      summary += `• **Budget:** $${tactic.budgetAllocation.amount.toLocaleString()} ${tactic.budgetAllocation.currency}\n`;

      if (tactic.budgetAllocation.percentage) {
        summary += `• **Campaign Share:** ${tactic.budgetAllocation.percentage}%\n`;
      }

      if (tactic.budgetAllocation.dailyCap) {
        summary += `• **Daily Cap:** $${tactic.budgetAllocation.dailyCap.toLocaleString()} ${tactic.budgetAllocation.currency}\n`;
      }

      summary += `• **Pacing:** ${tactic.budgetAllocation.pacing.replace(/_/g, " ")}\n`;

      // Calculate projected impressions
      const projectedImpressions = Math.floor(
        (tactic.budgetAllocation.amount / tactic.effectivePricing.totalCpm) *
          1000,
      );
      summary += `• **Projected Impressions:** ~${projectedImpressions.toLocaleString()}\n\n`;

      // Status and metadata
      summary += `### ℹ️ **Status**\n`;
      summary += `• **Tactic ID:** ${tactic.id}\n`;
      summary += `• **Status:** ${tactic.status}\n`;
      summary += `• **Created:** ${new Date(tactic.createdAt).toLocaleString()}\n\n`;

      // Next steps and recommendations
      summary += `### 📋 **Next Steps**\n`;
      summary += `• Review and activate the tactic when ready\n`;
      summary += `• Monitor performance using analyze_tactic_performance\n`;
      summary += `• Adjust budget allocation with adjust_tactic_allocation as needed\n`;

      if (!tactic.signalId) {
        summary += `• ⚠️ Consider adding a signal ID for better targeting effectiveness\n`;
      }

      if (
        tactic.effectivePricing.signalCost &&
        tactic.effectivePricing.signalCost > tactic.effectivePricing.cpm * 0.5
      ) {
        summary += `• ⚠️ Signal cost is high relative to base CPM - review cost-effectiveness\n`;
      }

      summary += `\n✨ **Tactic is ready for campaign activation!**`;

      return createMCPResponse({
        data: {
          configuration: {
            brandStoryId: args.brandStoryId,
            budgetAllocation: args.budgetAllocation,
            campaignId: args.campaignId,
            cpm: args.cpm,
            description: args.description,
            mediaProductId: args.mediaProductId,
            name: args.name,
            signalId: args.signalId,
          },
          effectivePricing: tactic.effectivePricing,
          mediaProduct: product,
          projectedMetrics: {
            effectiveCpm: tactic.effectivePricing.totalCpm,
            impressions: Math.floor(
              (tactic.budgetAllocation.amount /
                tactic.effectivePricing.totalCpm) *
                1000,
            ),
            totalBudget: tactic.budgetAllocation.amount,
          },
          tactic,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to create tactic: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "tactic_create",
  parameters: z.object({
    brandStoryId: z
      .string()
      .describe("ID of the brand story to use for this tactic"),
    budgetAllocation: z
      .object({
        amount: z.number().min(0).describe("Budget amount for this tactic"),
        currency: z
          .string()
          .default("USD")
          .describe("Currency code (default: USD)"),
        dailyCap: z
          .number()
          .min(0)
          .optional()
          .describe("Optional daily spending limit"),
        pacing: z
          .enum(["even", "asap", "front_loaded"])
          .default("even")
          .describe("Budget pacing strategy"),
        percentage: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("Percentage of total campaign budget"),
      })
      .describe("Budget allocation configuration"),
    campaignId: z.string().describe("ID of the campaign to add this tactic to"),
    cpm: z.number().min(0).describe("Cost per mille (CPM) for this tactic"),
    description: z
      .string()
      .optional()
      .describe("Optional description of the tactic"),
    mediaProductId: z
      .string()
      .describe("ID of the publisher media product to use"),
    name: z
      .string()
      .describe("Name for this tactic (e.g., 'Hulu Premium + Brand Story')"),
    signalId: z
      .string()
      .optional()
      .describe("Optional signal ID for enhanced targeting"),
  }),
});
