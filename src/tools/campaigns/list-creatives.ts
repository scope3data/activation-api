import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

/**
 * List all creatives assigned to a campaign
 * Campaign-centric view of creative assignments with performance data
 */
export const campaignListCreativesTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Campaigns",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Campaign Creatives",
  },

  description:
    "List all creatives assigned to a specific campaign, showing their performance metrics, assignment details, and key asset information. This provides a campaign-focused view of creative performance and assignments.",

  execute: async (
    args: {
      campaignId: string;
      includeAssets?: boolean;
      includePerformance?: boolean;
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
      const creatives = await client.getCampaignCreatives(
        apiKey,
        args.campaignId,
      );

      if (!creatives.length) {
        return `📊 **Campaign ${args.campaignId}** - No creatives assigned

🎯 **Get Started with Campaign Creatives:**
• Use \`campaign/attach_creative\` to assign existing creatives
• Create new creatives and assign them in one step
• Use natural language prompts to generate campaign-specific creatives

💡 **Why assign creatives to campaigns?**
• Enable targeted advertising with your campaign's audience
• Track creative performance within campaign context  
• Optimize creative mix based on campaign goals

🔄 **[STUB]** This will query AdCP publishers for campaign-creative assignments.`;
      }

      let response = `📊 **Campaign Creatives**

🎯 **Campaign**: ${args.campaignId}
📦 **Total Creatives**: ${creatives.length}

📋 **Assigned Creatives:**

`;

      // List each creative with campaign-specific details
      for (let i = 0; i < creatives.length; i++) {
        const creative = creatives[i];
        response += `${i + 1}. 🎨 **${creative.creativeName}** (v${creative.version})\n`;
        response += `   📋 Creative ID: ${creative.creativeId}\n`;
        response += `   ⚡ Status: ${creative.status}\n`;

        // Show asset info if requested
        if (args.includeAssets !== false && creative.assetIds?.length) {
          response += `   📊 Asset IDs: ${creative.assetIds.join(", ")}\n`;
          if (creative.assetIds.length > 1) {
            response += `   📎 Total Assets: ${creative.assetIds.length}\n`;
          }
        }

        // Show campaign assignment details
        const assignment = creative.campaignAssignments?.find(
          (a) => a.campaignId === args.campaignId,
        );
        if (assignment) {
          response += `   📅 Assigned: ${new Date(assignment.assignedDate).toLocaleDateString()}\n`;
          response += `   🔄 Active: ${assignment.isActive ? "Yes" : "No"}\n`;

          // Performance data would be fetched separately in production
          // For now, performance metrics are not included in the assignment object
        }

        // Advertiser domains are now stored at the brand agent level

        // Show target audience if available
        if (creative.targetAudience) {
          response += `   👥 Audience: ${creative.targetAudience.substring(0, 60)}${creative.targetAudience.length > 60 ? "..." : ""}\n`;
        }

        response += "\n";
      }

      // Add summary statistics
      const activeCreatives = creatives.filter((c) =>
        c.campaignAssignments?.some(
          (a) => a.campaignId === args.campaignId && a.isActive,
        ),
      ).length;

      // Performance metrics would be fetched separately from analytics API
      const totalImpressions = 0; // Placeholder - would fetch from analytics
      const totalClicks = 0; // Placeholder - would fetch from analytics

      response += `📈 **Campaign Creative Summary**\n`;
      response += `• Active Creatives: ${activeCreatives} / ${creatives.length}\n`;

      if (totalImpressions > 0) {
        response += `• Total Impressions: ${totalImpressions.toLocaleString()}\n`;
        response += `• Total Clicks: ${totalClicks.toLocaleString()}\n`;
        response += `• Overall CTR: ${((totalClicks / totalImpressions) * 100).toFixed(2)}%\n`;
      }

      // Asset type counts would require fetching full asset details

      response += `\n💡 **Campaign Creative Management**\n`;
      response += `• Add more creatives: \`campaign/attach_creative\`\n`;
      response += `• Remove creatives: \`creative/unassign\`\n`;
      response += `• View creative details: \`creative/list\`\n`;
      response += `• Create new creatives: \`creative/create\`\n\n`;

      response += `🔄 **[STUB]** This will query AdCP publishers for real campaign-creative performance data.`;

      return response;
    } catch (error) {
      throw new Error(
        `Failed to list campaign creatives: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "campaign_list_creatives",

  parameters: z.object({
    campaignId: z
      .string()
      .describe("Campaign/strategy ID to list creatives for"),
    includeAssets: z
      .boolean()
      .default(true)
      .optional()
      .describe("Include asset details for each creative"),
    includePerformance: z
      .boolean()
      .default(true)
      .optional()
      .describe("Include performance metrics for each creative"),
  }),
});
