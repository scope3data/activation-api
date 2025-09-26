import { beforeEach, describe, expect, it } from "vitest";

import { brandAgentFixtures } from "../../../__tests__/fixtures/brand-agent-fixtures.js";
import {
  createMockScope3ApiClient,
  serviceLevelScenarios,
  serviceTestData,
} from "../../../__tests__/setup/service-level-mocks.js";
import {
  BrandAgentValidators,
  expectLegacyCompatibleResponse,
} from "../../../__tests__/utils/structured-response-helpers.js";
import { createBrandAgentTool } from "./create.js";

/**
 * Tool-Level Tests for brand-agent/create
 *
 * Tests the complete MCP tool execution for brand agent creation including:
 * - Parameter validation and Zod schema enforcement
 * - Structured response format with created object
 * - Human-readable creation confirmations
 * - Error handling for creation failures
 */

describe("brand-agent/create Tool", () => {
  let mockClient: ReturnType<typeof createMockScope3ApiClient>;
  let tool: ReturnType<typeof createBrandAgentTool>;

  beforeEach(() => {
    mockClient = createMockScope3ApiClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tool = createBrandAgentTool(mockClient as unknown as any);
    process.env.SCOPE3_API_KEY = serviceTestData.validApiKey;
  });

  describe("Tool Configuration", () => {
    it("should have correct tool metadata", () => {
      expect(tool.name).toBe("brand_agent_create");
      expect(tool.description).toContain("Create a new brand agent");
      expect(tool.annotations.category).toBe("Brand Agents");
      expect(tool.annotations.dangerLevel).toBe("low");
      expect(tool.annotations.readOnlyHint).toBe(false);
    });

    it("should require name parameter", () => {
      // Brand agent create requires both name and advertiserDomains
      const result = tool.parameters.safeParse({});
      expect(result.success).toBe(false);

      const resultWithName = tool.parameters.safeParse({
        advertiserDomains: ["test.com"],
        name: "Test Brand",
      });
      expect(resultWithName.success).toBe(true);
    });

    it("should validate optional parameters correctly", () => {
      const validInput = {
        advertiserDomains: ["test.com", "example.com"],
        description: "Test description",
        externalId: "ext_123",
        name: "Test Brand",
        nickname: "TestBrand",
      };

      const result = tool.parameters.safeParse(validInput);
      expect(result.success).toBe(true);
    });
  });

  describe("Successful Creation", () => {
    it("should return structured response with created brand agent", async () => {
      const mockCreated = {
        ...brandAgentFixtures.enhancedBrandAgent(),
        id: "ba_created_new",
        name: "New Test Brand",
      };
      mockClient.createBrandAgent.mockResolvedValue(mockCreated);

      const input = brandAgentFixtures.createInput();
      const result = await tool.execute(input, {
        session: { customerId: 123, scope3ApiKey: "test-api-key" },
      });

      // Validate structured response format
      const response = BrandAgentValidators.validateCreateResponse(result);

      // Verify success message
      expect(response.message).toContain("Brand Agent Created Successfully");
      expect(response.message).toContain("New Test Brand");
      expect(response.message).toContain("ba_created_new");

      // Verify structured data contains created object - check key fields (dates get serialized)
      expect(response.data).toBeDefined();
      expect(response.data!.brandAgent.id).toBe(mockCreated.id);
      expect(response.data!.brandAgent.name).toBe(mockCreated.name);
      expect(response.data!.brandAgent.customerId).toBe(mockCreated.customerId);

      // Verify client was called correctly
      expect(mockClient.createBrandAgent).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        input,
      );
    });

    it("should handle minimal input correctly", async () => {
      const mockCreated = brandAgentFixtures.graphqlBrandAgent();
      mockClient.createBrandAgent.mockResolvedValue(mockCreated);

      const minimalInput = {
        advertiserDomains: ["minimal.com"],
        name: "Minimal Brand",
      };
      const result = await tool.execute(minimalInput, {
        session: { customerId: 123, scope3ApiKey: "test-api-key" },
      });

      const response = BrandAgentValidators.validateCreateResponse(result);

      expect(response.message).toContain("Brand Agent Created Successfully");
      expect(response.data).toBeDefined();
      expect(response.data!.brandAgent.id).toBe(mockCreated.id);
      expect(response.data!.brandAgent.name).toBe(mockCreated.name);
      expect(mockClient.createBrandAgent).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        minimalInput,
      );
    });

    it("should include creation details in human-readable message", async () => {
      const mockCreated = {
        ...brandAgentFixtures.enhancedBrandAgent(),
        customerId: 98765,
        description: "Comprehensive brand description",
        id: "ba_detailed_123",
        name: "Detailed Brand",
      };
      mockClient.createBrandAgent.mockResolvedValue(mockCreated);

      const result = await tool.execute(brandAgentFixtures.createInput(), {
        session: { customerId: 123, scope3ApiKey: "test-api-key" },
      });
      const response = expectLegacyCompatibleResponse(result);

      // Should include key creation details
      expect(response.message).toContain("Detailed Brand");
      expect(response.message).toContain("ba_detailed_123");
      expect(response.message).toContain("Customer ID: 98765");
      expect(response.message).toContain("What's Next");
    });

    it("should provide helpful next steps in message", async () => {
      mockClient.createBrandAgent.mockResolvedValue(
        brandAgentFixtures.enhancedBrandAgent(),
      );

      const result = await tool.execute(brandAgentFixtures.createInput(), {
        session: { customerId: 123, scope3ApiKey: "test-api-key" },
      });
      const response = expectLegacyCompatibleResponse(result);

      // Should suggest what to do next
      expect(response.message).toContain("Create campaigns");
      expect(response.message).toContain("Add creatives");
      expect(response.message).toContain("synthetic audiences");
    });
  });

  describe("Parameter Validation", () => {
    it("should validate advertiserDomains as array of strings", () => {
      const invalidDomains = tool.parameters.safeParse({
        advertiserDomains: ["valid.com", 123, "another.com"], // Invalid: contains number
        name: "Test",
      });
      expect(invalidDomains.success).toBe(false);

      const validDomains = tool.parameters.safeParse({
        advertiserDomains: ["valid.com", "another.com"],
        name: "Test",
      });
      expect(validDomains.success).toBe(true);
    });

    it("should require string values for text fields", () => {
      const invalidTypes = tool.parameters.safeParse({
        advertiserDomains: ["test.com"],
        description: true, // Invalid: not a string
        name: 123, // Invalid: not a string
      });
      expect(invalidTypes.success).toBe(false);

      const validTypes = tool.parameters.safeParse({
        advertiserDomains: ["test.com"],
        description: "Valid description",
        name: "Valid Name",
      });
      expect(validTypes.success).toBe(true);
    });

    it("should handle empty optional fields", () => {
      const result = tool.parameters.safeParse({
        advertiserDomains: ["test.com"], // Required field
        description: "", // Empty string should be fine
        name: "Test Brand",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors", async () => {
      delete process.env.SCOPE3_API_KEY;

      await expect(
        tool.execute(brandAgentFixtures.createInput(), {
          session: { customerId: 123, scope3ApiKey: "test-api-key" },
        }),
      ).rejects.toThrow(
        "Authentication required. Please provide valid API key in headers (x-scope3-api-key or Authorization: Bearer).",
      );
    });

    it("should handle validation errors from API", async () => {
      const validationError = new Error("Invalid request parameters or query");
      mockClient.createBrandAgent.mockRejectedValue(validationError);

      await expect(
        tool.execute(brandAgentFixtures.createInput(), {
          session: { customerId: 123, scope3ApiKey: "test-api-key" },
        }),
      ).rejects.toThrow(
        "Failed to create brand agent: Invalid request parameters or query",
      );
    });

    it("should handle service unavailable errors", async () => {
      serviceLevelScenarios.serviceUnavailable(mockClient);

      await expect(
        tool.execute(brandAgentFixtures.createInput(), {
          session: { customerId: 123, scope3ApiKey: "test-api-key" },
        }),
      ).rejects.toThrow(
        "Failed to create brand agent: External service temporarily unavailable",
      );
    });

    it("should handle network errors gracefully", async () => {
      const networkError = new Error("Network timeout");
      mockClient.createBrandAgent.mockRejectedValue(networkError);

      await expect(
        tool.execute(brandAgentFixtures.createInput(), {
          session: { customerId: 123, scope3ApiKey: "test-api-key" },
        }),
      ).rejects.toThrow("Failed to create brand agent: Network timeout");
    });
  });

  describe("Authentication Context", () => {
    it("should prioritize session API key", async () => {
      serviceLevelScenarios.successfulCreate(mockClient);
      const context = {
        session: { customerId: 123, scope3ApiKey: "session_key_create" },
      };

      await tool.execute(brandAgentFixtures.createInput(), context);

      expect(mockClient.createBrandAgent).toHaveBeenCalledWith(
        "session_key_create",
        expect.any(Object),
      );
    });

    it("should use session API key when provided", async () => {
      serviceLevelScenarios.successfulCreate(mockClient);

      await tool.execute(brandAgentFixtures.createInput(), {
        session: { customerId: 123, scope3ApiKey: "test-api-key" },
      });

      expect(mockClient.createBrandAgent).toHaveBeenCalledWith(
        "test-api-key",
        expect.any(Object),
      );
    });
  });

  describe("Response Format Validation", () => {
    beforeEach(() => {
      serviceLevelScenarios.successfulCreate(mockClient);
    });

    it("should return valid JSON", async () => {
      const result = await tool.execute(brandAgentFixtures.createInput(), {
        session: { customerId: 123, scope3ApiKey: "test-api-key" },
      });

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it("should maintain backwards compatibility", async () => {
      const result = await tool.execute(brandAgentFixtures.createInput(), {
        session: { customerId: 123, scope3ApiKey: "test-api-key" },
      });
      const response = expectLegacyCompatibleResponse(result);

      // Legacy fields should be present
      expect(response.message).toBeDefined();
      expect(response.success).toBe(true);

      // New structured data should also be present
      expect(response.data).toBeDefined();
    });

    it("should include created object in structured data", async () => {
      const mockCreated = brandAgentFixtures.enhancedBrandAgent();
      mockClient.createBrandAgent.mockResolvedValue(mockCreated);

      const result = await tool.execute(brandAgentFixtures.createInput(), {
        session: { customerId: 123, scope3ApiKey: "test-api-key" },
      });
      const response = JSON.parse(result);

      // API consumers can access the created object via brandAgent wrapper
      expect(response.data.brandAgent).toBeDefined();
      expect(response.data.brandAgent.id).toBe(mockCreated.id);
      expect(response.data.brandAgent.name).toBe(mockCreated.name);
      BrandAgentValidators.validateBrandAgent(response.data.brandAgent);
    });
  });

  describe("Integration Scenarios", () => {
    it("should handle creation with all optional fields", async () => {
      const fullInput = {
        advertiserDomains: ["full.com", "complete.com", "example.org"],
        description: "Complete brand with all features",
        externalId: "ext_full_123",
        name: "Full Feature Brand",
        nickname: "FullBrand",
      };

      const mockCreated = {
        ...brandAgentFixtures.enhancedBrandAgent(),
        ...fullInput,
        id: "ba_full_created",
      };
      mockClient.createBrandAgent.mockResolvedValue(mockCreated);

      const result = await tool.execute(fullInput, {
        session: { customerId: 123, scope3ApiKey: "test-api-key" },
      });
      const response = BrandAgentValidators.validateCreateResponse(result);

      expect(response.data).toBeDefined();
      expect(response.data!.brandAgent).toMatchObject(fullInput);
      expect(mockClient.createBrandAgent).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        fullInput,
      );
    });

    it("should handle concurrent creation requests", async () => {
      // Setup different responses for concurrent requests
      let callCount = 0;
      mockClient.createBrandAgent.mockImplementation(
        async (apiKey: string, input: unknown) => {
          callCount++;
          return {
            ...brandAgentFixtures.enhancedBrandAgent(),
            id: `ba_concurrent_${callCount}`,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            name: (input as any).name,
          };
        },
      );

      // Execute concurrent creates
      const promises = [
        tool.execute(
          {
            advertiserDomains: ["concurrent1.com"],
            name: "Concurrent Brand 1",
          },
          { session: { customerId: 123, scope3ApiKey: "test-api-key" } },
        ),
        tool.execute(
          {
            advertiserDomains: ["concurrent2.com"],
            name: "Concurrent Brand 2",
          },
          { session: { customerId: 123, scope3ApiKey: "test-api-key" } },
        ),
        tool.execute(
          {
            advertiserDomains: ["concurrent3.com"],
            name: "Concurrent Brand 3",
          },
          { session: { customerId: 123, scope3ApiKey: "test-api-key" } },
        ),
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result, index) => {
        const response = BrandAgentValidators.validateCreateResponse(result);
        expect(response.data).toBeDefined();
        expect(response.data!.brandAgent.name).toBe(
          `Concurrent Brand ${index + 1}`,
        );
        expect(response.data!.brandAgent.id).toBe(`ba_concurrent_${index + 1}`);
      });
    });
  });
});
