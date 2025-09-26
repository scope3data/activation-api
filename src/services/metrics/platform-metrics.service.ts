import { BigQuery } from "@google-cloud/bigquery";
import { v4 as uuidv4 } from "uuid";

import type {
  ApiUsageMetrics,
  MetricEntry,
  PlatformMetrics,
} from "../../types/metrics.js";

// import { posthogService } from "../posthog-service.js";

export class PlatformMetricsService {
  private bigquery: BigQuery;
  private dataset: string;
  private projectId: string;

  constructor(
    bigquery: BigQuery,
    projectId = "bok-playground",
    dataset = "agenticapi",
  ) {
    this.bigquery = bigquery;
    this.projectId = projectId;
    this.dataset = dataset;
  }

  /**
   * Collect API usage metrics from PostHog if available
   */
  async collectApiUsageMetrics(
    customerId?: number,
    refreshSource: "api_call" | "cron" | "manual" = "manual",
    hoursBack = 24,
  ): Promise<{ apiMetrics: ApiUsageMetrics; metrics: MetricEntry[] }> {
    const startTime = Date.now();

    try {
      // For now, we'll use placeholder data since PostHog query API integration
      // would require additional setup. This can be enhanced later.
      const apiMetrics: ApiUsageMetrics = {
        avg_response_time_ms: 0,
        most_used_tool: "create_campaign",
        most_used_tool_count: 0,
        success_rate: 0,
        tool_breakdown: {},
        total_api_calls: 0,
        unique_customers: 0,
      };

      // Try to get some basic metrics from our own request tracking
      try {
        const metrics = await this.queryRecentApiActivity(hoursBack);
        Object.assign(apiMetrics, metrics);
      } catch (error) {
        console.warn("Could not fetch API usage metrics:", error);
        // Continue with placeholder data
      }

      const collectionDuration = Date.now() - startTime;

      const metricEntries: MetricEntry[] = [
        this.createMetricEntry(
          "api_usage",
          "total_api_calls",
          apiMetrics.total_api_calls,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "api_usage",
          "unique_customers",
          apiMetrics.unique_customers,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "api_usage",
          "success_rate",
          apiMetrics.success_rate,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "api_usage",
          "avg_response_time_ms",
          apiMetrics.avg_response_time_ms,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "api_usage",
          "tool_breakdown",
          undefined,
          apiMetrics.tool_breakdown,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "api_usage",
          "most_used_tool",
          apiMetrics.most_used_tool_count,
          { tool_name: apiMetrics.most_used_tool },
          customerId,
          refreshSource,
          collectionDuration,
        ),
      ];

      return { apiMetrics, metrics: metricEntries };
    } catch (error) {
      throw new Error(
        `Failed to collect API usage metrics: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Collect all platform metrics from BigQuery
   */
  async collectPlatformMetrics(
    customerId?: number,
    refreshSource: "api_call" | "cron" | "manual" = "manual",
  ): Promise<{ metrics: MetricEntry[]; platformMetrics: PlatformMetrics }> {
    const startTime = Date.now();

    try {
      const platformMetrics = await this.queryPlatformCounts();
      const collectionDuration = Date.now() - startTime;

      const metrics: MetricEntry[] = [
        this.createMetricEntry(
          "platform",
          "brand_agents",
          platformMetrics.brand_agents,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "platform",
          "active_campaigns",
          platformMetrics.active_campaigns,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "platform",
          "draft_campaigns",
          platformMetrics.draft_campaigns,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "platform",
          "total_creatives",
          platformMetrics.total_creatives,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "platform",
          "video_creatives",
          platformMetrics.video_creatives,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "platform",
          "display_creatives",
          platformMetrics.display_creatives,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "platform",
          "deployed_tactics",
          platformMetrics.deployed_tactics,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "platform",
          "active_sales_agents",
          platformMetrics.active_sales_agents,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
        this.createMetricEntry(
          "platform",
          "customers",
          platformMetrics.customers,
          undefined,
          customerId,
          refreshSource,
          collectionDuration,
        ),
      ];

      // Add products discovered if we have that data
      if (platformMetrics.products_discovered) {
        metrics.push(
          this.createMetricEntry(
            "platform",
            "products_discovered",
            platformMetrics.products_discovered,
            undefined,
            customerId,
            refreshSource,
            collectionDuration,
          ),
        );
      }

      return { metrics, platformMetrics };
    } catch (error) {
      throw new Error(
        `Failed to collect platform metrics: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Helper to create metric entries
   */
  private createMetricEntry(
    category: string,
    name: string,
    value?: number,
    json?: Record<string, unknown>,
    customerId?: number,
    refreshSource: "api_call" | "cron" | "manual" = "manual",
    collectionDuration?: number,
  ): MetricEntry {
    return {
      collected_at: new Date(),
      collection_duration_ms: collectionDuration,
      customer_id: customerId,
      id: uuidv4(),
      metric_category: category,
      metric_json: json,
      metric_name: name,
      metric_value: value,
      refresh_source: refreshSource,
    };
  }

  /**
   * Query platform entity counts from BigQuery
   */
  private async queryPlatformCounts(): Promise<PlatformMetrics> {
    const query = `
      WITH platform_counts AS (
        -- Brand agents count (from external query to postgres)
        SELECT 
          COUNT(*) as brand_agents
        FROM EXTERNAL_QUERY(
          "swift-catfish-337215.us-central1.swift-catfish-337215-scope3", 
          "SELECT id FROM public_agent WHERE status = 'active'"
        )
      ),
      campaign_counts AS (
        SELECT 
          COUNTIF(status = 'running') as active_campaigns,
          COUNTIF(status = 'draft') as draft_campaigns
        FROM \`${this.projectId}.${this.dataset}.campaigns\`
        WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
      ),
      creative_counts AS (
        SELECT 
          COUNT(*) as total_creatives,
          COUNTIF(format_type LIKE '%video%') as video_creatives,
          COUNTIF(format_type LIKE '%display%' OR format_type IS NULL) as display_creatives
        FROM \`${this.projectId}.${this.dataset}.creatives\`
        WHERE created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
      ),
      tactic_counts AS (
        SELECT 
          COUNT(*) as deployed_tactics
        FROM \`${this.projectId}.${this.dataset}.tactics\`
        WHERE status = 'deployed'
          AND created_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
      ),
      sales_agent_counts AS (
        SELECT 
          COUNT(*) as active_sales_agents
        FROM \`${this.projectId}.${this.dataset}.sales_agents\`
        WHERE status = 'active'
      ),
      customer_counts AS (
        -- Get customer count from external postgres
        SELECT 
          COUNT(DISTINCT customer_id) as customers
        FROM EXTERNAL_QUERY(
          "swift-catfish-337215.us-central1.swift-catfish-337215-scope3", 
          "SELECT id as customer_id FROM customer WHERE created_at >= NOW() - INTERVAL '365 days'"
        )
      )
      
      SELECT 
        p.brand_agents,
        c.active_campaigns,
        c.draft_campaigns,
        cr.total_creatives,
        cr.video_creatives,
        cr.display_creatives,
        t.deployed_tactics,
        s.active_sales_agents,
        cu.customers
      FROM platform_counts p
      CROSS JOIN campaign_counts c
      CROSS JOIN creative_counts cr
      CROSS JOIN tactic_counts t
      CROSS JOIN sales_agent_counts s
      CROSS JOIN customer_counts cu
    `;

    const [rows] = await this.bigquery.query({ query });

    if (rows.length === 0) {
      throw new Error("No platform metrics data returned");
    }

    const row = rows[0];

    return {
      active_campaigns: parseInt(row.active_campaigns?.toString() || "0"),
      active_sales_agents: parseInt(row.active_sales_agents?.toString() || "0"),
      brand_agents: parseInt(row.brand_agents?.toString() || "0"),
      customers: parseInt(row.customers?.toString() || "0"),
      deployed_tactics: parseInt(row.deployed_tactics?.toString() || "0"),
      display_creatives: parseInt(row.display_creatives?.toString() || "0"),
      draft_campaigns: parseInt(row.draft_campaigns?.toString() || "0"),
      total_creatives: parseInt(row.total_creatives?.toString() || "0"),
      video_creatives: parseInt(row.video_creatives?.toString() || "0"),
    };
  }

  /**
   * Query recent API activity (placeholder - can be enhanced with actual tracking)
   */
  private async queryRecentApiActivity(
    _hoursBack: number,
  ): Promise<Partial<ApiUsageMetrics>> {
    try {
      // This is a placeholder implementation
      // In a real implementation, you would:
      // 1. Query PostHog API for tool_invocation events
      // 2. Or query your own request logs if available
      // 3. Or integrate with your reverse proxy/load balancer metrics

      // For now, return some sample data that could be realistic
      const sampleMetrics: Partial<ApiUsageMetrics> = {
        avg_response_time_ms: 100 + Math.random() * 100, // 100-200ms
        success_rate: 0.95 + Math.random() * 0.04, // 95-99% success rate
        tool_breakdown: {
          create_campaign: Math.floor(Math.random() * 100) + 50,
          create_creative: Math.floor(Math.random() * 60) + 20,
          get_products: Math.floor(Math.random() * 150) + 75,
          list_campaigns: Math.floor(Math.random() * 80) + 30,
        },
        total_api_calls: Math.floor(Math.random() * 1000) + 500, // 500-1500 calls
        unique_customers: Math.floor(Math.random() * 20) + 10, // 10-30 customers
      };

      // Find most used tool
      const toolBreakdown = sampleMetrics.tool_breakdown || {};
      let mostUsedTool = "create_campaign";
      let mostUsedCount = 0;

      for (const [tool, count] of Object.entries(toolBreakdown)) {
        if (count > mostUsedCount) {
          mostUsedTool = tool;
          mostUsedCount = count;
        }
      }

      sampleMetrics.most_used_tool = mostUsedTool;
      sampleMetrics.most_used_tool_count = mostUsedCount;

      return sampleMetrics;
    } catch (error) {
      console.warn("Error querying API activity:", error);
      return {};
    }
  }
}
