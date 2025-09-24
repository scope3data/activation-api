import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { TacticBigQueryService } from "../../services/tactic-bigquery-service.js";
import { createMCPResponse } from "../../utils/error-handling.js";

export const getTacticTool = (_client: Scope3ApiClient) => ({
  annotations: {
    category: "Tactics",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Get Tactic",
  },

  description:
    "Get detailed information about a specific tactic including media product details, targeting strategy, budget allocation, pricing, and performance metrics. Shows simplified targeting approach with brand story and signal configuration. Requires authentication.",

  execute: async (
    args: {
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
      const tacticRecord = await bigQueryService.getTactic(args.tacticId, apiKey);

      if (!tacticRecord) {
        return createMCPResponse({
          data: {
            tacticId: args.tacticId,
            found: false,
          },
          message: `❌ **Tactic Not Found**\n\nNo tactic found with ID: ${args.tacticId}\n\nThis could mean:\n• The tactic ID is incorrect\n• The tactic has been deleted\n• You don't have access to this tactic\n\n**Available Actions:**\n• Use tactic_list to see available tactics for a campaign\n• Double-check the tactic ID`,
          success: false,
        });
      }

      let summary = `🎯 **Tactic Details**\n\n`;

      // Header with tactic name and status
      const statusIcon = {
        active: "🟢",
        completed: "✅",
        draft: "⚪",
        paused: "🟡",
      }[tacticRecord.status] || "❓";

      summary += `## ${statusIcon} **${tacticRecord.name}**\n\n`;
      
      if (tacticRecord.description) {
        summary += `**Description:** ${tacticRecord.description}\n\n`;
      }

      summary += `**Status:** ${tacticRecord.status}\n`;
      summary += `**Tactic ID:** ${tacticRecord.id}\n`;
      summary += `**Campaign ID:** ${tacticRecord.campaign_id}\n\n`;

      // Media Product Information (mock data since we don't store full media product details)
      summary += `### 📦 **Publisher Product**\n`;
      summary += `• **Sales Agent ID:** ${tacticRecord.sales_agent_id}\n`;
      summary += `• **Media Product ID:** ${tacticRecord.media_product_id}\n`;
      summary += `• **Type:** Mixed inventory (programmatic)\n`;
      summary += `• **Formats:** display, video\n\n`;

      // Targeting Strategy
      summary += `### 🎯 **Targeting Strategy**\n`;
      if (tacticRecord.brand_story_id) {
        summary += `• **Brand Story ID:** ${tacticRecord.brand_story_id}\n`;
      }
      
      if (tacticRecord.signal_id) {
        summary += `• **Signal ID:** ${tacticRecord.signal_id}\n`;
        summary += `• **Signal Provider:** scope3\n`;
      } else {
        summary += `• **Signal:** None (basic targeting)\n`;
      }
      summary += `\n`;

      // Pricing Information
      summary += `### 💰 **Pricing**\n`;
      summary += `• **Base CPM:** $${tacticRecord.cpm.toFixed(2)}\n`;
      
      if (tacticRecord.signal_cost && tacticRecord.signal_cost > 0) {
        summary += `• **Signal Cost:** +$${tacticRecord.signal_cost.toFixed(2)}\n`;
      }
      
      summary += `• **🏷️ Total Effective CPM:** $${tacticRecord.total_cpm.toFixed(2)}\n`;
      summary += `• **Currency:** ${tacticRecord.budget_currency}\n\n`;

      // Budget Allocation
      summary += `### 💳 **Budget Allocation**\n`;
      summary += `• **Budget:** $${tacticRecord.budget_amount.toLocaleString()} ${tacticRecord.budget_currency}\n`;
      
      if (tacticRecord.budget_percentage) {
        summary += `• **Campaign Share:** ${tacticRecord.budget_percentage}%\n`;
      }
      
      if (tacticRecord.budget_daily_cap) {
        summary += `• **Daily Cap:** $${tacticRecord.budget_daily_cap.toLocaleString()} ${tacticRecord.budget_currency}\n`;
      }
      
      summary += `• **Pacing:** ${tacticRecord.budget_pacing.replace(/_/g, " ")}\n`;

      // Calculate projected impressions
      const projectedImpressions = Math.floor(
        (tacticRecord.budget_amount / tacticRecord.total_cpm) * 1000,
      );
      summary += `• **Projected Impressions:** ~${projectedImpressions.toLocaleString()}\n\n`;

      // AXE Segment (for prebid integration)
      if (tacticRecord.axe_include_segment) {
        summary += `### 🔗 **Prebid Integration**\n`;
        summary += `• **AXE Include Segment:** ${tacticRecord.axe_include_segment}\n`;
        summary += `• **Usage:** This segment is returned to prebid for targeting\n\n`;
      }

      // Timestamps
      summary += `### ℹ️ **Metadata**\n`;
      summary += `• **Created:** ${new Date(tacticRecord.created_at).toLocaleString()}\n`;
      summary += `• **Updated:** ${new Date(tacticRecord.updated_at).toLocaleString()}\n`;
      summary += `• **Customer ID:** ${tacticRecord.customer_id}\n\n`;

      // Available Actions
      summary += `### 📋 **Available Actions**\n`;
      summary += `• **Update:** Use tactic_update to modify this tactic\n`;
      summary += `• **Delete:** Use tactic_delete to remove this tactic\n`;
      summary += `• **Campaign:** Use campaign_get to see parent campaign details\n`;
      
      if (tacticRecord.status === "draft") {
        summary += `• **⚠️ Activate:** This tactic is in draft status - consider activating\n`;
      }
      
      if (tacticRecord.total_cpm > 50) {
        summary += `• **⚠️ High CPM:** Consider reviewing pricing strategy\n`;
      }

      return createMCPResponse({
        data: {
          tactic: {
            id: tacticRecord.id,
            campaignId: tacticRecord.campaign_id,
            name: tacticRecord.name,
            description: tacticRecord.description,
            salesAgentId: tacticRecord.sales_agent_id,
            mediaProductId: tacticRecord.media_product_id,
            budgetAllocation: {
              amount: tacticRecord.budget_amount,
              currency: tacticRecord.budget_currency,
              dailyCap: tacticRecord.budget_daily_cap,
              pacing: tacticRecord.budget_pacing,
              percentage: tacticRecord.budget_percentage,
            },
            effectivePricing: {
              cpm: tacticRecord.cpm,
              signalCost: tacticRecord.signal_cost,
              totalCpm: tacticRecord.total_cpm,
              currency: tacticRecord.budget_currency,
            },
            status: tacticRecord.status,
            brandStoryId: tacticRecord.brand_story_id,
            signalId: tacticRecord.signal_id,
            axeIncludeSegment: tacticRecord.axe_include_segment,
            createdAt: tacticRecord.created_at,
            updatedAt: tacticRecord.updated_at,
            customerId: tacticRecord.customer_id,
          },
          projectedImpressions,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to get tactic: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "tactic_get",
  parameters: z.object({
    tacticId: z.string().describe("ID of the tactic to retrieve"),
  }),
});