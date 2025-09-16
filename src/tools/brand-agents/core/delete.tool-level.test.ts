import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import { deleteBrandAgentTool } from "./delete.js";

const mockClient = {
  getBrandAgent: vi.fn(),
  deleteBrandAgent: vi.fn(),
} as unknown as Scope3ApiClient;

const mockContext: MCPToolExecuteContext = {
  session: {
    scope3ApiKey: "test-api-key",
  },
};

const _sampleDeleteResponse = {
  id: "ba_123",
  name: "Deleted Brand Agent",
  customerId: 456,
  status: "deleted",
  deletedAt: "2024-01-15T10:30:00Z",
};

describe("deleteBrandAgentTool", () => {
  const tool = deleteBrandAgentTool(mockClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("brand-agent/delete");
      expect(tool.annotations.category).toBe("Brand Agents");
      expect(tool.annotations.dangerLevel).toBe("high");
      expect(tool.annotations.readOnlyHint).toBe(false);
      expect(tool.description).toContain("Permanently delete a brand agent");
    });
  });

  describe("authentication", () => {
    it("should use session API key when provided", async () => {
      mockClient.getBrandAgent = vi.fn().mockResolvedValue({ name: "Test Brand Agent" });
      mockClient.deleteBrandAgent = vi.fn().mockResolvedValue(true);

      const result = await tool.execute(
        {
          brandAgentId: "ba_123",
        },
        mockContext,
      );

      expect(mockClient.getBrandAgent).toHaveBeenCalledWith(
        "test-api-key",
        "ba_123",
      );
      expect(mockClient.deleteBrandAgent).toHaveBeenCalledWith(
        "test-api-key",
        "ba_123",
      );

      // Parse the JSON response to check structured data
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("Brand Agent Deleted Successfully");
    });

    it("should throw error when no API key is available", async () => {
      await expect(
        tool.execute(
          {
            brandAgentId: "ba_123",
          },
          { session: {} },
        ),
      ).rejects.toThrow("Authentication required");
    });
  });

  describe("structured data response", () => {
    beforeEach(() => {
      mockClient.getBrandAgent = vi.fn().mockResolvedValue({ name: "Test Brand Agent" });
      mockClient.deleteBrandAgent = vi.fn().mockResolvedValue(true);
    });

    it("should include structured data with deletion details", async () => {
      const result = await tool.execute(
        {
          brandAgentId: "ba_123",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.data).toBeDefined();
      expect(parsedResult.data.deletedBrandAgent).toBeDefined();
      expect(parsedResult.data.deletedBrandAgent.id).toBe("ba_123");
      expect(parsedResult.data.deletedBrandAgent.name).toBe("Test Brand Agent");
      expect(parsedResult.data.operation).toBe("delete");
      expect(parsedResult.data.timestamp).toBeDefined();
    });

  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      mockClient.getBrandAgent = vi
        .fn()
        .mockRejectedValue(new Error("Brand agent not found"));

      await expect(
        tool.execute(
          {
            brandAgentId: "invalid_id",
          },
          mockContext,
        ),
      ).rejects.toThrow("Failed to delete brand agent: Brand agent not found or inaccessible: Brand agent not found");
    });
  });
});