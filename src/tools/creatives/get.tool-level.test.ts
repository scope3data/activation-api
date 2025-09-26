import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";
import type { CreativeSyncStatus } from "../../types/notifications.js";

import { CreativeValidators } from "../../__tests__/utils/structured-response-helpers.js";
import { AuthenticationService } from "../../services/auth-service.js";
import { CreativeSyncService } from "../../services/creative-sync-service.js";
import { creativeGetTool } from "./get.js";

const mockClient = {
  getCreative: vi.fn(),
} as unknown as Scope3ApiClient;

// Mock the service dependencies
vi.mock("@google-cloud/bigquery", () => {
  return {
    BigQuery: vi.fn().mockImplementation(() => ({
      query: vi.fn().mockResolvedValue([[]]),
    })),
  };
});

vi.mock("../../services/auth-service.js");
vi.mock("../../services/creative-sync-service.js");

const mockContext: MCPToolExecuteContext = {
  session: {
    customerId: 123,
    scope3ApiKey: "test-api-key",
  },
};

const sampleCreativeResponse = {
  assemblyMethod: "manual",
  assetIds: ["asset_1", "asset_2"],
  assetValidation: {
    allAssetsValid: true,
    invalidAssets: [],
    validatedAt: "2024-01-15T10:30:00Z",
  },
  brandAgentId: "ba_456", // For validator compatibility
  buyerAgentId: "ba_456", // For actual tool logic
  campaignAssignments: [
    {
      assignedDate: "2024-01-15T10:30:00Z",
      campaignId: "camp_1",
      campaignName: "Summer Campaign",
      isActive: true,
      publishersSynced: ["publisher_1", "publisher_2"],
    },
  ],
  content: {
    htmlSnippet: "<div>Test HTML</div>",
    snippet: "test-snippet",
    snippetType: "javascript",
    vastTag: "https://example.com/vast.xml",
  },
  createdDate: "2024-01-15T10:30:00Z",
  creativeId: "creative_123",
  creativeName: "Test Creative",
  format: "banner_300x250", // String format for validator compatibility
  lastModifiedDate: "2024-01-15T10:30:00Z",
  status: "active",
  targetAudience: "Sports enthusiasts aged 25-35",
};

const sampleSyncStatus: CreativeSyncStatus[] = [
  {
    approvalStatus: "approved",
    lastSyncAttempt: "2024-01-15T10:30:00Z",
    rejectionReason: undefined,
    requestedChanges: undefined,
    salesAgentId: "sa_1",
    salesAgentName: "Test Sales Agent 1",
    status: "synced",
  },
  {
    approvalStatus: "pending",
    lastSyncAttempt: "2024-01-15T10:35:00Z",
    rejectionReason: undefined,
    requestedChanges: undefined,
    salesAgentId: "sa_2",
    salesAgentName: "Test Sales Agent 2",
    status: "synced",
  },
  {
    approvalStatus: "rejected",
    lastSyncAttempt: "2024-01-15T10:40:00Z",
    rejectionReason: "Format not supported",
    requestedChanges: ["Update format to video"],
    salesAgentId: "sa_3",
    salesAgentName: "Test Sales Agent 3",
    status: "failed",
  },
];

