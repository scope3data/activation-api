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
  // BigQuery extension row data
  bigQueryExtensionRow: () => ({
    advertiser_domains: ["example.com", "test-brand.com"],
    agent_id: "ba_enhanced_123",
    created_at: new Date("2024-01-01T00:00:00Z"),
    description: "Test brand with BigQuery extensions",
    dsp_seats: ["DV360_12345", "TTD_67890"],
    external_id: "external_123",
    nickname: "TestBrand",
    updated_at: new Date("2024-01-02T00:00:00Z"),
  }),

  // BigQuery joined row (agent + extension)
  bigQueryJoinedRow: () => ({
    advertiser_domains: ["example.com", "test-brand.com"],
    created_at: new Date("2024-01-01T00:00:00Z"),
    customer_id: 12345,
    description: "Test brand with BigQuery extensions",
    dsp_seats: ["DV360_12345", "TTD_67890"],
    external_id: "external_123",
    id: "ba_enhanced_123",
    name: "Enhanced Test Brand",
    nickname: "TestBrand",
    updated_at: new Date("2024-01-02T00:00:00Z"),
  }),

  // Multiple brand agents for list operations
  brandAgentList: (): BrandAgent[] => [
    {
      advertiserDomains: ["brand1.com"],
      createdAt: new Date("2024-01-01T00:00:00Z"),
      customerId: 12345,
      dspSeats: ["DV360_1"],
      externalId: "ext_1",
      id: "ba_list_1",
      name: "List Brand 1",
      nickname: "Brand1",
      updatedAt: new Date("2024-01-01T00:00:00Z"),
    },
    {
      advertiserDomains: ["brand2.com"],
      createdAt: new Date("2024-01-02T00:00:00Z"),
      customerId: 12345,
      description: "Second test brand",
      dspSeats: ["TTD_2"],
      id: "ba_list_2",
      name: "List Brand 2",
      updatedAt: new Date("2024-01-02T00:00:00Z"),
    },
  ],

  // Brand agent input for creation
  createInput: (): BrandAgentInput => ({
    advertiserDomains: ["newbrand.com"],
    customerId: 12345,
    description: "New brand for testing",
    dspSeats: ["DV360_NEW"],
    externalId: "ext_new_123",
    name: "New Test Brand",
    nickname: "NewBrand",
  }),

  // Brand agent input without BigQuery fields
  createInputGraphQLOnly: (): BrandAgentInput => ({
    customerId: 12345,
    name: "GraphQL Only Brand",
  }),

  // Enhanced brand agent (with BigQuery extensions)
  enhancedBrandAgent: (): BrandAgent => ({
    advertiserDomains: ["example.com", "test-brand.com"],
    createdAt: new Date("2024-01-01T00:00:00Z"),
    customerId: 12345,
    description: "Test brand with BigQuery extensions",
    dspSeats: ["DV360_12345", "TTD_67890"],
    externalId: "external_123",
    id: "ba_enhanced_123",
    name: "Enhanced Test Brand",
    nickname: "TestBrand",
    updatedAt: new Date("2024-01-02T00:00:00Z"),
  }),

  // Base GraphQL brand agent (without BigQuery extensions)
  graphqlBrandAgent: (): BrandAgent => ({
    advertiserDomains: [],
    createdAt: new Date("2024-01-01T00:00:00Z"),
    customerId: 12345,
    dspSeats: [],
    id: "ba_graphql_123",
    name: "GraphQL Test Brand",
    updatedAt: new Date("2024-01-01T00:00:00Z"),
  }),

  // Update input with BigQuery fields
  updateInput: (): BrandAgentUpdateInput => ({
    description: "Updated description",
    dspSeats: ["DV360_UPDATED", "TTD_UPDATED"],
    name: "Updated Test Brand",
    nickname: "UpdatedBrand",
  }),

  // Update input GraphQL only
  updateInputGraphQLOnly: (): BrandAgentUpdateInput => ({
    name: "Updated GraphQL Brand",
  }),
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

  // Create multiple brand agents
  createList: (count: number, customerId = 12345): BrandAgent[] =>
    Array.from({ length: count }, (_, index) => ({
      advertiserDomains: [`brand${index + 1}.com`],
      createdAt: new Date(Date.now() - (count - index) * 24 * 60 * 60 * 1000),
      customerId,
      dspSeats: [`DSP_${index + 1}`],
      id: `ba_generated_${index + 1}`,
      name: `Generated Brand ${index + 1}`,
      updatedAt: new Date(Date.now() - (count - index) * 24 * 60 * 60 * 1000),
    })),

  // Create update input with overrides
  updateInput: (
    overrides: Partial<BrandAgentUpdateInput> = {},
  ): BrandAgentUpdateInput => ({
    ...brandAgentFixtures.updateInput(),
    ...overrides,
  }),
};

/**
 * Error scenarios for testing failure cases
 */
export const brandAgentErrors = {
  authenticationError: {
    message: "Authentication failed",
    status: 401,
  },

  bigQueryError: {
    code: 404,
    message: "Table not found",
    name: "BigQueryError",
  },

  graphqlError: {
    locations: [{ column: 1, line: 1 }],
    message: "Invalid request parameters or query",
    path: ["createBrandAgent"],
  },

  validationError: {
    code: "VALIDATION_ERROR",
    message: "Name is required",
  },
};
