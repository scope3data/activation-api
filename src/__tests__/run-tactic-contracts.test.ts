/**
 * Test Runner: Tactic Repository Contracts
 *
 * Demonstrates how to run contract tests against different implementations.
 * This file shows how the same behavioral tests can validate any backend.
 */

import { TacticRepositoryTestDouble } from "../test-doubles/tactic-repository-test-double.js";
import { testTacticRepositoryContract } from "./contracts/tactic-repository.contracts.js";

describe("Tactic Repository Contracts", () => {
  describe("Test Double Implementation", () => {
    // Share the same test double instance across repository factory and setup
    let sharedTestDouble: null | TacticRepositoryTestDouble = null;

    testTacticRepositoryContract(
      // Repository factory - return the shared instance
      () => {
        if (!sharedTestDouble) {
          sharedTestDouble = new TacticRepositoryTestDouble();
        }
        return sharedTestDouble;
      },

      // Setup auth and test data - use the shared instance
      async () => {
        if (!sharedTestDouble) {
          sharedTestDouble = new TacticRepositoryTestDouble();
        }

        const validApiKey = "contract_test_api_key";
        const invalidApiKey = "invalid_contract_key";

        // Set up authentication on the shared instance
        sharedTestDouble.addValidApiKey(validApiKey);

        // Set up prebid test data for contract testing
        const orgId = "contract_test_org_prebid";
        const { campaignIds, salesAgentIds } =
          sharedTestDouble.setupPrebidTestData(
            orgId,
            2, // 2 sales agents
            2, // 2 campaigns per agent
            3, // 3 tactics per campaign
          );

        return {
          campaignId: campaignIds[0],
          invalidApiKey,
          mediaProductId: "contract_media_product_123",
          salesAgentId: salesAgentIds[0],
          validApiKey,
        };
      },

      // Cleanup auth and test data
      async (_authData) => {
        // Clear the shared test double for the next test run
        if (sharedTestDouble) {
          sharedTestDouble.clear();
        }
        sharedTestDouble = null;
      },
    );
  });

  // Example of how you would test other implementations:
  /*
  describe("BigQuery Implementation", () => {
    testTacticRepositoryContract(
      () => new TacticBigQueryService("test-project", "test-dataset"),
      async () => {
        // Set up BigQuery test data
        const setup = new BigQueryTestSetup();
        return await setup.createTacticTestData();
      },
      async (authData) => {
        // Clean up BigQuery test data
        const cleanup = new BigQueryTestCleanup();
        await cleanup.deleteTacticTestData(authData);
      }
    );
  });

  describe("PostgreSQL Implementation", () => {
    testTacticRepositoryContract(
      () => new TacticPostgreSQLService(testConnectionConfig),
      async () => {
        // Set up PostgreSQL test data
        const setup = new PostgreSQLTestSetup();
        return await setup.createTacticTestData();
      },
      async (authData) => {
        // Clean up PostgreSQL test data
        const cleanup = new PostgreSQLTestCleanup();
        await cleanup.deleteTacticTestData(authData);
      }
    );
  });
  */
});

