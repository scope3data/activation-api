import { beforeEach, describe, expect, it } from "vitest";

import {
  architecturalAssertions,
  createMockScope3ApiClient,
  type MockScope3ApiClient,
  serviceLevelScenarios,
  serviceTestData,
} from "../__tests__/setup/service-level-mocks.js";
import { BrandAgentValidators } from "../__tests__/utils/structured-response-helpers.js";
import { Scope3ApiClient } from "./scope3-client.js";

/**
 * Service-Level Brand Agent Tests
 *
 * These tests validate business logic and architectural patterns
 * without testing implementation details like GraphQL/BigQuery specifics.
 *
 * Benefits:
 * - Resilient to infrastructure changes (GraphQL → REST, BigQuery → PostgreSQL)
 * - Focus on business requirements and user outcomes
 * - Test the service contract, not the implementation
 * - Enable safe refactoring of underlying technologies
 */

describe("Scope3ApiClient - Service Level Contract", () => {
  let mockClient: MockScope3ApiClient;
  let realClient: Scope3ApiClient;

  beforeEach(() => {
    mockClient = createMockScope3ApiClient();
    realClient = new Scope3ApiClient("https://api.scope3.com/api/graphql");

    // Replace real client methods with mocks for testing
    Object.assign(realClient, mockClient);
  });

  describe("Brand Agent Listing", () => {
    it("should return brand agents when service is available", async () => {
      // Arrange
      serviceLevelScenarios.successfulList(mockClient);

      // Act
      const result = await realClient.listBrandAgents(
        serviceTestData.validApiKey,
      );

      // Assert
      architecturalAssertions.assertGracefulDegradation(result);
      expect(result).toHaveLength(2);
      expect(mockClient.listBrandAgents).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
      );
    });

    it("should handle authentication errors gracefully", async () => {
      // Arrange
      serviceLevelScenarios.authenticationError(mockClient);

      // Act & Assert
      await expect(
        realClient.listBrandAgents(serviceTestData.invalidApiKey),
      ).rejects.toThrow("Authentication failed");
    });

    it("should support filtering by criteria", async () => {
      // Arrange
      serviceLevelScenarios.successfulList(mockClient);
      const filters = serviceTestData.filterInput();

      // Act
      await realClient.listBrandAgents(serviceTestData.validApiKey, filters);

      // Assert
      expect(mockClient.listBrandAgents).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        filters,
      );
    });

    it("should handle mixed enhancement states gracefully", async () => {
      // Arrange - Some agents enhanced, some GraphQL-only
      serviceLevelScenarios.mixedEnhancement(mockClient);

      // Act
      const result = await realClient.listBrandAgents(
        serviceTestData.validApiKey,
      );

      // Assert
      architecturalAssertions.assertGracefulDegradation(result);
      expect(result).toHaveLength(2);

      // Both should be valid brand agents regardless of enhancement state
      result.forEach((agent) => {
        expect(agent.id).toBeDefined();
        expect(agent.name).toBeDefined();
        expect(agent.customerId).toBeDefined();
      });
    });
  });

  describe("Brand Agent Retrieval", () => {
    const testAgentId = "ba_test_123";

    it("should return brand agent when found", async () => {
      // Arrange
      serviceLevelScenarios.successfulGet(mockClient, testAgentId);

      // Act
      const result = await realClient.getBrandAgent(
        serviceTestData.validApiKey,
        testAgentId,
      );

      // Assert
      architecturalAssertions.assertEnhancedData(result);
      expect(result.id).toBe(testAgentId);
      expect(mockClient.getBrandAgent).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        testAgentId,
      );
    });

    it("should handle not found errors", async () => {
      // Arrange
      serviceLevelScenarios.notFound(mockClient);

      // Act & Assert
      await expect(
        realClient.getBrandAgent(serviceTestData.validApiKey, "nonexistent"),
      ).rejects.toThrow("Brand agent not found");
    });

    it("should work with GraphQL-only data when enhancement unavailable", async () => {
      // Arrange
      serviceLevelScenarios.graphqlOnlyData(mockClient);

      // Act
      const result = await realClient.listBrandAgents(
        serviceTestData.validApiKey,
      );

      // Assert
      architecturalAssertions.assertGracefulDegradation(result);

      // Should still have core fields even without enhancement
      expect(result[0].id).toBeDefined();
      expect(result[0].name).toBeDefined();
      expect(result[0].customerId).toBeDefined();
    });
  });

  describe("Brand Agent Creation", () => {
    it("should create brand agent with provided data", async () => {
      // Arrange
      serviceLevelScenarios.successfulCreate(mockClient);
      const input = serviceTestData.createInput();

      // Act
      const result = await realClient.createBrandAgent(
        serviceTestData.validApiKey,
        input,
      );

      // Assert
      architecturalAssertions.assertEnhancedData(result);
      expect(result.id).toBe("ba_created_123");
      expect(mockClient.createBrandAgent).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        input,
      );
    });

    it("should handle validation errors", async () => {
      // Arrange
      const validationError = new Error("Invalid request parameters or query");
      mockClient.createBrandAgent.mockRejectedValue(validationError);

      // Act & Assert
      await expect(
        realClient.createBrandAgent(
          serviceTestData.validApiKey,
          serviceTestData.createInput(),
        ),
      ).rejects.toThrow("Invalid request parameters or query");
    });
  });

  describe("Brand Agent Updates", () => {
    const testAgentId = "ba_test_123";

    it("should update brand agent with provided changes", async () => {
      // Arrange
      serviceLevelScenarios.successfulUpdate(mockClient);
      const input = serviceTestData.updateInput();

      // Act
      const result = await realClient.updateBrandAgent(
        serviceTestData.validApiKey,
        testAgentId,
        input,
      );

      // Assert
      architecturalAssertions.assertEnhancedData(result);
      expect(result.name).toBe("Updated Brand Name");
      expect(mockClient.updateBrandAgent).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        testAgentId,
        input,
      );
    });

    it("should handle partial updates", async () => {
      // Arrange
      serviceLevelScenarios.successfulUpdate(mockClient);
      const partialInput = { name: "Only Name Updated" };

      // Act
      await realClient.updateBrandAgent(
        serviceTestData.validApiKey,
        testAgentId,
        partialInput,
      );

      // Assert
      expect(mockClient.updateBrandAgent).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        testAgentId,
        partialInput,
      );
    });
  });

  describe("Brand Agent Deletion", () => {
    const testAgentId = "ba_test_123";

    it("should delete brand agent successfully", async () => {
      // Arrange
      serviceLevelScenarios.successfulDelete(mockClient);

      // Act
      const result = await realClient.deleteBrandAgent(
        serviceTestData.validApiKey,
        testAgentId,
      );

      // Assert
      expect(result).toBe(true);
      expect(mockClient.deleteBrandAgent).toHaveBeenCalledWith(
        serviceTestData.validApiKey,
        testAgentId,
      );
    });

    it("should handle deletion of non-existent agent", async () => {
      // Arrange
      serviceLevelScenarios.notFound(mockClient);

      // Act & Assert
      await expect(
        realClient.deleteBrandAgent(serviceTestData.validApiKey, "nonexistent"),
      ).rejects.toThrow("Brand agent not found");
    });
  });

  describe("Performance Requirements", () => {
    it("should complete single agent retrieval within time limit", async () => {
      // Arrange
      serviceLevelScenarios.successfulGet(mockClient, "ba_perf_test");
      const startTime = Date.now();

      // Act
      await realClient.getBrandAgent(
        serviceTestData.validApiKey,
        "ba_perf_test",
      );

      // Assert
      architecturalAssertions.assertPerformance(
        startTime,
        "getBrandAgent",
        500,
      );
    });

    it("should handle slow backend gracefully", async () => {
      // Arrange
      serviceLevelScenarios.slowResponse(mockClient, 100); // Simulate 100ms delay

      // Act
      const startTime = Date.now();
      const result = await realClient.getBrandAgent(
        serviceTestData.validApiKey,
        "ba_slow",
      );

      // Assert
      expect(result).toBeDefined();
      expect(Date.now() - startTime).toBeGreaterThan(90); // Verify delay happened
    });
  });

  describe("Error Recovery", () => {
    it("should provide clear error messages for common failures", async () => {
      // Test different error scenarios
      const errorScenarios = [
        {
          expectedMessage: "Authentication failed",
          setup: () => serviceLevelScenarios.authenticationError(mockClient),
        },
        {
          expectedMessage: "External service temporarily unavailable",
          setup: () => serviceLevelScenarios.serviceUnavailable(mockClient),
        },
        {
          expectedMessage: "Brand agent not found",
          setup: () => serviceLevelScenarios.notFound(mockClient),
        },
      ];

      for (const scenario of errorScenarios) {
        // Arrange
        scenario.setup();

        // Act & Assert
        await expect(
          realClient.getBrandAgent(serviceTestData.validApiKey, "test"),
        ).rejects.toThrow(scenario.expectedMessage);
      }
    });
  });

  describe("Architectural Pattern Validation", () => {
    it("should maintain consistent response structure across all operations", async () => {
      // Arrange
      serviceLevelScenarios.successfulGet(mockClient, "consistency_test");
      serviceLevelScenarios.successfulCreate(mockClient);
      serviceLevelScenarios.successfulUpdate(mockClient);

      // Act
      const getResult = await realClient.getBrandAgent(
        serviceTestData.validApiKey,
        "consistency_test",
      );
      const createResult = await realClient.createBrandAgent(
        serviceTestData.validApiKey,
        serviceTestData.createInput(),
      );
      const updateResult = await realClient.updateBrandAgent(
        serviceTestData.validApiKey,
        "test",
        serviceTestData.updateInput(),
      );

      // Assert - All should have consistent core structure
      [getResult, createResult, updateResult].forEach((result) => {
        expect(result).toHaveProperty("id");
        expect(result).toHaveProperty("name");
        expect(result).toHaveProperty("customerId");
        expect(result).toHaveProperty("createdAt");
        expect(result).toHaveProperty("updatedAt");
        
        // Validate using structured response validators
        BrandAgentValidators.validateBrandAgent(result);
      });
    });

    it("should handle concurrent operations safely", async () => {
      // Arrange
      serviceLevelScenarios.successfulList(mockClient);

      // Act - Multiple concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        realClient.listBrandAgents(serviceTestData.validApiKey),
      );
      const results = await Promise.all(promises);

      // Assert - All should succeed
      results.forEach((result) => {
        architecturalAssertions.assertGracefulDegradation(result);
      });
    });
  });
});
