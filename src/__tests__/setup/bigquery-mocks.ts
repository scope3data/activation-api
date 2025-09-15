import { vi } from "vitest";
import { createBigQueryRows } from "./test-setup.js";
import {
  brandAgentFixtures,
  brandAgentErrors,
} from "../fixtures/brand-agent-fixtures.js";

/**
 * BigQuery mock utilities for testing the enhancement layer
 * Provides realistic BigQuery service mocking with proper error simulation
 */

// Import the mocked BigQuery instance
import { BigQuery } from "@google-cloud/bigquery";

// Get the mocked BigQuery methods
const mockBigQueryInstance = new BigQuery();
export const mockBigQueryMethods = {
  query: mockBigQueryInstance.query,
  dataset: mockBigQueryInstance.dataset,
  table: vi.fn(),
};

/**
 * BigQuery mock response builders
 */
export const bigQueryMockResponses = {
  // Single brand agent with extensions
  singleAgent: () =>
    createBigQueryRows([brandAgentFixtures.bigQueryJoinedRow()]),

  // Multiple brand agents
  multipleAgents: () =>
    createBigQueryRows([
      brandAgentFixtures.bigQueryJoinedRow(),
      {
        ...brandAgentFixtures.bigQueryJoinedRow(),
        id: "ba_enhanced_456",
        name: "Second Enhanced Brand",
        external_id: "external_456",
        nickname: "SecondBrand",
      },
    ]),

  // Agent without extensions (GraphQL-only data)
  agentWithoutExtensions: () =>
    createBigQueryRows([
      {
        id: "ba_graphql_only",
        name: "GraphQL Only Brand",
        customer_id: 12345,
        advertiser_domains: null,
        dsp_seats: null,
        description: null,
        external_id: null,
        nickname: null,
        created_at: new Date("2024-01-01T00:00:00Z"),
        updated_at: new Date("2024-01-01T00:00:00Z"),
      },
    ]),

  // Empty result set
  empty: () => createBigQueryRows([]),

  // Large result set for performance testing
  largeResultSet: (count = 50) =>
    createBigQueryRows(
      Array.from({ length: count }, (_, index) => ({
        ...brandAgentFixtures.bigQueryJoinedRow(),
        id: `ba_perf_${index}`,
        name: `Performance Brand ${index}`,
        external_id: `perf_${index}`,
      })),
    ),
};

/**
 * BigQuery error simulations
 */
export const bigQueryErrorResponses = {
  // Table not found
  tableNotFound: () => {
    const error = new Error("Table not found");
    Object.assign(error, { code: 404, name: "BigQueryError" });
    throw error;
  },

  // Authentication failure
  authenticationFailed: () => {
    const error = new Error("Authentication failed");
    Object.assign(error, { code: 401, name: "BigQueryError" });
    throw error;
  },

  // Query timeout
  queryTimeout: () => {
    const error = new Error("Query timeout");
    Object.assign(error, { code: 408, name: "BigQueryError" });
    throw error;
  },

  // Rate limit exceeded
  rateLimitExceeded: () => {
    const error = new Error("Rate limit exceeded");
    Object.assign(error, { code: 429, name: "BigQueryError" });
    throw error;
  },

  // Quota exceeded
  quotaExceeded: () => {
    const error = new Error("Quota exceeded");
    Object.assign(error, { code: 403, name: "BigQueryError" });
    throw error;
  },

  // Network error
  networkError: () => {
    const error = new Error("Network connection failed");
    Object.assign(error, { code: "ECONNREFUSED", name: "NetworkError" });
    throw error;
  },

  // Invalid query syntax
  invalidQuery: () => {
    const error = new Error("Invalid query syntax");
    Object.assign(error, { code: 400, name: "BigQueryError" });
    throw error;
  },
};

/**
 * BigQuery mock setup utilities
 */
