/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
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

// Track active timers for cleanup
const activeTimers = new Set<NodeJS.Timeout>();
const originalSetTimeout = global.setTimeout;
const originalSetInterval = global.setInterval;
const originalClearTimeout = global.clearTimeout;
const originalClearInterval = global.clearInterval;

// Global test setup
beforeAll(() => {
  console.log('🧪 Setting up global test environment');
  
  // Increase max listeners for test environment to handle multiple cache instances
  process.setMaxListeners(100);
  
  // Mock process event listeners to prevent MaxListenersExceededWarning
  if (process.env.VITEST_DISABLE_PROCESS_LISTENERS === 'true') {
    vi.spyOn(process, 'on').mockImplementation(() => process);
    vi.spyOn(process, 'off').mockImplementation(() => process);
    vi.spyOn(process, 'removeListener').mockImplementation(() => process);
  }
  
  // Override timers to track them for cleanup
  global.setTimeout = vi.fn((callback: (...args: any[]) => void, delay?: number) => {
    const timer = originalSetTimeout(callback, delay);
    activeTimers.add(timer);
    return timer;
  }) as any;
  
  global.setInterval = vi.fn((callback: (...args: any[]) => void, delay?: number) => {
    const timer = originalSetInterval(callback, delay);
    activeTimers.add(timer);
    return timer;
  }) as any;
  
  global.clearTimeout = vi.fn((timer: NodeJS.Timeout) => {
    activeTimers.delete(timer);
    return originalClearTimeout(timer);
  });
  
  global.clearInterval = vi.fn((timer: NodeJS.Timeout) => {
    activeTimers.delete(timer);
    return originalClearInterval(timer);
  });
  
  // Start MSW server
  server.listen({ onUnhandledRequest: "error" });
});

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();
  vi.clearAllTimers();
  server.resetHandlers();
  
  // Clear timer tracking
  activeTimers.clear();
});

afterEach(() => {
  // Clean up any test state
  server.resetHandlers();
  
  // Force cleanup of any remaining timers
  for (const timer of activeTimers) {
    try {
      clearTimeout(timer);
      clearInterval(timer);
    } catch {
      // Ignore cleanup errors
    }
  }
  activeTimers.clear();
  
  vi.clearAllMocks();
  vi.clearAllTimers();
});

afterAll(() => {
  console.log('🧹 Cleaning up global test environment');
  
  // Clean up after all tests
  server.close();
  
  // Restore original timer functions
  global.setTimeout = originalSetTimeout;
  global.setInterval = originalSetInterval;
  global.clearTimeout = originalClearTimeout;
  global.clearInterval = originalClearInterval;
  
  // Final cleanup of any remaining timers
  for (const timer of activeTimers) {
    try {
      clearTimeout(timer);
      clearInterval(timer);
    } catch {
      // Ignore cleanup errors
    }
  }
  activeTimers.clear();
  
  // Reset max listeners
  process.setMaxListeners(10);
  
  console.log('✅ Global test cleanup complete');
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
