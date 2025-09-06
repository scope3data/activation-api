import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const createInventoryOptionTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "inventory-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Inventory Option",
  },

  description:
    "Create a new inventory option by combining a publisher media product with a targeting strategy. This creates a 'tactic' that represents a specific way to buy and target inventory. The inventory option includes budget allocation, signal configuration, and effective pricing. Requires authentication.",

  execute: async (
    args: {
      budgetAllocation: {
        amount: number;
        currency?: string;
        dailyCap?: number;
        pacing?: "asap" | "even" | "front_loaded";
        percentage?: number;
      };
      campaignId: string;
      description?: string;
      mediaProductId: string;
      name: string;
      targeting: {
        inheritFromCampaign?: boolean;
        overrides?: {
          demographics?: Record<string, unknown>;
          geo?: string[];
          interests?: string[];
        };
        signalConfiguration?: {
          audienceIds?: string[];
          customParameters?: Record<string, unknown>;
          segments?: string[];
        };
        signalProvider?: string;
        signalType: "buyer" | "none" | "scope3" | "third_party";
      };
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
      const inventoryOptionInput = {
        budgetAllocation: {
          amount: args.budgetAllocation.amount,
          currency: args.budgetAllocation.currency || "USD",
          dailyCap: args.budgetAllocation.dailyCap,
          pacing: args.budgetAllocation.pacing || "even",
          percentage: args.budgetAllocation.percentage,
        },
        campaignId: args.campaignId,
        description: args.description,
        mediaProductId: args.mediaProductId,
        name: args.name,
        targeting: {
          inheritFromCampaign: args.targeting.inheritFromCampaign ?? true,
          overrides: args.targeting.overrides,
          signalConfiguration: args.targeting.signalConfiguration,
          signalProvider: args.targeting.signalProvider,
          signalType: args.targeting.signalType,
        },
      };

      const inventoryOption = await client.createInventoryOption(
        apiKey,
        inventoryOptionInput,
      );

      let summary = `✅ **Inventory Option Created Successfully!**\n\n`;

      // Header with option details
      summary += `## 🎯 **${inventoryOption.name}**\n\n`;

      if (inventoryOption.description) {
        summary += `**Description:** ${inventoryOption.description}\n\n`;
      }

      // Publisher product information
      const product = inventoryOption.mediaProduct;
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

      // Targeting strategy
      summary += `### 🎯 **Targeting Strategy**\n`;
      summary += `• **Signal Type:** ${inventoryOption.targeting.signalType.replace(/_/g, " ")}\n`;

      if (inventoryOption.targeting.signalProvider) {
        summary += `• **Signal Provider:** ${inventoryOption.targeting.signalProvider}\n`;
      }

      if (inventoryOption.targeting.signalConfiguration?.audienceIds?.length) {
        summary += `• **Audiences:** ${inventoryOption.targeting.signalConfiguration.audienceIds.length} audiences assigned\n`;
      }

      if (inventoryOption.targeting.signalConfiguration?.segments?.length) {
        summary += `• **Segments:** ${inventoryOption.targeting.signalConfiguration.segments.join(", ")}\n`;
      }

      summary += `• **Inherit Campaign Targeting:** ${inventoryOption.targeting.inheritFromCampaign ? "Yes" : "No"}\n`;

      // Geographic overrides
      if (inventoryOption.targeting.overrides?.geo?.length) {
        summary += `• **Geographic Override:** ${inventoryOption.targeting.overrides.geo.join(", ")}\n`;
      }

      summary += `\n`;

      // Effective pricing (after signals)
      summary += `### 💰 **Effective Pricing**\n`;
      summary += `• **Base CPM:** $${inventoryOption.effectivePricing.cpm.toFixed(2)}\n`;

      if (
        inventoryOption.effectivePricing.signalCost &&
        inventoryOption.effectivePricing.signalCost > 0
      ) {
        summary += `• **Signal Cost:** +$${inventoryOption.effectivePricing.signalCost.toFixed(2)}\n`;
      }

      summary += `• **🏷️ Total Effective CPM:** $${inventoryOption.effectivePricing.totalCpm.toFixed(2)}\n\n`;

      // Budget allocation
      summary += `### 💳 **Budget Allocation**\n`;
      summary += `• **Budget:** $${inventoryOption.budgetAllocation.amount.toLocaleString()} ${inventoryOption.budgetAllocation.currency}\n`;

      if (inventoryOption.budgetAllocation.percentage) {
        summary += `• **Campaign Share:** ${inventoryOption.budgetAllocation.percentage}%\n`;
      }

      if (inventoryOption.budgetAllocation.dailyCap) {
        summary += `• **Daily Cap:** $${inventoryOption.budgetAllocation.dailyCap.toLocaleString()} ${inventoryOption.budgetAllocation.currency}\n`;
      }

      summary += `• **Pacing:** ${inventoryOption.budgetAllocation.pacing.replace(/_/g, " ")}\n`;

      // Calculate projected impressions
      const projectedImpressions = Math.floor(
        (inventoryOption.budgetAllocation.amount /
          inventoryOption.effectivePricing.totalCpm) *
          1000,
      );
      summary += `• **Projected Impressions:** ~${projectedImpressions.toLocaleString()}\n\n`;

      // Status and metadata
      summary += `### ℹ️ **Status**\n`;
      summary += `• **Option ID:** ${inventoryOption.id}\n`;
      summary += `• **Status:** ${inventoryOption.status}\n`;
      summary += `• **Created:** ${new Date(inventoryOption.createdAt).toLocaleString()}\n\n`;

      // Next steps and recommendations
      summary += `### 📋 **Next Steps**\n`;
      summary += `• Review and activate the inventory option when ready\n`;
      summary += `• Monitor performance using analyze_inventory_performance\n`;
      summary += `• Adjust budget allocation with adjust_inventory_allocation as needed\n`;

      if (inventoryOption.targeting.signalType === "none") {
        summary += `• ⚠️ Consider adding signals for better targeting effectiveness\n`;
      }

      if (
        inventoryOption.effectivePricing.signalCost &&
        inventoryOption.effectivePricing.signalCost >
          inventoryOption.effectivePricing.cpm * 0.5
      ) {
        summary += `• ⚠️ Signal cost is high relative to base CPM - review cost-effectiveness\n`;
      }

      summary += `\n✨ **Inventory option is ready for campaign activation!**`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to create inventory option", error);
    }
  },

  name: "create_inventory_option",
  parameters: z.object({
    budgetAllocation: z
      .object({
        amount: z
          .number()
          .min(0)
          .describe("Budget amount for this inventory option"),
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
    campaignId: z
      .string()
      .describe("ID of the campaign to add this inventory option to"),
    description: z
      .string()
      .optional()
      .describe("Optional description of the inventory option"),
    mediaProductId: z
      .string()
      .describe("ID of the publisher media product to use"),
    name: z
      .string()
      .describe(
        "Name for this inventory option (e.g., 'Hulu Premium + Scope3')",
      ),
    targeting: z
      .object({
        inheritFromCampaign: z
          .boolean()
          .default(true)
          .describe("Whether to inherit targeting from the campaign"),
        overrides: z
          .object({
            demographics: z
              .record(z.unknown())
              .optional()
              .describe("Demographic targeting overrides"),
            geo: z
              .array(z.string())
              .optional()
              .describe("Geographic targeting override"),
            interests: z
              .array(z.string())
              .optional()
              .describe("Interest targeting override"),
          })
          .optional()
          .describe("Targeting overrides for this specific option"),
        signalConfiguration: z
          .object({
            audienceIds: z
              .array(z.string())
              .optional()
              .describe("Audience IDs to target"),
            customParameters: z
              .record(z.unknown())
              .optional()
              .describe("Custom signal parameters"),
            segments: z
              .array(z.string())
              .optional()
              .describe("Segment names to target"),
          })
          .optional()
          .describe("Signal-specific configuration"),
        signalProvider: z
          .string()
          .optional()
          .describe("Signal provider name (e.g., 'LiveRamp', 'Scope3')"),
        signalType: z
          .enum(["buyer", "scope3", "third_party", "none"])
          .describe("Type of data signal to apply"),
      })
      .describe("Targeting strategy configuration"),
  }),
});
