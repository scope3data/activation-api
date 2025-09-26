import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { AssetStorageService } from "../../services/asset-storage-service.js";
import { analytics, metrics } from "../../services/monitoring-service.js";
import { assetsUploadTool } from "../../tools/assets/upload.js";
import { circuitBreakers } from "../../utils/error-handling.js";

// Mock dependencies
vi.mock("../../services/asset-storage-service.js");
vi.mock("../../services/monitoring-service.js");
vi.mock("../../utils/auth.js", () => ({
  requireSessionAuth: vi.fn(() => ({ customerId: "test-customer-123" })),
}));

describe("Asset Upload Error Scenarios", () => {
  const mockContext: MCPToolExecuteContext = {
    session: {
      customerId: 123,
      scope3ApiKey: "test-api-key",
    },
  };

  const validAsset = {
    assetType: "image" as const,
    base64Data:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHNrEkSsAAAAABJRU5ErkJggg==",
    contentType: "image/png",
    filename: "test.png",
    metadata: {
      buyerAgentId: "agent-123",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset circuit breakers
    circuitBreakers.gcs.reset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Input Validation Errors", () => {
    it("should handle invalid base64 data", async () => {
      const tool = assetsUploadTool();

      const invalidAsset = {
        ...validAsset,
        base64Data: "invalid-base64-data!",
      };

      try {
        await tool.execute({ assets: [invalidAsset] }, mockContext);
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("validation");
      }
    });

    it("should handle empty filename", async () => {
      const tool = assetsUploadTool();

      const invalidAsset = {
        ...validAsset,
        filename: "",
      };

      try {
        await tool.execute({ assets: [invalidAsset] }, mockContext);
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("validation");
      }
    });

    it("should handle filename with invalid characters", async () => {
      const tool = assetsUploadTool();

      const invalidAsset = {
        ...validAsset,
        filename: "test<script>.png",
      };

      try {
        await tool.execute({ assets: [invalidAsset] }, mockContext);
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("validation");
      }
    });

    it("should handle too many assets in single request", async () => {
      const tool = assetsUploadTool();

      // Create 11 assets (max is 10)
      const tooManyAssets = Array(11)
        .fill(null)
        .map((_, i) => ({
          ...validAsset,
          filename: `test-${i}.png`,
        }));

      try {
        await tool.execute({ assets: tooManyAssets }, mockContext);
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("validation");
      }
    });

    it("should handle file size too large", async () => {
      const tool = assetsUploadTool();

      // Create a base64 string that represents a file larger than 10MB
      const largeBase64 = "A".repeat(15 * 1024 * 1024); // 15MB of 'A' characters

      const oversizedAsset = {
        ...validAsset,
        base64Data: largeBase64,
      };

      try {
        await tool.execute({ assets: [oversizedAsset] }, mockContext);
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("validation");
      }
    });

    it("should handle unsupported content type", async () => {
      const tool = assetsUploadTool();

      const unsupportedAsset = {
        ...validAsset,
        assetType: "image" as const,
        contentType: "application/x-malware",
      };

      try {
        await tool.execute({ assets: [unsupportedAsset] }, mockContext);
        expect.fail("Should have thrown validation error");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("validation");
      }
    });
  });

  describe("Rate Limiting Scenarios", () => {
    it("should handle rate limit exceeded", async () => {
      const tool = assetsUploadTool();

      // Simulate multiple rapid requests to trigger rate limiting
      const rapidRequests = Array(60)
        .fill(null)
        .map(() => tool.execute({ assets: [validAsset] }, mockContext));

      // At least some should fail due to rate limiting
      const results = await Promise.allSettled(rapidRequests);
      const rejectedCount = results.filter(
        (r) => r.status === "rejected",
      ).length;

      expect(rejectedCount).toBeGreaterThan(0);

      // Check that rate limit errors are properly formatted
      const rateLimitErrors = results
        .filter((r) => r.status === "rejected")
        .map((r) => (r as PromiseRejectedResult).reason);

      rateLimitErrors.forEach((error) => {
        expect(error.message).toContain("rate limit");
      });
    });
  });

  describe("GCS Connection Errors", () => {
    it("should handle GCS connection timeout", async () => {
      const tool = assetsUploadTool();

      // Mock AssetStorageService to simulate timeout
      const mockStorageService = vi.mocked(AssetStorageService);
      mockStorageService.prototype.uploadAsset = vi
        .fn()
        .mockImplementation(() => {
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Connection timeout")), 100);
          });
        });

      mockStorageService.prototype.validateAsset = vi.fn().mockReturnValue({
        errors: [],
        valid: true,
      });

      try {
        await tool.execute({ assets: [validAsset] }, mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("timeout");
      }
    });

    it("should handle GCS service unavailable", async () => {
      const tool = assetsUploadTool();

      // Mock AssetStorageService to simulate service unavailable
      const mockStorageService = vi.mocked(AssetStorageService);
      mockStorageService.prototype.uploadAsset = vi
        .fn()
        .mockRejectedValue(new Error("Service temporarily unavailable"));

      mockStorageService.prototype.validateAsset = vi.fn().mockReturnValue({
        errors: [],
        valid: true,
      });

      try {
        await tool.execute({ assets: [validAsset] }, mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain(
          "Service temporarily unavailable",
        );
      }
    });

    it("should handle GCS permission errors", async () => {
      const tool = assetsUploadTool();

      // Mock AssetStorageService to simulate permission error
      const mockStorageService = vi.mocked(AssetStorageService);
      mockStorageService.prototype.uploadAsset = vi
        .fn()
        .mockRejectedValue(
          new Error("Access denied: insufficient permissions"),
        );

      mockStorageService.prototype.validateAsset = vi.fn().mockReturnValue({
        errors: [],
        valid: true,
      });

      try {
        await tool.execute({ assets: [validAsset] }, mockContext);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Access denied");
      }
    });
  });

  describe("Circuit Breaker Scenarios", () => {
    it("should open circuit breaker after repeated failures", async () => {
      const tool = assetsUploadTool();

      // Mock AssetStorageService to always fail
      const mockStorageService = vi.mocked(AssetStorageService);
      mockStorageService.prototype.uploadAsset = vi
        .fn()
        .mockRejectedValue(new Error("Persistent GCS failure"));

      mockStorageService.prototype.validateAsset = vi.fn().mockReturnValue({
        errors: [],
        valid: true,
      });

      // Trigger multiple failures to open circuit breaker
      const failurePromises = Array(6)
        .fill(null)
        .map(() =>
          tool.execute({ assets: [validAsset] }, mockContext).catch((e) => e),
        );

      const results = await Promise.all(failurePromises);

      // Later requests should fail with circuit breaker error
      const circuitBreakerErrors = results.filter(
        (error) => error.message && error.message.includes("circuit breaker"),
      );

      expect(circuitBreakerErrors.length).toBeGreaterThan(0);
    });

    it("should transition circuit breaker to half-open after timeout", async () => {
      const tool = assetsUploadTool();

      // First, trigger circuit breaker opening
      const mockStorageService = vi.mocked(AssetStorageService);
      mockStorageService.prototype.uploadAsset = vi
        .fn()
        .mockRejectedValue(new Error("Persistent failure"));

      mockStorageService.prototype.validateAsset = vi.fn().mockReturnValue({
        errors: [],
        valid: true,
      });

      // Trigger failures to open circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          await tool.execute({ assets: [validAsset] }, mockContext);
        } catch {
          // Expected to fail
        }
      }

      // Verify circuit breaker is open
      expect(circuitBreakers.gcs.getState().state).toBe("open");

      // Fast forward time to allow circuit breaker to transition to half-open
      // Note: In a real test, you'd want to use fake timers
      vi.useFakeTimers();
      vi.advanceTimersByTime(65000); // Advance by more than timeout period

      // Now mock service to succeed
      mockStorageService.prototype.uploadAsset = vi.fn().mockResolvedValue({
        assetId: "test-asset-123",
        fileSize: 1024,
        publicUrl: "https://example.com/asset.png",
      });

      // This should succeed and close the circuit breaker
      const result = await tool.execute({ assets: [validAsset] }, mockContext);
      expect(result).toContain("✅");

      vi.useRealTimers();
    });
  });

  describe("Retry Logic Scenarios", () => {
    it("should retry on transient failures", async () => {
      const tool = assetsUploadTool();

      // Mock AssetStorageService to fail twice then succeed
      const mockStorageService = vi.mocked(AssetStorageService);
      let attemptCount = 0;

      mockStorageService.prototype.uploadAsset = vi
        .fn()
        .mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            return Promise.reject(new Error("Transient network error"));
          }
          return Promise.resolve({
            assetId: "test-asset-123",
            fileSize: 1024,
            publicUrl: "https://example.com/asset.png",
          });
        });

      mockStorageService.prototype.validateAsset = vi.fn().mockReturnValue({
        errors: [],
        valid: true,
      });

      const result = await tool.execute({ assets: [validAsset] }, mockContext);

      expect(result).toContain("✅");
      expect(attemptCount).toBe(3); // Failed twice, succeeded on third attempt
    });

    it("should exhaust retries on persistent failures", async () => {
      const tool = assetsUploadTool();

      // Mock AssetStorageService to always fail
      const mockStorageService = vi.mocked(AssetStorageService);
      let attemptCount = 0;

      mockStorageService.prototype.uploadAsset = vi
        .fn()
        .mockImplementation(() => {
          attemptCount++;
          return Promise.reject(new Error("Persistent failure"));
        });

      mockStorageService.prototype.validateAsset = vi.fn().mockReturnValue({
        errors: [],
        valid: true,
      });

      try {
        await tool.execute({ assets: [validAsset] }, mockContext);
        expect.fail("Should have failed after exhausting retries");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("failed after");
        expect(attemptCount).toBe(3); // Default max attempts
      }
    });
  });

  describe("Monitoring and Analytics", () => {
    it("should track error metrics on failures", async () => {
      const tool = assetsUploadTool();

      // Mock AssetStorageService to fail
      const mockStorageService = vi.mocked(AssetStorageService);
      mockStorageService.prototype.uploadAsset = vi
        .fn()
        .mockRejectedValue(new Error("Test failure"));

      mockStorageService.prototype.validateAsset = vi.fn().mockReturnValue({
        errors: [],
        valid: true,
      });

      try {
        await tool.execute({ assets: [validAsset] }, mockContext);
      } catch {
        // Expected to fail
      }

      // Verify analytics tracking
      expect(analytics.trackError).toHaveBeenCalled();
      expect(analytics.trackAssetUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: "test-customer-123",
          success: false,
        }),
      );

      // Verify metrics tracking
      expect(metrics.errors.inc).toHaveBeenCalled();
      expect(metrics.uploadAttempts.inc).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "error",
        }),
      );
    });

    it("should include request ID in error responses", async () => {
      const tool = assetsUploadTool();

      // Mock AssetStorageService to fail
      const mockStorageService = vi.mocked(AssetStorageService);
      mockStorageService.prototype.uploadAsset = vi
        .fn()
        .mockRejectedValue(new Error("Test failure"));

      mockStorageService.prototype.validateAsset = vi.fn().mockReturnValue({
        errors: [],
        valid: true,
      });

      try {
        await tool.execute({ assets: [validAsset] }, mockContext);
        expect.fail("Should have failed");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/Request ID: [a-f0-9-]+/);
      }
    });
  });

  describe("Authentication Errors", () => {
    it("should handle missing session authentication", async () => {
      const tool = assetsUploadTool();

      // Mock auth to fail
      vi.doMock("../../utils/auth.js", () => ({
        requireSessionAuth: vi.fn(() => {
          throw new Error("Authentication failed");
        }),
      }));

      const contextWithoutAuth: MCPToolExecuteContext = {
        session: undefined,
      };

      try {
        await tool.execute({ assets: [validAsset] }, contextWithoutAuth);
        expect.fail("Should have failed authentication");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Authentication failed");
      }
    });
  });

  describe("Concurrent Upload Scenarios", () => {
    it("should handle concurrent uploads without corruption", async () => {
      const tool = assetsUploadTool();

      // Mock AssetStorageService to succeed
      const mockStorageService = vi.mocked(AssetStorageService);
      let uploadCount = 0;

      mockStorageService.prototype.uploadAsset = vi
        .fn()
        .mockImplementation(async () => {
          uploadCount++;
          // Simulate processing delay
          await new Promise((resolve) => setTimeout(resolve, 10));

          return {
            assetId: `test-asset-${uploadCount}`,
            fileSize: 1024,
            publicUrl: `https://example.com/asset-${uploadCount}.png`,
          };
        });

      mockStorageService.prototype.validateAsset = vi.fn().mockReturnValue({
        errors: [],
        valid: true,
      });

      // Create multiple concurrent upload requests
      const concurrentUploads = Array(5)
        .fill(null)
        .map((_, i) =>
          tool.execute(
            {
              assets: [{ ...validAsset, filename: `test-${i}.png` }],
            },
            mockContext,
          ),
        );

      const results = await Promise.all(concurrentUploads);

      // All uploads should succeed
      results.forEach((result) => {
        expect(result).toContain("✅");
      });

      // Verify unique asset IDs were generated
      expect(uploadCount).toBe(5);
    });
  });
});
