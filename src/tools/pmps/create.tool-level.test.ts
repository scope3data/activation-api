import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createPMPTool } from "./create.js";

const mockClient = {
  createBrandAgentPMP: vi.fn(),
} as unknown as Scope3ApiClient;

const mockContext: MCPToolExecuteContext = {
  session: {
    scope3ApiKey: "test-api-key",
  },
};

const samplePMPResponse = {
  createdAt: "2024-01-15T10:30:00Z",
  dealIds: [
    {
      dealId: "hulu_123",
      ssp: "Hulu",
      status: "active",
    },
    {
      dealId: "fox_456",
      ssp: "Fox News",
      status: "pending",
    },
  ],
  id: "pmp_123",
  name: "Test PMP",
  status: "active",
  summary: "CTV inventory from Hulu and Fox News targeting premium audiences",
  updatedAt: "2024-01-15T10:30:00Z",
};

describe("createPMPTool", () => {
  const tool = createPMPTool(mockClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("authentication", () => {
    it("should use session API key when provided", async () => {
      mockClient.createBrandAgentPMP = vi
        .fn()
        .mockResolvedValue(samplePMPResponse);

      const result = await tool.execute(
        {
          brand_agent_id: "ba_456",
          name: "Test PMP",
          prompt:
            "Create PMP with CTV inventory from Hulu targeting premium audiences",
        },
        mockContext,
      );

      expect(mockClient.createBrandAgentPMP).toHaveBeenCalledWith(
        "test-api-key",
        {
          brandAgentId: "ba_456",
          name: "Test PMP",
          prompt:
            "Create PMP with CTV inventory from Hulu targeting premium audiences",
        },
      );

      // Parse the JSON response to check structured data
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("PMP Created Successfully");
      expect(parsedResult.message).toContain("pmp_123");
    });

    it("should throw error when no API key is available", async () => {
      // Store original env value and clear it for this test
      const originalEnv = process.env.SCOPE3_API_KEY;
      delete process.env.SCOPE3_API_KEY;

      try {
        await expect(
          tool.execute(
            {
              brand_agent_id: "ba_456",
              name: "Test PMP",
              prompt: "Test prompt",
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
      mockClient.createBrandAgentPMP = vi
        .fn()
        .mockResolvedValue(samplePMPResponse);
    });

    it("should include structured data with PMP details", async () => {
      const result = await tool.execute(
        {
          brand_agent_id: "ba_456",
          name: "Test PMP",
          prompt: "Test prompt",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.data).toBeDefined();
      expect(parsedResult.data.pmp).toEqual(samplePMPResponse);
      expect(parsedResult.data.configuration).toEqual({
        brandAgentId: "ba_456",
        name: "Test PMP",
        prompt: "Test prompt",
      });
    });

    it("should include deal ID summary in structured data", async () => {
      const result = await tool.execute(
        {
          brand_agent_id: "ba_456",
          name: "Test PMP",
          prompt: "Test prompt",
        },
        mockContext,
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult.data.dealIds).toEqual(samplePMPResponse.dealIds);
      expect(parsedResult.data.summary).toBeDefined();
      expect(parsedResult.data.summary.pmpId).toBe("pmp_123");
      expect(parsedResult.data.summary.totalDeals).toBe(2);
      expect(parsedResult.data.summary.activeDeals).toBe(1);
      expect(parsedResult.data.summary.pendingDeals).toBe(1);
      expect(parsedResult.data.summary.sspList).toEqual(["Hulu", "Fox News"]);
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      mockClient.createBrandAgentPMP = vi
        .fn()
        .mockRejectedValue(new Error("Brand agent not found"));

      await expect(
        tool.execute(
          {
            brand_agent_id: "invalid_id",
            name: "Test PMP",
            prompt: "Test prompt",
          },
          mockContext,
        ),
      ).rejects.toThrow("Error creating PMP: Brand agent not found");
    });
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("pmp/create");
      expect(tool.annotations.category).toBe("PMPs");
      expect(tool.annotations.dangerLevel).toBe("medium");
      expect(tool.annotations.readOnlyHint).toBe(false);
      expect(tool.description).toContain("Create a Private Marketplace deal");
    });
  });
});