export const setupBigQueryMocks = {
  // Setup successful query responses
  withSuccessfulQuery: (response: ReturnType<typeof createBigQueryRows>) => {
    mockBigQueryMethods.query.mockResolvedValueOnce(response);
  },

  // Setup query error
  withQueryError: (errorType: keyof typeof bigQueryErrorResponses) => {
    mockBigQueryMethods.query.mockImplementationOnce(() => {
      return bigQueryErrorResponses[errorType]();
    });
  },

  // Setup delayed response for timeout testing
  withDelayedQuery: (
    response: ReturnType<typeof createBigQueryRows>,
    delayMs: number,
  ) => {
    mockBigQueryMethods.query.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(response), delayMs);
        }),
    );
  },

  // Setup intermittent failures (succeeds after N failures)
  withIntermittentFailure: (
    response: ReturnType<typeof createBigQueryRows>,
    failureCount: number,
    errorType: keyof typeof bigQueryErrorResponses = "networkError",
  ) => {
    let callCount = 0;
    mockBigQueryMethods.query.mockImplementation(() => {
      callCount++;
      if (callCount <= failureCount) {
        return bigQueryErrorResponses[errorType]();
      }
      return Promise.resolve(response);
    });
  },

  // Setup partial results (simulates BigQuery cursor/paging)
  withPartialResults: (
    results: Array<ReturnType<typeof createBigQueryRows>>,
  ) => {
    results.forEach((result, index) => {
      mockBigQueryMethods.query.mockResolvedValueOnce(result);
    });
  },

  // Reset all mocks
  reset: () => {
    Object.values(mockBigQueryMethods).forEach((mock) => mock.mockReset());
  },

  // Clear all mocks
  clear: () => {
    Object.values(mockBigQueryMethods).forEach((mock) => mock.mockClear());
  },
};

/**
 * Specific test scenario setups
 */
export const bigQueryTestScenarios = {
  // Brand agent exists in both GraphQL and BigQuery
  fullyEnhanced: () => {
    setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.singleAgent());
  },

  // Brand agent exists in GraphQL only (no BigQuery extension)
  graphqlOnly: () => {
    setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());
  },

  // BigQuery unavailable (should not fail the operation)
  bigQueryUnavailable: () => {
    setupBigQueryMocks.withQueryError("networkError");
  },

  // BigQuery slow response (performance testing)
  slowBigQuery: (delayMs = 2000) => {
    setupBigQueryMocks.withDelayedQuery(
      bigQueryMockResponses.singleAgent(),
      delayMs,
    );
  },

  // BigQuery authentication issues
  bigQueryAuthFailure: () => {
    setupBigQueryMocks.withQueryError("authenticationFailed");
  },

  // List scenario with mixed enhancement states
  mixedEnhancementList: () => {
    // First agent: fully enhanced
    setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.singleAgent());
    // Second agent: GraphQL only
    setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());
    // Third agent: BigQuery error (should not fail)
    setupBigQueryMocks.withQueryError("networkError");
  },

  // Performance testing with large datasets
  largeDataset: (agentCount = 10, enhancementRate = 0.7) => {
    for (let i = 0; i < agentCount; i++) {
      if (Math.random() < enhancementRate) {
        setupBigQueryMocks.withSuccessfulQuery(
          createBigQueryRows([
            {
              ...brandAgentFixtures.bigQueryJoinedRow(),
              id: `ba_perf_${i}`,
              name: `Performance Brand ${i}`,
            },
          ]),
        );
      } else {
        setupBigQueryMocks.withSuccessfulQuery(bigQueryMockResponses.empty());
      }
    }
  },
};

/**
 * Assertion helpers for BigQuery interactions
 */
export const bigQueryAssertions = {
  // Verify query was called with specific parameters
  expectQueryCalled: (
    expectedQuery: string,
    expectedParams?: Record<string, unknown>,
  ) => {
    expect(mockBigQueryMethods.query).toHaveBeenCalledWith(
      expect.stringContaining(expectedQuery),
      expectedParams
        ? expect.objectContaining(expectedParams)
        : expect.any(Object),
    );
  },

  // Verify query was not called (for error scenarios)
  expectQueryNotCalled: () => {
    expect(mockBigQueryMethods.query).not.toHaveBeenCalled();
  },

  // Verify query call count
  expectQueryCallCount: (count: number) => {
    expect(mockBigQueryMethods.query).toHaveBeenCalledTimes(count);
  },

  // Verify specific table was queried
  expectTableQueried: (tableName: string) => {
    const calls = mockBigQueryMethods.query.mock.calls;
    const hasTableReference = calls.some((call) =>
      call[0]?.includes(tableName),
    );
    expect(hasTableReference).toBe(true);
  },
};
