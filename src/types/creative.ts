/**
 * Creative Management Types - AdCP-Aligned Structure
 * 
 * Following AdCP-style hierarchy where a Creative contains multiple Assets
 * All field names are verbose and human-readable for LLM usage
 */

/**
 * A Creative is the conceptual advertising unit that contains multiple assets
 * This is the top-level container that gets assigned to campaigns
 */
export interface Creative {
  // Identity
  creativeId: string;
  creativeName: string;
  creativeDescription?: string;
  version: string; // Semantic versioning for iterations
  
  // Ownership (tied to buyer agent)
  buyerAgentId: string;
  customerId: number;
  
  // Creative composition - AdCP style: Creative contains Assets
  assets: CreativeAsset[]; // Multiple assets make up a creative
  primaryAssetId?: string; // ID of the hero/main asset
  
  // Creative metadata
  advertiserDomains: string[]; // Where clicks will go
  contentCategories: string[]; // IAB content taxonomy
  targetAudience?: string; // Natural language description
  
  // Status and workflow
  status: CreativeStatus;
  
  // Campaign associations (optimized to reduce API calls)
  campaignAssignments?: CampaignAssignment[];
  
  // Tracking with human-readable names
  createdDate: string;
  lastModifiedDate: string;
  createdBy: string;
  lastModifiedBy: string;
}

/**
 * An Asset is an actual file or content piece that composes a Creative
 * Multiple assets can belong to one creative (e.g., image + headline + CTA)
 */
export interface CreativeAsset {
  // Identity
  assetId: string;
  assetName: string;
  assetDescription?: string;
  
  // Asset specifications
  assetType: AssetType;
  
  // File details (verbose names for LLM clarity)
  fileFormat: string; // 'jpeg', 'png', 'mp4', etc.
  fileSizeBytes: number;
  fileUrl: string;
  thumbnailUrl?: string;
  
  // Dimensions (for visual assets)
  widthPixels?: number;
  heightPixels?: number;
  aspectRatio?: string; // '16:9', '1:1', etc.
  
  // Duration (for video/audio)
  durationSeconds?: number;
  
  // Text content (for text/native assets)
  textContent?: TextContent;
  
  // Technical capabilities (human-readable names)
  supportedAPIs?: string[]; // ['MRAID_3.0', 'VPAID_2.0', etc.]
  supportedProtocols?: string[]; // ['VAST_4.2', 'DAAST_1.0', etc.]
  mimeTypes?: string[];
  
  // Asset role in creative
  assetRole?: AssetRole;
  placementHints?: string[]; // ['above_fold', 'mobile_optimized', etc.]
  
  // Metadata
  tags: string[];
  customMetadata?: Record<string, unknown>;
}

/**
 * Text content for text-based or native assets
 */
export interface TextContent {
  headline?: string;
  bodyText?: string;
  callToAction?: string;
  sponsoredByText?: string;
  brandName?: string;
  disclaimer?: string;
}

/**
 * Campaign assignment information included in creative responses
 * to reduce the need for separate API calls
 */
export interface CampaignAssignment {
  campaignId: string;
  campaignName: string;
  assignedDate: string;
  isActive: boolean;
  performance?: {
    impressions: number;
    clicks: number;
    clickThroughRate: number;
  };
}

/**
 * Creative Package for multi-format/responsive creatives
 * Supports dynamic creative optimization and format adaptation
 */
export interface CreativePackage {
  packageId: string;
  packageName: string;
  packageDescription?: string;
  buyerAgentId: string;
  
  // Base creative
  baseCreative: Creative;
  
  // Format variants for different contexts
  formatVariants: CreativeVariant[];
  
  // Rules for when to use which variant
  adaptationRules?: AdaptationRule[];
  
  // Dynamic creative optimization config
  dynamicOptimization?: DynamicCreativeConfig;
}

/**
 * A variant of a creative optimized for specific contexts
 */
export interface CreativeVariant {
  variantId: string;
  variantName: string;
  targetContext: string; // 'mobile', 'desktop', 'ctv', etc.
  targetSizes: Array<{
    widthPixels: number;
    heightPixels: number;
  }>;
  creative: Creative;
  performance?: VariantPerformance;
}

/**
 * Rules for adaptive creative selection
 */
