/**
 * Standardized Mock Factories for Testing
 *
 * These factories create consistent, complete mocks that match real service interfaces.
 * This prevents the "Cannot read properties of undefined" errors and provides
 * predictable test behavior.
 */

import type { MockedFunction } from "vitest";

import { vi } from "vitest";

// ============================================================================
// MONITORING SERVICE MOCKS
// ============================================================================

export interface AssetUploadResult {
  assetId: string;
  fileSize: number;
  publicUrl: string;
  uploadedAt: string;
}

export interface AssetValidationResult {
  errors: string[];
  valid: boolean;
}

export interface MockAnalytics {
  trackAssetUpload: MockedFunction<(...args: unknown[]) => void>;
  trackError: MockedFunction<(...args: unknown[]) => void>;
  trackFeatureUsage: MockedFunction<(...args: unknown[]) => void>;
  trackToolUsage: MockedFunction<(...args: unknown[]) => void>;
}

export interface MockAssetStorageService {
  deleteAsset?: MockedFunction<(...args: unknown[]) => Promise<void>>;
  getAssetMetadata?: MockedFunction<
    (...args: unknown[]) => Promise<Record<string, unknown>>
  >;
  listAssets?: MockedFunction<(...args: unknown[]) => Promise<unknown[]>>;
  uploadAsset: MockedFunction<
    (...args: unknown[]) => Promise<AssetUploadResult>
  >;
  validateAsset: MockedFunction<(...args: unknown[]) => AssetValidationResult>;
}

export interface MockAuthService {
  requireSessionAuth: MockedFunction<
    (...args: unknown[]) => { customerId: number; scope3ApiKey: string }
  >;
}

export interface MockLogger {
  debug: MockedFunction<(...args: unknown[]) => void>;
  error: MockedFunction<(...args: unknown[]) => void>;
  info: MockedFunction<(...args: unknown[]) => void>;
  warn: MockedFunction<(...args: unknown[]) => void>;
}

export interface MockMetrics {
  duration: { observe: MockedFunction<(...args: unknown[]) => void> };
  errors: { inc: MockedFunction<(...args: unknown[]) => void> };
  toolCalls: { inc: MockedFunction<(...args: unknown[]) => void> };
  toolDuration: { observe: MockedFunction<(...args: unknown[]) => void> };
  trackError: MockedFunction<(...args: unknown[]) => void>;
  uploadAttempts: { inc: MockedFunction<(...args: unknown[]) => void> };
  uploadDuration: { observe: MockedFunction<(...args: unknown[]) => void> };
}

// ============================================================================
// ASSET STORAGE SERVICE MOCKS
// ============================================================================

export interface MockMonitoringService {
  analytics: MockAnalytics;
  logger: MockLogger;
  metrics: MockMetrics;
  RequestContextService: MockRequestContextService;
}

export interface MockRateLimitMiddleware {
  checkUploadRateLimit: MockedFunction<(...args: unknown[]) => Promise<void>>;
}

export interface MockRequestContext {
  cleanup: MockedFunction<() => void>;
  customerId?: string;
  getMetadata: MockedFunction<() => Record<string, unknown>>;
  requestId: string;
  setMetadata: MockedFunction<(key: string, value: unknown) => void>;
}

export interface MockRequestContextService {
  create: MockedFunction<() => MockRequestContext>;
}

// ============================================================================
// MIDDLEWARE MOCKS
// ============================================================================

export interface MockValidationMiddleware {
  validateUploadRequest: MockedFunction<
    (...args: unknown[]) => Promise<unknown>
  >;
}

/**
 * Creates a complete set of mocks for asset upload tool testing.
 * This is the "one-stop shop" for most asset upload test scenarios.
 */
export function createAssetUploadTestMocks(
  scenario:
    | "auth-failure"
    | "rate-limit"
    | "success"
    | "upload-failure"
    | "validation-failure" = "success",
) {
  const mocks = {
    assetStorage: createMockAssetStorageService(),
    auth: createMockAuthService(),
    bigQuery: createMockBigQuery(),
    monitoring: createMockMonitoringService(),
    rateLimit: createMockRateLimitMiddleware(),
    validation: createMockValidationMiddleware(),
  };

  // Configure mocks based on scenario
  switch (scenario) {
    case "auth-failure":
      mocks.auth = createMockAuthService({ shouldFail: true });
      break;
    case "rate-limit":
      mocks.rateLimit = createMockRateLimitMiddleware({ shouldFail: true });
      break;
    case "upload-failure":
      mocks.assetStorage = createMockAssetStorageService({
        uploadBehavior: "failure",
      });
      break;
    case "validation-failure":
      mocks.validation = createMockValidationMiddleware({ shouldFail: true });
      break;
  }

  return mocks;
}

/**
 * Creates a mock AssetStorageService with realistic default behavior.
 * Supports both success and failure scenarios.
 */
