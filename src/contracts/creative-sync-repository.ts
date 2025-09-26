// Contract interface for creative sync operations
// Ensures all implementations provide consistent behavior

import type {
  CreativeSyncStatus,
  SalesAgentCapabilities,
} from "../types/notifications.js";

/**
 * Input interfaces for creative sync operations
 */
export interface CreateSyncStatusData {
  approvalStatus?: "approved" | "changes_requested" | "pending" | "rejected";
  brandAgentId: number;
  campaignContext?: string;
  creativeId: string;
  salesAgentId: string;
  syncStatus: "failed" | "pending" | "synced" | "syncing";
  tacticContext?: string;
}

/**
 * Repository contract for creative sync operations
 * Any backend implementation (BigQuery, PostgreSQL, etc.) must satisfy this interface
 */
export interface CreativeSyncRepository {
  /**
   * Clean up old sync status records
   */
  cleanupOldSyncStatus(olderThanDays: number): Promise<number>;

  /**
   * Find recent sales agents used by a brand agent with matching format
   */
  findRecentSalesAgents(
    brandAgentId: number,
    creativeFormat: string,
    options: {
      daysBack: number;
      includeActive: boolean;
      limit?: number;
    },
  ): Promise<string[]>;

  /**
   * Get sync status for multiple creatives (batch operation)
   */
  getBatchCreativeSyncStatus(
    creativeIds: string[],
  ): Promise<Record<string, CreativeSyncStatus[]>>;

  /**
   * Batch get sales agent capabilities
   */
  getBatchSalesAgentCapabilities(
    salesAgentIds: string[],
  ): Promise<Record<string, SalesAgentCapabilities>>;

  /**
   * Get sync status for a creative across all sales agents
   */
  getCreativeSyncStatus(creativeId: string): Promise<CreativeSyncStatus[]>;

  /**
   * Get sales agent capabilities for format matching
   */
  getSalesAgentCapabilities(
    salesAgentId: string,
  ): Promise<null | SalesAgentCapabilities>;

  /**
   * Get sync statistics for reporting
   */
  getSyncStatistics(
    brandAgentId: number,
    options?: {
      campaignId?: string;
      dateRange?: {
        end: string;
        start: string;
      };
    },
  ): Promise<{
    approvedCreatives: number;
    byFormat: Record<
      string,
      {
        approved: number;
        rejected: number;
        synced: number;
        total: number;
      }
    >;
    bySalesAgent: Record<
      string,
      {
        approved: number;
        name: string;
        rejected: number;
        synced: number;
      }
    >;
    failedSyncs: number;
    rejectedCreatives: number;
    syncedCreatives: number;
    totalCreatives: number;
  }>;

  /**
   * Check if a creative format is compatible with a sales agent
   */
  isFormatCompatible(
    creativeFormat: string,
    salesAgentId: string,
  ): Promise<boolean>;

  /**
   * Update sync status for a creative-sales agent pair
   */
  updateSyncStatus(
    creativeId: string,
    salesAgentId: string,
    brandAgentId: number,
    updates: {
      approvalStatus?:
        | "approved"
        | "changes_requested"
        | "pending"
        | "rejected";
      campaignContext?: string;
      lastSyncAttempt?: string;
      rejectionReason?: string;
      requestedChanges?: string[];
      syncError?: null | string;
      syncStatus?:
        | "failed"
        | "not_applicable"
        | "pending"
        | "synced"
        | "syncing";
      tacticContext?: string;
    },
  ): Promise<void>;
}

/**
 * Response types for sync operations
 */
export interface SyncOperationResult {
  error?: string;
  failedAgents: Array<{
    error: string;
    salesAgentId: string;
  }>;
  metadata?: {
    formatMatched: number;
    formatMismatched: number;
    totalAttempted: number;
    totalFailed: number;
    totalSuccessful: number;
  };
  success: boolean;
  syncedAgents: string[];
}

export interface SyncStatusFilter {
  approvalStatus?: string[];
  brandAgentId?: number;
  creativeIds?: string[];
  dateRange?: {
    end: string;
    start: string;
  };
  salesAgentIds?: string[];
  syncStatus?: string[];
}

export interface UpdateSyncStatusData {
  approvalStatus?: "approved" | "changes_requested" | "pending" | "rejected";
  lastSyncAttempt?: string;
  rejectionReason?: string;
  requestedChanges?: string[];
  syncError?: null | string;
  syncStatus?: "failed" | "not_applicable" | "pending" | "synced" | "syncing";
}
