import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BrandAgentValidators,
  // expectErrorResponse,
} from "../../../__tests__/utils/structured-response-helpers.js";
import { Scope3ApiClient } from "../../../client/scope3-client.js";
import { getBrandAgentTool } from "./get.js";

// Mock the client
vi.mock("../../../client/scope3-client.js", () => ({
  Scope3ApiClient: vi.fn(),
}));

describe("brand-agents/core/get", () => {
  let mockClient: {
    getBrandAgent: ReturnType<typeof vi.fn>;
  };
  let tool: ReturnType<typeof getBrandAgentTool>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      getBrandAgent: vi.fn(),
    };

    tool = getBrandAgentTool(
      mockClient as Partial<Scope3ApiClient> as Scope3ApiClient,
    );
  });

  it("should return brand agent details with structured data", async () => {
    const mockBrandAgent = {
      createdAt: new Date("2024-01-01T00:00:00Z"),
      customerId: 456,
      description: "Test description",
      id: "123",
      name: "Test Brand Agent",
      updatedAt: new Date("2024-01-02T00:00:00Z"),
    };

    mockClient.getBrandAgent.mockResolvedValueOnce(mockBrandAgent);

    const result = await tool.execute(
      { brandAgentId: "123" },
      {
        session: { scope3ApiKey: "test_api_key" },
      },
    );

    // Validate structured response
    const parsedResponse = BrandAgentValidators.validateGetResponse(result);

    // Dates get serialized to strings in JSON responses
    const expectedBrandAgent = {
      ...mockBrandAgent,
      createdAt: mockBrandAgent.createdAt.toISOString(),
      updatedAt: mockBrandAgent.updatedAt.toISOString(),
    };
    expect(parsedResponse.data).toEqual({ brandAgent: expectedBrandAgent });

    // Verify message content
    expect(result).toContain("Brand Agent Details");
    expect(result).toContain("Test Brand Agent");
    expect(result).toContain("123");
    expect(result).toContain("Test description");
    expect(result).toContain("**Customer ID:** 456");

    expect(mockClient.getBrandAgent).toHaveBeenCalledWith(
      "test_api_key",
      "123",
    );
  });

  it("should handle brand agent not found", async () => {
    mockClient.getBrandAgent.mockRejectedValueOnce(
      new Error("Brand agent not found"),
    );

    await expect(
      tool.execute(
        { brandAgentId: "nonexistent" },
        {
          session: { scope3ApiKey: "test_api_key" },
        },
      ),
    ).rejects.toThrow("Failed to fetch brand agent: Brand agent not found");

    expect(mockClient.getBrandAgent).toHaveBeenCalledWith(
      "test_api_key",
      "nonexistent",
    );
  });

  it("should handle missing API key", async () => {
    await expect(tool.execute({ brandAgentId: "123" }, {})).rejects.toThrow(
      "Authentication required",
    );

    expect(mockClient.getBrandAgent).not.toHaveBeenCalled();
  });

  it("should use environment variable when no session API key", async () => {
    const originalEnv = process.env.SCOPE3_API_KEY;
    process.env.SCOPE3_API_KEY = "env_api_key";

    const mockBrandAgent = {
      createdAt: new Date("2024-01-01T00:00:00Z"),
      customerId: 456,
      description: "Test description",
      id: "123",
      name: "Test Brand Agent",
      updatedAt: new Date("2024-01-02T00:00:00Z"),
    };

    mockClient.getBrandAgent.mockResolvedValueOnce(mockBrandAgent);

    try {
      const result = await tool.execute({ brandAgentId: "123" }, {});

      BrandAgentValidators.validateGetResponse(result);

      expect(mockClient.getBrandAgent).toHaveBeenCalledWith(
        "env_api_key",
        "123",
      );
    } finally {
      process.env.SCOPE3_API_KEY = originalEnv;
    }
  });

  it("should handle brand agent without description", async () => {
    const mockBrandAgent = {
      createdAt: new Date("2024-01-01T00:00:00Z"),
      customerId: 456,
      description: "", // Empty description
      id: "123",
      name: "Test Brand Agent",
      updatedAt: new Date("2024-01-02T00:00:00Z"),
    };

    mockClient.getBrandAgent.mockResolvedValueOnce(mockBrandAgent);

    const result = await tool.execute(
      { brandAgentId: "123" },
      {
        session: { scope3ApiKey: "test_api_key" },
      },
    );

    const parsedResponse = BrandAgentValidators.validateGetResponse(result);

    // Dates get serialized to strings in JSON responses
    const expectedBrandAgent = {
      ...mockBrandAgent,
      createdAt: mockBrandAgent.createdAt.toISOString(),
      updatedAt: mockBrandAgent.updatedAt.toISOString(),
    };
    expect(parsedResponse.data).toEqual({ brandAgent: expectedBrandAgent });

    // Should not contain description section in message
    expect(result).toContain("Test Brand Agent");
    expect(result).not.toContain("• **Description:**");
  });
});
