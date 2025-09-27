import { z } from "zod";

import { analytics, logger, metrics } from "../services/monitoring-service.js";

// File validation schemas
const SUPPORTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;
const SUPPORTED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;
const SUPPORTED_AUDIO_TYPES = ["audio/mpeg", "audio/wav", "audio/ogg"] as const;
const SUPPORTED_FONT_TYPES = [
  "font/woff",
  "font/woff2",
  "font/ttf",
  "font/otf",
] as const;

// Size limits (in bytes)
const SIZE_LIMITS = {
  audio: 50 * 1024 * 1024, // 50MB
  font: 2 * 1024 * 1024, // 2MB
  image: 10 * 1024 * 1024, // 10MB
  logo: 5 * 1024 * 1024, // 5MB
  video: 100 * 1024 * 1024, // 100MB
} as const;

// Enhanced filename validation
const filenameSchema = z
  .string()
  .min(1, "Filename cannot be empty")
  .max(255, "Filename too long (max 255 characters)")
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    "Filename can only contain letters, numbers, dots, hyphens, and underscores",
  )
  .refine(
    (filename) => !filename.startsWith("."),
    "Filename cannot start with a dot",
  )
  .refine(
    (filename) => !filename.endsWith("."),
    "Filename cannot end with a dot",
  );

// Base64 validation with size checking
const createBase64Schema = (maxSizeBytes: number) =>
  z
    .string()
    .min(1, "Base64 data cannot be empty")
    .regex(/^[A-Za-z0-9+/]*={0,2}$/, "Invalid base64 format")
    .refine(
      (base64) => {
        try {
          // Calculate decoded size: base64 length * 3/4, accounting for padding
          const padding = (base64.match(/=/g) || []).length;
          const decodedSize = (base64.length * 3) / 4 - padding;
          return decodedSize <= maxSizeBytes;
        } catch {
          return false;
        }
      },
      `File size exceeds maximum ${Math.round(maxSizeBytes / (1024 * 1024))}MB`,
    );

// Content type validation
const createContentTypeSchema = (assetType: string) =>
  z.string().refine((contentType) => {
    switch (assetType) {
      case "audio":
        return (SUPPORTED_AUDIO_TYPES as readonly string[]).includes(
          contentType,
        );
      case "font":
        return (SUPPORTED_FONT_TYPES as readonly string[]).includes(
          contentType,
        );
      case "image":
      case "logo":
        return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(
          contentType,
        );
      case "video":
        return (SUPPORTED_VIDEO_TYPES as readonly string[]).includes(
          contentType,
        );
      default:
        return false;
    }
  }, "Unsupported content type for this asset type");

// Asset metadata validation
const assetMetadataSchema = z
  .object({
    buyerAgentId: z.string().optional(),
    campaignId: z.string().optional(),
    description: z.string().max(500).optional(),
    tags: z.array(z.string().max(50)).max(10).optional(),
  })
  .strict();

// Individual asset schema factory
const createAssetSchema = () =>
  z
    .object({
      assetType: z.enum(["image", "video", "audio", "logo", "font"]),
      filename: filenameSchema,
      metadata: assetMetadataSchema.optional(),
    })
    .and(
      z.discriminatedUnion("assetType", [
        z.object({
          assetType: z.literal("image"),
          base64Data: createBase64Schema(SIZE_LIMITS.image),
          contentType: createContentTypeSchema("image"),
        }),
        z.object({
          assetType: z.literal("video"),
          base64Data: createBase64Schema(SIZE_LIMITS.video),
          contentType: createContentTypeSchema("video"),
        }),
        z.object({
          assetType: z.literal("audio"),
          base64Data: createBase64Schema(SIZE_LIMITS.audio),
          contentType: createContentTypeSchema("audio"),
        }),
        z.object({
          assetType: z.literal("logo"),
          base64Data: createBase64Schema(SIZE_LIMITS.logo),
          contentType: createContentTypeSchema("logo"),
        }),
        z.object({
          assetType: z.literal("font"),
          base64Data: createBase64Schema(SIZE_LIMITS.font),
          contentType: createContentTypeSchema("font"),
        }),
      ]),
    );

// Upload request validation schema
export const uploadRequestSchema = z
  .object({
    assets: z
      .array(createAssetSchema())
      .min(1, "At least one asset is required")
      .max(10, "Maximum 10 assets per request"), // Rate limiting at schema level
  })
  .strict();

// List uploads validation schema
export const listUploadsSchema = z
  .object({
    assetType: z.enum(["image", "video", "audio", "logo", "font"]).optional(),
    buyerAgentId: z.string().optional(),
    limit: z.number().min(1).max(100).optional(),
    offset: z.number().min(0).optional(),
  })
  .strict();

