import { beforeEach, describe, expect, it, vi } from "vitest";

import { Scope3ApiClient } from "../../../client/scope3-client.js";
import { updateBrandAgentTool } from "./update.js";
import { BrandAgentValidators, expectErrorResponse } from "../../../__tests__/utils/structured-response-helpers.js";

// Mock the client
vi.mock("../../../client/scope3-client.js", () => ({
  Scope3ApiClient: vi.fn(),
}));

describe("brand-agents/core/update", () => {
  let mockClient: {
    updateBrandAgent: ReturnType<typeof vi.fn>;
  };
  let tool: ReturnType<typeof updateBrandAgentTool>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockClient = {
      updateBrandAgent: vi.fn(),
    };

    tool = updateBrandAgentTool(
      mockClient as Partial<Scope3ApiClient> as Scope3ApiClient,
    );
  });

  it("should update brand agent name with structured data", async () => {
    const mockUpdatedBrandAgent = {
      id: "123",
      name: "Updated Brand Agent",
      description: "Original description",
      customerId: 456,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-02T00:00:00Z"),
    };

    mockClient.updateBrandAgent.mockResolvedValueOnce(mockUpdatedBrandAgent);

    const result = await tool.execute(
      { 
        brandAgentId: "123",
        name: "Updated Brand Agent"
      },
      {
        session: { scope3ApiKey: "test_api_key" },
      },
    );

    // Validate structured response
    const parsedResponse = BrandAgentValidators.validateGetResponse(result);
    
    // Dates get serialized to strings in JSON responses
    const expectedBrandAgent = {
      ...mockUpdatedBrandAgent,
      createdAt: mockUpdatedBrandAgent.createdAt.toISOString(),
      updatedAt: mockUpdatedBrandAgent.updatedAt.toISOString(),
    };
    
    expect(parsedResponse.data).toEqual({
      brandAgent: expectedBrandAgent,
      changes: {
        name: "Updated Brand Agent",
        description: undefined,
        tacticSeedDataCoop: undefined,
      },
    });

    // Verify message content (result is JSON string)
    const parsedMessage = JSON.parse(result);
    expect(parsedMessage.message).toContain("Brand Agent Updated Successfully");
    expect(parsedMessage.message).toContain("Updated Brand Agent");
    expect(parsedMessage.message).toContain("Name updated to: \"Updated Brand Agent\"");

    expect(mockClient.updateBrandAgent).toHaveBeenCalledWith("test_api_key", "123", {
      name: "Updated Brand Agent",
    });
  });

  it("should update multiple fields with structured data", async () => {
    const mockUpdatedBrandAgent = {
      id: "123",
      name: "New Name",
      description: "New description",
      customerId: 456,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-02T00:00:00Z"),
    };

    mockClient.updateBrandAgent.mockResolvedValueOnce(mockUpdatedBrandAgent);

    const result = await tool.execute(
      {
        brandAgentId: "123",
        name: "New Name",
        description: "New description",
        tacticSeedDataCoop: true,
      },
      {
        session: { scope3ApiKey: "test_api_key" },
      },
    );

    // Validate structured response
    const parsedResponse = BrandAgentValidators.validateGetResponse(result);

    expect(parsedResponse.data.changes).toEqual({
      name: "New Name",
      description: "New description",
      tacticSeedDataCoop: true,
    });

    // Verify message content (result is JSON string)
    const parsedMessage = JSON.parse(result);
    expect(parsedMessage.message).toContain("Name updated to: \"New Name\"");
    expect(parsedMessage.message).toContain("Description updated to: \"New description\"");
    expect(parsedMessage.message).toContain("Tactic Seed Data Cooperative: enabled");

    expect(mockClient.updateBrandAgent).toHaveBeenCalledWith("test_api_key", "123", {
      name: "New Name",
      description: "New description",
      tacticSeedDataCoop: true,
    });
  });

  it("should handle no changes specified", async () => {
    const result = await tool.execute(
      { brandAgentId: "123" },
      {
        session: { scope3ApiKey: "test_api_key" },
      },
    );

    expectErrorResponse(result, "No changes specified");
    
    const parsedResponse = JSON.parse(result);
    expect(parsedResponse.data).toEqual({
      brandAgentId: "123",
      changes: {},
    });

    expect(mockClient.updateBrandAgent).not.toHaveBeenCalled();
  });

  it("should handle update failure", async () => {
    mockClient.updateBrandAgent.mockRejectedValueOnce(
      new Error("Brand agent not found"),
    );

    await expect(
      tool.execute(
        {
          brandAgentId: "nonexistent",
          name: "New Name",
        },
        {
          session: { scope3ApiKey: "test_api_key" },
        },
      ),
    ).rejects.toThrow("Failed to update brand agent: Brand agent not found");

    expect(mockClient.updateBrandAgent).toHaveBeenCalledWith(
      "test_api_key",
      "nonexistent",
      { name: "New Name" }
    );
  });

  it("should handle missing API key", async () => {
    await expect(
      tool.execute(
        { brandAgentId: "123", name: "New Name" },
        {}
      )
    ).rejects.toThrow("Authentication required");

    expect(mockClient.updateBrandAgent).not.toHaveBeenCalled();
  });

  it("should use environment variable when no session API key", async () => {
    const originalEnv = process.env.SCOPE3_API_KEY;
    process.env.SCOPE3_API_KEY = "env_api_key";

    const mockUpdatedBrandAgent = {
      id: "123",
      name: "Updated Name",
      description: "",
      customerId: 456,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-02T00:00:00Z"),
    };

    mockClient.updateBrandAgent.mockResolvedValueOnce(mockUpdatedBrandAgent);

    try {
      const result = await tool.execute(
        { brandAgentId: "123", name: "Updated Name" },
        {}
      );

      BrandAgentValidators.validateGetResponse(result);

      expect(mockClient.updateBrandAgent).toHaveBeenCalledWith(
        "env_api_key",
        "123",
        { name: "Updated Name" }
      );
    } finally {
      process.env.SCOPE3_API_KEY = originalEnv;
    }
  });

  it("should handle tacticSeedDataCoop disabled", async () => {
    const mockUpdatedBrandAgent = {
      id: "123",
      name: "Test Brand Agent",
      description: "Test description",
      customerId: 456,
      createdAt: new Date("2024-01-01T00:00:00Z"),
      updatedAt: new Date("2024-01-02T00:00:00Z"),
    };

    mockClient.updateBrandAgent.mockResolvedValueOnce(mockUpdatedBrandAgent);

    const result = await tool.execute(
      {
        brandAgentId: "123",
        tacticSeedDataCoop: false,
      },
      {
        session: { scope3ApiKey: "test_api_key" },
      },
    );

    const parsedMessage = JSON.parse(result);
    expect(parsedMessage.message).toContain("Tactic Seed Data Cooperative: disabled");

    expect(mockClient.updateBrandAgent).toHaveBeenCalledWith("test_api_key", "123", {
      tacticSeedDataCoop: false,
    });
  });
});