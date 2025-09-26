import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { AuthenticationService } from "../../services/auth-service.js";
import { CreativeSyncService } from "../../services/creative-sync-service.js";
import { NotificationService } from "../../services/notification-service.js";
import { creativeAssignTool, creativeUnassignTool } from "./assign.js";

// Mock the services
vi.mock("../../services/creative-sync-service.js");
vi.mock("../../services/notification-service.js");
vi.mock("../../services/auth-service.js");

const mockClient = {
  assignCreativeToCampaign: vi.fn(),
  unassignCreativeFromCampaign: vi.fn(),
} as unknown as Scope3ApiClient;

const mockContext: MCPToolExecuteContext = {
  session: {
    customerId: 123,
    scope3ApiKey: "test-api-key",
  },
};

const successfulAssignmentResult = {
  message: "Creative assigned successfully",
  success: true,
};

const successfulUnassignmentResult = {
  message: "Creative unassigned successfully",
  success: true,
};

describe("creativeAssignTool", () => {
  const tool = creativeAssignTool(mockClient);

  // Mock service instances
  const mockCreativeSyncService = {
    onCreativeAssignedToCampaign: vi.fn(),
    setNotificationService: vi.fn(),
  };

  const mockNotificationService = {};
  const mockAuthService = {};

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

    // Default successful assignment response
    mockClient.assignCreativeToCampaign = vi
      .fn()
      .mockResolvedValue(successfulAssignmentResult);

    // Mock sync service to resolve successfully
    mockCreativeSyncService.onCreativeAssignedToCampaign.mockResolvedValue(
      undefined,
    );
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("creative_assign");
      expect(tool.annotations.category).toBe("Creatives");
      expect(tool.annotations.dangerLevel).toBe("medium");
      expect(tool.annotations.readOnlyHint).toBe(false);
      expect(tool.description).toContain("Assign a creative to a campaign");
    });
  });

  describe("authentication", () => {
    it("should use session API key when provided", async () => {
      const result = await tool.execute(
        {
          buyerAgentId: "ba_123",
          campaignId: "camp_456",
          creativeId: "creative_789",
        },
        mockContext,
      );

      expect(mockClient.assignCreativeToCampaign).toHaveBeenCalledWith(
        "test-api-key",
        "creative_789",
        "camp_456",
        "ba_123",
      );

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
              buyerAgentId: "ba_123",
              campaignId: "camp_456",
              creativeId: "creative_789",
            },
            { session: {} },
          ),
        ).rejects.toThrow("Authentication required. Please provide valid API key in headers (x-scope3-api-key or Authorization: Bearer).");
      } finally {
        if (originalEnv) {
          process.env.SCOPE3_API_KEY = originalEnv;
        }
      }
    });
  });

  describe("successful assignment", () => {
    it("should assign creative to campaign", async () => {
      const result = await tool.execute(
        {
          buyerAgentId: "ba_123",
          campaignId: "camp_456",
          creativeId: "creative_789",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("Creative assigned successfully");
      expect(parsedResult.message).toContain("creative_789");
      expect(parsedResult.message).toContain("camp_456");
      expect(parsedResult.message).toContain("ba_123");

      expect(parsedResult.data.configuration).toEqual({
        assignmentDate: expect.any(String),
        buyerAgentId: "ba_123",
        campaignId: "camp_456",
        creativeId: "creative_789",
      });

      expect(parsedResult.data.status).toEqual({
        isActive: true,
        message: "Creative assigned successfully",
        success: true,
      });
    });

    it("should include metadata about the assignment", async () => {
      const result = await tool.execute(
        {
          buyerAgentId: "ba_123",
          campaignId: "camp_456",
          creativeId: "creative_789",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      expect(parsedResult.data.metadata).toEqual({
        action: "assign",
        assignmentType: "creative-campaign",
        ownershipValidated: true,
        performanceTrackingEnabled: true,
      });
    });

    it("should mention automatic sync in response message", async () => {
      const result = await tool.execute(
        {
          buyerAgentId: "ba_123",
          campaignId: "camp_456",
          creativeId: "creative_789",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain("Automatic Sync in Progress");
      expect(parsedResult.message).toContain(
        "Creative is being automatically synced to sales agents",
      );
      expect(parsedResult.message).toContain(
        "Format-compatible sales agents will receive the creative",
      );
    });
  });

  describe("automatic sync trigger", () => {
    it("should trigger automatic sync after successful assignment", async () => {
      await tool.execute(
        {
          buyerAgentId: "ba_123",
          campaignId: "camp_456",
          creativeId: "creative_789",
        },
        mockContext,
      );

      expect(CreativeSyncService).toHaveBeenCalledWith(expect.any(Object));
      expect(NotificationService).toHaveBeenCalledWith(expect.any(Object));
      expect(
        mockCreativeSyncService.setNotificationService,
      ).toHaveBeenCalledWith(mockNotificationService);

      expect(
        mockCreativeSyncService.onCreativeAssignedToCampaign,
      ).toHaveBeenCalledWith("creative_789", "camp_456");
    });

    it("should handle sync service failures gracefully", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // Mock sync to fail
      mockCreativeSyncService.onCreativeAssignedToCampaign.mockRejectedValue(
        new Error("Sync service unavailable"),
      );

      const result = await tool.execute(
        {
          buyerAgentId: "ba_123",
          campaignId: "camp_456",
          creativeId: "creative_789",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      // Assignment should still succeed even if sync fails
      expect(parsedResult.success).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Background sync failed for creative creative_789 in campaign camp_456",
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
          buyerAgentId: "ba_123",
          campaignId: "camp_456",
          creativeId: "creative_789",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      // Assignment should still succeed even if sync setup fails
      expect(parsedResult.success).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to initialize sync services:",
        expect.any(Error),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should not trigger sync if assignment fails", async () => {
      mockClient.assignCreativeToCampaign = vi.fn().mockResolvedValue({
        message: "Buyer agent validation failed",
        success: false,
      });

      await expect(
        tool.execute(
          {
            buyerAgentId: "ba_123",
            campaignId: "camp_456",
            creativeId: "creative_789",
          },
          mockContext,
        ),
      ).rejects.toThrow(
        "Failed to assign creative: Buyer agent validation failed",
      );

      expect(
        mockCreativeSyncService.onCreativeAssignedToCampaign,
      ).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle assignment API failures", async () => {
      mockClient.assignCreativeToCampaign = vi.fn().mockResolvedValue({
        message: "Creative not found",
        success: false,
      });

      await expect(
        tool.execute(
          {
            buyerAgentId: "ba_123",
            campaignId: "camp_456",
            creativeId: "nonexistent_id",
          },
          mockContext,
        ),
      ).rejects.toThrow("Failed to assign creative: Creative not found");
    });

    it("should handle API errors gracefully", async () => {
      mockClient.assignCreativeToCampaign = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      await expect(
        tool.execute(
          {
            buyerAgentId: "ba_123",
            campaignId: "camp_456",
            creativeId: "creative_789",
          },
          mockContext,
        ),
      ).rejects.toThrow("Failed to assign creative to campaign: Network error");
    });
  });

  describe("parameter validation", () => {
    it("should accept valid parameters", () => {
      const validParams = {
        buyerAgentId: "ba_123",
        campaignId: "camp_456",
        creativeId: "creative_789",
      };

      const result = tool.parameters.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it("should require buyerAgentId", () => {
      const invalidParams = {
        campaignId: "camp_456",
        creativeId: "creative_789",
      };

      const result = tool.parameters.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("should require campaignId", () => {
      const invalidParams = {
        buyerAgentId: "ba_123",
        creativeId: "creative_789",
      };

      const result = tool.parameters.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("should require creativeId", () => {
      const invalidParams = {
        buyerAgentId: "ba_123",
        campaignId: "camp_456",
      };

      const result = tool.parameters.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });
  });
});

describe("creativeUnassignTool", () => {
  const tool = creativeUnassignTool(mockClient);

  beforeEach(() => {
    vi.clearAllMocks();

    // Default successful unassignment response
    mockClient.unassignCreativeFromCampaign = vi
      .fn()
      .mockResolvedValue(successfulUnassignmentResult);
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("creative_unassign");
      expect(tool.annotations.category).toBe("Creatives");
      expect(tool.annotations.dangerLevel).toBe("medium");
      expect(tool.annotations.readOnlyHint).toBe(false);
      expect(tool.description).toContain(
        "Remove a creative assignment from a campaign",
      );
    });
  });

  describe("authentication", () => {
    it("should use session API key when provided", async () => {
      const result = await tool.execute(
        {
          campaignId: "camp_456",
          creativeId: "creative_789",
        },
        mockContext,
      );

      expect(mockClient.unassignCreativeFromCampaign).toHaveBeenCalledWith(
        "test-api-key",
        "creative_789",
        "camp_456",
      );

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
              campaignId: "camp_456",
              creativeId: "creative_789",
            },
            { session: {} },
          ),
        ).rejects.toThrow("Authentication required. Please provide valid API key in headers (x-scope3-api-key or Authorization: Bearer).");
      } finally {
        if (originalEnv) {
          process.env.SCOPE3_API_KEY = originalEnv;
        }
      }
    });
  });

  describe("successful unassignment", () => {
    it("should unassign creative from campaign", async () => {
      const result = await tool.execute(
        {
          campaignId: "camp_456",
          creativeId: "creative_789",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain(
        "Creative unassigned successfully",
      );
      expect(parsedResult.message).toContain("creative_789");
      expect(parsedResult.message).toContain("camp_456");

      expect(parsedResult.data.configuration).toEqual({
        campaignId: "camp_456",
        creativeId: "creative_789",
        unassignmentDate: expect.any(String),
      });

      expect(parsedResult.data.status).toEqual({
        isActive: false,
        message: "Creative unassigned successfully",
        success: true,
      });
    });

    it("should include metadata about the unassignment", async () => {
      const result = await tool.execute(
        {
          campaignId: "camp_456",
          creativeId: "creative_789",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);

      expect(parsedResult.data.metadata).toEqual({
        action: "unassign",
        assignmentType: "creative-campaign",
        availableForReassignment: true,
        performanceTrackingStopped: true,
      });
    });

    it("should include helpful next steps in response", async () => {
      const result = await tool.execute(
        {
          campaignId: "camp_456",
          creativeId: "creative_789",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.message).toContain("Next Steps");
      expect(parsedResult.message).toContain("creative/list");
      expect(parsedResult.message).toContain("creative/assign");
      expect(parsedResult.message).toContain("campaign/list_creatives");
    });
  });

  describe("error handling", () => {
    it("should handle unassignment API failures", async () => {
      mockClient.unassignCreativeFromCampaign = vi.fn().mockResolvedValue({
        message: "Assignment not found",
        success: false,
      });

      await expect(
        tool.execute(
          {
            campaignId: "camp_456",
            creativeId: "creative_789",
          },
          mockContext,
        ),
      ).rejects.toThrow("Failed to unassign creative: Assignment not found");
    });

    it("should handle API errors gracefully", async () => {
      mockClient.unassignCreativeFromCampaign = vi
        .fn()
        .mockRejectedValue(new Error("Network error"));

      await expect(
        tool.execute(
          {
            campaignId: "camp_456",
            creativeId: "creative_789",
          },
          mockContext,
        ),
      ).rejects.toThrow(
        "Failed to unassign creative from campaign: Network error",
      );
    });
  });

  describe("parameter validation", () => {
    it("should accept valid parameters", () => {
      const validParams = {
        campaignId: "camp_456",
        creativeId: "creative_789",
      };

      const result = tool.parameters.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it("should require campaignId", () => {
      const invalidParams = {
        creativeId: "creative_789",
      };

      const result = tool.parameters.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });

    it("should require creativeId", () => {
      const invalidParams = {
        campaignId: "camp_456",
      };

      const result = tool.parameters.safeParse(invalidParams);
      expect(result.success).toBe(false);
    });
  });
});
