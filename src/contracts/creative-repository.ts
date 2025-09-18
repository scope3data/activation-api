/**
 * Creative Repository Contract
 *
 * This interface defines what any backend implementation must provide
 * for creative operations. Backend-agnostic creative management.
 */

export interface AssignmentResult {
  campaignId: string;
  creativeId: string;
  message: string;
  success: boolean;
}

export interface Creative {
  assemblyMethod: "creative_agent" | "pre_assembled";
  assetIds: string[];
  buyerAgentId: string;
  campaignAssignments?: string[];
  content: CreativeContent;
  contentCategories: string[];
  createdBy: string;
  createdDate: string;
  creativeDescription?: string;
  creativeId: string;
  creativeName: string;
  customerId: number;
  format: CreativeFormat;
  lastModifiedBy: string;
  lastModifiedDate: string;
  status: "active" | "archived" | "draft";
  targetAudience?: Record<string, unknown> | string;
  version: string;
}

export interface CreativeContent {
  assetIds?: string[];
  htmlSnippet?: string;
  javascriptTag?: string;
  productUrl?: string;
  vastTag?: string;
}

export interface CreativeFormat {
  formatId: string;
  type: "adcp" | "publisher";
}

export interface CreativeInput {
  assemblyMethod?: "creative_agent" | "pre_assembled";
  buyerAgentId: string;
  content: CreativeContent;
  contentCategories?: string[];
  creativeDescription?: string;
  creativeName: string;
  format: CreativeFormat;
  targetAudience?: Record<string, unknown> | string;
}

export interface CreativeListOptions {
  brandAgentId: string;
  format?: string;
  limit?: number;
  offset?: number;
  status?: string;
}

export interface CreativeListResult {
  creatives: Creative[];
  hasMore: boolean;
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
 * Creative Repository Contract
 *
 * Any backend implementation must implement this interface
 * to provide creative management and assignment capabilities.
 */
export interface CreativeRepository {
  /**
   * Assign creative to campaign
   * @param apiKey - Authentication token
   * @param creativeId - Creative identifier
   * @param campaignId - Campaign identifier
   * @param buyerAgentId - Brand agent identifier for authorization
   * @returns Promise resolving to assignment result
   * @throws Error if authentication fails or assignment invalid
   */
  assignCreativeToCampaign(
    apiKey: string,
    creativeId: string,
    campaignId: string,
    buyerAgentId: string,
  ): Promise<AssignmentResult>;

  /**
   * Create a new creative
   * @param apiKey - Authentication token
   * @param input - Creative creation data
   * @returns Promise resolving to created creative
   * @throws Error if authentication fails or validation errors
   */
  createCreative(apiKey: string, input: CreativeInput): Promise<Creative>;

  /**
   * Delete a creative permanently
   * @param apiKey - Authentication token
   * @param creativeId - Creative identifier
   * @returns Promise resolving when deletion complete
   * @throws Error if authentication fails or creative not found
   */
  deleteCreative(apiKey: string, creativeId: string): Promise<void>;

  /**
   * Get a specific creative by ID
   * @param apiKey - Authentication token
   * @param creativeId - Creative identifier
   * @param brandAgentId - Optional brand agent filter
   * @returns Promise resolving to creative or null if not found
   * @throws Error if authentication fails
   */
  getCreative(
    apiKey: string,
    creativeId: string,
    brandAgentId?: string,
  ): Promise<Creative | null>;

  /**
   * Health check for the backend service
   * @returns Promise resolving to true if backend is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * List creatives for a brand agent
   * @param apiKey - Authentication token
   * @param options - Filtering and pagination options
   * @returns Promise resolving to creative list with metadata
   * @throws Error if authentication fails
   */
  listCreatives(
    apiKey: string,
    options: CreativeListOptions,
  ): Promise<CreativeListResult>;

  /**
   * Unassign creative from campaign
   * @param apiKey - Authentication token
   * @param creativeId - Creative identifier
   * @param campaignId - Campaign identifier
   * @returns Promise resolving to unassignment result
   * @throws Error if authentication fails
   */
  unassignCreativeFromCampaign(
    apiKey: string,
    creativeId: string,
    campaignId: string,
  ): Promise<AssignmentResult>;

  /**
   * Update an existing creative
   * @param apiKey - Authentication token
   * @param creativeId - Creative identifier
   * @param buyerAgentId - Brand agent identifier for authorization
   * @param updates - Fields to update
   * @returns Promise resolving to updated creative
   * @throws Error if authentication fails or creative not found
   */
  updateCreative(
    apiKey: string,
    creativeId: string,
    buyerAgentId: string,
    updates: CreativeUpdate,
  ): Promise<Creative>;
}

export interface CreativeUpdate {
  content?: CreativeContent;
  creativeDescription?: string;
  name?: string;
  status?: "active" | "archived" | "draft";
  targetAudience?: Record<string, unknown> | string;
}
