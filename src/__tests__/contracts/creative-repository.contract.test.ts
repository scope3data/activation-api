/**
 * Creative Repository Contract Tests
 *
 * These tests validate that ANY implementation of CreativeRepository
 * satisfies the business requirements for creative management.
 */

import type {
  CreativeInput,
  CreativeRepository,
} from "../../contracts/creative-repository.js";

/**
 * Contract test suite that validates any CreativeRepository implementation
 */
export function testCreativeRepositoryContract(
  repositoryFactory: () => CreativeRepository,
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
  describe("Creative Repository Contract", () => {
    let repository: CreativeRepository;
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
        const validInput: CreativeInput = {
          buyerAgentId: brandAgentId,
          content: { htmlSnippet: "<div>Test</div>" },
          creativeName: "Test Creative",
          format: { formatId: "banner_300x250", type: "publisher" },
        };

        await expect(
          repository.createCreative(invalidApiKey, validInput),
        ).rejects.toThrow(/authentication|unauthorized|invalid/i);
      });
    });

    describe("Creative Creation", () => {
      it("should create creative with required fields", async () => {
        const input: CreativeInput = {
          buyerAgentId: brandAgentId,
          content: { htmlSnippet: "<div>Basic creative content</div>" },
          creativeName: "Basic Test Creative",
          format: { formatId: "banner_300x250", type: "publisher" },
        };

        const result = await repository.createCreative(validApiKey, input);

        // Validate core business requirements
        expect(result.creativeId).toBeDefined();
        expect(result.creativeId).toMatch(/^creative_/); // Should follow ID convention
        expect(result.creativeName).toBe(input.creativeName);
        expect(result.buyerAgentId).toBe(input.buyerAgentId);
        expect(result.content).toEqual(input.content);
        expect(result.format).toEqual(input.format);
        expect(result.status).toBe("draft"); // New creatives should be draft
        expect(result.createdDate).toBeDefined();
        expect(result.lastModifiedDate).toBeDefined();

        // Default values should be set
        expect(result.assemblyMethod).toBe("pre_assembled"); // Default assembly method
        expect(Array.isArray(result.contentCategories)).toBe(true);
        expect(Array.isArray(result.assetIds)).toBe(true);

        // Cleanup
        await repository.deleteCreative(validApiKey, result.creativeId);
      });

      it("should create creative with all optional fields", async () => {
        const input: CreativeInput = {
          assemblyMethod: "creative_agent",
          buyerAgentId: brandAgentId,
          content: {
            assetIds: ["asset_1", "asset_2"],
            htmlSnippet: "<div>Full creative content</div>",
          },
          contentCategories: ["IAB1", "IAB2"],
          creativeDescription: "Comprehensive test creative",
          creativeName: "Full Test Creative",
          format: { formatId: "banner_728x90", type: "adcp" },
          targetAudience: {
            demographics: "Adults 25-54",
            interests: ["technology"],
          },
        };

        const result = await repository.createCreative(validApiKey, input);

        expect(result.creativeDescription).toBe(input.creativeDescription);
        expect(result.targetAudience).toEqual(input.targetAudience);
        expect(result.contentCategories).toEqual(input.contentCategories);
        expect(result.assemblyMethod).toBe(input.assemblyMethod);

        // Cleanup
        await repository.deleteCreative(validApiKey, result.creativeId);
      });

      it("should reject invalid content", async () => {
        const invalidInputs = [
          {
            // No content
            buyerAgentId: brandAgentId,
            content: {},
            creativeName: "Test",
            format: { formatId: "banner_300x250", type: "publisher" },
          },
          {
            // Empty name
            buyerAgentId: brandAgentId,
            content: { htmlSnippet: "<div>Test</div>" },
            creativeName: "",
            format: { formatId: "banner_300x250", type: "publisher" },
          },
        ];

        for (const invalidInput of invalidInputs) {
          await expect(
            repository.createCreative(
              validApiKey,
              invalidInput as CreativeInput,
            ),
          ).rejects.toThrow(/validation|invalid|required|content/i);
        }
      });
    });

    describe("Creative Listing", () => {
      let testCreatives: string[] = [];

      beforeEach(async () => {
        // Create test creatives
        for (let i = 1; i <= 3; i++) {
          const creative = await repository.createCreative(validApiKey, {
            buyerAgentId: brandAgentId,
            content: { htmlSnippet: `<div>Test content ${i}</div>` },
            creativeName: `List Test Creative ${i}`,
            format: { formatId: "banner_300x250", type: "publisher" },
          });
          testCreatives.push(creative.creativeId);
        }
      });

      afterEach(async () => {
        // Cleanup test creatives
        for (const creativeId of testCreatives) {
          try {
            await repository.deleteCreative(validApiKey, creativeId);
          } catch {
            // Ignore cleanup errors
          }
        }
        testCreatives = [];
      });

      it("should list creatives for brand agent", async () => {
        const result = await repository.listCreatives(validApiKey, {
          brandAgentId,
        });

        expect(result.creatives).toBeDefined();
        expect(Array.isArray(result.creatives)).toBe(true);
        expect(result.creatives.length).toBeGreaterThanOrEqual(3);
        expect(result.totalCount).toBeGreaterThanOrEqual(3);
        expect(result.summary).toBeDefined();
        expect(result.summary.totalCreatives).toBeGreaterThanOrEqual(3);

        // Verify our test creatives are in the list
        const creativeNames = result.creatives.map((c) => c.creativeName);
        expect(creativeNames).toContain("List Test Creative 1");
        expect(creativeNames).toContain("List Test Creative 2");
        expect(creativeNames).toContain("List Test Creative 3");
      });

      it("should respect pagination limits", async () => {
        const result = await repository.listCreatives(validApiKey, {
          brandAgentId,
          limit: 2,
        });

        expect(result.creatives.length).toBe(2);
        expect(result.hasMore).toBe(true);
      });
    });

    describe("Creative Retrieval", () => {
      let testCreativeId: string;

      beforeEach(async () => {
        const creative = await repository.createCreative(validApiKey, {
          buyerAgentId: brandAgentId,
          content: { htmlSnippet: "<div>Get test content</div>" },
          creativeName: "Get Test Creative",
          format: { formatId: "banner_300x250", type: "publisher" },
        });
        testCreativeId = creative.creativeId;
      });

      afterEach(async () => {
        try {
          await repository.deleteCreative(validApiKey, testCreativeId);
        } catch {
          // Ignore cleanup errors
        }
      });

      it("should retrieve existing creative", async () => {
        const result = await repository.getCreative(
          validApiKey,
          testCreativeId,
          brandAgentId,
        );

        expect(result).not.toBeNull();
        expect(result!.creativeId).toBe(testCreativeId);
        expect(result!.creativeName).toBe("Get Test Creative");
      });

      it("should return null for non-existent creative", async () => {
        const result = await repository.getCreative(
          validApiKey,
          "creative_nonexistent",
          brandAgentId,
        );

        expect(result).toBeNull();
      });
    });

    describe("Creative Updates", () => {
      let testCreativeId: string;

      beforeEach(async () => {
        const creative = await repository.createCreative(validApiKey, {
          buyerAgentId: brandAgentId,
          content: { htmlSnippet: "<div>Original content</div>" },
          creativeName: "Update Test Creative",
          format: { formatId: "banner_300x250", type: "publisher" },
        });
        testCreativeId = creative.creativeId;
      });

      afterEach(async () => {
        try {
          await repository.deleteCreative(validApiKey, testCreativeId);
        } catch {
          // Ignore cleanup errors
        }
      });

      it("should update creative fields", async () => {
        const updates = {
          content: { htmlSnippet: "<div>Updated content</div>" },
          creativeDescription: "Updated description",
          name: "Updated Creative Name",
          status: "active" as const,
        };

        const result = await repository.updateCreative(
          validApiKey,
          testCreativeId,
          brandAgentId,
          updates,
        );

        expect(result.creativeName).toBe(updates.name);
        expect(result.creativeDescription).toBe(updates.creativeDescription);
        expect(result.content).toEqual(updates.content);
        expect(result.status).toBe(updates.status);
        expect(new Date(result.lastModifiedDate).getTime()).toBeGreaterThan(
          new Date(result.createdDate).getTime(),
        );
      });
    });

    describe("Creative Assignment", () => {
      let testCreativeId: string;
      let testCampaignId: string;

      beforeEach(async () => {
        const creative = await repository.createCreative(validApiKey, {
          buyerAgentId: brandAgentId,
          content: { htmlSnippet: "<div>Assignment test content</div>" },
          creativeName: "Assignment Test Creative",
          format: { formatId: "banner_300x250", type: "publisher" },
        });
        testCreativeId = creative.creativeId;
        testCampaignId = "campaign_test_assignment"; // Mock campaign ID
      });

      afterEach(async () => {
        try {
          await repository.deleteCreative(validApiKey, testCreativeId);
        } catch {
          // Ignore cleanup errors
        }
      });

      it("should assign creative to campaign", async () => {
        const result = await repository.assignCreativeToCampaign(
          validApiKey,
          testCreativeId,
          testCampaignId,
          brandAgentId,
        );

        expect(result.success).toBe(true);
        expect(result.creativeId).toBe(testCreativeId);
        expect(result.campaignId).toBe(testCampaignId);
        expect(result.message).toBeDefined();
      });

      it("should unassign creative from campaign", async () => {
        // First assign
        await repository.assignCreativeToCampaign(
          validApiKey,
          testCreativeId,
          testCampaignId,
          brandAgentId,
        );

        // Then unassign
        const result = await repository.unassignCreativeFromCampaign(
          validApiKey,
          testCreativeId,
          testCampaignId,
        );

        expect(result.success).toBe(true);
        expect(result.creativeId).toBe(testCreativeId);
        expect(result.campaignId).toBe(testCampaignId);
      });
    });

    describe("Creative Deletion", () => {
      it("should delete existing creative", async () => {
        const creative = await repository.createCreative(validApiKey, {
          buyerAgentId: brandAgentId,
          content: { htmlSnippet: "<div>Delete test content</div>" },
          creativeName: "Delete Test Creative",
          format: { formatId: "banner_300x250", type: "publisher" },
        });

        await repository.deleteCreative(validApiKey, creative.creativeId);

        // Verify creative is deleted
        const retrievedCreative = await repository.getCreative(
          validApiKey,
          creative.creativeId,
          brandAgentId,
        );
        expect(retrievedCreative).toBeNull();
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
