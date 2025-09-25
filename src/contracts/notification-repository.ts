// Contract interface for notification operations
// Ensures all implementations provide consistent behavior

import type {
  Notification,
  NotificationCreateRequest,
  NotificationData,
  NotificationEventType,
  NotificationFilter,
  NotificationListResponse,
} from "../types/notifications.js";

/**
 * Input interfaces for notification operations
 */
export interface CreateNotificationData {
  brandAgentId?: number;
  customerId: number;
  data: NotificationData;
  expiresAt?: string;
  priority?: "immediate" | "low" | "normal";
  type: NotificationEventType;
}

export interface NotificationAnalytics {
  acknowledgedNotifications: number;
  actionableInsights: Array<{
    affectedTypes: NotificationEventType[];
    description: string;
    recommendation: string;
    type: "delayed_acknowledgment" | "high_unread_rate" | "notification_flood";
  }>;
  averageAcknowledgeTime: number; // minutes
  averageReadTime: number; // minutes
  timeSeriesData: Array<{
    acknowledged: number;
    count: number;
    date: string;
    unread: number;
  }>;

  totalNotifications: number;

  typeBreakdown: Record<
    NotificationEventType,
    {
      averageAcknowledgeTime: number;
      averageReadTime: number;
      count: number;
      percentage: number;
    }
  >;

  unreadNotifications: number;
}

/**
 * Response types for notification operations
 */
export interface NotificationOperationResult {
  error?: string;
  metadata?: {
    duplicatesSkipped: number;
    totalFailed: number;
    totalProcessed: number;
    totalSuccessful: number;
  };
  notificationIds: string[];
  success: boolean;
}

export interface NotificationQuery {
  acknowledged?: boolean;
  brandAgentId?: number;
  customerId: number;
  dateRange?: {
    end: string;
    start: string;
  };
  limit?: number;
  offset?: number;
  orderBy?: "created_at" | "priority" | "type";
  orderDirection?: "asc" | "desc";
  priority?: string[];
  read?: boolean;
  resourceId?: string;
  resourceType?: "campaign" | "creative" | "sales_agent" | "tactic";
  types?: NotificationEventType[];
}

/**
 * Repository contract for notification operations
 * Any backend implementation (BigQuery, PostgreSQL, etc.) must satisfy this interface
 */
export interface NotificationRepository {
  /**
   * Batch update notification status
   */
  batchUpdateNotificationStatus(
    updates: Array<{
      acknowledged?: boolean;
      notificationId: string;
      read?: boolean;
    }>,
  ): Promise<void>;

  /**
   * Clean up old notifications (keep last N days)
   */
  cleanupOldNotifications(keepLastDays: number): Promise<number>;

  /**
   * Create a new notification
   */
  createNotification(request: NotificationCreateRequest): Promise<string>;

  /**
   * Get campaign-specific notification summary
   */
  getCampaignNotifications(
    campaignId: string,
    customerId: number,
  ): Promise<{
    recent: Notification[];
    types: NotificationEventType[];
    unread: number;
  }>;

  /**
   * Get a single notification by ID
   */
  getNotification(notificationId: string): Promise<Notification | null>;

  /**
   * Get notification counts for overview displays
   */
  getNotificationCounts(
    customerId: number,
    brandAgentId?: number,
  ): Promise<{
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    total: number;
    unread: number;
  }>;

  /**
   * Get notifications with filtering and pagination
   */
  getNotifications(
    filter?: NotificationFilter,
  ): Promise<NotificationListResponse>;

  /**
   * Get notifications by resource (e.g., all notifications for a creative)
   */
  getNotificationsByResource(
    resourceType: "campaign" | "creative" | "sales_agent" | "tactic",
    resourceId: string,
    customerId: number,
  ): Promise<Notification[]>;

  /**
   * Get notification statistics for analytics
   */
  getNotificationStatistics(
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
        avgTimeToAcknowledge: number; // minutes
        avgTimeToRead: number; // minutes
        count: number;
        readRate: number;
      }
    >;
    readRate: number;
    totalNotifications: number;
  }>;

  /**
   * Check for duplicate notifications to prevent spam
   */
  isDuplicateNotification(
    request: NotificationCreateRequest,
    windowMinutes?: number,
  ): Promise<boolean>;

  /**
   * Mark notifications as acknowledged (user has taken action)
   */
  markAsAcknowledged(notificationIds: string[]): Promise<void>;

  /**
   * Mark notifications as read
   */
  markAsRead(notificationIds: string[]): Promise<void>;
}

export interface UpdateNotificationData {
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  read?: boolean;
}
