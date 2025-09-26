import { z } from "zod";

import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { AssetStorageService } from "../../services/asset-storage-service.js";
import { requireSessionAuth } from "../../utils/auth.js";

/**
 * List uploaded creative assets from GCS storage
 */
export const assetsListUploadsTool = () => ({
  annotations: {
    category: "Assets",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Uploaded Assets from GCS",
  },

  description:
    "List creative assets uploaded to Google Cloud Storage. Shows asset metadata, public URLs, and organization details. Can filter by buyer agent.",

  execute: async (
    args: {
      assetType?: "audio" | "font" | "image" | "logo" | "video";
      buyerAgentId?: string;
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Universal session authentication check
    const { customerId } = requireSessionAuth(context);

    const storageService = new AssetStorageService();

    try {
      // Get assets from GCS (filter by customer and optionally by buyer agent)
      let assets = await storageService.listAssets(
        String(customerId),
        args.buyerAgentId,
      );

      // Filter by asset type if specified
      if (args.assetType) {
        assets = assets.filter((asset) => asset.assetType === args.assetType);
      }

      // Sort by upload date (newest first)
      assets.sort(
        (a, b) =>
          new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
      );

      // Create human-readable response
      let response = `📤 **Uploaded Creative Assets**

🆔 **Summary**
• Customer ID: ${customerId}
• Total Assets: ${assets.length}`;

      if (args.buyerAgentId) {
        response += `
• Buyer Agent Filter: ${args.buyerAgentId}`;
      }

      if (args.assetType) {
        response += `
• Asset Type Filter: ${args.assetType}`;
      }

      if (assets.length === 0) {
        response += `

📋 **No assets found**`;

        if (args.buyerAgentId || args.assetType) {
          response += `
Try removing filters or upload assets using \`assets_upload\` tool.`;
        } else {
          response += `
Use \`assets_upload\` tool to upload your first creative assets.`;
        }

        return response;
      }

      // Group assets by type for better organization
      const assetsByType = assets.reduce(
        (acc, asset) => {
          const type = asset.assetType || "unknown";
          if (!acc[type]) acc[type] = [];
          acc[type].push(asset);
          return acc;
        },
        {} as Record<string, typeof assets>,
      );

      response += `

📋 **Asset Details:**`;

      for (const [type, typeAssets] of Object.entries(assetsByType)) {
        response += `

**${type.toUpperCase()} Assets (${typeAssets.length})**`;

        for (const asset of typeAssets.slice(0, 20)) {
          // Limit to first 20 per type
          const sizeText = Math.round(asset.size / 1024);
          const uploadDate = new Date(asset.uploadedAt).toLocaleDateString();

          response += `
• **${asset.originalFilename}** (${sizeText}KB)
  📎 Public URL: ${asset.publicUrl}
  🆔 Asset ID: \`${asset.assetId}\`
  📅 Uploaded: ${uploadDate}`;

          if (asset.buyerAgentId) {
            response += `
  👤 Buyer Agent: ${asset.buyerAgentId}`;
          }

          if (asset.tags && asset.tags.length > 0) {
            response += `
  🏷️ Tags: ${asset.tags.join(", ")}`;
          }
        }

        if (typeAssets.length > 20) {
          response += `
  ... and ${typeAssets.length - 20} more ${type} assets`;
        }
      }

      response += `

💡 **Usage Options**
• **Share with sales agents**: Copy public URLs directly
• **Use in creatives**: Reference by asset ID in \`creative_create\`
• **Register in system**: Use \`assets_add\` with \`cdnUrl\` parameter
• **Download/view**: Click any public URL (no auth required)

🌐 **Public Access**
All assets are publicly accessible via HTTPS and can be shared directly with sales agents or embedded in campaigns.`;

      return response;
    } catch (error) {
      throw new Error(
        `Failed to list uploaded assets: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "assets_list_uploads",

  parameters: z.object({
    assetType: z
      .enum(["image", "video", "audio", "logo", "font"])
      .optional()
      .describe("Filter assets by type"),

    buyerAgentId: z
      .string()
      .optional()
      .describe("Filter assets by buyer agent ID"),
  }),
});
