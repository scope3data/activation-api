import { BigQuery } from "@google-cloud/bigquery";

import type {
  ComprehensiveMetrics,
  GitHubMetrics,
  MetricEntry,
  MetricsConfig,
  MetricsTrends,
  RefreshMetricsParams,
  SlackMetrics,
  TrendData,
} from "../../types/metrics.js";

import { GitHubMetricsService } from "./github-metrics.service.js";
import { MetricsStorageService } from "./metrics-storage.service.js";
import { PlatformMetricsService } from "./platform-metrics.service.js";
import { SlackMetricsService } from "./slack-metrics.service.js";

export class MetricsCollectorService {
  private config: MetricsConfig;
  private githubService?: GitHubMetricsService;
  private platformService: PlatformMetricsService;
  private slackService?: SlackMetricsService;
  private storageService: MetricsStorageService;

  constructor(
    bigquery: BigQuery,
    config: MetricsConfig,
    projectId = "bok-playground",
    dataset = "agenticapi",
  ) {
    this.config = config;
    this.storageService = new MetricsStorageService(
      bigquery,
      projectId,
      dataset,
    );
    this.platformService = new PlatformMetricsService(
      bigquery,
      projectId,
      dataset,
    );

    // Initialize GitHub service if token is provided
    if (config.github_token) {
      this.githubService = new GitHubMetricsService({
        activation_api_repo: config.github_activation_repo,
        adcp_repo: config.github_adcp_repo,
        token: config.github_token,
      });
    }

    // Initialize Slack service if token is provided
    if (config.slack_bot_token) {
      this.slackService = new SlackMetricsService({
        bot_token: config.slack_bot_token,
      });
    }
  }

