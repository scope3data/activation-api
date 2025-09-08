// Scoring outcome types for campaign optimization with reinforcement learning support

export interface DeliveryData {
  deliveries: TacticDelivery[];
}

// Scoring outcome aggregation result
export interface OutcomeAggregationResult {
  query: OutcomeQuery;
  results: OutcomeQueryResponse[];
  summary: {
    dataFreshness: Date;
    timeRange: {
      end: Date;
      start: Date;
    };
    totalRows: number;
  };
}

// Query interface for flexible outcome aggregation
export interface OutcomeQuery {
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

  // Time granularity
  granularity: "day" | "hour" | "month" | "week";

  // Aggregation - INCLUDING signals and stories
  groupBy: Array<
    | "campaign"
    | "creative"
    | "date"
    | "performance_index"
    | "publisher_product"
    | "signal" // Group by signal
    | "story" // Group by story
    | "tactic"
  >;

  // Metrics to calculate
  metrics: Array<
    | "average_performance_index"
    | "conversion_rate"
    | "custom" // Allow custom metric definitions
    | "outcome_count"
    | "total_scoring_impact"
    | "total_spend"
  >;

  performanceIndexRange?: { max: number; min: number }; // Filter by performance index

  tacticIds?: string[];
}

// Response from outcome queries
export interface OutcomeQueryResponse {
  dimensions: Record<string, unknown>; // The groupBy dimensions
  metadata?: {
    confidence?: number;
    lastUpdated?: Date;
    sampleSize?: number;
  };
  metrics: Record<string, number>; // Calculated metrics
}

// Scoring outcome that represents measurable performance data
export interface ScoringOutcome {
  // Campaign context
  campaignId: string;
  creativeId?: string;
  // Exposure range (when this outcome was measured)
  exposureRange: {
    end: Date;
    start: Date;
  };

  externalId?: string; // External system reference

  id: string;
  // Performance index (100 = expected performance, 1000 = 10x performance)
  performanceIndex: number;

  receivedAt: Date;

  // Core tactic components (for grouping)
  signals?: string[]; // Data signals used

  // Source tracking
  source: string; // "scope3", "ga4", "advertiser_api", etc.

  stories?: string[]; // Brand stories/narratives

  tacticId?: string;

  timestamp: Date;
}

// Input for providing scoring outcomes
export interface ScoringOutcomeInput {
  campaignId: string;
  creativeId?: string;
  exposureRange: {
    end: Date;
    start: Date;
  };

  performanceIndex: number;

  signals?: string[];
  source?: string; // Defaults to "scope3"
  stories?: string[];
  tacticId?: string;
  timestamp?: Date; // Defaults to now
}

// API response wrapper
export interface ScoringOutcomesData {
  outcomes: ScoringOutcome[];
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
