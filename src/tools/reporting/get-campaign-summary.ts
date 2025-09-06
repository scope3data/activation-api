import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  GetCampaignSummaryParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";
import type { CampaignSummary } from "../../types/reporting.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const getCampaignSummaryTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "reporting",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Get Campaign Summary",
  },

  description:
    "Get a natural language summary of campaign performance with insights and visualizations. Perfect for casual users asking 'how's my campaign doing?'. Includes pacing, performance metrics, tactic breakdown, and actionable recommendations.",

  execute: async (
    args: GetCampaignSummaryParams,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check session context first, then fall back to environment variable
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      return createAuthErrorResponse();
    }

    try {
      // Get campaign with delivery summary
      const campaign = await client.getBrandAgentCampaign(
        apiKey,
        args.campaignId,
      );

      if (!campaign) {
        return createErrorResponse(
          "Campaign not found. Please check the campaign ID.",
          new Error("Campaign not found"),
        );
      }

      // Get brand agent name for context
      const brandAgent = await client.getBrandAgent(
        apiKey,
        campaign.brandAgentId,
      );

      // Generate delivery data for the requested date range
      const dateRange = {
        end: args.dateRange?.end ? new Date(args.dateRange.end) : new Date(),
        start: args.dateRange?.start
          ? new Date(args.dateRange.start)
          : campaign.createdAt,
      };

      // Get campaign delivery metrics
      const deliveryData = await client.getCampaignDeliveryData(
        apiKey,
        args.campaignId,
        dateRange,
      );

      // Get tactic breakdown
      const tacticBreakdown = await client.getTacticBreakdown(
        apiKey,
        args.campaignId,
        dateRange,
      );

      // Generate summary based on verbosity
      const summary = generateCampaignSummary(
        campaign,
        brandAgent,
        deliveryData,
        tacticBreakdown,
        args.verbosity || "detailed",
        args.includeCharts || true,
      );

      return createMCPResponse({
        message: formatSummaryResponse(summary),
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to generate campaign summary", error);
    }
  },

  name: "get_campaign_summary",
  parameters: z.object({
    campaignId: z.string().describe("Campaign ID to analyze"),
    dateRange: z
      .object({
        end: z
          .string()
          .optional()
          .describe("End date (YYYY-MM-DD), defaults to today"),
        start: z
          .string()
          .optional()
          .describe("Start date (YYYY-MM-DD), defaults to campaign start"),
      })
      .optional(),
    includeCharts: z
      .boolean()
      .optional()
      .describe("Generate ASCII/markdown charts for visualization"),
    verbosity: z
      .enum(["brief", "detailed", "executive"])
      .optional()
      .describe("Summary detail level"),
  }),
});

function formatSummaryResponse(summary: CampaignSummary): string {
  let response = summary.summary;

  // Add insights
  if (summary.insights.length > 0) {
    response += `### 🔍 Key Insights\n`;
    for (const insight of summary.insights) {
      response += `• ${insight}\n`;
    }
    response += `\n`;
  }

  // Add alerts
  if (summary.alerts.length > 0) {
    response += `### 🚨 Active Alerts\n`;
    for (const alert of summary.alerts) {
      const emoji =
        alert.severity === "critical"
          ? "🚨"
          : alert.severity === "warning"
            ? "⚠️"
            : "ℹ️";
      response += `• ${emoji} ${alert.message}\n`;
    }
    response += `\n`;
  }

  // Add charts
  if (summary.charts) {
    if (summary.charts.spendTrend) {
      response += `### 📊 Charts\n\n`;
      response += "```\n" + summary.charts.spendTrend + "\n```\n\n";
    }
    if (summary.charts.tacticAllocation) {
      response += "```\n" + summary.charts.tacticAllocation + "\n```\n\n";
    }
  }

  // Add next steps
  if (summary.nextSteps && summary.nextSteps.length > 0) {
    response += `### 🎯 Recommended Next Steps\n`;
    for (const step of summary.nextSteps) {
      response += `• ${step}\n`;
    }
    response += `\n`;
  }

  response += `*Generated at ${summary.generatedAt.toLocaleString()}*`;

  return response;
}

