import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createBrandAgentTool } from "../../tools/brand-agents/core/create.js";
import { deleteBrandAgentTool } from "../../tools/brand-agents/core/delete.js";
import { getBrandAgentTool } from "../../tools/brand-agents/core/get.js";
import { listBrandAgentsTool } from "../../tools/brand-agents/core/list.js";
import { updateBrandAgentTool } from "../../tools/brand-agents/core/update.js";
import { brandAgentFixtures } from "../fixtures/brand-agent-fixtures.js";

/**
 * Tool-Level Integration Tests
 *
 * These tests validate the complete tool execution flow including:
 * - Parameter validation (Zod schemas)
 * - Authentication handling
 * - Service orchestration
 * - Response formatting
 * - Error handling
 *
 * This is the highest level of testing - closest to actual user interaction.
 * Tests the public API contract without any implementation mocking.
 */

// Mock the entire Scope3ApiClient at the module level
vi.mock("../client/scope3-client.js", () => {
  const mockClient = {
    createBrandAgent: vi.fn(),
    deleteBrandAgent: vi.fn(),
    getBrandAgent: vi.fn(),
    listBrandAgents: vi.fn(),
    updateBrandAgent: vi.fn(),
  };

  return {
    __mockClient: mockClient, // Expose for test access
    Scope3ApiClient: vi.fn(() => mockClient),
  };
});

