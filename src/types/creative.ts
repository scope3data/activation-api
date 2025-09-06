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
 * Creative format specification - defines what can be created
 */
export interface CreativeFormat {
  type: 'adcp' | 'publisher' | 'creative_agent';
  formatId: string;  // e.g., "adcp/display_banner", "publisher/ctv_video", "agent/dynamic_product"
  name: string;
  description: string;
  
  requirements: {
    requiredAssets: Array<{
      type: 'image' | 'video' | 'text' | 'logo' | 'audio';
      specs: {
        dimensions?: string;     // "1200x628" or "16:9"
        maxSize?: string;        // "5MB"
        formats?: string[];      // ["jpg", "png"] 
      };
    }>;
    
    assemblyCapable: boolean;        // Can be assembled from assets
    acceptsThirdPartyTags: boolean;  // Supports ad server tags
  };
}

/**
 * Response for listing all available creative formats
 */
export interface CreativeFormatsResponse {
  adcp_formats: CreativeFormat[];
  publisher_formats: CreativeFormat[];
  creative_agent_formats: CreativeFormat[];
}

// ========================================
// Asset Management (Reference-Based)
// ========================================

/**
 * Asset source reference (not upload)
 */
export interface AssetSource {
  url?: string;           // External URL to fetch from
  uploadId?: string;      // ID from REST upload
  cdnUrl?: string;        // Already on CDN
}

/**
 * Asset metadata and references
 */
export interface CreativeAsset {
  assetId: string;
  assetName: string;
  assetType: 'image' | 'video' | 'text' | 'audio' | 'html' | 'logo' | 'font';
  
  // Asset source (reference, not upload)
  source: AssetSource;
  
  // File specifications (optional, may be discovered)
  fileFormat?: string;  // e.g., "jpg", "mp4", "mp3"
  fileSizeBytes?: number;
  
  // Visual specifications (for images and videos)
  dimensions?: {
    width: number;
    height: number;
  };
  
  // Temporal specifications (for videos and audio)
  durationSeconds?: number;
  
  // Text content (for text assets)
  textContent?: {
    headline?: string;
    bodyText?: string;
    callToAction?: string;
    sponsoredByText?: string;
  };
  
  // Organization
  tags?: string[];
  metadata?: Record<string, unknown>;
  
  // Timestamps
  createdDate: string;
  lastModifiedDate: string;
  createdBy: string;
}

/**
 * Response for listing assets
 */
export interface AssetListResponse {
  assets: CreativeAsset[];
  totalCount: number;
  hasMore: boolean;
  nextOffset?: number;
}

// ========================================
// Creative Content System
// ========================================

/**
 * Creative content sources (orchestration, not upload)
 */
export interface CreativeContent {
  // Pre-assembled content (ad server tags)
  htmlSnippet?: string;      // For HTML5 creatives
  javascriptTag?: string;    // For JS ad tags  
  vastTag?: string;          // For video ads
  
  // Asset references (not uploads)
  assetIds?: string[];       // References to pre-uploaded assets
  
  // External sources
  productUrl?: string;       // For product-based generation
}

/**
 * The main Creative entity - orchestration focused
 */
export interface Creative {
  creativeId: string;
  creativeName: string;
  creativeDescription?: string;
  version: string;
  
  // External ID management
  externalId?: string;  // User-provided ID for external system management
  
  // Ownership
  buyerAgentId: string;
  customerId: number;
  
  // Format and assembly
  format: {
    type: 'adcp' | 'publisher' | 'creative_agent';
    formatId: string;  // e.g., "adcp/display_banner", "publisher/amazon_dsp/ctv_video"
  };
  assemblyMethod: 'publisher' | 'creative_agent' | 'pre_assembled';
  
  // Content (orchestration, not upload)
  content: CreativeContent;
  
  // Referenced assets (not embedded)
  assetIds: string[];
  
  // Marketing metadata (advertiserDomains now at brand agent level)
  contentCategories?: string[];  // IAB content categories
  targetAudience?: string; // Natural language description
  
  // Status and lifecycle
  status: 'draft' | 'pending_review' | 'active' | 'paused' | 'archived' | 'rejected';
  
  // Asset validation status
  assetValidation?: {
    allAssetsValid: boolean;
    invalidAssets?: Array<{
      assetId: string;
      error: 'not_found' | 'download_failed' | 'format_mismatch' | 'size_exceeded' | 'corrupted';
      errorMessage: string;
    }>;
    validatedAt?: string;
  };
  
  // Publisher approval status
  publisherApprovals?: Array<{
    publisherId: string;
    publisherName: string;
    approvalStatus: 'pending' | 'approved' | 'rejected' | 'auto_approved' | 'changes_requested';
    syncedAt: string;
    reviewedAt?: string;
    rejectionReason?: string;
    requestedChanges?: string[];
    autoApprovalPolicy?: boolean;  // Publisher auto-approves standard formats
  }>;
  
  // Campaign relationships (optimized for reduced API calls)
  campaignAssignments?: {
    campaignId: string;
    campaignName: string;
    assignedDate: string;
    isActive: boolean;
    publishersSynced?: string[];  // Which publishers this creative was synced to
  }[];
  
  // Timestamps and audit
  createdDate: string;
  lastModifiedDate: string;
  createdBy: string;
  lastModifiedBy: string;
}

// ========================================
// Input Types for MCP Operations
// ========================================

/**
 * Input for creating creatives via MCP orchestration
 */
export interface CreateCreativeInput {
  buyerAgentId: string;
  creativeName: string;
  creativeDescription?: string;
  
