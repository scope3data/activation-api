// In-memory test double for CreativeSyncRepository
// Provides fast, deterministic testing without external dependencies

import type {
  CreativeSyncRepository,
  CreateSyncStatusData,
  UpdateSyncStatusData,
  SyncStatusFilter,
  SyncOperationResult,
} from "../contracts/creative-sync-repository.js";
import type {
  CreativeSyncStatus,
} from "../types/notifications.js";

interface SyncStatusRecord {
  id: string;
  creativeId: string;
  salesAgentId: string;
  brandAgentId: number;
  syncStatus: "pending" | "syncing" | "synced" | "failed" | "not_applicable";
  approvalStatus?: "pending" | "approved" | "rejected" | "changes_requested";
  syncError?: string;
  rejectionReason?: string;
  requestedChanges?: string[];
  lastSyncAttempt?: string;
  tacticContext?: string;
  campaignContext?: string;
  createdAt: string;
  updatedAt: string;
}

interface SalesAgentRecord {
  salesAgentId: string;
  name: string;
  capabilities: SalesAgentCapabilities;
}

interface TacticRecord {
  id: string;
  campaignId: string;
  salesAgentId: string;
  brandAgentId: number;
  format: string;
  createdAt: string;
  status: string;
}

/**
 * In-memory implementation of CreativeSyncRepository for testing
 * Provides fast, predictable behavior for unit tests and development
 */
