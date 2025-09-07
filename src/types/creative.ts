/**
 * Creative Management Types - MCP Orchestration + REST Upload Architecture
 *
 * MCP Layer: Orchestration and control via natural language
 * REST Layer: File uploads and bulk data operations
 *
 * All field names are verbose and human-readable for LLM usage
 */

// ========================================
// Creative Format System
// ========================================

/**
 * Input for adding assets via MCP (reference management)
 */
export interface AddAssetInput {
  assets: Array<{
    metadata?: {
      dimensions?: { height: number; width: number };
      duration?: number;
      fileSize?: number;
      tags?: string[];
    };
    name: string;

    // Reference, not upload
    source: AssetSource;

    type: "audio" | "font" | "image" | "logo" | "video";
  }>;
  buyerAgentId: string;
}

/**
 * Result of importing a single asset
 */
export interface AssetImportResult {
  assetId: string;
  error?: string;
  originalUrl?: string;
  success: boolean;
  uploadId?: string;
}

// ========================================
// Asset Management (Reference-Based)
// ========================================

/**
 * Response for listing assets
 */
export interface AssetListResponse {
  assets: CreativeAsset[];
  hasMore: boolean;
  nextOffset?: number;
  totalCount: number;
}

export type AssetResult = CreativeAsset | CreativeError;

/**
 * Asset source reference (not upload)
 */
export interface AssetSource {
  cdnUrl?: string; // Already on CDN
  uploadId?: string; // ID from REST upload
  url?: string; // External URL to fetch from
}

// ========================================
// Creative Content System
// ========================================

/**
 * Asset validation error details
 */
export interface AssetValidationError {
  assetId: string;
  assetUrl?: string;
  errorMessage: string;
  errorType:
    | "corrupted"
    | "download_failed"
    | "format_mismatch"
    | "missing_required"
    | "not_found"
    | "size_exceeded";
  suggestion?: string; // How to fix the error
  technicalDetails?: {
    actualFormat?: string;
    actualSize?: string;
    expectedFormat?: string;
    httpStatus?: number;
    maxSize?: string;
  };
}

/**
 * Assignment operation results
 */
export interface AssignmentResult {
  campaignId: string;
  creativeId: string;
  message: string;
  success: boolean;
}

// ========================================
// Input Types for MCP Operations
// ========================================

/**
 * Bulk asset import response
 */
export interface BulkAssetImportResponse {
  errorCount: number;
  results: AssetImportResult[];
  successCount: number;
  summary: string;
}

/**
 * Input for creating creatives via MCP orchestration
 */
export interface CreateCreativeInput {
  // Assembly method
  assemblyMethod?: "creative_agent" | "pre_assembled" | "publisher";
  // Optional immediate campaign assignment
  assignToCampaignIds?: string[];
  buyerAgentId: string;

  // Content sources (one or more required)
  content?: CreativeContent;

  // Marketing details (advertiserDomains now at brand agent level)
  contentCategories?: string[]; // IAB content categories

  creativeDescription?: string;

  creativeName: string;
  // External ID management
  externalId?: string; // User-provided ID for external system management

  // Format specification (required)
  format: {
    formatId: string; // e.g., "adcp/display_banner", "publisher/amazon_dsp/ctv_video"
    type: "adcp" | "creative_agent" | "publisher";
  };

  targetAudience?: string; // Natural language description

  // Multiple creatives at once
  variants?: number; // Generate N variants
}

/**
 * The main Creative entity - orchestration focused
 */
export interface Creative {
  assemblyMethod: "creative_agent" | "pre_assembled" | "publisher";
  // Referenced assets (not embedded)
  assetIds: string[];
  // Asset validation status
  assetValidation?: {
    allAssetsValid: boolean;
    invalidAssets?: Array<{
      assetId: string;
      error:
        | "corrupted"
        | "download_failed"
        | "format_mismatch"
        | "not_found"
        | "size_exceeded";
      errorMessage: string;
    }>;
    validatedAt?: string;
  };
  // Ownership
  buyerAgentId: string;

  // Campaign relationships (optimized for reduced API calls)
  campaignAssignments?: {
    assignedDate: string;
    campaignId: string;
    campaignName: string;
    isActive: boolean;
    publishersSynced?: string[]; // Which publishers this creative was synced to
  }[];

  // Content (orchestration, not upload)
  content: CreativeContent;
  // Marketing metadata (advertiserDomains now at brand agent level)
  contentCategories?: string[]; // IAB content categories

  createdBy: string;
  // Timestamps and audit
  createdDate: string;

  creativeDescription?: string;

  creativeId: string;

  creativeName: string;
  customerId: number;

  // External ID management
  externalId?: string; // User-provided ID for external system management

  // Format and assembly
  format: {
    formatId: string; // e.g., "adcp/display_banner", "publisher/amazon_dsp/ctv_video"
    type: "adcp" | "creative_agent" | "publisher";
  };

  lastModifiedBy: string;

  lastModifiedDate: string;

  // Publisher approval status
  publisherApprovals?: Array<{
    approvalStatus:
      | "approved"
      | "auto_approved"
      | "changes_requested"
      | "pending"
      | "rejected";
    autoApprovalPolicy?: boolean; // Publisher auto-approves standard formats
    publisherId: string;
    publisherName: string;
    rejectionReason?: string;
    requestedChanges?: string[];
    reviewedAt?: string;
    syncedAt: string;
  }>;
  // Status and lifecycle
  status:
    | "active"
    | "archived"
    | "draft"
    | "paused"
    | "pending_review"
    | "rejected";
  targetAudience?: string; // Natural language description
  version: string;
}

