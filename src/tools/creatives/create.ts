import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

/**
 * Create a new creative with assets for a buyer agent
 * Following AdCP Creative/Asset hierarchy with human-readable field names
 * Designed as pass-through to AdCP publishers
 */
export const creativeCreateTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "creative-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Creative with Assets",
  },

  description: 
    "Create a new creative with assets for a buyer agent. This follows the AdCP Creative/Asset hierarchy where a creative contains multiple assets (images, videos, text, etc.). All operations will pass through to AdCP publishers when the backend is implemented.",

  execute: async (
    args: {
      buyerAgentId: string;
      creativeName: string;
      creativeDescription?: string;
      prompt?: string;
      assets?: Array<{
        assetName: string;
        assetType: 'image' | 'video' | 'text' | 'audio' | 'html' | 'native_component';
        fileUrl?: string;
        fileContent?: string;
        textContent?: {
          headline?: string;
          bodyText?: string;
          callToAction?: string;
          sponsoredByText?: string;
        };
        widthPixels?: number;
        heightPixels?: number;
        durationSeconds?: number;
      }>;
      advertiserDomains: string[];
      contentCategories?: string[];
      targetAudience?: string;
      assignToCampaignIds?: string[];
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
      // If prompt provided without assets, parse it to generate assets
      let assets = args.assets;
      if (args.prompt && !assets?.length) {
        const parsedPrompt = await client.parseCreativePrompt(apiKey, args.prompt);
        assets = parsedPrompt.suggestedAssets.map(asset => ({
          assetName: asset.assetName,
          assetType: asset.assetType as any,
          fileUrl: asset.fileUrl,
          textContent: asset.textContent,
          widthPixels: asset.widthPixels,
          heightPixels: asset.heightPixels,
          durationSeconds: asset.durationSeconds,
        }));
      }

      if (!assets?.length) {
        return createErrorResponse(
          "No assets provided. Please specify assets or use a prompt to generate them.",
          new Error("Missing assets")
        );
      }

      // Create creative through AdCP pass-through
      const creative = await client.createCreative(apiKey, args.buyerAgentId, {
        creativeName: args.creativeName,
        creativeDescription: args.creativeDescription,
        assets: assets.map(asset => ({
          assetName: asset.assetName,
          assetType: asset.assetType,
          fileUrl: asset.fileUrl,
          fileContent: asset.fileContent,
          textContent: asset.textContent,
          widthPixels: asset.widthPixels,
          heightPixels: asset.heightPixels,
          durationSeconds: asset.durationSeconds,
        })),
        advertiserDomains: args.advertiserDomains,
        contentCategories: args.contentCategories,
        targetAudience: args.targetAudience,
      });

      // Assign to campaigns if requested
      const assignments: string[] = [];
      if (args.assignToCampaignIds?.length) {
        for (const campaignId of args.assignToCampaignIds) {
          const result = await client.assignCreativeToCampaign(
            apiKey,
            creative.creativeId,
            campaignId,
            args.buyerAgentId
          );
          if (result.success) {
            assignments.push(campaignId);
          }
        }
      }

      // Create human-readable response
      const response = `🎨 Creative created successfully!

📦 **Creative Details**
• Creative ID: ${creative.creativeId}
• Name: ${creative.creativeName}
• Version: ${creative.version}
• Buyer Agent: ${args.buyerAgentId}
• Status: ${creative.status}

🎯 **Assets (${creative.assets.length})**
${creative.assets.map(asset => 
  `• ${asset.assetName} (${asset.assetType}${asset.widthPixels && asset.heightPixels ? `, ${asset.widthPixels}×${asset.heightPixels}` : ''})`
).join('\n')}

🌐 **Marketing Details**
• Advertiser Domains: ${creative.advertiserDomains.join(', ')}
${creative.contentCategories?.length ? `• Content Categories: ${creative.contentCategories.join(', ')}\n` : ''}${creative.targetAudience ? `• Target Audience: ${creative.targetAudience}\n` : ''}
⏰ **Timeline**
• Created: ${new Date(creative.createdDate).toLocaleDateString()}
• Created By: ${creative.createdBy}

${assignments.length ? `✅ **Campaign Assignments**\n• Assigned to ${assignments.length} campaigns: ${assignments.join(', ')}\n` : ''}
🔄 **[STUB]** This creative will be created via AdCP publishers when backend is implemented.
All assets will be properly uploaded and validated through the appropriate AdCP channels.`;

      return createMCPResponse({ message: response, success: true });

    } catch (error) {
      return createErrorResponse("Failed to create creative", error);
    }
  },

  name: "creative/create",

  parameters: z.object({
    buyerAgentId: z.string().describe("The buyer agent that will own this creative"),
    creativeName: z.string().describe("Human-readable name for the creative"),
    creativeDescription: z.string().optional().describe("Description of the creative's purpose and usage"),
    
    // Natural language option
    prompt: z.string().optional().describe("Natural language description to auto-generate creative and assets"),
    
    // Assets that compose the creative (AdCP structure)
    assets: z.array(z.object({
      assetName: z.string().describe("Name for this asset"),
      assetType: z.enum(['image', 'video', 'text', 'audio', 'html', 'native_component']).describe("Type of asset"),
      fileUrl: z.string().optional().describe("URL to the asset file"),
      fileContent: z.string().optional().describe("Base64 encoded file content"),
      
      // For text/native assets
      textContent: z.object({
        headline: z.string().optional().describe("Main headline text"),
        bodyText: z.string().optional().describe("Body/description text"),
        callToAction: z.string().optional().describe("Call-to-action button text"),
        sponsoredByText: z.string().optional().describe("Sponsored by disclaimer"),
      }).optional(),
      
      // Asset specifications
      widthPixels: z.number().optional().describe("Width in pixels for visual assets"),
      heightPixels: z.number().optional().describe("Height in pixels for visual assets"),
      durationSeconds: z.number().optional().describe("Duration in seconds for video/audio"),
    })).optional(),
    
    // Creative metadata (human-readable names)
    advertiserDomains: z.array(z.string()).describe("Domains where users will be sent when clicking"),
    contentCategories: z.array(z.string()).optional().describe("IAB content categories for this creative"),
    targetAudience: z.string().optional().describe("Natural language description of target audience"),
    
    // Optional immediate assignment
    assignToCampaignIds: z.array(z.string()).optional().describe("Campaign IDs to immediately assign this creative to"),
  }),
});