import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { AuthenticationService } from "../../services/auth-service.js";
import { CreativeSyncService } from "../../services/creative-sync-service.js";
import { NotificationService } from "../../services/notification-service.js";
import { creativeSyncSalesAgentsTool } from "./sync-sales-agents.js";

// Mock the services
vi.mock("../../services/creative-sync-service.js");
vi.mock("../../services/notification-service.js");
vi.mock("../../services/auth-service.js");

const mockClient = {
  getCampaign: vi.fn(),
  getCreative: vi.fn(),
} as unknown as Scope3ApiClient;

const mockContext: MCPToolExecuteContext = {
  session: {
    scope3ApiKey: "test-api-key",
  },
};

const sampleCreativeResponse = {
  buyerAgentId: "456",
  creativeId: "creative_123",
  creativeName: "Test Creative",
  format: {
    formatId: "video/mp4",
    type: "video",
  },
  status: "active",
  version: 1,
};

const sampleSyncStatus = [
  {
    approvalStatus: "approved" as const,
    salesAgentId: "agent_1",
    salesAgentName: "Agent One",
    status: "synced" as const,
  },
  {
    approvalStatus: "pending" as const,
    salesAgentId: "agent_2",
    salesAgentName: "Agent Two",
    status: "synced" as const,
  },
  {
    rejectionReason: "Format not supported",
    salesAgentId: "agent_3",
    salesAgentName: "Agent Three",
    status: "failed" as const,
  },
];

const sampleSyncResults = {
  failed: ["agent_3"],
  success: ["agent_1", "agent_2"],
};

