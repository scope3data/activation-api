import { vi, expect } from "vitest";
import { brandAgentFixtures } from "../fixtures/brand-agent-fixtures.js";
import type {
  BrandAgent,
  BrandAgentInput,
  BrandAgentUpdateInput,
} from "../../types/brand-agent.js";

/**
 * Service-level mocks for Scope3ApiClient
 * Tests the wrapper functions without testing implementation details
 *
 * This approach makes tests resilient to infrastructure changes:
 * - GraphQL → REST API changes
 * - BigQuery → PostgreSQL changes
 * - Authentication method changes
 * - etc.
 */

export interface MockScope3ApiClient {
  listBrandAgents: ReturnType<typeof vi.fn>;
  getBrandAgent: ReturnType<typeof vi.fn>;
  createBrandAgent: ReturnType<typeof vi.fn>;
  updateBrandAgent: ReturnType<typeof vi.fn>;
  deleteBrandAgent: ReturnType<typeof vi.fn>;
}

/**
 * Create a mocked Scope3ApiClient with configurable responses
 */
export function createMockScope3ApiClient(): MockScope3ApiClient {
  return {
    listBrandAgents: vi.fn(),
    getBrandAgent: vi.fn(),
    createBrandAgent: vi.fn(),
    updateBrandAgent: vi.fn(),
    deleteBrandAgent: vi.fn(),
  };
}

/**
 * High-level test scenarios for service-level testing
 * These test the business logic without caring about implementation
 */
export const serviceLevelScenarios = {
  // Successful operations
  successfulList: (mockClient: MockScope3ApiClient) => {
    mockClient.listBrandAgents.mockResolvedValue([
      brandAgentFixtures.enhancedBrandAgent(),
      brandAgentFixtures.graphqlBrandAgent(),
    ]);
  },

  successfulGet: (mockClient: MockScope3ApiClient, agentId: string) => {
    mockClient.getBrandAgent.mockResolvedValue({
      ...brandAgentFixtures.enhancedBrandAgent(),
      id: agentId,
    });
  },

  successfulCreate: (mockClient: MockScope3ApiClient) => {
    mockClient.createBrandAgent.mockResolvedValue({
      ...brandAgentFixtures.enhancedBrandAgent(),
      id: "ba_created_123",
    });
  },

  successfulUpdate: (mockClient: MockScope3ApiClient) => {
    mockClient.updateBrandAgent.mockResolvedValue({
      ...brandAgentFixtures.enhancedBrandAgent(),
      name: "Updated Brand Name",
    });
  },

  successfulDelete: (mockClient: MockScope3ApiClient) => {
    mockClient.deleteBrandAgent.mockResolvedValue(true);
  },

  // Error scenarios
  authenticationError: (mockClient: MockScope3ApiClient) => {
    const authError = new Error("Authentication failed");
    mockClient.listBrandAgents.mockRejectedValue(authError);
    mockClient.getBrandAgent.mockRejectedValue(authError);
    mockClient.createBrandAgent.mockRejectedValue(authError);
    mockClient.updateBrandAgent.mockRejectedValue(authError);
    mockClient.deleteBrandAgent.mockRejectedValue(authError);
  },

  serviceUnavailable: (mockClient: MockScope3ApiClient) => {
    const serviceError = new Error("External service temporarily unavailable");
    mockClient.listBrandAgents.mockRejectedValue(serviceError);
    mockClient.getBrandAgent.mockRejectedValue(serviceError);
    mockClient.createBrandAgent.mockRejectedValue(serviceError);
    mockClient.updateBrandAgent.mockRejectedValue(serviceError);
    mockClient.deleteBrandAgent.mockRejectedValue(serviceError);
  },

  notFound: (mockClient: MockScope3ApiClient) => {
    const notFoundError = new Error("Brand agent not found");
    mockClient.getBrandAgent.mockRejectedValue(notFoundError);
    mockClient.updateBrandAgent.mockRejectedValue(notFoundError);
    mockClient.deleteBrandAgent.mockRejectedValue(notFoundError);
  },

  // Performance scenarios
  slowResponse: (mockClient: MockScope3ApiClient, delayMs: number = 2000) => {
    const slowPromise = new Promise((resolve) =>
      setTimeout(
        () => resolve(brandAgentFixtures.enhancedBrandAgent()),
        delayMs,
      ),
    );
    mockClient.getBrandAgent.mockReturnValue(slowPromise);
  },

  // Partial enhancement scenarios (testing architectural patterns)
  graphqlOnlyData: (mockClient: MockScope3ApiClient) => {
    // Returns data without BigQuery enhancements (simulates BigQuery unavailable)
    mockClient.listBrandAgents.mockResolvedValue([
      brandAgentFixtures.graphqlBrandAgent(),
      {
        ...brandAgentFixtures.graphqlBrandAgent(),
        id: "ba_gql_456",
        name: "Second GQL Brand",
      },
    ]);
  },

  mixedEnhancement: (mockClient: MockScope3ApiClient) => {
    // Returns mix of enhanced and GraphQL-only data
    mockClient.listBrandAgents.mockResolvedValue([
      brandAgentFixtures.enhancedBrandAgent(), // Has BigQuery fields
      brandAgentFixtures.graphqlBrandAgent(), // GraphQL only
    ]);
  },

  enhancementDelay: (mockClient: MockScope3ApiClient) => {
    // Simulates slow BigQuery enhancement
    let callCount = 0;
    mockClient.getBrandAgent.mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        // First call: return GraphQL data quickly
        return brandAgentFixtures.graphqlBrandAgent();
      } else {
        // Subsequent calls: return enhanced data with delay
        await new Promise((resolve) => setTimeout(resolve, 100));
        return brandAgentFixtures.enhancedBrandAgent();
      }
    });
  },
};

/**
 * Utility to assert architectural patterns without testing implementation
 */
export const architecturalAssertions = {
  // Verify that operations succeed even with partial data
  assertGracefulDegradation: (result: BrandAgent[]) => {
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);

    // Should have core GraphQL fields
    result.forEach((agent) => {
      expect(agent.id).toBeDefined();
      expect(agent.name).toBeDefined();
      expect(agent.customerId).toBeDefined();
      // BigQuery fields might or might not be present (graceful degradation)
    });
  },

  // Verify enhanced data has customer-scoped fields
  assertEnhancedData: (result: BrandAgent) => {
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.name).toBeDefined();

    // Should have enhancement fields when fully enhanced
    if (result.externalId || result.nickname) {
      expect(typeof result.externalId).toBe("string");
      expect(typeof result.nickname).toBe("string");
    }
  },

  // Verify response times meet requirements
  assertPerformance: (startTime: number, operation: string, maxMs: number) => {
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(maxMs);
  },

  // Verify error handling
  assertErrorHandling: (error: Error, expectedMessage: string) => {
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain(expectedMessage);
  },
};

/**
 * Factory for creating test data that matches the service contract
 */
export const serviceTestData = {
  validApiKey: "scope3_test_key_valid",
  invalidApiKey: "scope3_test_key_invalid",

  createInput: (): BrandAgentInput => ({
    name: "Test Brand Agent",
    description: "Test description",
    advertiserDomains: ["test.com"],
    externalId: "ext_test_123",
    nickname: "TestBrand",
  }),

  updateInput: (): BrandAgentUpdateInput => ({
    name: "Updated Brand Name",
    description: "Updated description",
    externalId: "ext_updated_123",
    nickname: "UpdatedBrand",
  }),

  filterInput: () => ({
    customerId: { equals: 12345 },
    name: { contains: "Test" },
  }),
};