// Generate campaign summary based on data
function generateCampaignSummary(
  campaign: Record<string, unknown>,
  brandAgent: Record<string, unknown>,
  deliveryData: Record<string, unknown>,
  tacticBreakdown: Record<string, unknown>[],
  verbosity: string,
  includeCharts: boolean,
): CampaignSummary {
  const now = new Date();
  const campaignAge = Math.ceil(
    (now.getTime() - campaign.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );

  // Base summary
  let summaryText = `## 📊 ${campaign.name} Campaign Summary\n\n`;
  summaryText += `**Brand Agent**: ${brandAgent.name}\n`;
  summaryText += `**Status**: ${getStatusEmoji(campaign.deliverySummary?.status)} ${campaign.deliverySummary?.status || campaign.status}\n`;
  summaryText += `**Campaign Age**: ${campaignAge} days\n\n`;

  // Health score
  if (campaign.deliverySummary?.healthScore) {
    const healthEmoji =
      campaign.deliverySummary.healthScore === "healthy"
        ? "✅"
        : campaign.deliverySummary.healthScore === "warning"
          ? "⚠️"
          : "🚨";
    summaryText += `**Health Score**: ${healthEmoji} ${campaign.deliverySummary.healthScore}\n\n`;
  }

  // Budget and pacing
  if (campaign.budget && campaign.deliverySummary?.pacing) {
    const pacing = campaign.deliverySummary.pacing;
    const pacingEmoji =
      pacing.status === "on_track"
        ? "🎯"
        : pacing.status === "over"
          ? "⚡"
          : "🐌";

    summaryText += `### 💰 Budget & Pacing\n`;
    summaryText += `• **Total Budget**: ${campaign.budget.total.toLocaleString()} ${campaign.budget.currency}\n`;
    summaryText += `• **Utilization**: ${(pacing.budgetUtilized * 100).toFixed(1)}%\n`;
    summaryText += `• **Pacing**: ${pacingEmoji} ${pacing.status.replace("_", " ")}\n`;
    summaryText += `• **Days Remaining**: ${pacing.daysRemaining}\n`;
    summaryText += `• **Projected End**: ${pacing.projectedCompletion.toLocaleDateString()}\n\n`;
  }

  // Today's performance
  if (campaign.deliverySummary?.today) {
    const today = campaign.deliverySummary.today;
    summaryText += `### 📈 Today's Performance\n`;
    summaryText += `• **Spend**: ${today.spend.toLocaleString()} ${campaign.budget?.currency || "USD"}\n`;
    summaryText += `• **Impressions**: ${today.impressions.toLocaleString()}\n`;
    summaryText += `• **Average Price**: ${today.averagePrice.toFixed(2)} CPM\n\n`;
  }

  // Generate insights
  const insights = generateInsights(campaign, deliveryData, tacticBreakdown);

  // Alerts
  const alerts = campaign.deliverySummary?.alerts || [];

  // Next steps
  const nextSteps = generateNextSteps(
    campaign,
    deliveryData,
    tacticBreakdown,
    insights,
  );

  // Charts (if requested)
  let charts;
  if (includeCharts) {
    charts = generateCharts(deliveryData, tacticBreakdown);
  }

  return {
    alerts,
    campaignId: campaign.id,
    campaignName: campaign.name,
    charts,
    generatedAt: now,
    insights,
    nextSteps,
    summary: summaryText,
  };
}

function generateCharts(
  deliveryData: Record<string, unknown>,
  tacticBreakdown: Record<string, unknown>[],
): Record<string, unknown> {
  const charts: Record<string, unknown> = {};

  // Simple ASCII chart for spend trend (placeholder)
  if (deliveryData?.dailySpend) {
    charts.spendTrend = generateSpendTrendChart(
      deliveryData.dailySpend as Record<string, unknown>[],
    );
  }

  // Tactic allocation chart
  if (tacticBreakdown) {
    charts.tacticAllocation = generateTacticAllocationChart(tacticBreakdown);
  }

  return charts;
}

function generateInsights(
  campaign: Record<string, unknown>,
  _deliveryData: Record<string, unknown>,
  tacticBreakdown: Record<string, unknown>[],
): string[] {
  const insights: string[] = [];

  // Budget efficiency insight
  if (campaign.deliverySummary && campaign.budget) {
    const deliverySummary = campaign.deliverySummary as Record<string, unknown>;
    const today = deliverySummary.today as Record<string, unknown>;
    const todayCpm = today?.averagePrice as number;
    const targetCpm = 3.5; // Could be from campaign config

    if (todayCpm < targetCpm * 0.9) {
      insights.push(
        `🎯 Excellent efficiency! Your CPM is ${((1 - todayCpm / targetCpm) * 100).toFixed(0)}% below target`,
      );
    } else if (todayCpm > targetCpm * 1.1) {
      insights.push(
        `💡 CPM is ${((todayCpm / targetCpm - 1) * 100).toFixed(0)}% above target - consider optimizing targeting`,
      );
    }
  }

  // Pacing insights
  if (campaign.deliverySummary) {
    const deliverySummary = campaign.deliverySummary as Record<string, unknown>;
    const pacing = deliverySummary.pacing as Record<string, unknown>;
    if (pacing?.status === "over") {
      insights.push(
        `⚡ Campaign is over-pacing - will complete ${pacing.daysRemaining} days early`,
      );
    } else if (pacing?.status === "under") {
      insights.push(
        `🐌 Campaign is under-pacing - consider increasing daily budgets`,
      );
    }
  }

  // Tactic performance insights
  if (tacticBreakdown && tacticBreakdown.length > 1) {
    const bestTactic = tacticBreakdown.reduce(
      (best: Record<string, unknown>, current: Record<string, unknown>) =>
        ((current.efficiency as number) || 0) >
        ((best.efficiency as number) || 0)
          ? current
          : best,
    );
    insights.push(
      `🏆 Best performing tactic: "${bestTactic.name}" with ${((bestTactic.efficiency as number) * 100).toFixed(0)}% efficiency`,
    );
  }

  return insights;
}

function generateNextSteps(
  campaign: Record<string, unknown>,
  _deliveryData: Record<string, unknown>,
  tacticBreakdown: Record<string, unknown>[],
  _insights: string[],
): string[] {
  const nextSteps: string[] = [];

  // Based on pacing status
  if (campaign.deliverySummary?.pacing?.status === "over") {
    nextSteps.push(
      "Consider reducing daily budgets to extend campaign duration",
    );
  } else if (campaign.deliverySummary?.pacing?.status === "under") {
    nextSteps.push(
      "Increase daily budgets or expand targeting to improve delivery",
    );
  }

  // Based on alerts
  const alerts = campaign.deliverySummary?.alerts || [];
  const criticalAlerts = alerts.filter(
    (a: Record<string, unknown>) => a.severity === "critical",
  );
  if (criticalAlerts.length > 0) {
    nextSteps.push("Address critical alerts to prevent campaign disruption");
  }

  // Performance optimization
  if (tacticBreakdown && tacticBreakdown.length > 1) {
    const underperforming = tacticBreakdown.filter(
      (t: Record<string, unknown>) => (t.efficiency || 0) < 0.5,
    );
    if (underperforming.length > 0) {
      nextSteps.push(
        "Review underperforming tactics and consider budget reallocation",
      );
    }
  }

  return nextSteps;
}

function generateSpendTrendChart(
  dailySpend: Record<string, unknown>[],
): string {
  if (!dailySpend || dailySpend.length === 0) return "";

  const maxSpend = Math.max(...dailySpend.map((d) => d.spend as number));
  const chartHeight = 5;

  let chart = "Daily Spend Trend (Last 7 Days)\n";
  chart += `$${maxSpend.toLocaleString()} |`;

  for (const day of dailySpend.slice(-7)) {
    const barHeight = Math.round(
      ((day.spend as number) / maxSpend) * chartHeight,
    );
    chart += barHeight > 3 ? "█" : barHeight > 1 ? "▄" : "▁";
  }

  chart += "\n" + " ".repeat(chart.indexOf("|") + 1);
  for (let i = 0; i < Math.min(7, dailySpend.length); i++) {
    chart += ["M", "T", "W", "T", "F", "S", "S"][i % 7];
  }

  return chart;
}

function generateTacticAllocationChart(
  tacticBreakdown: Record<string, unknown>[],
): string {
  if (!tacticBreakdown || tacticBreakdown.length === 0) return "";

  let chart = "Budget Allocation by Tactic\n";
  const total = tacticBreakdown.reduce(
    (sum, t) => sum + ((t.spend as number) || 0),
    0,
  );

  for (const tactic of tacticBreakdown) {
    const percentage = total > 0 ? ((tactic.spend as number) / total) * 100 : 0;
    const barLength = Math.round(percentage / 5); // Each █ = 5%
    const bar = "█".repeat(barLength);
    chart += `├── ${(tactic.name as string) || "Unnamed"} (${percentage.toFixed(0)}%): ${bar}\n`;
  }

  return chart;
}

function getStatusEmoji(status?: string): string {
  switch (status) {
    case "completed":
      return "✅";
    case "delivering":
      return "🚀";
    case "paused":
      return "⏸️";
    case "scheduled":
      return "⏰";
    default:
      return "📊";
  }
}
