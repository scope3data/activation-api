import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createMCPResponse } from "../../utils/error-handling.js";

/**
 * List creatives for a buyer agent with their assets and campaign assignments
 * Optimized to include all related data to reduce API calls
 */
export const creativeListTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Creatives",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Creatives",
  },

  description:
    "List all creatives for a specific buyer agent, showing their assets and campaign assignments. Includes filtering options and summary statistics. Results include campaign assignments to reduce additional API calls.",

  execute: async (
    args: {
      buyerAgentId: string;
      filter?: {
        campaignId?: string;
        hasAssetType?: "audio" | "html" | "image" | "text" | "video";
        searchTerm?: string;
        status?: "active" | "archived" | "draft" | "paused" | "pending_review";
        unassigned?: boolean;
      };
      includeAssets?: boolean;
      includeCampaigns?: boolean;
      limit?: number;
      offset?: number;
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check authentication
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
      const response = await client.listCreatives(
        apiKey,
        args.buyerAgentId,
        args.filter,
        {
          limit: args.limit || 20,
          offset: args.offset || 0,
        },
        args.includeCampaigns ?? true,
      );

      if (response.creatives.length === 0) {
        return createMCPResponse({
          message: `📦 No creatives found for buyer agent ${args.buyerAgentId}

${
  args.filter
    ? "🔍 **Applied Filters:**\n" +
      Object.entries(args.filter)
        .map(([k, v]) => `• ${k}: ${v}`)
        .join("\n") +
      "\n"
    : ""
}
💡 **Get Started:**
• Use \`creative/create\` to create your first creative
• Upload assets and assign them to campaigns
• Organize creatives with collections and tags

🔄 **[STUB]** This will query AdCP publishers when backend is implemented.`,
          success: true,
        });
      }

      let output = `📦 **Creatives for Buyer Agent ${args.buyerAgentId}**\n\n`;
      output += `Found ${response.totalCount} creatives${response.hasMore ? ` (showing ${response.creatives.length})` : ""}:\n\n`;

      // List each creative with details
      for (const creative of response.creatives) {
        output += `🎨 **${creative.creativeName}** (v${creative.version})\n`;
        output += `   📋 ID: ${creative.creativeId}\n`;
        output += `   ⚡ Status: ${creative.status}\n`;

        // Show asset IDs if requested
        if ((args.includeAssets ?? true) && creative.assetIds?.length) {
          output += `   🎯 Asset IDs (${creative.assetIds.length}):\n`;
          for (const assetId of creative.assetIds.slice(0, 3)) {
            // Show first 3 asset IDs
            output += `     • ${assetId}\n`;
          }
          if (creative.assetIds.length > 3) {
            output += `     • ... and ${creative.assetIds.length - 3} more assets\n`;
          }
        }

        // Show campaign assignments if requested and available
        if (
          (args.includeCampaigns ?? true) &&
          creative.campaignAssignments?.length
        ) {
          output += `   📊 Campaigns (${creative.campaignAssignments.length}):\n`;
          for (const assignment of creative.campaignAssignments.slice(0, 2)) {
            // Show first 2 campaigns
            output += `     • ${assignment.campaignName} (${assignment.isActive ? "Active" : "Inactive"})\n`;
          }
          if (creative.campaignAssignments.length > 2) {
            output += `     • ... and ${creative.campaignAssignments.length - 2} more campaigns\n`;
          }
        } else if (
          (args.includeCampaigns ?? true) &&
          (!creative.campaignAssignments ||
            creative.campaignAssignments.length === 0)
        ) {
          output += `   📊 Campaigns: Not assigned to any campaigns\n`;
        }

        // Show key metadata
        if (creative.targetAudience) {
          output += `   👥 Audience: ${creative.targetAudience.substring(0, 50)}${creative.targetAudience.length > 50 ? "..." : ""}\n`;
        }

        output += `   📅 Modified: ${new Date(creative.lastModifiedDate).toLocaleDateString()}\n\n`;
      }

      // Show summary statistics if available
      if (response.summary) {
        output += `📈 **Summary Statistics**\n`;
        output += `• Total Creatives: ${response.summary.totalCreatives}\n`;
        output += `• Active Creatives: ${response.summary.activeCreatives}\n`;
        output += `• Draft Creatives: ${response.summary.draftCreatives}\n`;
        output += `• Assigned to Campaigns: ${response.summary.assignedCreatives}\n`;
        output += `• Unassigned: ${response.summary.unassignedCreatives}\n\n`;
      }

      // Pagination info
      if (response.hasMore) {
        output += `📄 **Pagination**: Use offset=${response.nextOffset || (args.offset || 0) + (args.limit || 20)} to see more results.\n\n`;
      }

      output += `🔄 **[STUB]** This will query AdCP publishers when backend is implemented.`;

      return createMCPResponse({ message: output, success: true });
    } catch (error) {
      throw new Error(
        `Failed to list creatives: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "creative/list",

  parameters: z.object({
    buyerAgentId: z.string().describe("The buyer agent to list creatives for"),

    filter: z
      .object({
        campaignId: z
          .string()
          .optional()
          .describe("Filter by campaign assignment"),
        hasAssetType: z
          .enum(["image", "video", "text", "audio", "html"])
          .optional()
          .describe("Filter creatives that have this asset type"),
        searchTerm: z
          .string()
          .optional()
          .describe("Search in creative names and descriptions"),
        status: z
          .enum(["draft", "pending_review", "active", "paused", "archived"])
          .optional()
          .describe("Filter by creative status"),
        unassigned: z
          .boolean()
          .optional()
          .describe("Only show creatives not assigned to any campaigns"),
      })
      .optional()
      .describe("Optional filters to apply"),

    includeAssets: z
      .boolean()
      .default(true)
      .optional()
      .describe("Include asset details in the response"),
    includeCampaigns: z
      .boolean()
      .default(true)
      .optional()
      .describe("Include campaign assignments in the response"),

    limit: z
      .number()
      .default(20)
      .optional()
      .describe("Maximum number of creatives to return"),
    offset: z
      .number()
      .default(0)
      .optional()
      .describe("Number of creatives to skip (for pagination)"),
  }),
});
