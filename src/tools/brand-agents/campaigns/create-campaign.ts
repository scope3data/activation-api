import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  CreateBrandAgentCampaignParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const createBrandAgentCampaignTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "campaign-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Brand Agent Campaign",
  },

  description:
    "Create a new campaign within a brand agent (advertiser account). The campaign will be owned by the specified brand agent and can optionally include creatives and audiences that belong to the same brand agent. Follows the create/update pattern for creative assignment. Requires authentication.",

  execute: async (
    args: CreateBrandAgentCampaignParams,
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
      // First, verify the brand agent exists
      let brandAgentName: string;
      try {
        const brandAgent = await client.getBrandAgent(
          apiKey,
          args.brandAgentId,
        );
        brandAgentName = brandAgent.name;
      } catch (fetchError) {
        return createErrorResponse(
          "Brand agent not found. Please check the brand agent ID.",
          fetchError,
        );
      }

      const campaignInput = {
        audienceIds: args.audienceIds || [],
        brandAgentId: args.brandAgentId,
        budget: args.budget,
        creativeIds: args.creativeIds || [],
        inventoryManagement: args.inventoryManagement,
        name: args.name,
        prompt: args.prompt,
      };

      const campaign = await client.createBrandAgentCampaign(
        apiKey,
        campaignInput,
      );

      let summary = `✅ Campaign Created Successfully!\n\n`;
      summary += `**Campaign Details:**\n`;
      summary += `• **Name:** ${campaign.name}\n`;
      summary += `• **ID:** ${campaign.id}\n`;
      summary += `• **Brand Agent:** ${brandAgentName} (${campaign.brandAgentId})\n`;
      summary += `• **Prompt:** ${campaign.prompt}\n`;

      if (campaign.budget) {
        summary += `• **Budget:** ${campaign.budget.total} ${campaign.budget.currency}`;
        if (campaign.budget.dailyCap) {
          summary += ` (Daily cap: ${campaign.budget.dailyCap} ${campaign.budget.currency})`;
        }
        summary += `\n`;
        if (campaign.budget.pacing) {
          summary += `• **Pacing:** ${campaign.budget.pacing}\n`;
        }
      }

      // Show inventory management configuration
      if (campaign.inventoryManagement) {
        summary += `\n**🎯 Inventory Management:**\n`;
        summary += `• **Mode:** ${campaign.inventoryManagement.mode.replace(/_/g, " ")}\n`;

        if (campaign.inventoryManagement.autoOptimize) {
          summary += `• **Auto-optimize:** Enabled`;
          if (campaign.inventoryManagement.optimizationGoal) {
            summary += ` (goal: ${campaign.inventoryManagement.optimizationGoal.replace(/_/g, " ")})`;
          }
          summary += `\n`;
        }

        if (campaign.inventoryManagement.budgetSplit) {
          summary += `• **Budget Split:** ${campaign.inventoryManagement.budgetSplit.guaranteed}% guaranteed, ${campaign.inventoryManagement.budgetSplit.nonGuaranteed}% non-guaranteed\n`;
        }

        if (
          campaign.inventoryManagement.preferredSignals &&
          campaign.inventoryManagement.preferredSignals.length > 0
        ) {
          summary += `• **Preferred Signals:** ${campaign.inventoryManagement.preferredSignals.join(", ")}\n`;
        }

        if (campaign.inventoryManagement.autoDiscoverProducts) {
          summary += `• **Auto-discover Products:** Enabled\n`;
        }
      } else {
        summary += `\n**🎯 Inventory Management:** Scope3-managed (default)\n`;
      }

      summary += `• **Status:** ${campaign.status}\n`;
      summary += `• **Created:** ${new Date(campaign.createdAt).toLocaleString()}\n`;

      // Show creative assignments
      if (campaign.creativeIds && campaign.creativeIds.length > 0) {
        summary += `\n**Assigned Creatives:**\n`;
        campaign.creativeIds.forEach((creativeId, index) => {
          summary += `   ${index + 1}. Creative ID: ${creativeId}\n`;
        });
      } else {
        summary += `\n⚠️ **No creatives assigned.** Use update_campaign to assign creatives later.\n`;
      }

      // Show audience assignments
      if (campaign.audienceIds && campaign.audienceIds.length > 0) {
        summary += `\n**Assigned Audiences:**\n`;
        campaign.audienceIds.forEach((audienceId, index) => {
          summary += `   ${index + 1}. Audience ID: ${audienceId}\n`;
        });
      } else {
        summary += `\n💡 **No audiences assigned.** Consider creating synthetic audiences for better targeting.\n`;
      }

      summary += `\n**Next Steps:**\n`;
      summary += `• Assign creatives to the campaign if not done already\n`;
      summary += `• Create or assign synthetic audiences for targeting\n`;

      // Add inventory management specific next steps
      if (campaign.inventoryManagement?.mode === "user_managed") {
        summary += `• 🎯 **Discover publisher products** using discover_publisher_products\n`;
        summary += `• 🎯 **Create inventory options** using create_inventory_option\n`;
        summary += `• 🎯 **Configure budget allocation** across different inventory tactics\n`;
      } else if (campaign.inventoryManagement?.mode === "hybrid") {
        summary += `• 🎯 **Review Scope3's suggested inventory options** and customize as needed\n`;
        summary += `• 🎯 **Add custom inventory options** using discover_publisher_products + create_inventory_option\n`;
      } else {
        summary += `• 🎯 **Inventory will be managed automatically** by Scope3's INTELLIGENT_PMPS strategy\n`;
      }

      summary += `• Review and adjust campaign settings as needed\n`;
      summary += `• Activate the campaign when ready\n\n`;

      // Add mode-specific success message
      if (campaign.inventoryManagement?.mode === "user_managed") {
        summary += `🎛️ **Campaign created with manual inventory control!** You can now discover and configure specific publisher products and targeting strategies.`;
      } else if (campaign.inventoryManagement?.mode === "hybrid") {
        summary += `⚖️ **Campaign created with hybrid inventory management!** Scope3 will provide recommendations while allowing your customizations.`;
      } else {
        summary += `🤖 **Campaign created with automatic inventory management!** Scope3 will handle inventory selection and optimization for you.`;
      }

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to create campaign", error);
    }
  },

  name: "create_campaign",
  parameters: z.object({
    audienceIds: z
      .array(z.string())
      .optional()
      .describe(
        "Optional array of synthetic audience IDs to assign (must belong to same brand agent)",
      ),
    brandAgentId: z
      .string()
      .describe("ID of the brand agent that will own this campaign"),
    budget: z
      .object({
        currency: z
          .string()
          .default("USD")
          .describe("Budget currency (default: USD)"),
        dailyCap: z
          .number()
          .optional()
          .describe("Optional daily spending limit"),
        pacing: z
          .string()
          .optional()
          .describe("Budget pacing strategy (e.g., 'even', 'asap')"),
        total: z.number().describe("Total campaign budget"),
      })
      .optional()
      .describe("Campaign budget configuration"),
    creativeIds: z
      .array(z.string())
      .optional()
      .describe(
        "Optional array of creative IDs to assign (must belong to same brand agent)",
      ),

    // Inventory management configuration
    inventoryManagement: z
      .object({
        autoDiscoverProducts: z
          .boolean()
          .default(false)
          .describe(
            "Whether to automatically discover and suggest publisher products",
          ),
        autoOptimize: z
          .boolean()
          .default(true)
          .describe(
            "Whether to automatically optimize inventory allocation based on performance",
          ),
        budgetSplit: z
          .object({
            guaranteed: z
              .number()
              .min(0)
              .max(100)
              .describe("Percentage of budget for guaranteed inventory"),
            nonGuaranteed: z
              .number()
              .min(0)
              .max(100)
              .describe("Percentage of budget for non-guaranteed inventory"),
          })
          .optional()
          .describe(
            "Preferred split between guaranteed and non-guaranteed inventory",
          ),
        mode: z
          .enum(["scope3_managed", "user_managed", "hybrid"])
          .default("scope3_managed")
          .describe(
            "Inventory management mode: scope3_managed (automatic), user_managed (manual control), or hybrid (assisted)",
          ),
        optimizationGoal: z
          .enum(["impressions", "clicks", "conversions", "cost_efficiency"])
          .default("cost_efficiency")
          .describe("Goal for automatic optimization"),
        preferredSignals: z
          .array(z.enum(["buyer", "scope3", "third_party"]))
          .optional()
          .describe("Preferred signal types for targeting"),
      })
      .optional()
      .describe(
        "Inventory management configuration - defaults to scope3_managed",
      ),

    name: z.string().describe("Name of the campaign"),
    prompt: z
      .string()
      .describe(
        "Natural language description of campaign objectives and strategy",
      ),
  }),
});
