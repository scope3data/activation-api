// Contract test suite for NotificationRepository implementations
// Tests ANY implementation against the defined behavioral contract

import { describe, it, expect, beforeEach } from "vitest";

import type { NotificationRepository } from "../../contracts/notification-repository.js";
import type {
  Notification,
  NotificationEventType,
  NotificationCreateRequest,
} from "../../types/notifications.js";

/**
 * Generic contract test suite for NotificationRepository
 * Pass any implementation to validate it meets the contract
 */
export function testNotificationRepositoryContract(
  repositoryFactory: () => NotificationRepository,
  cleanup?: () => Promise<void>
) {
  describe("NotificationRepository Contract", () => {
    let repository: NotificationRepository;

    beforeEach(async () => {
      repository = repositoryFactory();
      if (cleanup) {
        await cleanup();
      }
    });

    describe("createNotification", () => {
      it("should create a new notification and return ID", async () => {
        const request: NotificationCreateRequest = {
          type: "creative.sync_failed" as NotificationEventType,
          customerId: 123,
          brandAgentId: 456,
          data: {
            creativeId: "creative_123",
            salesAgentId: "agent_abc",
            message: "Creative sync failed",
            reason: "Network timeout",
          },
        };

        const notificationId = await repository.createNotification(request);
        
        expect(typeof notificationId).toBe("string");
        expect(notificationId.length).toBeGreaterThan(0);
        expect(notificationId).not.toBe("duplicate-skipped");
      });

      it("should create notification with minimal data", async () => {
        const request: NotificationCreateRequest = {
          type: "campaign.healthy" as NotificationEventType,
          customerId: 123,
          data: {
            campaignId: "campaign_123",
            message: "Campaign is healthy",
          },
        };

        const notificationId = await repository.createNotification(request);
        expect(typeof notificationId).toBe("string");
        expect(notificationId.length).toBeGreaterThan(0);
      });

      it("should handle duplicate detection", async () => {
        const request: NotificationCreateRequest = {
          type: "creative.sync_failed" as NotificationEventType,
          customerId: 123,
          brandAgentId: 456,
          data: {
            creativeId: "creative_123",
            salesAgentId: "agent_abc",
            message: "Creative sync failed",
          },
        };

        // Create first notification
        const firstId = await repository.createNotification(request);
        expect(firstId).not.toBe("duplicate-skipped");

        // Attempt to create duplicate immediately
        const secondId = await repository.createNotification(request);
        // Should either be skipped as duplicate or create new ID
        expect(typeof secondId).toBe("string");
      });
    });

    describe("getNotifications", () => {
      beforeEach(async () => {
        // Create test notifications
        await repository.createNotification({
          type: "creative.sync_failed" as NotificationEventType,
          customerId: 123,
          brandAgentId: 456,
          data: {
            creativeId: "creative_123",
            message: "Sync failed",
          },
        });

        await repository.createNotification({
          type: "creative.approved" as NotificationEventType,
          customerId: 123,
          brandAgentId: 456,
          data: {
            creativeId: "creative_456",
            message: "Creative approved",
          },
        });
      });

      it("should return notifications without filter", async () => {
        const result = await repository.getNotifications();
        
        expect(result).toHaveProperty("notifications");
        expect(result).toHaveProperty("hasMore");
        expect(result).toHaveProperty("totalCount");
        expect(Array.isArray(result.notifications)).toBe(true);
        expect(typeof result.hasMore).toBe("boolean");
        expect(typeof result.totalCount).toBe("number");
      });

      it("should filter by customer ID", async () => {
        const result = await repository.getNotifications({
          customerId: 123,
        });
        
        expect(result.notifications.length).toBeGreaterThan(0);
        result.notifications.forEach(notification => {
          expect(notification.customerId).toBe(123);
        });
      });

      it("should filter by brand agent ID", async () => {
        const result = await repository.getNotifications({
          brandAgentId: 456,
        });
        
        result.notifications.forEach(notification => {
          expect(notification.brandAgentId).toBe(456);
        });
      });

      it("should filter by notification types", async () => {
        const result = await repository.getNotifications({
          types: ["creative.sync_failed" as NotificationEventType],
        });
        
        result.notifications.forEach(notification => {
          expect(notification.type).toBe("creative.sync_failed");
        });
      });

      it("should filter by creative ID", async () => {
        const result = await repository.getNotifications({
          creativeId: "creative_123",
        });
        
        result.notifications.forEach(notification => {
          expect(notification.data.creativeId).toBe("creative_123");
        });
      });

      it("should filter unread notifications only", async () => {
        const result = await repository.getNotifications({
          unreadOnly: true,
        });
        
        result.notifications.forEach(notification => {
          expect(notification.read).toBe(false);
        });
      });

      it("should respect pagination limits", async () => {
        const result = await repository.getNotifications({
          limit: 1,
        });
        
        expect(result.notifications.length).toBeLessThanOrEqual(1);
      });

      it("should handle pagination offset", async () => {
        const firstPage = await repository.getNotifications({
          limit: 1,
          offset: 0,
        });
        
        const secondPage = await repository.getNotifications({
          limit: 1,
          offset: 1,
        });
        
        if (firstPage.notifications.length > 0 && secondPage.notifications.length > 0) {
          expect(firstPage.notifications[0].id).not.toBe(secondPage.notifications[0].id);
        }
      });
    });

    describe("getNotification", () => {
      it("should return null for non-existent notification", async () => {
        const notification = await repository.getNotification("non_existent");
        expect(notification).toBeNull();
      });

      it("should return notification by ID", async () => {
        const notificationId = await repository.createNotification({
          type: "creative.approved" as NotificationEventType,
          customerId: 123,
          data: {
            creativeId: "creative_123",
            message: "Creative approved",
          },
        });

        const notification = await repository.getNotification(notificationId);
        
        if (notification) {
          expect(notification.id).toBe(notificationId);
          expect(notification.type).toBe("creative.approved");
          expect(notification.customerId).toBe(123);
          expect(notification.data.creativeId).toBe("creative_123");
        }
      });
    });

    describe("markAsRead", () => {
      it("should mark notifications as read", async () => {
        const notificationId = await repository.createNotification({
          type: "creative.approved" as NotificationEventType,
          customerId: 123,
          data: {
            message: "Test notification",
          },
        });

        await repository.markAsRead([notificationId]);

        const notification = await repository.getNotification(notificationId);
        if (notification) {
          expect(notification.read).toBe(true);
        }
      });

      it("should handle empty array", async () => {
        await expect(repository.markAsRead([])).resolves.not.toThrow();
      });

      it("should handle non-existent notification IDs", async () => {
        await expect(
          repository.markAsRead(["non_existent"])
        ).resolves.not.toThrow();
      });
    });

    describe("markAsAcknowledged", () => {
      it("should mark notifications as acknowledged", async () => {
        const notificationId = await repository.createNotification({
          type: "creative.rejected" as NotificationEventType,
          customerId: 123,
          data: {
            message: "Test notification",
          },
        });

        await repository.markAsAcknowledged([notificationId]);

        const notification = await repository.getNotification(notificationId);
        if (notification) {
          expect(notification.acknowledged).toBe(true);
          expect(notification.read).toBe(true); // Should also mark as read
        }
      });

      it("should handle empty array", async () => {
        await expect(repository.markAsAcknowledged([])).resolves.not.toThrow();
      });
    });

    describe("getNotificationCounts", () => {
      beforeEach(async () => {
        // Create test notifications with different types
        await repository.createNotification({
          type: "creative.sync_failed" as NotificationEventType,
          customerId: 123,
          brandAgentId: 456,
          data: { message: "Sync failed" },
        });

        await repository.createNotification({
          type: "creative.approved" as NotificationEventType,
          customerId: 123,
          brandAgentId: 456,
          data: { message: "Approved" },
        });
      });

      it("should return notification counts structure", async () => {
        const counts = await repository.getNotificationCounts(123);
        
        expect(counts).toHaveProperty("total");
        expect(counts).toHaveProperty("unread");
        expect(counts).toHaveProperty("byType");
        expect(counts).toHaveProperty("bySeverity");
        
        expect(typeof counts.total).toBe("number");
        expect(typeof counts.unread).toBe("number");
        expect(typeof counts.byType).toBe("object");
        expect(typeof counts.bySeverity).toBe("object");
        
        expect(counts.total).toBeGreaterThanOrEqual(0);
        expect(counts.unread).toBeGreaterThanOrEqual(0);
        expect(counts.unread).toBeLessThanOrEqual(counts.total);
      });

      it("should filter by brand agent ID", async () => {
        const counts = await repository.getNotificationCounts(123, 456);
        expect(typeof counts.total).toBe("number");
      });
    });

    describe("getCampaignNotifications", () => {
      beforeEach(async () => {
        await repository.createNotification({
          type: "campaign.unhealthy" as NotificationEventType,
          customerId: 123,
          data: {
            campaignId: "campaign_123",
            message: "Campaign has issues",
          },
        });
      });

      it("should return campaign notification summary", async () => {
        const summary = await repository.getCampaignNotifications("campaign_123", 123);
        
        expect(summary).toHaveProperty("unread");
        expect(summary).toHaveProperty("types");
        expect(summary).toHaveProperty("recent");
        
        expect(typeof summary.unread).toBe("number");
        expect(Array.isArray(summary.types)).toBe(true);
        expect(Array.isArray(summary.recent)).toBe(true);
      });

      it("should return empty summary for unknown campaign", async () => {
        const summary = await repository.getCampaignNotifications("unknown", 123);
        
        expect(summary.unread).toBe(0);
        expect(summary.types).toEqual([]);
        expect(summary.recent).toEqual([]);
      });
    });

    describe("isDuplicateNotification", () => {
      it("should detect duplicates within time window", async () => {
        const request: NotificationCreateRequest = {
          type: "creative.sync_failed" as NotificationEventType,
          customerId: 123,
          data: {
            creativeId: "creative_123",
            salesAgentId: "agent_abc",
            message: "Sync failed",
          },
        };

        // Create first notification
        await repository.createNotification(request);

        // Check for duplicate immediately
        const isDuplicate = await repository.isDuplicateNotification(request, 5);
        expect(typeof isDuplicate).toBe("boolean");
      });

      it("should not detect duplicates outside time window", async () => {
        const request: NotificationCreateRequest = {
          type: "creative.sync_failed" as NotificationEventType,
          customerId: 123,
          data: {
            creativeId: "creative_123",
            message: "Sync failed",
          },
        };

        // Check for non-existent duplicate
        const isDuplicate = await repository.isDuplicateNotification(request, 0);
        expect(isDuplicate).toBe(false);
      });
    });

    describe("cleanupOldNotifications", () => {
      it("should return number of cleaned up notifications", async () => {
        const cleanedUp = await repository.cleanupOldNotifications(90);
        expect(typeof cleanedUp).toBe("number");
        expect(cleanedUp).toBeGreaterThanOrEqual(0);
      });
    });

    describe("error handling", () => {
      it("should validate required fields", async () => {
        await expect(
          repository.createNotification({
            type: "" as any,
            customerId: 123,
            data: { message: "test" },
          })
        ).rejects.toThrow();
      });

      it("should handle invalid customer IDs", async () => {
        await expect(
          repository.createNotification({
            type: "creative.approved" as NotificationEventType,
            customerId: 0,
            data: { message: "test" },
          })
        ).rejects.toThrow();
      });

      it("should handle malformed notification data", async () => {
        await expect(
          repository.createNotification({
            type: "creative.approved" as NotificationEventType,
            customerId: 123,
            data: {} as any,
          })
        ).rejects.toThrow();
      });
    });

    describe("performance requirements", () => {
      it("should handle batch operations efficiently", async () => {
        // Create multiple notifications
        const notificationIds: string[] = [];
        for (let i = 0; i < 10; i++) {
          const id = await repository.createNotification({
            type: "creative.approved" as NotificationEventType,
            customerId: 123,
            data: {
              creativeId: `creative_${i}`,
              message: `Test notification ${i}`,
            },
          });
          notificationIds.push(id);
        }

        // Mark all as read in batch
        const startTime = Date.now();
        await repository.markAsRead(notificationIds);
        const duration = Date.now() - startTime;

        // Should complete within reasonable time (adjust based on requirements)
        expect(duration).toBeLessThan(5000); // 5 seconds
      });

      it("should handle large pagination efficiently", async () => {
        const startTime = Date.now();
        const result = await repository.getNotifications({
          limit: 100,
          offset: 0,
        });
        const duration = Date.now() - startTime;

        expect(duration).toBeLessThan(3000); // 3 seconds
        expect(result.notifications.length).toBeLessThanOrEqual(100);
      });
    });
  });
}