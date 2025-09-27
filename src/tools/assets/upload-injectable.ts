/* eslint-disable @typescript-eslint/no-explicit-any, perfectionist/sort-interfaces, perfectionist/sort-object-types, perfectionist/sort-objects */
import { z } from "zod";

import type { MCPToolExecuteContext } from "../../types/mcp.js";

/**
 * Dependency injection interfaces for the upload tool.
 * This makes testing much easier and more reliable.
 */
export interface UploadToolDependencies {
  assetStorageService?: {
    uploadAsset: (asset: any) => Promise<any>;
    validateAsset: (
      contentType: string,
      fileSize: number,
      assetType: string,
    ) => any;
  };
  validationMiddleware?: {
    validateUploadRequest: (
      args: any,
      requestId: string,
      customerId: string,
    ) => Promise<any>;
  };
  rateLimitMiddleware?: {
    checkUploadRateLimit: (
      customerId: string,
      requestId: string,
    ) => Promise<void>;
  };
  monitoringService?: {
    analytics: {
      trackToolUsage: (data: any) => void;
      trackError: (data: any) => void;
      trackAssetUpload: (data: any) => void;
    };
    metrics: {
      trackError: (data: any) => void;
      errors: { inc: (data: any) => void };
      duration: { observe: (data: any, value: number) => void };
      uploadAttempts: { inc: (data: any) => void };
      uploadDuration: { observe: (data: any, value: number) => void };
      toolDuration: { observe: (data: any, value: number) => void };
    };
    logger: {
      info: (message: string, data?: any) => void;
      error: (message: string, error?: any, data?: any) => void;
      warn: (message: string, data?: any) => void;
      debug: (message: string, data?: any) => void;
    };
    RequestContextService: {
      create: () => {
        requestId: string;
        customerId?: string;
        cleanup: () => void;
        getMetadata: () => any;
        setMetadata: (key: string, value: any) => void;
      };
    };
  };
  authService?: {
    requireSessionAuth: (context: MCPToolExecuteContext) => {
      customerId: number;
    };
  };
  errorHandling?: {
    retryWithBackoff: <T>(fn: () => Promise<T>, options?: any) => Promise<T>;
    withTimeout: <T>(promise: Promise<T>, timeout: number) => Promise<T>;
    serializeError: (error: any) => any;
    circuitBreakers: any;
  };
}

/**
 * Injectable version of the assets upload tool.
 * Dependencies can be provided for testing or default implementations will be used.
 */
