import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";
import type {
  ComprehensiveMetrics,
  MetricsConfig,
  ShowMetricsParams,
} from "../../types/metrics.js";

import {
  type FunFact,
  FunFactsGeneratorService,
} from "../../services/metrics/fun-facts-generator.service.js";
import { MetricsCollectorService } from "../../services/metrics/metrics-collector.service.js";
// import { createMCPResponse } from "../../utils/error-handling.js";
import { createLogger } from "../../utils/logging.js";

/**
 * Format comprehensive metrics into a beautiful ASCII dashboard
 */
function formatMetricsResponse(
  metrics: ComprehensiveMetrics,
  funFacts: FunFact[] = [],
): string {
  const lastRefreshed = getTimeAgo(metrics.collected_at);
  const refreshSources = metrics.refresh_sources.join(", ");

  let output = `🚀 AGENTIC ADVERTISING PLATFORM METRICS
═══════════════════════════════════════

📊 PLATFORM STATS (Last refreshed: ${lastRefreshed})
`;

  // Platform metrics
  const platform = metrics.platform;
  output += `├─ Brand Agents: ${platform.brand_agents} active`;
  if (metrics.trends?.brand_agents_week) {
    const trend = metrics.trends.brand_agents_week;
    output += ` (${trend.trend_emoji} ${formatTrend(trend)} vs last week)`;
  }
  output += `\n`;

  output += `├─ Campaigns: ${platform.active_campaigns} running, ${platform.draft_campaigns} draft`;
  if (metrics.trends?.campaigns_week) {
    const trend = metrics.trends.campaigns_week;
    output += ` (${trend.trend_emoji} ${formatTrend(trend)})`;
  }
  output += `\n`;

  output += `├─ Creatives: ${platform.total_creatives} total (${platform.video_creatives} video, ${platform.display_creatives} display)\n`;
  output += `├─ Tactics: ${platform.deployed_tactics} deployed\n`;
  output += `├─ Sales Agents: ${platform.active_sales_agents} active\n`;
  output += `├─ Customers: ${platform.customers}\n`;

  if (platform.products_discovered) {
    output += `└─ Products: ${platform.products_discovered.toLocaleString()} discovered\n`;
  }

  // API Usage metrics
  const api = metrics.api_usage;
  output += `\n🔥 API USAGE (Today)\n`;
  output += `├─ Total API Calls: ${api.total_api_calls.toLocaleString()}`;
  if (metrics.trends?.api_calls_day) {
    const trend = metrics.trends.api_calls_day;
    output += ` (${trend.trend_emoji} ${formatTrend(trend)} vs yesterday)`;
  }
  output += `\n`;

  output += `├─ Unique Customers: ${api.unique_customers}\n`;
  output += `├─ Most Used Tool: ${api.most_used_tool} (${api.most_used_tool_count} calls)\n`;
  output += `├─ Success Rate: ${(api.success_rate * 100).toFixed(1)}%\n`;
  output += `├─ Avg Response Time: ${Math.round(api.avg_response_time_ms)}ms\n`;

  if (api.cache_hit_rate) {
    output += `└─ Cache Hit Rate: ${(api.cache_hit_rate * 100).toFixed(1)}%\n`;
  }

  // Tool breakdown
  if (Object.keys(api.tool_breakdown).length > 0) {
    output += `\n📈 TOP TOOLS:\n`;
    const sortedTools = Object.entries(api.tool_breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    sortedTools.forEach(([tool, count], index) => {
      const prefix = index === sortedTools.length - 1 ? "└─" : "├─";
      output += `${prefix} ${tool}: ${count} calls\n`;
    });
  }

  // Community metrics (Slack)
  if (metrics.slack) {
    const slack = metrics.slack;
    output += `\n👥 TEAM METRICS\n`;
    output += `├─ Team Members: ${slack.team_members} people`;
    if (metrics.trends?.slack_members_week) {
      const trend = metrics.trends.slack_members_week;
      output += ` (${trend.trend_emoji} ${formatTrend(trend)} this week)`;
    }
    output += `\n`;

    output += `├─ Total Channels: ${slack.total_channels}\n`;
    output += `├─ Public Channels: ${slack.public_channels}\n`;
    output += `├─ Avg Members/Channel: ${slack.avg_members_per_channel}\n`;
    output += `├─ Largest Channel: ${slack.largest_channel_size} members\n`;
    output += `├─ Messages Today: ${slack.messages_today}\n`;
    output += `├─ Messages This Week: ${slack.messages_this_week}\n`;
    output += `├─ Active Participants Today: ${slack.active_participants_today}\n`;
    if (slack.most_active_channel) {
      output += `└─ Most Active Channel: #${slack.most_active_channel}\n`;
    } else {
      output += `└─ Most Active Channel: N/A\n`;
    }
  }

  // GitHub ecosystem
  if (metrics.github) {
    const github = metrics.github;
    output += `\n🐙 GITHUB ECOSYSTEM\n`;
    output += `├─ ADCP Repository:\n`;
    output += `│  ├─ Open PRs: ${github.adcp_repo.open_prs}\n`;
    output += `│  ├─ Merged This Week: ${github.adcp_repo.merged_prs_this_week}\n`;
    output += `│  ├─ Contributors: ${github.adcp_repo.contributors}\n`;
    output += `│  ├─ Stars: ${github.adcp_repo.stars} ⭐\n`;
    output += `│  └─ Open Issues: ${github.adcp_repo.open_issues}\n`;

    output += `└─ Activation API:\n`;
    output += `   ├─ Open PRs: ${github.activation_api_repo.open_prs}\n`;
    output += `   ├─ Merged This Week: ${github.activation_api_repo.merged_prs_this_week}\n`;
    output += `   ├─ Contributors: ${github.activation_api_repo.contributors}\n`;
    output += `   ├─ Stars: ${github.activation_api_repo.stars} ⭐\n`;
    output += `   └─ Open Issues: ${github.activation_api_repo.open_issues}\n`;

    if (github.adcp_repo.latest_release) {
      output += `   └─ Latest Release: ${github.adcp_repo.latest_release} (${github.adcp_repo.latest_release_days_ago} days ago)\n`;
    }
  }

  // Fun Facts section
  if (funFacts.length > 0) {
    output += `\n✨ BUSINESS INSIGHTS\n`;
    funFacts.forEach((fact, index) => {
      const connector = index === funFacts.length - 1 ? "└─" : "├─";
      output += `${connector} ${fact.emoji} ${fact.text}\n`;
    });
  }

  // Footer
  output += `\n⏱️  Collection time: ${metrics.collection_duration_ms}ms | Sources: ${refreshSources}`;
  output += `\n💡 Tip: Add refresh=true to update these metrics`;

  return output;
}

/**
 * Format trend data for display
 */
function formatTrend(trend: {
  change_percent: number;
  trend_direction: string;
}): string {
  const sign = trend.change_percent >= 0 ? "+" : "";
  return `${sign}${trend.change_percent.toFixed(1)}%`;
}

/**
 * Get metrics configuration from environment variables
 */
function getMetricsConfig(): MetricsConfig {
  return {
    collection_timeout_ms: parseInt(
      process.env.METRICS_COLLECTION_TIMEOUT || "30000",
    ),
    github_activation_repo:
      process.env.GITHUB_ACTIVATION_REPO || "conductor/activation-api",
    github_adcp_repo: process.env.GITHUB_ADCP_REPO || "adcontextprotocol/adcp",
    github_token: process.env.GITHUB_TOKEN,
    max_cache_age_minutes: parseInt(process.env.METRICS_MAX_CACHE_AGE || "15"),
    posthog_project_id: process.env.POSTHOG_PROJECT_ID,
    slack_bot_token: process.env.SLACK_BOT_TOKEN,
  };
}

/**
 * Get human-readable time ago string
 */
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "just now";
  if (diffMinutes === 1) return "1 minute ago";
  if (diffMinutes < 60) return `${diffMinutes} minutes ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export const showAgenticMetricsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Platform Analytics",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Show Agentic Platform Metrics",
  },

  description:
    "Display comprehensive metrics across the Agentic Advertising platform and ecosystem including API usage, community stats, and GitHub activity",

  execute: async (
    args: unknown,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    const params = args as ShowMetricsParams;
    const logger = createLogger("show_agentic_metrics", context);
    const startData = logger.logToolStart(params);

    try {
      const config = getMetricsConfig();
      const metricsCollector = new MetricsCollectorService(
        client.getBigQuery(),
        config,
      );

      let metrics: ComprehensiveMetrics;

      if (params.refresh) {
        // Force refresh - collect fresh metrics from all sources
        logger.logInfo("Forcing refresh of all metrics");

        await metricsCollector.refreshAllMetrics(
          {
            force_refresh: true,
            include_github: params.include_github,
            include_slack: params.include_slack,
          },
          context.session?.customerId,
          "api",
        );

        // Now get the fresh metrics
        metrics = await metricsCollector.getComprehensiveMetrics(
          context.session?.customerId,
          1, // Very recent since we just refreshed
        );
      } else {
        // Use cached metrics
        metrics = await metricsCollector.getComprehensiveMetrics(
          context.session?.customerId,
          params.max_age_minutes || config.max_cache_age_minutes,
        );
      }

      // Generate dynamic fun facts
      const funFactsGenerator = new FunFactsGeneratorService(
        client.getBigQuery(),
      );
      const funFacts = await funFactsGenerator.generateFunFacts();

      const formattedResponse = formatMetricsResponse(metrics, funFacts);

      logger.logToolSuccess({
        metadata: {
          metrics_age_minutes: Math.floor(
            (Date.now() - metrics.collected_at.getTime()) / (1000 * 60),
          ),
          sources_included: Object.keys({
            api_usage: metrics.api_usage,
            platform: metrics.platform,
            ...(metrics.github && { github: metrics.github }),
            ...(metrics.slack && { slack: metrics.slack }),
          }),
        },
        resultSummary: `Displayed metrics from ${metrics.refresh_sources.join(", ")} sources`,
        startTime: startData.startTime,
      });

      return formattedResponse;
    } catch (error) {
      logger.logToolError(error, {
        context: "show_agentic_metrics",
        startTime: startData.startTime,
      });

      throw new Error(`Failed to retrieve metrics: ${error instanceof Error ? error.message : String(error)}

💡 This might be due to:
• Missing environment variables (GITHUB_TOKEN, SLACK_BOT_TOKEN)
• BigQuery connectivity issues
• External API rate limits

Try running with refresh=false to use any cached data.`);
    }
  },

  inputSchema: z.object({
    include_github: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include GitHub repository metrics"),
    include_slack: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include Slack community metrics"),
    max_age_minutes: z
      .number()
      .optional()
      .default(15)
      .describe("Maximum age in minutes for cached metrics"),
    refresh: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Force refresh metrics from all sources (slower but most current)",
      ),
  }),

  name: "show_agentic_metrics",
});
