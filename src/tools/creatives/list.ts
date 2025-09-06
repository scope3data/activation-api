import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

/**
 * List creatives for a buyer agent with their assets and campaign assignments
 * Optimized to include all related data to reduce API calls
 */
export const creativeListTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "creative-management", 
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Creatives for Buyer Agent",
  },

  description:
    "List all creatives for a specific buyer agent, showing their assets and campaign assignments. Includes filtering options and summary statistics. Results include campaign assignments to reduce additional API calls.",

  execute: async (
    args: {
      buyerAgentId: string;
      filter?: {
        status?: 'draft' | 'pending_review' | 'active' | 'paused' | 'archived';
        hasAssetType?: 'image' | 'video' | 'text' | 'audio' | 'html';
        campaignId?: string;
        searchTerm?: string;
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
      return createAuthErrorResponse();
    }

    try {
      const response = await client.listCreatives(
        apiKey,
        args.buyerAgentId,
        args.filter,
        { 
          limit: args.limit || 20, 
          offset: args.offset || 0 
        },
        args.includeCampaigns ?? true
      );

      if (response.items.length === 0) {
        return createMCPResponse({
          message: `📦 No creatives found for buyer agent ${args.buyerAgentId}

${args.filter ? '🔍 **Applied Filters:**\n' + Object.entries(args.filter).map(([k, v]) => `• ${k}: ${v}`).join('\n') + '\n' : ''}
💡 **Get Started:**
• Use \`creative/create\` to create your first creative
• Upload assets and assign them to campaigns
• Organize creatives with collections and tags

🔄 **[STUB]** This will query AdCP publishers when backend is implemented.`,
          success: true
        });
      }

      let output = `📦 **Creatives for Buyer Agent ${args.buyerAgentId}**\n\n`;
      output += `Found ${response.totalCount} creatives${response.pageInfo.hasNextPage ? ` (showing ${response.items.length})` : ''}:\n\n`;

      // List each creative with details
      for (const creative of response.items) {
        output += `🎨 **${creative.creativeName}** (v${creative.version})\n`;
        output += `   📋 ID: ${creative.creativeId}\n`;
        output += `   ⚡ Status: ${creative.status}\n`;
        
        // Show assets if requested
        if ((args.includeAssets ?? true) && creative.assets?.length) {
          output += `   🎯 Assets (${creative.assets.length}):\n`;
          for (const asset of creative.assets.slice(0, 3)) { // Show first 3 assets
            output += `     • ${asset.assetName} (${asset.assetType}`;
            if (asset.widthPixels && asset.heightPixels) {
              output += `, ${asset.widthPixels}×${asset.heightPixels}`;
            }
            if (asset.durationSeconds) {
              output += `, ${asset.durationSeconds}s`;
            }
            output += `)\n`;
          }
          if (creative.assets.length > 3) {
            output += `     • ... and ${creative.assets.length - 3} more assets\n`;
          }
        }
        
        // Show campaign assignments if requested and available
        if ((args.includeCampaigns ?? true) && creative.campaignAssignments?.length) {
          output += `   📊 Campaigns (${creative.campaignAssignments.length}):\n`;
          for (const assignment of creative.campaignAssignments.slice(0, 2)) { // Show first 2 campaigns
            output += `     • ${assignment.campaignName} (${assignment.isActive ? 'Active' : 'Inactive'})`;
            if (assignment.performance) {
              output += ` - ${assignment.performance.impressions.toLocaleString()} impressions`;
            }
            output += `\n`;
          }
          if (creative.campaignAssignments.length > 2) {
            output += `     • ... and ${creative.campaignAssignments.length - 2} more campaigns\n`;
          }
        } else if ((args.includeCampaigns ?? true) && (!creative.campaignAssignments || creative.campaignAssignments.length === 0)) {
          output += `   📊 Campaigns: Not assigned to any campaigns\n`;
        }

        // Show key metadata
        if (creative.advertiserDomains?.length) {
          output += `   🌐 Domains: ${creative.advertiserDomains.slice(0, 2).join(', ')}${creative.advertiserDomains.length > 2 ? '...' : ''}\n`;
        }
        
        if (creative.targetAudience) {
          output += `   👥 Audience: ${creative.targetAudience.substring(0, 50)}${creative.targetAudience.length > 50 ? '...' : ''}\n`;
        }
        
        output += `   📅 Modified: ${new Date(creative.lastModifiedDate).toLocaleDateString()}\n\n`;
      }

      // Show summary statistics if available
      if (response.summary) {
        output += `📈 **Summary Statistics**\n`;
        output += `• Total Creatives: ${response.summary.totalCreatives}\n`;
        
        if (Object.keys(response.summary.byStatus).length > 0) {
          output += `• By Status: ${Object.entries(response.summary.byStatus).map(([status, count]) => `${status} (${count})`).join(', ')}\n`;
        }
        
        if (Object.keys(response.summary.byAssetType).length > 0) {
          output += `• By Asset Type: ${Object.entries(response.summary.byAssetType).map(([type, count]) => `${type} (${count})`).join(', ')}\n`;
        }
        
        output += `• Total Campaigns Using Creatives: ${response.summary.totalCampaigns}\n`;
        output += `• Average Assets per Creative: ${response.summary.averageAssetsPerCreative.toFixed(1)}\n\n`;
      }

      // Pagination info
      if (response.pageInfo.hasNextPage) {
        output += `📄 **Pagination**: Use offset=${(args.offset || 0) + (args.limit || 20)} to see more results.\n\n`;
      }

      output += `🔄 **[STUB]** This will query AdCP publishers when backend is implemented.`;

      return createMCPResponse({ message: output, success: true });

    } catch (error) {
      return createErrorResponse("Failed to list creatives", error);
    }
  },

  name: "creative/list",

  parameters: z.object({
    buyerAgentId: z.string().describe("The buyer agent to list creatives for"),
    
    filter: z.object({
      status: z.enum(['draft', 'pending_review', 'active', 'paused', 'archived']).optional().describe("Filter by creative status"),
      hasAssetType: z.enum(['image', 'video', 'text', 'audio', 'html']).optional().describe("Filter creatives that have this asset type"),
      campaignId: z.string().optional().describe("Filter by campaign assignment"),
      searchTerm: z.string().optional().describe("Search in creative names and descriptions"),
      unassigned: z.boolean().optional().describe("Only show creatives not assigned to any campaigns"),
    }).optional().describe("Optional filters to apply"),
    
    includeAssets: z.boolean().default(true).optional().describe("Include asset details in the response"),
    includeCampaigns: z.boolean().default(true).optional().describe("Include campaign assignments in the response"),
    
    limit: z.number().default(20).optional().describe("Maximum number of creatives to return"),
    offset: z.number().default(0).optional().describe("Number of creatives to skip (for pagination)"),
  }),
});