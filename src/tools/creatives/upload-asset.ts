import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

/**
 * Upload an individual asset that can be used in creatives
 * Will delegate to appropriate AdCP publisher based on asset type
 */
export const creativeUploadAssetTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "creative-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Upload Creative Asset",
  },

  description:
    "Upload an individual asset (image, video, text, audio, etc.) that can be used in creatives. The asset will be stored in the buyer agent's asset library and can be reused across multiple creatives. Will delegate to appropriate AdCP publisher based on asset type.",

  execute: async (
    args: {
      buyerAgentId: string;
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
      tags?: string[];
      metadata?: Record<string, unknown>;
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
      // Validate input based on asset type
      if (args.assetType === 'text' || args.assetType === 'native_component') {
        if (!args.textContent) {
          return createErrorResponse(
            "Text content is required for text and native component assets",
            new Error("Missing text content")
          );
        }
      } else {
        if (!args.fileUrl && !args.fileContent) {
          return createErrorResponse(
            "Either fileUrl or fileContent is required for non-text assets",
            new Error("Missing file reference")
          );
        }
      }

      // Upload asset through AdCP pass-through
      const asset = await client.uploadAsset(apiKey, args.buyerAgentId, {
        assetName: args.assetName,
        assetType: args.assetType,
        fileUrl: args.fileUrl,
        fileContent: args.fileContent,
        textContent: args.textContent,
        widthPixels: args.widthPixels,
        heightPixels: args.heightPixels,
        durationSeconds: args.durationSeconds,
        tags: args.tags,
        customMetadata: args.metadata,
      });

      // Create human-readable response
      let response = `📎 **Asset uploaded successfully!**

🆔 **Asset Details**
• Asset ID: ${asset.assetId}
• Name: ${asset.assetName}
• Type: ${asset.assetType}
• Format: ${asset.fileFormat}
• Buyer Agent: ${args.buyerAgentId}`;

      // Add type-specific details
      if (asset.widthPixels && asset.heightPixels) {
        response += `
• Dimensions: ${asset.widthPixels}×${asset.heightPixels} pixels`;
      }

      if (asset.durationSeconds) {
        response += `
• Duration: ${asset.durationSeconds} seconds`;
      }

      if (asset.fileSizeBytes > 0) {
        response += `
• File Size: ${(asset.fileSizeBytes / 1024 / 1024).toFixed(2)} MB`;
      }

      if (asset.fileUrl) {
        response += `
• URL: ${asset.fileUrl}`;
      }

      if (asset.textContent) {
        response += `
📝 **Text Content**`;
        if (asset.textContent.headline) {
          response += `
• Headline: ${asset.textContent.headline}`;
        }
        if (asset.textContent.bodyText) {
          response += `
• Body Text: ${asset.textContent.bodyText}`;
        }
        if (asset.textContent.callToAction) {
          response += `
• Call to Action: ${asset.textContent.callToAction}`;
        }
        if (asset.textContent.sponsoredByText) {
          response += `
• Sponsored By: ${asset.textContent.sponsoredByText}`;
        }
      }

      if (asset.tags && asset.tags.length > 0) {
        response += `
🏷️ **Tags**: ${asset.tags.join(', ')}`;
      }

      response += `

💡 **Next Steps**
• Use this asset in creatives with \`creative/create\`
• Find it in your asset library with \`creative/list\`
• Assign it to campaigns through creative management

🔄 **[STUB]** This asset will be uploaded to the appropriate AdCP publisher based on type:
• ${args.assetType} assets → Specialized ${args.assetType} publisher
• Processing, validation, and optimization handled automatically`;

      return createMCPResponse({ message: response, success: true });

    } catch (error) {
      return createErrorResponse("Failed to upload asset", error);
    }
  },

  name: "creative/upload_asset",

  parameters: z.object({
    buyerAgentId: z.string().describe("The buyer agent that will own this asset"),
    assetName: z.string().describe("Human-readable name for the asset"),
    assetType: z.enum(['image', 'video', 'text', 'audio', 'html', 'native_component']).describe("Type of asset being uploaded"),
    
    // File references (one required for non-text assets)
    fileUrl: z.string().optional().describe("URL to the asset file"),
    fileContent: z.string().optional().describe("Base64 encoded file content"),
    
    // Text content (required for text/native assets)
    textContent: z.object({
      headline: z.string().optional().describe("Main headline text"),
      bodyText: z.string().optional().describe("Body/description text"),
      callToAction: z.string().optional().describe("Call-to-action button text"),
      sponsoredByText: z.string().optional().describe("Sponsored by disclaimer"),
    }).optional(),
    
    // Specifications
    widthPixels: z.number().optional().describe("Width in pixels for visual assets"),
    heightPixels: z.number().optional().describe("Height in pixels for visual assets"),
    durationSeconds: z.number().optional().describe("Duration in seconds for video/audio assets"),
    
    // Organization
    tags: z.array(z.string()).optional().describe("Tags for organizing and finding this asset"),
    metadata: z.record(z.unknown()).optional().describe("Custom metadata for this asset"),
  }),
});