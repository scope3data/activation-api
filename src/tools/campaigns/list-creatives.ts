import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

/**
 * List all creatives assigned to a campaign
 * Campaign-centric view of creative assignments with performance data
 */
export const campaignListCreativesTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "campaign-management",
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
      includePerformance?: boolean;
      includeAssets?: boolean;
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check authentication
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      return createAuthErrorResponse();
    }

    try {
      const creatives = await client.getCampaignCreatives(apiKey, args.campaignId);

      if (!creatives.length) {
        return createMCPResponse({
          message: `📊 **Campaign ${args.campaignId}** - No creatives assigned

🎯 **Get Started with Campaign Creatives:**
• Use \`campaign/attach_creative\` to assign existing creatives
• Create new creatives and assign them in one step
• Use natural language prompts to generate campaign-specific creatives

💡 **Why assign creatives to campaigns?**
• Enable targeted advertising with your campaign's audience
• Track creative performance within campaign context  
• Optimize creative mix based on campaign goals

🔄 **[STUB]** This will query AdCP publishers for campaign-creative assignments.`,
          success: true
        });
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

        // Show primary asset info if requested
        if (args.includeAssets !== false && creative.assets?.length) {
          const primaryAsset = creative.assets.find(a => a.assetRole === 'primary') || creative.assets[0];
          response += `   🎯 Primary Asset: ${primaryAsset.assetName} (${primaryAsset.assetType}`;
          
          if (primaryAsset.widthPixels && primaryAsset.heightPixels) {
            response += `, ${primaryAsset.widthPixels}×${primaryAsset.heightPixels}`;
          }
          if (primaryAsset.durationSeconds) {
            response += `, ${primaryAsset.durationSeconds}s`;
          }
          response += `)\n`;

          if (creative.assets.length > 1) {
            response += `   📎 Additional Assets: ${creative.assets.length - 1} more assets\n`;
          }
        }

        // Show campaign assignment details
        const assignment = creative.campaignAssignments?.find(a => a.campaignId === args.campaignId);
        if (assignment) {
          response += `   📅 Assigned: ${new Date(assignment.assignedDate).toLocaleDateString()}\n`;
          response += `   🔄 Active: ${assignment.isActive ? 'Yes' : 'No'}\n`;

          // Show performance if requested and available
          if (args.includePerformance !== false && assignment.performance) {
            response += `   📈 Performance:\n`;
            response += `      • Impressions: ${assignment.performance.impressions.toLocaleString()}\n`;
            response += `      • Clicks: ${assignment.performance.clicks.toLocaleString()}\n`;
            response += `      • CTR: ${(assignment.performance.clickThroughRate * 100).toFixed(2)}%\n`;
          }
        }

        // Show advertiser domains
        if (creative.advertiserDomains?.length) {
          response += `   🌐 Domains: ${creative.advertiserDomains.slice(0, 2).join(', ')}${creative.advertiserDomains.length > 2 ? '...' : ''}\n`;
        }

        // Show target audience if available
        if (creative.targetAudience) {
          response += `   👥 Audience: ${creative.targetAudience.substring(0, 60)}${creative.targetAudience.length > 60 ? '...' : ''}\n`;
        }

        response += '\n';
      }

      // Add summary statistics
      const activeCreatives = creatives.filter(c => 
        c.campaignAssignments?.some(a => a.campaignId === args.campaignId && a.isActive)
      ).length;

      const totalImpressions = creatives.reduce((sum, c) => {
        const assignment = c.campaignAssignments?.find(a => a.campaignId === args.campaignId);
        return sum + (assignment?.performance?.impressions || 0);
      }, 0);

      const totalClicks = creatives.reduce((sum, c) => {
        const assignment = c.campaignAssignments?.find(a => a.campaignId === args.campaignId);
        return sum + (assignment?.performance?.clicks || 0);
      }, 0);

      response += `📈 **Campaign Creative Summary**\n`;
      response += `• Active Creatives: ${activeCreatives} / ${creatives.length}\n`;
      
      if (totalImpressions > 0) {
        response += `• Total Impressions: ${totalImpressions.toLocaleString()}\n`;
        response += `• Total Clicks: ${totalClicks.toLocaleString()}\n`;
        response += `• Overall CTR: ${((totalClicks / totalImpressions) * 100).toFixed(2)}%\n`;
      }

      // Count asset types
      const assetTypeCounts = creatives.reduce((counts, creative) => {
        creative.assets?.forEach(asset => {
          counts[asset.assetType] = (counts[asset.assetType] || 0) + 1;
        });
        return counts;
      }, {} as Record<string, number>);

      if (Object.keys(assetTypeCounts).length > 0) {
        response += `• Asset Types: ${Object.entries(assetTypeCounts).map(([type, count]) => `${type} (${count})`).join(', ')}\n`;
      }

      response += `\n💡 **Campaign Creative Management**\n`;
      response += `• Add more creatives: \`campaign/attach_creative\`\n`;
      response += `• Remove creatives: \`creative/unassign\`\n`;
      response += `• View creative details: \`creative/list\`\n`;
      response += `• Create new creatives: \`creative/create\`\n\n`;

      response += `🔄 **[STUB]** This will query AdCP publishers for real campaign-creative performance data.`;

      return createMCPResponse({ message: response, success: true });

    } catch (error) {
      return createErrorResponse("Failed to list campaign creatives", error);
    }
  },

  name: "campaign/list_creatives",

  parameters: z.object({
    campaignId: z.string().describe("Campaign/strategy ID to list creatives for"),
    includePerformance: z.boolean().default(true).optional().describe("Include performance metrics for each creative"),
    includeAssets: z.boolean().default(true).optional().describe("Include asset details for each creative"),
  }),
});