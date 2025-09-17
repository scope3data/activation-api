/**
 * Backend-Independent Testing Examples
 *
 * These tests demonstrate how the contract pattern enables testing
 * that survives backend infrastructure changes.
 */

import { CampaignRepositoryTestDouble } from "../../test-doubles/campaign-repository-test-double.js";
import { CreativeRepositoryTestDouble } from "../../test-doubles/creative-repository-test-double.js";
import { testCampaignRepositoryContract } from "../contracts/campaign-repository.contract.test.js";
import { testCreativeRepositoryContract } from "../contracts/creative-repository.contract.test.js";

// Example: Testing with Test Doubles (Fast, No External Dependencies)
describe("Campaign Repository - Test Double Implementation", () => {
  let sharedTestDouble: CampaignRepositoryTestDouble;

  testCampaignRepositoryContract(
    // Factory function that creates the implementation - must return the same instance
    () => {
      if (!sharedTestDouble) {
        sharedTestDouble = new CampaignRepositoryTestDouble();
      }
      return sharedTestDouble;
    },

    // Setup authentication for tests
    async () => {
      if (!sharedTestDouble) {
        sharedTestDouble = new CampaignRepositoryTestDouble();
      }
      const validApiKey = "test_api_key_valid";
      const invalidApiKey = "test_api_key_invalid";
      const brandAgentId = "48";

      sharedTestDouble.addValidApiKey(validApiKey);

      return { brandAgentId, invalidApiKey, validApiKey };
    },

    // Cleanup authentication after tests
    async (_authData) => {
      if (sharedTestDouble) {
        sharedTestDouble.clear();
      }
    },
  );
});

describe("Creative Repository - Test Double Implementation", () => {
  let sharedTestDouble: CreativeRepositoryTestDouble;

  testCreativeRepositoryContract(
    () => {
      if (!sharedTestDouble) {
        sharedTestDouble = new CreativeRepositoryTestDouble();
      }
      return sharedTestDouble;
    },
    async () => {
      if (!sharedTestDouble) {
        sharedTestDouble = new CreativeRepositoryTestDouble();
      }
      const validApiKey = "test_api_key_valid";
      const invalidApiKey = "test_api_key_invalid";
      const brandAgentId = "48";

      sharedTestDouble.addValidApiKey(validApiKey);

      return { brandAgentId, invalidApiKey, validApiKey };
    },
    async (_authData) => {
      if (sharedTestDouble) {
        sharedTestDouble.clear();
      }
    },
  );
});