export interface AdaptationRule {
  ruleId: string;
  condition: string; // 'device_type', 'screen_size', 'time_of_day', etc.
  conditionValue: string;
  action: string; // Which variant to use
  priority: number;
}

/**
 * Dynamic creative optimization configuration
 */
export interface DynamicCreativeConfig {
  templateAssetId: string; // Base creative template
  dynamicElements: {
    textFields: string[];
    imageSlots: string[];
    productFeeds: string[];
    callToActions: string[];
  };
  personalizationSignals: string[];
  optimizationGoal: OptimizationGoal;
}

/**
 * Performance metrics for creative variants
 */
export interface VariantPerformance {
  impressions: number;
  clicks: number;
  conversions: number;
  clickThroughRate: number;
  conversionRate: number;
  costPerClick?: number;
  costPerConversion?: number;
}

/**
 * Creative Collection for organization and management
 */
export interface CreativeCollection {
  collectionId: string;
  collectionName: string;
  collectionDescription?: string;
  buyerAgentId: string;
  
  creativeIds: string[];
  tags: string[];
  
  createdDate: string;
  lastModifiedDate: string;
}

/**
 * Response structure for listing creatives
 * Includes summary data to reduce follow-up API calls
 */
export interface CreativeListResponse {
  items: Creative[];
  totalCount: number;
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string;
  };
  // Summary statistics to reduce additional queries
  summary?: CreativeSummary;
}

/**
 * Summary statistics for creative lists
 */
export interface CreativeSummary {
  totalCreatives: number;
  byStatus: Record<string, number>;
  byAssetType: Record<string, number>;
  totalCampaigns: number;
  averageAssetsPerCreative: number;
}

/**
 * Input types for creating creatives
 */
export interface CreateCreativeInput {
  creativeName: string;
  creativeDescription?: string;
  buyerAgentId: string;
  
  // Assets that compose this creative
  assets: CreateAssetInput[];
  
  // Metadata
  advertiserDomains: string[];
  contentCategories?: string[];
  targetAudience?: string;
  
  // Optional immediate assignment
  assignToCampaignIds?: string[];
}

/**
 * Input for creating individual assets
 */
export interface CreateAssetInput {
  assetName: string;
  assetType: AssetType;
  
  // File information
  fileUrl?: string;
  fileContent?: string; // Base64 encoded
  fileFormat?: string;
  
  // Specifications
  widthPixels?: number;
  heightPixels?: number;
  durationSeconds?: number;
  
  // Text content for native/text assets
  textContent?: TextContent;
  
  // Role and metadata
  assetRole?: AssetRole;
  tags?: string[];
  customMetadata?: Record<string, unknown>;
}

/**
 * Filter options for listing creatives
 */
export interface CreativeFilter {
  status?: CreativeStatus;
  hasAssetType?: AssetType;
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

// Enums with descriptive values

export enum CreativeStatus {
  DRAFT = 'draft',
  PENDING_REVIEW = 'pending_review',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ARCHIVED = 'archived'
}

export enum AssetType {
  IMAGE = 'image',
  VIDEO = 'video',
  TEXT = 'text',
  AUDIO = 'audio',
  HTML = 'html',
  NATIVE_COMPONENT = 'native_component'
}

export enum AssetRole {
  PRIMARY = 'primary',
  COMPANION = 'companion',
  FALLBACK = 'fallback',
  VARIANT = 'variant',
  BACKGROUND = 'background',
  OVERLAY = 'overlay'
}

export enum OptimizationGoal {
  CLICK_THROUGH_RATE = 'click_through_rate',
  COST_PER_ACQUISITION = 'cost_per_acquisition',
  RETURN_ON_AD_SPEND = 'return_on_ad_spend',
  VIEWABILITY = 'viewability',
  BRAND_AWARENESS = 'brand_awareness'
}

/**
 * Error types for creative operations
 */
export interface CreativeError {
  errorCode: string;
  errorMessage: string;
  details?: Record<string, unknown>;
}

/**
 * Result types for mutations
 */
export type CreativeResult = Creative | CreativeError;
export type AssetResult = CreativeAsset | CreativeError;

/**
 * Assignment operation results
 */
export interface AssignmentResult {
  success: boolean;
  message: string;
  assignment?: CampaignAssignment;
}