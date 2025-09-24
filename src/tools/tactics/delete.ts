import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { TacticBigQueryService } from "../../services/tactic-bigquery-service.js";
import { createMCPResponse } from "../../utils/error-handling.js";

export const deleteTacticTool = (_client: Scope3ApiClient) => ({
  annotations: {
    category: "Tactics",
    dangerLevel: "high",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Delete Tactic",
  },

  description:
    "Delete a tactic by marking it as inactive. This stops the tactic from participating in campaign delivery and removes it from active listings. The tactic data is preserved for historical reporting. Use with caution as this action affects campaign budget allocation and delivery. Requires authentication.",

  execute: async (
    args: {
      tacticId: string;
      confirm: boolean;
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

    if (!args.confirm) {
      return createMCPResponse({
        data: {
          tacticId: args.tacticId,
          requiresConfirmation: true,
        },
        message: `⚠️ **Confirmation Required**\n\nYou are about to delete tactic: **${args.tacticId}**\n\n**This action will:**\n• Mark the tactic as inactive\n• Stop it from participating in campaign delivery\n• Remove it from active tactic listings\n• Preserve data for historical reporting\n\n**To confirm deletion, call this tool again with:**\n\`\`\`json\n{\n  "tacticId": "${args.tacticId}",\n  "confirm": true\n}\n\`\`\`\n\n**Alternatives:**\n• Use tactic_update to pause instead of delete\n• Use tactic_get to review details before deletion`,
        success: false,
      });
    }

    try {
      const bigQueryService = new TacticBigQueryService();
      
      // First verify the tactic exists and get its details
      const existingTactic = await bigQueryService.getTactic(args.tacticId, apiKey);
      if (!existingTactic) {
        throw new Error(`Tactic with ID ${args.tacticId} not found`);
      }

      // Store tactic details for response
      const tacticDetails = {
        id: existingTactic.id,
        name: existingTactic.name,
        campaignId: existingTactic.campaign_id,
        budgetAmount: existingTactic.budget_amount,
        budgetCurrency: existingTactic.budget_currency,
        status: existingTactic.status,
        cpm: existingTactic.total_cpm,
      };

      // Perform the deletion (mark as inactive)
      await bigQueryService.deleteTactic(args.tacticId, apiKey);

      let summary = `✅ **Tactic Deleted Successfully**\n\n`;

      // Show deleted tactic details
      summary += `## 🗑️ **Deleted Tactic**\n`;
      summary += `• **Name:** ${tacticDetails.name}\n`;
      summary += `• **Tactic ID:** ${tacticDetails.id}\n`;
      summary += `• **Campaign ID:** ${tacticDetails.campaignId}\n`;
      summary += `• **Previous Status:** ${tacticDetails.status}\n`;
      summary += `• **Budget:** $${tacticDetails.budgetAmount.toLocaleString()} ${tacticDetails.budgetCurrency}\n`;
      summary += `• **Effective CPM:** $${tacticDetails.cpm.toFixed(2)}\n\n`;

      // Impact information
      summary += `### 📊 **Impact**\n`;
      summary += `• **Campaign Delivery:** Tactic no longer participates in delivery\n`;
      summary += `• **Budget Reallocation:** $${tacticDetails.budgetAmount.toLocaleString()} ${tacticDetails.budgetCurrency} freed up for other tactics\n`;
      summary += `• **Data Preservation:** Tactic data preserved for historical reporting\n`;
      summary += `• **Status:** Changed from "${tacticDetails.status}" to "inactive"\n\n`;

      // Calculate projected impact
      const projectedImpressions = Math.floor(
        (tacticDetails.budgetAmount / tacticDetails.cpm) * 1000,
      );
      summary += `### 📈 **Delivery Impact**\n`;
      summary += `• **Lost Projected Impressions:** ~${projectedImpressions.toLocaleString()}\n`;
      summary += `• **Budget Available for Reallocation:** $${tacticDetails.budgetAmount.toLocaleString()}\n\n`;

      // Recommendations
      summary += `### 💡 **Next Steps**\n`;
      summary += `• **Budget Reallocation:** Consider redistributing the freed budget to other tactics\n`;
      summary += `• **Campaign Review:** Use campaign_get to review remaining tactics\n`;
      summary += `• **Performance Analysis:** Review why this tactic was deleted for future optimization\n`;
      
      if (tacticDetails.status === "active") {
        summary += `• **⚠️ Active Tactic Deleted:** Monitor campaign performance for delivery impact\n`;
      }

      summary += `\n**Available Actions:**\n`;
      summary += `• Use tactic_list to see remaining campaign tactics\n`;
      summary += `• Use tactic_create to add new tactics\n`;
      summary += `• Use campaign_update to adjust budget distribution\n`;
      summary += `• Review reporting/export-data for historical performance`;

      return createMCPResponse({
        data: {
          tacticId: args.tacticId,
          deletedTactic: tacticDetails,
          impact: {
            budgetFreed: tacticDetails.budgetAmount,
            currency: tacticDetails.budgetCurrency,
            projectedImpressionsLost: projectedImpressions,
            wasActive: tacticDetails.status === "active",
          },
          timestamp: new Date().toISOString(),
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to delete tactic: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "tactic_delete",
  parameters: z.object({
    tacticId: z.string().describe("ID of the tactic to delete"),
    confirm: z.boolean().describe("Must be set to true to confirm deletion"),
  }),
});