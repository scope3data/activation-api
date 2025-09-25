/**
 * Tool-Level Tests: create_tactic
 *
 * Tests the complete MCP tool execution including GraphQL tactic creation
 * and BigQuery prebid integration storage.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MCPToolExecuteContext } from "../../types/mcp.js";
import type { Tactic } from "../../types/tactics.js";

// Mock the TacticBigQueryService
vi.mock("../../services/tactic-bigquery-service.js", () => ({
  TacticBigQueryService: vi.fn().mockImplementation(() => ({
    createTactic: vi.fn(),
  })),
}));

import { TacticBigQueryService } from "../../services/tactic-bigquery-service.js";
import { createTacticTool } from "./create.js";

const MockedTacticBigQueryService =
  TacticBigQueryService as unknown as vi.MockedClass<
    typeof TacticBigQueryService
  >;

type CreateTacticTool = {
  annotations: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    context: MCPToolExecuteContext,
  ) => Promise<unknown>;
  name: string;
};
type MockBigQueryService = {
  createTactic: vi.MockedFunction<(...args: unknown[]) => Promise<Tactic>>;
};
type MockClient = {
  createTactic: vi.MockedFunction<(...args: unknown[]) => Promise<unknown>>;
};

describe("create_tactic Tool", () => {
  let mockClient: MockClient;
  let mockBigQueryService: MockBigQueryService;
  let mockContext: MCPToolExecuteContext;
  let createTactic: CreateTacticTool;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock the Scope3ApiClient
    mockClient = {
      createTactic: vi.fn(),
    };

    // Mock the BigQuery service
    mockBigQueryService = new MockedTacticBigQueryService();
    MockedTacticBigQueryService.mockImplementation(() => mockBigQueryService);

    mockContext = {
      request: { method: "tools/call", params: {} },
      server: {} as Record<string, unknown>,
    };

    createTactic = createTacticTool(mockClient);
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      await expect(
        createTactic.execute(
          {
            brandStoryId: "story_123",
            budgetAllocation: { amount: 1000 },
            campaignId: "campaign_123",
            cpm: 5.0,
            mediaProductId: "media_123",
            name: "Test Tactic",
          },
          mockContext,
        ),
      ).rejects.toThrow(/authentication required/i);
    });

    it("should accept API key from context session", async () => {
      const mockTactic: Tactic = {
        brandStoryId: "story_123",
        budgetAllocation: { amount: 1000, currency: "USD", pacing: "even" },
        campaignId: "campaign_123",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        description: undefined,
        effectivePricing: { cpm: 5.0, currency: "USD", totalCpm: 5.0 },
        id: "tactic_created_123",
        mediaProduct: {
          basePricing: { fixedCpm: 5.0, model: "fixed_cpm" as const },
          createdAt: new Date("2024-01-01T00:00:00Z"),
          deliveryType: "guaranteed" as const,
          description: "Test media product",
          formats: ["display" as const],
          id: "media_123",
          inventoryType: "premium" as const,
          name: "Test Media Product",
          productId: "prod_123",
          publisherId: "sales_agent_456",
          publisherName: "Test Publisher",
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
        name: "Test Tactic",
        signalId: undefined,
        status: "active",
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      };

      mockBigQueryService.createTactic.mockResolvedValue(mockTactic);

      const contextWithAuth = {
        ...mockContext,
        session: { scope3ApiKey: "test_api_key" },
      };

      const result = await createTactic.execute(
        {
          brandStoryId: "story_123",
          budgetAllocation: { amount: 1000 },
          campaignId: "campaign_123",
          cpm: 5.0,
          mediaProductId: "media_123",
          name: "Test Tactic",
        },
        contextWithAuth,
      );

      expect(result).toContain("✅ **Tactic Created Successfully!**");
      expect(mockBigQueryService.createTactic).toHaveBeenCalledWith(
        expect.any(Object),
        "test_api_key",
      );
    });

    it("should accept API key from environment", async () => {
      process.env.SCOPE3_API_KEY = "env_api_key";

      const mockTactic: Tactic = {
        brandStoryId: "story_123",
        budgetAllocation: { amount: 1000, currency: "USD", pacing: "even" },
        campaignId: "campaign_123",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        description: undefined,
        effectivePricing: { cpm: 5.0, currency: "USD", totalCpm: 5.0 },
        id: "tactic_env_123",
        mediaProduct: {
          basePricing: { fixedCpm: 5.0, model: "fixed_cpm" as const },
          createdAt: new Date("2024-01-01T00:00:00Z"),
          deliveryType: "guaranteed" as const,
          description: "Test media product",
          formats: ["display" as const],
          id: "media_123",
          inventoryType: "premium" as const,
          name: "Test Media Product",
          productId: "prod_123",
          publisherId: "sales_agent_789",
          publisherName: "Test Publisher",
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
        name: "Env Test Tactic",
        signalId: undefined,
        status: "active",
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      };

      mockBigQueryService.createTactic.mockResolvedValue(mockTactic);

      const result = await createTactic.execute(
        {
          brandStoryId: "story_123",
          budgetAllocation: { amount: 1000 },
          campaignId: "campaign_123",
          cpm: 5.0,
          mediaProductId: "media_123",
          name: "Env Test Tactic",
        },
        mockContext,
      );

      expect(result).toContain("✅ **Tactic Created Successfully!**");
      expect(mockBigQueryService.createTactic).toHaveBeenCalledWith(
        expect.any(Object),
        "env_api_key",
      );

      delete process.env.SCOPE3_API_KEY;
    });
  });

  describe("Tactic Creation", () => {
    const _validArgs = {
      brandStoryId: "story_123",
      budgetAllocation: { amount: 1000 },
      campaignId: "campaign_123",
      cpm: 5.0,
      mediaProductId: "media_123",
      name: "Valid Test Tactic",
    };

    const contextWithAuth = {
      request: { method: "tools/call", params: {} },
      server: {} as Record<string, unknown>,
      session: { scope3ApiKey: "test_api_key" },
    };

    beforeEach(() => {
      const mockTactic: Tactic = {
        brandStoryId: "story_123",
        budgetAllocation: { amount: 1000, currency: "USD", pacing: "even" },
        campaignId: "campaign_123",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        description: undefined,
        effectivePricing: { cpm: 5.0, currency: "USD", totalCpm: 5.0 },
        id: "tactic_success_123",
        mediaProduct: {
          basePricing: { fixedCpm: 5.0, model: "fixed_cpm" as const },
          createdAt: new Date("2024-01-01T00:00:00Z"),
          deliveryType: "guaranteed" as const,
          description: "Test media product",
          formats: ["display" as const],
          id: "media_123",
          inventoryType: "premium" as const,
          name: "Test Media Product",
          productId: "prod_123",
          publisherId: "sales_agent_success",
          publisherName: "Test Publisher",
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
        name: "Valid Test Tactic",
        signalId: undefined,
        status: "active",
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      };

      mockBigQueryService.createTactic.mockResolvedValue(mockTactic);
    });

    it("should create tactic with minimal required fields", async () => {
      const result = await createTactic.execute(
        {
          brandStoryId: "story_123",
          budgetAllocation: { amount: 1000 },
          campaignId: "campaign_123",
          cpm: 5.0,
          mediaProductId: "media_123",
          name: "Minimal Tactic",
        },
        contextWithAuth,
      );

      expect(result).toContain("✅ **Tactic Created Successfully!**");
      expect(result).toContain("🎯 **Valid Test Tactic**");

      expect(mockBigQueryService.createTactic).toHaveBeenCalledWith(
        expect.objectContaining({
          brandStoryId: "story_123",
          budgetAllocation: expect.objectContaining({
            amount: 1000,
            currency: "USD", // Default
            pacing: "even", // Default
          }),
          campaignId: "campaign_123",
          cpm: 5.0,
          mediaProductId: "media_123",
          name: "Minimal Tactic",
        }),
        "test_api_key",
      );
    });

    it("should create tactic with all optional fields", async () => {
      const fullArgs = {
        brandStoryId: "story_456",
        budgetAllocation: {
          amount: 5000,
          currency: "EUR",
          dailyCap: 500,
          pacing: "accelerated" as const,
          percentage: 25,
        },
        campaignId: "campaign_456",
        cpm: 12.5,
        description: "Comprehensive tactic with all features",
        mediaProductId: "media_456",
        name: "Full Featured Tactic",
        signalId: "signal_789",
      };

      const result = await createTactic.execute(fullArgs, contextWithAuth);

      expect(result).toContain("✅ **Tactic Created Successfully!**");
      expect(result).toContain("🎯 **Valid Test Tactic**");

      expect(mockBigQueryService.createTactic).toHaveBeenCalledWith(
        expect.objectContaining({
          budgetAllocation: expect.objectContaining({
            amount: 5000,
            currency: "EUR",
            dailyCap: 500,
            pacing: "accelerated",
            percentage: 25,
          }),
          description: "Comprehensive tactic with all features",
          signalId: "signal_789",
        }),
        "test_api_key",
      );
    });
  });

  describe("BigQuery Integration", () => {
    const validArgs = {
      brandStoryId: "story_123",
      budgetAllocation: { amount: 1000 },
      campaignId: "campaign_123",
      cpm: 5.0,
      mediaProductId: "media_123",
      name: "BigQuery Test Tactic",
    };

    const contextWithAuth = {
      request: { method: "tools/call", params: {} },
      server: {} as Record<string, unknown>,
      session: { scope3ApiKey: "test_api_key" },
    };

    it("should store tactic in BigQuery for prebid integration", async () => {
      const mockTactic: Tactic = {
        brandStoryId: "story_123",
        budgetAllocation: { amount: 1000, currency: "USD", pacing: "even" },
        campaignId: "campaign_123",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        description: undefined,
        effectivePricing: { cpm: 5.0, currency: "USD", totalCpm: 5.5 },
        id: "tactic_bigquery_123",
        mediaProduct: {
          basePricing: { fixedCpm: 5.0, model: "fixed_cpm" as const },
          createdAt: new Date("2024-01-01T00:00:00Z"),
          deliveryType: "guaranteed" as const,
          description: "Test media product",
          formats: ["display" as const],
          id: "media_123",
          inventoryType: "premium" as const,
          name: "Test Media Product",
          productId: "prod_123",
          publisherId: "sales_agent_bigquery",
          publisherName: "Test Publisher",
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
        name: "BigQuery Test Tactic",
        signalId: undefined,
        status: "active",
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      };

      mockBigQueryService.createTactic.mockResolvedValue(mockTactic);

      await createTactic.execute(validArgs, contextWithAuth);

      expect(mockBigQueryService.createTactic).toHaveBeenCalledWith(
        expect.objectContaining({
          brandStoryId: "story_123",
          budgetAllocation: expect.objectContaining({
            amount: 1000,
            currency: "USD",
            pacing: "even",
          }),
          campaignId: "campaign_123",
          cpm: 5.0,
          mediaProductId: "media_123",
          name: "BigQuery Test Tactic",
        }),
        "test_api_key",
      );
    });

    it("should fail when BigQuery service fails", async () => {
      mockBigQueryService.createTactic.mockRejectedValue(
        new Error("BigQuery connection failed"),
      );

      // Should throw when BigQuery fails since it's the only storage backend
      await expect(
        createTactic.execute(validArgs, contextWithAuth),
      ).rejects.toThrow("Failed to create tactic: BigQuery connection failed");

      expect(mockBigQueryService.createTactic).toHaveBeenCalled();
    });
  });

  // Error Handling is covered in the BigQuery Integration section
  // since the implementation now uses BigQuery as the only storage backend

  describe("Tool Metadata", () => {
    it("should have correct tool metadata", () => {
      expect(createTactic.name).toBe("create_tactic");
      expect(createTactic.annotations.category).toBe("Tactics");
      expect(createTactic.annotations.dangerLevel).toBe("medium");
      expect(createTactic.annotations.readOnlyHint).toBe(false);
    });

    it("should have comprehensive description", () => {
      expect(createTactic.description).toContain("Create a new tactic");
      expect(createTactic.description).toContain("media product");
      expect(createTactic.description).toContain("brand story");
      expect(createTactic.description).toContain("signal");
      expect(createTactic.description).toContain("Requires authentication");
    });
  });
});