export function createMockAssetStorageService(
  overrides: {
    customUploadFn?: MockedFunction<
      (...args: unknown[]) => Promise<AssetUploadResult>
    >;
    uploadBehavior?: "custom" | "failure" | "success" | "timeout";
    uploadError?: Error;
    uploadResult?: Partial<AssetUploadResult>;
    validationResult?: AssetValidationResult;
  } = {},
): MockAssetStorageService {
  const {
    customUploadFn,
    uploadBehavior = "success",
    uploadError = new Error("Upload failed"),
    uploadResult = {},
    validationResult = { errors: [], valid: true },
  } = overrides;

  // Default upload result
  const defaultUploadResult: AssetUploadResult = {
    assetId: "test-asset-123",
    fileSize: 1024,
    publicUrl:
      "https://storage.googleapis.com/test-bucket/assets/test-asset-123.jpg",
    uploadedAt: "2024-01-01T00:00:00Z",
    ...uploadResult,
  };

  // Create upload function based on behavior
  let uploadAsset: MockedFunction<
    (...args: unknown[]) => Promise<AssetUploadResult>
  >;

  if (customUploadFn) {
    uploadAsset = customUploadFn;
  } else {
    switch (uploadBehavior) {
      case "failure":
        uploadAsset = vi.fn().mockRejectedValue(uploadError);
        break;
      case "success":
        uploadAsset = vi.fn().mockResolvedValue(defaultUploadResult);
        break;
      case "timeout":
        uploadAsset = vi
          .fn()
          .mockImplementation(
            () =>
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Connection timeout")), 100),
              ),
          );
        break;
      default:
        uploadAsset = vi.fn().mockResolvedValue(defaultUploadResult);
    }
  }

  return {
    deleteAsset: vi.fn().mockResolvedValue(undefined),
    getAssetMetadata: vi
      .fn()
      .mockResolvedValue({ id: "test-asset", metadata: {} }),
    listAssets: vi.fn().mockResolvedValue([]),
    uploadAsset,
    validateAsset: vi.fn().mockReturnValue(validationResult),
  };
}

/**
 * Creates auth service mock with realistic session data
 */
export function createMockAuthService(
  overrides: {
    authError?: Error;
    sessionData?: { customerId: number; scope3ApiKey: string };
    shouldFail?: boolean;
  } = {},
): MockAuthService {
  const {
    authError = new Error("Authentication failed"),
    sessionData = { customerId: 123, scope3ApiKey: "test-api-key" },
    shouldFail = false,
  } = overrides;

  return {
    requireSessionAuth: shouldFail
      ? vi.fn().mockImplementation(() => {
          throw authError;
        })
      : vi.fn().mockReturnValue(sessionData),
  };
}

// ============================================================================
// AUTH MOCKS
// ============================================================================

export function createMockBigQuery() {
  return {
    createQueryStream: vi.fn(),
    dataset: vi.fn(() => ({
      table: vi.fn(() => ({
        insert: vi.fn().mockResolvedValue([]),
        query: vi.fn().mockResolvedValue([[]]),
      })),
    })),
    query: vi.fn().mockResolvedValue([[]]),
  };
}

/**
 * Creates a complete monitoring service mock with all required methods.
 * Overrides allow customization for specific test scenarios.
 */
export function createMockMonitoringService(
  overrides: {
    analytics?: Partial<MockAnalytics>;
    logger?: Partial<MockLogger>;
    metrics?: Partial<MockMetrics>;
    requestContext?: Partial<MockRequestContext>;
  } = {},
): MockMonitoringService {
  const defaultRequestContext: MockRequestContext = {
    cleanup: vi.fn(),
    customerId: "test-customer-123",
    getMetadata: vi.fn(() => ({})),
    requestId: "test-request-id",
    setMetadata: vi.fn(),
    ...overrides.requestContext,
  };

  return {
    analytics: {
      trackAssetUpload: vi.fn(),
      trackError: vi.fn(),
      trackFeatureUsage: vi.fn(),
      trackToolUsage: vi.fn(),
      ...overrides.analytics,
    },
    logger: {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      ...overrides.logger,
    },
    metrics: {
      duration: { observe: vi.fn() },
      errors: { inc: vi.fn() },
      toolCalls: { inc: vi.fn() },
      toolDuration: { observe: vi.fn() },
      trackError: vi.fn(),
      uploadAttempts: { inc: vi.fn() },
      uploadDuration: { observe: vi.fn() },
      ...overrides.metrics,
    },
    RequestContextService: {
      create: vi.fn(() => defaultRequestContext),
    },
  };
}

// ============================================================================
// BIGQUERY MOCKS
// ============================================================================

/**
 * Creates rate limit middleware mock that allows by default
 */
export function createMockRateLimitMiddleware(
  overrides: {
    rateLimitError?: Error;
    shouldFail?: boolean;
  } = {},
): MockRateLimitMiddleware {
  const {
    rateLimitError = new Error("Rate limit exceeded"),
    shouldFail = false,
  } = overrides;

  return {
    checkUploadRateLimit: shouldFail
      ? vi.fn().mockRejectedValue(rateLimitError)
      : vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// COMPLETE SERVICE MOCKS - READY TO USE
// ============================================================================

/**
 * Creates validation middleware mock that passes through by default
 */
export function createMockValidationMiddleware(
  overrides: {
    shouldFail?: boolean;
    validationError?: Error;
  } = {},
): MockValidationMiddleware {
  const {
    shouldFail = false,
    validationError = new Error("Validation failed"),
  } = overrides;

  return {
    validateUploadRequest: shouldFail
      ? vi.fn().mockRejectedValue(validationError)
      : vi.fn().mockImplementation(async (args) => args), // Pass through validated args
  };
}
