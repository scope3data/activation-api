// Event types for campaign reporting with reinforcement learning support

// Generic event that can represent any interaction (impression, click, purchase, etc.)
export interface CampaignEvent {
  // Amount (generic - could be items, dollars, seconds, etc.)
  amount?: {
    unit: string; // "items", "USD", "seconds", "percentage"
    value: number;
  };
  // Campaign context
  campaignId: string;

  creativeId?: string;
  // Event identification
  eventType: string; // "impression", "click", "purchase", "survey_response", etc.

  externalId?: string; // External system reference
  id: string;
  // Event details (flexible like GA4)
  parameters: Record<string, unknown>;

  publisherProductId?: string; // Inventory source
  receivedAt: Date;
  // Reward for RL training
  reward?: {
    components?: Record<string, number>; // Breakdown for interpretability
    confidence?: number; // Attribution confidence (0-1)
    delayed?: number; // Attribution reward (may come later)
    immediate: number; // Instant feedback (win/loss)
  };

  // Core tactic components (for grouping)
  signals?: string[]; // Data signals used

  // Source tracking
  source: string; // "scope3", "ga4", "advertiser_api", etc.

  stories?: string[]; // Brand stories/narratives

  tacticId: string;
  timestamp: Date;
}

// Input for creating events
export interface CampaignEventInput {
  amount?: {
    unit: string;
    value: number;
  };
  campaignId: string;
  creativeId?: string;
  eventType: string;
  parameters: Record<string, unknown>;
  publisherProductId?: string;
  reward?: {
    components?: Record<string, number>;
    confidence?: number;
    delayed?: number;
    immediate: number;
  };
  signals?: string[];
  source?: string; // Defaults to "scope3"
  stories?: string[];
  tacticId: string;
  timestamp?: Date; // Defaults to now
}

export interface DeliveryData {
  deliveries: TacticDelivery[];
}

// Event aggregation result
export interface EventAggregationResult {
  query: EventQuery;
  results: EventQueryResponse[];
  summary: {
    dataFreshness: Date;
    timeRange: {
      end: Date;
      start: Date;
    };
    totalRows: number;
  };
}

// Query interface for flexible event aggregation
export interface EventQuery {
  // Filters
  brandAgentId?: string;
  campaignIds?: string[];
  // Custom aggregations (for flexibility)
  customAggregations?: Array<{
    expression: string; // e.g., "SUM(amount.value) WHERE eventType='purchase'"
    name: string;
  }>;
  dateRange: {
    end: Date;
    start: Date;
  };

  eventTypes?: string[]; // Filter by event type

  // Time granularity
  granularity: "day" | "hour" | "month" | "week";

  // Aggregation - INCLUDING signals and stories
  groupBy: Array<
    | "campaign"
    | "creative"
    | "date"
    | "event_type"
    | "publisher_product"
    | "signal" // Group by signal
    | "story" // Group by story
    | "tactic"
  >;

  // Metrics to calculate
  metrics: Array<
    | "average_reward"
    | "conversion_rate"
    | "custom" // Allow custom metric definitions
    | "event_count"
    | "total_amount"
    | "total_spend"
  >;

  tacticIds?: string[];
}

// Response from event queries
export interface EventQueryResponse {
  dimensions: Record<string, unknown>; // The groupBy dimensions
  metadata?: {
    confidence?: number;
    lastUpdated?: Date;
    sampleSize?: number;
  };
  metrics: Record<string, number>; // Calculated metrics
}

// API response wrapper
export interface EventsData {
  events: CampaignEvent[];
}

// Delivery record (what we control - spend, impressions, price)
export interface TacticDelivery {
  currency: string;
  currentPrice: number; // Actual price achieved that day

  date: Date;
  deliveryUnit: "actions" | "clicks" | "impressions" | "views";
  lastUpdated: Date;
  publisherBreakdown?: Record<string, number>; // Delivery by publisher
  // Breakdown by components
  signalBreakdown?: Record<string, number>; // Delivery by signal

  // What we actually delivered
  spend: number;
  storyBreakdown?: Record<string, number>; // Delivery by story
  tacticId: string;

  unitsDelivered: number;
}
