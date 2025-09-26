import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";
import type {
  MetricsConfig,
  RefreshMetricsParams,
} from "../../types/metrics.js";

import { MetricsCollectorService } from "../../services/metrics/metrics-collector.service.js";
// import { createMCPResponse } from "../../utils/error-handling.js";
import { createLogger } from "../../utils/logging.js";

/**
 * Format refresh results into a readable response
 */
function formatRefreshResponse(result: {
  collection_duration_ms: number;
  job_id: string;
  metrics_collected: number;
  sources_failed: string[];
  sources_succeeded: string[];
}): string {
  const duration = (result.collection_duration_ms / 1000).toFixed(1);
  const successCount = result.sources_succeeded.length;
  const failedCount = result.sources_failed.length;

  let output = `🔄 **METRICS REFRESH COMPLETED**

**Job ID:** \`${result.job_id}\`
**Duration:** ${duration}s
**Metrics Collected:** ${result.metrics_collected}

📊 **Sources Status:**
`;

  // Show successful sources
  if (successCount > 0) {
    output += `✅ **Successful (${successCount}):** ${result.sources_succeeded.join(", ")}\n`;
  }

  // Show failed sources
  if (failedCount > 0) {
    output += `❌ **Failed (${failedCount}):** ${result.sources_failed.join(", ")}\n`;
  }

  if (failedCount === 0) {
    output += `\n🎉 **All sources refreshed successfully!**`;
  } else if (successCount > 0) {
    output += `\n⚠️  **Partial success** - Some sources failed but core metrics are updated.`;
  } else {
    output += `\n💥 **All sources failed** - Check configuration and connectivity.`;
  }

  output += `\n\n💡 **Next Steps:**
• Run \`show_agentic_metrics\` to see the updated data
• Check environment variables if sources failed
• View collection job details with job ID: \`${result.job_id}\``;

  return output;
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

export const refreshPlatformMetricsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Platform Analytics",
    dangerLevel: "low",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Refresh Platform Metrics",
  },

  description:
    "Force refresh all platform metrics from their sources (BigQuery, GitHub, Slack, PostHog). This updates the cached metrics data.",

  execute: async (
    args: unknown,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    const params = args as RefreshMetricsParams;
    const logger = createLogger("refresh_platform_metrics", context);
    const startData = logger.logToolStart(params);

    try {
      logger.logInfo("Starting metrics refresh", {
        force_refresh: params.force_refresh,
        include_github: params.include_github,
        include_slack: params.include_slack,
      });

      const config = getMetricsConfig();
      const metricsCollector = new MetricsCollectorService(
        client.getBigQuery(),
        config,
      );

      // Test connections first if including external sources
      if (params.include_github || params.include_slack) {
        logger.logInfo("Testing external service connections");
        const connectionTests = await metricsCollector.testConnections();

        // Log warnings for failed connections but don't fail the whole operation
        Object.entries(connectionTests).forEach(([service, result]) => {
          if (!result.success) {
            logger.logWarning(
              `${service} connection test failed: ${result.error}`,
            );
          } else {
            logger.logInfo(`${service} connection test passed`);
          }
        });
      }

      // Perform the refresh
      const refreshResult = await metricsCollector.refreshAllMetrics(
        {
          force_refresh: params.force_refresh,
          include_github: params.include_github,
          include_slack: params.include_slack,
        },
        context.session?.customerId,
        "api", // Triggered via API call
      );

      const formattedResponse = formatRefreshResponse(refreshResult);

      logger.logToolSuccess({
        metadata: {
          collection_duration_ms: refreshResult.collection_duration_ms,
          job_id: refreshResult.job_id,
          metrics_collected: refreshResult.metrics_collected,
          sources_failed: refreshResult.sources_failed,
          sources_succeeded: refreshResult.sources_succeeded,
        },
        resultSummary: `Refreshed ${refreshResult.metrics_collected} metrics from ${refreshResult.sources_succeeded.length} sources`,
        startTime: startData.startTime,
      });

      return formattedResponse;
    } catch (error) {
      logger.logToolError(error, {
        context: "refresh_platform_metrics",
        startTime: startData.startTime,
      });

      throw new Error(`Failed to refresh platform metrics: ${error instanceof Error ? error.message : String(error)}

💡 **Common Issues:**
• **Missing API Keys:** Check GITHUB_TOKEN, SLACK_BOT_TOKEN environment variables
• **BigQuery Access:** Ensure service account has proper permissions
• **Network Issues:** External API services may be temporarily unavailable
• **Rate Limits:** GitHub/Slack APIs may be rate limited

🔧 **Troubleshooting:**
• Run with fewer sources (include_github=false, include_slack=false)
• Check the server logs for detailed error information
• Verify environment configuration`);
    }
  },

  inputSchema: z.object({
    force_refresh: z
      .boolean()
      .optional()
      .default(false)
      .describe("Force refresh even if recent data exists"),
    include_github: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include GitHub repository metrics in refresh"),
    include_slack: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include Slack community metrics in refresh"),
  }),

  name: "refresh_platform_metrics",
});
