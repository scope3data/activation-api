import { z } from 'zod';
import { analytics, metrics, logger } from '../services/monitoring-service.js';

// File validation schemas
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
const SUPPORTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const;
const SUPPORTED_AUDIO_TYPES = ['audio/mpeg', 'audio/wav', 'audio/ogg'] as const;
const SUPPORTED_FONT_TYPES = ['font/woff', 'font/woff2', 'font/ttf', 'font/otf'] as const;

// Size limits (in bytes)
const SIZE_LIMITS = {
  image: 10 * 1024 * 1024,    // 10MB
  video: 100 * 1024 * 1024,   // 100MB
  audio: 50 * 1024 * 1024,    // 50MB
  logo: 5 * 1024 * 1024,      // 5MB
  font: 2 * 1024 * 1024,      // 2MB
} as const;

// Enhanced filename validation
const filenameSchema = z.string()
  .min(1, 'Filename cannot be empty')
  .max(255, 'Filename too long (max 255 characters)')
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'Filename can only contain letters, numbers, dots, hyphens, and underscores'
  )
  .refine(
    (filename) => !filename.startsWith('.'),
    'Filename cannot start with a dot'
  )
  .refine(
    (filename) => !filename.endsWith('.'),
    'Filename cannot end with a dot'
  );

// Base64 validation with size checking
const createBase64Schema = (maxSizeBytes: number) => z.string()
  .min(1, 'Base64 data cannot be empty')
  .regex(/^[A-Za-z0-9+/]*={0,2}$/, 'Invalid base64 format')
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
    `File size exceeds maximum ${Math.round(maxSizeBytes / (1024 * 1024))}MB`
  );

// Content type validation
const createContentTypeSchema = (assetType: string) => z.string().refine(
  (contentType) => {
    switch (assetType) {
      case 'image':
      case 'logo':
        return SUPPORTED_IMAGE_TYPES.includes(contentType as any);
      case 'video':
        return SUPPORTED_VIDEO_TYPES.includes(contentType as any);
      case 'audio':
        return SUPPORTED_AUDIO_TYPES.includes(contentType as any);
      case 'font':
        return SUPPORTED_FONT_TYPES.includes(contentType as any);
      default:
        return false;
    }
  },
  'Unsupported content type for this asset type'
);

// Asset metadata validation
const assetMetadataSchema = z.object({
  buyerAgentId: z.string().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  description: z.string().max(500).optional(),
  campaignId: z.string().optional(),
}).strict();

// Individual asset schema factory
const createAssetSchema = () => z.object({
  assetType: z.enum(['image', 'video', 'audio', 'logo', 'font']),
  filename: filenameSchema,
  metadata: assetMetadataSchema.optional(),
}).and(
  z.discriminatedUnion('assetType', [
    z.object({
      assetType: z.literal('image'),
      base64Data: createBase64Schema(SIZE_LIMITS.image),
      contentType: createContentTypeSchema('image'),
    }),
    z.object({
      assetType: z.literal('video'),
      base64Data: createBase64Schema(SIZE_LIMITS.video),
      contentType: createContentTypeSchema('video'),
    }),
    z.object({
      assetType: z.literal('audio'),
      base64Data: createBase64Schema(SIZE_LIMITS.audio),
      contentType: createContentTypeSchema('audio'),
    }),
    z.object({
      assetType: z.literal('logo'),
      base64Data: createBase64Schema(SIZE_LIMITS.logo),
      contentType: createContentTypeSchema('logo'),
    }),
    z.object({
      assetType: z.literal('font'),
      base64Data: createBase64Schema(SIZE_LIMITS.font),
      contentType: createContentTypeSchema('font'),
    }),
  ])
);

// Upload request validation schema
export const uploadRequestSchema = z.object({
  assets: z.array(createAssetSchema())
    .min(1, 'At least one asset is required')
    .max(10, 'Maximum 10 assets per request'), // Rate limiting at schema level
}).strict();

