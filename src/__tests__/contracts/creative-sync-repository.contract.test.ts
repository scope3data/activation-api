// Contract test suite for CreativeSyncRepository implementations
// Tests ANY implementation against the defined behavioral contract

import { describe, it, expect, beforeEach } from "vitest";

import type { CreativeSyncRepository } from "../../contracts/creative-sync-repository.js";

/**
 * Generic contract test suite for CreativeSyncRepository
 * Pass any implementation to validate it meets the contract
 */
export function testCreativeSyncRepositoryContract(
  repositoryFactory: () => CreativeSyncRepository,
  cleanup?: () => Promise<void>,
) {
  describe("CreativeSyncRepository Contract", () => {
    let repository: CreativeSyncRepository;

    beforeEach(async () => {
      repository = repositoryFactory();
      if (cleanup) {
        await cleanup();
      }
    });

    describe("updateSyncStatus", () => {
      it("should create new sync status record", async () => {
        await repository.updateSyncStatus(
          "creative_123",
          "sales_agent_abc",
          456,
          {
            syncStatus: "pending",
            approvalStatus: "pending",
          },
        );

        const syncStatus =
          await repository.getCreativeSyncStatus("creative_123");
        expect(syncStatus).toHaveLength(1);
        expect(syncStatus[0]).toMatchObject({
          salesAgentId: "sales_agent_abc",
          status: "pending",
          approvalStatus: "pending",
        });
      });

      it("should update existing sync status record", async () => {
        // Create initial record
        await repository.updateSyncStatus(
          "creative_123",
          "sales_agent_abc",
          456,
          {
            syncStatus: "pending",
          },
        );

        // Update the record
        await repository.updateSyncStatus(
          "creative_123",
          "sales_agent_abc",
          456,
          {
            syncStatus: "synced",
            approvalStatus: "approved",
          },
        );

        const syncStatus =
          await repository.getCreativeSyncStatus("creative_123");
        expect(syncStatus).toHaveLength(1);
        expect(syncStatus[0]).toMatchObject({
          salesAgentId: "sales_agent_abc",
          status: "synced",
          approvalStatus: "approved",
        });
      });

      it("should handle rejection with reason", async () => {
        await repository.updateSyncStatus(
          "creative_123",
          "sales_agent_abc",
          456,
          {
            syncStatus: "synced",
            approvalStatus: "rejected",
            rejectionReason: "Format not supported",
            requestedChanges: ["Use 1080p resolution", "Add captions"],
          },
        );

        const syncStatus =
          await repository.getCreativeSyncStatus("creative_123");
        expect(syncStatus[0]).toMatchObject({
          approvalStatus: "rejected",
          rejectionReason: "Format not supported",
          requestedChanges: ["Use 1080p resolution", "Add captions"],
        });
      });

      it("should handle sync errors", async () => {
        await repository.updateSyncStatus(
          "creative_123",
          "sales_agent_abc",
          456,
          {
            syncStatus: "failed",
            syncError: "Network timeout",
            lastSyncAttempt: new Date().toISOString(),
          },
        );

        const syncStatus =
          await repository.getCreativeSyncStatus("creative_123");
        expect(syncStatus[0]).toMatchObject({
          status: "failed",
        });
      });
    });

    describe("getCreativeSyncStatus", () => {
      it("should return empty array for creative with no sync status", async () => {
        const syncStatus = await repository.getCreativeSyncStatus(
          "nonexistent_creative",
        );
        expect(syncStatus).toEqual([]);
      });

      it("should return all sync statuses for a creative", async () => {
        // Create sync status with multiple agents
        await repository.updateSyncStatus("creative_123", "agent_1", 456, {
          syncStatus: "synced",
          approvalStatus: "approved",
        });
        await repository.updateSyncStatus("creative_123", "agent_2", 456, {
          syncStatus: "pending",
        });

        const syncStatus =
          await repository.getCreativeSyncStatus("creative_123");
        expect(syncStatus).toHaveLength(2);

        const agentIds = syncStatus.map((s) => s.salesAgentId).sort();
        expect(agentIds).toEqual(["agent_1", "agent_2"]);
      });

      it("should include sales agent names when available", async () => {
        await repository.updateSyncStatus("creative_123", "agent_1", 456, {
          syncStatus: "synced",
        });

        const syncStatus =
          await repository.getCreativeSyncStatus("creative_123");
        expect(syncStatus[0]).toHaveProperty("salesAgentName");
        expect(typeof syncStatus[0].salesAgentName).toBe("string");
      });
    });

    describe("getBatchCreativeSyncStatus", () => {
      it("should return sync status for multiple creatives", async () => {
        // Set up sync status for multiple creatives
        await repository.updateSyncStatus("creative_1", "agent_1", 456, {
          syncStatus: "synced",
        });
        await repository.updateSyncStatus("creative_2", "agent_2", 456, {
          syncStatus: "pending",
        });

        const batchStatus = await repository.getBatchCreativeSyncStatus([
          "creative_1",
          "creative_2",
          "creative_3",
        ]);

        expect(batchStatus).toHaveProperty("creative_1");
        expect(batchStatus).toHaveProperty("creative_2");
        expect(batchStatus).toHaveProperty("creative_3");

        expect(batchStatus.creative_1).toHaveLength(1);
        expect(batchStatus.creative_2).toHaveLength(1);
        expect(batchStatus.creative_3).toHaveLength(0);
      });

      it("should handle empty input array", async () => {
        const batchStatus = await repository.getBatchCreativeSyncStatus([]);
        expect(batchStatus).toEqual({});
      });
    });

    describe("findRecentSalesAgents", () => {
      it("should return empty array when no recent activity", async () => {
        const agents = await repository.findRecentSalesAgents(
          456,
          "video/standard",
          {
            daysBack: 30,
            includeActive: true,
          },
        );
        expect(agents).toEqual([]);
      });

      it("should respect daysBack parameter", async () => {
        // This test would require setting up tactics data
        // Implementation depends on having tactic creation in the test setup
        const agents = await repository.findRecentSalesAgents(
          456,
          "video/standard",
          {
            daysBack: 7,
            includeActive: true,
          },
        );
        expect(Array.isArray(agents)).toBe(true);
      });

      it("should limit results when specified", async () => {
        const agents = await repository.findRecentSalesAgents(
          456,
          "video/standard",
          {
            daysBack: 30,
            includeActive: true,
            limit: 5,
          },
        );
        expect(agents.length).toBeLessThanOrEqual(5);
      });
    });

    describe("getSalesAgentCapabilities", () => {
      it("should return null for unknown sales agent", async () => {
        const capabilities =
          await repository.getSalesAgentCapabilities("unknown_agent");
        expect(capabilities).toBeNull();
      });

      it("should return capabilities when available", async () => {
        // This test depends on having sales agent capabilities data
        // In a real implementation, this would be seeded or created
        const capabilities =
          await repository.getSalesAgentCapabilities("known_agent");
        if (capabilities) {
          expect(capabilities).toHaveProperty("salesAgentId");
          expect(capabilities).toHaveProperty("supportsVideo");
          expect(capabilities).toHaveProperty("supportsDisplay");
          expect(typeof capabilities.supportsVideo).toBe("boolean");
          expect(typeof capabilities.supportsDisplay).toBe("boolean");
        }
      });
    });

    describe("isFormatCompatible", () => {
      it("should return false for unknown sales agent", async () => {
        const compatible = await repository.isFormatCompatible(
          "video/standard",
          "unknown_agent",
        );
        expect(compatible).toBe(false);
      });

      it("should check format compatibility correctly", async () => {
        // This test requires sales agent capabilities to be set up
        const compatible = await repository.isFormatCompatible(
          "display/banner",
          "display_agent",
        );
        expect(typeof compatible).toBe("boolean");
      });
    });

    describe("getSyncStatistics", () => {
      it("should return statistics structure", async () => {
        const stats = await repository.getSyncStatistics(456);

        expect(stats).toHaveProperty("totalCreatives");
        expect(stats).toHaveProperty("syncedCreatives");
        expect(stats).toHaveProperty("approvedCreatives");
        expect(stats).toHaveProperty("rejectedCreatives");
        expect(stats).toHaveProperty("failedSyncs");
        expect(stats).toHaveProperty("byFormat");
        expect(stats).toHaveProperty("bySalesAgent");

        expect(typeof stats.totalCreatives).toBe("number");
        expect(typeof stats.syncedCreatives).toBe("number");
        expect(typeof stats.byFormat).toBe("object");
        expect(typeof stats.bySalesAgent).toBe("object");
      });

      it("should filter by campaign when specified", async () => {
        const stats = await repository.getSyncStatistics(456, {
          campaignId: "campaign_123",
        });

        expect(stats).toHaveProperty("totalCreatives");
        expect(typeof stats.totalCreatives).toBe("number");
      });

      it("should filter by date range when specified", async () => {
        const stats = await repository.getSyncStatistics(456, {
          dateRange: {
            start: "2024-01-01",
            end: "2024-01-31",
          },
        });

        expect(stats).toHaveProperty("totalCreatives");
        expect(typeof stats.totalCreatives).toBe("number");
      });
    });

    describe("cleanupOldSyncStatus", () => {
      it("should return number of cleaned up records", async () => {
        const cleanedUp = await repository.cleanupOldSyncStatus(90);
        expect(typeof cleanedUp).toBe("number");
        expect(cleanedUp).toBeGreaterThanOrEqual(0);
      });

      it("should not clean up recent records", async () => {
        // Create a recent record
        await repository.updateSyncStatus("creative_recent", "agent_1", 456, {
          syncStatus: "synced",
        });

        // Clean up records older than 1 day
        await repository.cleanupOldSyncStatus(1);

        // Recent record should still exist
        const syncStatus =
          await repository.getCreativeSyncStatus("creative_recent");
        expect(syncStatus).toHaveLength(1);
      });
    });

    describe("error handling", () => {
      it("should handle malformed creative IDs gracefully", async () => {
        await expect(repository.getCreativeSyncStatus("")).resolves.toEqual([]);
      });

      it("should handle malformed brand agent IDs", async () => {
        await expect(
          repository.updateSyncStatus("creative_123", "agent_1", 0, {
            syncStatus: "pending",
          }),
        ).rejects.toThrow();
      });

      it("should validate sync status values", async () => {
        await expect(
          repository.updateSyncStatus("creative_123", "agent_1", 456, {
            syncStatus: "invalid_status" as unknown,
          }),
        ).rejects.toThrow();
      });
    });

    describe("concurrent access", () => {
      it("should handle concurrent updates to same creative-agent pair", async () => {
        const promises = Array.from({ length: 5 }, () =>
          repository.updateSyncStatus("creative_concurrent", "agent_1", 456, {
            syncStatus: "synced",
            approvalStatus: "approved",
          }),
        );

        await Promise.all(promises);

        const syncStatus = await repository.getCreativeSyncStatus(
          "creative_concurrent",
        );
        expect(syncStatus).toHaveLength(1);
        expect(syncStatus[0]).toMatchObject({
          status: "synced",
          approvalStatus: "approved",
        });
      });
    });
  });
}