  // External ID management
  externalId?: string;  // User-provided ID for external system management
  
  // Format specification (required)
  format: {
    type: 'adcp' | 'publisher' | 'creative_agent';
    formatId: string;  // e.g., "adcp/display_banner", "publisher/amazon_dsp/ctv_video"
  };
  
  // Content sources (one or more required)
  content?: CreativeContent;
  
  // Marketing details (advertiserDomains now at brand agent level)
  contentCategories?: string[];  // IAB content categories
  targetAudience?: string; // Natural language description
  
  // Assembly method
  assemblyMethod?: 'publisher' | 'creative_agent' | 'pre_assembled';
  
  // Multiple creatives at once
  variants?: number;  // Generate N variants
  
  // Optional immediate campaign assignment
  assignToCampaignIds?: string[];
}

/**
 * Input for updating existing creatives
 */
export interface UpdateCreativeInput {
  creativeId: string;
  updates: {
    name?: string;
    status?: 'draft' | 'pending_review' | 'active' | 'paused' | 'archived' | 'rejected';
    content?: Partial<CreativeContent>;
    externalId?: string;
  };
}

/**
 * Input for adding assets via MCP (reference management)
 */
export interface AddAssetInput {
  buyerAgentId: string;
  assets: Array<{
    name: string;
    type: 'image' | 'video' | 'audio' | 'logo' | 'font';
    
    // Reference, not upload
    source: AssetSource;
    
    metadata?: {
      dimensions?: { width: number; height: number };
      duration?: number;
      fileSize?: number;
      tags?: string[];
    };
  }>;
}

// ========================================
// Filter and Pagination
// ========================================

/**
 * Filter options for listing creatives
 */
export interface CreativeFilter {
  status?: 'draft' | 'pending_review' | 'active' | 'paused' | 'archived' | 'rejected';
  hasAssetType?: 'image' | 'video' | 'text' | 'audio' | 'html' | 'logo' | 'font';
  campaignId?: string;
  searchTerm?: string;
  contentCategory?: string;
  createdAfter?: string;
  createdBefore?: string;
  unassigned?: boolean; // Show only creatives not assigned to campaigns
  tags?: string[];
}

/**
 * Pagination options
 */
export interface PaginationInput {
  limit: number;
  offset: number;
}

// ========================================
// Response Types
// ========================================

/**
 * Response structure for listing creatives
 */
export interface CreativeListResponse {
  creatives: Creative[];
  totalCount: number;
  hasMore: boolean;
  nextOffset?: number;
  
  // Summary statistics
  summary: {
    totalCreatives: number;
    activeCreatives: number;
    draftCreatives: number;
    assignedCreatives: number;
    unassignedCreatives: number;
  };
}

/**
 * Assignment operation results
 */
export interface AssignmentResult {
  creativeId: string;
  campaignId: string;
  success: boolean;
  message: string;
}

// ========================================
// Asset Import Results (for REST operations)
// ========================================

/**
 * Result of importing a single asset
 */
export interface AssetImportResult {
  assetId: string;
  originalUrl?: string;
  uploadId?: string;
  success: boolean;
  error?: string;
}

/**
 * Bulk asset import response
 */
export interface BulkAssetImportResponse {
  results: AssetImportResult[];
  successCount: number;
  errorCount: number;
  summary: string;
}

// ========================================
// Publisher Sync and Approval Types
// ========================================

/**
 * Request to sync creative to publishers for pre-approval
 */
export interface CreativePreApprovalRequest {
  creativeId: string;
  publisherIds: string[];  // Specific publishers to get pre-approval from
}

/**
 * Result of syncing creative to publisher
 */
export interface PublisherSyncResult {
  creativeId: string;
  publisherId: string;
  publisherName: string;
  syncStatus: 'success' | 'failed' | 'pending';
  syncedAt: string;
  error?: string;
  approvalStatus?: 'pending' | 'auto_approved';
  estimatedReviewTime?: string;  // e.g., "24 hours", "instant"
}

/**
 * Publisher approval update notification
 */
export interface PublisherApprovalUpdate {
  creativeId: string;
  publisherId: string;
  publisherName: string;
  previousStatus: string;
  newStatus: 'approved' | 'rejected' | 'changes_requested';
  reviewedAt: string;
  rejectionReason?: string;
  requestedChanges?: string[];
  reviewerNotes?: string;
}

/**
 * Creative revision for rejected creatives
 */
export interface CreativeRevisionInput {
  creativeId: string;
  publisherId: string;
  revisions: {
    content?: Partial<CreativeContent>;
    contentCategories?: string[];
    targetAudience?: string;
    assetIds?: string[];
  };
  revisionNotes?: string;  // Explain what was changed
}

// ========================================
// Error Types
// ========================================

/**
 * Error types for creative operations
 */
export interface CreativeError {
  errorCode: string;
  errorMessage: string;
  details?: Record<string, unknown>;
}

/**
 * Asset validation error details
 */
export interface AssetValidationError {
  assetId: string;
  assetUrl?: string;
  errorType: 'not_found' | 'download_failed' | 'format_mismatch' | 'size_exceeded' | 'corrupted' | 'missing_required';
  errorMessage: string;
  technicalDetails?: {
    httpStatus?: number;
    expectedFormat?: string;
    actualFormat?: string;
    maxSize?: string;
    actualSize?: string;
  };
  suggestion?: string;  // How to fix the error
}

/**
 * Result types for mutations
 */
export type CreativeResult = Creative | CreativeError;
export type AssetResult = CreativeAsset | CreativeError;