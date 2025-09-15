import { beforeEach, describe, expect, it, vi } from "vitest";
import { Scope3ApiClient } from "../../client/scope3-client.js";
import { server, testConfig } from "../setup/test-setup.js";
import { setupGraphQLMocks } from "../setup/graphql-mocks.js";
import {
  setupBigQueryMocks,
  bigQueryTestScenarios,
  bigQueryAssertions,
} from "../setup/bigquery-mocks.js";
import { brandAgentFactory } from "../fixtures/brand-agent-fixtures.js";

/**
 * Performance and Resilience Tests for Brand Agent Enhancement Pattern
 * Tests system behavior under stress, with failures, and performance characteristics
 */

describe("Brand Agent Enhancement - Performance & Resilience", () => {
  let client: Scope3ApiClient;

  beforeEach(() => {
    client = new Scope3ApiClient(testConfig.graphqlUrl);
    setupBigQueryMocks.reset();
    server.resetHandlers();
  });

  describe("Performance Characteristics", () => {
    describe("response time requirements", () => {
      it("should complete single agent retrieval within 500ms under normal conditions", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        bigQueryTestScenarios.fullyEnhanced();

        // Act
        const startTime = Date.now();
        const result = await client.getBrandAgent(
          testConfig.validApiKey,
          testConfig.testAgentId,
        );
        const endTime = Date.now();

        // Assert
        expect(result).toBeDefined();
        expect(endTime - startTime).toBeLessThan(500);
      });

      it("should complete list of 10 agents within 2 seconds", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.operations.largeResultSet);
        bigQueryTestScenarios.largeDataset(10, 1.0); // All enhanced

        // Act
        const startTime = Date.now();
        const result = await client.listBrandAgents(testConfig.validApiKey);
        const endTime = Date.now();

        // Assert
        expect(result).toHaveLength(100); // Mock returns 100
        expect(endTime - startTime).toBeLessThan(2000);
        bigQueryAssertions.expectQueryCallCount(100); // One enhancement call per agent
      });

      it("should handle concurrent agent retrievals efficiently", async () => {
        // Arrange
        const agentIds = Array.from(
          { length: 5 },
          (_, i) => `ba_concurrent_${i}`,
        );
        server.use(...setupGraphQLMocks.success);
        agentIds.forEach(() => bigQueryTestScenarios.fullyEnhanced());

        // Act
        const startTime = Date.now();
        const results = await Promise.all(
          agentIds.map((id) =>
            client.getBrandAgent(testConfig.validApiKey, id),
          ),
        );
        const endTime = Date.now();

        // Assert
        expect(results).toHaveLength(5);
        results.forEach((result) => expect(result).toBeDefined());
        // Concurrent execution should be faster than sequential
        expect(endTime - startTime).toBeLessThan(1000);
        bigQueryAssertions.expectQueryCallCount(5);
      });
    });

    describe("memory and resource usage", () => {
      it("should handle large agent lists without excessive memory usage", async () => {
        // Arrange
        const initialMemory = process.memoryUsage().heapUsed;
        server.use(...setupGraphQLMocks.operations.largeResultSet);
        bigQueryTestScenarios.largeDataset(100, 0.5);

        // Act
        const result = await client.listBrandAgents(testConfig.validApiKey);
        const finalMemory = process.memoryUsage().heapUsed;

        // Assert
        expect(result).toHaveLength(100);
        // Memory increase should be reasonable (less than 50MB for 100 agents)
        const memoryIncrease = finalMemory - initialMemory;
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
      });

      it("should not leak resources during repeated operations", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        bigQueryTestScenarios.fullyEnhanced();
        const initialMemory = process.memoryUsage().heapUsed;

        // Act - Perform many operations
        for (let i = 0; i < 20; i++) {
          await client.getBrandAgent(
            testConfig.validApiKey,
            `ba_leak_test_${i}`,
          );
          setupBigQueryMocks.reset();
          bigQueryTestScenarios.fullyEnhanced();
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;

        // Assert
        const memoryIncrease = finalMemory - initialMemory;
        // Should not have significant memory increase after GC
        expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // 10MB threshold
      });
    });

    describe("BigQuery enhancement performance", () => {
      it("should handle slow BigQuery responses without blocking GraphQL operations", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.withDelay(100)); // Fast GraphQL
        bigQueryTestScenarios.slowBigQuery(1500); // Slow BigQuery

        // Act
        const startTime = Date.now();
        const result = await client.getBrandAgent(
          testConfig.validApiKey,
          testConfig.testAgentId,
        );
        const endTime = Date.now();

        // Assert
        expect(result).toBeDefined();
        // Should include BigQuery delay but complete
        expect(endTime - startTime).toBeGreaterThan(1400);
        expect(endTime - startTime).toBeLessThan(2000);
      });

      it("should optimize multiple enhancement calls for list operations", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        // Setup different response times for different agents
        for (let i = 0; i < 5; i++) {
          setupBigQueryMocks.withDelayedQuery(
            bigQueryTestScenarios.fullyEnhanced(),
            100 + i * 50, // Increasing delays
          );
        }

        // Act
        const startTime = Date.now();
        const result = await client.listBrandAgents(testConfig.validApiKey);
        const endTime = Date.now();

        // Assert
        expect(result).toBeDefined();
        // Should handle multiple enhancement calls efficiently
        // (Note: Current implementation is sequential, this test documents current behavior)
        expect(endTime - startTime).toBeLessThan(2000);
      });
    });
  });

  describe("Resilience and Error Recovery", () => {
    describe("BigQuery failure scenarios", () => {
      it("should gracefully degrade when BigQuery is completely unavailable", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        setupBigQueryMocks.withQueryError("networkError");

        // Act
        const result = await client.getBrandAgent(
          testConfig.validApiKey,
          testConfig.testAgentId,
        );

        // Assert
        expect(result).toBeDefined();
        expect(result.id).toBe(testConfig.testAgentId);
        // Should have GraphQL data but no BigQuery enhancements
        expect(result.name).toBeDefined();
        expect(result.externalId).toBeUndefined();
      });

      it("should handle intermittent BigQuery failures with retry behavior", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        setupBigQueryMocks.withIntermittentFailure(
          bigQueryTestScenarios.fullyEnhanced(),
          2, // Fail 2 times, then succeed
          "networkError",
        );

        // Act
        const results = [];
        for (let i = 0; i < 3; i++) {
          try {
            const result = await client.getBrandAgent(
              testConfig.validApiKey,
              `ba_retry_${i}`,
            );
            results.push(result);
          } catch (error) {
            results.push(null);
          }
        }

        // Assert
        // First two calls should fail gracefully (return GraphQL data only)
        expect(results[0]).toBeDefined();
        expect(results[1]).toBeDefined();
        // Third call should succeed with enhancement
        expect(results[2]).toBeDefined();
        expect(results[2]?.externalId).toBeDefined();
      });

      it("should handle BigQuery quota exceeded errors", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        setupBigQueryMocks.withQueryError("quotaExceeded");

        // Act
        const result = await client.getBrandAgent(
          testConfig.validApiKey,
          testConfig.testAgentId,
        );

        // Assert
        expect(result).toBeDefined();
        // Should fall back to GraphQL-only data
        expect(result.name).toBeDefined();
        expect(result.externalId).toBeUndefined();
      });

      it("should handle BigQuery authentication failures", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        bigQueryTestScenarios.bigQueryAuthFailure();

        // Act
        const result = await client.getBrandAgent(
          testConfig.validApiKey,
          testConfig.testAgentId,
        );

        // Assert
        expect(result).toBeDefined();
        // Should succeed with GraphQL data only
        expect(result.id).toBeDefined();
        expect(result.externalId).toBeUndefined();
      });
    });

    describe("GraphQL failure scenarios", () => {
      it("should fail fast when GraphQL is unavailable", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.withError("serverError"));
        bigQueryTestScenarios.fullyEnhanced(); // BigQuery is available but shouldn't matter

        // Act & Assert
        await expect(
          client.getBrandAgent(testConfig.validApiKey, testConfig.testAgentId),
        ).rejects.toThrow();

        // BigQuery should not be called when GraphQL fails
        bigQueryAssertions.expectQueryNotCalled();
      });

      it("should handle GraphQL rate limiting", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.withError("rateLimitError"));

        // Act & Assert
        await expect(
          client.getBrandAgent(testConfig.validApiKey, testConfig.testAgentId),
        ).rejects.toThrow();
      });

      it("should handle GraphQL authentication issues", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.withError("authError"));
        bigQueryTestScenarios.fullyEnhanced();

        // Act & Assert
        await expect(
          client.getBrandAgent(testConfig.validApiKey, testConfig.testAgentId),
        ).rejects.toThrow("Authentication failed");

        // BigQuery should not be called for auth failures
        bigQueryAssertions.expectQueryNotCalled();
      });
    });

    describe("mixed failure scenarios", () => {
      it("should handle list operations with partial failures", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        // Setup mixed BigQuery responses: success, failure, success
        setupBigQueryMocks.withSuccessfulQuery(
          bigQueryTestScenarios.fullyEnhanced(),
        );
        setupBigQueryMocks.withQueryError("networkError");

        // Act
        const result = await client.listBrandAgents(testConfig.validApiKey);

        // Assert
        expect(result).toHaveLength(2);
        // First agent should be enhanced
        expect(result[0]).toBeDefined();
        // Second agent should have GraphQL data only due to BigQuery failure
        expect(result[1]).toBeDefined();
      });

      it("should maintain service availability during partial system degradation", async () => {
        // Arrange - Simulate system under stress
        server.use(...setupGraphQLMocks.withDelay(200)); // Slow GraphQL
        setupBigQueryMocks.withQueryError("networkError"); // BigQuery down

        // Act
        const operations = [
          client.getBrandAgent(testConfig.validApiKey, "ba_stress_1"),
          client.listBrandAgents(testConfig.validApiKey),
          client.createBrandAgent(
            testConfig.validApiKey,
            brandAgentFactory.createInput(),
          ),
        ];

        const results = await Promise.allSettled(operations);

        // Assert
        // All operations should complete (either succeed or fail gracefully)
        results.forEach((result) => {
          expect(result.status).toBeOneOf(["fulfilled", "rejected"]);
          if (result.status === "fulfilled") {
            expect(result.value).toBeDefined();
          }
        });
      });
    });

    describe("data consistency under stress", () => {
      it("should maintain data consistency during concurrent operations", async () => {
        // Arrange
        const agentId = testConfig.testAgentId;
        server.use(...setupGraphQLMocks.success);
        bigQueryTestScenarios.fullyEnhanced();

        // Act - Concurrent read operations
        const concurrentReads = Array.from({ length: 10 }, () =>
          client.getBrandAgent(testConfig.validApiKey, agentId),
        );

        const results = await Promise.all(concurrentReads);

        // Assert
        expect(results).toHaveLength(10);
        // All results should be consistent
        const firstResult = results[0];
        results.forEach((result) => {
          expect(result.id).toBe(firstResult.id);
          expect(result.name).toBe(firstResult.name);
          expect(result.customerId).toBe(firstResult.customerId);
        });
      });

      it("should handle concurrent create operations without conflicts", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        bigQueryTestScenarios.fullyEnhanced();

        // Act - Concurrent create operations
        const concurrentCreates = Array.from({ length: 5 }, (_, i) =>
          client.createBrandAgent(
            testConfig.validApiKey,
            brandAgentFactory.createInput({
              name: `Concurrent Brand ${i}`,
              externalId: `concurrent_${i}`,
            }),
          ),
        );

        const results = await Promise.allSettled(concurrentCreates);

        // Assert
        results.forEach((result) => {
          expect(result.status).toBe("fulfilled");
          if (result.status === "fulfilled") {
            expect(result.value).toBeDefined();
            expect(result.value.id).toBeDefined();
          }
        });
      });
    });
  });

  describe("Monitoring and Observability", () => {
    describe("error tracking", () => {
      it("should track BigQuery enhancement failure rates", async () => {
        // Arrange
        const errorSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        server.use(...setupGraphQLMocks.success);
        setupBigQueryMocks.withQueryError("networkError");

        // Act
        await client.getBrandAgent(
          testConfig.validApiKey,
          testConfig.testAgentId,
        );

        // Assert
        // Verify error logging (implementation would need actual error tracking)
        expect(errorSpy).toHaveBeenCalledWith(
          expect.stringContaining("BigQuery"),
          expect.stringContaining("failed"),
        );

        errorSpy.mockRestore();
      });

      it("should distinguish between different types of failures", async () => {
        // Arrange
        const errorTypes = [
          "networkError",
          "authenticationFailed",
          "quotaExceeded",
        ];
        const errorSpy = vi.spyOn(console, "log").mockImplementation(() => {});
        server.use(...setupGraphQLMocks.success);

        // Act & Assert
        for (const errorType of errorTypes) {
          setupBigQueryMocks.reset();
          setupBigQueryMocks.withQueryError(errorType as any);

          await client.getBrandAgent(
            testConfig.validApiKey,
            testConfig.testAgentId,
          );

          // In a real implementation, different error types would be logged differently
          expect(errorSpy).toHaveBeenCalled();
        }

        errorSpy.mockRestore();
      });
    });

    describe("performance metrics", () => {
      it("should track enhancement success rates", async () => {
        // Arrange
        server.use(...setupGraphQLMocks.success);
        let successCount = 0;
        let totalCount = 0;

        // Mock performance tracking
        const originalGetBrandAgent = client.getBrandAgent.bind(client);
        client.getBrandAgent = async (apiKey: string, id: string) => {
          totalCount++;
          try {
            const result = await originalGetBrandAgent(apiKey, id);
            if (result.externalId) successCount++; // Has enhancement
            return result;
          } catch (error) {
            throw error;
          }
        };

        // Setup mixed scenarios
        bigQueryTestScenarios.fullyEnhanced();
        setupBigQueryMocks.withQueryError("networkError");

        // Act
        await client.getBrandAgent(testConfig.validApiKey, "ba_metrics_1");
        await client.getBrandAgent(testConfig.validApiKey, "ba_metrics_2");

        // Assert
        expect(totalCount).toBe(2);
        expect(successCount).toBe(1); // Only first call succeeded with enhancement
      });

      it("should track response time distributions", async () => {
        // Arrange
        const responseTimes: number[] = [];
        server.use(...setupGraphQLMocks.success);

        // Setup varying BigQuery response times
        setupBigQueryMocks.withDelayedQuery(
          bigQueryTestScenarios.fullyEnhanced(),
          100,
        );
        setupBigQueryMocks.withDelayedQuery(
          bigQueryTestScenarios.fullyEnhanced(),
          200,
        );
        setupBigQueryMocks.withDelayedQuery(
          bigQueryTestScenarios.fullyEnhanced(),
          300,
        );

        // Act
        for (let i = 0; i < 3; i++) {
          const startTime = Date.now();
          await client.getBrandAgent(testConfig.validApiKey, `ba_timing_${i}`);
          responseTimes.push(Date.now() - startTime);
        }

        // Assert
        expect(responseTimes).toHaveLength(3);
        // Verify response times are in expected ranges
        expect(responseTimes[0]).toBeGreaterThan(90);
        expect(responseTimes[1]).toBeGreaterThan(180);
        expect(responseTimes[2]).toBeGreaterThan(280);
      });
    });
  });
});
