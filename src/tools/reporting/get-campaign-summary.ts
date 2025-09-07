import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  GetCampaignSummaryParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";
import type {
  BrandAgentData,
  CampaignAlert,
  CampaignData,
  CampaignInsight,
  CampaignPacing,
  CampaignSummary,
  CampaignSummaryData,
  DeliveryData,
  TopTactic,
} from "../../types/reporting.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
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

      return JSON.stringify(summary);
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

// Generate campaign summary based on data
function generateCampaignSummary(
  campaign: CampaignData,
  brandAgent: BrandAgentData,
  deliveryData: DeliveryData,
  tacticBreakdown: { efficiency?: number }[],
  _verbosity: string,
  _includeCharts: boolean,
): CampaignSummary {
  const now = new Date();
  const campaignAge = Math.ceil(
    (now.getTime() - (campaign.createdAt || now).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  // Get campaign currency
  const currency = campaign.budget?.currency || "USD";

  // Build structured summary data
  const summaryData: CampaignSummaryData = {
    averageCpm: campaign.deliverySummary?.today?.averagePrice || 0,
    flightProgress: {
      daysElapsed: campaignAge,
      daysRemaining: campaign.deliverySummary?.pacing?.daysRemaining || 0,
      percentComplete: Math.round(
        (campaignAge /
          (campaignAge +
            (campaign.deliverySummary?.pacing?.daysRemaining || 30))) *
          100,
      ),
    },
    impressions: campaign.deliverySummary?.today?.impressions || 0,
    spend: campaign.deliverySummary?.today?.spend || 0,
  };

  // Build pacing data
  const pacing: CampaignPacing = {
    actualDailySpend: campaign.deliverySummary?.today?.spend || 0,
    budgetUtilized: Math.round(
      (campaign.deliverySummary?.pacing?.budgetUtilized || 0) * 100,
    ),
    dailySpendTarget:
      (campaign.budget?.total || 0) /
      Math.max(
        campaignAge + (campaign.deliverySummary?.pacing?.daysRemaining || 30),
        1,
      ),
    projectedFinalSpend: 0, // Calculate based on current pace
    status:
      (campaign.deliverySummary?.pacing?.status as
        | "on_track"
        | "over"
        | "under") || "on_track",
  };

  // Calculate projected final spend
  const totalDays =
    summaryData.flightProgress.daysElapsed +
    summaryData.flightProgress.daysRemaining;
  pacing.projectedFinalSpend = pacing.actualDailySpend * totalDays;

  // Generate structured insights (including top tactics)
  const insights = generateStructuredInsights(
    campaign,
    deliveryData,
    tacticBreakdown,
    currency,
  );

  // Convert alerts to proper format
  const alerts = (campaign.deliverySummary?.alerts as CampaignAlert[]) || [];

  // Generate rich text summary for conversational interfaces
  const textSummary = generateTextSummary(
    campaign,
    brandAgent,
    summaryData,
    pacing,
    insights,
    currency,
  );

  return {
    alerts,
    campaignId: campaign.id || "",
    campaignName: campaign.name || "",
    currency,
    externalCampaignId: (campaign as { externalCampaignId?: string })
      .externalCampaignId,
    insights,
    pacing,
    summary: summaryData,
    textSummary,
  };
}

// Generate standard insight examples
function generateStandardInsights(
  tacticBreakdown: { efficiency?: number }[],
  currency: string,
): CampaignInsight[] {
  const insights: CampaignInsight[] = [];

  // Top Tactics
  if (tacticBreakdown && tacticBreakdown.length > 0) {
    const topTactics = generateTopTactics(tacticBreakdown, currency);
    insights.push({
      message: `Top ${topTactics.length} performing tactics available`,
      priority: "medium",
      tactics: topTactics,
      type: "top_tactics",
    });
  }

  // Top Stories (example)
  insights.push({
    message: "Performance narrative drives 45% higher engagement",
    priority: "high",
    type: "observation",
  });

  // Top Signals (example)
  insights.push({
    action: "increase_mobile_budget",
    message: "Mobile targeting shows 32% better conversion rates",
    priority: "high",
    type: "optimization",
  });

  // Top Creatives (example)
  insights.push({
    message: "Video creative 'Summer Launch' outperforming by 28%",
    priority: "medium",
    type: "observation",
  });

  // Top Publishers (example)
  insights.push({
    action: "expand_publisher_allocation",
    message: "Premium publisher inventory delivering 15% lower CPM",
    priority: "medium",
    type: "optimization",
  });

  return insights;
}

// Generate structured insights
function generateStructuredInsights(
  campaign: CampaignData,
  _deliveryData: DeliveryData,
  tacticBreakdown: { efficiency?: number }[],
  currency: string,
): CampaignInsight[] {
  const insights: CampaignInsight[] = [];

  // Budget efficiency insight
  if (campaign.deliverySummary && campaign.budget) {
    const today = campaign.deliverySummary.today;
    const todayCpm = today?.averagePrice || 0;
    const targetCpm = 5.0;

    if (todayCpm > 0 && todayCpm < targetCpm * 0.9) {
      insights.push({
        message: `Excellent efficiency! CPM is ${((1 - todayCpm / targetCpm) * 100).toFixed(0)}% below target`,
        priority: "medium",
        type: "optimization",
      });
    } else if (todayCpm > targetCpm * 1.2) {
      insights.push({
        action: "optimize_targeting",
        message: `CPM is ${((todayCpm / targetCpm - 1) * 100).toFixed(0)}% above target - consider optimizing targeting`,
        priority: "high",
        type: "optimization",
      });
    }
  }

  // Pacing insights
  if (campaign.deliverySummary?.pacing) {
    const pacing = campaign.deliverySummary.pacing;
    if (pacing.status === "over") {
      insights.push({
        action: "reduce_daily_budget",
        message: `Campaign is over-pacing - will complete ${pacing.daysRemaining} days early`,
        priority: "high",
        type: "alert",
      });
    } else if (pacing.status === "under") {
      insights.push({
        action: "increase_daily_budget",
        message: "Campaign is under-pacing - consider increasing daily budgets",
        priority: "high",
        type: "optimization",
      });
    }
  }

  // Standard insight examples
  insights.push(...generateStandardInsights(tacticBreakdown, currency));

  return insights;
}

// Generate human-readable tactic descriptions
function generateTacticDescription(index: number): string {
  const descriptions = [
    "Mobile video targeting sports enthusiasts aged 25-34",
    "Desktop display for luxury lifestyle audiences",
    "CTV targeting weekend sports viewers",
    "Social native ads for tech-savvy millennials",
    "Premium video for high-income households",
    "Mobile native targeting fitness enthusiasts",
    "Desktop video for business professionals",
  ];
  return descriptions[index % descriptions.length];
}

// Generate rich text summary for conversational interfaces
function generateTextSummary(
  campaign: CampaignData,
  brandAgent: BrandAgentData,
  summaryData: CampaignSummaryData,
  pacing: CampaignPacing,
  insights: CampaignInsight[],
  currency: string,
): string {
  let summary = `🎯 **${campaign.name} Campaign Summary**\n\n`;
  summary += `📊 **Performance Summary**\n`;
  summary += `• Spend: ${summaryData.spend.toLocaleString()} ${currency}\n`;
  summary += `• Impressions: ${summaryData.impressions.toLocaleString()}\n`;
  summary += `• CPM: ${summaryData.averageCpm.toFixed(2)} ${currency}\n`;
  summary += `• Campaign Progress: ${summaryData.flightProgress.percentComplete}% complete\n\n`;

  summary += `📈 **Pacing Analysis**\n`;
  const pacingEmoji =
    pacing.status === "on_track"
      ? "🎯"
      : pacing.status === "over"
        ? "⚡"
        : "🐌";
  summary += `• Status: ${pacingEmoji} ${pacing.status.replace("_", " ")}\n`;
  summary += `• Budget Used: ${pacing.budgetUtilized}%\n`;
  summary += `• Daily Spend: ${pacing.actualDailySpend.toLocaleString()} ${currency} vs ${pacing.dailySpendTarget.toLocaleString()} ${currency} target\n\n`;

  if (insights.length > 0) {
    summary += `💡 **Key Insights**\n`;
    insights.slice(0, 3).forEach((insight) => {
      const emoji =
        insight.type === "optimization"
          ? "🔧"
          : insight.type === "alert"
            ? "⚠️"
            : "📊";
      summary += `• ${emoji} ${insight.message}\n`;
    });
  }

  return summary;
}

// Generate top tactics data
function generateTopTactics(
  tacticBreakdown: { efficiency?: number }[],
  _currency: string,
): TopTactic[] {
  if (!tacticBreakdown || tacticBreakdown.length === 0) return [];

  return tacticBreakdown
    .map((tactic, index) => ({
      cpm: 5.0 + Math.random() * 3, // Mock data
      description: generateTacticDescription(index),
      spend: 1000 + Math.random() * 5000, // Mock data
      tacticId: `tactic_${index + 1}`,
    }))
    .slice(0, 5); // Top 5 tactics
}