describe("creativeSyncSalesAgentsTool", () => {
  const tool = creativeSyncSalesAgentsTool(mockClient);

  // Mock service instances
  const mockCreativeSyncService = {
    determineRelevantSalesAgents: vi.fn(),
    getCreativeSyncStatus: vi.fn(),
    setNotificationService: vi.fn(),
    syncCreativeToSalesAgents: vi.fn(),
  };

  const mockNotificationService = {};

  const mockAuthService = {
    validateApiKey: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup service mocks
    vi.mocked(CreativeSyncService).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => mockCreativeSyncService as any,
    );
    vi.mocked(NotificationService).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => mockNotificationService as any,
    );
    vi.mocked(AuthenticationService).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => mockAuthService as any,
    );

    // Default auth validation
    mockAuthService.validateApiKey.mockResolvedValue({
      customerId: 123,
      isValid: true,
    });

    // Default creative response
    mockClient.getCreative = vi.fn().mockResolvedValue(sampleCreativeResponse);
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("creative_sync_sales_agents");
      expect(tool.annotations.category).toBe("Creative Assets");
      expect(tool.annotations.dangerLevel).toBe("medium");
      expect(tool.annotations.readOnlyHint).toBe(false);
      expect(tool.description).toContain("smart auto-detection");
    });
  });

  describe("authentication", () => {
    it("should use session API key when provided", async () => {
      // Setup successful sync scenario
      mockCreativeSyncService.determineRelevantSalesAgents.mockResolvedValue([
        "agent_1",
        "agent_2",
      ]);
      mockCreativeSyncService.syncCreativeToSalesAgents.mockResolvedValue(
        sampleSyncResults,
      );
      mockCreativeSyncService.getCreativeSyncStatus.mockResolvedValue(
        sampleSyncStatus.slice(0, 2),
      );

      await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      expect(mockAuthService.validateApiKey).toHaveBeenCalledWith(
        "test-api-key",
      );
      expect(mockClient.getCreative).toHaveBeenCalledWith(
        "test-api-key",
        "creative_123",
      );
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
        ).rejects.toThrow(
          "Authentication required. Please provide valid API key in headers (x-scope3-api-key or Authorization: Bearer).",
        );
      } finally {
        // Restore original env value
        if (originalEnv) {
          process.env.SCOPE3_API_KEY = originalEnv;
        }
      }
    });

    it("should throw error when API key is invalid", async () => {
      mockAuthService.validateApiKey.mockRejectedValue(
        new Error("Invalid API key"),
      );

      await expect(
        tool.execute(
          {
            creativeId: "creative_123",
          },
          mockContext,
        ),
      ).rejects.toThrow("Invalid API key");
    });
  });

  describe("auto-detection sync", () => {
    beforeEach(() => {
      mockCreativeSyncService.determineRelevantSalesAgents.mockResolvedValue([
        "agent_1",
        "agent_2",
      ]);
      mockCreativeSyncService.syncCreativeToSalesAgents.mockResolvedValue(
        sampleSyncResults,
      );
      mockCreativeSyncService.getCreativeSyncStatus.mockResolvedValue(
        sampleSyncStatus.slice(0, 2),
      );
    });

    it("should perform auto-detection with default options", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      expect(
        mockCreativeSyncService.determineRelevantSalesAgents,
      ).toHaveBeenCalledWith("creative_123", 456, {});

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("auto_detect_30days");
      expect(parsedResult.data.smartSync.method).toBe("auto_detect_30days");
    });

    it("should respect custom auto-detect options", async () => {
      const result = await tool.execute(
        {
          autoDetect: {
            daysBack: 60,
            includeActive: true,
          },
          creativeId: "creative_123",
        },
        mockContext,
      );

      expect(
        mockCreativeSyncService.determineRelevantSalesAgents,
      ).toHaveBeenCalledWith("creative_123", 456, {
        daysBack: 60,
        includeActive: true,
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.data.smartSync.method).toBe("auto_detect_60days");
      expect(parsedResult.data.smartSync.agentsFound).toBe(2);
    });

    it("should handle no sales agents found", async () => {
      mockCreativeSyncService.determineRelevantSalesAgents.mockResolvedValue(
        [],
      );

      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("No Relevant Sales Agents Found");
      expect(parsedResult.data.smartSync.agentsFound).toBe(0);
      expect(parsedResult.message).toContain(
        'Use `salesAgentIds: ["agent1", "agent2"]` to manually specify agents',
      );
    });
  });

  describe("manual override sync", () => {
    beforeEach(() => {
      mockCreativeSyncService.syncCreativeToSalesAgents.mockResolvedValue(
        sampleSyncResults,
      );
      mockCreativeSyncService.getCreativeSyncStatus.mockResolvedValue(
        sampleSyncStatus,
      );
    });

    it("should use manually specified sales agent IDs", async () => {
      const manualAgents = ["agent_1", "agent_2", "agent_3"];

      const result = await tool.execute(
        {
          creativeId: "creative_123",
          salesAgentIds: manualAgents,
        },
        mockContext,
      );

      expect(
        mockCreativeSyncService.syncCreativeToSalesAgents,
      ).toHaveBeenCalledWith("creative_123", manualAgents, {
        campaignId: undefined,
        triggeredBy: "manual",
      });

      const parsedResult = JSON.parse(result);
      expect(parsedResult.data.smartSync.method).toBe("manual_override");
      expect(parsedResult.data.smartSync.agentsFound).toBe(3);
    });

    it("should not call auto-detection when manual IDs provided", async () => {
      await tool.execute(
        {
          creativeId: "creative_123",
          salesAgentIds: ["agent_1"],
        },
        mockContext,
      );

      expect(
        mockCreativeSyncService.determineRelevantSalesAgents,
      ).not.toHaveBeenCalled();
    });
  });

  describe("campaign-specific sync", () => {
    const sampleCampaignResponse = {
      id: "camp_123",
      name: "Test Campaign",
    };

    beforeEach(() => {
      mockClient.getCampaign = vi
        .fn()
        .mockResolvedValue(sampleCampaignResponse);
      mockCreativeSyncService.determineRelevantSalesAgents.mockResolvedValue([
        "agent_1",
      ]);
      mockCreativeSyncService.syncCreativeToSalesAgents.mockResolvedValue({
        failed: [],
        success: ["agent_1"],
      });
      mockCreativeSyncService.getCreativeSyncStatus.mockResolvedValue([
        sampleSyncStatus[0],
      ]);
    });

    it("should sync to campaign tactics agents", async () => {
      const result = await tool.execute(
        {
          campaignId: "camp_123",
          creativeId: "creative_123",
        },
        mockContext,
      );

      expect(mockClient.getCampaign).toHaveBeenCalledWith(
        "test-api-key",
        "camp_123",
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.data.smartSync.method).toBe("campaign_tactics");
      expect(parsedResult.data.smartSync.agentsFound).toBe(1);
    });

    it("should handle campaign not found", async () => {
      mockClient.getCampaign = vi.fn().mockResolvedValue(null);

      await expect(
        tool.execute(
          {
            campaignId: "nonexistent_camp",
            creativeId: "creative_123",
          },
          mockContext,
        ),
      ).rejects.toThrow("Campaign nonexistent_camp not found");
    });
  });

  describe("sync results handling", () => {
    beforeEach(() => {
      mockCreativeSyncService.determineRelevantSalesAgents.mockResolvedValue([
        "agent_1",
        "agent_2",
        "agent_3",
      ]);
      mockCreativeSyncService.syncCreativeToSalesAgents.mockResolvedValue(
        sampleSyncResults,
      );
      mockCreativeSyncService.getCreativeSyncStatus.mockResolvedValue(
        sampleSyncStatus,
      );
    });

    it("should categorize sync results correctly", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      expect(parsedResult.data.nextSteps).toEqual({
        awaitingApproval: 1,
        needsAttention: 1,
        readyForDeployment: 1,
      });

      expect(parsedResult.data.salesAgents).toHaveLength(3);
      expect(parsedResult.data.syncResults.success).toHaveLength(2);
      expect(parsedResult.data.syncResults.failed).toHaveLength(1);
    });

    it("should include detailed status messages", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      expect(parsedResult.message).toContain("✅ **Successfully Synced** (2)");
      expect(parsedResult.message).toContain("❌ **Sync Failed** (1)");
      expect(parsedResult.message).toContain("**Agent One**: ✅ approved");
      expect(parsedResult.message).toContain("**Agent Two**: ⏳ pending");
      expect(parsedResult.message).toContain("Format not supported");
    });

    it("should provide relevant next steps", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      expect(parsedResult.message).toContain("## 💡 **Next Steps**");
      expect(parsedResult.message).toContain(
        "**✅ Ready for Campaign Deployment** (1 agents)",
      );
      expect(parsedResult.message).toContain(
        "**⏳ Awaiting Approval** (1 agents)",
      );
      expect(parsedResult.message).toContain(
        "**❌ Address Sync Failures** (1 agents)",
      );
    });
  });

  describe("pre-approval handling", () => {
    beforeEach(() => {
      mockCreativeSyncService.determineRelevantSalesAgents.mockResolvedValue([
        "agent_1",
      ]);
      mockCreativeSyncService.syncCreativeToSalesAgents.mockResolvedValue({
        failed: [],
        success: ["agent_1"],
      });
      mockCreativeSyncService.getCreativeSyncStatus.mockResolvedValue([
        sampleSyncStatus[0],
      ]);
    });

    it("should indicate pre-approval request in response", async () => {
      const result = await tool.execute(
        {
          creativeId: "creative_123",
          preApproval: true,
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain("Pre-Approval Requested");
      // The implementation doesn't return a configuration.preApproval field
      expect(parsedResult.success).toBe(true);
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
      ).rejects.toThrow("Creative nonexistent_id not found");
    });

    it("should handle sync service errors", async () => {
      mockCreativeSyncService.determineRelevantSalesAgents.mockRejectedValue(
        new Error("Service unavailable"),
      );

      await expect(
        tool.execute(
          {
            creativeId: "creative_123",
          },
          mockContext,
        ),
      ).rejects.toThrow(
        "Failed to sync creative to sales agents: Service unavailable",
      );
    });

    it("should handle API errors gracefully", async () => {
      mockClient.getCreative = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      await expect(
        tool.execute(
          {
            creativeId: "creative_123",
          },
          mockContext,
        ),
      ).rejects.toThrow("Network error");
    });
  });

  describe("parameter validation", () => {
    it("should accept valid parameters", () => {
      const validParams = {
        autoDetect: {
          daysBack: 30,
          includeActive: true,
        },
        campaignId: "camp_123",
        creativeId: "creative_123",
        preApproval: true,
        salesAgentIds: ["agent_1", "agent_2"],
      };

      const result = tool.inputSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it("should require creativeId", () => {
      const invalidParams = {};

      const result = tool.inputSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("should validate daysBack range", () => {
      const invalidParams = {
        autoDetect: {
          daysBack: 100, // Over max of 90
        },
        creativeId: "creative_123",
      };

      const result = tool.inputSchema.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("should validate salesAgentIds array", () => {
      const validParams = {
        creativeId: "creative_123",
        salesAgentIds: ["agent_1", "agent_2"],
      };

      const result = tool.inputSchema.safeParse(validParams);
      expect(result.success).toBe(true);
    });
  });

  describe("service integration", () => {
    it("should initialize services correctly", async () => {
      mockCreativeSyncService.determineRelevantSalesAgents.mockResolvedValue(
        [],
      );

      await tool.execute(
        {
          creativeId: "creative_123",
        },
        mockContext,
      );

      expect(CreativeSyncService).toHaveBeenCalledWith(expect.any(Object));
      expect(NotificationService).toHaveBeenCalledWith(expect.any(Object));
      expect(
        mockCreativeSyncService.setNotificationService,
      ).toHaveBeenCalledWith(mockNotificationService);
    });

    it("should pass correct options to sync service", async () => {
      // Mock campaign response for campaign-specific sync
      mockClient.getCampaign = vi.fn().mockResolvedValue({
        id: "camp_123",
        name: "Test Campaign",
        status: "active",
      });
      mockCreativeSyncService.determineRelevantSalesAgents.mockResolvedValue([
        "agent_1",
      ]);
      mockCreativeSyncService.syncCreativeToSalesAgents.mockResolvedValue({
        failed: [],
        success: ["agent_1"],
      });
      mockCreativeSyncService.getCreativeSyncStatus.mockResolvedValue([
        sampleSyncStatus[0],
      ]);

      await tool.execute(
        {
          campaignId: "camp_123",
          creativeId: "creative_123",
        },
        mockContext,
      );

      expect(
        mockCreativeSyncService.syncCreativeToSalesAgents,
      ).toHaveBeenCalledWith("creative_123", ["agent_1"], {
        campaignId: "camp_123",
        triggeredBy: "manual",
      });
    });
  });
});
