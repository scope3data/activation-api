/**
 * Campaign Repository Contract
 *
 * This interface defines what any backend implementation must provide
 * for campaign operations. Whether using BigQuery, PostgreSQL, MongoDB,
 * or any other backend, implementations must satisfy this contract.
 */

/**
 * Authentication Service Contract
 */
export interface AuthenticationService {
  validateApiKey(apiKey: string): Promise<AuthResult>;
}

/**
 * Authentication result for validation
 */
export interface AuthResult {
  customerId?: number;
  error?: string;
  isValid: boolean;
}

export interface Campaign {
  audienceIds: string[];
  brandAgentId: string;
  budget: {
    currency: string;
    dailyCap?: number;
    pacing: string;
    total: number;
  };
  createdAt: string;
  creativeIds: string[];
  id: string;
  name: string;
  outcomeScoreWindowDays: number;
  prompt: string;
  scoringWeights?: Record<string, number>;
  status: "active" | "completed" | "draft" | "paused";
  updatedAt: string;
}

export interface CampaignInput {
  brandAgentId: string;
  budgetCurrency?: string;
  budgetDailyCap?: number;
  budgetPacing?: string;
  budgetTotal?: number;
  campaignName: string;
  endDate?: string;
  outcomeScoreWindowDays?: number;
  prompt: string;
  scoringWeights?: Record<string, number>;
  startDate?: string;
}

export interface CampaignListOptions {
  brandAgentId: string;
  limit?: number;
  offset?: number;
  status?: string;
}

export interface CampaignListResult {
  campaigns: Campaign[];
  hasMore: boolean;
  totalCount: number;
}

/**
 * Campaign Repository Contract
 *
 * Any backend implementation (BigQuery, PostgreSQL, etc.) must implement
 * this interface to provide campaign management capabilities.
 */
export interface CampaignRepository {
  /**
   * Create a new campaign
   * @param apiKey - Authentication token
   * @param input - Campaign creation data
   * @returns Promise resolving to created campaign
   * @throws Error if authentication fails or validation errors
   */
  createCampaign(apiKey: string, input: CampaignInput): Promise<Campaign>;

  /**
   * Delete a campaign permanently
   * @param apiKey - Authentication token
   * @param campaignId - Campaign identifier
   * @returns Promise resolving when deletion complete
   * @throws Error if authentication fails or campaign not found
   */
  deleteCampaign(apiKey: string, campaignId: string): Promise<void>;

  /**
   * Get a specific campaign by ID
   * @param apiKey - Authentication token
   * @param campaignId - Campaign identifier
   * @returns Promise resolving to campaign or null if not found
   * @throws Error if authentication fails
   */
  getCampaign(apiKey: string, campaignId: string): Promise<Campaign | null>;

  /**
   * Health check for the backend service
   * @returns Promise resolving to true if backend is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * List campaigns for a brand agent
   * @param apiKey - Authentication token
   * @param options - Filtering and pagination options
   * @returns Promise resolving to campaign list with metadata
   * @throws Error if authentication fails
   */
  listCampaigns(
    apiKey: string,
    options: CampaignListOptions,
  ): Promise<CampaignListResult>;

  /**
   * Update an existing campaign
   * @param apiKey - Authentication token
   * @param campaignId - Campaign identifier
   * @param updates - Fields to update
   * @returns Promise resolving to updated campaign
   * @throws Error if authentication fails or campaign not found
   */
  updateCampaign(
    apiKey: string,
    campaignId: string,
    updates: CampaignUpdate,
  ): Promise<Campaign>;
}

export interface CampaignUpdate {
  budgetCurrency?: string;
  budgetDailyCap?: number;
  budgetPacing?: string;
  budgetTotal?: number;
  campaignName?: string;
  endDate?: string;
  outcomeScoreWindowDays?: number;
  prompt?: string;
  scoringWeights?: Record<string, number>;
  startDate?: string;
  status?: "active" | "completed" | "draft" | "paused";
}
