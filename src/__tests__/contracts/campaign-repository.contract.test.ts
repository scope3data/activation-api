/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
/**
 * Campaign Repository Contract Tests
 *
 * These tests validate that ANY implementation of CampaignRepository
 * satisfies the business requirements. Whether using BigQuery, PostgreSQL,
 * or any other backend, all implementations must pass these tests.
 */

import type {
  CampaignInput,
  CampaignRepository,
} from "../../contracts/campaign-repository.js";

/**
 * Contract test suite that validates any CampaignRepository implementation
 *
 * @param repositoryFactory - Function that creates a repository instance
 * @param setupAuth - Function that sets up valid authentication for tests
 * @param teardownAuth - Function that cleans up authentication after tests
 */
export function testCampaignRepositoryContract(
  repositoryFactory: () => CampaignRepository,
  setupAuth: () => Promise<{
    brandAgentId: string;
    invalidApiKey: string;
    validApiKey: string;
  }>,
  teardownAuth: (authData: {
    brandAgentId: string;
    invalidApiKey: string;
    validApiKey: string;
  }) => Promise<void>,
) {
  describe("Campaign Repository Contract", () => {
    let repository: CampaignRepository;
    let validApiKey: string;
    let invalidApiKey: string;
    let brandAgentId: string;
    let authData: {
      brandAgentId: string;
      invalidApiKey: string;
      validApiKey: string;
    };

    beforeAll(async () => {
      authData = await setupAuth();
      validApiKey = authData.validApiKey;
      invalidApiKey = authData.invalidApiKey;
      brandAgentId = authData.brandAgentId;
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
        const validInput: CampaignInput = {
          brandAgentId,
          campaignName: "Test Campaign",
          prompt: "Test prompt for campaign",
        };

        await expect(
          repository.createCampaign(invalidApiKey, validInput),
        ).rejects.toThrow(/authentication|unauthorized|invalid/i);
      });

      it("should accept valid API keys", async () => {
        const validInput: CampaignInput = {
          brandAgentId,
          campaignName: "Valid Auth Test Campaign",
          prompt: "Test prompt for valid authentication",
        };

        const result = await repository.createCampaign(validApiKey, validInput);
        expect(result.id).toBeDefined();
        expect(result.name).toBe(validInput.campaignName);

        // Cleanup
        await repository.deleteCampaign(validApiKey, result.id);
      });
    });

    describe("Campaign Creation", () => {
      it("should create campaign with required fields only", async () => {
        const input: CampaignInput = {
          brandAgentId,
          campaignName: "Minimal Campaign",
          prompt: "Minimal campaign prompt",
        };

        const result = await repository.createCampaign(validApiKey, input);

        // Validate core business requirements
        expect(result.id).toBeDefined();
        expect(result.id).toMatch(/^campaign_/); // Should follow ID convention
        expect(result.name).toBe(input.campaignName);
        expect(result.prompt).toBe(input.prompt);
        expect(result.brandAgentId).toBe(input.brandAgentId);
        expect(result.status).toBe("draft"); // New campaigns should be draft
        expect(result.createdAt).toBeDefined();
        expect(result.updatedAt).toBeDefined();

        // Default values should be set
        expect(result.budget).toBeDefined();
        expect(result.budget.currency).toBe("USD"); // Default currency
        expect(result.outcomeScoreWindowDays).toBe(7); // Default window

        // Arrays should be initialized
        expect(Array.isArray(result.audienceIds)).toBe(true);
        expect(Array.isArray(result.creativeIds)).toBe(true);

        // Cleanup
        await repository.deleteCampaign(validApiKey, result.id);
      });

      it("should create campaign with all optional fields", async () => {
        const input: CampaignInput = {
          brandAgentId,
          budgetCurrency: "EUR",
          budgetDailyCap: 1000,
          budgetPacing: "accelerated",
          budgetTotal: 10000,
          campaignName: "Full Campaign",
          endDate: "2024-12-31T23:59:59Z",
          outcomeScoreWindowDays: 14,
          prompt: "Full campaign prompt",
          scoringWeights: { cpm: 0.7, ctr: 0.3 },
          startDate: "2024-01-01T00:00:00Z",
        };

        const result = await repository.createCampaign(validApiKey, input);

        expect(result.budget.total).toBe(input.budgetTotal);
        expect(result.budget.currency).toBe(input.budgetCurrency);
        expect(result.budget.dailyCap).toBe(input.budgetDailyCap);
        expect(result.budget.pacing).toBe(input.budgetPacing);
        expect(result.scoringWeights).toEqual(input.scoringWeights);
        expect(result.outcomeScoreWindowDays).toBe(
          input.outcomeScoreWindowDays,
        );

        // Cleanup
        await repository.deleteCampaign(validApiKey, result.id);
      });

      it("should reject invalid input data", async () => {
        const invalidInputs = [
          { brandAgentId: "", campaignName: "Test", prompt: "Test" }, // Empty brand agent
          { brandAgentId, campaignName: "", prompt: "Test" }, // Empty name
          { brandAgentId, campaignName: "Test", prompt: "" }, // Empty prompt
          {
            brandAgentId,
            budgetTotal: -100,
            campaignName: "Test",
            prompt: "Test",
          }, // Negative budget
        ];

        for (const invalidInput of invalidInputs) {
          await expect(
            repository.createCampaign(
              validApiKey,
              invalidInput as CampaignInput,
            ),
          ).rejects.toThrow(/validation|invalid|required/i);
        }
      });
    });

    describe("Campaign Listing", () => {
      let testCampaigns: string[] = [];

      beforeEach(async () => {
        // Create test campaigns
        for (let i = 1; i <= 3; i++) {
          const campaign = await repository.createCampaign(validApiKey, {
            brandAgentId,
            campaignName: `List Test Campaign ${i}`,
            prompt: `Prompt for test campaign ${i}`,
          });
          testCampaigns.push(campaign.id);
        }
      });

      afterEach(async () => {
        // Cleanup test campaigns
        for (const campaignId of testCampaigns) {
          try {
            await repository.deleteCampaign(validApiKey, campaignId);
          } catch {
            // Ignore cleanup errors
          }
        }
        testCampaigns = [];
      });

      it("should list campaigns for brand agent", async () => {
        const result = await repository.listCampaigns(validApiKey, {
          brandAgentId,
        });

        expect(result.campaigns).toBeDefined();
        expect(Array.isArray(result.campaigns)).toBe(true);
        expect(result.campaigns.length).toBeGreaterThanOrEqual(3);
        expect(result.totalCount).toBeGreaterThanOrEqual(3);

        // Verify our test campaigns are in the list
        const campaignNames = result.campaigns.map((c) => c.name);
        expect(campaignNames).toContain("List Test Campaign 1");
        expect(campaignNames).toContain("List Test Campaign 2");
        expect(campaignNames).toContain("List Test Campaign 3");
      });

      it("should respect pagination limits", async () => {
        const result = await repository.listCampaigns(validApiKey, {
          brandAgentId,
          limit: 2,
        });

        expect(result.campaigns.length).toBe(2);
        expect(result.hasMore).toBe(true);
      });

      it("should filter by status", async () => {
        const result = await repository.listCampaigns(validApiKey, {
          brandAgentId,
          status: "draft",
        });

        expect(result.campaigns.every((c) => c.status === "draft")).toBe(true);
      });
    });

    describe("Campaign Retrieval", () => {
      let testCampaignId: string;

      beforeEach(async () => {
        const campaign = await repository.createCampaign(validApiKey, {
          brandAgentId,
          campaignName: "Get Test Campaign",
          prompt: "Prompt for get test",
        });
        testCampaignId = campaign.id;
      });

      afterEach(async () => {
        try {
          await repository.deleteCampaign(validApiKey, testCampaignId);
        } catch {
          // Ignore cleanup errors
        }
      });

      it("should retrieve existing campaign", async () => {
        const result = await repository.getCampaign(
          validApiKey,
          testCampaignId,
        );

        expect(result).not.toBeNull();
        expect(result!.id).toBe(testCampaignId);
        expect(result!.name).toBe("Get Test Campaign");
      });

      it("should return null for non-existent campaign", async () => {
        const result = await repository.getCampaign(
          validApiKey,
          "campaign_nonexistent",
        );

        expect(result).toBeNull();
      });
    });

    describe("Campaign Updates", () => {
      let testCampaignId: string;

      beforeEach(async () => {
        const campaign = await repository.createCampaign(validApiKey, {
          brandAgentId,
          budgetTotal: 5000,
          campaignName: "Update Test Campaign",
          prompt: "Original prompt",
        });
        testCampaignId = campaign.id;
      });

      afterEach(async () => {
        try {
          await repository.deleteCampaign(validApiKey, testCampaignId);
        } catch {
          // Ignore cleanup errors
        }
      });

      it("should update campaign fields", async () => {
        const updates = {
          budgetTotal: 15000,
          campaignName: "Updated Campaign Name",
          prompt: "Updated prompt",
          status: "active" as const,
        };

        const result = await repository.updateCampaign(
          validApiKey,
          testCampaignId,
          updates,
        );

        expect(result.name).toBe(updates.campaignName);
        expect(result.prompt).toBe(updates.prompt);
        expect(result.budget.total).toBe(updates.budgetTotal);
        expect(result.status).toBe(updates.status);
        expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(
          new Date(result.createdAt).getTime(),
        );
      });

      it("should reject updates to non-existent campaign", async () => {
        await expect(
          repository.updateCampaign(validApiKey, "campaign_nonexistent", {
            campaignName: "New Name",
          }),
        ).rejects.toThrow(/not found|does not exist/i);
      });
    });

    describe("Campaign Deletion", () => {
      it("should delete existing campaign", async () => {
        const campaign = await repository.createCampaign(validApiKey, {
          brandAgentId,
          campaignName: "Delete Test Campaign",
          prompt: "Campaign to be deleted",
        });

        await repository.deleteCampaign(validApiKey, campaign.id);

        // Verify campaign is deleted
        const retrievedCampaign = await repository.getCampaign(
          validApiKey,
          campaign.id,
        );
        expect(retrievedCampaign).toBeNull();
      });

      it("should handle deletion of non-existent campaign gracefully", async () => {
        // Should not throw error for deleting non-existent campaign
        await expect(
          repository.deleteCampaign(validApiKey, "campaign_nonexistent"),
        ).resolves.not.toThrow();
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
