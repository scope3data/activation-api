import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { getCampaignSummaryTool } from "./get-summary.js";

// Mock the CampaignBigQueryService
const mockCampaignService = {
  generateCampaignSummary: vi.fn(),
};

vi.mock("../../services/campaign-bigquery-service.js", () => ({
  CampaignBigQueryService: vi.fn(() => mockCampaignService),
}));

const mockClient = {
  getBrandAgent: vi.fn(),
  getBrandAgentCampaign: vi.fn(),
  getCampaignDeliveryData: vi.fn(),
  getTacticBreakdown: vi.fn(),
} as unknown as Scope3ApiClient;

const mockContext: MCPToolExecuteContext = {
  session: {
    scope3ApiKey: "test-api-key",
  },
};

const sampleCampaignResponse = {
  brandAgentId: "ba_456",
  budget: {
    currency: "USD",
    total: 10000,
  },
  createdAt: new Date("2024-01-01T00:00:00Z"),
  id: "camp_123",
  name: "Test Campaign",
  prompt: "Test campaign targeting young adults",
  status: "active",
};

const sampleBrandAgentResponse = {
  id: "ba_456",
  name: "Test Brand Agent",
};

const sampleDeliveryDataResponse = {
  clicks: 500,
  ctr: 0.01,
  impressions: 50000,
  spend: 7500,
};

const sampleTacticBreakdownResponse = [
  {
    clicks: 300,
    impressions: 30000,
    name: "Display Advertising",
    spend: 4500,
  },
  {
    clicks: 200,
    impressions: 20000,
    name: "Video Advertising",
    spend: 3000,
  },
];

describe("getCampaignSummaryTool", () => {
  const tool = getCampaignSummaryTool(mockClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("campaign_get_summary");
      expect(tool.annotations.category).toBe("Reporting & Analytics");
      expect(tool.annotations.dangerLevel).toBe("low");
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.description).toContain(
        "Get a natural language summary of campaign performance",
      );
    });
  });

  describe("authentication", () => {
    it("should use session API key when provided", async () => {
      mockClient.getBrandAgentCampaign = vi
        .fn()
        .mockResolvedValue(sampleCampaignResponse);
      mockClient.getBrandAgent = vi
        .fn()
        .mockResolvedValue(sampleBrandAgentResponse);
      mockClient.getCampaignDeliveryData = vi
        .fn()
        .mockResolvedValue(sampleDeliveryDataResponse);
      mockClient.getTacticBreakdown = vi
        .fn()
        .mockResolvedValue(sampleTacticBreakdownResponse);

      const result = await tool.execute(
        {
          campaignId: "camp_123",
        },
        mockContext,
      );

      expect(mockClient.getBrandAgentCampaign).toHaveBeenCalledWith(
        "test-api-key",
        "camp_123",
      );
      expect(mockClient.getBrandAgent).toHaveBeenCalledWith(
        "test-api-key",
        "ba_456",
      );
      expect(mockClient.getCampaignDeliveryData).toHaveBeenCalled();
      expect(mockClient.getTacticBreakdown).toHaveBeenCalled();

      // Parse the JSON response to check structured data
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("Test Campaign");
    });

    it("should throw error when no API key is available", async () => {
      // Store original env value and clear it for this test
      const originalEnv = process.env.SCOPE3_API_KEY;
      delete process.env.SCOPE3_API_KEY;

      try {
        await expect(
          tool.execute(
            {
              campaignId: "camp_123",
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
      mockClient.getBrandAgentCampaign = vi
        .fn()
        .mockResolvedValue(sampleCampaignResponse);
      mockClient.getBrandAgent = vi
        .fn()
        .mockResolvedValue(sampleBrandAgentResponse);
      mockClient.getCampaignDeliveryData = vi
        .fn()
        .mockResolvedValue(sampleDeliveryDataResponse);
      mockClient.getTacticBreakdown = vi
        .fn()
        .mockResolvedValue(sampleTacticBreakdownResponse);
    });

    it("should include structured data with campaign summary", async () => {
      const result = await tool.execute(
        {
          campaignId: "camp_123",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toBeDefined();
      expect(parsedResult.data.summary).toBeDefined();
      expect(parsedResult.data.summary.textSummary).toBeDefined();
      expect(parsedResult.data.campaign).toBeDefined();
      expect(parsedResult.data.brandAgent).toBeDefined();
      expect(parsedResult.data.deliveryData).toBeDefined();
    });

    it("should handle summary with options", async () => {
      const result = await tool.execute(
        {
          campaignId: "camp_123",
          includeCharts: true,
          verbosity: "detailed",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.data).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle service errors gracefully", async () => {
      mockClient.getBrandAgentCampaign = vi
        .fn()
        .mockRejectedValue(new Error("Campaign not found"));

      await expect(
        tool.execute(
          {
            campaignId: "invalid_id",
          },
          mockContext,
        ),
      ).rejects.toThrow(
        "Failed to generate campaign summary: Campaign not found",
      );
    });
  });
});
