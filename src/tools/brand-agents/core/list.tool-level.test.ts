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
  ValidatedBrandAgent,
} from "../../../__tests__/utils/structured-response-helpers.js";
import { listBrandAgentsTool } from "./list.js";

/**
 * Tool-Level Tests for brand-agent/list
 *
 * These tests validate the complete MCP tool execution including:
 * - Parameter validation
 * - Authentication handling
 * - Structured response format
 * - Human-readable message generation
 * - Error handling and user-friendly messages
 */

describe("brand-agent/list Tool", () => {
  let mockClient: ReturnType<typeof createMockScope3ApiClient>;
  let tool: ReturnType<typeof listBrandAgentsTool>;

  beforeEach(() => {
    mockClient = createMockScope3ApiClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tool = listBrandAgentsTool(mockClient as unknown as any);
  });

  describe("Tool Configuration", () => {
    it("should have correct tool metadata", () => {
      expect(tool.name).toBe("brand_agent_list");
      expect(tool.description).toContain("List all brand agents");
      expect(tool.annotations.category).toBe("Brand Agents");
      expect(tool.annotations.dangerLevel).toBe("low");
      expect(tool.annotations.readOnlyHint).toBe(true);
    });

    it("should have proper parameter schema", () => {
      const params = tool.parameters;
      expect(params).toBeDefined();

      // Should allow optional where parameter
      const result = params.safeParse({});
      expect(result.success).toBe(true);

      const resultWithWhere = params.safeParse({
        where: { customerId: 123, name: "Test" },
      });
      expect(resultWithWhere.success).toBe(true);
    });
  });

  describe("Authentication", () => {
    it("should use session API key when available", async () => {
      serviceLevelScenarios.successfulList(mockClient);
      const context = { session: { customerId: 123, scope3ApiKey: "session_key" } };

      await tool.execute({}, context);

      expect(mockClient.listBrandAgents).toHaveBeenCalledWith(
        "session_key",
        undefined,
      );
    });

    it("should fall back to environment API key", async () => {
      serviceLevelScenarios.successfulList(mockClient);
      const originalEnv = process.env.SCOPE3_API_KEY;
      process.env.SCOPE3_API_KEY = "env_key";

      try {
        await tool.execute({}, {});
        expect(mockClient.listBrandAgents).toHaveBeenCalledWith(
          "env_key",
          undefined,
        );
      } finally {
        if (originalEnv !== undefined) {
          process.env.SCOPE3_API_KEY = originalEnv;
        } else {
          delete process.env.SCOPE3_API_KEY;
        }
      }
    });

    it("should throw error when no API key available", async () => {
      const originalEnv = process.env.SCOPE3_API_KEY;
      delete process.env.SCOPE3_API_KEY;

      try {
        await expect(tool.execute({}, {})).rejects.toThrow(
          "Authentication required. Please set the SCOPE3_API_KEY",
        );
      } finally {
        if (originalEnv !== undefined) {
          process.env.SCOPE3_API_KEY = originalEnv;
        }
      }
    });
  });

  describe("Successful Responses", () => {
    beforeEach(() => {
      process.env.SCOPE3_API_KEY = serviceTestData.validApiKey;
    });

    it("should return structured response with multiple brand agents", async () => {
      // Setup mock to return multiple agents
      const mockAgents = [
        brandAgentFixtures.enhancedBrandAgent(),
        {
          ...brandAgentFixtures.graphqlBrandAgent(),
          id: "ba_456",
          name: "Second Brand",
        },
      ];
      mockClient.listBrandAgents.mockResolvedValue(mockAgents);

      const result = await tool.execute({}, {});

      // Validate structured response format
      const response = BrandAgentValidators.validateListResponse(result, 2);

      // Verify message contains useful information
      expect(response.message).toContain("Found 2 brand agents");
      expect(response.message).toContain("Enhanced Test Brand");
      expect(response.message).toContain("Second Brand");
      expect(response.message).toContain("💡 **Tip:**");

      // Verify data structure
      expect(response.data).toBeDefined();
      expect(response.data!.brandAgents).toHaveLength(2);
      expect(response.data!.count).toBe(2);

      // Verify each brand agent in data
      if (Array.isArray(response.data!.brandAgents)) {
        response.data!.brandAgents.forEach((agent) => {
          BrandAgentValidators.validateBrandAgent(agent as ValidatedBrandAgent);
        });
      }
    });

    it("should return structured response with single brand agent", async () => {
      const mockAgents = [brandAgentFixtures.enhancedBrandAgent()];
      mockClient.listBrandAgents.mockResolvedValue(mockAgents);

      const result = await tool.execute({}, {});

      const response = BrandAgentValidators.validateListResponse(result, 1);

      // Message should use singular form
      expect(response.message).toContain("Found 1 brand agent");
      expect(response.message).not.toContain("1 brand agents"); // Should not be plural

      expect(response.data!.count).toBe(1);
      expect(response.data!.brandAgents).toHaveLength(1);
    });

    it("should return structured response with no brand agents", async () => {
      mockClient.listBrandAgents.mockResolvedValue([]);

      const result = await tool.execute({}, {});

      const response = BrandAgentValidators.validateListResponse(result, 0);

      expect(response.message).toContain("No brand agents found");
      expect(response.message).toContain("Create your first brand agent");
      expect(response.data!.count).toBe(0);
      expect(response.data!.brandAgents).toHaveLength(0);
    });

    it("should include detailed information in messages", async () => {
      const mockAgent = {
        ...brandAgentFixtures.enhancedBrandAgent(),
        createdAt: "2024-01-15T10:00:00Z",
        customerId: 12345,
        description: "Test brand description",
        updatedAt: "2024-02-01T15:30:00Z",
      };
      mockClient.listBrandAgents.mockResolvedValue([mockAgent]);

      const result = await tool.execute({}, {});

      const response = expectLegacyCompatibleResponse(result);

      // Should include key details in human-readable format
      expect(response.message).toContain(mockAgent.name);
      expect(response.message).toContain(mockAgent.id);
      expect(response.message).toContain(mockAgent.description);
      expect(response.message).toContain("Customer: 12345");
      expect(response.message).toContain("Created:");
      expect(response.message).toContain("Last Updated:");
    });
  });

  describe("Filtering", () => {
    beforeEach(() => {
      process.env.SCOPE3_API_KEY = serviceTestData.validApiKey;
      serviceLevelScenarios.successfulList(mockClient);
    });

    it("should apply name filter correctly", async () => {
      await tool.execute({ where: { name: "Test Brand" } }, {});

      expect(mockClient.listBrandAgents).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        { name: { contains: "Test Brand" } },
      );
    });

    it("should apply customer ID filter correctly", async () => {
      await tool.execute({ where: { customerId: 12345 } }, {});

      expect(mockClient.listBrandAgents).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        { customerId: { equals: 12345 } },
      );
    });

    it("should apply both filters when provided", async () => {
      await tool.execute(
        {
          where: { customerId: 12345, name: "Test" },
        },
        {},
      );

      expect(mockClient.listBrandAgents).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        {
          customerId: { equals: 12345 },
          name: { contains: "Test" },
        },
      );
    });

    it("should handle undefined filters", async () => {
      await tool.execute({}, {});

      expect(mockClient.listBrandAgents).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        undefined,
      );
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      process.env.SCOPE3_API_KEY = serviceTestData.validApiKey;
    });

    it("should handle service errors gracefully", async () => {
      const errorMessage = "GraphQL error: Service unavailable";
      mockClient.listBrandAgents.mockRejectedValue(new Error(errorMessage));

      await expect(tool.execute({}, {})).rejects.toThrow(
        "Failed to fetch brand agents: GraphQL error: Service unavailable",
      );
    });

    it("should handle authentication errors", async () => {
      serviceLevelScenarios.authenticationError(mockClient);

      await expect(tool.execute({}, {})).rejects.toThrow(
        "Failed to fetch brand agents: Authentication failed",
      );
    });

    it("should handle network errors", async () => {
      const networkError = new Error("Network timeout");
      mockClient.listBrandAgents.mockRejectedValue(networkError);

      await expect(tool.execute({}, {})).rejects.toThrow(
        "Failed to fetch brand agents: Network timeout",
      );
    });
  });

  describe("Response Format Validation", () => {
    beforeEach(() => {
      process.env.SCOPE3_API_KEY = serviceTestData.validApiKey;
    });

    it("should always return valid JSON", async () => {
      serviceLevelScenarios.successfulList(mockClient);

      const result = await tool.execute({}, {});

      expect(() => JSON.parse(result)).not.toThrow();
    });

    it("should maintain backwards compatibility", async () => {
      serviceLevelScenarios.successfulList(mockClient);

      const result = await tool.execute({}, {});
      const response = expectLegacyCompatibleResponse(result);

      // Legacy clients should still work - they'll get message and success
      expect(response.message).toBeDefined();
      expect(response.success).toBeDefined();

      // New clients get structured data too
      expect(response.data).toBeDefined();
    });

    it("should include structured data for API consumers", async () => {
      const mockAgents = [brandAgentFixtures.enhancedBrandAgent()];
      mockClient.listBrandAgents.mockResolvedValue(mockAgents);

      const result = await tool.execute({}, {});
      const response = JSON.parse(result);

      // API consumers can use structured data - note dates are serialized as strings
      expect(response.data.brandAgents).toHaveLength(1);
      expect(response.data.brandAgents[0].id).toBe(mockAgents[0].id);
      expect(response.data.brandAgents[0].name).toBe(mockAgents[0].name);
      expect(response.data.count).toBe(1);

      // While still getting human-readable messages
      expect(response.message).toContain("Found 1 brand agent");
    });
  });

  describe("Performance", () => {
    beforeEach(() => {
      process.env.SCOPE3_API_KEY = serviceTestData.validApiKey;
    });

    it("should handle large result sets efficiently", async () => {
      // Create a large mock result set
      const largeAgentList = Array.from({ length: 100 }, (_, i) => ({
        ...brandAgentFixtures.enhancedBrandAgent(),
        id: `ba_large_${i}`,
        name: `Brand Agent ${i + 1}`,
      }));
      mockClient.listBrandAgents.mockResolvedValue(largeAgentList);

      const startTime = Date.now();
      const result = await tool.execute({}, {});
      const duration = Date.now() - startTime;

      const response = BrandAgentValidators.validateListResponse(result, 100);

      // Should complete quickly even with large datasets
      expect(duration).toBeLessThan(1000); // 1 second max
      expect(response.data!.count).toBe(100);
      expect(response.message).toContain("Found 100 brand agents");
    });
  });
});
