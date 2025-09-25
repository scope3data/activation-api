import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";
import { CreativeSyncService } from "../../services/creative-sync-service.js";
import { NotificationService } from "../../services/notification-service.js";
import { AuthenticationService } from "../../services/auth-service.js";

import { creativeUpdateTool } from "./update.js";

// Mock the services
vi.mock("../../services/creative-sync-service.js");
vi.mock("../../services/notification-service.js");
vi.mock("../../services/auth-service.js");

const mockClient = {
  updateCreative: vi.fn(),
} as unknown as Scope3ApiClient;

const mockContext: MCPToolExecuteContext = {
  session: {
    scope3ApiKey: "test-api-key",
  },
};

const sampleUpdatedCreativeResponse = {
  creativeId: "creative_123",
  creativeName: "Updated Creative",
  version: 2,
  status: "active",
  buyerAgentId: "456",
  format: {
    type: "video",
    formatId: "video/mp4",
  },
  assemblyMethod: "external_tag",
  assetIds: ["asset_1", "asset_2"],
  campaignAssignments: [
    {
      campaignId: "camp_1",
      campaignName: "Summer Campaign",
      isActive: true,
    },
  ],
  createdDate: "2024-01-15T10:30:00Z",
  lastModifiedDate: "2024-01-16T15:45:00Z",
  lastModifiedBy: "test-user",
};

const sampleSyncStatus = [
  {
    salesAgentId: "agent_1",
    status: "synced" as const,
    approvalStatus: "approved" as const,
  },
  {
    salesAgentId: "agent_2",
    status: "synced" as const,
    approvalStatus: "pending" as const,
  },
];