export class CreativeSyncRepositoryTestDouble
  implements CreativeSyncRepository
{
  private syncStatuses: Map<string, SyncStatusRecord> = new Map();
  private salesAgents: Map<string, SalesAgentRecord> = new Map();
  private tactics: Map<string, TacticRecord> = new Map();
  private nextId = 1;

  constructor() {
    // Seed with some default sales agents for testing
    this.seedDefaultSalesAgents();
  }

  private seedDefaultSalesAgents(): void {
    const defaultAgents = [
      {
        salesAgentId: "agent_display_1",
        name: "Display Agent 1",
        capabilities: {
          salesAgentId: "agent_display_1",
          supportsVideo: false,
          supportsDisplay: true,
          supportsAudio: false,
          supportsNative: true,
          supportsCTV: false,
          autoApprovalFormats: ["display/banner"],
        } as SalesAgentCapabilities,
      },
      {
        salesAgentId: "agent_video_1",
        name: "Video Agent 1",
        capabilities: {
          salesAgentId: "agent_video_1",
          supportsVideo: true,
          supportsDisplay: false,
          supportsAudio: false,
          supportsNative: false,
          supportsCTV: true,
          autoApprovalFormats: ["video/standard"],
          maxVideoDurationSeconds: 60,
        } as SalesAgentCapabilities,
      },
      {
        salesAgentId: "agent_multi_1",
        name: "Multi-Format Agent",
        capabilities: {
          salesAgentId: "agent_multi_1",
          supportsVideo: true,
          supportsDisplay: true,
          supportsAudio: true,
          supportsNative: true,
          supportsCTV: false,
          autoApprovalFormats: ["display/banner", "video/standard"],
        } as SalesAgentCapabilities,
      },
    ];

    defaultAgents.forEach((agent) => {
      this.salesAgents.set(agent.salesAgentId, agent);
    });
  }

  private getKey(creativeId: string, salesAgentId: string): string {
    return `${creativeId}:${salesAgentId}`;
  }

  async updateSyncStatus(
    creativeId: string,
    salesAgentId: string,
    brandAgentId: number,
    updates: UpdateSyncStatusData,
  ): Promise<void> {
    if (!creativeId || !salesAgentId || !brandAgentId) {
      throw new Error(
        "creativeId, salesAgentId, and brandAgentId are required",
      );
    }

    // Validate enum values
    if (
      updates.syncStatus &&
      !["pending", "syncing", "synced", "failed", "not_applicable"].includes(
        updates.syncStatus,
      )
    ) {
      throw new Error(`Invalid syncStatus: ${updates.syncStatus}`);
    }

    if (
      updates.approvalStatus &&
      !["pending", "approved", "rejected", "changes_requested"].includes(
        updates.approvalStatus,
      )
    ) {
      throw new Error(`Invalid approvalStatus: ${updates.approvalStatus}`);
    }

    const key = this.getKey(creativeId, salesAgentId);
    const now = new Date().toISOString();

    let existing = this.syncStatuses.get(key);

    if (existing) {
      // Update existing record
      existing.syncStatus = updates.syncStatus ?? existing.syncStatus;
      existing.approvalStatus =
        updates.approvalStatus ?? existing.approvalStatus;
      existing.syncError =
        updates.syncError === null
          ? undefined
          : (updates.syncError ?? existing.syncError);
      existing.rejectionReason =
        updates.rejectionReason ?? existing.rejectionReason;
      existing.requestedChanges =
        updates.requestedChanges ?? existing.requestedChanges;
      existing.lastSyncAttempt =
        updates.lastSyncAttempt ?? existing.lastSyncAttempt;
      existing.updatedAt = now;
    } else {
      // Create new record
      const newRecord: SyncStatusRecord = {
        id: `sync_${this.nextId++}`,
        creativeId,
        salesAgentId,
        brandAgentId,
        syncStatus: updates.syncStatus ?? "pending",
        approvalStatus: updates.approvalStatus,
        syncError: updates.syncError === null ? undefined : updates.syncError,
        rejectionReason: updates.rejectionReason,
        requestedChanges: updates.requestedChanges,
        lastSyncAttempt: updates.lastSyncAttempt,
        createdAt: now,
        updatedAt: now,
      };

      this.syncStatuses.set(key, newRecord);
    }
  }

  async getCreativeSyncStatus(
    creativeId: string,
  ): Promise<CreativeSyncStatus[]> {
    if (!creativeId) {
      return [];
    }

    const results: CreativeSyncStatus[] = [];

    for (const [key, record] of this.syncStatuses.entries()) {
      if (record.creativeId === creativeId) {
        const agent = this.salesAgents.get(record.salesAgentId);

        results.push({
          salesAgentId: record.salesAgentId,
          salesAgentName: agent?.name ?? record.salesAgentId,
          status: record.syncStatus,
          approvalStatus: record.approvalStatus,
          lastSyncAttempt: record.lastSyncAttempt,
          rejectionReason: record.rejectionReason,
          requestedChanges: record.requestedChanges,
        });
      }
    }

    return results.sort((a, b) =>
      a.salesAgentName.localeCompare(b.salesAgentName),
    );
  }

  async getBatchCreativeSyncStatus(
    creativeIds: string[],
  ): Promise<Record<string, CreativeSyncStatus[]>> {
    const result: Record<string, CreativeSyncStatus[]> = {};

    for (const creativeId of creativeIds) {
      result[creativeId] = await this.getCreativeSyncStatus(creativeId);
    }

    return result;
  }

  async findRecentSalesAgents(
    brandAgentId: number,
    creativeFormat: string,
    options: {
      daysBack: number;
      includeActive: boolean;
      limit?: number;
    },
  ): Promise<string[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - options.daysBack);
    const cutoffIso = cutoffDate.toISOString();

    const matchingAgents = new Set<string>();

    // Find tactics matching the criteria
    for (const [tacticId, tactic] of this.tactics.entries()) {
      if (
        tactic.brandAgentId === brandAgentId &&
        tactic.createdAt >= cutoffIso
      ) {
        // Check if format is compatible
        const agent = this.salesAgents.get(tactic.salesAgentId);
        if (
          agent &&
          this.isFormatCompatibleSync(creativeFormat, agent.capabilities)
        ) {
          // Check status filter
          if (!options.includeActive || tactic.status === "active") {
            matchingAgents.add(tactic.salesAgentId);
          }
        }
      }
    }

    let results = Array.from(matchingAgents);

    if (options.limit) {
      results = results.slice(0, options.limit);
    }

    return results;
  }

  async getSalesAgentCapabilities(
    salesAgentId: string,
  ): Promise<SalesAgentCapabilities | null> {
    const agent = this.salesAgents.get(salesAgentId);
    return agent ? agent.capabilities : null;
  }

  async getBatchSalesAgentCapabilities(
    salesAgentIds: string[],
  ): Promise<Record<string, SalesAgentCapabilities>> {
    const result: Record<string, SalesAgentCapabilities> = {};

    for (const salesAgentId of salesAgentIds) {
      const capabilities = await this.getSalesAgentCapabilities(salesAgentId);
      if (capabilities) {
        result[salesAgentId] = capabilities;
      }
    }

    return result;
  }

  async isFormatCompatible(
    creativeFormat: string,
    salesAgentId: string,
  ): Promise<boolean> {
    const agent = this.salesAgents.get(salesAgentId);
    if (!agent) {
      return false;
    }

    return this.isFormatCompatibleSync(creativeFormat, agent.capabilities);
  }

  private isFormatCompatibleSync(
    creativeFormat: string,
    capabilities: SalesAgentCapabilities,
  ): boolean {
    const formatType = creativeFormat.split("/")[0]?.toLowerCase();

    switch (formatType) {
      case "video":
        return capabilities.supportsVideo;
      case "display":
        return capabilities.supportsDisplay;
      case "audio":
        return capabilities.supportsAudio;
      case "native":
        return capabilities.supportsNative;
      case "ctv":
        return capabilities.supportsCTV;
      default:
        return capabilities.supportsDisplay; // Default fallback
    }
  }

  async getSyncStatistics(
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
  }> {
    const filteredStatuses = Array.from(this.syncStatuses.values()).filter(
      (status) => {
        if (status.brandAgentId !== brandAgentId) return false;

        if (
          options?.campaignId &&
          status.campaignContext !== options.campaignId
        ) {
          return false;
        }

        if (options?.dateRange) {
          if (
            status.createdAt < options.dateRange.start ||
            status.createdAt > options.dateRange.end
          ) {
            return false;
          }
        }

        return true;
      },
    );

    const uniqueCreatives = new Set(filteredStatuses.map((s) => s.creativeId));
    const syncedCreatives = new Set(
      filteredStatuses
        .filter((s) => s.syncStatus === "synced")
        .map((s) => s.creativeId),
    );
    const approvedCreatives = new Set(
      filteredStatuses
        .filter((s) => s.approvalStatus === "approved")
        .map((s) => s.creativeId),
    );
    const rejectedCreatives = new Set(
      filteredStatuses
        .filter((s) => s.approvalStatus === "rejected")
        .map((s) => s.creativeId),
    );
    const failedSyncs = filteredStatuses.filter(
      (s) => s.syncStatus === "failed",
    ).length;

    // Note: This is simplified - in a real implementation you'd join with creative data to get formats
    const byFormat: Record<string, any> = {};
    const bySalesAgent: Record<string, any> = {};

    // Build sales agent summary
    for (const status of filteredStatuses) {
      const agent = this.salesAgents.get(status.salesAgentId);
      const agentName = agent?.name ?? status.salesAgentId;

      if (!bySalesAgent[status.salesAgentId]) {
        bySalesAgent[status.salesAgentId] = {
          name: agentName,
          synced: 0,
          approved: 0,
          rejected: 0,
        };
      }

      if (status.syncStatus === "synced") {
        bySalesAgent[status.salesAgentId].synced++;
      }
      if (status.approvalStatus === "approved") {
        bySalesAgent[status.salesAgentId].approved++;
      }
      if (status.approvalStatus === "rejected") {
        bySalesAgent[status.salesAgentId].rejected++;
      }
    }

    return {
      totalCreatives: uniqueCreatives.size,
      syncedCreatives: syncedCreatives.size,
      approvedCreatives: approvedCreatives.size,
      rejectedCreatives: rejectedCreatives.size,
      failedSyncs,
      byFormat,
      bySalesAgent,
    };
  }

  async cleanupOldSyncStatus(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    const cutoffIso = cutoffDate.toISOString();

    let cleanedCount = 0;

    for (const [key, status] of this.syncStatuses.entries()) {
      if (status.createdAt < cutoffIso) {
        this.syncStatuses.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  // Test helper methods

  /**
   * Add a sales agent for testing
   */
  addSalesAgent(agent: SalesAgentRecord): void {
    this.salesAgents.set(agent.salesAgentId, agent);
  }

  /**
   * Add a tactic for testing
   */
  addTactic(tactic: TacticRecord): void {
    this.tactics.set(tactic.id, tactic);
  }

  /**
   * Clear all data (for test cleanup)
   */
  clear(): void {
    this.syncStatuses.clear();
    this.tactics.clear();
    // Keep default sales agents
    this.salesAgents.clear();
    this.seedDefaultSalesAgents();
    this.nextId = 1;
  }

  /**
   * Get all sync statuses (for testing)
   */
  getAllSyncStatuses(): SyncStatusRecord[] {
    return Array.from(this.syncStatuses.values());
  }
}
