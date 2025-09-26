// Simplified agent-actionable notification system
// Resource.action taxonomy for clear agentic workflows

/**
 * Notification event types following resource.action pattern
 * This taxonomy allows agents to easily set up workflows
 */
export enum NotificationEventType {
  CAMPAIGN_HEALTHY = "campaign.healthy",
  // Campaign health events
  CAMPAIGN_UNHEALTHY = "campaign.unhealthy",
  // Creative approval events
  CREATIVE_APPROVED = "creative.approved",

  CREATIVE_CHANGES_REQUESTED = "creative.changes_requested",
  CREATIVE_REJECTED = "creative.rejected",
  CREATIVE_SYNC_COMPLETED = "creative.sync_completed",

  CREATIVE_SYNC_FAILED = "creative.sync_failed",
  // Creative sync events
  CREATIVE_SYNC_STARTED = "creative.sync_started",

  SALESAGENT_AVAILABLE = "salesagent.available",
  // Sales agent events
  SALESAGENT_UNAVAILABLE = "salesagent.unavailable",

  // Tactic events
  TACTIC_MISSING_CREATIVES = "tactic.missing_creatives",
  TACTIC_READY = "tactic.ready",
}

/**
 * Simple notification count for campaign responses
 */
export interface CampaignNotificationSummary {
  types: NotificationEventType[]; // Which types of notifications exist
  unread: number;
}

/**
 * Campaign health summary for inline display in campaign responses
 */
export interface CampaignSyncHealth {
  issues?: Array<{
    creativeId: string;
    creativeName: string;
    issue: string;
    salesAgentName: string;
    suggestedAction: string;
  }>;

  status: "critical" | "healthy" | "warning";

  summary: {
    creativesFullySynced: number; // Synced to all relevant sales agents
    creativesNotSynced: number; // No sync yet
    creativesPartiallySynced: number; // Some agents missing
    creativesWithIssues: number; // Rejections or failures
  };
}

/**
 * Creative sync status per sales agent
 */
export interface CreativeSyncStatus {
  approvalStatus?: "approved" | "changes_requested" | "pending" | "rejected";
  lastSyncAttempt?: string;
  rejectionReason?: string;
  requestedChanges?: string[];
  salesAgentId: string;
  salesAgentName: string;
  status: "failed" | "not_applicable" | "pending" | "synced" | "syncing";
}

/**
 * Simple notification structure with just enough data for agents to take action
 */
export interface Notification {
  acknowledged: boolean;
  brandAgentId?: number;
  // Context for routing
  customerId: number;

  // Simple data with IDs needed to take action
  data: NotificationData;
  id: string;

  // Status
  read: boolean;

  timestamp: string; // ISO 8601
  type: NotificationEventType;
}

export interface NotificationCreateRequest {
  brandAgentId?: number;
  customerId: number;
  data: NotificationData;
  type: NotificationEventType;
}

/**
 * Notification data - minimal structure with actionable IDs and human-readable message
 */
export interface NotificationData {
  campaignId?: string;
  campaignName?: string;
  // Resource IDs for action
  creativeId?: string;
  creativeName?: string;

  // Human-readable info
  message: string;
  reason?: string;

  salesAgentId?: string;
  // Additional context (minimal)
  salesAgentName?: string;
  tacticId?: string;
}

/**
 * Notification filter options
 */
export interface NotificationFilter {
  brandAgentId?: number;
  campaignId?: string;
  creativeId?: string;
  customerId?: number;
  limit?: number;
  offset?: number;
  types?: NotificationEventType[];
  unreadOnly?: boolean;
}

/**
 * Response types for notification operations
 */
export interface NotificationListResponse {
  hasMore: boolean;
  notifications: Notification[];
  totalCount: number;
}

/**
 * Webhook payload for external agent systems
 */
export interface NotificationWebhookPayload {
  event: Notification;
  signature: string; // HMAC verification
}

/**
 * Sales agent format capabilities for smart sync matching
 */
export interface SalesAgentCapabilities {
  // Auto-approval formats (don't need manual review)
  autoApprovalFormats: string[];

  // Metadata
  lastVerified?: string;
  maxFileSizeMB?: number;
  // Technical constraints
  maxVideoDurationSeconds?: number;
  salesAgentId: string;
  supportedImageFormats?: string[];

  supportedVideoCodecs?: string[];

  supportsAudio: boolean;
  supportsCTV: boolean;
  supportsDisplay: boolean;
  supportsNative: boolean;

  // Format support
  supportsVideo: boolean;
  verificationMethod?: "api_discovery" | "inferred" | "manual";
}
