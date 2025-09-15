import type {
  BrandAgent,
  BrandAgentInput,
  BrandAgentUpdateInput,
} from "../../types/brand-agent.js";

/**
 * Test data factories for brand agent testing
 * Provides consistent, realistic test data across all test suites
 */

export const brandAgentFixtures = {
  // Base GraphQL brand agent (without BigQuery extensions)
  graphqlBrandAgent: (): BrandAgent => ({
    id: "ba_graphql_123",
    name: "GraphQL Test Brand",
    customerId: 12345,
    advertiserDomains: [],
    dspSeats: [],
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  }),

  // Enhanced brand agent (with BigQuery extensions)
  enhancedBrandAgent: (): BrandAgent => ({
    id: "ba_enhanced_123",
    name: "Enhanced Test Brand",
    customerId: 12345,
    advertiserDomains: ["example.com", "test-brand.com"],
    dspSeats: ["DV360_12345", "TTD_67890"],
    description: "Test brand with BigQuery extensions",
    externalId: "external_123",
    nickname: "TestBrand",
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-02T00:00:00Z"),
  }),

  // Brand agent input for creation
  createInput: (): BrandAgentInput => ({
    name: "New Test Brand",
    customerId: 12345,
    advertiserDomains: ["newbrand.com"],
    dspSeats: ["DV360_NEW"],
    description: "New brand for testing",
    externalId: "ext_new_123",
    nickname: "NewBrand",
  }),

  // Brand agent input without BigQuery fields
  createInputGraphQLOnly: (): BrandAgentInput => ({
    name: "GraphQL Only Brand",
    customerId: 12345,
  }),

  // Update input with BigQuery fields
  updateInput: (): BrandAgentUpdateInput => ({
    name: "Updated Test Brand",
    description: "Updated description",
    nickname: "UpdatedBrand",
    dspSeats: ["DV360_UPDATED", "TTD_UPDATED"],
  }),

  // Update input GraphQL only
  updateInputGraphQLOnly: (): BrandAgentUpdateInput => ({
    name: "Updated GraphQL Brand",
  }),

  // BigQuery extension row data
  bigQueryExtensionRow: () => ({
    agent_id: "ba_enhanced_123",
    advertiser_domains: ["example.com", "test-brand.com"],
    dsp_seats: ["DV360_12345", "TTD_67890"],
    description: "Test brand with BigQuery extensions",
    external_id: "external_123",
    nickname: "TestBrand",
    created_at: new Date("2024-01-01T00:00:00Z"),
    updated_at: new Date("2024-01-02T00:00:00Z"),
  }),

  // BigQuery joined row (agent + extension)
  bigQueryJoinedRow: () => ({
    id: "ba_enhanced_123",
    name: "Enhanced Test Brand",
    customer_id: 12345,
    advertiser_domains: ["example.com", "test-brand.com"],
    dsp_seats: ["DV360_12345", "TTD_67890"],
    description: "Test brand with BigQuery extensions",
    external_id: "external_123",
    nickname: "TestBrand",
    created_at: new Date("2024-01-01T00:00:00Z"),
    updated_at: new Date("2024-01-02T00:00:00Z"),
  }),

  // Multiple brand agents for list operations
  brandAgentList: (): BrandAgent[] => [
    {
      id: "ba_list_1",
      name: "List Brand 1",
      customerId: 12345,
      advertiserDomains: ["brand1.com"],
      dspSeats: ["DV360_1"],
      externalId: "ext_1",
      nickname: "Brand1",
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      id: "ba_list_2",
      name: "List Brand 2",
      customerId: 12345,
      advertiserDomains: ["brand2.com"],
      dspSeats: ["TTD_2"],
      description: "Second test brand",
      createdAt: new Date("2024-01-02T00:00:00Z"),
      updatedAt: new Date("2024-01-02T00:00:00Z"),
    },
  ],
};

/**
 * Factory functions for creating variations of test data
 */
export const brandAgentFactory = {
  // Create brand agent with overrides
  create: (overrides: Partial<BrandAgent> = {}): BrandAgent => ({
    ...brandAgentFixtures.enhancedBrandAgent(),
    ...overrides,
  }),

  // Create brand agent input with overrides
  createInput: (overrides: Partial<BrandAgentInput> = {}): BrandAgentInput => ({
    ...brandAgentFixtures.createInput(),
    ...overrides,
  }),

  // Create update input with overrides
  updateInput: (
    overrides: Partial<BrandAgentUpdateInput> = {},
  ): BrandAgentUpdateInput => ({
    ...brandAgentFixtures.updateInput(),
    ...overrides,
  }),

  // Create multiple brand agents
  createList: (count: number, customerId = 12345): BrandAgent[] =>
    Array.from({ length: count }, (_, index) => ({
      id: `ba_generated_${index + 1}`,
      name: `Generated Brand ${index + 1}`,
      customerId,
      advertiserDomains: [`brand${index + 1}.com`],
      dspSeats: [`DSP_${index + 1}`],
      createdAt: new Date(Date.now() - (count - index) * 24 * 60 * 60 * 1000),
      updatedAt: new Date(Date.now() - (count - index) * 24 * 60 * 60 * 1000),
    })),
};

/**
 * Error scenarios for testing failure cases
 */
export const brandAgentErrors = {
  graphqlError: {
    message: "Invalid request parameters or query",
    locations: [{ line: 1, column: 1 }],
    path: ["createBrandAgent"],
  },

  bigQueryError: {
    name: "BigQueryError",
    message: "Table not found",
    code: 404,
  },

  authenticationError: {
    message: "Authentication failed",
    status: 401,
  },

  validationError: {
    message: "Name is required",
    code: "VALIDATION_ERROR",
  },
};
