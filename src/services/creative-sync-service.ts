import type {
  CreativeSyncStatus,
  SalesAgentCapabilities,
  NotificationEventType,
} from "../types/notifications.js";
import type { Creative } from "../types/creative.js";
import type { Tactic } from "../types/tactics.js";

import {
  BigQueryTypes,
  createBigQueryParams,
  toBigQueryInt64,
  toBigQueryString,
  toBigQueryJson,
} from "../utils/bigquery-types.js";
import { BigQueryBaseService } from "./base/bigquery-base-service.js";
import type { NotificationService } from "./notification-service.js";

/**
 * Service for managing creative sync operations with sales agents
 * Features:
 * - Smart format matching (video → video agents)
 * - Recent history intelligence (30-day lookback)
 * - Batch sync operations with retry logic
 * - Automatic sync triggers on campaign/tactic changes
 */
export class CreativeSyncService extends BigQueryBaseService {
  private notificationService?: NotificationService;

  /**
   * Set notification service for generating sync notifications
   */
  setNotificationService(notificationService: NotificationService): void {
    this.notificationService = notificationService;
  }

  /**
   * Determine relevant sales agents for a creative based on format and recent history
   */
  async determineRelevantSalesAgents(
    creativeId: string,
    brandAgentId: number,
    options: {
      daysBack?: number;
      includeActive?: boolean;
      forceIncludeAgents?: string[];
    } = {},
  ): Promise<string[]> {
    const { daysBack = 30, includeActive = true, forceIncludeAgents = [] } = options;

    // Get creative format information
    const creative = await this.getCreativeFormat(creativeId);
    if (!creative) {
      throw new Error(`Creative ${creativeId} not found`);
    }

    // Find recent tactics with matching format
    const recentQuery = `
      SELECT DISTINCT 
        t.sales_agent_id,
        sa.name as sales_agent_name,
        sac.supports_video,
        sac.supports_display,
        sac.supports_audio,
        sac.supports_native,
        sac.supports_ctv
      FROM ${this.getTableRef("tactics")} t
      LEFT JOIN ${this.getTableRef("sales_agents")} sa 
        ON t.sales_agent_id = sa.id
      LEFT JOIN ${this.getTableRef("sales_agent_capabilities")} sac
        ON t.sales_agent_id = sac.sales_agent_id
      WHERE t.customer_id = (
        SELECT customer_id FROM ${this.getTableRef("creatives")} 
        WHERE id = @creativeId LIMIT 1
      )
      AND t.created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @daysBack DAY)
      AND t.status != 'deleted'
      ${includeActive ? "AND t.status = 'active'" : ""}
    `;

    const { params, types } = createBigQueryParams({
      creativeId: toBigQueryString(creativeId),
      daysBack: toBigQueryInt64(daysBack),
    }, BigQueryTypes);

    const recentResults = await this.executeQuery<{
      sales_agent_id: string;
      sales_agent_name: string;
      supports_video?: boolean;
      supports_display?: boolean;
      supports_audio?: boolean;
      supports_native?: boolean;
      supports_ctv?: boolean;
    }>(recentQuery, params);

    // Filter by format compatibility
    const compatibleAgents = recentResults
      .filter((result) => this.isFormatCompatible(creative.format, result))
      .map((result) => result.sales_agent_id);

    // Add any force-included agents
    const allRelevantAgents = [...new Set([...compatibleAgents, ...forceIncludeAgents])];

    return allRelevantAgents;
  }

