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

// Mock the sync services
vi.mock("../../services/creative-sync-service.js", () => ({
  CreativeSyncService: vi.fn().mockImplementation(() => ({
    onTacticCreated: vi.fn().mockResolvedValue(undefined),
    setNotificationService: vi.fn(),
  })),
}));
vi.mock("../../services/notification-service.js", () => ({
  NotificationService: vi.fn().mockImplementation(() => ({})),
}));
vi.mock("../../services/auth-service.js", () => ({
  AuthenticationService: vi.fn().mockImplementation(() => ({})),
}));

import { AuthenticationService } from "../../services/auth-service.js";
import { CreativeSyncService } from "../../services/creative-sync-service.js";
import { NotificationService } from "../../services/notification-service.js";
import { TacticBigQueryService } from "../../services/tactic-bigquery-service.js";
import { createTacticTool } from "./create.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const MockedTacticBigQueryService = TacticBigQueryService as any;

type CreateTacticTool = {
  annotations: Record<string, unknown>;
  execute: (
    args: Record<string, unknown>,
    context: MCPToolExecuteContext,
  ) => Promise<unknown>;
  name: string;
};
type MockBigQueryService = {
  createTactic: ReturnType<typeof vi.fn>;
};
type MockClient = {
  createTactic: ReturnType<typeof vi.fn>;
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
    mockBigQueryService = {
      createTactic: vi.fn(),
    };
    MockedTacticBigQueryService.mockImplementation(() => mockBigQueryService);

    mockContext = {
      session: {
        customerId: 123,
        scope3ApiKey: "test-api-key",
        userId: "test-user",
      },
    } as MCPToolExecuteContext;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createTactic = createTacticTool(mockClient as any);
  });

  describe("Authentication", () => {
    it("should require authentication", async () => {
      // Remove API key from context and environment
      mockContext.session = undefined;
      delete process.env.SCOPE3_API_KEY;

      await expect(
        createTactic.execute(
          {
            brandStoryId: "story_123",
            budgetAllocation: {
              amount: 1000,
              currency: "USD",
              pacing: "even",
            },
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
        session: { customerId: 123, scope3ApiKey: "test_api_key" },
      };

      const result = await createTactic.execute(
        {
          brandStoryId: "story_123",
          budgetAllocation: {
            amount: 1000,
            currency: "USD",
            pacing: "even",
          },
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

    it("should require session authentication (no environment fallback)", async () => {
      // Clear session to test that environment variables are not used as fallback
      mockContext.session = undefined;
      process.env.SCOPE3_API_KEY = "env_api_key";

      await expect(
        createTactic.execute(
          {
            brandStoryId: "story_123",
            budgetAllocation: {
              amount: 1000,
              currency: "USD", 
              pacing: "even",
            },
            campaignId: "campaign_123",
            cpm: 5.0,
            mediaProductId: "media_123",
            name: "Test Tactic",
          },
          mockContext,
        ),
      ).rejects.toThrow(/authentication required/i);

      // Verify BigQuery service was never called
      expect(mockBigQueryService.createTactic).not.toHaveBeenCalled();
      
      delete process.env.SCOPE3_API_KEY;
    });
  });

  describe("Tactic Creation", () => {
    const _validArgs = {
      brandStoryId: "story_123",
      budgetAllocation: {
        amount: 1000,
        currency: "USD",
        pacing: "even",
      },
      campaignId: "campaign_123",
      cpm: 5.0,
      mediaProductId: "media_123",
      name: "Valid Test Tactic",
    };

    const contextWithAuth = {
      request: { method: "tools/call", params: {} },
      server: {} as Record<string, unknown>,
      session: { customerId: 123, scope3ApiKey: "test_api_key" },
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
          budgetAllocation: {
            amount: 1000,
            currency: "USD",
            pacing: "even",
          },
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
          pacing: "asap" as const,
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
            pacing: "asap",
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
      budgetAllocation: {
        amount: 1000,
        currency: "USD",
        pacing: "even",
      },
      campaignId: "campaign_123",
      cpm: 5.0,
      mediaProductId: "media_123",
      name: "BigQuery Test Tactic",
    };

    const contextWithAuth = {
      request: { method: "tools/call", params: {} },
      server: {} as Record<string, unknown>,
      session: { customerId: 123, scope3ApiKey: "test_api_key" },
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const description = (createTactic as any).description;
      expect(description).toContain("Create a new tactic");
      expect(description).toContain("media product");
      expect(description).toContain("brand story");
      expect(description).toContain("signal");
      expect(description).toContain("Requires authentication");
    });
  });

  describe("Automatic Creative Sync", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockCreativeSyncService: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockNotificationService: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let mockAuthService: any;

    const validArgs = {
      brandStoryId: "story_123",
      budgetAllocation: {
        amount: 1000,
        currency: "USD",
        pacing: "even" as const,
      },
      campaignId: "campaign_123",
      cpm: 5.0,
      mediaProductId: "media_123",
      name: "Sync Test Tactic",
    };

    const contextWithAuth = {
      request: { method: "tools/call", params: {} },
      server: {} as Record<string, unknown>,
      session: { customerId: 123, scope3ApiKey: "test_api_key" },
    };

    beforeEach(() => {
      // Setup sync service mocks
      mockCreativeSyncService = {
        onTacticCreated: vi.fn().mockResolvedValue(undefined),
        setNotificationService: vi.fn(),
      };
      mockNotificationService = {};
      mockAuthService = {};

      vi.mocked(CreativeSyncService).mockImplementation(
        () => mockCreativeSyncService,
      );
      vi.mocked(NotificationService).mockImplementation(
        () => mockNotificationService,
      );
      vi.mocked(AuthenticationService).mockImplementation(
        () => mockAuthService,
      );

      // Mock tactic creation with sales agent
      const mockTactic: Tactic = {
        brandStoryId: "story_123",
        budgetAllocation: { amount: 1000, currency: "USD", pacing: "even" },
        campaignId: "campaign_123",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        description: undefined,
        effectivePricing: { cpm: 5.0, currency: "USD", totalCpm: 5.0 },
        id: "tactic_sync_123",
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
          publisherId: "sales_agent_123", // Sales agent ID available
          publisherName: "Test Publisher",
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
        name: "Sync Test Tactic",
        signalId: undefined,
        status: "active",
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      };

      mockBigQueryService.createTactic.mockResolvedValue(mockTactic);
    });

    it("should trigger automatic sync when tactic is created with sales agent", async () => {
      const result = await createTactic.execute(validArgs, contextWithAuth);

      // Verify tactic creation succeeded
      expect(result).toContain("✅ **Tactic Created Successfully!**");

      // Verify sync services were initialized
      expect(CreativeSyncService).toHaveBeenCalledWith(mockAuthService);
      expect(NotificationService).toHaveBeenCalledWith(mockAuthService);
      expect(
        mockCreativeSyncService.setNotificationService,
      ).toHaveBeenCalledWith(mockNotificationService);

      // Verify automatic sync was triggered
      expect(mockCreativeSyncService.onTacticCreated).toHaveBeenCalledWith(
        "tactic_sync_123",
        "campaign_123",
        "sales_agent_123",
      );

      // Verify response mentions automatic sync
      expect(result).toContain("Automatic Creative Sync");
      expect(result).toContain(
        "Campaign creatives are being synced to this tactic's sales agent",
      );
      expect(result).toContain(
        "Only format-compatible creatives will be synced",
      );
    });

    it("should handle tactic without sales agent ID", async () => {
      // Mock tactic creation without sales agent
      const mockTacticNoAgent: Tactic = {
        brandStoryId: "story_123",
        budgetAllocation: { amount: 1000, currency: "USD", pacing: "even" },
        campaignId: "campaign_123",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        description: undefined,
        effectivePricing: { cpm: 5.0, currency: "USD", totalCpm: 5.0 },
        id: "tactic_no_agent_123",
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
          publisherId: "", // Empty publisher ID - should not trigger sync
          publisherName: "Test Publisher",
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
        name: "No Agent Test Tactic",
        signalId: undefined,
        status: "active",
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      };

      mockBigQueryService.createTactic.mockResolvedValue(mockTacticNoAgent);

      const result = await createTactic.execute(validArgs, contextWithAuth);

      // Verify tactic creation succeeded
      expect(result).toContain("✅ **Tactic Created Successfully!**");

      // Should not trigger sync when no sales agent
      expect(mockCreativeSyncService.onTacticCreated).not.toHaveBeenCalled();
    });

    it("should handle sync service failures gracefully", async () => {
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // Mock sync to fail
      mockCreativeSyncService.onTacticCreated.mockRejectedValue(
        new Error("Sync service unavailable"),
      );

      const result = await createTactic.execute(validArgs, contextWithAuth);

      // Tactic creation should still succeed even if sync fails
      expect(result).toContain("✅ **Tactic Created Successfully!**");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Background creative sync failed for new tactic tactic_sync_123",
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

      const result = await createTactic.execute(validArgs, contextWithAuth);

      // Tactic creation should still succeed even if sync setup fails
      expect(result).toContain("✅ **Tactic Created Successfully!**");
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to initialize sync services for tactic creation:",
        expect.any(Error),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should use salesAgentId from tactic object when publisherId not available", async () => {
      // Mock tactic with salesAgentId but no publisherId
      const mockTacticWithSalesAgent: Tactic = {
        brandStoryId: "story_123",
        budgetAllocation: { amount: 1000, currency: "USD", pacing: "even" },
        campaignId: "campaign_123",
        createdAt: new Date("2024-01-01T00:00:00Z"),
        description: undefined,
        effectivePricing: { cpm: 5.0, currency: "USD", totalCpm: 5.0 },
        id: "tactic_sales_agent_123",
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
          publisherId: "", // Empty publisher ID
          publisherName: "Test Publisher",
          updatedAt: new Date("2024-01-01T00:00:00Z"),
        },
        name: "Sales Agent Test Tactic",
        salesAgentId: "direct_sales_agent_456", // Sales agent from tactic
        signalId: undefined,
        status: "active",
        updatedAt: new Date("2024-01-01T00:00:00Z"),
      };

      mockBigQueryService.createTactic.mockResolvedValue(
        mockTacticWithSalesAgent,
      );

      await createTactic.execute(validArgs, contextWithAuth);

      // Should use salesAgentId from tactic when publisherId not available
      expect(mockCreativeSyncService.onTacticCreated).toHaveBeenCalledWith(
        "tactic_sales_agent_123",
        "campaign_123",
        "direct_sales_agent_456",
      );
    });
  });
});