export function createAssetsUploadTool(
  dependencies: UploadToolDependencies = {},
) {
  // Import defaults only when not provided (lazy loading for tests)
  const getDefaults = async () => {
    if (!dependencies.assetStorageService) {
      const { AssetStorageService } = await import(
        "../../services/asset-storage-service.js"
      );
      dependencies.assetStorageService = new AssetStorageService();
    }

    if (!dependencies.validationMiddleware) {
      const { validateUploadRequest } = await import(
        "../../middleware/validation-middleware.js"
      );
      dependencies.validationMiddleware = { validateUploadRequest };
    }

    if (!dependencies.rateLimitMiddleware) {
      const { checkUploadRateLimit } = await import(
        "../../middleware/rate-limit-middleware.js"
      );
      dependencies.rateLimitMiddleware = { checkUploadRateLimit };
    }

    if (!dependencies.monitoringService) {
      const monitoring = await import("../../services/monitoring-service.js");
      dependencies.monitoringService = monitoring;
    }

    if (!dependencies.authService) {
      const { requireSessionAuth } = await import("../../utils/auth.js");
      dependencies.authService = { requireSessionAuth };
    }

    if (!dependencies.errorHandling) {
      dependencies.errorHandling = await import(
        "../../utils/error-handling.js"
      );
    }
  };

  return {
    annotations: {
      category: "Assets",
      dangerLevel: "low",
      openWorldHint: true,
      readOnlyHint: false,
      title: "Upload Creative Assets to GCS (Injectable)",
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
      // Ensure dependencies are loaded
      await getDefaults();

      const {
        assetStorageService,
        validationMiddleware,
        rateLimitMiddleware,
        monitoringService,
        authService,
        errorHandling,
      } = dependencies;

      if (
        !assetStorageService ||
        !validationMiddleware ||
        !rateLimitMiddleware ||
        !monitoringService ||
        !authService ||
        !errorHandling
      ) {
        throw new Error("Failed to initialize required dependencies");
      }

      const requestContext = monitoringService.RequestContextService.create();
      const operationStartTime = Date.now();

      try {
        // Universal session authentication check
        const { customerId } = authService.requireSessionAuth(context);
        requestContext.setMetadata("customerId", customerId);
        requestContext.setMetadata("tool_name", "assets_upload");
        requestContext.setMetadata("asset_count", args.assets.length);

        monitoringService.logger.info("Asset upload request started", {
          assetCount: args.assets.length,
          customerId: String(customerId),
          requestId: requestContext.requestId,
        });

        // Input validation with enhanced error handling
        const validatedArgs = await validationMiddleware.validateUploadRequest(
          args,
          requestContext.requestId,
          String(customerId),
        );

        // Rate limiting check
        await rateLimitMiddleware.checkUploadRateLimit(
          String(customerId),
          requestContext.requestId,
        );

        // Track tool usage start
        monitoringService.analytics.trackToolUsage({
          customerId: String(customerId),
          duration: 0,
          requestId: requestContext.requestId,
          success: true, // Initial tracking
          toolName: "assets_upload",
        });

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

            requestContext.setMetadata(
              `asset_${asset.filename}_size`,
              fileSize,
            );

            // Validate asset constraints
            const validation = assetStorageService.validateAsset(
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
              monitoringService.analytics.trackAssetUpload({
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

            // Upload asset with retry logic and circuit breaker
            const uploadResult = await errorHandling.retryWithBackoff(
              () =>
                errorHandling.withTimeout(
                  assetStorageService.uploadAsset({
                    assetType: asset.assetType,
                    base64Data: asset.base64Data,
                    buyerAgentId: asset.metadata?.buyerAgentId,
                    contentType: asset.contentType,
                    customerId: String(customerId),
                    filename: asset.filename,
                    tags: asset.metadata?.tags,
                  }),
                  30000, // 30 second timeout
                ),
              {
                circuitBreaker: errorHandling.circuitBreakers?.gcs,
                maxAttempts: 3,
              },
            );

            results.push({
              assetId: uploadResult.assetId,
              filename: asset.filename,
              fileSize: uploadResult.fileSize,
              publicUrl: uploadResult.publicUrl,
              success: true,
            });

            const uploadDuration = Date.now() - assetStartTime;

            // Track successful upload
            monitoringService.analytics.trackAssetUpload({
              assetType: asset.assetType,
              buyerAgentId: asset.metadata?.buyerAgentId,
              customerId: String(customerId),
              duration: uploadDuration,
              fileSize: uploadResult.fileSize,
              requestId: requestContext.requestId,
              success: true,
            });

            monitoringService.metrics.uploadAttempts.inc({
              asset_type: asset.assetType,
              customer_id: customerId,
              status: "success",
            });

            monitoringService.metrics.uploadDuration.observe(
              { asset_type: asset.assetType },
              uploadDuration / 1000,
            );

            monitoringService.logger.info("Asset uploaded successfully", {
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
            monitoringService.analytics.trackAssetUpload({
              assetType: asset.assetType,
              buyerAgentId: asset.metadata?.buyerAgentId,
              customerId: String(customerId),
              duration: uploadDuration,
              fileSize: Buffer.from(asset.base64Data, "base64").length,
              requestId: requestContext.requestId,
              success: false,
            });

            monitoringService.analytics.trackError({
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

            monitoringService.metrics.uploadAttempts.inc({
              asset_type: asset.assetType,
              customer_id: customerId,
              status: "error",
            });

            monitoringService.metrics.errors.inc({
              context: "assets_upload",
              error_type: "upload_failed",
            });

            monitoringService.logger.error(
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

        monitoringService.analytics.trackToolUsage({
          customerId: String(customerId),
          duration: totalDuration,
          requestId: requestContext.requestId,
          success: overallSuccess,
          toolName: "assets_upload",
        });

        monitoringService.metrics.toolDuration.observe(
          { tool_name: "assets_upload" },
          totalDuration / 1000,
        );

        monitoringService.logger.info("Asset upload request completed", {
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
        monitoringService.analytics.trackToolUsage({
          customerId: requestContext.customerId || "unknown",
          duration: totalDuration,
          errorType: error instanceof Error ? error.name : "Unknown",
          requestId: requestContext.requestId,
          success: false,
          toolName: "assets_upload",
        });

        monitoringService.analytics.trackError({
          context: "assets_upload_tool",
          customerId: requestContext.customerId,
          error: error instanceof Error ? error : new Error(errorMessage),
          metadata: requestContext.getMetadata(),
          requestId: requestContext.requestId,
        });

        monitoringService.metrics.errors.inc({
          context: "assets_upload",
          error_type: "tool_execution_failed",
        });

        monitoringService.logger.error(
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
        const serializedError = errorHandling.serializeError(error);
        throw new Error(
          `Upload failed: ${serializedError.error.message} (Request ID: ${requestContext.requestId})`,
        );
      } finally {
        // Clean up request context
        requestContext.cleanup();
      }
    },

    name: "assets_upload_injectable",

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
                  .describe("Tags for categorizing and searching assets"),
              })
              .optional()
              .describe("Additional metadata for the asset"),
          }),
        )
        .min(1, "At least one asset is required")
        .max(10, "Maximum 10 assets per request")
        .describe("Array of assets to upload"),
    }),
  };
}