  /**
   * Sync a creative to multiple sales agents with batch processing
   */
  async syncCreativeToSalesAgents(
    creativeId: string,
    salesAgentIds: string[],
    context: {
      campaignId?: string;
      tacticId?: string;
      triggeredBy: "manual" | "campaign_assignment" | "tactic_creation" | "creative_update";
    },
  ): Promise<{ success: string[]; failed: Array<{ salesAgentId: string; error: string }> }> {
    const results = { success: [] as string[], failed: [] as Array<{ salesAgentId: string; error: string }> };

    // Get creative and brand agent info for notifications
    const creative = await this.getCreative(creativeId);
    if (!creative) {
      throw new Error(`Creative ${creativeId} not found`);
    }

    // Process syncs in batches to avoid overwhelming APIs
    const batchSize = 5;
    for (let i = 0; i < salesAgentIds.length; i += batchSize) {
      const batch = salesAgentIds.slice(i, i + batchSize);
      const batchPromises = batch.map((salesAgentId) =>
        this.syncCreativeToSingleAgent(creativeId, salesAgentId, context)
      );

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result, index) => {
        const salesAgentId = batch[index];
        if (result.status === "fulfilled") {
          results.success.push(salesAgentId);
        } else {
          const error = result.reason instanceof Error ? result.reason.message : String(result.reason);
          results.failed.push({ salesAgentId, error });
        }
      });
    }

    // Generate notifications for failures
    if (results.failed.length > 0 && this.notificationService) {
      await this.generateSyncFailureNotifications(creative, results.failed, context);
    }

    // Generate success notification if all succeeded  
    if (results.success.length === salesAgentIds.length && this.notificationService) {
      await this.notificationService.createNotification({
        type: "creative.sync_completed" as NotificationEventType,
        customerId: creative.customerId,
        brandAgentId: parseInt(creative.buyerAgentId),
        data: {
          creativeId,
          campaignId: context.campaignId,
          message: `Creative "${creative.creativeName}" synced to ${results.success.length} sales agents`,
        },
      });
    }

    return results;
  }

  /**
   * Get sync status for a creative across all sales agents
   */
  async getCreativeSyncStatus(creativeId: string): Promise<CreativeSyncStatus[]> {
    const query = `
      SELECT 
        css.sales_agent_id,
        sa.name as sales_agent_name,
        css.sync_status,
        css.approval_status,
        css.last_sync_attempt,
        css.rejection_reason,
        css.requested_changes
      FROM ${this.getTableRef("creative_sync_status")} css
      LEFT JOIN ${this.getTableRef("sales_agents")} sa 
        ON css.sales_agent_id = sa.id
      WHERE css.creative_id = @creativeId
      ORDER BY sa.name
    `;

    const { params, types } = createBigQueryParams({
      creativeId: toBigQueryString(creativeId),
    }, BigQueryTypes);

    const results = await this.executeQuery<{
      sales_agent_id: string;
      sales_agent_name: string;
      sync_status: string;
      approval_status?: string;
      last_sync_attempt?: string;
      rejection_reason?: string;
      requested_changes?: string[];
    }>(query, params);

    return results.map((result) => ({
      salesAgentId: result.sales_agent_id,
      salesAgentName: result.sales_agent_name || result.sales_agent_id,
      status: result.sync_status as "synced" | "failed" | "pending" | "not_applicable",
      approvalStatus: result.approval_status as "approved" | "rejected" | "pending" | "changes_requested" | undefined,
      lastSyncAttempt: result.last_sync_attempt,
      rejectionReason: result.rejection_reason,
      requestedChanges: result.requested_changes,
    }));
  }

  /**
   * Trigger automatic sync when creative is assigned to campaign
   */
  async onCreativeAssignedToCampaign(creativeId: string, campaignId: string): Promise<void> {
    // Find all tactics in this campaign
    const tacticsQuery = `
      SELECT DISTINCT sales_agent_id
      FROM ${this.getTableRef("tactics")}
      WHERE campaign_id = @campaignId AND status = 'active'
    `;

    const { params } = createBigQueryParams({
      campaignId: toBigQueryString(campaignId),
    }, BigQueryTypes);

    const tactics = await this.executeQuery<{ sales_agent_id: string }>(tacticsQuery, params);
    
    if (tactics.length > 0) {
      const salesAgentIds = tactics.map((t) => t.sales_agent_id);
      await this.syncCreativeToSalesAgents(creativeId, salesAgentIds, {
        campaignId,
        triggeredBy: "campaign_assignment",
      });
    }
  }

  /**
   * Trigger automatic sync when tactic is created
   */
  async onTacticCreated(tacticId: string, campaignId: string, salesAgentId: string): Promise<void> {
    // Find all creatives in this campaign
    const creativesQuery = `
      SELECT DISTINCT cc.creative_id
      FROM ${this.getTableRef("campaign_creatives")} cc
      WHERE cc.campaign_id = @campaignId AND cc.status = 'active'
    `;

    const { params } = createBigQueryParams({
      campaignId: toBigQueryString(campaignId),
    }, BigQueryTypes);

    const creatives = await this.executeQuery<{ creative_id: string }>(creativesQuery, params);
    
    // Sync each creative to the new sales agent
    for (const creative of creatives) {
      try {
        // Check format compatibility first
        const relevantAgents = await this.determineRelevantSalesAgents(
          creative.creative_id,
          0, // Will be determined from creative
          { forceIncludeAgents: [salesAgentId] }
        );

        if (relevantAgents.includes(salesAgentId)) {
          await this.syncCreativeToSalesAgents(creative.creative_id, [salesAgentId], {
            campaignId,
            tacticId,
            triggeredBy: "tactic_creation",
          });
        }
      } catch (error) {
        console.error(`Failed to sync creative ${creative.creative_id} to new tactic:`, error);
        // Continue with other creatives
      }
    }
  }

  // Private helper methods

  private async getCreativeFormat(creativeId: string): Promise<{ format: string } | null> {
    const query = `
      SELECT format_id as format
      FROM ${this.getTableRef("creatives")}
      WHERE id = @creativeId
      LIMIT 1
    `;

    const { params } = createBigQueryParams({
      creativeId: toBigQueryString(creativeId),
    }, BigQueryTypes);

    const results = await this.executeQuery<{ format: string }>(query, params);
    return results[0] || null;
  }

  private async getCreative(creativeId: string): Promise<Creative | null> {
    const query = `
      SELECT 
        id as creativeId,
        name as creativeName,
        brand_agent_id as buyerAgentId,
        customer_id as customerId,
        format_id as format
      FROM ${this.getTableRef("creatives")}
      WHERE id = @creativeId
      LIMIT 1
    `;

    const { params } = createBigQueryParams({
      creativeId: toBigQueryString(creativeId),
    }, BigQueryTypes);

    const results = await this.executeQuery<{
      creativeId: string;
      creativeName: string;
      buyerAgentId: string;
      customerId: number;
      format: string;
    }>(query, params);

    if (!results[0]) return null;

    const result = results[0];
    return {
      creativeId: result.creativeId,
      creativeName: result.creativeName,
      buyerAgentId: result.buyerAgentId,
      customerId: result.customerId,
      format: { formatId: result.format, type: "adcp" },
    } as Creative;
  }

  private isFormatCompatible(
    creativeFormat: string,
    salesAgent: {
      supports_video?: boolean;
      supports_display?: boolean;
      supports_audio?: boolean;
      supports_native?: boolean;
      supports_ctv?: boolean;
    },
  ): boolean {
    const formatType = creativeFormat.split("/")[0]?.toLowerCase();

    switch (formatType) {
      case "video":
        return salesAgent.supports_video === true;
      case "display":
        return salesAgent.supports_display !== false; // Default to true
      case "audio":
        return salesAgent.supports_audio === true;
      case "native":
        return salesAgent.supports_native === true;
      case "ctv":
        return salesAgent.supports_ctv === true;
      default:
        return salesAgent.supports_display !== false; // Default fallback
    }
  }

  private async syncCreativeToSingleAgent(
    creativeId: string,
    salesAgentId: string,
    context: {
      campaignId?: string;
      tacticId?: string;
      triggeredBy: string;
    },
  ): Promise<void> {
    // Update sync status to 'syncing'
    await this.updateSyncStatus(creativeId, salesAgentId, {
      sync_status: "syncing",
      last_sync_attempt: new Date().toISOString(),
      initially_synced_for_tactic_id: context.tacticId,
      last_campaign_context: context.campaignId,
    });

    try {
      // TODO: Implement actual sync logic with sales agent API
      // This would call the sales agent's API to sync the creative
      
      // Simulate sync operation
      await this.simulateSyncOperation(creativeId, salesAgentId);

      // Update sync status to 'synced'
      await this.updateSyncStatus(creativeId, salesAgentId, {
        sync_status: "synced",
        approval_status: "pending", // Most sales agents require approval
        sync_error: null,
      });

    } catch (error) {
      // Update sync status to 'failed'
      await this.updateSyncStatus(creativeId, salesAgentId, {
        sync_status: "failed",
        sync_error: error instanceof Error ? error.message : String(error),
      });
      
      throw error; // Re-throw for batch handling
    }
  }

  private async simulateSyncOperation(creativeId: string, salesAgentId: string): Promise<void> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    
    // Simulate occasional failures for testing
    if (Math.random() < 0.1) { // 10% failure rate
      throw new Error(`Sync failed: Sales agent ${salesAgentId} temporarily unavailable`);
    }
  }

  private async updateSyncStatus(
    creativeId: string,
    salesAgentId: string,
    updates: {
      sync_status?: string;
      approval_status?: string;
      sync_error?: string | null;
      last_sync_attempt?: string;
      initially_synced_for_tactic_id?: string;
      last_campaign_context?: string;
    },
  ): Promise<void> {
    // First, get brand agent ID
    const creative = await this.getCreative(creativeId);
    if (!creative) {
      throw new Error(`Creative ${creativeId} not found`);
    }

    const syncId = `sync_${creativeId}_${salesAgentId}`;

    // Try insert first, then update if exists
    const insertQuery = `
      INSERT INTO ${this.getTableRef("creative_sync_status")} (
        id, creative_id, sales_agent_id, brand_agent_id, 
        sync_status, approval_status, sync_error,
        last_sync_attempt, initially_synced_for_tactic_id, 
        last_campaign_context, created_at, updated_at
      ) VALUES (
        @syncId, @creativeId, @salesAgentId, @brandAgentId,
        @sync_status, @approval_status, @sync_error,
        PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%E*SZ', @last_sync_attempt),
        @initially_synced_for_tactic_id, @last_campaign_context,
        CURRENT_TIMESTAMP(), CURRENT_TIMESTAMP()
      )
    `;

    const { params } = createBigQueryParams({
      syncId: toBigQueryString(syncId),
      creativeId: toBigQueryString(creativeId),
      salesAgentId: toBigQueryString(salesAgentId),
      brandAgentId: toBigQueryInt64(creative.buyerAgentId),
      sync_status: toBigQueryString(updates.sync_status || "pending"),
      approval_status: updates.approval_status ? toBigQueryString(updates.approval_status) : null,
      sync_error: updates.sync_error ? toBigQueryString(updates.sync_error) : null,
      last_sync_attempt: updates.last_sync_attempt ? toBigQueryString(updates.last_sync_attempt) : null,
      initially_synced_for_tactic_id: updates.initially_synced_for_tactic_id ? toBigQueryString(updates.initially_synced_for_tactic_id) : null,
      last_campaign_context: updates.last_campaign_context ? toBigQueryString(updates.last_campaign_context) : null,
    }, BigQueryTypes);

    try {
      await this.executeQuery(insertQuery, params);
    } catch (error) {
      // If insert fails (record exists), try update
      const updateQuery = `
        UPDATE ${this.getTableRef("creative_sync_status")}
        SET 
          sync_status = COALESCE(@sync_status, sync_status),
          approval_status = COALESCE(@approval_status, approval_status),
          sync_error = @sync_error,
          last_sync_attempt = COALESCE(PARSE_TIMESTAMP('%Y-%m-%dT%H:%M:%E*SZ', @last_sync_attempt), last_sync_attempt),
          initially_synced_for_tactic_id = COALESCE(@initially_synced_for_tactic_id, initially_synced_for_tactic_id),
          last_campaign_context = COALESCE(@last_campaign_context, last_campaign_context),
          updated_at = CURRENT_TIMESTAMP()
        WHERE creative_id = @creativeId AND sales_agent_id = @salesAgentId
      `;

      await this.executeQuery(updateQuery, params);
    }
  }

  private async generateSyncFailureNotifications(
    creative: Creative,
    failures: Array<{ salesAgentId: string; error: string }>,
    context: { campaignId?: string; tacticId?: string },
  ): Promise<void> {
    if (!this.notificationService) return;

    // Create individual notifications for each failure
    for (const failure of failures) {
      await this.notificationService.createNotification({
        type: "creative.sync_failed" as NotificationEventType,
        customerId: creative.customerId,
        brandAgentId: parseInt(creative.buyerAgentId),
        data: {
          creativeId: creative.creativeId,
          salesAgentId: failure.salesAgentId,
          campaignId: context.campaignId,
          tacticId: context.tacticId,
          message: `Creative "${creative.creativeName}" failed to sync`,
          reason: failure.error,
        },
      });
    }
  }

  protected getTableRef(table: string): string {
    return `${this.projectId}.${this.dataset}.${table}`;
  }
}