// Analytics request validation schema
export const analyticsRequestSchema = z
  .object({
    customerId: z.string().optional(),
    includeInactive: z.boolean().optional(),
    limit: z.number().min(1).max(1000).optional(),
    scope: z.enum(["customers", "brand-agents"]),
  })
  .strict();

// Rate limiting configuration
export interface RateLimitConfig {
  maxRequests: number;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  windowMs: number;
}

// Validation error handling
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown,
    public readonly requestId: string,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

export const RATE_LIMITS = {
  analytics: {
    maxRequests: 20, // 20 analytics requests per 5 minutes per customer
    skipFailedRequests: true,
    skipSuccessfulRequests: false,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },
  list: {
    maxRequests: 100, // 100 list requests per minute per customer
    skipFailedRequests: true,
    skipSuccessfulRequests: false,
    windowMs: 1 * 60 * 1000, // 1 minute
  },
  upload: {
    maxRequests: 50, // 50 uploads per 15 minutes per customer
    skipFailedRequests: true,
    skipSuccessfulRequests: false,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
} as const;

// Validation middleware factory
export function createValidationMiddleware<T>(
  schema: z.ZodSchema<T>,
  context: string,
) {
  return async (
    input: unknown,
    requestId: string,
    customerId?: string,
  ): Promise<T> => {
    const startTime = Date.now();

    try {
      // Track validation attempt
      metrics.toolCalls.inc({ status: "validating", tool_name: context });

      const result = await schema.parseAsync(input);

      // Track successful validation
      const duration = Date.now() - startTime;
      metrics.toolDuration.observe(
        { tool_name: `${context}_validation` },
        duration / 1000,
      );
      metrics.toolCalls.inc({
        status: "validation_success",
        tool_name: context,
      });

      logger.debug("Input validation successful", {
        context,
        customerId,
        requestId,
        validationDuration: duration,
      });

      return result;
    } catch (error) {
      // Track validation failure
      const duration = Date.now() - startTime;
      metrics.toolDuration.observe(
        { tool_name: `${context}_validation` },
        duration / 1000,
      );
      metrics.toolCalls.inc({
        status: "validation_failed",
        tool_name: context,
      });
      metrics.errors.inc({ context, error_type: "validation_error" });

      let errorMessage = "Validation failed";
      let field = "unknown";
      let value = input;

      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        field = firstError.path.join(".");
        errorMessage = `${field}: ${firstError.message}`;
        value = (firstError as { received?: unknown }).received || "unknown";
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      logger.warn("Input validation failed", {
        context,
        customerId,
        error: errorMessage,
        field,
        requestId,
        validationDuration: duration,
      });

      // Track validation error in analytics
      if (customerId) {
        analytics.trackError({
          context: `${context}_validation`,
          customerId,
          error: error instanceof Error ? error : new Error(errorMessage),
          metadata: { field, value },
          requestId,
        });
      }

      throw new ValidationError(errorMessage, field, value, requestId);
    }
  };
}

// Pre-configured validation middleware
export const validateUploadRequest = createValidationMiddleware(
  uploadRequestSchema,
  "assets_upload",
);

export const validateListRequest = createValidationMiddleware(
  listUploadsSchema,
  "assets_list",
);

export const validateAnalyticsRequest = createValidationMiddleware(
  analyticsRequestSchema,
  "assets_analytics",
);

export function calculateBase64Size(base64String: string): number {
  // Calculate decoded size: base64 length * 3/4, accounting for padding
  const padding = (base64String.match(/=/g) || []).length;
  return (base64String.length * 3) / 4 - padding;
}

// Security helper functions
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, "_") // Replace invalid chars with underscore
    .replace(/^\.+/, "") // Remove leading dots
    .replace(/\.+$/, "") // Remove trailing dots
    .substring(0, 255); // Truncate to max length
}

export function validateFileExtension(
  filename: string,
  contentType: string,
): boolean {
  const extension = filename.toLowerCase().split(".").pop();

  const extensionMap: Record<string, string[]> = {
    "audio/mpeg": ["mp3"],
    "audio/ogg": ["ogg"],
    "audio/wav": ["wav"],
    "font/otf": ["otf"],
    "font/ttf": ["ttf"],
    "font/woff": ["woff"],
    "font/woff2": ["woff2"],
    "image/gif": ["gif"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
    "video/mp4": ["mp4"],
    "video/quicktime": ["mov"],
    "video/webm": ["webm"],
  };

  const allowedExtensions = extensionMap[contentType];
  return allowedExtensions?.includes(extension || "") || false;
}
