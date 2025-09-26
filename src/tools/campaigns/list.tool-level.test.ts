import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { CampaignValidators } from "../../__tests__/utils/structured-response-helpers.js";
import { AuthenticationService } from "../../services/auth-service.js";
import { CreativeSyncService } from "../../services/creative-sync-service.js";
import { NotificationService } from "../../services/notification-service.js";
import { listCampaignsTool } from "./list.js";

// Mock the service dependencies
vi.mock("../../services/auth-service.js");
vi.mock("../../services/creative-sync-service.js");
vi.mock("../../services/notification-service.js");

const mockClient = {
  listBrandAgentCampaigns: vi.fn(),
} as unknown as Scope3ApiClient;

const mockContext: MCPToolExecuteContext = {
  session: {
    customerId: 123,
    scope3ApiKey: "test-api-key",
  },
};

const sampleCampaignResponse = [
  {
    audienceIds: ["audience_1"],
    brandAgentId: "ba_456",
    budget: {
      currency: "USD",
      dailyCap: 50000, // $500 in cents
      pacing: "even",
      total: 1000000, // $10,000 in cents
    },
    createdAt: "2024-01-15T10:30:00Z",
    creativeIds: ["creative_1", "creative_2"],
    deliverySummary: {
      alerts: [],
      healthScore: 85,
      pacing: {
        budgetUtilized: 0.45,
        status: "on_track",
      },
      status: "delivering",
      today: {
        averagePrice: 3.6,
        impressions: 12500,
        spend: 45000, // $450 in cents
      },
    },
    endDate: "2024-01-31T23:59:59Z",
    id: "camp_123",
    name: "Test Campaign",
    startDate: "2024-01-01T00:00:00Z",
    status: "active",
    updatedAt: "2024-01-15T10:30:00Z",
  },
];

describe("listCampaignsTool", () => {
  const tool = listCampaignsTool(mockClient);

  // Mock service instances
  const mockAuthService = {
    getCustomerIdFromToken: vi.fn().mockResolvedValue(1),
  };

  const mockCreativeSyncService = {
    // Add any methods if needed
  };

  const mockNotificationService = {
    getCampaignNotifications: vi.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup service mocks
    vi.mocked(AuthenticationService).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => mockAuthService as any,
    );
    vi.mocked(CreativeSyncService).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => mockCreativeSyncService as any,
    );
    vi.mocked(NotificationService).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => mockNotificationService as any,
    );

    // Reset mock return values
    mockAuthService.getCustomerIdFromToken.mockResolvedValue(1);
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("campaign_list");
      expect(tool.annotations.category).toBe("Campaigns");
      expect(tool.annotations.dangerLevel).toBe("low");
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.description).toContain("List campaigns with filtering");
    });
  });

  describe("authentication", () => {
    it("should use session API key when provided", async () => {
      mockClient.listBrandAgentCampaigns = vi
        .fn()
        .mockResolvedValue(sampleCampaignResponse);

      const result = await tool.execute(
        {
          brandAgentId: "ba_456",
        },
        mockContext,
      );

      expect(mockClient.listBrandAgentCampaigns).toHaveBeenCalledWith(
        "test-api-key",
        "ba_456",
      );

      // Parse the JSON response to check structured data
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("Found 1 campaigns");
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
      mockClient.listBrandAgentCampaigns = vi
        .fn()
        .mockResolvedValue(sampleCampaignResponse);
    });

    it("should include structured data with campaign list", async () => {
      const result = await tool.execute(
        {
          brandAgentId: "ba_456",
        },
        mockContext,
      );

      CampaignValidators.validateListResponse(result);
    });

    it("should format human-readable message with campaign details", async () => {
      const result = await tool.execute(
        {
          brandAgentId: "ba_456",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain("Found 1 campaigns");
      expect(parsedResult.message).toContain("**Budget**: $10,000");
      expect(parsedResult.message).toContain("**Spend**: $450");
    });

    it("should include filter information in structured data", async () => {
      const result = await tool.execute(
        {
          brandAgentId: "ba_456",
          sortBy: "name",
          sortOrder: "asc",
          status: "active",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.data.filters).toEqual({
        brandAgentId: "ba_456",
        budgetRange: undefined,
        dateRange: undefined,
        limit: undefined,
        sortBy: "name",
        sortOrder: "asc",
        status: "active",
      });
    });

    it("should include portfolio summary in structured data", async () => {
      const result = await tool.execute(
        {
          brandAgentId: "ba_456",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.data.summary).toEqual({
        healthSummary: {
          critical: 0,
          healthy: 0,
          unknown: 0,
          warning: 1,
        },
        notificationSummary: {
          campaignsWithNotifications: 0,
          totalUnread: 0,
        },
        statusCounts: {
          delivering: 1,
        },
        totalBudget: 1000000,
        totalSpend: 45000,
        utilization: 4.5,
      });
    });
  });

  describe("empty results", () => {
    beforeEach(() => {
      mockClient.listBrandAgentCampaigns = vi.fn().mockResolvedValue([]);
    });

    it("should handle empty campaign list", async () => {
      const result = await tool.execute(
        {
          brandAgentId: "ba_456",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("No campaigns match filters");
      expect(parsedResult.data.campaigns).toEqual([]);
      expect(parsedResult.data.count).toBe(0);
    });

    it("should show filter information when no results with filters", async () => {
      const result = await tool.execute(
        {
          brandAgentId: "ba_456",
          status: "active",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain("No campaigns match filters");
    });

    it("should suggest creating campaigns when no filters applied", async () => {
      const result = await tool.execute({}, mockContext);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain("No campaigns found");
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      mockClient.listBrandAgentCampaigns = vi
        .fn()
        .mockRejectedValue(new Error("Brand agent not found"));

      await expect(
        tool.execute(
          {
            brandAgentId: "invalid_id",
          },
          mockContext,
        ),
      ).rejects.toThrow("Failed to list campaigns: Brand agent not found");
    });
  });

  describe("parameter validation", () => {
    it("should accept valid parameters", () => {
      const validParams = {
        brandAgentId: "ba_123",
        budgetRange: {
          max: 10000,
          min: 1000,
        },
        dateRange: {
          end: "2024-01-31",
          start: "2024-01-01",
        },
        limit: 50,
        sortBy: "name" as const,
        sortOrder: "desc" as const,
        status: "active",
      };

      const result = tool.parameters.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it("should validate limit boundaries", () => {
      const invalidParams = {
        limit: 500, // Over max of 200
      };

      const result = tool.parameters.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("should validate enum values", () => {
      const invalidParams = {
        sortBy: "invalid_field",
      };

      const result = tool.parameters.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });
  });
});