describe("creativeGetTool", () => {
  const tool = creativeGetTool(mockClient);

  // Mock service instances
  const mockCreativeSyncService = {
    getCreativeSyncStatus: vi.fn(),
  };

  const mockAuthService = {
    getCustomerIdFromToken: vi.fn().mockResolvedValue(1),
    resolveCustomerContext: vi.fn().mockResolvedValue({
      clientId: "test-client-id",
      company: "Test Company",
      customerId: 1,
      permissions: ["full_access"],
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup service mocks
    vi.mocked(CreativeSyncService).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => mockCreativeSyncService as any,
    );
    vi.mocked(AuthenticationService).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => mockAuthService as any,
    );

    // Reset mocks to default behavior
    mockClient.getCreative = vi.fn().mockResolvedValue(sampleCreativeResponse);
    mockCreativeSyncService.getCreativeSyncStatus.mockResolvedValue([]);
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("creative_get");
      expect(tool.annotations.category).toBe("Creatives");
      expect(tool.annotations.dangerLevel).toBe("low");
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.description).toContain(
        "Get comprehensive information about a creative asset",
      );
    });
  });

  describe("authentication", () => {
    it("should use session API key when provided", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      expect(mockClient.getCreative).toHaveBeenCalledWith(
        "test-api-key",
        "creative_123",
      );

      // Parse the JSON response to check structured data
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("Creative Details");
    });

    it("should throw error when no API key is available", async () => {
      // Store original env value and clear it for this test
      const originalEnv = process.env.SCOPE3_API_KEY;
      delete process.env.SCOPE3_API_KEY;

      try {
        await expect(
          tool.execute(
            {
              creativeId: "creative_123",
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
    it("should include structured data with creative details", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      CreativeValidators.validateGetResponse(result);
    });

    it("should format human-readable message with creative info", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain("Test Creative");
      expect(parsedResult.message).toContain("creative_123");
      expect(parsedResult.message).toContain("active");
      expect(parsedResult.message).toContain("Basic Information");
      expect(parsedResult.message).toContain("Creative Content");
      expect(parsedResult.message).toContain("Asset Validation");
      expect(parsedResult.message).toContain("Campaign Assignments");
    });

    it("should include sync status information when available", async () => {
      // Update the mock to return sync status data
      mockCreativeSyncService.getCreativeSyncStatus.mockResolvedValue(
        sampleSyncStatus,
      );

      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      // Verify mock was called
      expect(
        mockCreativeSyncService.getCreativeSyncStatus,
      ).toHaveBeenCalledWith("creative_123");

      expect(parsedResult.message).toContain("Sales Agent Sync Status");
      expect(parsedResult.message).toContain("Test Sales Agent 1");
      expect(parsedResult.message).toContain("Approved: 1");
      expect(parsedResult.message).toContain("Pending: 1");
      expect(parsedResult.message).toContain("Issues: 2"); // 1 rejected + 1 failed = 2 issues

      // Check structured data includes sync status
      expect(parsedResult.data.syncStatus).toBeDefined();
      expect(parsedResult.data.syncStatus.salesAgentSyncStatus).toHaveLength(3);
      expect(parsedResult.data.metadata.salesAgentsApproved).toBe(1);
      expect(parsedResult.data.metadata.salesAgentsPending).toBe(1);
      expect(parsedResult.data.metadata.salesAgentsRejected).toBe(1);
    });

    it("should handle sync status errors gracefully", async () => {
      // Update the mock to throw an error
      mockCreativeSyncService.getCreativeSyncStatus.mockRejectedValue(
        new Error("BigQuery connection failed"),
      );

      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("No sync attempts yet");
      expect(parsedResult.message).toContain("creative/sync_sales_agents");

      // Check structured data shows no sync status
      expect(parsedResult.data.metadata.hasSyncStatus).toBe(false);
      expect(parsedResult.data.syncStatus.salesAgentSyncStatus).toHaveLength(0);
    });
  });

  describe("error handling", () => {
    it("should handle creative not found", async () => {
      mockClient.getCreative = vi.fn().mockResolvedValue(null);

      await expect(
        tool.execute(
          {
            creativeId: "nonexistent_id",
          },
          mockContext,
        ),
      ).rejects.toThrow(
        "Creative not found: Creative with ID nonexistent_id not found",
      );
    });

    it("should handle API errors gracefully", async () => {
      mockClient.getCreative = vi
        .fn()
        .mockRejectedValue(new Error("Service unavailable"));

      await expect(
        tool.execute(
          {
            creativeId: "creative_123",
          },
          mockContext,
        ),
      ).rejects.toThrow("Service unavailable");
    });
  });

  describe("parameter validation", () => {
    it("should accept valid parameters", () => {
      const validParams = {
        creativeId: "creative_123",
      };

      const result = tool.parameters.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it("should require creativeId", () => {
      const invalidParams = {};

      const result = tool.parameters.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("should accept empty creativeId (string validation)", () => {
      const invalidParams = {
        creativeId: "",
      };

      // Zod string schema allows empty strings by default
      const result = tool.parameters.safeParse(invalidParams);
      expect(result.success).toBe(true);
    });
  });

  describe("creative content details", () => {
    it("should display asset validation information", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain("Asset Validation");
      expect(parsedResult.message).toContain("All Assets Valid: ✅");
      expect(parsedResult.data.validation.allAssetsValid).toBe(true);
    });

    it("should display content format information", async () => {
      // Create a fresh response object with explicit format object for this test
      const responseWithObjectFormat = {
        ...sampleCreativeResponse,
        format: {
          formatId: "banner_300x250",
          type: "display",
        },
      };
      mockClient.getCreative = vi
        .fn()
        .mockResolvedValue(responseWithObjectFormat);

      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain(
        "Format: banner_300x250 (display)",
      );
      expect(parsedResult.message).toContain("HTML Snippet: Available");
      expect(parsedResult.message).toContain("VAST Tag: Available");
      expect(parsedResult.data.content.format.formatId).toBe("banner_300x250");
      expect(parsedResult.data.content.format.type).toBe("display");
    });

    it("should display campaign assignment details", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain("Campaign Assignments");
      expect(parsedResult.message).toContain("Summer Campaign");
      expect(parsedResult.message).toContain("camp_1");
      expect(parsedResult.message).toContain(
        "Synced to Publishers: publisher_1, publisher_2",
      );
      expect(parsedResult.data.assignments.campaigns).toHaveLength(1);
      expect(parsedResult.data.assignments.activeCampaigns).toHaveLength(1);
    });
  });
});
