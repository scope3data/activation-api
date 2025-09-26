import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { requireSessionAuth } from "../../utils/auth.js";

/**
 * Add assets via reference management (URLs, upload IDs, CDN URLs)
 * MCP orchestration layer - NO file uploads
 */
export const assetsAddTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "System",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Add Assets (Reference Management)",
  },

  description:
    "Add assets to a buyer agent's library by referencing external URLs, REST upload IDs, or existing CDN URLs. This is orchestration only - actual file uploads happen via REST API. Assets can then be used in creatives via asset IDs.",

  execute: async (
    args: {
      assets: Array<{
        metadata?: {
          dimensions?: { height: number; width: number };
          duration?: number;
          fileSize?: number;
          tags?: string[];
        };
        name: string;
        source: {
          cdnUrl?: string; // Already on CDN
          uploadId?: string; // ID from REST upload
          url?: string; // External URL to fetch from
        };
        type: "audio" | "font" | "image" | "logo" | "video";
      }>;
      buyerAgentId: string;
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Universal session authentication check
    const { apiKey, customerId: _customerId } = requireSessionAuth(context);

    try {
      // Validate that each asset has at least one source
      for (const asset of args.assets) {
        const { cdnUrl, uploadId, url } = asset.source;
        if (!url && !uploadId && !cdnUrl) {
          throw new Error(
            `Asset "${asset.name}" must have at least one source: url, uploadId, or cdnUrl`,
          );
        }
      }

      // Add assets through reference management
      const result = await client.addAssets(apiKey, {
        assets: args.assets,
        buyerAgentId: args.buyerAgentId,
      });

      // Create human-readable response
      let response = `📎 **Assets added successfully!**

🆔 **Summary**
• Buyer Agent: ${args.buyerAgentId}
• Total Assets: ${result.results.length}
• Successful: ${result.successCount}
• Failed: ${result.errorCount}

📋 **Asset Details:**`;

      // List each asset result
      for (const assetResult of result.results) {
        const status = assetResult.success ? "✅" : "❌";
        response += `
${status} **${assetResult.assetId || "Failed"}**`;

        if (assetResult.originalUrl) {
          response += `
   • Source: ${assetResult.originalUrl}`;
        }
        if (assetResult.uploadId) {
          response += `
   • Upload ID: ${assetResult.uploadId}`;
        }
        if (assetResult.error) {
          response += `
   • Error: ${assetResult.error}`;
        }
      }

      if (result.successCount > 0) {
        response += `

💡 **Next Steps**
• Use these assets in creatives with \`creative/create\`
• Reference them by asset ID: ${result.results
          .filter((r) => r.success)
          .map((r) => r.assetId)
          .join(", ")}
• Find them in your asset library with \`assets/list\`

🔄 **[ARCHITECTURE]** Assets added via reference management:
• External URLs will be fetched and cached
• Upload IDs reference files uploaded via REST API
• CDN URLs are linked directly for immediate use`;
      }

      return response;
    } catch (error) {
      throw new Error(
        `Failed to add assets: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "assets_add",

  parameters: z.object({
    assets: z
      .array(
        z.object({
          metadata: z
            .object({
              dimensions: z
                .object({
                  height: z.number(),
                  width: z.number(),
                })
                .optional()
                .describe("Dimensions for visual assets"),
              duration: z
                .number()
                .optional()
                .describe("Duration in seconds for video/audio"),
              fileSize: z.number().optional().describe("File size in bytes"),
              tags: z
                .array(z.string())
                .optional()
                .describe("Tags for organization"),
            })
            .optional()
            .describe("Optional metadata for the asset"),
          name: z.string().describe("Human-readable name for the asset"),

          source: z
            .object({
              cdnUrl: z.string().optional().describe("Already on CDN"),
              uploadId: z.string().optional().describe("ID from REST upload"),
              url: z.string().optional().describe("External URL to fetch from"),
            })
            .refine((data) => data.url || data.uploadId || data.cdnUrl, {
              message:
                "At least one source (url, uploadId, or cdnUrl) must be provided",
            }),

          type: z
            .enum(["image", "video", "audio", "logo", "font"])
            .describe("Type of asset"),
        }),
      )
      .min(1)
      .describe("Array of assets to add"),

    buyerAgentId: z
      .string()
      .describe("The buyer agent that will own these assets"),
  }),
});