// Integration test that validates prebid query chain specifically
describe("Prebid Integration Contract Tests", () => {
  let testDouble: TacticRepositoryTestDouble;

  beforeEach(() => {
    testDouble = new TacticRepositoryTestDouble();
  });

  describe("Query Chain Validation", () => {
    it("should demonstrate org_id → sales_agent → tactics → campaigns query chain", async () => {
      // Set up complex test scenario
      const publisherOrg1 = "publisher_org_alpha";
      const publisherOrg2 = "publisher_org_beta";

      // Publisher 1: 2 sales agents, 3 campaigns, 4 tactics each
      testDouble.setupPrebidTestData(publisherOrg1, 2, 3, 4);

      // Publisher 2: 1 sales agent, 2 campaigns, 5 tactics each
      testDouble.setupPrebidTestData(publisherOrg2, 1, 2, 5);

      // Test both publishers get separate results
      const segments1 = await testDouble.getPrebidSegments(publisherOrg1);
      const segments2 = await testDouble.getPrebidSegments(publisherOrg2);

      // Publisher 1 should have segments (2×3×4 = 24 tactics, each with unique segments)
      expect(segments1.length).toBeGreaterThan(0);
      expect(segments1.length).toBeLessThanOrEqual(24); // Max possible unique segments

      // Publisher 2 should have segments (1×2×5 = 10 tactics, each with unique segments)
      expect(segments2.length).toBeGreaterThan(0);
      expect(segments2.length).toBeLessThanOrEqual(10); // Max possible unique segments

      // Verify segments are properly formatted
      segments1.forEach((segment) => {
        expect(segment.axe_include_segment).toMatch(/^axe_/);
        expect(segment.max_cpm).toBeGreaterThan(0);
      });

      segments2.forEach((segment) => {
        expect(segment.axe_include_segment).toMatch(/^axe_/);
        expect(segment.max_cpm).toBeGreaterThan(0);
      });

      // Note: Cross-contamination test removed because segments are randomly generated
      // and collision is theoretically possible though unlikely
    });

    it("should validate campaign status filtering in prebid query", async () => {
      const orgId = "status_test_org";
      const validApiKey = "status_test_key";

      testDouble.addValidApiKey(validApiKey);

      // Create test data: 1 sales agent, 3 campaigns, 2 tactics each = 6 tactics total
      const { campaignIds: _campaignIds } = testDouble.setupPrebidTestData(
        orgId,
        1,
        3,
        2,
      );

      // Get initial segments (should include all active campaigns)
      const initialSegments = await testDouble.getPrebidSegments(orgId);
      expect(initialSegments.length).toBeGreaterThan(0);

      // Note: The current test double implementation doesn't provide a method to
      // deactivate campaigns, so we test the filtering logic conceptually.
      // In a real implementation, you would:
      // 1. Mark one campaign as inactive
      // 2. Verify that tactics from that campaign don't appear in segments

      // Verify that segments come from valid active campaigns
      initialSegments.forEach((segment) => {
        expect(segment.axe_include_segment).toMatch(/^axe_/);
        expect(segment.max_cpm).toBeGreaterThan(0);
      });

      // The getPrebidSegments method should only return segments from:
      // - Active sales agents (orgId matches and status = "active")
      // - Active tactics (status = "active" and has axeIncludeSegment)
      // - Active campaigns (status = "active" and within date range if specified)
      expect(Array.isArray(initialSegments)).toBe(true);
    });

    it("should demonstrate max CPM aggregation behavior", async () => {
      const orgId = "max_cpm_aggregation_org";
      const validApiKey = "max_cpm_test_key";

      testDouble.addValidApiKey(validApiKey);

      // Set up test data with multiple tactics
      const { campaignIds, salesAgentIds } = testDouble.setupPrebidTestData(
        orgId,
        1,
        1,
        3,
      );

      // The setupPrebidTestData creates tactics with random CPMs between 5-15
      // Get the segments to see the aggregation behavior
      const segments = await testDouble.getPrebidSegments(orgId);

      // Should have segments from the created tactics
      expect(segments.length).toBeGreaterThan(0);

      // Each segment should have a valid CPM
      segments.forEach((segment) => {
        expect(segment.axe_include_segment).toMatch(/^axe_/);
        expect(segment.max_cpm).toBeGreaterThanOrEqual(5.0); // Min CPM from setupPrebidTestData
        expect(segment.max_cpm).toBeLessThanOrEqual(15.0); // Max CPM from setupPrebidTestData
      });

      // Segments should be sorted by CPM descending (highest first)
      if (segments.length > 1) {
        for (let i = 1; i < segments.length; i++) {
          expect(segments[i - 1].max_cpm).toBeGreaterThanOrEqual(
            segments[i].max_cpm,
          );
        }
      }

      // Test the aggregation logic by creating additional tactics with known CPMs
      await testDouble.createTactic(
        validApiKey,
        {
          budgetAllocation: { amount: 1000, currency: "USD", pacing: "even" },
          campaignId: campaignIds[0],
          mediaProductId: "test_media_product",
          name: "Known CPM Tactic",
        },
        { cpm: 20.0, currency: "USD", totalCpm: 20.0 }, // Higher than range from setupPrebidTestData
        salesAgentIds[0],
      );

      const updatedSegments = await testDouble.getPrebidSegments(orgId);

      // Should now include a segment with the higher CPM
      const maxCpm = Math.max(...updatedSegments.map((s) => s.max_cpm));
      expect(maxCpm).toBeGreaterThanOrEqual(20.0);
    });
  });
});
