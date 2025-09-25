// Contract interface for notification operations
// Ensures all implementations provide consistent behavior

import type {
  Notification,
  NotificationData,
  NotificationEventType,
  NotificationCreateRequest,
  NotificationFilter,
  NotificationListResponse,
} from "../types/notifications.js";

/**
 * Repository contract for notification operations
 * Any backend implementation (BigQuery, PostgreSQL, etc.) must satisfy this interface
 */
export interface NotificationRepository {
  /**
   * Create a new notification
   */
  createNotification(request: NotificationCreateRequest): Promise<string>;

  /**
   * Get notifications with filtering and pagination
   */
  getNotifications(filter?: NotificationFilter): Promise<NotificationListResponse>;

  /**
   * Get a single notification by ID
   */
  getNotification(notificationId: string): Promise<Notification | null>;

  /**
   * Mark notifications as read
   */
  markAsRead(notificationIds: string[]): Promise<void>;

  /**
   * Mark notifications as acknowledged (user has taken action)
   */
  markAsAcknowledged(notificationIds: string[]): Promise<void>;

  /**
   * Get notification counts for overview displays
   */
  getNotificationCounts(
    customerId: number,
    brandAgentId?: number
  ): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  }>;

  /**
   * Get campaign-specific notification summary
   */
  getCampaignNotifications(
    campaignId: string,
    customerId: number
  ): Promise<{
    unread: number;
    types: NotificationEventType[];
    recent: Notification[];
  }>;

  /**
   * Check for duplicate notifications to prevent spam
   */
  isDuplicateNotification(
    request: NotificationCreateRequest,
    windowMinutes?: number
  ): Promise<boolean>;

  /**
   * Get notification statistics for analytics
   */
  getNotificationStatistics(
    customerId: number,
    options?: {
      brandAgentId?: number;
      dateRange?: {
        start: string;
        end: string;
      };
    }
  ): Promise<{
    totalNotifications: number;
    readRate: number;
    acknowledgmentRate: number;
    byType: Record<string, {
      count: number;
      readRate: number;
      avgTimeToRead: number; // minutes
      avgTimeToAcknowledge: number; // minutes
    }>;
    byDay: Array<{
      date: string;
      count: number;
      types: Record<string, number>;
    }>;
  }>;

  /**
   * Clean up old notifications (keep last N days)
   */
  cleanupOldNotifications(keepLastDays: number): Promise<number>;

  /**
   * Batch update notification status
   */
  batchUpdateNotificationStatus(
    updates: Array<{
      notificationId: string;
      read?: boolean;
      acknowledged?: boolean;
    }>
  ): Promise<void>;

  /**
   * Get notifications by resource (e.g., all notifications for a creative)
   */
  getNotificationsByResource(
    resourceType: "creative" | "campaign" | "sales_agent" | "tactic",
    resourceId: string,
    customerId: number
  ): Promise<Notification[]>;
}

/**
 * Input interfaces for notification operations
 */
export interface CreateNotificationData {
  type: NotificationEventType;
  customerId: number;
  brandAgentId?: number;
  data: NotificationData;
  priority?: "immediate" | "normal" | "low";
  expiresAt?: string;
}

export interface UpdateNotificationData {
  read?: boolean;
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export interface NotificationQuery {
  customerId: number;
  brandAgentId?: number;
  types?: NotificationEventType[];
  read?: boolean;
  acknowledged?: boolean;
  resourceType?: "creative" | "campaign" | "sales_agent" | "tactic";
  resourceId?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  priority?: string[];
  limit?: number;
  offset?: number;
  orderBy?: "created_at" | "type" | "priority";
  orderDirection?: "asc" | "desc";
}

/**
 * Response types for notification operations
 */
export interface NotificationOperationResult {
  success: boolean;
  error?: string;
  notificationIds: string[];
  metadata?: {
    totalProcessed: number;
    totalSuccessful: number;
    totalFailed: number;
    duplicatesSkipped: number;
  };
}

export interface NotificationAnalytics {
  totalNotifications: number;
  unreadNotifications: number;
  acknowledgedNotifications: number;
  averageReadTime: number; // minutes
  averageAcknowledgeTime: number; // minutes
  
  typeBreakdown: Record<NotificationEventType, {
    count: number;
    percentage: number;
    averageReadTime: number;
    averageAcknowledgeTime: number;
  }>;
  
  timeSeriesData: Array<{
    date: string;
    count: number;
    unread: number;
    acknowledged: number;
  }>;
  
  actionableInsights: Array<{
    type: "high_unread_rate" | "delayed_acknowledgment" | "notification_flood";
    description: string;
    recommendation: string;
    affectedTypes: NotificationEventType[];
  }>;
}