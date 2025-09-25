import type {
  Notification,
  NotificationData,
  NotificationEventType,
  NotificationCreateRequest,
  NotificationListResponse,
  NotificationFilter,
} from "../types/notifications.js";

import {
  BigQueryTypes,
  createBigQueryParams,
} from "../utils/bigquery-types.js";
import { BigQueryBaseService } from "./base/bigquery-base-service.js";

/**
 * Service for managing agent-actionable notifications
 * Features:
 * - Simple notification creation with resource.action taxonomy
 * - Deduplication to prevent notification spam
 * - Webhook delivery for external agent systems
 * - Filtering and lifecycle management
 */
export class NotificationService extends BigQueryBaseService {
  /**
   * Create a new notification with automatic deduplication
   */
  async createNotification(
    request: NotificationCreateRequest,
  ): Promise<string> {
    // Check for recent duplicate notifications (same type, same resources, within 5 minutes)
    const isDuplicate = await this.isDuplicateNotification(request);
    if (isDuplicate) {
      console.log(`Skipping duplicate notification: ${request.type}`);
      return "duplicate-skipped";
    }

    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const query = `
      INSERT INTO ${this.getTableRef("notifications")} (
        id, type, customer_id, brand_agent_id, data, created_at
      ) VALUES (
        @notificationId, @type, @customerId, @brandAgentId, PARSE_JSON(@data), CURRENT_TIMESTAMP()
      )
    `;

    const { params } = createBigQueryParams(
      {
        notificationId: notificationId,
        type: request.type,
        customerId: request.customerId,
        brandAgentId: request.brandAgentId || null,
        data: request.data ? JSON.stringify(request.data) : null,
      },
      {
        notificationId: BigQueryTypes.STRING,
        type: BigQueryTypes.STRING,
        customerId: BigQueryTypes.INT64,
        brandAgentId: BigQueryTypes.INT64,
        data: BigQueryTypes.JSON,
      },
    );

    await this.executeQuery(query, params);

    // Trigger webhook delivery for external agents (async, don't wait)
    this.deliverWebhook(notificationId).catch((error) => {
      console.error(
        `Webhook delivery failed for notification ${notificationId}:`,
        error,
      );
    });

    return notificationId;
  }

  /**
   * Get notifications with filtering options
   */
  async getNotifications(
    filter: NotificationFilter = {},
  ): Promise<NotificationListResponse> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    // Build WHERE conditions
    if (filter.types && filter.types.length > 0) {
      conditions.push("type IN UNNEST(@types)");
      params.types = filter.types;
    }

    if (filter.brandAgentId) {
      conditions.push("brand_agent_id = @brandAgentId");
      params.brandAgentId = filter.brandAgentId;
    }

    if (filter.campaignId) {
      conditions.push(
        "JSON_EXTRACT_SCALAR(data, '$.campaignId') = @campaignId",
      );
      params.campaignId = filter.campaignId;
    }

    if (filter.creativeId) {
      conditions.push(
        "JSON_EXTRACT_SCALAR(data, '$.creativeId') = @creativeId",
      );
      params.creativeId = filter.creativeId;
    }

    if (filter.unreadOnly) {
      conditions.push("read = false");
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filter.limit || 50;
    const offset = filter.offset || 0;

    // Count query
    const countQuery = `
      SELECT COUNT(*) as total_count
      FROM ${this.getTableRef("notifications")}
      ${whereClause}
    `;

    // Data query
    const dataQuery = `
      SELECT 
        id,
        type,
        customer_id,
        brand_agent_id,
        data,
        read,
        acknowledged,
        created_at
      FROM ${this.getTableRef("notifications")}
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT @limit OFFSET @offset
    `;

    const queryParams = {
      ...params,
      limit: limit,
      offset: offset,
    };

    // Execute both queries
    const [countResults, dataResults] = await Promise.all([
      this.executeQuery<{ total_count: number }>(countQuery, params),
      this.executeQuery<{
        id: string;
        type: string;
        customer_id: number;
        brand_agent_id?: number;
        data: NotificationData;
        read: boolean;
        acknowledged: boolean;
        created_at: string;
      }>(dataQuery, queryParams),
    ]);

    const totalCount = countResults[0]?.total_count || 0;
    const notifications: Notification[] = dataResults.map((row) => ({
      id: row.id,
      type: row.type as NotificationEventType,
      timestamp: row.created_at,
      customerId: row.customer_id,
      brandAgentId: row.brand_agent_id,
      data: row.data,
      read: row.read,
      acknowledged: row.acknowledged,
    }));

    return {
      notifications,
      hasMore: offset + notifications.length < totalCount,
      totalCount,
    };
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;

    const query = `
      UPDATE ${this.getTableRef("notifications")}
      SET read = true
      WHERE id IN UNNEST(@notificationIds)
    `;

    const { params } = createBigQueryParams(
      {
        notificationIds: notificationIds,
      },
      {
        notificationIds: BigQueryTypes.STRING,
      },
    );

    await this.executeQuery(query, params);
  }