  /**
   * Get comprehensive metrics from storage (cached results)
   */
  async getComprehensiveMetrics(
    customerId?: number,
    maxAgeMinutes = 15,
  ): Promise<ComprehensiveMetrics> {
    const startTime = Date.now();

    try {
      // Get latest metrics from storage
      const storedMetrics = await this.storageService.getLatestMetrics({
        customer_id: customerId,
        max_age_minutes: maxAgeMinutes,
      });

      // Group metrics by category
      const metricsByCategory = this.groupMetricsByCategory(storedMetrics);

      // Build comprehensive metrics object
      const platformMetrics = this.extractPlatformMetrics(
        metricsByCategory.platform,
      );
      const apiUsageMetrics = this.extractApiUsageMetrics(
        metricsByCategory.api_usage,
      );
      const githubMetrics = this.extractGitHubMetrics(metricsByCategory.github);
      const slackMetrics = this.extractSlackMetrics(metricsByCategory.slack);

      // Calculate trends if we have historical data
      const trends = await this.calculateTrends(customerId);

      // Get fun facts
      const funFacts = await this.storageService.getRandomFunFacts(3);

      const collectionDuration = Date.now() - startTime;

      return {
        api_usage: apiUsageMetrics,
        collected_at: new Date(),
        collection_duration_ms: collectionDuration,
        fun_facts: funFacts,
        github: githubMetrics as GitHubMetrics | undefined,
        platform: platformMetrics,
        refresh_sources: this.getRefreshSources(storedMetrics),
        slack: slackMetrics as SlackMetrics | undefined,
        trends,
      };
    } catch (error) {
      throw new Error(
        `Failed to get comprehensive metrics: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Refresh all metrics and store them in BigQuery
   */
  async refreshAllMetrics(
    params: RefreshMetricsParams = {},
    customerId?: number,
    triggeredBy: "api" | "cron" | "user" = "user",
  ): Promise<{
    collection_duration_ms: number;
    job_id: string;
    metrics_collected: number;
    sources_failed: string[];
    sources_succeeded: string[];
  }> {
    const startTime = Date.now();
    const refreshSource = triggeredBy === "cron" ? "cron" : "manual";

    // Start collection job tracking
    const jobId = await this.storageService.startCollectionJob({
      job_type: params.force_refresh ? "full_refresh" : "partial_refresh",
      metrics_collected: 0,
      sources_attempted: this.getAttemptedSources(params),
      sources_failed: [],
      sources_succeeded: [],
      started_at: new Date(),
      status: "running",
      triggered_by: triggeredBy,
    });

    const allMetrics: MetricEntry[] = [];
    const sourcesSucceeded: string[] = [];
    const sourcesFailed: string[] = [];
    const errorDetails: Record<string, string> = {};

    try {
      // Collect platform metrics (always included)
      try {
        const { metrics: platformMetrics } =
          await this.platformService.collectPlatformMetrics(
            customerId,
            refreshSource,
          );
        allMetrics.push(...platformMetrics);

        const { metrics: apiMetrics } =
          await this.platformService.collectApiUsageMetrics(
            customerId,
            refreshSource,
          );
        allMetrics.push(...apiMetrics);

        sourcesSucceeded.push("platform");
      } catch (error) {
        sourcesFailed.push("platform");
        errorDetails.platform =
          error instanceof Error ? error.message : String(error);
        console.error("Failed to collect platform metrics:", error);
      }

      // Collect GitHub metrics (if enabled and available)
      if (params.include_github !== false && this.githubService) {
        try {
          const { metrics: githubMetrics } =
            await this.githubService.collectGitHubMetrics(
              customerId,
              refreshSource,
            );
          allMetrics.push(...githubMetrics);
          sourcesSucceeded.push("github");
        } catch (error) {
          sourcesFailed.push("github");
          errorDetails.github =
            error instanceof Error ? error.message : String(error);
          console.error("Failed to collect GitHub metrics:", error);
        }
      }

      // Collect Slack metrics (if enabled and available)
      if (params.include_slack !== false && this.slackService) {
        try {
          const { metrics: slackMetrics } =
            await this.slackService.collectSlackMetrics(
              customerId,
              refreshSource,
            );
          allMetrics.push(...slackMetrics);
          sourcesSucceeded.push("slack");
        } catch (error) {
          sourcesFailed.push("slack");
          errorDetails.slack =
            error instanceof Error ? error.message : String(error);
          console.error("Failed to collect Slack metrics:", error);
        }
      }

      // Store all collected metrics
      if (allMetrics.length > 0) {
        await this.storageService.storeMetrics(allMetrics);
      }

      const collectionDuration = Date.now() - startTime;

      // Complete the collection job
      await this.storageService.completeCollectionJob(jobId, "completed", {
        error_details:
          Object.keys(errorDetails).length > 0 ? errorDetails : undefined,
        metrics_collected: allMetrics.length,
        sources_failed: sourcesFailed,
        sources_succeeded: sourcesSucceeded,
        total_duration_ms: collectionDuration,
      });

      return {
        collection_duration_ms: collectionDuration,
        job_id: jobId,
        metrics_collected: allMetrics.length,
        sources_failed: sourcesFailed,
        sources_succeeded: sourcesSucceeded,
      };
    } catch (error) {
      // Mark job as failed
      await this.storageService.completeCollectionJob(jobId, "failed", {
        error_details:
          Object.keys(errorDetails).length > 0
            ? {
                ...errorDetails,
                storage: error instanceof Error ? error.message : String(error),
              }
            : {
                storage: error instanceof Error ? error.message : String(error),
              },
        metrics_collected: allMetrics.length,
        sources_failed: [...sourcesFailed, "storage"],
        sources_succeeded: sourcesSucceeded,
        total_duration_ms: Date.now() - startTime,
      });

      throw error;
    }
  }

  /**
   * Test all configured external service connections
   */
  async testConnections(): Promise<
    Record<string, { error?: string; success: boolean }>
  > {
    const results: Record<string, { error?: string; success: boolean }> = {};

    if (this.githubService) {
      try {
        const githubTest = await this.githubService.testConnection();
        results.github = githubTest;
      } catch (error) {
        results.github = {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
      }
    }

    if (this.slackService) {
      try {
        const slackTest = await this.slackService.testConnection();
        results.slack = slackTest;
      } catch (error) {
        results.slack = {
          error: error instanceof Error ? error.message : String(error),
          success: false,
        };
      }
    }

    return results;
  }

  /**
   * Calculate trend data from current and previous values
   */
  private calculateTrendData(current: number, previous: number): TrendData {
    const change = current - previous;
    const changePercent = previous > 0 ? (change / previous) * 100 : 0;

    let trendDirection: "down" | "flat" | "up" = "flat";
    let trendEmoji: "➡️" | "📈" | "📉" = "➡️";

    if (Math.abs(changePercent) > 1) {
      // Only show trend if change is > 1%
      if (changePercent > 0) {
        trendDirection = "up";
        trendEmoji = "📈";
      } else {
        trendDirection = "down";
        trendEmoji = "📉";
      }
    }

    return {
      change_percent: Math.round(changePercent * 100) / 100,
      current,
      previous,
      trend_direction: trendDirection,
      trend_emoji: trendEmoji,
    };
  }

  /**
   * Calculate trends for key metrics
   */
  private async calculateTrends(
    _customerId?: number,
  ): Promise<MetricsTrends | undefined> {
    try {
      const trendMetrics = await this.storageService.getMetricsTrends([
        "brand_agents",
        "active_campaigns",
        "total_api_calls",
        "channel_members",
      ]);

      const trends: Partial<MetricsTrends> = {};

      trendMetrics.forEach((metric) => {
        const trendData = this.calculateTrendData(
          metric.current_value,
          metric.previous_value,
        );

        switch (metric.metric_name) {
          case "active_campaigns":
            trends.campaigns_week = trendData;
            break;
          case "brand_agents":
            trends.brand_agents_week = trendData;
            break;
          case "channel_members":
            trends.slack_members_week = trendData;
            break;
          case "total_api_calls":
            trends.api_calls_day = trendData;
            break;
        }
      });

      return Object.keys(trends).length > 0
        ? (trends as MetricsTrends)
        : undefined;
    } catch (error) {
      console.warn("Could not calculate trends:", error);
      return undefined;
    }
  }

  private extractApiUsageMetrics(metrics: MetricEntry[] = []) {
    const getValue = (name: string) =>
      metrics.find((m) => m.metric_name === name)?.metric_value || 0;

    const toolBreakdown =
      metrics.find((m) => m.metric_name === "tool_breakdown")?.metric_json ||
      {};

    const mostUsedToolData = metrics.find(
      (m) => m.metric_name === "most_used_tool",
    )?.metric_json as {
      tool_name?: string;
    };

    return {
      avg_response_time_ms: getValue("avg_response_time_ms"),
      most_used_tool: mostUsedToolData?.tool_name || "unknown",
      most_used_tool_count: getValue("most_used_tool"),
      success_rate: getValue("success_rate"),
      tool_breakdown: toolBreakdown as Record<string, number>,
      total_api_calls: getValue("total_api_calls"),
      unique_customers: getValue("unique_customers"),
    };
  }

  private extractGitHubMetrics(metrics: MetricEntry[] = []) {
    if (metrics.length === 0) return undefined;

    const allRepos = metrics.find(
      (m) => m.metric_name === "all_repositories",
    )?.metric_json;
    return allRepos ? (allRepos as Record<string, unknown>) : undefined;
  }

  /**
   * Helper methods to extract specific metric types
   */
  private extractPlatformMetrics(metrics: MetricEntry[] = []) {
    const getValue = (name: string) =>
      metrics.find((m) => m.metric_name === name)?.metric_value || 0;

    return {
      active_campaigns: getValue("active_campaigns"),
      active_sales_agents: getValue("active_sales_agents"),
      brand_agents: getValue("brand_agents"),
      customers: getValue("customers"),
      deployed_tactics: getValue("deployed_tactics"),
      display_creatives: getValue("display_creatives"),
      draft_campaigns: getValue("draft_campaigns"),
      products_discovered: getValue("products_discovered") || undefined,
      total_creatives: getValue("total_creatives"),
      video_creatives: getValue("video_creatives"),
    };
  }

  private extractSlackMetrics(metrics: MetricEntry[] = []) {
    if (metrics.length === 0) return undefined;

    const allMetrics = metrics.find(
      (m) => m.metric_name === "all_metrics",
    )?.metric_json;
    return allMetrics ? (allMetrics as Record<string, unknown>) : undefined;
  }

  /**
   * Get list of sources that would be attempted
   */
  private getAttemptedSources(params: RefreshMetricsParams): string[] {
    const sources = ["platform"];

    if (params.include_github !== false && this.githubService) {
      sources.push("github");
    }

    if (params.include_slack !== false && this.slackService) {
      sources.push("slack");
    }

    return sources;
  }

  /**
   * Get list of refresh sources from stored metrics
   */
  private getRefreshSources(metrics: MetricEntry[]): string[] {
    const sources = new Set(metrics.map((m) => m.refresh_source));
    return Array.from(sources);
  }

  /**
   * Group metrics by category
   */
  private groupMetricsByCategory(
    metrics: MetricEntry[],
  ): Record<string, MetricEntry[]> {
    return metrics.reduce(
      (groups, metric) => {
        const category = metric.metric_category;
        if (!groups[category]) {
          groups[category] = [];
        }
        groups[category].push(metric);
        return groups;
      },
      {} as Record<string, MetricEntry[]>,
    );
  }
}
