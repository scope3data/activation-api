import { z } from "zod";

import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { checkUploadRateLimit } from "../../middleware/rate-limit-middleware.js";
import { validateUploadRequest } from "../../middleware/validation-middleware.js";
import { AssetStorageService } from "../../services/asset-storage-service.js";
import {
  analytics,
  logger,
  metrics,
  RequestContextService,
} from "../../services/monitoring-service.js";
import { requireSessionAuth } from "../../utils/auth.js";
import {
  circuitBreakers,
  retryWithBackoff,
  serializeError,
  withTimeout,
} from "../../utils/error-handling.js";

/**
 * Upload creative assets directly to GCS for distribution to sales agents
 * Accepts base64-encoded files and returns public URLs
 */
export const assetsUploadTool = () => ({
  annotations: {
    category: "Assets",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Upload Creative Assets to GCS",
  },

  description:
    "Upload creative assets (images, videos, audio, logos, fonts) directly to Google Cloud Storage. Accepts base64-encoded file data and returns public URLs for distribution to sales agents. Assets are automatically validated for type and size constraints.",

  execute: async (
    args: {
      assets: Array<{
        assetType: "audio" | "font" | "image" | "logo" | "video";
        base64Data: string;
        contentType: string;
        filename: string;
        metadata?: {
          buyerAgentId?: string;
          creativeId?: string;
          tags?: string[];
        };
      }>;
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    const requestContext = RequestContextService.create();
    const operationStartTime = Date.now();

    try {
      // Universal session authentication check
      const { customerId } = requireSessionAuth(context);
      requestContext.setMetadata("customerId", customerId);
      requestContext.setMetadata("tool_name", "assets_upload");
      requestContext.setMetadata("asset_count", args.assets.length);

      logger.info("Asset upload request started", {
        assetCount: args.assets.length,
        customerId: String(customerId),
        requestId: requestContext.requestId,
      });

      // Input validation with enhanced error handling
      const validatedArgs = await validateUploadRequest(
        args,
        requestContext.requestId,
        String(customerId),
      );

      // Rate limiting check
      await checkUploadRateLimit(String(customerId), requestContext.requestId);

      // Track tool usage start
      analytics.trackToolUsage({
        customerId: String(customerId),
        duration: 0,
        requestId: requestContext.requestId,
        success: true, // Initial tracking
        toolName: "assets_upload",
      });

      const storageService = new AssetStorageService();
      const results: Array<{
        assetId?: string;
        error?: string;
        filename: string;
        fileSize?: number;
        publicUrl?: string;
        success: boolean;
      }> = [];

      // Process each asset upload with enhanced error handling
      for (const asset of validatedArgs.assets) {
        const assetStartTime = Date.now();

        try {
          // Decode base64 to get file size for validation
          const buffer = Buffer.from(asset.base64Data, "base64");
          const fileSize = buffer.length;

          requestContext.setMetadata(`asset_${asset.filename}_size`, fileSize);

          // Validate asset constraints
          const validation = storageService.validateAsset(
            asset.contentType,
            fileSize,
            asset.assetType,
          );

          if (!validation.valid) {
            results.push({
              error: validation.errors.join("; "),
              filename: asset.filename,
              fileSize,
              success: false,
            });

            // Track validation failure
            analytics.trackAssetUpload({
              assetType: asset.assetType,
              buyerAgentId: asset.metadata?.buyerAgentId,
              customerId: String(customerId),
              duration: Date.now() - assetStartTime,
              fileSize,
              requestId: requestContext.requestId,
              success: false,
            });

            continue;
          }

          // Upload to GCS with retry, timeout, and circuit breaker
          const uploadResult = await circuitBreakers.gcs.execute(
            async () => {
              return await retryWithBackoff(
                async () => {
                  return await withTimeout(
                    async () => {
                      return await storageService.uploadAsset(
                        asset.base64Data,
                        asset.filename,
                        asset.contentType,
                        String(customerId),
                        {
                          ...asset.metadata,
                          assetType: asset.assetType,
                        },
                      );
                    },
                    30000, // 30 second timeout
                    {
                      customerId: String(customerId),
                      operationName: "gcs_upload",
                      requestId: requestContext.requestId,
                    },
                  );
                },
                { baseDelayMs: 1000, maxAttempts: 3 },
                {
                  customerId: String(customerId),
                  operationName: "asset_upload",
                  requestId: requestContext.requestId,
                },
              );
            },
            requestContext.requestId,
            String(customerId),
          );

          const uploadDuration = Date.now() - assetStartTime;

          results.push({
            assetId: uploadResult.assetId,
            filename: asset.filename,
            fileSize: uploadResult.fileSize,
            publicUrl: uploadResult.publicUrl,
            success: true,
          });

          // Track successful upload
          analytics.trackAssetUpload({
            assetType: asset.assetType,
            buyerAgentId: asset.metadata?.buyerAgentId,
            customerId: String(customerId),
            duration: uploadDuration,
            fileSize: uploadResult.fileSize,
            requestId: requestContext.requestId,
            success: true,
          });

          metrics.uploadAttempts.inc({
            asset_type: asset.assetType,
            customer_id: customerId,
            status: "success",
          });

          metrics.uploadDuration.observe(
            { asset_type: asset.assetType },
            uploadDuration / 1000,
          );

          logger.info("Asset uploaded successfully", {
            assetId: uploadResult.assetId,
            customerId: String(customerId),
            duration: uploadDuration,
            filename: asset.filename,
            fileSize: uploadResult.fileSize,
            requestId: requestContext.requestId,
          });
        } catch (error) {
          const uploadDuration = Date.now() - assetStartTime;
          const errorMessage =
            error instanceof Error ? error.message : String(error);

          results.push({
            error: errorMessage,
            filename: asset.filename,
            success: false,
          });

          // Track failed upload
          analytics.trackAssetUpload({
            assetType: asset.assetType,
            buyerAgentId: asset.metadata?.buyerAgentId,
            customerId: String(customerId),
            duration: uploadDuration,
            fileSize: Buffer.from(asset.base64Data, "base64").length,
            requestId: requestContext.requestId,
            success: false,
          });

          analytics.trackError({
            context: "asset_upload",
            customerId: String(customerId),
            error: error instanceof Error ? error : new Error(errorMessage),
            metadata: {
              asset_type: asset.assetType,
              file_size: Buffer.from(asset.base64Data, "base64").length,
              filename: asset.filename,
            },
            requestId: requestContext.requestId,
          });

          metrics.uploadAttempts.inc({
            asset_type: asset.assetType,
            customer_id: customerId,
            status: "error",
          });

          metrics.errors.inc({
            context: "assets_upload",
            error_type: "upload_failed",
          });

          logger.error(
            "Asset upload failed",
            error instanceof Error ? error : new Error(errorMessage),
            {
              customerId: String(customerId),
              duration: uploadDuration,
              filename: asset.filename,
              requestId: requestContext.requestId,
            },
          );
        }
      }

      // Create human-readable response
      const successCount = results.filter((r) => r.success).length;
      const failedCount = results.length - successCount;

      let response = `📤 **Asset Upload Results**

🆔 **Summary**
• Customer ID: ${customerId}
• Total Assets: ${results.length}
• Successful: ${successCount}
• Failed: ${failedCount}

📋 **Upload Details:**`;

      // List each upload result
      for (const result of results) {
        const status = result.success ? "✅" : "❌";
        const sizeText = result.fileSize
          ? ` (${Math.round(result.fileSize / 1024)}KB)`
          : "";

        response += `
${status} **${result.filename}**${sizeText}`;

        if (result.success) {
          response += `
   • Asset ID: \`${result.assetId}\`
   • Public URL: ${result.publicUrl}`;
        } else {
          response += `
   • Error: ${result.error}`;
        }
      }

      if (successCount > 0) {
        const successfulAssets = results.filter((r) => r.success);
        response += `

💡 **Next Steps**
• Share public URLs with sales agents: ${successfulAssets.map((r) => r.publicUrl).join(", ")}
• Reference assets in creatives using asset IDs: ${successfulAssets.map((r) => r.assetId).join(", ")}
• Use \`assets_add\` tool to register these in the asset management system

🌐 **Public Access**
• All uploaded assets are publicly accessible via HTTPS
• No authentication required for viewing/downloading
• URLs are permanent and can be shared directly`;
      }

      if (failedCount > 0) {
        response += `

⚠️ **Upload Failures**
Review the errors above and:
• Check file formats are supported for asset type
• Verify file sizes are within limits
• Ensure base64 encoding is valid`;
      }

      // Track final tool usage result
      const totalDuration = Date.now() - operationStartTime;
      const overallSuccess = failedCount === 0;

      analytics.trackToolUsage({
        customerId: String(customerId),
        duration: totalDuration,
        requestId: requestContext.requestId,
        success: overallSuccess,
        toolName: "assets_upload",
      });

      metrics.toolDuration.observe(
        { tool_name: "assets_upload" },
        totalDuration / 1000,
      );

      logger.info("Asset upload request completed", {
        customerId: String(customerId),
        failedCount,
        overallSuccess,
        requestId: requestContext.requestId,
        successCount,
        totalAssets: results.length,
        totalDuration,
      });

      // Add request ID to response for debugging
      response += `

🔍 **Request ID**: \`${requestContext.requestId}\``;

      return response;
    } catch (error) {
      const totalDuration = Date.now() - operationStartTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Track tool failure
      analytics.trackToolUsage({
        customerId: requestContext.customerId || "unknown",
        duration: totalDuration,
        errorType: error instanceof Error ? error.name : "Unknown",
        requestId: requestContext.requestId,
        success: false,
        toolName: "assets_upload",
      });

      analytics.trackError({
        context: "assets_upload_tool",
        customerId: requestContext.customerId,
        error: error instanceof Error ? error : new Error(errorMessage),
        metadata: requestContext.getMetadata(),
        requestId: requestContext.requestId,
      });

      metrics.errors.inc({
        context: "assets_upload",
        error_type: "tool_execution_failed",
      });

      logger.error(
        "Asset upload tool execution failed",
        error instanceof Error ? error : new Error(errorMessage),
        {
          customerId: requestContext.customerId,
          duration: totalDuration,
          metadata: requestContext.getMetadata(),
          requestId: requestContext.requestId,
        },
      );

      // Clean up request context
      requestContext.cleanup();

      // Return structured error response
      const serializedError = serializeError(error);
      throw new Error(
        `Upload failed: ${serializedError.error.message} (Request ID: ${requestContext.requestId})`,
      );
    } finally {
      // Clean up request context
      requestContext.cleanup();
    }
  },

  name: "assets_upload",

  parameters: z.object({
    assets: z
      .array(
        z.object({
          assetType: z
            .enum(["image", "video", "audio", "logo", "font"])
            .describe("Type of creative asset"),

          base64Data: z
            .string()
            .describe("Base64-encoded file data (without data URI prefix)"),

          contentType: z
            .string()
            .describe(
              "MIME type of the file (e.g., 'image/jpeg', 'video/mp4')",
            ),

          filename: z
            .string()
            .describe("Original filename including extension"),

          metadata: z
            .object({
              buyerAgentId: z
                .string()
                .optional()
                .describe("Buyer agent that will own this asset"),

              creativeId: z
                .string()
                .optional()
                .describe("Creative this asset belongs to"),

              tags: z
                .array(z.string())
                .optional()
                .describe("Tags for organizing assets"),
            })
            .optional()
            .describe("Optional metadata for the asset"),
        }),
      )
      .min(1)
      .max(10)
      .describe("Array of assets to upload (max 10 per request)"),
  }),
});
