import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";
import type {
  EffectivePricing,
  TacticUpdateInput,
} from "../../types/tactics.js";

import { TacticBigQueryService } from "../../services/tactic-bigquery-service.js";
import { createMCPResponse } from "../../utils/error-handling.js";

export const updateTacticTool = (_client: Scope3ApiClient) => ({
  annotations: {
    category: "Tactics",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Update Tactic",
  },

  description:
    "Update an existing tactic's configuration including name, description, status, budget allocation, and pricing. Supports partial updates - only specified fields will be modified. Use this to adjust tactic performance, change budget allocation, or update status. Requires authentication.",

  execute: async (
    args: {
      budgetAllocation?: {
        amount?: number;
        currency?: string;
        dailyCap?: number;
        pacing?: "asap" | "even" | "front_loaded";
        percentage?: number;
      };
      cpm?: number;
      description?: string;
      name?: string;
      signalCost?: number;
      status?: "active" | "completed" | "draft" | "paused";
      tacticId: string;
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
      const bigQueryService = new TacticBigQueryService();

      // First verify the tactic exists
      const existingTactic = await bigQueryService.getTactic(
        args.tacticId,
        apiKey,
      );
      if (!existingTactic) {
        throw new Error(`Tactic with ID ${args.tacticId} not found`);
      }

      // Prepare update object
      const updates: {
        effectivePricing?: EffectivePricing;
      } & TacticUpdateInput = {};

      if (args.name !== undefined) {
        updates.name = args.name;
      }

      if (args.description !== undefined) {
        updates.description = args.description;
      }

      if (args.status !== undefined) {
        updates.status = args.status;
      }

      if (args.budgetAllocation) {
        updates.budgetAllocation = {};
        Object.keys(args.budgetAllocation).forEach((key) => {
          if (
            args.budgetAllocation![
              key as keyof typeof args.budgetAllocation
            ] !== undefined
          ) {
            (updates.budgetAllocation as Record<string, unknown>)[key] =
              args.budgetAllocation![key as keyof typeof args.budgetAllocation];
          }
        });
      }

      // Handle pricing updates
      if (args.cpm !== undefined || args.signalCost !== undefined) {
        const newCpm = args.cpm !== undefined ? args.cpm : existingTactic.cpm;
        const newSignalCost =
          args.signalCost !== undefined
            ? args.signalCost
            : existingTactic.signal_cost || 0;
        const newTotalCpm = newCpm + newSignalCost;

        updates.effectivePricing = {
          cpm: newCpm,
          currency: existingTactic.budget_currency,
          signalCost: newSignalCost > 0 ? newSignalCost : undefined,
          totalCpm: newTotalCpm,
        };
      }

      // Perform the update
      await bigQueryService.updateTactic(args.tacticId, updates, apiKey);

      // Get the updated tactic for response
      const updatedTactic = await bigQueryService.getTactic(
        args.tacticId,
        apiKey,
      );
      if (!updatedTactic) {
        throw new Error("Failed to retrieve updated tactic");
      }

      let summary = `✅ **Tactic Updated Successfully**\n\n`;

      // Show what was changed
      summary += `## 🎯 **${updatedTactic.name}**\n\n`;

      if (updatedTactic.description) {
        summary += `**Description:** ${updatedTactic.description}\n\n`;
      }

      summary += `### 📝 **Changes Applied**\n`;

      const changedFields = [];
      if (args.name !== undefined) {
        changedFields.push(`• **Name:** Updated to "${args.name}"`);
      }
      if (args.description !== undefined) {
        changedFields.push(
          `• **Description:** ${args.description ? "Updated" : "Cleared"}`,
        );
      }
      if (args.status !== undefined) {
        changedFields.push(`• **Status:** Changed to ${args.status}`);
      }
      if (args.budgetAllocation) {
        Object.entries(args.budgetAllocation).forEach(([key, value]) => {
          if (value !== undefined) {
            changedFields.push(`• **Budget ${key}:** Updated to ${value}`);
          }
        });
      }
      if (args.cpm !== undefined) {
        changedFields.push(`• **CPM:** Updated to $${args.cpm.toFixed(2)}`);
      }
      if (args.signalCost !== undefined) {
        changedFields.push(
          `• **Signal Cost:** Updated to $${args.signalCost.toFixed(2)}`,
        );
      }

      if (changedFields.length === 0) {
        summary += `• No changes were specified\n`;
      } else {
        summary += changedFields.join("\n") + "\n";
      }
      summary += `\n`;

      // Current configuration summary
      summary += `### 📊 **Current Configuration**\n`;
      summary += `• **Status:** ${updatedTactic.status}\n`;
      summary += `• **Campaign ID:** ${updatedTactic.campaign_id}\n`;
      summary += `• **Media Product ID:** ${updatedTactic.media_product_id}\n\n`;

      // Pricing
      summary += `### 💰 **Pricing**\n`;
      summary += `• **Base CPM:** $${updatedTactic.cpm.toFixed(2)}\n`;
      if (updatedTactic.signal_cost && updatedTactic.signal_cost > 0) {
        summary += `• **Signal Cost:** +$${updatedTactic.signal_cost.toFixed(2)}\n`;
      }
      summary += `• **🏷️ Total Effective CPM:** $${updatedTactic.total_cpm.toFixed(2)}\n\n`;

      // Budget
      summary += `### 💳 **Budget Allocation**\n`;
      summary += `• **Budget:** $${updatedTactic.budget_amount.toLocaleString()} ${updatedTactic.budget_currency}\n`;
      if (updatedTactic.budget_percentage) {
        summary += `• **Campaign Share:** ${updatedTactic.budget_percentage}%\n`;
      }
      if (updatedTactic.budget_daily_cap) {
        summary += `• **Daily Cap:** $${updatedTactic.budget_daily_cap.toLocaleString()}\n`;
      }
      summary += `• **Pacing:** ${updatedTactic.budget_pacing.replace(/_/g, " ")}\n`;

      // Calculate new projected impressions
      const projectedImpressions = Math.floor(
        (updatedTactic.budget_amount / updatedTactic.total_cpm) * 1000,
      );
      summary += `• **Projected Impressions:** ~${projectedImpressions.toLocaleString()}\n\n`;

      // Targeting info
      summary += `### 🎯 **Targeting**\n`;
      if (updatedTactic.brand_story_id) {
        summary += `• **Brand Story ID:** ${updatedTactic.brand_story_id}\n`;
      }
      if (updatedTactic.signal_id) {
        summary += `• **Signal ID:** ${updatedTactic.signal_id}\n`;
      } else {
        summary += `• **Signal:** None (basic targeting)\n`;
      }
      summary += `\n`;

      // Metadata
      summary += `### ℹ️ **Metadata**\n`;
      summary += `• **Tactic ID:** ${updatedTactic.id}\n`;
      summary += `• **Last Updated:** ${new Date(updatedTactic.updated_at).toLocaleString()}\n\n`;

      // Recommendations
      summary += `### 💡 **Recommendations**\n`;

      if (args.status === "draft") {
        summary += `• ⚠️ Tactic is now in draft status - remember to activate when ready\n`;
      } else if (args.status === "active") {
        summary += `• ✅ Tactic is now active and will participate in campaign delivery\n`;
      }

      if (updatedTactic.total_cpm > 50) {
        summary += `• 💰 High CPM detected ($${updatedTactic.total_cpm.toFixed(2)}) - monitor performance closely\n`;
      }

      if (
        updates.budgetAllocation?.amount &&
        updates.budgetAllocation.amount > 50000
      ) {
        summary += `• 📈 Large budget allocation - consider gradual scaling for optimization\n`;
      }

      summary += `\n**Available Actions:**\n`;
      summary += `• Use tactic_get to view full details\n`;
      summary += `• Use tactic_list to see all campaign tactics\n`;
      summary += `• Monitor performance with campaign analytics`;

      return createMCPResponse({
        data: {
          currentState: {
            budgetAmount: updatedTactic.budget_amount,
            effectiveCpm: updatedTactic.total_cpm,
            name: updatedTactic.name,
            projectedImpressions,
            status: updatedTactic.status,
          },
          tacticId: args.tacticId,
          updates: {
            applied: changedFields.length,
            fields: Object.keys(args).filter(
              (key) =>
                args[key as keyof typeof args] !== undefined &&
                key !== "tacticId",
            ),
          },
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to update tactic: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "tactic_update",
  parameters: z.object({
    budgetAllocation: z
      .object({
        amount: z.number().min(0).optional().describe("New budget amount"),
        currency: z.string().optional().describe("Currency code"),
        dailyCap: z
          .number()
          .min(0)
          .optional()
          .describe("New daily spending limit"),
        pacing: z
          .enum(["even", "asap", "front_loaded"])
          .optional()
          .describe("New budget pacing strategy"),
        percentage: z
          .number()
          .min(0)
          .max(100)
          .optional()
          .describe("New percentage of campaign budget"),
      })
      .optional()
      .describe("Budget allocation updates"),
    cpm: z.number().min(0).optional().describe("New cost per mille (CPM)"),
    description: z
      .string()
      .optional()
      .describe("New description for the tactic"),
    name: z.string().optional().describe("New name for the tactic"),
    signalCost: z
      .number()
      .min(0)
      .optional()
      .describe("New signal cost to add to base CPM"),
    status: z
      .enum(["active", "completed", "draft", "paused"])
      .optional()
      .describe("New status for the tactic"),
    tacticId: z.string().describe("ID of the tactic to update"),
  }),
});