// ========================================
// Filter and Pagination
// ========================================

/**
 * Asset metadata and references
 */
export interface CreativeAsset {
  assetId: string;
  assetName: string;
  assetType: "audio" | "font" | "html" | "image" | "logo" | "text" | "video";

  createdBy: string;

  // Timestamps
  createdDate: string;
  // Visual specifications (for images and videos)
  dimensions?: {
    height: number;
    width: number;
  };

  // Temporal specifications (for videos and audio)
  durationSeconds?: number;

  // File specifications (optional, may be discovered)
  fileFormat?: string; // e.g., "jpg", "mp4", "mp3"

  fileSizeBytes?: number;

  lastModifiedDate: string;
  metadata?: Record<string, unknown>;

  // Asset source (reference, not upload)
  source: AssetSource;
  // Organization
  tags?: string[];
  // Text content (for text assets)
  textContent?: {
    bodyText?: string;
    callToAction?: string;
    headline?: string;
    sponsoredByText?: string;
  };
}

/**
 * Creative content sources (orchestration, not upload)
 */
export interface CreativeContent {
  // Asset references (not uploads)
  assetIds?: string[]; // References to pre-uploaded assets
  // Pre-assembled content (ad server tags)
  htmlSnippet?: string; // For HTML5 creatives
  javascriptTag?: string; // For JS ad tags

  // External sources
  productUrl?: string; // For product-based generation

  vastTag?: string; // For video ads
}

// ========================================
// Response Types
// ========================================

/**
 * Error types for creative operations
 */
export interface CreativeError {
  details?: Record<string, unknown>;
  errorCode: string;
  errorMessage: string;
}

/**
 * Filter options for listing creatives
 */
export interface CreativeFilter {
  campaignId?: string;
  contentCategory?: string;
  createdAfter?: string;
  createdBefore?: string;
  hasAssetType?:
    | "audio"
    | "font"
    | "html"
    | "image"
    | "logo"
    | "text"
    | "video";
  searchTerm?: string;
  status?:
    | "active"
    | "archived"
    | "draft"
    | "paused"
    | "pending_review"
    | "rejected";
  tags?: string[];
  unassigned?: boolean; // Show only creatives not assigned to campaigns
}

// ========================================
// Asset Import Results (for REST operations)
// ========================================

/**
 * Creative format specification - defines what can be created
 */
export interface CreativeFormat {
  description: string;
  formatId: string; // e.g., "adcp/display_banner", "publisher/ctv_video", "agent/dynamic_product"
  name: string;
  requirements: {
    acceptsThirdPartyTags: boolean; // Supports ad server tags

    assemblyCapable: boolean; // Can be assembled from assets
    requiredAssets: Array<{
      specs: {
        dimensions?: string; // "1200x628" or "16:9"
        formats?: string[]; // ["jpg", "png"]
        maxSize?: string; // "5MB"
      };
      type: "audio" | "image" | "logo" | "text" | "video";
    }>;
  };

  type: "adcp" | "creative_agent" | "publisher";
}

/**
 * Response for listing all available creative formats
 */
export interface CreativeFormatsResponse {
  adcp_formats: CreativeFormat[];
  creative_agent_formats: CreativeFormat[];
  publisher_formats: CreativeFormat[];
}

// ========================================
// Publisher Sync and Approval Types
// ========================================

/**
 * Response structure for listing creatives
 */
export interface CreativeListResponse {
  creatives: Creative[];
  hasMore: boolean;
  nextOffset?: number;
  // Summary statistics
  summary: {
    activeCreatives: number;
    assignedCreatives: number;
    draftCreatives: number;
    totalCreatives: number;
    unassignedCreatives: number;
  };

  totalCount: number;
}

/**
 * Request to sync creative to publishers for pre-approval
 */
export interface CreativePreApprovalRequest {
  creativeId: string;
  publisherIds: string[]; // Specific publishers to get pre-approval from
}

/**
 * Result types for mutations
 */
export type CreativeResult = Creative | CreativeError;

/**
 * Creative revision for rejected creatives
 */
export interface CreativeRevisionInput {
  creativeId: string;
  publisherId: string;
  revisionNotes?: string; // Explain what was changed
  revisions: {
    assetIds?: string[];
    content?: Partial<CreativeContent>;
    contentCategories?: string[];
    targetAudience?: string;
  };
}

// ========================================
// Error Types
// ========================================

/**
 * Pagination options
 */
export interface PaginationInput {
  limit: number;
  offset: number;
}

/**
 * Publisher approval update notification
 */
export interface PublisherApprovalUpdate {
  creativeId: string;
  newStatus: "approved" | "changes_requested" | "rejected";
  previousStatus: string;
  publisherId: string;
  publisherName: string;
  rejectionReason?: string;
  requestedChanges?: string[];
  reviewedAt: string;
  reviewerNotes?: string;
}

/**
 * Result of syncing creative to publisher
 */
export interface PublisherSyncResult {
  approvalStatus?: "auto_approved" | "pending";
  creativeId: string;
  error?: string;
  estimatedReviewTime?: string; // e.g., "24 hours", "instant"
  publisherId: string;
  publisherName: string;
  syncedAt: string;
  syncStatus: "failed" | "pending" | "success";
}
/**
 * Input for updating existing creatives
 */
export interface UpdateCreativeInput {
  creativeId: string;
  updates: {
    content?: Partial<CreativeContent>;
    externalId?: string;
    name?: string;
    status?:
      | "active"
      | "archived"
      | "draft"
      | "paused"
      | "pending_review"
      | "rejected";
  };
}
