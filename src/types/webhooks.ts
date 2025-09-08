// Webhook types for push notifications (following A2A pattern)

// Delivery update webhook event
export interface DeliveryUpdateEvent {
  campaignId: string;
  currency: string;
  currentPrice: number;
  date: Date;
  pacing?: {
    budgetUtilization: number;
    status: "on_track" | "over" | "under";
  };
  spend: number;
  tacticId?: string;
  unitsDelivered: number;
}

// Performance event from external systems
export interface PerformanceEvent {
  amount?: {
    unit: string;
    value: number;
  };
  campaignId: string;
  eventType: string;
  parameters: Record<string, unknown>;
  reward?: {
    confidence?: number;
    delayed?: number;
    immediate: number;
  };
  tacticId?: string;
  timestamp: Date;
}

// Scoring outcome data
export interface ScoringOutcomeData {
  campaignId: string;
  creativeId?: string;
  exposureRange: {
    end: Date;
    start: Date;
  };
  performanceIndex: number;
  tacticId?: string;
  timestamp: Date;
}

// Threshold alert event
export interface ThresholdAlertEvent {
  alertType: "budget" | "delivery" | "pacing" | "performance";
  campaignId: string;
  currentValue: number;
  message: string;
  severity: "critical" | "info" | "warning";
  thresholdValue: number;
  timestamp: Date;
}

export interface WebhookDeliveryLogsData {
  deliveryLogs: WebhookDeliveryResult[];
}

// Webhook delivery result
export interface WebhookDeliveryResult {
  deliveryTime: Date;
  error?: string;
  eventId: string;
  responseBody?: string;
  retryAttempt: number;
  statusCode?: number;
  subscriptionId: string;
  success: boolean;
}

// Union type for different webhook event data
export type WebhookEventData =
  | DeliveryUpdateEvent
  | PerformanceEvent
  | ScoringOutcomeData
  | ThresholdAlertEvent;

// Webhook status and health
export interface WebhookHealth {
  avgResponseTime: number; // Milliseconds
  consecutiveFailures: number;
  lastSuccessfulDelivery?: Date;
  status: "degraded" | "failing" | "healthy";
  subscriptionId: string;
  successRate: number; // Over last 24h
  totalDeliveries: number;
}

// Webhook payload sent to external systems
export interface WebhookPayload {
  event: {
    data: WebhookEventData;
    type:
      | "delivery_update"
      | "performance_event"
      | "scoring_outcome"
      | "threshold_alert";
  };
  eventId: string;
  retryAttempt: number;
  // HMAC signature for verification
  signature?: string;

  subscriptionId: string;

  timestamp: Date;
}

export interface WebhookSubscription {
  brandAgentId: string;
  consecutiveFailures?: number;

  createdAt: Date;

  // Endpoint configuration
  endpoint: {
    authentication?: {
      credentials: string; // Encrypted
      type: "basic" | "bearer" | "hmac";
    };
    headers?: Record<string, string>;
    method: "POST" | "PUT";
    url: string;
  };
  // What to send
  eventTypes: string[]; // ["delivery_update", "performance_event", "alert"]

  filters?: {
    campaigns?: string[];
    metrics?: string[];
    minSeverity?: "critical" | "info" | "warning";
  };

  id: string;
  lastDelivery?: Date;
  // Reliability
  retryPolicy: {
    backoffMultiplier: number;
    maxBackoffSeconds: number;
    maxRetries: number;
  };
  // State
  status: "active" | "failing" | "paused";
  updatedAt: Date;
}

// Input for creating webhook subscriptions
export interface WebhookSubscriptionInput {
  brandAgentId: string;
  endpoint: {
    authentication?: {
      credentials: string;
      type: "basic" | "bearer" | "hmac";
    };
    headers?: Record<string, string>;
    method?: "POST" | "PUT";
    url: string;
  };
  eventTypes: string[];
  filters?: {
    campaigns?: string[];
    metrics?: string[];
    minSeverity?: "critical" | "info" | "warning";
  };
  retryPolicy?: {
    backoffMultiplier?: number;
    maxBackoffSeconds?: number;
    maxRetries?: number;
  };
}

// API response types
export interface WebhookSubscriptionsData {
  webhookSubscriptions: WebhookSubscription[];
}
