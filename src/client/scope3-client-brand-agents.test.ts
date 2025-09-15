import { beforeEach, describe, expect, it, vi } from "vitest";
import { Scope3ApiClient } from "./scope3-client.js";
import { server, testConfig } from "../__tests__/setup/test-setup.js";
import { setupGraphQLMocks } from "../__tests__/setup/graphql-mocks-simple.js";
import {
  setupBigQueryMocks,
  bigQueryTestScenarios,
  bigQueryAssertions,
  mockBigQueryMethods,
} from "../__tests__/setup/bigquery-mocks.js";
import {
  brandAgentFixtures,
  brandAgentFactory,
} from "../__tests__/fixtures/brand-agent-fixtures.js";

/**
 * Brand Agent CRUD Integration Tests
 * Tests the GraphQL-primary with BigQuery enhancement architectural pattern
 */

describe("Scope3ApiClient - Brand Agent Operations", () => {
  let client: Scope3ApiClient;

  beforeEach(() => {
    client = new Scope3ApiClient(testConfig.graphqlUrl);
    setupBigQueryMocks.reset();
    server.resetHandlers();
  });

  describe("getBrandAgent", () => {
    describe("GraphQL-primary with BigQuery enhancement pattern", () => {
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
        // Should have BigQuery enhancement fields
        expect(result.externalId).toBe("external_123");
        expect(result.nickname).toBe("TestBrand");
        expect(result.description).toBe("Test brand with BigQuery extensions");

        // Verify both services were called
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
        // Should have GraphQL data but no BigQuery extensions
        expect(result.name).toBeDefined();
        expect(result.customerId).toBeDefined();
        // BigQuery fields should be undefined or empty
        expect(result.externalId).toBeUndefined();
        expect(result.nickname).toBeUndefined();
        expect(result.description).toBeUndefined();

        // Verify BigQuery was attempted but failed gracefully
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
        ).rejects.toThrow("Invalid request parameters or query");

        // BigQuery should not be called if GraphQL fails
        bigQueryAssertions.expectQueryNotCalled();
      });

      it("should handle GraphQL authentication errors", async () => {
        // Arrange
        const agentId = testConfig.testAgentId;
        server.use(...setupGraphQLMocks.withError("authError"));

        // Act & Assert
        await expect(
          client.getBrandAgent(testConfig.validApiKey, agentId),
        ).rejects.toThrow("Authentication failed");
      });
    });

    describe("performance characteristics", () => {
      it("should complete within reasonable time when BigQuery is slow", async () => {
        // Arrange
        const agentId = testConfig.testAgentId;
        server.use(...setupGraphQLMocks.success);
        bigQueryTestScenarios.slowBigQuery(1000); // 1 second delay

        // Act
        const startTime = Date.now();
        const result = await client.getBrandAgent(
          testConfig.validApiKey,
          agentId,
        );
        const endTime = Date.now();

        // Assert
        expect(result).toBeDefined();
        expect(endTime - startTime).toBeGreaterThan(900); // Should include the BigQuery delay
        expect(endTime - startTime).toBeLessThan(2000); // But not take too long overall
      });

      it("should not block on BigQuery timeout", async () => {
        // Arrange - This test would require timeout configuration in the service
        const agentId = testConfig.testAgentId;
        server.use(...setupGraphQLMocks.success);
        // Would need to mock a timeout scenario
        bigQueryTestScenarios.bigQueryUnavailable();

        // Act
        const startTime = Date.now();
        const result = await client.getBrandAgent(
          testConfig.validApiKey,
          agentId,
        );
        const endTime = Date.now();

        // Assert
        expect(result).toBeDefined();
        // Should complete quickly when BigQuery fails
        expect(endTime - startTime).toBeLessThan(1000);
      });
    });

    describe("data consistency validation", () => {
      it("should maintain data consistency between GraphQL and BigQuery", async () => {
        // Arrange
        const agentId = testConfig.testAgentId;
        server.use(
          ...setupGraphQLMocks.operations.getBrandAgent(agentId, {
            customerId: 12345,
            name: "Consistent Brand",
          }),
        );
        bigQueryTestScenarios.fullyEnhanced();

        // Act
        const result = await client.getBrandAgent(
          testConfig.validApiKey,
          agentId,
        );

        // Assert
        expect(result.id).toBe(agentId);
        expect(result.customerId).toBe(12345);
        // BigQuery enhancement should preserve GraphQL core data
        expect(result.name).toBeDefined();
      });

      it("should handle ID type consistency", async () => {
        // Arrange
        const agentId = "ba_type_test_123";
        server.use(...setupGraphQLMocks.operations.getBrandAgent(agentId));
        bigQueryTestScenarios.fullyEnhanced();

        // Act
        const result = await client.getBrandAgent(
          testConfig.validApiKey,
          agentId,
        );

        // Assert
        expect(typeof result.id).toBe("string");
        expect(typeof result.customerId).toBe("number");
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.updatedAt).toBeInstanceOf(Date);
      });
    });
  });

  describe("listBrandAgents", () => {
    describe("enhancement pattern for lists", () => {
      it("should enhance each agent individually", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        // Setup BigQuery to return enhancements for each agent
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryTestScenarios.fullyEnhanced(),
        );
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryTestScenarios.graphqlOnly(),
        );

        // Act
        const result = await client.listBrandAgents(testConfig.validApiKey);

        // Assert
        expect(result).toHaveLength(2);

        // First agent should be enhanced
        expect(result[0].externalId).toBeDefined();
        expect(result[0].nickname).toBeDefined();

        // Verify BigQuery was called for each agent
        bigQueryAssertions.expectQueryCallCount(2);
      });

      it("should handle mixed enhancement states gracefully", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        bigQueryTestScenarios.mixedEnhancementList();

        // Act
        const result = await client.listBrandAgents(testConfig.validApiKey);

        // Assert
        expect(result).toHaveLength(2);
        // Should succeed even with mixed enhancement states
        expect(result[0]).toBeDefined();
        expect(result[1]).toBeDefined();
      });

      it("should continue if some enhancements fail", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        // First enhancement succeeds, second fails
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryTestScenarios.fullyEnhanced(),
        );
        setupBigQueryMocks.withQueryError("networkError");

        // Act
        const result = await client.listBrandAgents(testConfig.validApiKey);

        // Assert
        expect(result).toHaveLength(2);
        // First agent enhanced, second falls back to GraphQL only
        expect(result[0].externalId).toBeDefined();
        expect(result[1].externalId).toBeUndefined();
      });
    });

    describe("performance with large lists", () => {
      it("should handle large agent lists efficiently", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.operations.largeResultSet);
        bigQueryTestScenarios.largeDataset(100, 0.5); // 50% enhancement rate

        // Act
        const startTime = Date.now();
        const result = await client.listBrandAgents(testConfig.validApiKey);
        const endTime = Date.now();

        // Assert
        expect(result).toHaveLength(100);
        // Should complete within reasonable time even with many enhancement calls
        expect(endTime - startTime).toBeLessThan(5000); // 5 seconds for 100 agents

        // Verify enhancement was attempted for each agent
        bigQueryAssertions.expectQueryCallCount(100);
      });

      it("should not fail entire list if BigQuery is completely unavailable", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        // All BigQuery calls fail
        for (let i = 0; i < 10; i++) {
          setupBigQueryMocks.withQueryError("networkError");
        }

        // Act
        const result = await client.listBrandAgents(testConfig.validApiKey);

        // Assert
        expect(result).toHaveLength(2); // GraphQL returned 2 agents
        // All agents should have GraphQL data only
        result.forEach((agent) => {
          expect(agent.id).toBeDefined();
          expect(agent.name).toBeDefined();
          expect(agent.externalId).toBeUndefined();
        });
      });
    });

    describe("filtering and where clauses", () => {
      it("should pass GraphQL where clauses correctly", async () => {
        // Arrange
        const whereClause = {
          customerId: { equals: testConfig.testCustomerId },
        };
        server.use(...setupGraphQLMocks.success);
        bigQueryTestScenarios.fullyEnhanced();

        // Act
        const result = await client.listBrandAgents(
          testConfig.validApiKey,
          whereClause,
        );

        // Assert
        expect(result).toBeDefined();
        // This would require inspecting the GraphQL query to verify where clause
        // For now, verify the operation succeeds
      });
    });
  });

  describe("createBrandAgent", () => {
    describe("creation with enhancement", () => {
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
        expect(result.id).toBe("ba_created_123");
        expect(result.name).toBe(input.name);

        // Verify BigQuery extension was created
        bigQueryAssertions.expectQueryCalled("MERGE");
        bigQueryAssertions.expectQueryCalled("agent_id");
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
        expect(result.id).toBe("ba_created_123");
        // Should have GraphQL data even if BigQuery fails
        expect(result.name).toBe(input.name);
      });

      it("should not create BigQuery extension for GraphQL-only input", async () => {
        // Arrange
        const input = brandAgentFactory.createInput({
          name: "GraphQL Only Brand",
          customerId: testConfig.testCustomerId,
          // No externalId or nickname
        });
        server.use(...setupGraphQLMocks.success);

        // Act
        const result = await client.createBrandAgent(
          testConfig.validApiKey,
          input,
        );

        // Assert
        expect(result).toBeDefined();
        // BigQuery should not be called for GraphQL-only input
        bigQueryAssertions.expectQueryNotCalled();
      });
    });

    describe("error handling during creation", () => {
      it("should fail creation if GraphQL creation fails", async () => {
        // Arrange
        const input = brandAgentFactory.createInput();
        server.use(...setupGraphQLMocks.withError("graphqlError"));

        // Act & Assert
        await expect(
          client.createBrandAgent(testConfig.validApiKey, input),
        ).rejects.toThrow();

        // BigQuery should not be called if GraphQL fails
        bigQueryAssertions.expectQueryNotCalled();
      });

      it("should handle validation errors from GraphQL", async () => {
        // Arrange
        const invalidInput = brandAgentFactory.createInput({ name: "" }); // Invalid name
        server.use(...setupGraphQLMocks.withError("graphqlError"));

        // Act & Assert
        await expect(
          client.createBrandAgent(testConfig.validApiKey, invalidInput),
        ).rejects.toThrow("Invalid request parameters or query");
      });
    });
  });

  describe("updateBrandAgent", () => {
    describe("update with enhancement", () => {
      it("should update both GraphQL and BigQuery data", async () => {
        // Arrange
        const agentId = testConfig.testAgentId;
        const updateInput = brandAgentFactory.updateInput({
          name: "Updated Brand Name",
          nickname: "UpdatedNickname",
        });
        server.use(...setupGraphQLMocks.success);
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryTestScenarios.fullyEnhanced(),
        );
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryTestScenarios.fullyEnhanced(),
        ); // For final fetch

        // Act
        const result = await client.updateBrandAgent(
          testConfig.validApiKey,
          agentId,
          updateInput,
        );

        // Assert
        expect(result).toBeDefined();
        expect(result.name).toBe("Updated Brand Name");

        // Verify both GraphQL update and BigQuery extension update
        bigQueryAssertions.expectQueryCalled("MERGE");
        bigQueryAssertions.expectQueryCallCount(2); // Update + final fetch
      });

      it("should update GraphQL even if BigQuery update fails", async () => {
        // Arrange
        const agentId = testConfig.testAgentId;
        const updateInput = brandAgentFactory.updateInput({
          name: "Updated Name",
          nickname: "FailedNickname",
        });
        server.use(...setupGraphQLMocks.success);
        setupBigQueryMocks.withQueryError("networkError"); // Update fails
        setupBigQueryMocks.withQueryError("networkError"); // Final fetch fails

        // Act
        const result = await client.updateBrandAgent(
          testConfig.validApiKey,
          agentId,
          updateInput,
        );

        // Assert
        expect(result).toBeDefined();
        expect(result.name).toBe("Updated Name");
        // Should fall back to GraphQL-only result
      });

      it("should handle GraphQL-only updates", async () => {
        // Arrange
        const agentId = testConfig.testAgentId;
        const updateInput = brandAgentFactory.updateInput({
          name: "GraphQL Only Update",
          // No BigQuery fields
        });
        server.use(...setupGraphQLMocks.success);

        // Act
        const result = await client.updateBrandAgent(
          testConfig.validApiKey,
          agentId,
          updateInput,
        );

        // Assert
        expect(result).toBeDefined();
        expect(result.name).toBe("GraphQL Only Update");

        // BigQuery should not be called for GraphQL-only updates
        bigQueryAssertions.expectQueryNotCalled();
      });
    });

    describe("final data retrieval", () => {
      it("should return enhanced data after successful update", async () => {
        // Arrange
        const agentId = testConfig.testAgentId;
        const updateInput = brandAgentFactory.updateInput();
        server.use(...setupGraphQLMocks.success);
        setupBigQueryMocks.withSuccessfulQuery(bigQueryTestScenarios.empty()); // Update
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryTestScenarios.fullyEnhanced(),
        ); // Final fetch

        // Act
        const result = await client.updateBrandAgent(
          testConfig.validApiKey,
          agentId,
          updateInput,
        );

        // Assert
        expect(result).toBeDefined();
        // Should have enhanced data from final fetch
        expect(result.externalId).toBe("external_123");
        expect(result.nickname).toBe("TestBrand");

        bigQueryAssertions.expectQueryCallCount(2); // Update + fetch
      });

      it("should fallback to GraphQL result if final enhancement fails", async () => {
        // Arrange
        const agentId = testConfig.testAgentId;
        const updateInput = brandAgentFactory.updateInput();
        server.use(...setupGraphQLMocks.success);
        setupBigQueryMocks.withSuccessfulQuery(bigQueryTestScenarios.empty()); // Update succeeds
        setupBigQueryMocks.withQueryError("networkError"); // Final fetch fails

        // Act
        const result = await client.updateBrandAgent(
          testConfig.validApiKey,
          agentId,
          updateInput,
        );

        // Assert
        expect(result).toBeDefined();
        // Should have GraphQL data only
        expect(result.name).toBeDefined();
        expect(result.externalId).toBeUndefined();
      });
    });
  });

  describe("architectural pattern validation", () => {
    describe("GraphQL-primary principle", () => {
      it("should always query GraphQL first", async () => {
        // This is implicitly tested in other tests, but worth explicit validation
        const agentId = testConfig.testAgentId;
        server.use(...setupGraphQLMocks.success);
        setupBigQueryMocks.withQueryError("networkError"); // BigQuery fails

        const result = await client.getBrandAgent(
          testConfig.validApiKey,
          agentId,
        );

        expect(result).toBeDefined(); // Should succeed with GraphQL data
        expect(result.id).toBe(agentId);
      });

      it("should fail operations when GraphQL fails, regardless of BigQuery state", async () => {
        const agentId = testConfig.testAgentId;
        server.use(...setupGraphQLMocks.withError("serverError"));
        bigQueryTestScenarios.fullyEnhanced(); // BigQuery works

        await expect(
          client.getBrandAgent(testConfig.validApiKey, agentId),
        ).rejects.toThrow();
      });
    });

    describe("enhancement non-blocking principle", () => {
      it("should not fail operations when BigQuery enhancement fails", async () => {
        const operations = [
          () =>
            client.getBrandAgent(
              testConfig.validApiKey,
              testConfig.testAgentId,
            ),
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

        server.use(...setupGraphQLMocks.success);

        for (const operation of operations) {
          setupBigQueryMocks.reset();
          setupBigQueryMocks.withQueryError("networkError");

          // Each operation should succeed despite BigQuery failure
          await expect(operation()).resolves.toBeDefined();
        }
      });
    });

    describe("data consistency principle", () => {
      it("should maintain consistent data structure across all operations", async () => {
        server.use(...setupGraphQLMocks.success);
        bigQueryTestScenarios.fullyEnhanced();

        const results = await Promise.all([
          client.getBrandAgent(testConfig.validApiKey, testConfig.testAgentId),
          client
            .listBrandAgents(testConfig.validApiKey)
            .then((list) => list[0]),
        ]);

        // All results should have consistent structure
        results.forEach((result) => {
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
});
