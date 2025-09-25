// Simplified agent-actionable notification system
// Resource.action taxonomy for clear agentic workflows

/**
 * Notification event types following resource.action pattern
 * This taxonomy allows agents to easily set up workflows
 */
export enum NotificationEventType {
  // Creative sync events
  CREATIVE_SYNC_STARTED = "creative.sync_started",
  CREATIVE_SYNC_COMPLETED = "creative.sync_completed",
  CREATIVE_SYNC_FAILED = "creative.sync_failed",

  // Creative approval events
  CREATIVE_APPROVED = "creative.approved",
  CREATIVE_REJECTED = "creative.rejected",
  CREATIVE_CHANGES_REQUESTED = "creative.changes_requested",

  // Campaign health events
  CAMPAIGN_UNHEALTHY = "campaign.unhealthy",
  CAMPAIGN_HEALTHY = "campaign.healthy",

  // Sales agent events
  SALESAGENT_UNAVAILABLE = "salesagent.unavailable",
  SALESAGENT_AVAILABLE = "salesagent.available",

  // Tactic events
  TACTIC_MISSING_CREATIVES = "tactic.missing_creatives",
  TACTIC_READY = "tactic.ready",
}

/**
 * Simple notification structure with just enough data for agents to take action
 */
export interface Notification {
  id: string;
  type: NotificationEventType;
  timestamp: string; // ISO 8601

  // Context for routing
  customerId: number;
  brandAgentId?: number;

  // Simple data with IDs needed to take action
  data: NotificationData;

  // Status
  read: boolean;
  acknowledged: boolean;
}

/**
 * Notification data - minimal structure with actionable IDs and human-readable message
 */
export interface NotificationData {
  // Resource IDs for action
  creativeId?: string;
  campaignId?: string;
  salesAgentId?: string;
  tacticId?: string;

  // Human-readable info
  message: string;
  reason?: string;

  // Additional context (minimal)
  salesAgentName?: string;
  creativeName?: string;
  campaignName?: string;
}

/**
 * Creative sync status per sales agent
 */
export interface CreativeSyncStatus {
  salesAgentId: string;
  salesAgentName: string;
  status: "synced" | "failed" | "pending" | "not_applicable" | "syncing";
  approvalStatus?: "approved" | "rejected" | "pending" | "changes_requested";
  lastSyncAttempt?: string;
  rejectionReason?: string;
  requestedChanges?: string[];
}

/**
 * Sales agent format capabilities for smart sync matching
 */
export interface SalesAgentCapabilities {
  salesAgentId: string;

  // Format support
  supportsVideo: boolean;
  supportsDisplay: boolean;
  supportsAudio: boolean;
  supportsNative: boolean;
  supportsCTV: boolean;

  // Auto-approval formats (don't need manual review)
  autoApprovalFormats: string[];

  // Technical constraints
  maxVideoDurationSeconds?: number;
  maxFileSizeMB?: number;
  supportedVideoCodecs?: string[];
  supportedImageFormats?: string[];

  // Metadata
  lastVerified?: string;
  verificationMethod?: "manual" | "api_discovery" | "inferred";
}

/**
 * Campaign health summary for inline display in campaign responses
 */
export interface CampaignSyncHealth {
  status: "healthy" | "warning" | "critical";

  summary: {
    creativesFullySynced: number; // Synced to all relevant sales agents
    creativesPartiallySynced: number; // Some agents missing
    creativesNotSynced: number; // No sync yet
    creativesWithIssues: number; // Rejections or failures
  };

  issues?: Array<{
    creativeId: string;
    creativeName: string;
    issue: string;
    salesAgentName: string;
    suggestedAction: string;
  }>;
}

/**
 * Simple notification count for campaign responses
 */
export interface CampaignNotificationSummary {
  unread: number;
  types: NotificationEventType[]; // Which types of notifications exist
}

/**
 * Webhook payload for external agent systems
 */
export interface NotificationWebhookPayload {
  event: Notification;
  signature: string; // HMAC verification
}

/**
 * Response types for notification operations
 */
export interface NotificationListResponse {
  notifications: Notification[];
  hasMore: boolean;
  totalCount: number;
}

export interface NotificationCreateRequest {
  type: NotificationEventType;
  customerId: number;
  brandAgentId?: number;
  data: NotificationData;
}

/**
 * Notification filter options
 */
export interface NotificationFilter {
  types?: NotificationEventType[];
  brandAgentId?: number;
  campaignId?: string;
  creativeId?: string;
  customerId?: number;
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}