// Example: Behavioral Testing (Tests Business Logic, Not Implementation)
describe("Backend Resilience Patterns", () => {
  describe("Campaign Operations Under Stress", () => {
    it("should handle slow backend gracefully", async () => {
      const repository = new CampaignRepositoryTestDouble(); // Test double with simulated behavior
      repository.addValidApiKey("test_key");

      const startTime = Date.now();

      const result = await repository.createCampaign("test_key", {
        brandAgentId: "48",
        campaignName: "Latency Test Campaign",
        prompt: "Testing latency tolerance",
      });

      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThan(900); // Should respect latency
      expect(result.id).toBeDefined();
      expect(result.name).toBe("Latency Test Campaign");
    });

    it("should retry on transient failures", async () => {
      const repository = new CampaignRepositoryTestDouble(); // Test double with simulated behavior
      repository.addValidApiKey("test_key");

      // With 50% error rate, we might need multiple attempts
      // This test shows how to handle flaky backends
      let attempts = 0;
      let success = false;
      let result;

      while (attempts < 5 && !success) {
        try {
          attempts++;
          result = await repository.createCampaign("test_key", {
            brandAgentId: "48",
            campaignName: `Retry Test Campaign ${attempts}`,
            prompt: "Testing retry logic",
          });
          success = true;
        } catch (error) {
          if (attempts >= 5) throw error;
          // Wait before retry
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      expect(success).toBe(true);
      expect(result).toBeDefined();
      expect(attempts).toBeGreaterThan(0);
    });

    it("should handle storage limits gracefully", async () => {
      const repository = new CampaignRepositoryTestDouble(); // Test double with simulated behavior
      repository.addValidApiKey("test_key");

      // Create campaigns up to the limit
      await repository.createCampaign("test_key", {
        brandAgentId: "48",
        campaignName: "Campaign 1",
        prompt: "First campaign",
      });

      await repository.createCampaign("test_key", {
        brandAgentId: "48",
        campaignName: "Campaign 2",
        prompt: "Second campaign",
      });

      // Third campaign should fail due to storage limit
      await expect(
        repository.createCampaign("test_key", {
          brandAgentId: "48",
          campaignName: "Campaign 3",
          prompt: "Third campaign",
        }),
      ).rejects.toThrow(/storage limit|exceeded/i);
    });
  });

  describe("Creative-Campaign Assignment Workflows", () => {
    it("should handle full assignment lifecycle", async () => {
      const creativeRepo = new CreativeRepositoryTestDouble();
      const campaignRepo = new CampaignRepositoryTestDouble();
      const apiKey = "test_key";
      const brandAgentId = "48";

      creativeRepo.addValidApiKey(apiKey);
      campaignRepo.addValidApiKey(apiKey);

      // Create campaign and creative
      const campaign = await campaignRepo.createCampaign(apiKey, {
        brandAgentId,
        campaignName: "Assignment Test Campaign",
        prompt: "Testing assignment workflow",
      });

      const creative = await creativeRepo.createCreative(apiKey, {
        buyerAgentId: brandAgentId,
        content: { htmlSnippet: "<div>Test content</div>" },
        creativeName: "Assignment Test Creative",
        format: { formatId: "banner_300x250", type: "publisher" },
      });

      // Test assignment
      const assignResult = await creativeRepo.assignCreativeToCampaign(
        apiKey,
        creative.creativeId,
        campaign.id,
        brandAgentId,
      );

      expect(assignResult.success).toBe(true);

      // Verify assignment in creative
      const updatedCreative = await creativeRepo.getCreative(
        apiKey,
        creative.creativeId,
        brandAgentId,
      );
      expect(updatedCreative?.campaignAssignments).toContain(campaign.id);

      // Test unassignment
      const unassignResult = await creativeRepo.unassignCreativeFromCampaign(
        apiKey,
        creative.creativeId,
        campaign.id,
      );

      expect(unassignResult.success).toBe(true);

      // Verify unassignment
      const finalCreative = await creativeRepo.getCreative(
        apiKey,
        creative.creativeId,
        brandAgentId,
      );
      expect(finalCreative?.campaignAssignments).not.toContain(campaign.id);
    });
  });
});

// Example: Performance Testing (Independent of Backend Implementation)
describe("Performance Characteristics", () => {
  it("should handle bulk operations efficiently", async () => {
    const repository = new CampaignRepositoryTestDouble();
    repository.addValidApiKey("test_key");

    const bulkSize = 50;
    const startTime = Date.now();

    // Create campaigns in parallel
    const promises = Array.from({ length: bulkSize }, (_, i) =>
      repository.createCampaign("test_key", {
        brandAgentId: "48",
        campaignName: `Bulk Campaign ${i}`,
        prompt: `Bulk test campaign ${i}`,
      }),
    );

    const results = await Promise.all(promises);
    const duration = Date.now() - startTime;

    expect(results).toHaveLength(bulkSize);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    expect(results.every((r) => r.id.startsWith("campaign_"))).toBe(true);
  });

  it("should maintain consistent response times", async () => {
    const repository = new CampaignRepositoryTestDouble(); // Test double with simulated behavior
    repository.addValidApiKey("test_key");

    const measurements: number[] = [];

    // Measure response times for multiple operations
    for (let i = 0; i < 5; i++) {
      const start = Date.now();
      await repository.listCampaigns("test_key", { brandAgentId: "48" });
      measurements.push(Date.now() - start);
    }

    // All measurements should be roughly consistent (within 50ms of expected)
    const expectedLatency = 100;
    measurements.forEach((measurement) => {
      expect(measurement).toBeGreaterThanOrEqual(expectedLatency - 20);
      expect(measurement).toBeLessThanOrEqual(expectedLatency + 50);
    });
  });
});

// Example: Migration Testing (Validates New Backends Before Deployment)
describe("Backend Migration Readiness", () => {
  const testImplementations = [
    {
      campaignFactory: () => new CampaignRepositoryTestDouble(),
      creativeFactory: () => new CreativeRepositoryTestDouble(),
      name: "Test Double (Baseline)",
    },
    // When implementing new backends, add them here:
    // {
    //   name: 'PostgreSQL Implementation',
    //   campaignFactory: () => new PostgresCampaignRepository(),
    //   creativeFactory: () => new PostgresCreativeRepository()
    // }
  ];

  testImplementations.forEach(({ campaignFactory, creativeFactory, name }) => {
    describe(`${name} Implementation`, () => {
      it("should satisfy campaign repository contract", async () => {
        const repository = campaignFactory();

        // Add minimal setup for this test
        if (
          "addValidApiKey" in repository &&
          typeof repository.addValidApiKey === "function"
        ) {
          repository.addValidApiKey("test_key");
        }

        // Test core business requirement: campaign creation and retrieval
        const created = await repository.createCampaign("test_key", {
          brandAgentId: "48",
          campaignName: "Migration Test Campaign",
          prompt: "Testing migration readiness",
        });

        expect(created.id).toBeDefined();
        expect(created.name).toBe("Migration Test Campaign");

        const retrieved = await repository.getCampaign("test_key", created.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(created.id);
      });

      it("should satisfy creative repository contract", async () => {
        const repository = creativeFactory();

        if (
          "addValidApiKey" in repository &&
          typeof repository.addValidApiKey === "function"
        ) {
          repository.addValidApiKey("test_key");
        }

        const created = await repository.createCreative("test_key", {
          buyerAgentId: "48",
          content: { htmlSnippet: "<div>Migration test</div>" },
          creativeName: "Migration Test Creative",
          format: { formatId: "banner_300x250", type: "publisher" },
        });

        expect(created.creativeId).toBeDefined();
        expect(created.creativeName).toBe("Migration Test Creative");

        const retrieved = await repository.getCreative(
          "test_key",
          created.creativeId,
          "48",
        );
        expect(retrieved).not.toBeNull();
        expect(retrieved!.creativeId).toBe(created.creativeId);
      });
    });
  });
});
