import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { checkAuthTool } from "./check.js";

const mockClient = {
  checkAuthentication: vi.fn(),
  getCustomerId: vi.fn(),
} as unknown as Scope3ApiClient;

const mockContext: MCPToolExecuteContext = {
  session: {
    scope3ApiKey: "test-api-key",
  },
};

const _sampleAuthResponse = {
  authenticated: true,
  customerId: 123,
  permissions: ["read", "write"],
  user: {
    email: "test@example.com",
    id: "user_456",
  },
};

describe("checkAuthTool", () => {
  const tool = checkAuthTool(mockClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("tool metadata", () => {
    it("should have correct tool configuration", () => {
      expect(tool.name).toBe("auth/check");
      expect(tool.annotations.category).toBe("System");
      expect(tool.annotations.dangerLevel).toBe("low");
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.description).toContain("Check the authentication status");
    });
  });

  describe("authentication", () => {
    it("should use session API key when provided", async () => {
      mockClient.getCustomerId = vi.fn().mockResolvedValue(123);

      const result = await tool.execute({}, mockContext);

      expect(mockClient.getCustomerId).toHaveBeenCalledWith("test-api-key");

      // Parse the JSON response to check structured data
      const parsedResult = JSON.parse(result);
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.message).toContain("Authentication Status: Verified");
    });

    it("should throw error when no API key is available", async () => {
      await expect(tool.execute({}, { session: {} })).rejects.toThrow(
        "Authentication required",
      );
    });
  });

  describe("structured data response", () => {
    beforeEach(() => {
      mockClient.getCustomerId = vi.fn().mockResolvedValue(123);
    });

    it("should include structured data with auth details", async () => {
      const result = await tool.execute({}, mockContext);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.data).toBeDefined();
      expect(parsedResult.data.authenticated).toBe(true);
      expect(parsedResult.data.customerId).toBe(123);
      expect(parsedResult.data.timestamp).toBeDefined();
      expect(parsedResult.data.apiKeySource).toBeDefined();
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      mockClient.getCustomerId = vi
        .fn()
        .mockRejectedValue(new Error("Invalid API key"));

      await expect(tool.execute({}, mockContext)).rejects.toThrow(
        "Invalid API key",
      );
    });
  });
});
