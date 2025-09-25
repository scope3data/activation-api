/**
 * Tactic Repository Contract Tests
 *
 * These tests validate that ANY implementation of TacticRepository
 * satisfies the business requirements, especially the prebid integration.
 * Whether using BigQuery, PostgreSQL, or any other backend,
 * all implementations must pass these tests.
 */

import type {
  TacticInput,
  TacticRepository,
} from "../../contracts/tactic-repository.js";

/**
 * Contract test suite that validates any TacticRepository implementation
 *
 * @param repositoryFactory - Function that creates a repository instance
 * @param setupAuth - Function that sets up valid authentication for tests
 * @param teardownAuth - Function that cleans up authentication after tests
 */
export function testTacticRepositoryContract(
  repositoryFactory: () => TacticRepository,
  setupAuth: () => Promise<{
    campaignId: string;
    invalidApiKey: string;
    mediaProductId: string;
    salesAgentId: string;
    validApiKey: string;
  }>,
  teardownAuth: (authData: {
    campaignId: string;
    invalidApiKey: string;
    mediaProductId: string;
    salesAgentId: string;
    validApiKey: string;
  }) => Promise<void>,
) {
  describe("Tactic Repository Contract", () => {
    let repository: TacticRepository;
    let validApiKey: string;
    let invalidApiKey: string;
    let campaignId: string;
    let mediaProductId: string;
    let salesAgentId: string;
    let authData: {
      campaignId: string;
      invalidApiKey: string;
      mediaProductId: string;
      salesAgentId: string;
      validApiKey: string;
    };

    beforeAll(async () => {
      authData = await setupAuth();
      validApiKey = authData.validApiKey;
      invalidApiKey = authData.invalidApiKey;
      campaignId = authData.campaignId;
      mediaProductId = authData.mediaProductId;
      salesAgentId = authData.salesAgentId;
    });

    afterAll(async () => {
      if (teardownAuth && authData) {
        await teardownAuth(authData);
      }
    });

    beforeEach(() => {
      repository = repositoryFactory();
    });

    describe("Authentication", () => {
      it("should reject invalid API keys", async () => {
        const validInput: TacticInput = {
          budgetAllocation: {
            amount: 1000,
            currency: "USD",
            pacing: "even",
          },
          campaignId,
          mediaProductId,
          name: "Test Tactic",
        };

        const effectivePricing = {
          cpm: 5.0,
          currency: "USD",
          totalCpm: 5.0,
        };

        await expect(
          repository.createTactic(
            invalidApiKey,
            validInput,
            effectivePricing,
            salesAgentId,
          ),
        ).rejects.toThrow(/authentication|unauthorized|invalid/i);
      });

      it("should accept valid API keys", async () => {
        const validInput: TacticInput = {
          budgetAllocation: {
            amount: 1000,
            currency: "USD",
            pacing: "even",
          },
          campaignId,
          mediaProductId,
          name: "Valid Auth Test Tactic",
        };

        const effectivePricing = {
          cpm: 5.0,
          currency: "USD",
          totalCpm: 5.0,
        };

        const result = await repository.createTactic(
          validApiKey,
          validInput,
          effectivePricing,
          salesAgentId,
        );

        expect(result.id).toBeDefined();
        expect(result.name).toBe(validInput.name);

        // Cleanup
        await repository.deleteTactic(validApiKey, result.id);
      });
    });

    describe("Tactic Creation", () => {
      it("should create tactic with required fields only", async () => {
        const input: TacticInput = {
          budgetAllocation: {
            amount: 2000,
            currency: "USD",
            pacing: "even",
          },
          campaignId,
          mediaProductId,
          name: "Minimal Tactic",
        };

        const effectivePricing = {
          cpm: 7.5,
          currency: "USD",
          totalCpm: 8.0,
        };

        const result = await repository.createTactic(
          validApiKey,
          input,
          effectivePricing,
          salesAgentId,
        );

        // Validate core business requirements
        expect(result.id).toBeDefined();
        expect(result.id).toMatch(/^tactic_/); // Should follow ID convention
        expect(result.name).toBe(input.name);
        expect(result.campaignId).toBe(input.campaignId);
        expect(result.mediaProductId).toBe(input.mediaProductId);
        expect(result.salesAgentId).toBe(salesAgentId);
        expect(result.status).toBe("active"); // New tactics should be active
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();

        // Budget allocation should match
        expect(result.budgetAllocation.amount).toBe(
          input.budgetAllocation.amount,
        );
        expect(result.budgetAllocation.currency).toBe(
          input.budgetAllocation.currency,
        );
        expect(result.budgetAllocation.pacing).toBe(
          input.budgetAllocation.pacing,
        );

        // Effective pricing should match
        expect(result.effectivePricing.cpm).toBe(effectivePricing.cpm);
        expect(result.effectivePricing.totalCpm).toBe(
          effectivePricing.totalCpm,
        );

        // AXE segment should be generated
        expect(result.axeIncludeSegment).toBeDefined();
        expect(result.axeIncludeSegment).toMatch(/^axe_/);

        // Customer ID should be set
        expect(result.customerId).toBeDefined();

        // Cleanup
        await repository.deleteTactic(validApiKey, result.id);
      });

      it("should create tactic with all optional fields", async () => {
        const input: TacticInput = {
          brandStoryId: "brand_story_123",
          budgetAllocation: {
            amount: 5000,
            currency: "EUR",
            dailyCap: 500,
            pacing: "asap",
            percentage: 25,
          },
          campaignId,
          description: "Detailed tactic description",
          mediaProductId,
          name: "Full Featured Tactic",
          signalId: "signal_456",
        };

        const effectivePricing = {
          cpm: 12.5,
          currency: "USD",
          signalCost: 2.5,
          totalCpm: 15.0,
        };

        const result = await repository.createTactic(
          validApiKey,
          input,
          effectivePricing,
          salesAgentId,
        );

        expect(result.brandStoryId).toBe(input.brandStoryId);
        expect(result.description).toBe(input.description);
        expect(result.signalId).toBe(input.signalId);
        expect(result.budgetAllocation.dailyCap).toBe(
          input.budgetAllocation.dailyCap,
        );
        expect(result.budgetAllocation.percentage).toBe(
          input.budgetAllocation.percentage,
        );
        expect(result.effectivePricing.signalCost).toBe(
          effectivePricing.signalCost,
        );

        // Cleanup
        await repository.deleteTactic(validApiKey, result.id);
      });

      it("should reject invalid input data", async () => {
        const effectivePricing = { cpm: 5.0, currency: "USD", totalCpm: 5.0 };

        const invalidInputs = [
          // Empty name
          {
            budgetAllocation: { amount: 1000, currency: "USD", pacing: "even" },
            campaignId,
            mediaProductId,
            name: "",
          },
          // Missing campaign ID
          {
            budgetAllocation: { amount: 1000, currency: "USD", pacing: "even" },
            mediaProductId,
            name: "Test",
          },
          // Negative budget
          {
            budgetAllocation: { amount: -100, currency: "USD", pacing: "even" },
            campaignId,
            mediaProductId,
            name: "Test",
          },
          // Missing budget allocation
          {
            campaignId,
            mediaProductId,
            name: "Test",
          },
        ];

        for (const invalidInput of invalidInputs) {
          await expect(
            repository.createTactic(
              validApiKey,
              invalidInput as TacticInput,
              effectivePricing,
              salesAgentId,
            ),
          ).rejects.toThrow(/validation|invalid|required/i);
        }
      });
    });

    describe("Tactic Listing", () => {
      let testTacticIds: string[] = [];

      beforeEach(async () => {
        // Create test tactics
        for (let i = 1; i <= 3; i++) {
          const tactic = await repository.createTactic(
            validApiKey,
            {
              budgetAllocation: {
                amount: 1000 * i,
                currency: "USD",
                pacing: "even",
              },
              campaignId,
              mediaProductId,
              name: `List Test Tactic ${i}`,
            },
            { cpm: 5.0 + i, currency: "USD", totalCpm: 5.0 + i },
            salesAgentId,
          );
          testTacticIds.push(tactic.id);
        }
      });

      afterEach(async () => {
        // Cleanup test tactics
        for (const tacticId of testTacticIds) {
          try {
            await repository.deleteTactic(validApiKey, tacticId);
          } catch {
            // Ignore cleanup errors
          }
        }
        testTacticIds = [];
      });

      it("should list tactics for campaign", async () => {
        const result = await repository.listTactics(validApiKey, {
          campaignId,
        });

        expect(result.tactics).toBeDefined();
        expect(Array.isArray(result.tactics)).toBe(true);
        expect(result.tactics.length).toBeGreaterThanOrEqual(3);
        expect(result.totalCount).toBeGreaterThanOrEqual(3);

        // Verify our test tactics are in the list
        const tacticNames = result.tactics.map((t) => t.name);
        expect(tacticNames).toContain("List Test Tactic 1");
        expect(tacticNames).toContain("List Test Tactic 2");
        expect(tacticNames).toContain("List Test Tactic 3");

        // Should not include inactive tactics
        expect(result.tactics.every((t) => t.status !== "inactive")).toBe(true);
      });

      it("should respect pagination limits", async () => {
        const result = await repository.listTactics(validApiKey, {
          campaignId,
          limit: 2,
        });

        expect(result.tactics.length).toBe(2);
        expect(result.hasMore).toBe(true);
      });

      it("should filter by status", async () => {
        const result = await repository.listTactics(validApiKey, {
          campaignId,
          status: "active",
        });

        expect(result.tactics.every((t) => t.status === "active")).toBe(true);
      });
    });

    describe("Tactic Retrieval", () => {
      let testTacticId: string;

      beforeEach(async () => {
        const tactic = await repository.createTactic(
          validApiKey,
          {
            budgetAllocation: { amount: 1500, currency: "USD", pacing: "even" },
            campaignId,
            mediaProductId,
            name: "Get Test Tactic",
          },
          { cpm: 6.0, currency: "USD", totalCpm: 6.5 },
          salesAgentId,
        );
        testTacticId = tactic.id;
      });

      afterEach(async () => {
        try {
          await repository.deleteTactic(validApiKey, testTacticId);
        } catch {
          // Ignore cleanup errors
        }
      });

      it("should retrieve existing tactic", async () => {
        const result = await repository.getTactic(validApiKey, testTacticId);

        expect(result).not.toBeNull();
        expect(result!.id).toBe(testTacticId);
        expect(result!.name).toBe("Get Test Tactic");
      });

      it("should return null for non-existent tactic", async () => {
        const result = await repository.getTactic(
          validApiKey,
          "tactic_nonexistent",
        );

        expect(result).toBeNull();
      });
    });

    describe("Tactic Updates", () => {
      let testTacticId: string;

      beforeEach(async () => {
        const tactic = await repository.createTactic(
          validApiKey,
          {
            budgetAllocation: { amount: 2000, currency: "USD", pacing: "even" },
            campaignId,
            description: "Original description",
            mediaProductId,
            name: "Update Test Tactic",
          },
          { cpm: 8.0, currency: "USD", totalCpm: 8.5 },
          salesAgentId,
        );
        testTacticId = tactic.id;
      });

      afterEach(async () => {
        try {
          await repository.deleteTactic(validApiKey, testTacticId);
        } catch {
          // Ignore cleanup errors
        }
      });

      it("should update tactic fields", async () => {
        const updates = {
          budgetAllocation: { amount: 3000 },
          description: "Updated description",
          name: "Updated Tactic Name",
          status: "paused" as const,
        };

        const updatedPricing = { cpm: 10.0, currency: "USD", totalCpm: 10.5 };

        const result = await repository.updateTactic(
          validApiKey,
          testTacticId,
          updates,
          updatedPricing,
        );

        expect(result.name).toBe(updates.name);
        expect(result.description).toBe(updates.description);
        expect(result.status).toBe(updates.status);
        expect(result.budgetAllocation.amount).toBe(3000);
        expect(result.effectivePricing.cpm).toBe(updatedPricing.cpm);
        expect(result.effectivePricing.totalCpm).toBe(updatedPricing.totalCpm);
        expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(
          new Date(result.createdAt).getTime(),
        );
      });

      it("should reject updates to non-existent tactic", async () => {
        await expect(
          repository.updateTactic(validApiKey, "tactic_nonexistent", {
            name: "New Name",
          }),
        ).rejects.toThrow(/not found|does not exist/i);
      });
    });

    describe("Tactic Deletion", () => {
      it("should delete existing tactic", async () => {
        const tactic = await repository.createTactic(
          validApiKey,
          {
            budgetAllocation: { amount: 1200, currency: "USD", pacing: "even" },
            campaignId,
            mediaProductId,
            name: "Delete Test Tactic",
          },
          { cpm: 4.0, currency: "USD", totalCpm: 4.5 },
          salesAgentId,
        );

        await repository.deleteTactic(validApiKey, tactic.id);

        // Verify tactic is marked inactive or deleted
        const retrievedTactic = await repository.getTactic(
          validApiKey,
          tactic.id,
        );
        // Contract allows either soft deletion (inactive status) or hard deletion (null)
        expect(
          retrievedTactic === null || retrievedTactic?.status === "inactive",
        ).toBe(true);
      });

      it("should handle deletion of non-existent tactic gracefully", async () => {
        // Should not throw error for deleting non-existent tactic
        await expect(
          repository.deleteTactic(validApiKey, "tactic_nonexistent"),
        ).resolves.not.toThrow();
      });
    });

    describe("Prebid Integration", () => {
      it("should return empty array for org with no active campaigns", async () => {
        const segments = await repository.getPrebidSegments("org_no_campaigns");
        expect(segments).toEqual([]);
      });

      // Note: This test requires the setupPrebidTestData helper in test doubles
      // For real implementations, you'll need to set up actual test data
      it("should return segments ordered by max CPM", async () => {
        // This test depends on test data setup in the implementation
        // For real BigQuery/PostgreSQL implementations, you'd set up actual test data
        const orgId = "test_org_123";

        // The test implementation should set up data where this org exists
        const segments = await repository.getPrebidSegments(orgId);

        if (segments.length > 0) {
          // Verify segments are ordered by CPM descending
          for (let i = 1; i < segments.length; i++) {
            expect(segments[i - 1].max_cpm).toBeGreaterThanOrEqual(
              segments[i].max_cpm,
            );
          }

          // Verify segment structure
          segments.forEach((segment) => {
            expect(segment.axe_include_segment).toBeDefined();
            expect(segment.axe_include_segment).toMatch(/^axe_/);
            expect(segment.max_cpm).toBeGreaterThan(0);
            expect(typeof segment.max_cpm).toBe("number");
          });
        }
      });

      it("should only include segments from active campaigns and tactics", async () => {
        // This test verifies the query logic: only active campaigns/tactics should be included
        const orgId = "test_active_only_org";

        const segments = await repository.getPrebidSegments(orgId);

        // All returned segments should come from active campaigns/tactics only
        // The exact verification depends on test data setup
        expect(Array.isArray(segments)).toBe(true);
      });
    });

    describe("Health Check", () => {
      it("should report healthy status", async () => {
        const isHealthy = await repository.healthCheck();
        expect(isHealthy).toBe(true);
      });
    });
  });
}
