import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";

// Mock the BigQuery module before any imports
vi.mock("@google-cloud/bigquery", () => {
  const mockBigQuery = {
    dataset: vi.fn(() => ({
      table: vi.fn(() => ({
        create: vi.fn(),
        get: vi.fn(),
      })),
    })),
    query: vi.fn(),
  };

  return {
    BigQuery: vi.fn(() => mockBigQuery),
  };
});

// Global test configuration for brand agent testing
export const testConfig = {
  graphqlUrl: "https://api.scope3.com/api/graphql",
  testAgentId: "ba_test_123",
  testCustomerId: 12345,
  validApiKey: "scope3_test_key_123",
};

// MSW server for GraphQL mocking
export const server = setupServer();

// Global test setup
beforeAll(() => {
  // Start MSW server
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  server.resetHandlers();
});

afterEach(() => {
  // Clean up any test state
  server.resetHandlers();
});

afterAll(() => {
  // Clean up after all tests
  server.close();
});

// Mock BigQuery client globally
vi.mock("@google-cloud/bigquery", () => {
  const mockQuery = vi.fn();
  const mockDataset = vi.fn(() => ({
    table: vi.fn(() => ({
      query: mockQuery,
    })),
  }));

  const MockBigQuery = vi.fn(() => ({
    dataset: mockDataset,
    query: mockQuery,
  }));

  return {
    BigQuery: MockBigQuery,
    mockDataset,
    mockQuery, // Export for test access
  };
});

// Utility function to create mock BigQuery rows
export function createBigQueryRows(rows: Array<Record<string, unknown>>) {
  return [rows]; // BigQuery returns [rows, metadata]
}

// Utility function to create mock GraphQL responses
export function createGraphQLResponse<T>(
  data: T,
  errors?: Array<{ message: string }>,
) {
  return {
    data: errors ? null : data,
    errors,
  };
}
