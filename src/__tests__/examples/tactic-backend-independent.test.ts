/**
 * Example: Backend-Independent Tactic Repository Testing
 *
 * This demonstrates how contract tests ensure that any backend implementation
 * (BigQuery, PostgreSQL, etc.) satisfies the same behavioral requirements.
 */

import { TacticRepositoryTestDouble } from "../../test-doubles/tactic-repository-test-double.js";
import { testTacticRepositoryContract } from "../contracts/tactic-repository.contract.test.js";

describe("Tactic Repository Contract Validation with Test Double", () => {
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

    // Auth setup - use the shared instance
    async () => {
      if (!sharedTestDouble) {
        sharedTestDouble = new TacticRepositoryTestDouble();
      }

      const validApiKey = "test_api_key_valid";
      const invalidApiKey = "test_api_key_invalid";

      // Set up authentication on the shared instance
      sharedTestDouble.addValidApiKey(validApiKey);

      // Set up prebid test data
      const orgId = "test_org_123";
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
        mediaProductId: "media_product_test_123",
        salesAgentId: salesAgentIds[0],
        validApiKey,
      };
    },

    // Auth teardown - cleanup if needed
    async (_authData) => {
      // Clear the shared test double for the next test run
      if (sharedTestDouble) {
        sharedTestDouble.clear();
      }
      sharedTestDouble = null;
    },
  );

  describe("Prebid Integration (Test Double Specific)", () => {
    let testDouble: TacticRepositoryTestDouble;

    beforeEach(() => {
      testDouble = new TacticRepositoryTestDouble();
    });

    it("should demonstrate prebid query chain with test data", async () => {
      const orgId = "demo_publisher_org";

      // Set up comprehensive test data
      const { campaignIds, salesAgentIds, tacticIds } =
        testDouble.setupPrebidTestData(
          orgId,
          3, // 3 sales agents
          2, // 2 campaigns per agent
          4, // 4 tactics per campaign
        );

      // Verify test data was created
      expect(salesAgentIds).toHaveLength(3);
      expect(campaignIds).toHaveLength(6); // 3 agents × 2 campaigns
      expect(tacticIds).toHaveLength(24); // 6 campaigns × 4 tactics

      // Test prebid segment retrieval
      const segments = await testDouble.getPrebidSegments(orgId);

      // Should return all unique segments
      expect(segments.length).toBeGreaterThan(0);
      expect(segments.length).toBeLessThanOrEqual(24); // Max possible

      // Verify ordering by CPM
      for (let i = 1; i < segments.length; i++) {
        expect(segments[i - 1].max_cpm).toBeGreaterThanOrEqual(
          segments[i].max_cpm,
        );
      }

      // Verify segment structure
      segments.forEach((segment) => {
        expect(segment.axe_include_segment).toMatch(/^axe_/);
        expect(segment.max_cpm).toBeGreaterThan(0);
      });
    });

    it("should handle multiple tactics with same segment (max CPM logic)", async () => {
      const orgId = "max_cpm_test_org";
      testDouble.setupPrebidTestData(orgId);

      // Create tactics with same segment but different CPMs
      const validApiKey = "test_key";
      testDouble.addValidApiKey(validApiKey);

      const { campaignIds, salesAgentIds } = testDouble.setupPrebidTestData(
        orgId,
        1,
        1,
        0,
      );

      // Create two tactics with same segment but different CPMs
      const sharedSegment = "axe_shared_segment_test";

      const tactic1 = await testDouble.createTactic(
        validApiKey,
        {
          budgetAllocation: { amount: 1000, currency: "USD", pacing: "even" },
          campaignId: campaignIds[0],
          mediaProductId: "media_1",
          name: "Low CPM Tactic",
        },
        { cpm: 5.0, currency: "USD", totalCpm: 5.0 },
        salesAgentIds[0],
      );

      const tactic2 = await testDouble.createTactic(
        validApiKey,
        {
          budgetAllocation: { amount: 1000, currency: "USD", pacing: "even" },
          campaignId: campaignIds[0],
          mediaProductId: "media_2",
          name: "High CPM Tactic",
        },
        { cpm: 15.0, currency: "USD", totalCpm: 15.0 },
        salesAgentIds[0],
      );

      // Override segments to be the same - we need to update them in the test double's storage
      // Get the tactics from storage and update them there
      testDouble.updateTacticSegment(tactic1.id, sharedSegment);
      testDouble.updateTacticSegment(tactic2.id, sharedSegment);

      const segments = await testDouble.getPrebidSegments(orgId);

      // Should find the shared segment with max CPM
      const sharedSegmentResult = segments.find(
        (s) => s.axe_include_segment === sharedSegment,
      );

      expect(sharedSegmentResult).toBeDefined();
      expect(sharedSegmentResult!.max_cpm).toBe(15.0); // Should use higher CPM
    });
  });
});

// Example of how you would test a real BigQuery implementation:
/*
describe("Tactic Repository Contract Validation with BigQuery", () => {
  testTacticRepositoryContract(
    () => new TacticBigQueryService("test-project", "test-dataset"),
    async () => {
      // Set up real test data in BigQuery
      const setup = new BigQueryTestSetup();
      return await setup.createTestData();
    },
    async (authData) => {
      // Clean up BigQuery test data
      const cleanup = new BigQueryTestCleanup();
      await cleanup.deleteTestData(authData);
    }
  );
});
*/