// List uploads validation schema
export const listUploadsSchema = z.object({
  buyerAgentId: z.string().optional(),
  assetType: z.enum(['image', 'video', 'audio', 'logo', 'font']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
}).strict();

// Analytics request validation schema
export const analyticsRequestSchema = z.object({
  scope: z.enum(['customers', 'brand-agents']),
  customerId: z.string().optional(),
  includeInactive: z.boolean().optional(),
  limit: z.number().min(1).max(1000).optional(),
}).strict();

// Validation error handling
export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: any,
    public readonly requestId: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Rate limiting configuration
export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export const RATE_LIMITS = {
  upload: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50, // 50 uploads per 15 minutes per customer
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
  },
  list: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 100, // 100 list requests per minute per customer
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
  },
  analytics: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 20, // 20 analytics requests per 5 minutes per customer
    skipSuccessfulRequests: false,
    skipFailedRequests: true,
  },
} as const;

// Validation middleware factory
export function createValidationMiddleware<T>(
  schema: z.ZodSchema<T>,
  context: string
) {
  return async (input: unknown, requestId: string, customerId?: string): Promise<T> => {
    const startTime = Date.now();
    
    try {
      // Track validation attempt
      metrics.toolCalls.inc({ tool_name: context, status: 'validating' });
      
      const result = await schema.parseAsync(input);
      
      // Track successful validation
      const duration = Date.now() - startTime;
      metrics.toolDuration.observe({ tool_name: `${context}_validation` }, duration / 1000);
      metrics.toolCalls.inc({ tool_name: context, status: 'validation_success' });
      
      logger.debug('Input validation successful', {
        context,
        requestId,
        customerId,
        validationDuration: duration
      });
      
      return result;
    } catch (error) {
      // Track validation failure
      const duration = Date.now() - startTime;
      metrics.toolDuration.observe({ tool_name: `${context}_validation` }, duration / 1000);
      metrics.toolCalls.inc({ tool_name: context, status: 'validation_failed' });
      metrics.errors.inc({ error_type: 'validation_error', context });
      
      let errorMessage = 'Validation failed';
      let field = 'unknown';
      let value = input;
      
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        field = firstError.path.join('.');
        errorMessage = `${field}: ${firstError.message}`;
        value = firstError.received;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      logger.warn('Input validation failed', {
        context,
        requestId,
        customerId,
        error: errorMessage,
        field,
        validationDuration: duration
      });
      
      // Track validation error in analytics
      if (customerId) {
        analytics.trackError({
          customerId,
          error: error instanceof Error ? error : new Error(errorMessage),
          context: `${context}_validation`,
          requestId,
          metadata: { field, value }
        });
      }
      
      throw new ValidationError(errorMessage, field, value, requestId);
    }
  };
}

// Pre-configured validation middleware
export const validateUploadRequest = createValidationMiddleware(
  uploadRequestSchema,
  'assets_upload'
);

export const validateListRequest = createValidationMiddleware(
  listUploadsSchema,
  'assets_list'
);

export const validateAnalyticsRequest = createValidationMiddleware(
  analyticsRequestSchema,
  'assets_analytics'
);

// Security helper functions
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_') // Replace invalid chars with underscore
    .replace(/^\.+/, '') // Remove leading dots
    .replace(/\.+$/, '') // Remove trailing dots
    .substring(0, 255); // Truncate to max length
}

export function validateFileExtension(filename: string, contentType: string): boolean {
  const extension = filename.toLowerCase().split('.').pop();
  
  const extensionMap: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/gif': ['gif'],
    'image/webp': ['webp'],
    'video/mp4': ['mp4'],
    'video/webm': ['webm'],
    'video/quicktime': ['mov'],
    'audio/mpeg': ['mp3'],
    'audio/wav': ['wav'],
    'audio/ogg': ['ogg'],
    'font/woff': ['woff'],
    'font/woff2': ['woff2'],
    'font/ttf': ['ttf'],
    'font/otf': ['otf'],
  };
  
  const allowedExtensions = extensionMap[contentType];
  return allowedExtensions?.includes(extension || '') || false;
}

export function calculateBase64Size(base64String: string): number {
  // Calculate decoded size: base64 length * 3/4, accounting for padding
  const padding = (base64String.match(/=/g) || []).length;
  return (base64String.length * 3) / 4 - padding;
}