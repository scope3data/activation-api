import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { TacticBigQueryService } from "../../services/tactic-bigquery-service.js";
import { CreativeSyncService } from "../../services/creative-sync-service.js";
import { NotificationService } from "../../services/notification-service.js";
import { AuthenticationService } from "../../services/auth-service.js";
import { createMCPResponse } from "../../utils/error-handling.js";

const CreateTacticSchema = z.object({
  brandStoryId: z.string().min(1, "Brand story ID is required"),
  budgetAllocation: z.object({
    amount: z.number().positive("Amount must be positive"),
    currency: z.string().optional().default("USD"),
    dailyCap: z.number().optional(),
    pacing: z.enum(["asap", "even", "front_loaded"]).optional().default("even"),
    percentage: z.number().optional(),
  }),
  campaignId: z.string().min(1, "Campaign ID is required"),
  cpm: z.number().positive("CPM must be positive"),
  description: z.string().optional(),
  mediaProductId: z.string().min(1, "Media product ID is required"),
  name: z.string().min(1, "Name is required"),
  signalId: z.string().optional(),
});

export const createTacticTool = (_client: Scope3ApiClient) => ({
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
    args: unknown,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Validate input
    const validatedArgs = CreateTacticSchema.parse(args);
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
        brandStoryId: validatedArgs.brandStoryId,
        budgetAllocation: {
          amount: validatedArgs.budgetAllocation.amount,
          currency: validatedArgs.budgetAllocation.currency,
          dailyCap: validatedArgs.budgetAllocation.dailyCap,
          pacing: validatedArgs.budgetAllocation.pacing,
          percentage: validatedArgs.budgetAllocation.percentage,
        },
        campaignId: validatedArgs.campaignId,
        cpm: validatedArgs.cpm,
        description: validatedArgs.description,
        mediaProductId: validatedArgs.mediaProductId,
        name: validatedArgs.name,
        signalId: validatedArgs.signalId,
      };

      // IMPORTANT: GraphQL doesn't have tactic mutations, so we use BigQuery-only approach
      // This implements the full tactic creation functionality using BigQuery backend

      const bigQueryService = new TacticBigQueryService();
      const tactic = await bigQueryService.createTactic(tacticInput, apiKey);

      // Trigger automatic sync of campaign creatives to this new tactic's sales agent
      try {
        const authService = new AuthenticationService();
        const creativeSyncService = new CreativeSyncService(authService);
        const notificationService = new NotificationService(authService);
        creativeSyncService.setNotificationService(notificationService);

        // Get sales agent ID from the media product (assuming it's available in the response)
        const salesAgentId = tactic.mediaProduct?.publisherId || tactic.salesAgentId;
        
        if (salesAgentId) {
          // Trigger sync in background - don't wait for completion
          creativeSyncService.onTacticCreated(tactic.id, validatedArgs.campaignId, salesAgentId)
            .catch((syncError) => {
              console.warn(`Background creative sync failed for new tactic ${tactic.id}:`, syncError);
            });
        }
      } catch (syncError) {
        console.warn('Failed to initialize sync services for tactic creation:', syncError);
        // Don't fail tactic creation if sync setup fails
      }

      let summary = `✅ **Tactic Created Successfully!**\n\n`;

      // Header with option details
      summary += `## 🎯 **${tactic.name}**\n\n`;

      if (tactic.description) {
        summary += `**Description:** ${tactic.description}\n\n`;
      }

      // Publisher product information
      const product = tactic.mediaProduct;
      if (!product) {
        throw new Error(
          "Media product is required but was not found in tactic creation response",
        );
      }
      summary += `### 📦 **Publisher Product**\n`;
      summary += `• **Publisher:** ${product.publisherName || "Unknown Publisher"}\n`;
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
      summary += `• **CPM:** $${validatedArgs.cpm.toFixed(2)}\n`;

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
      
      // Add info about automatic creative sync
      summary += `\n🔄 **Automatic Creative Sync:**\n`;
      summary += `• Campaign creatives are being synced to this tactic's sales agent\n`;
      summary += `• Only format-compatible creatives will be synced\n`;
      summary += `• You'll receive notifications if any sync issues occur\n`;

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
            brandStoryId: validatedArgs.brandStoryId,
            budgetAllocation: validatedArgs.budgetAllocation,
            campaignId: validatedArgs.campaignId,
            cpm: validatedArgs.cpm,
            description: validatedArgs.description,
            mediaProductId: validatedArgs.mediaProductId,
            name: validatedArgs.name,
            signalId: validatedArgs.signalId,
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
  inputSchema: CreateTacticSchema,

  name: "create_tactic",
});
