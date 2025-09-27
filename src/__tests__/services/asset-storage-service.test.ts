/**
 * Asset Storage Service Tests
 *
 * Tests for GCS asset upload and management functionality
 * Uses mock GCS for isolated testing
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import { AssetStorageService } from "../../services/asset-storage-service.js";

// Create shared mock objects that will be consistent across all instances
const mockFile = {
  delete: vi.fn(),
  getMetadata: vi.fn(),
  name: "customers/customer123/brand-agents/123/assets/test-asset-id.jpg",
  save: vi.fn(),
};

const mockBucket = {
  file: vi.fn(() => mockFile),
  getFiles: vi.fn(),
};

const mockStorage = {
  bucket: vi.fn(() => mockBucket),
};

// Mock the Google Cloud Storage library
vi.mock("@google-cloud/storage", () => ({
  Storage: vi.fn(() => mockStorage),
}));

describe("AssetStorageService", () => {
  let service: AssetStorageService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AssetStorageService("test-bucket");
  });

  describe("uploadAsset", () => {
    it("should upload asset successfully", async () => {
      // Mock successful upload
      mockFile.save.mockResolvedValue(undefined);

      const base64Data = Buffer.from("test image data").toString("base64");
      const result = await service.uploadAsset(
        base64Data,
        "test-image.jpg",
        "image/jpeg",
        "customer123",
        { assetType: "image", buyerAgentId: "123" },
      );

      expect(result).toMatchObject({
        assetId: expect.any(String),
        fileSize: expect.any(Number),
        publicUrl: expect.stringContaining(
          "https://storage.googleapis.com/test-bucket/customers/customer123/brand-agents/123/assets/",
        ),
        uploadedAt: expect.any(String),
      });

      expect(mockFile.save).toHaveBeenCalledWith(
        expect.any(Buffer),
        expect.objectContaining({
          contentType: "image/jpeg",
          metadata: expect.objectContaining({
            assetId: expect.any(String),
            assetType: "image",
            buyerAgentId: "123",
            customerId: "customer123",
            originalFilename: "test-image.jpg",
          }),
          predefinedAcl: "publicRead",
        }),
      );
    });

    it("should handle upload failures", async () => {
      mockFile.save.mockRejectedValue(new Error("GCS error"));

      const base64Data = Buffer.from("test image data").toString("base64");

      await expect(
        service.uploadAsset(
          base64Data,
          "test-image.jpg",
          "image/jpeg",
          "customer123",
        ),
      ).rejects.toThrow("Failed to upload asset: GCS error");
    });

    it("should generate correct file extensions", async () => {
      mockFile.save.mockResolvedValue(undefined);

      const base64Data = Buffer.from("test").toString("base64");

      // Test with filename extension
      await service.uploadAsset(
        base64Data,
        "test.png",
        "image/png",
        "customer123",
      );
      expect(mockBucket.file).toHaveBeenCalledWith(
        expect.stringMatching(
          /^customers\/customer123\/brand-agents\/unassigned\/assets\/[a-f0-9-]+\.png$/,
        ),
      );

      // Test with content type fallback
      await service.uploadAsset(
        base64Data,
        "noextension",
        "image/jpeg",
        "customer123",
      );
      expect(mockBucket.file).toHaveBeenCalledWith(
        expect.stringMatching(
          /^customers\/customer123\/brand-agents\/unassigned\/assets\/[a-f0-9-]+\.jpg$/,
        ),
      );
    });
  });

  describe("getAssetMetadata", () => {
    it("should return metadata for existing asset", async () => {
      // Mock finding the file
      mockBucket.getFiles.mockResolvedValue([[mockFile]]);
      mockFile.getMetadata.mockResolvedValue([
        {
          contentType: "image/jpeg",
          metadata: {
            originalFilename: "test.jpg",
            uploadedAt: "2024-01-01T00:00:00Z",
          },
          size: "1024",
        },
      ]);

      const result = await service.getAssetMetadata("test-asset-id");

      expect(result.exists).toBe(true);
      expect(result.metadata).toMatchObject({
        contentType: "image/jpeg",
        originalFilename: "test.jpg",
        publicUrl: expect.stringContaining("test-bucket"),
        size: 1024,
        uploadedAt: "2024-01-01T00:00:00Z",
      });
    });

    it("should return not found for non-existent asset", async () => {
      mockBucket.getFiles.mockResolvedValue([[]]);

      const result = await service.getAssetMetadata("non-existent");

      expect(result.exists).toBe(false);
      expect(result.metadata).toBeUndefined();
    });
  });

  describe("deleteAsset", () => {
    it("should delete existing asset", async () => {
      mockBucket.getFiles.mockResolvedValue([[mockFile]]);
      mockFile.delete.mockResolvedValue(undefined);

      const result = await service.deleteAsset("test-asset-id");

      expect(result).toBe(true);
      expect(mockFile.delete).toHaveBeenCalled();
    });

    it("should return false for non-existent asset", async () => {
      mockBucket.getFiles.mockResolvedValue([[]]);

      const result = await service.deleteAsset("non-existent");

      expect(result).toBe(false);
    });
  });

  describe("listAssets", () => {
    it("should list all assets", async () => {
      const mockFile1 = {
        getMetadata: vi.fn().mockResolvedValue([
          {
            contentType: "image/jpeg",
            metadata: {
              assetId: "asset1",
              originalFilename: "test1.jpg",
              uploadedAt: "2024-01-01T00:00:00Z",
            },
            size: "1024",
            timeCreated: "2024-01-01T00:00:00Z",
          },
        ]),
        name: "customers/customer123/brand-agents/123/assets/asset1.jpg",
      };

      const mockFile2 = {
        getMetadata: vi.fn().mockResolvedValue([
          {
            contentType: "image/png",
            metadata: {
              assetId: "asset2",
              buyerAgentId: "123",
              originalFilename: "test2.png",
              uploadedAt: "2024-01-02T00:00:00Z",
            },
            size: "2048",
            timeCreated: "2024-01-02T00:00:00Z",
          },
        ]),
        name: "customers/customer123/brand-agents/123/assets/asset2.png",
      };

      mockBucket.getFiles.mockResolvedValue([[mockFile1, mockFile2]]);

      const result = await service.listAssets();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        assetId: "asset1",
        contentType: "image/jpeg",
        originalFilename: "test1.jpg",
        size: 1024,
      });
      expect(result[1]).toMatchObject({
        assetId: "asset2",
        buyerAgentId: "123",
        originalFilename: "test2.png",
      });
    });

    it("should filter by buyer agent", async () => {
      const mockFile1 = {
        getMetadata: vi.fn().mockResolvedValue([
          {
            contentType: "image/jpeg",
            metadata: {
              assetId: "asset1",
              buyerAgentId: "123",
            },
            size: "1024",
            timeCreated: "2024-01-01T00:00:00Z",
          },
        ]),
        name: "customers/customer123/brand-agents/123/assets/asset1.jpg",
      };

      const mockFile2 = {
        getMetadata: vi.fn().mockResolvedValue([
          {
            contentType: "image/jpeg",
            metadata: {
              assetId: "asset2",
              buyerAgentId: "456",
            },
            size: "1024",
            timeCreated: "2024-01-01T00:00:00Z",
          },
        ]),
        name: "customers/customer123/brand-agents/456/assets/asset2.jpg",
      };

      // Mock getFiles to respect prefix filtering
      mockBucket.getFiles.mockImplementation(({ prefix }) => {
        const allFiles = [mockFile1, mockFile2];
        const filteredFiles = prefix
          ? allFiles.filter((file) => file.name.startsWith(prefix))
          : allFiles;
        return Promise.resolve([filteredFiles]);
      });

      const result = await service.listAssets("customer123", "123");

      expect(result).toHaveLength(1);
      expect(result[0].assetId).toBe("asset1");
    });
  });

  describe("validateAsset", () => {
    it("should validate image assets", () => {
      const result = service.validateAsset("image/jpeg", 1024 * 1024, "image");

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should reject oversized assets", () => {
      const largeSize = 50 * 1024 * 1024; // 50MB image
      const result = service.validateAsset("image/jpeg", largeSize, "image");

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("exceeds maximum");
    });

    it("should reject invalid content types", () => {
      const result = service.validateAsset("text/plain", 1024, "image");

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain("not allowed");
    });

    it("should validate video assets", () => {
      const result = service.validateAsset(
        "video/mp4",
        10 * 1024 * 1024,
        "video",
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate audio assets", () => {
      const result = service.validateAsset(
        "audio/mpeg",
        5 * 1024 * 1024,
        "audio",
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate logo assets", () => {
      const result = service.validateAsset(
        "image/svg+xml",
        1024 * 1024,
        "logo",
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should handle multiple validation errors", () => {
      const largeSize = 50 * 1024 * 1024; // 50MB
      const result = service.validateAsset("text/plain", largeSize, "image");

      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors.some((e) => e.includes("exceeds maximum"))).toBe(
        true,
      );
      expect(result.errors.some((e) => e.includes("not allowed"))).toBe(true);
    });
  });
});
