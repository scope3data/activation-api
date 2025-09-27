/**
 * Test Helpers for Easy Mock Setup and Cleanup
 *
 * These utilities make it simple to set up consistent test environments
 * without the complexity of manual vi.mock() calls.
 */

import { afterEach, beforeEach, vi } from "vitest";

import {
  createMockAssetStorageService,
  createMockAuthService,
  createMockBigQuery,
  createMockMonitoringService,
  createMockRateLimitMiddleware,
  createMockValidationMiddleware,
  type MockAssetStorageService,
  type MockMonitoringService,
} from "./mock-factories.js";

// ============================================================================
// MOCK SETUP UTILITIES
// ============================================================================

export interface TestEnvironment {
  assetStorage: MockAssetStorageService;
  cleanup: () => void;
  monitoring: MockMonitoringService;
}

/**
 * Asserts that asset storage was called correctly
 */
export function assertAssetStorageCalled(
  assetStorage: MockAssetStorageService,
  expectations: {
    upload?: boolean;
    uploadCallCount?: number;
    validate?: boolean;
  } = {},
) {
  const { upload, uploadCallCount, validate } = expectations;

  if (validate) {
    expect(assetStorage.validateAsset).toHaveBeenCalled();
  }
  if (upload) {
    expect(assetStorage.uploadAsset).toHaveBeenCalled();
  }
  if (uploadCallCount !== undefined) {
    expect(assetStorage.uploadAsset).toHaveBeenCalledTimes(uploadCallCount);
  }
}

/**
 * Asserts that monitoring calls were made correctly
 */
export function assertMonitoringCalled(
  monitoring: MockMonitoringService,
  expectations: {
    assetUpload?: boolean;
    error?: boolean;
    metricsInc?: boolean;
    metricsObserve?: boolean;
    toolUsage?: boolean;
  } = {},
) {
  const { assetUpload, error, metricsInc, metricsObserve, toolUsage } =
    expectations;

  if (toolUsage) {
    expect(monitoring.analytics.trackToolUsage).toHaveBeenCalled();
  }
  if (error) {
    expect(monitoring.analytics.trackError).toHaveBeenCalled();
  }
  if (assetUpload) {
    expect(monitoring.analytics.trackAssetUpload).toHaveBeenCalled();
  }
  if (metricsInc) {
    expect(monitoring.metrics.errors.inc).toHaveBeenCalled();
  }
  if (metricsObserve) {
    expect(monitoring.metrics.duration.observe).toHaveBeenCalled();
  }
}

// ============================================================================
// TEST DATA FACTORIES
// ============================================================================

/**
 * Helper for testing circuit breaker behavior
 */
export function createCircuitBreakerTestHelper() {
  return {
    assertCircuitBreakerClosed(circuitBreaker: {
      getState: () => { state: string };
    }) {
      expect(circuitBreaker.getState().state).toBe("closed");
    },

    assertCircuitBreakerOpen(circuitBreaker: {
      getState: () => { state: string };
    }) {
      expect(circuitBreaker.getState().state).toBe("open");
    },

    async triggerFailures(
      toolExecutor: () => Promise<unknown>,
      count: number = 6,
    ) {
      const failures = [];
      for (let i = 0; i < count; i++) {
        try {
          await toolExecutor();
        } catch (error) {
          failures.push(error);
        }
      }
      return failures;
    },
  };
}

export function createMockContext(overrides: Record<string, unknown> = {}) {
  return {
    session: {
      customerId: 123,
      scope3ApiKey: "test-api-key",
    },
    ...overrides,
  };
}

// ============================================================================
// ASSERTION HELPERS
// ============================================================================

export function createValidAsset(overrides: Record<string, unknown> = {}) {
  return {
    assetType: "image" as const,
    base64Data: Buffer.from("test image data").toString("base64"),
    contentType: "image/png",
    filename: "test.png",
    metadata: {
      buyerAgentId: "agent-123",
    },
    ...overrides,
  };
}

/**
 * Runs a tool execution with error handling and assertions
 */
export async function executeToolSafely<T>(
  toolFn: () => Promise<T>,
  expectations: {
    errorMessage?: RegExp | string;
    shouldSucceed?: boolean;
  } = {},
): Promise<{ error?: Error; result?: T }> {
  const { errorMessage, shouldSucceed = true } = expectations;

  try {
    const result = await toolFn();

    if (!shouldSucceed) {
      throw new Error(
        `Expected tool to fail, but it succeeded with: ${result}`,
      );
    }

    return { result };
  } catch (error) {
    if (shouldSucceed) {
      throw new Error(`Expected tool to succeed, but it failed with: ${error}`);
    }

    if (errorMessage && error instanceof Error) {
      if (typeof errorMessage === "string") {
        expect(error.message).toContain(errorMessage);
      } else {
        expect(error.message).toMatch(errorMessage);
      }
    }

    return { error: error as Error };
  }
}

