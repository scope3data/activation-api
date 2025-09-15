import { beforeEach, describe, expect, it } from "vitest";
import { Scope3ApiClient } from "./scope3-client.js";
import { server, testConfig } from "../__tests__/setup/test-setup.js";
import { setupGraphQLMocks } from "../__tests__/setup/graphql-mocks-simple.js";
import {
  setupBigQueryMocks,
  bigQueryTestScenarios,
  bigQueryAssertions,
} from "../__tests__/setup/bigquery-mocks.js";
import { brandAgentFactory } from "../__tests__/fixtures/brand-agent-fixtures.js";

/**
 * Simplified Brand Agent CRUD Integration Tests
 * Tests the GraphQL-primary with BigQuery enhancement architectural pattern
 */

describe("Scope3ApiClient - Brand Agent Operations (Simplified)", () => {
  let client: Scope3ApiClient;

  beforeEach(() => {
    client = new Scope3ApiClient(testConfig.graphqlUrl);
    setupBigQueryMocks.reset();
    server.resetHandlers();
  });

  describe("getBrandAgent - Core Pattern Validation", () => {
    it("should return enhanced agent when both GraphQL and BigQuery succeed", async () => {
      // Arrange
      const agentId = testConfig.testAgentId;
      server.use(...setupGraphQLMocks.success);
      bigQueryTestScenarios.fullyEnhanced();

      // Act
      const result = await client.getBrandAgent(
        testConfig.validApiKey,
        agentId,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(agentId);
      expect(result.name).toBeDefined();

      // Verify BigQuery enhancement was attempted
      bigQueryAssertions.expectQueryCalled("SELECT", { agentId });
    });

    it("should return GraphQL-only data when BigQuery enhancement fails", async () => {
      // Arrange
      const agentId = testConfig.testAgentId;
      server.use(...setupGraphQLMocks.success);
      bigQueryTestScenarios.bigQueryUnavailable();

      // Act
      const result = await client.getBrandAgent(
        testConfig.validApiKey,
        agentId,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.id).toBe(agentId);
      expect(result.name).toBeDefined();

      // Should have attempted BigQuery but gracefully degraded
      bigQueryAssertions.expectQueryCalled("SELECT");
    });

    it("should fail when GraphQL fails (primary data source)", async () => {
      // Arrange
      const agentId = testConfig.testAgentId;
      server.use(...setupGraphQLMocks.withError("graphqlError"));
      bigQueryTestScenarios.fullyEnhanced(); // BigQuery works but shouldn't matter

      // Act & Assert
      await expect(
        client.getBrandAgent(testConfig.validApiKey, agentId),
      ).rejects.toThrow();

      // BigQuery should not be called if GraphQL fails
      bigQueryAssertions.expectQueryNotCalled();
    });
  });

  describe("listBrandAgents - Enhancement Pattern", () => {
    it("should enhance each agent individually", async () => {
      // Arrange
      server.use(...setupGraphQLMocks.success);
      bigQueryTestScenarios.fullyEnhanced();
      bigQueryTestScenarios.graphqlOnly();

      // Act
      const result = await client.listBrandAgents(testConfig.validApiKey);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Should have attempted enhancement for each agent
      bigQueryAssertions.expectQueryCallCount(result.length);
    });

    it("should continue if some enhancements fail", async () => {
      // Arrange
      server.use(...setupGraphQLMocks.success);
      bigQueryTestScenarios.fullyEnhanced();
      setupBigQueryMocks.withQueryError("networkError");

      // Act
      const result = await client.listBrandAgents(testConfig.validApiKey);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("createBrandAgent - Creation with Enhancement", () => {
    it("should create brand agent in GraphQL then add BigQuery extension", async () => {
      // Arrange
      const input = brandAgentFactory.createInput({
        externalId: "ext_create_123",
        nickname: "CreateTest",
      });
      server.use(...setupGraphQLMocks.success);
      setupBigQueryMocks.withSuccessfulQuery(
        bigQueryTestScenarios.fullyEnhanced(),
      );

      // Act
      const result = await client.createBrandAgent(
        testConfig.validApiKey,
        input,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(input.name);

      // Verify BigQuery extension was created if customer-scoped fields present
      if (input.externalId || input.nickname) {
        bigQueryAssertions.expectQueryCalled("MERGE");
      }
    });

    it("should succeed even if BigQuery extension creation fails", async () => {
      // Arrange
      const input = brandAgentFactory.createInput({
        externalId: "ext_create_fail",
        nickname: "CreateFailTest",
      });
      server.use(...setupGraphQLMocks.success);
      setupBigQueryMocks.withQueryError("networkError");

      // Act
      const result = await client.createBrandAgent(
        testConfig.validApiKey,
        input,
      );

      // Assert
      expect(result).toBeDefined();
      expect(result.name).toBe(input.name);
      // Should have GraphQL data even if BigQuery fails
    });
  });

  describe("Architectural Pattern Validation", () => {
    it("should always succeed with GraphQL data when BigQuery fails", async () => {
      // Arrange
      server.use(...setupGraphQLMocks.success);

      const operations = [
        () =>
          client.getBrandAgent(testConfig.validApiKey, testConfig.testAgentId),
        () => client.listBrandAgents(testConfig.validApiKey),
        () =>
          client.createBrandAgent(
            testConfig.validApiKey,
            brandAgentFactory.createInput(),
          ),
        () =>
          client.updateBrandAgent(
            testConfig.validApiKey,
            testConfig.testAgentId,
            brandAgentFactory.updateInput(),
          ),
      ];

      // Act & Assert - All operations should succeed with GraphQL-only data
      for (const operation of operations) {
        setupBigQueryMocks.reset();
        setupBigQueryMocks.withQueryError("networkError");

        await expect(operation()).resolves.toBeDefined();
      }
    });

    it("should fail operations when GraphQL fails, regardless of BigQuery state", async () => {
      // Arrange
      const agentId = testConfig.testAgentId;
      server.use(...setupGraphQLMocks.withError("serverError"));
      bigQueryTestScenarios.fullyEnhanced(); // BigQuery works

      // Act & Assert
      await expect(
        client.getBrandAgent(testConfig.validApiKey, agentId),
      ).rejects.toThrow();
    });

    it("should maintain consistent data structure across operations", async () => {
      // Arrange
      server.use(...setupGraphQLMocks.success);
      bigQueryTestScenarios.fullyEnhanced();

      // Act
      const retrieved = await client.getBrandAgent(
        testConfig.validApiKey,
        testConfig.testAgentId,
      );
      const list = await client.listBrandAgents(testConfig.validApiKey);

      // Assert - Consistent structure
      [retrieved, ...list].forEach((result) => {
        expect(result).toHaveProperty("id");
        expect(result).toHaveProperty("name");
        expect(result).toHaveProperty("customerId");
        expect(result).toHaveProperty("createdAt");
        expect(result).toHaveProperty("updatedAt");
        expect(typeof result.id).toBe("string");
        expect(typeof result.customerId).toBe("number");
        expect(result.createdAt).toBeInstanceOf(Date);
      });
    });
  });
});
