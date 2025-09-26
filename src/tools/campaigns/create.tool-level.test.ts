import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createCampaignTool } from "./create.js";

// Mock the CampaignBigQueryService
const mockCampaignService = {
  createCampaign: vi.fn(),
};

vi.mock("../../services/campaign-bigquery-service.js", () => ({
  CampaignBigQueryService: vi.fn(() => mockCampaignService),
}));

const mockClient = {
  createBrandAgentCampaign: vi.fn(),
} as unknown as Scope3ApiClient;

const mockContext: MCPToolExecuteContext = {
  session: {
    customerId: 123,
    scope3ApiKey: "test-api-key",
  },
};

const sampleCampaignResponse = {
  brandAgentId: "ba_456",
  budget: {
    currency: "USD",
    dailyCap: 1000,
    pacing: "even",
    total: 10000,
  },
  createdAt: "2024-01-15T10:30:00Z",
  creativeIds: [],
  id: "camp_123",
  name: "Test Campaign",
  prompt: "Test campaign prompt",
  status: "draft",
  updatedAt: "2024-01-15T10:30:00Z",
};

describe("createCampaignTool", () => {
  const tool = createCampaignTool(mockClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("campaign_create");
      expect(tool.annotations.category).toBe("Campaigns");
      expect(tool.annotations.dangerLevel).toBe("medium");
      expect(tool.annotations.readOnlyHint).toBe(false);
      expect(tool.description).toContain("Create a new campaign");
    });
  });

  describe("authentication", () => {
    it("should use session API key when provided", async () => {
      mockClient.createBrandAgentCampaign = vi
        .fn()
        .mockResolvedValue(sampleCampaignResponse);

      const result = await tool.execute(
        {
          brandAgentId: "ba_456",
          budget: { total: 10000 },
          endDate: "2024-01-31",
          name: "Test Campaign",
          prompt: "Test campaign prompt",
          skipBriefValidation: true,
          startDate: "2024-01-01",
        },
        mockContext,
      );

      expect(mockClient.createBrandAgentCampaign).toHaveBeenCalledWith(
        "test-api-key",
        expect.objectContaining({
          brandAgentId: "ba_456",
          budget: expect.objectContaining({
            currency: "USD",
            total: 10000,
          }),
          name: "Test Campaign",
          prompt: "Test campaign prompt",
        }),
      );

      // Parse the JSON response to check structured data
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("Campaign Created Successfully");
    });

    it("should throw error when no API key is available", async () => {
      // Store original env value and clear it for this test
      const originalEnv = process.env.SCOPE3_API_KEY;
      delete process.env.SCOPE3_API_KEY;

      try {
        await expect(
          tool.execute(
            {
              brandAgentId: "ba_456",
              budget: { total: 10000 },
              name: "Test Campaign",
              prompt: "Test campaign prompt",
              skipBriefValidation: true,
            },
            { session: {} },
          ),
        ).rejects.toThrow("Authentication required");
      } finally {
        // Restore original env value
        if (originalEnv) {
          process.env.SCOPE3_API_KEY = originalEnv;
        }
      }
    });
  });

  describe("structured data response", () => {
    beforeEach(() => {
      mockClient.createBrandAgentCampaign = vi
        .fn()
        .mockResolvedValue(sampleCampaignResponse);
    });

    it("should include structured data with campaign details", async () => {
      const result = await tool.execute(
        {
          brandAgentId: "ba_456",
          budget: { total: 10000 },
          name: "Test Campaign",
          prompt: "Test campaign prompt",
          skipBriefValidation: true,
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.data).toBeDefined();
      expect(parsedResult.data.campaign).toEqual(sampleCampaignResponse);
      expect(parsedResult.data.configuration).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle service errors gracefully", async () => {
      mockClient.createBrandAgentCampaign = vi
        .fn()
        .mockRejectedValue(new Error("Brand agent not found"));

      await expect(
        tool.execute(
          {
            brandAgentId: "invalid_id",
            budget: { total: 10000 },
            name: "Test Campaign",
            prompt: "Test campaign prompt",
            skipBriefValidation: true,
          },
          mockContext,
        ),
      ).rejects.toThrow(
        "Failed to create brand agent campaign: Brand agent not found",
      );
    });
  });
});