// ============================================================================
// INTEGRATION TEST HELPERS
// ============================================================================

/**
 * Sets up a complete test environment with all necessary mocks.
 * Returns cleanup function to restore original modules.
 */
export async function setupTestEnvironment(
  options: {
    customMocks?: {
      assetStorage?: Partial<MockAssetStorageService>;
      monitoring?: Partial<MockMonitoringService>;
    };
    scenario?:
      | "auth-failure"
      | "success"
      | "upload-failure"
      | "validation-failure";
  } = {},
): Promise<TestEnvironment> {
  const { customMocks = {}, scenario = "success" } = options;

  // Create base mocks
  const monitoring = createMockMonitoringService(customMocks.monitoring);
  let assetStorage: MockAssetStorageService;

  // Configure based on scenario
  switch (scenario) {
    case "upload-failure":
      assetStorage = createMockAssetStorageService({
        uploadBehavior: "failure",
      });
      break;
    case "validation-failure":
      assetStorage = createMockAssetStorageService();
      break;
    default:
      assetStorage = createMockAssetStorageService();
  }

  // Set up module mocks
  vi.doMock("../../services/monitoring-service.js", () => monitoring);
  vi.doMock("../../services/asset-storage-service.js", () => ({
    AssetStorageService: vi.fn().mockImplementation(() => assetStorage),
  }));

  // Mock validation middleware
  const validation = createMockValidationMiddleware({
    shouldFail: scenario === "validation-failure",
  });
  vi.doMock("../../middleware/validation-middleware.js", () => validation);

  // Mock rate limit middleware
  const rateLimit = createMockRateLimitMiddleware();
  vi.doMock("../../middleware/rate-limit-middleware.js", () => rateLimit);

  // Mock auth
  const auth = createMockAuthService({
    shouldFail: scenario === "auth-failure",
  });
  vi.doMock("../../utils/auth.js", () => auth);

  // Mock BigQuery
  const bigQuery = createMockBigQuery();
  vi.doMock("@google-cloud/bigquery", () => ({
    BigQuery: vi.fn().mockImplementation(() => bigQuery),
  }));

  return {
    assetStorage,
    cleanup: () => {
      vi.doUnmock("../../services/monitoring-service.js");
      vi.doUnmock("../../services/asset-storage-service.js");
      vi.doUnmock("../../middleware/validation-middleware.js");
      vi.doUnmock("../../middleware/rate-limit-middleware.js");
      vi.doUnmock("../../utils/auth.js");
      vi.doUnmock("@google-cloud/bigquery");
    },
    monitoring,
  };
}

// ============================================================================
// CIRCUIT BREAKER TEST HELPERS
// ============================================================================

/**
 * Helper for testing concurrent operations
 */
export async function testConcurrentExecution<T>(
  operations: (() => Promise<T>)[],
  expectations: {
    allShouldSucceed?: boolean;
    maxDuration?: number;
  } = {},
) {
  const { allShouldSucceed = true, maxDuration } = expectations;

  const startTime = Date.now();
  const results = await Promise.allSettled(operations.map((op) => op()));
  const duration = Date.now() - startTime;

  if (maxDuration && duration > maxDuration) {
    throw new Error(
      `Concurrent execution took ${duration}ms, expected < ${maxDuration}ms`,
    );
  }

  if (allShouldSucceed) {
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length > 0) {
      throw new Error(
        `Expected all operations to succeed, but ${failures.length} failed`,
      );
    }
  }

  return {
    duration,
    failureCount: results.filter((r) => r.status === "rejected").length,
    results,
    successCount: results.filter((r) => r.status === "fulfilled").length,
  };
}

// ============================================================================
// PERFORMANCE TEST HELPERS
// ============================================================================

/**
 * Standard beforeEach/afterEach setup for most tests
 */
export function useStandardTestSetup() {
  let testEnv: TestEnvironment;

  beforeEach(async () => {
    vi.clearAllMocks();
    testEnv = await setupTestEnvironment();
  });

  afterEach(() => {
    testEnv?.cleanup();
    vi.clearAllMocks();
  });

  return () => testEnv;
}
