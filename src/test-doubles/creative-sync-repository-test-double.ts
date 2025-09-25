// In-memory test double for CreativeSyncRepository
// Provides fast, deterministic testing without external dependencies

import type {
  CreativeSyncRepository,
  UpdateSyncStatusData,
} from "../contracts/creative-sync-repository.js";
import type {
  CreativeSyncStatus,
  SalesAgentCapabilities,
} from "../types/notifications.js";

interface SalesAgentRecord {
  capabilities: SalesAgentCapabilities;
  name: string;
  salesAgentId: string;
}

interface SyncStatusRecord {
  approvalStatus?: "approved" | "changes_requested" | "pending" | "rejected";
  brandAgentId: number;
  campaignContext?: string;
  createdAt: string;
  creativeId: string;
  id: string;
  lastSyncAttempt?: string;
  rejectionReason?: string;
  requestedChanges?: string[];
  salesAgentId: string;
  syncError?: string;
  syncStatus: "failed" | "not_applicable" | "pending" | "synced" | "syncing";
  tacticContext?: string;
  updatedAt: string;
}

interface TacticRecord {
  brandAgentId: number;
  campaignId: string;
  createdAt: string;
  format: string;
  id: string;
  salesAgentId: string;
  status: string;
}

/**
 * In-memory implementation of CreativeSyncRepository for testing
 * Provides fast, predictable behavior for unit tests and development
 */
export class CreativeSyncRepositoryTestDouble
  implements CreativeSyncRepository
{
  private nextId = 1;
  private salesAgents: Map<string, SalesAgentRecord> = new Map();
  private syncStatuses: Map<string, SyncStatusRecord> = new Map();
  private tactics: Map<string, TacticRecord> = new Map();

  constructor() {
    // Seed with some default sales agents for testing
    this.seedDefaultSalesAgents();
  }

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
    for (const [_tacticId, tactic] of this.tactics.entries()) {
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

  /**
   * Get all sync statuses (for testing)
   */
  getAllSyncStatuses(): SyncStatusRecord[] {
    return Array.from(this.syncStatuses.values());
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

  async getCreativeSyncStatus(
    creativeId: string,
  ): Promise<CreativeSyncStatus[]> {
    if (!creativeId) {
      return [];
    }

    const results: CreativeSyncStatus[] = [];

    for (const [_key, record] of this.syncStatuses.entries()) {
      if (record.creativeId === creativeId) {
        const agent = this.salesAgents.get(record.salesAgentId);

        results.push({
          approvalStatus: record.approvalStatus,
          lastSyncAttempt: record.lastSyncAttempt,
          rejectionReason: record.rejectionReason,
          requestedChanges: record.requestedChanges,
          salesAgentId: record.salesAgentId,
          salesAgentName: agent?.name ?? record.salesAgentId,
          status: record.syncStatus,
        });
      }
    }

    return results.sort((a, b) =>
      a.salesAgentName.localeCompare(b.salesAgentName),
    );
  }

  async getSalesAgentCapabilities(
    salesAgentId: string,
  ): Promise<null | SalesAgentCapabilities> {
    const agent = this.salesAgents.get(salesAgentId);
    return agent ? agent.capabilities : null;
  }

  async getSyncStatistics(
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
    const byFormat: Record<
      string,
      { approved: number; rejected: number; synced: number; total: number }
    > = {};
    const bySalesAgent: Record<
      string,
      { approved: number; name: string; rejected: number; synced: number }
    > = {};

    // Build sales agent summary
    for (const status of filteredStatuses) {
      const agent = this.salesAgents.get(status.salesAgentId);
      const agentName = agent?.name ?? status.salesAgentId;

      if (!bySalesAgent[status.salesAgentId]) {
        bySalesAgent[status.salesAgentId] = {
          approved: 0,
          name: agentName,
          rejected: 0,
          synced: 0,
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
      approvedCreatives: approvedCreatives.size,
      byFormat,
      bySalesAgent,
      failedSyncs,
      rejectedCreatives: rejectedCreatives.size,
      syncedCreatives: syncedCreatives.size,
      totalCreatives: uniqueCreatives.size,
    };
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

  // Test helper methods

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
      !["failed", "not_applicable", "pending", "synced", "syncing"].includes(
        updates.syncStatus,
      )
    ) {
      throw new Error(`Invalid syncStatus: ${updates.syncStatus}`);
    }

    if (
      updates.approvalStatus &&
      !["approved", "changes_requested", "pending", "rejected"].includes(
        updates.approvalStatus,
      )
    ) {
      throw new Error(`Invalid approvalStatus: ${updates.approvalStatus}`);
    }

    const key = this.getKey(creativeId, salesAgentId);
    const now = new Date().toISOString();

    const existing = this.syncStatuses.get(key);

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
        approvalStatus: updates.approvalStatus,
        brandAgentId,
        createdAt: now,
        creativeId,
        id: `sync_${this.nextId++}`,
        lastSyncAttempt: updates.lastSyncAttempt,
        rejectionReason: updates.rejectionReason,
        requestedChanges: updates.requestedChanges,
        salesAgentId,
        syncError: updates.syncError === null ? undefined : updates.syncError,
        syncStatus: updates.syncStatus ?? "pending",
        updatedAt: now,
      };

      this.syncStatuses.set(key, newRecord);
    }
  }

  private getKey(creativeId: string, salesAgentId: string): string {
    return `${creativeId}:${salesAgentId}`;
  }

  private isFormatCompatibleSync(
    creativeFormat: string,
    capabilities: SalesAgentCapabilities,
  ): boolean {
    const formatType = creativeFormat.split("/")[0]?.toLowerCase();

    switch (formatType) {
      case "audio":
        return capabilities.supportsAudio;
      case "ctv":
        return capabilities.supportsCTV;
      case "display":
        return capabilities.supportsDisplay;
      case "native":
        return capabilities.supportsNative;
      case "video":
        return capabilities.supportsVideo;
      default:
        return capabilities.supportsDisplay; // Default fallback
    }
  }

  private seedDefaultSalesAgents(): void {
    const defaultAgents = [
      {
        capabilities: {
          autoApprovalFormats: ["display/banner"],
          salesAgentId: "agent_display_1",
          supportsAudio: false,
          supportsCTV: false,
          supportsDisplay: true,
          supportsNative: true,
          supportsVideo: false,
        } as SalesAgentCapabilities,
        name: "Display Agent 1",
        salesAgentId: "agent_display_1",
      },
      {
        capabilities: {
          autoApprovalFormats: ["video/standard"],
          maxVideoDurationSeconds: 60,
          salesAgentId: "agent_video_1",
          supportsAudio: false,
          supportsCTV: true,
          supportsDisplay: false,
          supportsNative: false,
          supportsVideo: true,
        } as SalesAgentCapabilities,
        name: "Video Agent 1",
        salesAgentId: "agent_video_1",
      },
      {
        capabilities: {
          autoApprovalFormats: ["display/banner", "video/standard"],
          salesAgentId: "agent_multi_1",
          supportsAudio: true,
          supportsCTV: false,
          supportsDisplay: true,
          supportsNative: true,
          supportsVideo: true,
        } as SalesAgentCapabilities,
        name: "Multi-Format Agent",
        salesAgentId: "agent_multi_1",
      },
    ];

    defaultAgents.forEach((agent) => {
      this.salesAgents.set(agent.salesAgentId, agent);
    });
  }
}
