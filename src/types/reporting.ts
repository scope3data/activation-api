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

export interface BrandAgentData {
  name?: string;
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

export interface CampaignData {
  budget?: {
    currency?: string;
    total?: number;
  };
  createdAt?: Date;
  deliverySummary?: {
    alerts?: unknown[];
    healthScore?: string;
    pacing?: {
      budgetUtilized?: number;
      daysRemaining?: number;
      projectedCompletion?: Date;
      status?: string;
    };
    status?: string;
    today?: {
      averagePrice?: number;
      impressions?: number;
      spend?: number;
    };
  };
  id?: string;
  name?: string;
  status?: string;
}

export interface CampaignInsight {
  action?: string;
  message: string;
  priority: "high" | "low" | "medium";
  // Additional data for top tactics insights
  tactics?: TopTactic[];
  type: "alert" | "observation" | "optimization" | "top_tactics";
}

export interface CampaignPacing {
  actualDailySpend: number; // Amount in campaign currency
  budgetUtilized: number; // 0-100 percentage
  dailySpendTarget: number; // Amount in campaign currency
  projectedFinalSpend: number; // Amount in campaign currency
  status: "on_track" | "over" | "under";
}

// Campaign summary response (structured JSON)
export interface CampaignSummary {
  alerts: CampaignAlert[];
  campaignId: string;
  campaignName: string;
  currency: string; // Campaign currency (USD, EUR, etc.)
  externalCampaignId?: string; // Client's external campaign ID for addressability
  insights: CampaignInsight[];
  pacing: CampaignPacing;
  summary: CampaignSummaryData;
  textSummary: string; // Rich text for conversational interfaces
}

export interface CampaignSummaryData {
  averageCpm: number; // Price in campaign currency
  flightProgress: {
    daysElapsed: number;
    daysRemaining: number;
    percentComplete: number;
  };
  impressions: number;
  spend: number; // Amount in campaign currency
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

export interface DeliveryData {
  dailyDeliveries?: unknown[];
  dailySpend?: unknown[];
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

export interface PerformanceData {
  assistedConversions?: number;
  firstTouchConversions?: number;
  lastTouchConversions?: number;
  totalClicks?: number;
  totalConversions?: number;
  totalImpressions?: number;
  totalSpend?: number;
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

export interface SignalPerformanceMetrics {
  tacticCount: number;
  totalConversions: number;
  totalImpressions: number;
  totalSpend: number;
}

export interface StoryPerformanceMetrics {
  tacticCount: number;
  totalClicks: number;
  totalConversions: number;
  totalImpressions: number;
  totalSpend: number;
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

// Basic tactic and performance data structures for analysis
export interface TacticData {
  dailyBudget?: number;
  endDate?: Date;
  id: string;
  name?: string;
  publisherProducts?: string[];
  signals?: string[];
  startDate?: Date;
  status?: string;
  stories?: string[];
  targetPrice?: number;
}

export interface TacticPerformanceData {
  performance: PerformanceData;
  tactic: TacticData;
}

export interface TopTactic {
  cpm: number; // Price in campaign currency
  description: string; // Human-readable description of the tactic
  spend: number; // Amount in campaign currency
  tacticId: string;
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
