// In-memory test double for NotificationRepository
// Provides fast, deterministic testing without external dependencies

import type { NotificationRepository } from "../contracts/notification-repository.js";
import type {
  Notification,
  NotificationCreateRequest,
  NotificationData,
  NotificationEventType,
  NotificationFilter,
  NotificationListResponse,
} from "../types/notifications.js";

interface NotificationRecord {
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  brandAgentId?: number;
  createdAt: string;
  customerId: number;
  data: NotificationData;
  expiresAt?: string;
  id: string;
  priority: "immediate" | "low" | "normal";
  read: boolean;
  type: NotificationEventType;
  updatedAt: string;
}

/**
 * In-memory implementation of NotificationRepository for testing
 * Provides fast, predictable behavior for unit tests and development
 */
export class NotificationRepositoryTestDouble
  implements NotificationRepository
{
  private nextId = 1;
  private notifications: Map<string, NotificationRecord> = new Map();

  /**
   * Add a notification directly (for test setup)
   */
  addNotification(
    notification: {
      customerId: number;
      data: NotificationData;
      type: NotificationEventType;
    } & Partial<NotificationRecord>,
  ): string {
    const id = notification.id || this.generateId();
    const now = new Date().toISOString();

    const fullNotification: NotificationRecord = {
      acknowledged: notification.acknowledged || false,
      acknowledgedAt: notification.acknowledgedAt,
      acknowledgedBy: notification.acknowledgedBy,
      brandAgentId: notification.brandAgentId,
      createdAt: notification.createdAt || now,
      customerId: notification.customerId,
      data: notification.data,
      expiresAt: notification.expiresAt,
      id,
      priority: notification.priority || "normal",
      read: notification.read || false,
      type: notification.type,
      updatedAt: notification.updatedAt || now,
    };

    this.notifications.set(id, fullNotification);
    return id;
  }

  async batchUpdateNotificationStatus(
    updates: Array<{
      acknowledged?: boolean;
      notificationId: string;
      read?: boolean;
    }>,
  ): Promise<void> {
    const now = new Date().toISOString();

    for (const update of updates) {
      const notification = this.notifications.get(update.notificationId);
      if (notification) {
        if (update.read !== undefined) {
          notification.read = update.read;
        }
        if (update.acknowledged !== undefined) {
          notification.acknowledged = update.acknowledged;
          if (update.acknowledged) {
            notification.acknowledgedAt = now;
            notification.read = true; // Acknowledged implies read
          }
        }
        notification.updatedAt = now;
      }
    }
  }

  async cleanupOldNotifications(keepLastDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - keepLastDays);
    const cutoffIso = cutoffDate.toISOString();

    let cleanedCount = 0;

    for (const [id, notification] of this.notifications.entries()) {
      if (notification.createdAt < cutoffIso) {
        this.notifications.delete(id);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Clear all notifications (for test cleanup)
   */
  clear(): void {
    this.notifications.clear();
    this.nextId = 1;
  }

  async createNotification(
    request: NotificationCreateRequest,
  ): Promise<string> {
    if (!request.type || !request.customerId) {
      throw new Error("type and customerId are required");
    }

    if (!request.data || !request.data.message) {
      throw new Error("data.message is required");
    }

    if (request.customerId <= 0) {
      throw new Error("customerId must be positive");
    }

    // Check for duplicates
    const isDuplicate = await this.isDuplicateNotification(request, 5);
    if (isDuplicate) {
      return "duplicate-skipped";
    }

    const now = new Date().toISOString();
    const notificationId = this.generateId();

    const notification: NotificationRecord = {
      acknowledged: false,
      brandAgentId: request.brandAgentId,
      createdAt: now,
      customerId: request.customerId,
      data: { ...request.data },
      id: notificationId,
      priority: "normal", // Default priority
      read: false,
      type: request.type,
      updatedAt: now,
    };

    this.notifications.set(notificationId, notification);
    return notificationId;
  }

  /**
   * Get all notifications (for testing)
   */
  getAllNotifications(): NotificationRecord[] {
    return Array.from(this.notifications.values());
  }

  async getCampaignNotifications(
    campaignId: string,
    customerId: number,
  ): Promise<{
    recent: Notification[];
    types: NotificationEventType[];
    unread: number;
  }> {
    const campaignNotifications = Array.from(
      this.notifications.values(),
    ).filter(
      (n) => n.customerId === customerId && n.data.campaignId === campaignId,
    );

    const unread = campaignNotifications.filter((n) => !n.read).length;
    const types = [...new Set(campaignNotifications.map((n) => n.type))];

    // Get 5 most recent notifications
    const recent: Notification[] = campaignNotifications
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map((record) => ({
        acknowledged: record.acknowledged,
        brandAgentId: record.brandAgentId,
        customerId: record.customerId,
        data: record.data,
        id: record.id,
        read: record.read,
        timestamp: record.createdAt,
        type: record.type,
      }));

    return {
      recent,
      types,
      unread,
    };
  }

  async getNotification(notificationId: string): Promise<Notification | null> {
    const record = this.notifications.get(notificationId);
    if (!record) {
      return null;
    }

    return {
      acknowledged: record.acknowledged,
      brandAgentId: record.brandAgentId,
      customerId: record.customerId,
      data: record.data,
      id: record.id,
      read: record.read,
      timestamp: record.createdAt,
      type: record.type,
    };
  }

  async getNotificationCounts(
    customerId: number,
    brandAgentId?: number,
  ): Promise<{
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    total: number;
    unread: number;
  }> {
    let filteredNotifications = Array.from(this.notifications.values()).filter(
      (n) => n.customerId === customerId,
    );

    if (brandAgentId) {
      filteredNotifications = filteredNotifications.filter(
        (n) => n.brandAgentId === brandAgentId,
      );
    }

    const total = filteredNotifications.length;
    const unread = filteredNotifications.filter((n) => !n.read).length;

    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};

    for (const notification of filteredNotifications) {
      // Count by type
      byType[notification.type] = (byType[notification.type] || 0) + 1;

      // Count by severity (simplified mapping)
      const severity = this.getSeverityFromType(notification.type);
      bySeverity[severity] = (bySeverity[severity] || 0) + 1;
    }

    return {
      bySeverity,
      byType,
      total,
      unread,
    };
  }

  async getNotifications(
    filter?: NotificationFilter,
  ): Promise<NotificationListResponse> {
    let filteredNotifications = Array.from(this.notifications.values());

    // Apply filters
    if (filter?.customerId) {
      filteredNotifications = filteredNotifications.filter(
        (n) => n.customerId === filter.customerId,
      );
    }

    if (filter?.brandAgentId) {
      filteredNotifications = filteredNotifications.filter(
        (n) => n.brandAgentId === filter.brandAgentId,
      );
    }

    if (filter?.types && filter.types.length > 0) {
      filteredNotifications = filteredNotifications.filter((n) =>
        filter.types!.includes(n.type),
      );
    }

    if (filter?.creativeId) {
      filteredNotifications = filteredNotifications.filter(
        (n) => n.data.creativeId === filter.creativeId,
      );
    }

    if (filter?.campaignId) {
      filteredNotifications = filteredNotifications.filter(
        (n) => n.data.campaignId === filter.campaignId,
      );
    }

    if (filter?.unreadOnly) {
      filteredNotifications = filteredNotifications.filter((n) => !n.read);
    }

    // Sort by creation date (newest first)
    filteredNotifications.sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    const totalCount = filteredNotifications.length;
    const offset = filter?.offset || 0;
    const limit = filter?.limit || 50;

    // Apply pagination
    const paginatedNotifications = filteredNotifications.slice(
      offset,
      offset + limit,
    );
    const hasMore = offset + limit < totalCount;

    // Convert to response format
    const notifications: Notification[] = paginatedNotifications.map(
      (record) => ({
        acknowledged: record.acknowledged,
        brandAgentId: record.brandAgentId,
        customerId: record.customerId,
        data: record.data,
        id: record.id,
        read: record.read,
        timestamp: record.createdAt,
        type: record.type,
      }),
    );

    return {
      hasMore,
      notifications,
      totalCount,
    };
  }

  async getNotificationsByResource(
    resourceType: "campaign" | "creative" | "sales_agent" | "tactic",
    resourceId: string,
    customerId: number,
  ): Promise<Notification[]> {
    const resourceNotifications = Array.from(
      this.notifications.values(),
    ).filter((n) => {
      if (n.customerId !== customerId) return false;

      switch (resourceType) {
        case "campaign":
          return n.data.campaignId === resourceId;
        case "creative":
          return n.data.creativeId === resourceId;
        case "sales_agent":
          return n.data.salesAgentId === resourceId;
        case "tactic":
          return n.data.tacticId === resourceId;
        default:
          return false;
      }
    });

    return resourceNotifications.map((record) => ({
      acknowledged: record.acknowledged,
      brandAgentId: record.brandAgentId,
      customerId: record.customerId,
      data: record.data,
      id: record.id,
      read: record.read,
      timestamp: record.createdAt,
      type: record.type,
    }));
  }

  async getNotificationStatistics(
    customerId: number,
    options?: {
      brandAgentId?: number;
      dateRange?: {
        end: string;
        start: string;
      };
    },
  ): Promise<{
    acknowledgmentRate: number;
    byDay: Array<{
      count: number;
      date: string;
      types: Record<string, number>;
    }>;
    byType: Record<
      string,
      {
        avgTimeToAcknowledge: number;
        avgTimeToRead: number;
        count: number;
        readRate: number;
      }
    >;
    readRate: number;
    totalNotifications: number;
  }> {
    let filteredNotifications = Array.from(this.notifications.values()).filter(
      (n) => n.customerId === customerId,
    );

    if (options?.brandAgentId) {
      filteredNotifications = filteredNotifications.filter(
        (n) => n.brandAgentId === options.brandAgentId,
      );
    }

    if (options?.dateRange) {
      filteredNotifications = filteredNotifications.filter(
        (n) =>
          n.createdAt >= options.dateRange!.start &&
          n.createdAt <= options.dateRange!.end,
      );
    }

    const totalNotifications = filteredNotifications.length;
    const readNotifications = filteredNotifications.filter(
      (n) => n.read,
    ).length;
    const acknowledgedNotifications = filteredNotifications.filter(
      (n) => n.acknowledged,
    ).length;

    const readRate =
      totalNotifications > 0 ? readNotifications / totalNotifications : 0;
    const acknowledgmentRate =
      totalNotifications > 0
        ? acknowledgedNotifications / totalNotifications
        : 0;

    // Build type statistics
    const byType: Record<
      string,
      {
        avgTimeToAcknowledge: number;
        avgTimeToRead: number;
        count: number;
        readRate: number;
      }
    > = {};

    const typeGroups: Record<string, NotificationRecord[]> = {};
    for (const notification of filteredNotifications) {
      if (!typeGroups[notification.type]) {
        typeGroups[notification.type] = [];
      }
      typeGroups[notification.type].push(notification);
    }

    for (const [type, notifications] of Object.entries(typeGroups)) {
      const count = notifications.length;
      const readCount = notifications.filter((n) => n.read).length;
      const readRate = count > 0 ? readCount / count : 0;

      byType[type] = {
        avgTimeToAcknowledge: 0, // Simplified for test double
        avgTimeToRead: 0, // Simplified for test double
        count,
        readRate,
      };
    }

    // Build daily statistics
    const byDay: Array<{
      count: number;
      date: string;
      types: Record<string, number>;
    }> = [];

    const dailyGroups: Record<string, NotificationRecord[]> = {};
    for (const notification of filteredNotifications) {
      const date = notification.createdAt.split("T")[0];
      if (!dailyGroups[date]) {
        dailyGroups[date] = [];
      }
      dailyGroups[date].push(notification);
    }

    for (const [date, notifications] of Object.entries(dailyGroups)) {
      const types: Record<string, number> = {};
      for (const notification of notifications) {
        types[notification.type] = (types[notification.type] || 0) + 1;
      }

      byDay.push({
        count: notifications.length,
        date,
        types,
      });
    }

    byDay.sort((a, b) => a.date.localeCompare(b.date));

    return {
      acknowledgmentRate,
      byDay,
      byType,
      readRate,
      totalNotifications,
    };
  }

  async isDuplicateNotification(
    request: NotificationCreateRequest,
    windowMinutes: number = 5,
  ): Promise<boolean> {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - windowMinutes);
    const cutoffIso = cutoffTime.toISOString();

    for (const notification of this.notifications.values()) {
      if (
        notification.createdAt >= cutoffIso &&
        notification.type === request.type &&
        notification.customerId === request.customerId &&
        notification.brandAgentId === request.brandAgentId &&
        notification.data.creativeId === request.data.creativeId &&
        notification.data.salesAgentId === request.data.salesAgentId
      ) {
        return true;
      }
    }

    return false;
  }

  async markAsAcknowledged(notificationIds: string[]): Promise<void> {
    const now = new Date().toISOString();

    for (const id of notificationIds) {
      const notification = this.notifications.get(id);
      if (notification) {
        notification.read = true;
        notification.acknowledged = true;
        notification.acknowledgedAt = now;
        notification.updatedAt = now;
      }
    }
  }

  // Test helper methods

  async markAsRead(notificationIds: string[]): Promise<void> {
    const now = new Date().toISOString();

    for (const id of notificationIds) {
      const notification = this.notifications.get(id);
      if (notification) {
        notification.read = true;
        notification.updatedAt = now;
      }
    }
  }

  private generateId(): string {
    return `notif_${Date.now()}_${this.nextId++}`;
  }

  private getSeverityFromType(type: NotificationEventType): string {
    // Simplified severity mapping for test double
    if (type.includes("failed") || type.includes("rejected")) {
      return "error";
    }
    if (type.includes("unhealthy") || type.includes("missing")) {
      return "warning";
    }
    if (type.includes("approved") || type.includes("completed")) {
      return "info";
    }
    return "normal";
  }
}