describe("creativeUpdateTool", () => {
  const tool = creativeUpdateTool(mockClient);

  // Mock service instances
  const mockCreativeSyncService = {
    getCreativeSyncStatus: vi.fn(),
    syncCreativeToSalesAgents: vi.fn(),
    setNotificationService: vi.fn(),
  };

  const mockNotificationService = {};
  const mockAuthService = {};

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup service mocks
    vi.mocked(CreativeSyncService).mockImplementation(
      () => mockCreativeSyncService as any,
    );
    vi.mocked(NotificationService).mockImplementation(
      () => mockNotificationService as any,
    );
    vi.mocked(AuthenticationService).mockImplementation(
      () => mockAuthService as any,
    );

    // Default creative update response
    mockClient.updateCreative = vi
      .fn()
      .mockResolvedValue(sampleUpdatedCreativeResponse);
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("creative_update");
      expect(tool.annotations.category).toBe("Creatives");
      expect(tool.annotations.dangerLevel).toBe("medium");
      expect(tool.annotations.readOnlyHint).toBe(false);
      expect(tool.description).toContain("Update existing creative properties");
    });
  });

  describe("authentication", () => {
    it("should use session API key when provided", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            name: "Updated Name",
          },
        },
        mockContext,
      );

      expect(mockClient.updateCreative).toHaveBeenCalledWith("test-api-key", {
        creativeId: "creative_123",
        updates: {
          name: "Updated Name",
        },
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
    });

    it("should throw error when no API key is available", async () => {
      const originalEnv = process.env.SCOPE3_API_KEY;
      delete process.env.SCOPE3_API_KEY;

      try {
        await expect(
          tool.execute(
            {
              creativeId: "creative_123",
              updates: { name: "Updated Name" },
            },
            { session: {} },
          ),
        ).rejects.toThrow("Authentication required");
      } finally {
        if (originalEnv) {
          process.env.SCOPE3_API_KEY = originalEnv;
        }
      }
    });
  });

  describe("basic updates", () => {
    it("should update creative name", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            name: "New Creative Name",
          },
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("Creative updated successfully");
      expect(parsedResult.message).toContain(
        "Name updated to: New Creative Name",
      );

      expect(parsedResult.data.updatedCreative.creativeName).toBe(
        "Updated Creative",
      );
      expect(parsedResult.data.updateSummary.nameChanged).toBe(true);
    });

    it("should update creative status", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            status: "paused",
          },
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain("Status changed to: paused");
      expect(parsedResult.data.updateSummary.statusChanged).toBe(true);
    });

    it("should update advertiser domains", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            advertiserDomains: ["example.com", "brand.com"],
          },
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain(
        "Advertiser Domains updated: example.com, brand.com",
      );
      expect(parsedResult.data.updateSummary.domainsChanged).toBe(true);
    });
  });

  describe("content updates with automatic re-sync", () => {
    beforeEach(() => {
      // Setup for content update scenarios
      mockCreativeSyncService.getCreativeSyncStatus.mockResolvedValue(
        sampleSyncStatus,
      );
      mockCreativeSyncService.syncCreativeToSalesAgents.mockResolvedValue({
        success: ["agent_1", "agent_2"],
        failed: [],
      });
    });

    it("should trigger automatic re-sync when content is updated", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            content: {
              htmlSnippet: "<div>Updated HTML</div>",
              vastTag: "https://example.com/vast.xml",
            },
          },
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      expect(parsedResult.message).toContain(
        "Content updated: HTML Snippet, VAST Tag",
      );
      expect(parsedResult.message).toContain("Automatic Re-Sync in Progress");
      expect(parsedResult.message).toContain(
        "re-syncing to previously synced sales agents",
      );

      expect(parsedResult.data.updateSummary.contentChanged).toBe(true);

      // Verify re-sync was triggered
      expect(
        mockCreativeSyncService.getCreativeSyncStatus,
      ).toHaveBeenCalledWith("creative_123");
      expect(
        mockCreativeSyncService.syncCreativeToSalesAgents,
      ).toHaveBeenCalledWith("creative_123", ["agent_1", "agent_2"], {
        triggeredBy: "creative_update",
      });
    });

    it("should handle case with no previous sync status", async () => {
      mockCreativeSyncService.getCreativeSyncStatus.mockResolvedValue([]);

      const result = await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            content: {
              productUrl: "https://example.com/product",
            },
          },
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);

      // Should not trigger re-sync when no previous sync exists
      expect(
        mockCreativeSyncService.syncCreativeToSalesAgents,
      ).not.toHaveBeenCalled();
    });

    it("should only re-sync to previously synced agents", async () => {
      const mixedSyncStatus = [
        { salesAgentId: "agent_1", status: "synced" as const },
        { salesAgentId: "agent_2", status: "failed" as const },
        { salesAgentId: "agent_3", status: "synced" as const },
      ];

      mockCreativeSyncService.getCreativeSyncStatus.mockResolvedValue(
        mixedSyncStatus,
      );

      await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            content: {
              assetIds: ["new_asset_1", "new_asset_2"],
            },
          },
        },
        mockContext,
      );

      // Should only sync to agents with "synced" status
      expect(
        mockCreativeSyncService.syncCreativeToSalesAgents,
      ).toHaveBeenCalledWith("creative_123", ["agent_1", "agent_3"], {
        triggeredBy: "creative_update",
      });
    });

    it("should handle re-sync failures gracefully", async () => {
      // Mock re-sync to fail
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});
      mockCreativeSyncService.syncCreativeToSalesAgents.mockRejectedValue(
        new Error("Sync service unavailable"),
      );

      const result = await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            content: {
              javascriptTag: "console.log('updated');",
            },
          },
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      // Update should still succeed even if re-sync fails
      expect(parsedResult.success).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Background re-sync failed for updated creative creative_123",
        ),
        expect.any(Error),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should handle sync service initialization failures gracefully", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // Mock service initialization to fail
      vi.mocked(CreativeSyncService).mockImplementation(() => {
        throw new Error("Service initialization failed");
      });

      const result = await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            content: {
              htmlSnippet: "<div>Updated content</div>",
            },
          },
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      // Update should still succeed even if sync setup fails
      expect(parsedResult.success).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to initialize re-sync for creative update:",
        expect.any(Error),
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("non-content updates", () => {
    it("should not trigger re-sync for metadata-only updates", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            name: "New Name",
            status: "active",
            advertiserDomains: ["example.com"],
          },
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);

      // Should not mention automatic re-sync
      expect(parsedResult.message).not.toContain("Automatic Re-Sync");

      // Should not trigger sync service calls
      expect(
        mockCreativeSyncService.getCreativeSyncStatus,
      ).not.toHaveBeenCalled();
      expect(
        mockCreativeSyncService.syncCreativeToSalesAgents,
      ).not.toHaveBeenCalled();
    });
  });

  describe("comprehensive content updates", () => {
    it("should display all content types being updated", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            content: {
              htmlSnippet: "<div>HTML</div>",
              javascriptTag: "console.log('js');",
              vastTag: "https://example.com/vast.xml",
              productUrl: "https://example.com/product",
              assetIds: ["asset_1", "asset_2", "asset_3"],
            },
          },
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain(
        "Content updated: HTML Snippet, JavaScript Tag, VAST Tag, 3 Asset References, Product URL",
      );
    });
  });

  describe("structured response", () => {
    it("should include comprehensive update metadata", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            name: "Updated Name",
            status: "active",
            content: {
              htmlSnippet: "<div>Updated</div>",
            },
            advertiserDomains: ["example.com"],
          },
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      expect(parsedResult.data.configuration).toEqual({
        creativeId: "creative_123",
        updateDate: expect.any(String),
        updates: expect.objectContaining({
          name: "Updated Name",
          status: "active",
          content: expect.objectContaining({
            htmlSnippet: "<div>Updated</div>",
          }),
          advertiserDomains: ["example.com"],
        }),
      });

      expect(parsedResult.data.updateSummary).toEqual({
        contentChanged: true,
        domainsChanged: true,
        nameChanged: true,
        statusChanged: true,
        versionBumped: true,
      });

      expect(parsedResult.data.metadata).toEqual(
        expect.objectContaining({
          action: "update",
          creativeType: "creative",
          orchestrationComplete: true,
          preservesCampaignAssignments: true,
          safeForActiveCampaigns: true,
        }),
      );
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      mockClient.updateCreative = vi
        .fn()
        .mockRejectedValue(new Error("Creative not found"));

      await expect(
        tool.execute(
          {
            creativeId: "nonexistent_id",
            updates: { name: "New Name" },
          },
          mockContext,
        ),
      ).rejects.toThrow("Failed to update creative: Creative not found");
    });

    it("should require at least one update field", async () => {
      await expect(
        tool.execute(
          {
            creativeId: "creative_123",
            updates: {},
          },
          mockContext,
        ),
      ).rejects.toThrow("At least one update field must be provided");
    });
  });

  describe("parameter validation", () => {
    it("should accept valid parameters", () => {
      const validParams = {
        creativeId: "creative_123",
        updates: {
          name: "New Name",
          status: "active" as const,
          content: {
            htmlSnippet: "<div>HTML</div>",
            javascriptTag: "console.log('js');",
            vastTag: "https://example.com/vast.xml",
            productUrl: "https://example.com/product",
            assetIds: ["asset_1", "asset_2"],
          },
          advertiserDomains: ["example.com", "brand.com"],
        },
      };

      const result = tool.parameters.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it("should require creativeId", () => {
      const invalidParams = {
        updates: { name: "New Name" },
      };

      const result = tool.parameters.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("should require at least one update field", () => {
      const invalidParams = {
        creativeId: "creative_123",
        updates: {},
      };

      const result = tool.parameters.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("should validate status enum values", () => {
      const invalidParams = {
        creativeId: "creative_123",
        updates: {
          status: "invalid_status",
        },
      };

      const result = tool.parameters.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });
  });

  describe("campaign preservation", () => {
    it("should display campaign assignments preservation message", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
          updates: {
            name: "Updated Name",
          },
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain("Campaign Assignments (1)");
      expect(parsedResult.message).toContain("🟢 Summer Campaign (camp_1)");
      expect(parsedResult.message).toContain(
        "Campaign assignments preserved across update",
      );
      expect(parsedResult.message).toContain("safe for active campaigns");
    });
  });
});
