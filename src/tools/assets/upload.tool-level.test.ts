/**
 * Asset Upload Tool - Integration Test
 *
 * Tests the complete asset upload flow including validation,
 * GCS upload, and response formatting.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { assetsUploadTool } from "./upload.js";

// Mock auth utility
vi.mock("../../utils/auth.js", () => ({
  requireSessionAuth: vi.fn(),
}));

describe("Assets Upload Tool", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockStorageService: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockRequireSessionAuth: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup auth mock
    mockRequireSessionAuth = vi.mocked(
      (await import("../../utils/auth.js")).requireSessionAuth,
    );
    mockRequireSessionAuth.mockReturnValue({
      apiKey: "test-api-key",
      customerId: 123,
    });

    // Create a mock storage service
    mockStorageService = {
      uploadAsset: vi.fn(),
      validateAsset: vi.fn(),
    };

    // Mock the AssetStorageService constructor to return our mock
    vi.doMock("../../services/asset-storage-service.js", () => ({
      AssetStorageService: vi.fn(() => mockStorageService),
    }));
  });

  it("should upload single asset successfully", async () => {
    // Setup mocks for successful upload
    mockStorageService.validateAsset.mockReturnValue({
      errors: [],
      valid: true,
    });
    mockStorageService.uploadAsset.mockResolvedValue({
      assetId: "test-asset-123",
      fileSize: 1024,
      publicUrl:
        "https://storage.googleapis.com/test-bucket/assets/test-asset-123.jpg",
      uploadedAt: "2024-01-01T00:00:00Z",
    });

    const tool = assetsUploadTool();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context: MCPToolExecuteContext = {} as any;

    const base64Data = Buffer.from("test image data").toString("base64");
    const result = await tool.execute(
      {
        assets: [
          {
            assetType: "image",
            base64Data,
            contentType: "image/jpeg",
            filename: "test-image.jpg",
            metadata: {
              buyerAgentId: "123",
              tags: ["test", "demo"],
            },
          },
        ],
      },
      context,
    );

    expect(mockStorageService.validateAsset).toHaveBeenCalledWith(
      "image/jpeg",
      expect.any(Number),
      "image",
    );
    expect(mockStorageService.uploadAsset).toHaveBeenCalledWith(
      base64Data,
      "test-image.jpg",
      "image/jpeg",
      "123",
      {
        assetType: "image",
        buyerAgentId: "123",
        tags: ["test", "demo"],
      },
    );

    expect(result).toContain("Asset Upload Results");
    expect(result).toContain("Successful: 1");
    expect(result).toContain("Failed: 0");
    expect(result).toContain("test-asset-123");
    expect(result).toContain("https://storage.googleapis.com/test-bucket/");
  });

  it("should handle multiple asset uploads", async () => {
    // Setup mocks for mixed success/failure
    mockStorageService.validateAsset
      .mockReturnValueOnce({ errors: [], valid: true })
      .mockReturnValueOnce({ errors: ["File too large"], valid: false });

    mockStorageService.uploadAsset.mockResolvedValueOnce({
      assetId: "asset-1",
      fileSize: 1024,
      publicUrl:
        "https://storage.googleapis.com/test-bucket/assets/asset-1.jpg",
      uploadedAt: "2024-01-01T00:00:00Z",
    });

    const tool = assetsUploadTool();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context: MCPToolExecuteContext = {} as any;

    const result = await tool.execute(
      {
        assets: [
          {
            assetType: "image",
            base64Data: Buffer.from("small image").toString("base64"),
            contentType: "image/jpeg",
            filename: "small.jpg",
          },
          {
            assetType: "video",
            base64Data: Buffer.from("large video").toString("base64"),
            contentType: "video/mp4",
            filename: "large.mp4",
          },
        ],
      },
      context,
    );

    expect(result).toContain("Successful: 1");
    expect(result).toContain("Failed: 1");
    expect(result).toContain("asset-1");
    expect(result).toContain("File too large");
  });

  it("should handle validation failures", async () => {
    mockStorageService.validateAsset.mockReturnValue({
      errors: ["Invalid content type", "File too large"],
      valid: false,
    });

    const tool = assetsUploadTool();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context: MCPToolExecuteContext = {} as any;

    const result = await tool.execute(
      {
        assets: [
          {
            assetType: "image",
            base64Data: Buffer.from("invalid data").toString("base64"),
            contentType: "text/plain",
            filename: "invalid.txt",
          },
        ],
      },
      context,
    );

    expect(mockStorageService.uploadAsset).not.toHaveBeenCalled();
    expect(result).toContain("Failed: 1");
    expect(result).toContain("Invalid content type; File too large");
    expect(result).toContain("Upload Failures");
  });

  it("should handle upload service errors", async () => {
    mockStorageService.validateAsset.mockReturnValue({
      errors: [],
      valid: true,
    });
    mockStorageService.uploadAsset.mockRejectedValue(
      new Error("GCS connection failed"),
    );

    const tool = assetsUploadTool();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context: MCPToolExecuteContext = {} as any;

    const result = await tool.execute(
      {
        assets: [
          {
            assetType: "image",
            base64Data: Buffer.from("test").toString("base64"),
            contentType: "image/jpeg",
            filename: "test.jpg",
          },
        ],
      },
      context,
    );

    expect(result).toContain("Failed: 1");
    expect(result).toContain("GCS connection failed");
  });

  it("should require authentication", async () => {
    mockRequireSessionAuth.mockImplementation(() => {
      throw new Error("Authentication required");
    });

    const tool = assetsUploadTool();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context: MCPToolExecuteContext = {} as any;

    await expect(
      tool.execute(
        {
          assets: [
            {
              assetType: "image",
              base64Data: "test",
              contentType: "image/jpeg",
              filename: "test.jpg",
            },
          ],
        },
        context,
      ),
    ).rejects.toThrow("Authentication required");
  });

  it("should include customer ID in response", async () => {
    mockStorageService.validateAsset.mockReturnValue({
      errors: [],
      valid: true,
    });
    mockStorageService.uploadAsset.mockResolvedValue({
      assetId: "test-asset",
      fileSize: 1024,
      publicUrl: "https://example.com/asset",
      uploadedAt: "2024-01-01T00:00:00Z",
    });

    const tool = assetsUploadTool();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context: MCPToolExecuteContext = {} as any;

    const result = await tool.execute(
      {
        assets: [
          {
            assetType: "image",
            base64Data: Buffer.from("test").toString("base64"),
            contentType: "image/jpeg",
            filename: "test.jpg",
          },
        ],
      },
      context,
    );

    expect(result).toContain("Customer ID: 123");
  });

  it("should provide helpful next steps", async () => {
    mockStorageService.validateAsset.mockReturnValue({
      errors: [],
      valid: true,
    });
    mockStorageService.uploadAsset.mockResolvedValue({
      assetId: "test-asset-123",
      fileSize: 1024,
      publicUrl: "https://storage.googleapis.com/test-bucket/assets/test.jpg",
      uploadedAt: "2024-01-01T00:00:00Z",
    });

    const tool = assetsUploadTool();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const context: MCPToolExecuteContext = {} as any;

    const result = await tool.execute(
      {
        assets: [
          {
            assetType: "image",
            base64Data: Buffer.from("test").toString("base64"),
            contentType: "image/jpeg",
            filename: "test.jpg",
          },
        ],
      },
      context,
    );

    expect(result).toContain("Next Steps");
    expect(result).toContain("Share public URLs with sales agents");
    expect(result).toContain("Reference assets in creatives");
    expect(result).toContain("assets_add");
    expect(result).toContain("Public Access");
  });
});
