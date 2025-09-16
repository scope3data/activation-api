import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createBrandAgentBrandStoryTool } from "./create.js";

const mockClient = {
  // Add any methods as needed
} as unknown as Scope3ApiClient;

const _mockContext: MCPToolExecuteContext = {
  session: {
    scope3ApiKey: "test-api-key",
  },
};

const _sampleBrandStoryResponse = {
  id: "bs_123",
  name: "Test Brand Story",
  brandAgentId: "ba_456",
  content: "This is a test brand story content.",
  status: "active",
  createdAt: "2024-01-15T10:30:00Z",
  updatedAt: "2024-01-15T10:30:00Z",
};

describe("createBrandAgentBrandStoryTool", () => {
  const tool = createBrandAgentBrandStoryTool(mockClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("brand-story/create");
      expect(tool.annotations.category).toBe("Brand Stories");
      expect(tool.annotations.dangerLevel).toBe("low");
      expect(tool.annotations.readOnlyHint).toBe(false);
      expect(tool.description).toContain("Create a new brand story");
    });
  });

  describe("authentication", () => {
    it("should throw error when no API key is available", async () => {
      await expect(
        tool.execute(
          {
            brandAgentId: "ba_456",
            name: "Test Brand Story",
            prompt: "Test prompt",
          },
          { session: {} },
        ),
      ).rejects.toThrow("Authentication required");
    });
  });
});