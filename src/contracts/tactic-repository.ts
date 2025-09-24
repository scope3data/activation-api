/**
 * Tactic Repository Contract
 *
 * This interface defines what any backend implementation must provide
 * for tactic operations. Whether using BigQuery, PostgreSQL, MongoDB,
 * or any other backend, implementations must satisfy this contract.
 */

import type { BudgetAllocation, EffectivePricing } from "../types/tactics.js";

export interface Tactic {
  axeIncludeSegment?: string;
  brandStoryId?: string;
  budgetAllocation: BudgetAllocation;
  campaignId: string;
  createdAt: string;
  customerId: number;
  description?: string;
  effectivePricing: EffectivePricing;
  id: string;
  mediaProductId: string;
  name: string;
  salesAgentId: string;
  signalId?: string;
  status: "active" | "inactive" | "paused";
  updatedAt: string;
}

export interface TacticInput {
  brandStoryId?: string;
  budgetAllocation: BudgetAllocation;
  campaignId: string;
  description?: string;
  mediaProductId: string;
  name: string;
  signalId?: string;
}

export interface TacticUpdateInput {
  budgetAllocation?: Partial<BudgetAllocation>;
  description?: string;
  name?: string;
  status?: "active" | "inactive" | "paused";
}

export interface PrebidSegment {
  axe_include_segment: string;
  max_cpm: number;
}

export interface TacticListOptions {
  campaignId: string;
  limit?: number;
  offset?: number;
  status?: string;
}

export interface TacticListResult {
  hasMore: boolean;
  tactics: Tactic[];
  totalCount: number;
}

/**
 * Tactic Repository Contract
 *
 * Any backend implementation (BigQuery, PostgreSQL, etc.) must implement
 * this interface to provide tactic management and prebid integration capabilities.
 */
export interface TacticRepository {
  /**
   * Create a new tactic
   * @param apiKey - Authentication token
   * @param input - Tactic creation data
   * @param effectivePricing - Calculated pricing information
   * @param salesAgentId - Sales agent ID derived from media product
   * @returns Promise resolving to created tactic
   * @throws Error if authentication fails or validation errors
   */
  createTactic(
    apiKey: string,
    input: TacticInput,
    effectivePricing: EffectivePricing,
    salesAgentId: string,
  ): Promise<Tactic>;

  /**
   * Delete a tactic (mark as inactive)
   * @param apiKey - Authentication token
   * @param tacticId - Tactic identifier
   * @returns Promise resolving when deletion complete
   * @throws Error if authentication fails or tactic not found
   */
  deleteTactic(apiKey: string, tacticId: string): Promise<void>;

  /**
   * Get a specific tactic by ID
   * @param apiKey - Authentication token
   * @param tacticId - Tactic identifier
   * @returns Promise resolving to tactic or null if not found
   * @throws Error if authentication fails
   */
  getTactic(apiKey: string, tacticId: string): Promise<Tactic | null>;

  /**
   * Get prebid segments for a publisher organization
   * @param orgId - Publisher organization ID
   * @returns Promise resolving to array of AXE segments with max CPM
   * @throws Error if query fails
   */
  getPrebidSegments(orgId: string): Promise<PrebidSegment[]>;

  /**
   * Health check for the backend service
   * @returns Promise resolving to true if backend is healthy
   */
  healthCheck(): Promise<boolean>;

  /**
   * List tactics for a campaign
   * @param apiKey - Authentication token
   * @param options - Filtering and pagination options
   * @returns Promise resolving to tactic list with metadata
   * @throws Error if authentication fails
   */
  listTactics(
    apiKey: string,
    options: TacticListOptions,
  ): Promise<TacticListResult>;

  /**
   * Update an existing tactic
   * @param apiKey - Authentication token
   * @param tacticId - Tactic identifier
   * @param updates - Fields to update
   * @param effectivePricing - Updated pricing if changed
   * @returns Promise resolving to updated tactic
   * @throws Error if authentication fails or tactic not found
   */
  updateTactic(
    apiKey: string,
    tacticId: string,
    updates: TacticUpdateInput,
    effectivePricing?: EffectivePricing,
  ): Promise<Tactic>;
}