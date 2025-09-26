import { Storage } from "@google-cloud/storage";
import { v4 as uuidv4 } from "uuid";

/**
 * GCS Asset Storage Service
 *
 * Handles uploading creative assets to Google Cloud Storage for distribution
 * to sales agents. Provides public URLs for uploaded assets.
 */
export class AssetStorageService {
  private bucketName: string;
  private storage: Storage;

  constructor(bucketName?: string) {
    this.storage = new Storage();
    this.bucketName =
      bucketName || process.env.GCS_ASSETS_BUCKET || "scope3-creative-assets";
  }

  /**
   * Delete an asset from GCS
   */
  async deleteAsset(assetId: string): Promise<boolean> {
    try {
      const fileName = await this.findAssetFile(assetId);
      if (!fileName) {
        return false;
      }

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);
      await file.delete();

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete all assets for a brand agent
   */
  async deleteBrandAgentAssets(
    customerId: string,
    brandAgentId: string,
  ): Promise<{
    deletedCount: number;
    errors: string[];
  }> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({
        prefix: `customers/${customerId}/brand-agents/${brandAgentId}/`,
      });

      let deletedCount = 0;
      const errors: string[] = [];

      for (const file of files) {
        try {
          await file.delete();
          deletedCount++;
        } catch (error) {
          errors.push(
            `Failed to delete ${file.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return { deletedCount, errors };
    } catch (error) {
      throw new Error(
        `Failed to delete brand agent assets: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete all assets for a customer (cleanup inactive customers)
   */
  async deleteCustomerAssets(customerId: string): Promise<{
    deletedCount: number;
    errors: string[];
  }> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({
        prefix: `customers/${customerId}/`,
      });

      let deletedCount = 0;
      const errors: string[] = [];

      for (const file of files) {
        try {
          await file.delete();
          deletedCount++;
        } catch (error) {
          errors.push(
            `Failed to delete ${file.name}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return { deletedCount, errors };
    } catch (error) {
      throw new Error(
        `Failed to delete customer assets: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get asset metadata from GCS
   */
  async getAssetMetadata(assetId: string): Promise<{
    exists: boolean;
    metadata?: {
      contentType: string;
      originalFilename: string;
      publicUrl: string;
      size: number;
      uploadedAt: string;
    };
  }> {
    try {
      const fileName = await this.findAssetFile(assetId);
      if (!fileName) {
        return { exists: false };
      }

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);
      const [metadata] = await file.getMetadata();

      return {
        exists: true,
        metadata: {
          contentType: metadata.contentType || "application/octet-stream",
          originalFilename: String(
            metadata.metadata?.originalFilename || "unknown",
          ),
          publicUrl: `https://storage.googleapis.com/${this.bucketName}/${fileName}`,
          size: parseInt(String(metadata.size || "0")),
          uploadedAt: String(
            metadata.metadata?.uploadedAt || metadata.timeCreated || "",
          ),
        },
      };
    } catch {
      return { exists: false };
    }
  }

  /**
   * List assets for a customer and optionally filter by buyer agent
   */
  async listAssets(
    customerId?: string,
    buyerAgentId?: string,
  ): Promise<
    Array<{
      assetId: string;
      assetType?: string;
      buyerAgentId?: string;
      contentType: string;
      customerId: string;
      originalFilename: string;
      publicUrl: string;
      size: number;
      tags?: string[];
      uploadedAt: string;
    }>
  > {
    try {
      const bucket = this.storage.bucket(this.bucketName);

      // Build prefix based on filters
      let prefix = "customers/";
      if (customerId) {
        prefix += `${customerId}/`;
        if (buyerAgentId) {
          prefix += `brand-agents/${buyerAgentId}/`;
        }
      }

      const [files] = await bucket.getFiles({ prefix });

      const assets = await Promise.all(
        files.map(async (file) => {
          const [metadata] = await file.getMetadata();
          const assetMetadata = metadata.metadata || {};

          // Skip non-asset files (should only be in assets/ subdirectories)
          if (!file.name.includes("/assets/")) {
            return null;
          }

          return {
            assetId: assetMetadata.assetId || "unknown",
            assetType: assetMetadata.assetType,
            buyerAgentId: assetMetadata.buyerAgentId || "unassigned",
            contentType: metadata.contentType || "application/octet-stream",
            customerId: assetMetadata.customerId || "unknown",
            originalFilename: assetMetadata.originalFilename || file.name,
            publicUrl: `https://storage.googleapis.com/${this.bucketName}/${file.name}`,
            size: parseInt(String(metadata.size || "0")),
            tags:
              typeof assetMetadata.tags === "string"
                ? assetMetadata.tags.split(",")
                : undefined,
            uploadedAt: assetMetadata.uploadedAt || metadata.timeCreated,
          };
        }),
      );

      return assets.filter((asset) => asset !== null) as Array<{
        assetId: string;
        assetType?: string;
        buyerAgentId?: string;
        contentType: string;
        customerId: string;
        originalFilename: string;
        publicUrl: string;
        size: number;
        tags?: string[];
        uploadedAt: string;
      }>;
    } catch (error) {
      throw new Error(
        `Failed to list assets: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List brand agents for a customer
   */
  async listBrandAgents(customerId: string): Promise<
    Array<{
      assetCount: number;
      brandAgentId: string;
      lastActivity: string;
    }>
  > {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({
        prefix: `customers/${customerId}/brand-agents/`,
      });

      // Group by brand agent ID
      const agentStats = new Map<
        string,
        { count: number; lastActivity: Date }
      >();

      for (const file of files) {
        if (!file.name.includes("/assets/")) continue;

        const pathParts = file.name.split("/");
        if (pathParts.length < 4) continue;

        const brandAgentId = pathParts[3];
        const [metadata] = await file.getMetadata();
        const uploadedAt = new Date(metadata.timeCreated || 0);

        const existing = agentStats.get(brandAgentId);
        if (!existing || uploadedAt > existing.lastActivity) {
          agentStats.set(brandAgentId, {
            count: (existing?.count || 0) + 1,
            lastActivity: uploadedAt,
          });
        } else {
          agentStats.set(brandAgentId, {
            count: existing.count + 1,
            lastActivity: existing.lastActivity,
          });
        }
      }

      return Array.from(agentStats.entries()).map(([brandAgentId, stats]) => ({
        assetCount: stats.count,
        brandAgentId,
        lastActivity: stats.lastActivity.toISOString(),
      }));
    } catch (error) {
      throw new Error(
        `Failed to list brand agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List all customers with assets
   */
  async listCustomers(): Promise<
    Array<{
      assetCount: number;
      customerId: string;
      lastActivity: string;
    }>
  > {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [files] = await bucket.getFiles({ prefix: "customers/" });

      // Group by customer ID
      const customerStats = new Map<
        string,
        { count: number; lastActivity: Date }
      >();

      for (const file of files) {
        if (!file.name.includes("/assets/")) continue;

        const pathParts = file.name.split("/");
        if (pathParts.length < 2) continue;

        const customerId = pathParts[1];
        const [metadata] = await file.getMetadata();
        const uploadedAt = new Date(metadata.timeCreated || 0);

        const existing = customerStats.get(customerId);
        if (!existing || uploadedAt > existing.lastActivity) {
          customerStats.set(customerId, {
            count: (existing?.count || 0) + 1,
            lastActivity: uploadedAt,
          });
        } else {
          customerStats.set(customerId, {
            count: existing.count + 1,
            lastActivity: existing.lastActivity,
          });
        }
      }

      return Array.from(customerStats.entries()).map(([customerId, stats]) => ({
        assetCount: stats.count,
        customerId,
        lastActivity: stats.lastActivity.toISOString(),
      }));
    } catch (error) {
      throw new Error(
        `Failed to list customers: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Upload a base64-encoded asset to GCS
   * @param data Base64-encoded file data
   * @param originalFilename Original filename for metadata
   * @param contentType MIME type of the file
   * @param customerId Customer ID for directory organization
   * @param metadata Additional metadata about the asset
   * @returns Public URL and asset ID
   */
  async uploadAsset(
    data: string,
    originalFilename: string,
    contentType: string,
    customerId: string,
    metadata?: {
      assetType?: string;
      buyerAgentId?: string;
      creativeId?: string;
      tags?: string[];
    },
  ): Promise<{
    assetId: string;
    fileSize: number;
    publicUrl: string;
    uploadedAt: string;
  }> {
    try {
      // Generate unique asset ID and filename with hierarchical structure
      const assetId = uuidv4();
      const fileExtension = this.getFileExtension(
        originalFilename,
        contentType,
      );

      // Create hierarchical path: customers/{customerId}/brand-agents/{buyerAgentId}/assets/{assetId}.ext
      const buyerAgentId = metadata?.buyerAgentId || "unassigned";
      const fileName = `customers/${customerId}/brand-agents/${buyerAgentId}/assets/${assetId}${fileExtension}`;

      // Convert base64 to buffer
      const buffer = Buffer.from(data, "base64");
      const fileSize = buffer.length;

      // Get bucket reference
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      // Upload metadata
      const gcsMetadata = {
        contentType,
        metadata: {
          assetId,
          buyerAgentId,
          customerId,
          originalFilename,
          uploadedAt: new Date().toISOString(),
          ...(metadata?.creativeId && { creativeId: metadata.creativeId }),
          ...(metadata?.assetType && { assetType: metadata.assetType }),
          ...(metadata?.tags && { tags: metadata.tags.join(",") }),
        },
        // Make file publicly readable
        predefinedAcl: "publicRead" as const,
      };

      // Upload file
      await file.save(buffer, gcsMetadata);

      // Generate public URL
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;

      return {
        assetId,
        fileSize,
        publicUrl,
        uploadedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new Error(
        `Failed to upload asset: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Validate file type and size constraints
   */
  validateAsset(
    contentType: string,
    fileSize: number,
    assetType: string,
  ): { errors: string[]; valid: boolean } {
    const errors: string[] = [];

    // Size limits (in bytes)
    const maxSizes: Record<string, number> = {
      audio: 50 * 1024 * 1024, // 50MB
      font: 2 * 1024 * 1024, // 2MB
      image: 10 * 1024 * 1024, // 10MB
      logo: 5 * 1024 * 1024, // 5MB
      video: 100 * 1024 * 1024, // 100MB
    };

    // Content type validation
    const allowedTypes: Record<string, string[]> = {
      audio: ["audio/mpeg", "audio/wav", "audio/ogg"],
      font: ["font/woff", "font/woff2", "font/ttf", "font/otf"],
      image: [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/gif",
        "image/webp",
      ],
      logo: ["image/jpeg", "image/jpg", "image/png", "image/svg+xml"],
      video: ["video/mp4", "video/webm", "video/quicktime"],
    };

    // Check file size
    const maxSize = maxSizes[assetType];
    if (maxSize && fileSize > maxSize) {
      errors.push(
        `File size ${Math.round(fileSize / 1024 / 1024)}MB exceeds maximum ${Math.round(maxSize / 1024 / 1024)}MB for ${assetType}`,
      );
    }

    // Check content type
    const allowedTypesForAsset = allowedTypes[assetType];
    if (allowedTypesForAsset && !allowedTypesForAsset.includes(contentType)) {
      errors.push(
        `Content type ${contentType} not allowed for ${assetType}. Allowed: ${allowedTypesForAsset.join(", ")}`,
      );
    }

    return {
      errors,
      valid: errors.length === 0,
    };
  }

  /**
   * Find asset file by ID across all customer directories
   */
  private async findAssetFile(assetId: string): Promise<null | string> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      // Search across all customers for the asset ID
      const [files] = await bucket.getFiles({ prefix: "customers/" });

      // Find file that contains the asset ID in its path
      const matchingFile = files.find((file) =>
        file.name.includes(`/assets/${assetId}`),
      );

      return matchingFile ? matchingFile.name : null;
    } catch {
      return null;
    }
  }

  /**
   * Get appropriate file extension based on filename or content type
   */
  private getFileExtension(filename: string, contentType: string): string {
    // First try to get extension from filename
    const filenameExt = filename.toLowerCase().match(/\.[^.]*$/)?.[0];
    if (filenameExt) {
      return filenameExt;
    }

    // Fall back to content type mapping
    const contentTypeMap: Record<string, string> = {
      "application/javascript": ".js",
      "application/pdf": ".pdf",
      "audio/mpeg": ".mp3",
      "audio/ogg": ".ogg",
      "audio/wav": ".wav",
      "image/gif": ".gif",
      "image/jpeg": ".jpg",
      "image/jpg": ".jpg",
      "image/png": ".png",
      "image/svg+xml": ".svg",
      "image/webp": ".webp",
      "text/html": ".html",
      "video/mp4": ".mp4",
      "video/quicktime": ".mov",
      "video/webm": ".webm",
    };

    return contentTypeMap[contentType] || "";
  }
}
