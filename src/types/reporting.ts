// Reporting types for campaign analytics and summaries

// Removed unused imports

export interface AnalyzeTacticsParams {
  analysisType:
    | "attribution"
    | "efficiency"
    | "optimization"
    | "signals"
    | "stories";
  campaignId: string;
  compareSignals?: boolean;
  compareStories?: boolean;
  customDateRange?: {
    end: string;
    start: string;
  };
  timeframe?: "14d" | "30d" | "7d" | "custom";
}

// Alert types
export interface CampaignAlert {
  acknowledged?: boolean;
  actionRequired: boolean;
  details?: string;
  id: string;
  message: string;
  resolvedAt?: Date;
  severity: "critical" | "info" | "warning";
  tacticId?: string; // If alert is tactic-specific
  timestamp: Date;
  type: "budget" | "delivery" | "pacing" | "performance" | "threshold";
}

// Campaign summary for casual users
export interface CampaignSummary {
  alerts: CampaignAlert[]; // Active threshold violations
  campaignId: string;
  campaignName: string;
  charts?: {
    performanceTrend?: string;
    signalPerformance?: string;
    spendTrend?: string; // ASCII/markdown chart
    storyPerformance?: string;
    tacticAllocation?: string;
  };
  generatedAt: Date;
  insights: string[]; // Key insights and recommendations
  nextSteps?: string[]; // Recommended actions
  summary: string; // Natural language summary
}

// Parameters for campaign summary
export interface CampaignSummaryParams {
  campaignId: string;
  dateRange?: {
    end?: string; // Defaults to today
    start?: string; // Defaults to campaign start
  };
  includeCharts?: boolean; // Generate ASCII/markdown charts
  verbosity?: "brief" | "detailed" | "executive";
}

// Chart generation types
export interface ChartData {
  data: Array<{
    label: string;
    timestamp?: Date;
    value: number;
  }>;
  options?: {
    currency?: string;
    height?: number;
    showValues?: boolean;
    width?: number;
  };
  title: string;
  type: "bar" | "line" | "pie" | "trend";
}

// Data export parameters for enterprise users
export interface DataExportParams {
  brandAgentId?: string; // Or all campaigns for brand
  campaignIds?: string[]; // Multiple campaigns

  compression?: "gzip" | "none";

  // What to include
  datasets: Array<
    | "allocations" // Budget allocations
    | "delivery" // Spend, impressions, price
    | "events" // All events with rewards
    | "tactics" // Tactic configurations
  >;

  dateRange: {
    end: string;
    start: string;
  };

  format?: "csv" | "json" | "parquet";
  // Granularity
  groupBy: Array<
    | "campaign"
    | "creative"
    | "date"
    | "hour"
    | "publisher_product"
    | "signal"
    | "story"
    | "tactic"
  >;
}

// Data export response
export interface DataExportResponse {
  data?: Array<Record<string, unknown>>; // Raw records (for small exports)
  downloadUrl?: string; // Pre-signed URL for large exports
  expiresAt?: Date; // When download URL expires
  metadata: {
    exportId: string;
    query: DataExportParams;
    rowCount: number;
    schema: Record<string, string>; // Field name -> type mapping
    timestamp: Date;
  };
}

export interface ExportCampaignDataParams {
  brandAgentId?: string;
  campaignIds?: string[];
  compression?: "gzip" | "none";
  datasets: Array<"allocations" | "delivery" | "events" | "tactics">;
  dateRange: {
    end: string;
    start: string;
  };
  format?: "csv" | "json" | "parquet";
  groupBy: Array<
    | "campaign"
    | "creative"
    | "date"
    | "hour"
    | "publisher_product"
    | "signal"
    | "story"
    | "tactic"
  >;
}

export interface GeneratedChart {
  ascii: string; // ASCII representation
  data: ChartData; // Original data for external rendering
  markdown: string; // Markdown formatted
}

// MCP parameter types for tools
export interface GetCampaignSummaryParams {
  campaignId: string;
  dateRange?: {
    end?: string;
    start?: string;
  };
  includeCharts?: boolean;
  verbosity?: "brief" | "detailed" | "executive";
}

// Insights generation context
export interface InsightContext {
  alerts: CampaignAlert[];
  campaign: {
    budget: number;
    endDate?: Date;
    id: string;
    name: string;
    startDate: Date;
  };
  performance: PerformanceMetrics;
  tacticBreakdown?: Array<{
    performance: PerformanceMetrics;
    signals: string[];
    stories: string[];
    tacticId: string;
  }>;
  trends: TrendData[];
}

// Performance metrics for summaries
export interface PerformanceMetrics {
  // Pacing
  budgetUtilization: number; // Percentage (0-1)
  clicks?: number;
  conversions?: number;
  cpa?: number; // Cost per acquisition

  cpc?: number; // Cost per click
  cpm: number; // Cost per mille
  // Calculated metrics
  ctr?: number; // Click-through rate
  cvr?: number; // Conversion rate
  // Quality metrics
  fillRate?: number;
  impressions: number;

  paceToGoal: number; // Multiplier (1.0 = on track)
  qualityScore?: number;

  roas?: number; // Return on ad spend
  // Core metrics
  spend: number;
  winRate?: number;
}

// Tactic analysis parameters
export interface TacticAnalysisParams {
  analysisType:
    | "attribution"
    | "efficiency"
    | "optimization"
    | "signals"
    | "stories";
  campaignId: string;
  compareSignals?: boolean; // Compare signal effectiveness
  compareStories?: boolean; // Compare story performance
  customDateRange?: {
    end: string;
    start: string;
  };
  timeframe?: "14d" | "30d" | "7d" | "custom";
}

// Tactic analysis result
export interface TacticAnalysisResult {
  analysisType: string;
  campaignId: string;

  generatedAt: Date;
  recommendations: string[];

  // Component analysis (if requested)
  signalAnalysis?: Array<{
    effectiveness: number; // 0-1 score
    performance: Record<string, number>;
    recommendation: string;
    signal: string;
  }>;

  // Statistical insights
  statisticalSignificance?: {
    confidenceLevel: number;
    sampleSize: number;
    winningTactic?: string;
  };

  storyAnalysis?: Array<{
    effectiveness: number; // 0-1 score
    performance: Record<string, number>;
    recommendation: string;
    story: string;
  }>;

  // Overall insights
  summary: string;

  // Detailed analysis
  tacticPerformance: Array<{
    insights: string[];
    metrics: Record<string, number>;
    rank: number;
    tacticId: string;
    tacticName?: string;
  }>;
}

// Trend data for time series analysis
export interface TrendData {
  changePercentage: number;
  dataPoints: Array<{
    timestamp: Date;
    value: number;
  }>;
  metric: string;
  significance: "high" | "low" | "medium";
  timeframe: string;
  trend: "down" | "stable" | "up";
}
