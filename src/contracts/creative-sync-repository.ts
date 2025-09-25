// Contract interface for creative sync operations
// Ensures all implementations provide consistent behavior

import type {
  CreativeSyncStatus,
} from "../types/notifications.js";

/**
 * Repository contract for creative sync operations
 * Any backend implementation (BigQuery, PostgreSQL, etc.) must satisfy this interface
 */
export interface CreativeSyncRepository {
  /**
   * Update sync status for a creative-sales agent pair
   */
  updateSyncStatus(
    creativeId: string,
    salesAgentId: string,
    brandAgentId: number,
    updates: {
      syncStatus?:
        | "pending"
        | "syncing"
        | "synced"
        | "failed"
        | "not_applicable";
      approvalStatus?:
        | "pending"
        | "approved"
        | "rejected"
        | "changes_requested";
      syncError?: string | null;
      lastSyncAttempt?: string;
      rejectionReason?: string;
      requestedChanges?: string[];
      tacticContext?: string;
      campaignContext?: string;
    },
  ): Promise<void>;

  /**
   * Get sync status for a creative across all sales agents
   */
  getCreativeSyncStatus(creativeId: string): Promise<CreativeSyncStatus[]>;

  /**
   * Get sync status for multiple creatives (batch operation)
   */
  getBatchCreativeSyncStatus(
    creativeIds: string[],
  ): Promise<Record<string, CreativeSyncStatus[]>>;

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
   * Get sales agent capabilities for format matching
   */
  getSalesAgentCapabilities(
    salesAgentId: string,
  ): Promise<SalesAgentCapabilities | null>;

  /**
   * Batch get sales agent capabilities
   */
  getBatchSalesAgentCapabilities(
    salesAgentIds: string[],
  ): Promise<Record<string, SalesAgentCapabilities>>;

  /**
   * Check if a creative format is compatible with a sales agent
   */
  isFormatCompatible(
    creativeFormat: string,
    salesAgentId: string,
  ): Promise<boolean>;

  /**
   * Get sync statistics for reporting
   */
  getSyncStatistics(
    brandAgentId: number,
    options?: {
      campaignId?: string;
      dateRange?: {
        start: string;
        end: string;
      };
    },
  ): Promise<{
    totalCreatives: number;
    syncedCreatives: number;
    approvedCreatives: number;
    rejectedCreatives: number;
    failedSyncs: number;
    byFormat: Record<
      string,
      {
        total: number;
        synced: number;
        approved: number;
        rejected: number;
      }
    >;
    bySalesAgent: Record<
      string,
      {
        name: string;
        synced: number;
        approved: number;
        rejected: number;
      }
    >;
  }>;

  /**
   * Clean up old sync status records
   */
  cleanupOldSyncStatus(olderThanDays: number): Promise<number>;
}

/**
 * Input interfaces for creative sync operations
 */
export interface CreateSyncStatusData {
  creativeId: string;
  salesAgentId: string;
  brandAgentId: number;
  syncStatus: "pending" | "syncing" | "synced" | "failed";
  approvalStatus?: "pending" | "approved" | "rejected" | "changes_requested";
  tacticContext?: string;
  campaignContext?: string;
}

export interface UpdateSyncStatusData {
  syncStatus?: "pending" | "syncing" | "synced" | "failed" | "not_applicable";
  approvalStatus?: "pending" | "approved" | "rejected" | "changes_requested";
  syncError?: string | null;
  rejectionReason?: string;
  requestedChanges?: string[];
  lastSyncAttempt?: string;
}

export interface SyncStatusFilter {
  creativeIds?: string[];
  salesAgentIds?: string[];
  brandAgentId?: number;
  syncStatus?: string[];
  approvalStatus?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * Response types for sync operations
 */
export interface SyncOperationResult {
  success: boolean;
  error?: string;
  syncedAgents: string[];
  failedAgents: Array<{
    salesAgentId: string;
    error: string;
  }>;
  metadata?: {
    totalAttempted: number;
    totalSuccessful: number;
    totalFailed: number;
    formatMatched: number;
    formatMismatched: number;
  };
}
