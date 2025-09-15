import { beforeEach, describe, expect, it } from "vitest";

import { Scope3ApiClient } from "../../client/scope3-client.js";
import { brandAgentFactory } from "../fixtures/brand-agent-fixtures.js";
import {
  bigQueryAssertions,
  bigQueryTestScenarios,
  setupBigQueryMocks,
} from "../setup/bigquery-mocks.js";
import { setupGraphQLMocks } from "../setup/graphql-mocks.js";
import { server, testConfig } from "../setup/test-setup.js";

/**
 * End-to-End Integration Tests for Brand Agent Enhancement Pattern
 * Tests complete workflows and real-world scenarios
 */

describe("Brand Agent Enhancement - End-to-End Integration", () => {
  let client: Scope3ApiClient;

  beforeEach(() => {
    client = new Scope3ApiClient(testConfig.graphqlUrl);
    setupBigQueryMocks.reset();
    server.resetHandlers();
  });

  describe("Complete Brand Agent Lifecycle", () => {
    it("should handle full CRUD lifecycle with enhancement", async () => {
      // Arrange
      server.use(...setupGraphQLMocks.success);

      const createInput = brandAgentFactory.createInput({
        description: "Full lifecycle test",
        externalId: "lifecycle_123",
        name: "Lifecycle Test Brand",
        nickname: "LifecycleBrand",
      });

      // 1. CREATE - Setup mocks for creation
      setupBigQueryMocks.withSuccessfulQuery(bigQueryTestScenarios.empty()); // Extension creation
      bigQueryTestScenarios.fullyEnhanced(); // Final fetch after creation

      // Act - Create
      const created = await client.createBrandAgent(
        testConfig.validApiKey,
        createInput,
      );

      // Assert - Create
      expect(created).toBeDefined();
      expect(created.name).toBe(createInput.name);
      expect(created.externalId).toBe(createInput.externalId);
      expect(created.nickname).toBe(createInput.nickname);
      bigQueryAssertions.expectQueryCalled("MERGE"); // Extension was created

      // 2. READ - Setup mocks for retrieval
      setupBigQueryMocks.reset();
      bigQueryTestScenarios.fullyEnhanced();

      // Act - Read
      const retrieved = await client.getBrandAgent(
        testConfig.validApiKey,
        created.id,
      );

      // Assert - Read
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(created.id);
      expect(retrieved.externalId).toBe(createInput.externalId);
      expect(retrieved.nickname).toBe(createInput.nickname);

      // 3. UPDATE - Setup mocks for update
      setupBigQueryMocks.reset();
      const updateInput = brandAgentFactory.updateInput({
        description: "Updated description",
        name: "Updated Lifecycle Brand",
        nickname: "UpdatedLifecycleBrand",
      });

      setupBigQueryMocks.withSuccessfulQuery(bigQueryTestScenarios.empty()); // Update
      bigQueryTestScenarios.fullyEnhanced(); // Final fetch

      // Act - Update
      const updated = await client.updateBrandAgent(
        testConfig.validApiKey,
        created.id,
        updateInput,
      );

      // Assert - Update
      expect(updated).toBeDefined();
      expect(updated.name).toBe(updateInput.name);
      expect(updated.nickname).toBe(updateInput.nickname);
      expect(updated.description).toBe(updateInput.description);
      bigQueryAssertions.expectQueryCallCount(2); // Update + final fetch

      // 4. LIST - Verify in list
      setupBigQueryMocks.reset();
      bigQueryTestScenarios.fullyEnhanced(); // For each agent in list

      // Act - List
      const list = await client.listBrandAgents(testConfig.validApiKey);

      // Assert - List
      expect(list).toBeDefined();
      expect(list.length).toBeGreaterThan(0);
      const foundInList = list.find((agent) => agent.id === created.id);
      expect(foundInList).toBeDefined();
      expect(foundInList?.name).toBe(updateInput.name);
    });

    it("should handle partial enhancement scenarios gracefully", async () => {
      // Arrange - Mix of GraphQL-only and enhanced agents
      server.use(...setupGraphQLMocks.success);

      // 1. Create GraphQL-only agent
      const graphqlOnlyInput = brandAgentFactory.createInput({
        customerId: testConfig.testCustomerId,
        name: "GraphQL Only Brand",
        // No externalId or nickname
      });

      // Act - Create GraphQL-only
      const graphqlOnlyAgent = await client.createBrandAgent(
        testConfig.validApiKey,
        graphqlOnlyInput,
      );

      // Assert - No BigQuery calls for GraphQL-only
      expect(graphqlOnlyAgent).toBeDefined();
      bigQueryAssertions.expectQueryNotCalled();

      // 2. Create fully enhanced agent
      setupBigQueryMocks.reset();
      const enhancedInput = brandAgentFactory.createInput({
        externalId: "enhanced_123",
        name: "Enhanced Brand",
        nickname: "EnhancedBrand",
      });

      setupBigQueryMocks.withSuccessfulQuery(bigQueryTestScenarios.empty()); // Extension creation
      bigQueryTestScenarios.fullyEnhanced(); // Final fetch

      // Act - Create enhanced
      const enhancedAgent = await client.createBrandAgent(
        testConfig.validApiKey,
        enhancedInput,
      );

      // Assert - BigQuery extension created
      expect(enhancedAgent).toBeDefined();
      expect(enhancedAgent.externalId).toBe(enhancedInput.externalId);
      bigQueryAssertions.expectQueryCalled("MERGE");

      // 3. List both agents
      setupBigQueryMocks.reset();
      bigQueryTestScenarios.graphqlOnly(); // First agent has no enhancement
      bigQueryTestScenarios.fullyEnhanced(); // Second agent is enhanced

      // Act - List
      const allAgents = await client.listBrandAgents(testConfig.validApiKey);

      // Assert - Mixed enhancement states
      expect(allAgents).toHaveLength(2);
      // One enhanced, one GraphQL-only
      const enhancedCount = allAgents.filter(
        (agent) => agent.externalId,
      ).length;
      const graphqlOnlyCount = allAgents.filter(
        (agent) => !agent.externalId,
      ).length;
      expect(enhancedCount).toBe(1);
      expect(graphqlOnlyCount).toBe(1);
    });
  });

  describe("Real-World Usage Scenarios", () => {
    it("should handle brand agent onboarding workflow", async () => {
      // Arrange - Simulate customer onboarding a new brand
      server.use(...setupGraphQLMocks.success);

      const brandDetails = {
        advertiserDomains: ["acme.com", "acmecorp.com"],
        description: "Global technology company",
        dspSeats: ["DV360_ACME", "TTD_ACME", "AMAZON_DSP_ACME"],
        externalId: "acme_corp_2024",
        name: "Acme Corporation",
        nickname: "AcmeCorp",
      };

      // 1. Initial brand creation
      setupBigQueryMocks.withSuccessfulQuery(bigQueryTestScenarios.empty());
      bigQueryTestScenarios.fullyEnhanced();

      // Act - Create brand
      const brand = await client.createBrandAgent(
        testConfig.validApiKey,
        brandDetails,
      );

      // Assert - Brand created with all enhancements
      expect(brand).toBeDefined();
      expect(brand.name).toBe(brandDetails.name);
      expect(brand.externalId).toBe(brandDetails.externalId);
      expect(brand.nickname).toBe(brandDetails.nickname);
      expect(brand.advertiserDomains).toEqual(
        expect.arrayContaining(brandDetails.advertiserDomains),
      );
      expect(brand.dspSeats).toEqual(
        expect.arrayContaining(brandDetails.dspSeats),
      );

      // 2. Update with additional DSP seats after campaign setup
      setupBigQueryMocks.reset();
      const additionalSeats = [
        ...brandDetails.dspSeats,
        "ROKU_ACME",
        "SAMSUNG_DSP_ACME",
      ];

      setupBigQueryMocks.withSuccessfulQuery(bigQueryTestScenarios.empty()); // Update
      bigQueryTestScenarios.fullyEnhanced(); // Final fetch

      // Act - Update DSP seats
      const updatedBrand = await client.updateBrandAgent(
        testConfig.validApiKey,
        brand.id,
        {
          dspSeats: additionalSeats,
        },
      );

      // Assert - Additional seats added
      expect(updatedBrand.dspSeats).toEqual(
        expect.arrayContaining(additionalSeats),
      );
      bigQueryAssertions.expectQueryCallCount(2);

      // 3. Verify brand can be found by various identifiers
      setupBigQueryMocks.reset();
      bigQueryTestScenarios.fullyEnhanced();

      // Act - Retrieve by different methods
      const byId = await client.getBrandAgent(testConfig.validApiKey, brand.id);

      // Assert - Consistent data across retrieval methods
      expect(byId).toBeDefined();
      expect(byId.id).toBe(brand.id);
      expect(byId.externalId).toBe(brandDetails.externalId);
      expect(byId.nickname).toBe(brandDetails.nickname);
    });

    it("should handle enterprise customer with multiple brands", async () => {
      // Arrange - Enterprise customer with multiple brands
      server.use(...setupGraphQLMocks.success);

      const brands = [
        {
          advertiserDomains: ["brand-a.com"],
          externalId: "ent_brand_a",
          name: "Enterprise Brand A",
          nickname: "BrandA",
        },
        {
          advertiserDomains: ["brand-b.com"],
          externalId: "ent_brand_b",
          name: "Enterprise Brand B",
          nickname: "BrandB",
        },
        {
          advertiserDomains: ["brand-c.com"],
          externalId: "ent_brand_c",
          name: "Enterprise Brand C",
          nickname: "BrandC",
        },
      ];

      // Act - Create multiple brands
      const createdBrands = [];
      for (const brandData of brands) {
        setupBigQueryMocks.reset();
        setupBigQueryMocks.withSuccessfulQuery(bigQueryTestScenarios.empty()); // Extension creation
        bigQueryTestScenarios.fullyEnhanced(); // Final fetch

        const created = await client.createBrandAgent(
          testConfig.validApiKey,
          brandData,
        );
        createdBrands.push(created);
      }

      // Assert - All brands created successfully
      expect(createdBrands).toHaveLength(3);
      createdBrands.forEach((brand, index) => {
        expect(brand.name).toBe(brands[index].name);
        expect(brand.externalId).toBe(brands[index].externalId);
        expect(brand.nickname).toBe(brands[index].nickname);
      });

      // Act - List all brands for customer
      setupBigQueryMocks.reset();
      brands.forEach(() => bigQueryTestScenarios.fullyEnhanced());

      const customerBrands = await client.listBrandAgents(
        testConfig.validApiKey,
      );

      // Assert - All brands visible in list
      expect(customerBrands.length).toBeGreaterThanOrEqual(3);
      brands.forEach((brandData) => {
        const found = customerBrands.find(
          (b) => b.externalId === brandData.externalId,
        );
        expect(found).toBeDefined();
        expect(found?.name).toBe(brandData.name);
      });
    });

    it("should handle system migration scenario", async () => {
      // Arrange - Migrating from legacy system
      server.use(...setupGraphQLMocks.success);

      // 1. Create brand in GraphQL only (simulating initial migration)
      const legacyBrand = brandAgentFactory.createInput({
        customerId: testConfig.testCustomerId,
        name: "Legacy Migrated Brand",
        // No BigQuery fields initially
      });

      // Act - Initial creation (GraphQL only)
      const initialBrand = await client.createBrandAgent(
        testConfig.validApiKey,
        legacyBrand,
      );

      // Assert - GraphQL-only creation
      expect(initialBrand).toBeDefined();
      expect(initialBrand.externalId).toBeUndefined();
      bigQueryAssertions.expectQueryNotCalled();

      // 2. Add BigQuery enhancements after migration
      setupBigQueryMocks.reset();
      const enhancementData = {
        advertiserDomains: ["legacy-brand.com"],
        description: "Migrated from legacy system",
        dspSeats: ["LEGACY_DSP_SEAT"],
        externalId: "legacy_migrated_123",
        nickname: "LegacyBrand",
      };

      setupBigQueryMocks.withSuccessfulQuery(bigQueryTestScenarios.empty()); // Update
      bigQueryTestScenarios.fullyEnhanced(); // Final fetch

      // Act - Update with enhancements
      const enhancedBrand = await client.updateBrandAgent(
        testConfig.validApiKey,
        initialBrand.id,
        enhancementData,
      );

      // Assert - Now has full enhancements
      expect(enhancedBrand).toBeDefined();
      expect(enhancedBrand.externalId).toBe(enhancementData.externalId);
      expect(enhancedBrand.nickname).toBe(enhancementData.nickname);
      expect(enhancedBrand.description).toBe(enhancementData.description);
      bigQueryAssertions.expectQueryCallCount(2); // Update + fetch

      // 3. Verify enhanced data persists
      setupBigQueryMocks.reset();
      bigQueryTestScenarios.fullyEnhanced();

      // Act - Retrieve after enhancement
      const finalBrand = await client.getBrandAgent(
        testConfig.validApiKey,
        initialBrand.id,
      );

      // Assert - Enhancement data persisted
      expect(finalBrand).toBeDefined();
      expect(finalBrand.externalId).toBe(enhancementData.externalId);
      expect(finalBrand.nickname).toBe(enhancementData.nickname);
    });
  });

  describe("Error Recovery and Degradation", () => {
    it("should handle complete BigQuery outage gracefully", async () => {
      // Arrange - BigQuery completely unavailable
      server.use(...setupGraphQLMocks.success);

      // All BigQuery operations fail
      const setupFailures = () => {
        setupBigQueryMocks.reset();
        setupBigQueryMocks.withQueryError("networkError");
      };

      // Act & Assert - All operations should succeed with GraphQL-only data

      // 1. Get operation
      setupFailures();
      const retrieved = await client.getBrandAgent(
        testConfig.validApiKey,
        testConfig.testAgentId,
      );
      expect(retrieved).toBeDefined();
      expect(retrieved.name).toBeDefined();
      expect(retrieved.externalId).toBeUndefined();

      // 2. List operation
      setupFailures();
      const list = await client.listBrandAgents(testConfig.validApiKey);
      expect(list).toBeDefined();
      expect(Array.isArray(list)).toBe(true);

      // 3. Create operation
      setupFailures();
      const created = await client.createBrandAgent(
        testConfig.validApiKey,
        brandAgentFactory.createInput({ externalId: "should_fail_but_work" }),
      );
      expect(created).toBeDefined();
      expect(created.name).toBeDefined();

      // 4. Update operation
      setupFailures();
      const updated = await client.updateBrandAgent(
        testConfig.validApiKey,
        testConfig.testAgentId,
        brandAgentFactory.updateInput({ nickname: "should_fail_but_work" }),
      );
      expect(updated).toBeDefined();
      expect(updated.name).toBeDefined();
    });

    it("should handle partial system recovery", async () => {
      // Arrange - System recovering from outage
      server.use(...setupGraphQLMocks.success);

      // Simulate intermittent BigQuery availability
      let callCount = 0;
      const simulateRecovery = () => {
        callCount++;
        if (callCount <= 2) {
          setupBigQueryMocks.withQueryError("networkError"); // Fail first 2 calls
        } else {
          bigQueryTestScenarios.fullyEnhanced(); // Succeed after recovery
        }
      };

      // Act - Multiple operations during recovery
      const results = [];
      for (let i = 0; i < 4; i++) {
        setupBigQueryMocks.reset();
        simulateRecovery();

        const result = await client.getBrandAgent(
          testConfig.validApiKey,
          `ba_recovery_${i}`,
        );
        results.push(result);
      }

      // Assert - Operations succeed throughout recovery
      expect(results).toHaveLength(4);
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.name).toBeDefined();

        if (index < 2) {
          // First 2 calls: GraphQL only (BigQuery failed)
          expect(result.externalId).toBeUndefined();
        } else {
          // Last 2 calls: Enhanced (BigQuery recovered)
          expect(result.externalId).toBeDefined();
        }
      });
    });

    it("should maintain service quality during high load with failures", async () => {
      // Arrange - High load with some failures
      server.use(...setupGraphQLMocks.withDelay(50)); // Slightly slow GraphQL

      // Mix of successful and failed BigQuery calls
      const setupMixedResponses = () => {
        for (let i = 0; i < 20; i++) {
          if (i % 3 === 0) {
            setupBigQueryMocks.withQueryError("rateLimitExceeded"); // Some failures
          } else {
            bigQueryTestScenarios.fullyEnhanced(); // Most succeed
          }
        }
      };

      setupMixedResponses();

      // Act - Concurrent high load operations
      const concurrentOperations = Array.from({ length: 20 }, (_, i) =>
        client.getBrandAgent(testConfig.validApiKey, `ba_load_${i}`),
      );

      const startTime = Date.now();
      const results = await Promise.allSettled(concurrentOperations);
      const endTime = Date.now();

      // Assert - All operations complete successfully
      expect(results).toHaveLength(20);
      results.forEach((result) => {
        expect(result.status).toBe("fulfilled");
        if (result.status === "fulfilled") {
          expect(result.value).toBeDefined();
          expect(result.value.name).toBeDefined();
        }
      });

      // Should complete within reasonable time despite load and failures
      expect(endTime - startTime).toBeLessThan(3000); // 3 seconds for 20 concurrent ops
    });
  });
});