describe("Brand Agent MCP Tools - Complete Integration", () => {
  let mockContext: MCPToolExecuteContext;
  let mockClient: any;

  beforeEach(async () => {
    // Get the mock client instance
    const { Scope3ApiClient } = await import("../../client/scope3-client.js");
    mockClient = (Scope3ApiClient as any).__mockClient;

    // Reset all mocks
    vi.clearAllMocks();

    // Setup test context
    mockContext = {
      session: {
        scope3ApiKey: "test_api_key_123",
      },
    };
  });

  describe("list-brand-agents tool", () => {
    it("should execute successfully with valid parameters", async () => {
      // Arrange
      const toolInstance = listBrandAgentsTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.listBrandAgents.mockResolvedValue([
        brandAgentFixtures.fullyEnhancedBrandAgent(),
        brandAgentFixtures.graphqlOnlyBrandAgent(),
      ]);

      // Act
      const result = await toolInstance.execute({}, mockContext);

      // Assert
      expect(result).toContain("Found 2 brand agents");
      expect(result).toContain("GraphQL Test Brand");
      expect(result).toContain("ID:");
      expect(result).toContain("Customer:");
      expect(result).toContain("💡 **Tip:**");
      expect(mockClient.listBrandAgents).toHaveBeenCalledWith(
        "test_api_key_123",
        undefined,
      );
    });

    it("should handle filtering parameters", async () => {
      // Arrange
      const toolInstance = listBrandAgentsTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.listBrandAgents.mockResolvedValue([
        brandAgentFixtures.fullyEnhancedBrandAgent(),
      ]);

      const params = {
        where: {
          customerId: 12345,
          name: "Test",
        },
      };

      // Act
      const result = await toolInstance.execute(params, mockContext);

      // Assert
      expect(result).toContain("Found 1 brand agent");
      expect(mockClient.listBrandAgents).toHaveBeenCalledWith(
        "test_api_key_123",
        {
          customerId: { equals: 12345 },
          name: { contains: "Test" },
        },
      );
    });

    it("should handle empty results gracefully", async () => {
      // Arrange
      const toolInstance = listBrandAgentsTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.listBrandAgents.mockResolvedValue([]);

      // Act
      const result = await toolInstance.execute({}, mockContext);

      // Assert
      expect(result).toContain("No brand agents found");
      expect(result).toContain("Create your first brand agent");
    });

    it("should handle authentication errors with helpful message", async () => {
      // Arrange
      const toolInstance = listBrandAgentsTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.listBrandAgents.mockRejectedValue(
        new Error("Authentication failed"),
      );

      // Act & Assert
      await expect(toolInstance.execute({}, mockContext)).rejects.toThrow(
        "Failed to fetch brand agents: Authentication failed",
      );
    });

    it("should use environment variable when session key unavailable", async () => {
      // Arrange
      const toolInstance = listBrandAgentsTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.listBrandAgents.mockResolvedValue([]);

      // Set environment variable
      process.env.SCOPE3_API_KEY = "env_api_key_456";

      const contextWithoutSession: MCPToolExecuteContext = {
        session: undefined,
      };

      // Act
      await toolInstance.execute({}, contextWithoutSession);

      // Assert
      expect(mockClient.listBrandAgents).toHaveBeenCalledWith(
        "env_api_key_456",
        undefined,
      );

      // Cleanup
      delete process.env.SCOPE3_API_KEY;
    });

    it("should validate parameter schema", async () => {
      // Arrange
      const toolInstance = listBrandAgentsTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );

      const invalidParams = {
        where: {
          customerId: "not-a-number", // Should be number
        },
      };

      // Act & Assert
      expect(() => toolInstance.parameters.parse(invalidParams)).toThrow(); // Zod validation error
    });
  });

  describe("get-brand-agent tool", () => {
    it("should retrieve specific brand agent", async () => {
      // Arrange
      const toolInstance = getBrandAgentTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      const testAgent = brandAgentFixtures.fullyEnhancedBrandAgent({
        id: "ba_specific_123",
      });
      mockClient.getBrandAgent.mockResolvedValue(testAgent);

      // Act
      const result = await toolInstance.execute(
        { id: "ba_specific_123" },
        mockContext,
      );

      // Assert
      expect(result).toContain("ba_specific_123");
      expect(result).toContain("GraphQL Test Brand");
      expect(result).toContain("Customer ID: 12345");
      expect(mockClient.getBrandAgent).toHaveBeenCalledWith(
        "test_api_key_123",
        "ba_specific_123",
      );
    });

    it("should handle not found errors", async () => {
      // Arrange
      const toolInstance = getBrandAgentTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.getBrandAgent.mockRejectedValue(
        new Error("Brand agent not found"),
      );

      // Act & Assert
      await expect(
        toolInstance.execute({ id: "nonexistent" }, mockContext),
      ).rejects.toThrow("Failed to fetch brand agent: Brand agent not found");
    });
  });

  describe("create-brand-agent tool", () => {
    it("should create brand agent with full parameters", async () => {
      // Arrange
      const toolInstance = createBrandAgentTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      const createdAgent = brandAgentFixtures.fullyEnhancedBrandAgent({
        id: "ba_created_456",
        name: "New Test Brand",
      });
      mockClient.createBrandAgent.mockResolvedValue(createdAgent);

      const createParams = {
        advertiserDomains: ["test.com"],
        description: "A test brand agent",
        externalId: "ext_123",
        name: "New Test Brand",
        nickname: "TestBrand",
      };

      // Act
      const result = await toolInstance.execute(createParams, mockContext);

      // Assert
      expect(result).toContain("Brand agent created successfully");
      expect(result).toContain("ba_created_456");
      expect(result).toContain("New Test Brand");
      expect(mockClient.createBrandAgent).toHaveBeenCalledWith(
        "test_api_key_123",
        createParams,
      );
    });

    it("should handle validation errors during creation", async () => {
      // Arrange
      const toolInstance = createBrandAgentTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.createBrandAgent.mockRejectedValue(
        new Error("Invalid request parameters"),
      );

      // Act & Assert
      await expect(
        toolInstance.execute({ name: "Test" }, mockContext),
      ).rejects.toThrow(
        "Failed to create brand agent: Invalid request parameters",
      );
    });
  });

  describe("update-brand-agent tool", () => {
    it("should update brand agent with provided changes", async () => {
      // Arrange
      const toolInstance = updateBrandAgentTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      const updatedAgent = brandAgentFixtures.fullyEnhancedBrandAgent({
        name: "Updated Brand Name",
      });
      mockClient.updateBrandAgent.mockResolvedValue(updatedAgent);

      const updateParams = {
        description: "Updated description",
        id: "ba_test_123",
        name: "Updated Brand Name",
      };

      // Act
      const result = await toolInstance.execute(updateParams, mockContext);

      // Assert
      expect(result).toContain("Brand agent updated successfully");
      expect(result).toContain("Updated Brand Name");
      expect(mockClient.updateBrandAgent).toHaveBeenCalledWith(
        "test_api_key_123",
        "ba_test_123",
        { description: "Updated description", name: "Updated Brand Name" },
      );
    });
  });

  describe("delete-brand-agent tool", () => {
    it("should delete brand agent successfully", async () => {
      // Arrange
      const toolInstance = deleteBrandAgentTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.deleteBrandAgent.mockResolvedValue(true);

      // Act
      const result = await toolInstance.execute(
        { id: "ba_test_123" },
        mockContext,
      );

      // Assert
      expect(result).toContain("Brand agent deleted successfully");
      expect(result).toContain("ba_test_123");
      expect(mockClient.deleteBrandAgent).toHaveBeenCalledWith(
        "test_api_key_123",
        "ba_test_123",
      );
    });

    it("should handle deletion failures", async () => {
      // Arrange
      const toolInstance = deleteBrandAgentTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.deleteBrandAgent.mockRejectedValue(
        new Error("Cannot delete agent with active campaigns"),
      );

      // Act & Assert
      await expect(
        toolInstance.execute({ id: "ba_test_123" }, mockContext),
      ).rejects.toThrow(
        "Failed to delete brand agent: Cannot delete agent with active campaigns",
      );
    });
  });

  describe("End-to-End Workflow", () => {
    it("should support complete CRUD lifecycle", async () => {
      // This test validates that all tools work together in a realistic workflow

      // 1. List (should be empty initially)
      const listTool = listBrandAgentsTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.listBrandAgents.mockResolvedValueOnce([]);

      let result = await listTool.execute({}, mockContext);
      expect(result).toContain("No brand agents found");

      // 2. Create a new brand agent
      const createTool = createBrandAgentTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      const newAgent = brandAgentFixtures.fullyEnhancedBrandAgent({
        id: "ba_workflow_123",
      });
      mockClient.createBrandAgent.mockResolvedValueOnce(newAgent);

      result = await createTool.execute(
        { name: "Workflow Test Brand" },
        mockContext,
      );
      expect(result).toContain("Brand agent created successfully");

      // 3. List (should now have the created agent)
      mockClient.listBrandAgents.mockResolvedValueOnce([newAgent]);
      result = await listTool.execute({}, mockContext);
      expect(result).toContain("Found 1 brand agent");

      // 4. Get the specific agent
      const getTool = getBrandAgentTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.getBrandAgent.mockResolvedValueOnce(newAgent);

      result = await getTool.execute({ id: "ba_workflow_123" }, mockContext);
      expect(result).toContain("ba_workflow_123");

      // 5. Update the agent
      const updateTool = updateBrandAgentTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      const updatedAgent = { ...newAgent, name: "Updated Workflow Brand" };
      mockClient.updateBrandAgent.mockResolvedValueOnce(updatedAgent);

      result = await updateTool.execute(
        {
          id: "ba_workflow_123",
          name: "Updated Workflow Brand",
        },
        mockContext,
      );
      expect(result).toContain("Brand agent updated successfully");

      // 6. Delete the agent
      const deleteTool = deleteBrandAgentTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.deleteBrandAgent.mockResolvedValueOnce(true);

      result = await deleteTool.execute({ id: "ba_workflow_123" }, mockContext);
      expect(result).toContain("Brand agent deleted successfully");

      // Verify all service calls were made correctly
      expect(mockClient.listBrandAgents).toHaveBeenCalledTimes(2);
      expect(mockClient.createBrandAgent).toHaveBeenCalledTimes(1);
      expect(mockClient.getBrandAgent).toHaveBeenCalledTimes(1);
      expect(mockClient.updateBrandAgent).toHaveBeenCalledTimes(1);
      expect(mockClient.deleteBrandAgent).toHaveBeenCalledTimes(1);
    });
  });

  describe("Cross-Cutting Concerns", () => {
    it("should handle authentication consistently across all tools", async () => {
      // Test that all tools handle missing API key the same way
      const noAuthContext: MCPToolExecuteContext = { session: undefined };

      const tools = [
        listBrandAgentsTool(
          new (await import("../../client/scope3-client.js")).Scope3ApiClient(
            "test",
          ),
        ),
        getBrandAgentTool(
          new (await import("../../client/scope3-client.js")).Scope3ApiClient(
            "test",
          ),
        ),
        createBrandAgentTool(
          new (await import("../../client/scope3-client.js")).Scope3ApiClient(
            "test",
          ),
        ),
        updateBrandAgentTool(
          new (await import("../../client/scope3-client.js")).Scope3ApiClient(
            "test",
          ),
        ),
        deleteBrandAgentTool(
          new (await import("../../client/scope3-client.js")).Scope3ApiClient(
            "test",
          ),
        ),
      ];

      for (const tool of tools) {
        await expect(tool.execute({} as any, noAuthContext)).rejects.toThrow(
          "Authentication required",
        );
      }
    });

    it("should format responses consistently", async () => {
      // All tools should use the createMCPResponse utility
      // This ensures consistent response format across the API

      const listTool = listBrandAgentsTool(
        new (await import("../../client/scope3-client.js")).Scope3ApiClient(
          "test",
        ),
      );
      mockClient.listBrandAgents.mockResolvedValue([
        brandAgentFixtures.fullyEnhancedBrandAgent(),
      ]);

      const result = await listTool.execute({}, mockContext);

      // Should be a string (formatted for MCP)
      expect(typeof result).toBe("string");
      // Should contain structured information
      expect(result).toMatch(/\*\*.*\*\*/); // Bold formatting
      expect(result).toContain("💡"); // Emoji tips
    });
  });
});
