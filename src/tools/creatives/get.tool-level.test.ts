import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { CreativeValidators } from "../../__tests__/utils/structured-response-helpers.js";
import { creativeGetTool } from "./get.js";

const mockClient = {
  getCreative: vi.fn(),
} as unknown as Scope3ApiClient;

const mockContext: MCPToolExecuteContext = {
  session: {
    scope3ApiKey: "test-api-key",
  },
};

const sampleCreativeResponse = {
  assetIds: ["asset_1", "asset_2"],
  brandAgentId: "ba_456",
  campaignAssignments: [
    {
      campaignId: "camp_1",
      campaignName: "Summer Campaign",
      isActive: true,
    },
  ],
  createdAt: "2024-01-15T10:30:00Z",
  creativeId: "creative_123",
  creativeName: "Test Creative",
  format: "banner",
  lastModifiedDate: "2024-01-15T10:30:00Z",
  status: "active",
  targetAudience: "Sports enthusiasts aged 25-35",
  updatedAt: "2024-01-15T10:30:00Z",
  version: 1,
};

describe("creativeGetTool", () => {
  const tool = creativeGetTool(mockClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("creative/get");
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
      mockClient.getCreative = vi
        .fn()
        .mockResolvedValue(sampleCreativeResponse);

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
    beforeEach(() => {
      mockClient.getCreative = vi
        .fn()
        .mockResolvedValue(sampleCreativeResponse);
    });

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
  });
});