  /**
   * Mark notifications as acknowledged (user has taken action)
   */
  async markAsAcknowledged(notificationIds: string[]): Promise<void> {
    if (notificationIds.length === 0) return;

    const query = `
      UPDATE ${this.getTableRef("notifications")}
      SET acknowledged = true, read = true
      WHERE id IN UNNEST(@notificationIds)
    `;

    const { params } = createBigQueryParams(
      {
        notificationIds: notificationIds,
      },
      {
        notificationIds: BigQueryTypes.STRING,
      },
    );

    await this.executeQuery(query, params);
  }

  /**
   * Get notification counts for campaign overview
   */
  async getNotificationCounts(
    customerId: number,
    brandAgentId?: number,
  ): Promise<{
    total: number;
    unread: number;
    byType: Record<string, number>;
  }> {
    const conditions = ["customer_id = @customerId"];
    const params: Record<string, unknown> = {
      customerId: customerId,
    };

    if (brandAgentId) {
      conditions.push("brand_agent_id = @brandAgentId");
      params.brandAgentId = brandAgentId;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    const query = `
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN read = false THEN 1 ELSE 0 END) as unread,
        type,
        COUNT(*) as type_count
      FROM ${this.getTableRef("notifications")}
      ${whereClause}
      AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
      GROUP BY type
    `;

    const results = await this.executeQuery<{
      total: number;
      unread: number;
      type: string;
      type_count: number;
    }>(query, params);

    const total = results.reduce((sum, row) => sum + row.type_count, 0);
    const unread = results.reduce((sum, row) => sum + row.unread, 0);
    const byType: Record<string, number> = {};

    results.forEach((row) => {
      byType[row.type] = row.type_count;
    });

    return { total, unread, byType };
  }

  /**
   * Get campaign-specific notification summary
   */
  async getCampaignNotifications(
    campaignId: string,
    customerId: number,
  ): Promise<{
    unread: number;
    types: NotificationEventType[];
  }> {
    const query = `
      SELECT 
        SUM(CASE WHEN read = false THEN 1 ELSE 0 END) as unread,
        ARRAY_AGG(DISTINCT type) as types
      FROM ${this.getTableRef("notifications")}
      WHERE customer_id = @customerId
      AND JSON_EXTRACT_SCALAR(data, '$.campaignId') = @campaignId
      AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY)
    `;

    const { params } = createBigQueryParams(
      {
        customerId: customerId,
        campaignId: campaignId,
      },
      {
        customerId: BigQueryTypes.INT64,
        campaignId: BigQueryTypes.STRING,
      },
    );

    const results = await this.executeQuery<{
      unread: number;
      types: string[];
    }>(query, params);

    const result = results[0];
    return {
      unread: result?.unread || 0,
      types: (result?.types || []) as NotificationEventType[],
    };
  }

  /**
   * Clean up old notifications (keep last 90 days)
   */
  async cleanupOldNotifications(): Promise<number> {
    const query = `
      DELETE FROM ${this.getTableRef("notifications")}
      WHERE created_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
    `;

    await this.executeQuery(query);
    // BigQuery doesn't return row count directly, so estimate cleanup success
    return 1; // Indicates cleanup ran successfully
  }

  // Private helper methods

  private async isDuplicateNotification(
    request: NotificationCreateRequest,
  ): Promise<boolean> {
    const query = `
      SELECT COUNT(*) as duplicate_count
      FROM ${this.getTableRef("notifications")}
      WHERE type = @type
      AND customer_id = @customerId
      ${request.brandAgentId ? "AND brand_agent_id = @brandAgentId" : ""}
      AND JSON_EXTRACT_SCALAR(data, '$.creativeId') = @creativeId
      AND JSON_EXTRACT_SCALAR(data, '$.salesAgentId') = @salesAgentId
      AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE)
      LIMIT 1
    `;

    const params: Record<string, unknown> = {
      type: request.type,
      customerId: request.customerId,
      creativeId: request.data.creativeId || "",
      salesAgentId: request.data.salesAgentId || "",
    };

    if (request.brandAgentId) {
      params.brandAgentId = request.brandAgentId;
    }

    const results = await this.executeQuery<{ duplicate_count: number }>(
      query,
      params,
    );
    return (results[0]?.duplicate_count || 0) > 0;
  }

  private async deliverWebhook(notificationId: string): Promise<void> {
    // TODO: Implement webhook delivery to external agent systems
    // This would:
    // 1. Get notification details
    // 2. Find webhook subscriptions for the customer/brand agent
    // 3. Generate HMAC signature for verification
    // 4. POST to webhook URLs with retry logic
    // 5. Log delivery results

    console.log(
      `Webhook delivery for notification ${notificationId} - TODO: Implement`,
    );
  }
}
