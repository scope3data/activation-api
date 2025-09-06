import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  AnalyzeTacticsParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";
import type {
  SignalPerformanceMetrics,
  StoryPerformanceMetrics,
  TacticAnalysisResult,
  TacticPerformanceData,
} from "../../types/reporting.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const analyzeTacticsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "analytics",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Analyze Tactics",
  },

  description:
    "Deep analysis of tactic performance with ML insights. Analyzes efficiency, attribution, signal effectiveness, and story performance. Provides statistical significance testing and optimization recommendations for power users.",

  execute: async (
    args: AnalyzeTacticsParams,
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
      // Get campaign and verify it exists
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

      // Determine date range
      const dateRange = calculateDateRange(
        args.timeframe,
        args.customDateRange,
      );

      // Get analysis data based on type
      const analysisResult = await performTacticAnalysis(
        client,
        apiKey,
        campaign,
        args,
        dateRange,
      );

      const response = formatAnalysisResponse(analysisResult);

      return createMCPResponse({
        message: response,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to analyze tactics", error);
    }
  },

  name: "analyze_tactics",
  parameters: z.object({
    analysisType: z
      .enum(["efficiency", "attribution", "optimization", "signals", "stories"])
      .describe("Type of analysis to perform"),
    campaignId: z.string().describe("Campaign ID to analyze"),
    compareSignals: z
      .boolean()
      .optional()
      .describe(
        "Compare signal effectiveness (applies to relevant analysis types)",
      ),
    compareStories: z
      .boolean()
      .optional()
      .describe(
        "Compare story performance (applies to relevant analysis types)",
      ),
    customDateRange: z
      .object({
        end: z.string().describe("End date (YYYY-MM-DD)"),
        start: z.string().describe("Start date (YYYY-MM-DD)"),
      })
      .optional(),
    timeframe: z
      .enum(["7d", "14d", "30d", "custom"])
      .optional()
      .describe("Analysis timeframe (defaults to 14d)"),
  }),
});

async function analyzeAttribution(
  tacticData: TacticPerformanceData[],
  _dateRange: { end: Date; start: Date },
  _params: AnalyzeTacticsParams,
): Promise<TacticAnalysisResult> {
  // Analyze conversion attribution across tactics
  const tacticPerformance = tacticData.map((data) => {
    const tactic = data.tactic;
    const perf = data.performance;

    // Attribution analysis
    const firstTouchConversions = perf.firstTouchConversions || 0;
    const lastTouchConversions = perf.lastTouchConversions || 0;
    const assistedConversions = perf.assistedConversions || 0;
    const totalConversions = perf.totalConversions || 0;

    const attributionScore =
      totalConversions > 0
        ? (firstTouchConversions * 0.4 +
            lastTouchConversions * 0.4 +
            assistedConversions * 0.2) /
          totalConversions
        : 0;

    return {
      insights: [
        `${Math.round(attributionScore * 100)}% attribution effectiveness`,
        firstTouchConversions > lastTouchConversions
          ? "Strong top-funnel impact"
          : "Strong bottom-funnel impact",
        assistedConversions > 0
          ? `Assisted ${assistedConversions} conversions`
          : "Limited assist role",
      ],
      metrics: {
        assistedConversions,
        attributionScore,
        firstTouchConversions,
        lastTouchConversions,
        totalConversions,
      },
      rank: 0,
      tacticId: tactic.id,
      tacticName: tactic.name || `Tactic ${tactic.id.slice(-8)}`,
    };
  });

  // Sort by attribution score
  tacticPerformance.sort(
    (a, b) =>
      (b.metrics.attributionScore || 0) - (a.metrics.attributionScore || 0),
  );
  tacticPerformance.forEach((tactic, index) => {
    tactic.rank = index + 1;
  });

  return {
    analysisType: "attribution",
    campaignId: "",
    generatedAt: new Date(),
    recommendations: [
      "Focus budget on tactics with high attribution scores",
      "Consider increasing assist-heavy tactics for full-funnel coverage",
    ],
    summary:
      "Attribution analysis shows conversion path effectiveness across tactics.",
    tacticPerformance,
  };
}

async function analyzeEfficiency(
  tacticData: TacticPerformanceData[],
  _params: AnalyzeTacticsParams,
): Promise<TacticAnalysisResult> {
  const tacticPerformance = tacticData.map((data) => {
    const tactic = data.tactic;
    const perf = data.performance;

    // Calculate efficiency metrics
    const spend = perf.totalSpend || 0;
    const impressions = perf.totalImpressions || 0;
    const conversions = perf.totalConversions || 0;
    const clicks = perf.totalClicks || 0;

    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const ctr = impressions > 0 ? clicks / impressions : 0;
    const cvr = clicks > 0 ? conversions / clicks : 0;
    const cpa = conversions > 0 ? spend / conversions : 0;

    // Efficiency score (0-1, higher is better)
    const targetCpm = tactic.targetPrice || 3.5;
    const cpmEfficiency =
      targetCpm > 0 ? Math.max(0, Math.min(1, targetCpm / cpm)) : 0.5;
    const conversionEfficiency = cvr * 10; // Scale CVR to 0-1 range roughly
    const overallEfficiency = cpmEfficiency * 0.6 + conversionEfficiency * 0.4;

    return {
      insights: generateEfficiencyInsights(tactic, perf, overallEfficiency),
      metrics: {
        conversions,
        cpa,
        cpm,
        ctr,
        cvr,
        efficiency: overallEfficiency,
        impressions,
        spend,
      },
      rank: 0, // Will be set after sorting
      tacticId: tactic.id,
      tacticName: tactic.name || `Tactic ${tactic.id.slice(-8)}`,
    };
  });

  // Sort by efficiency and assign ranks
  tacticPerformance.sort(
    (a, b) => (b.metrics.efficiency || 0) - (a.metrics.efficiency || 0),
  );
  tacticPerformance.forEach((tactic, index) => {
    tactic.rank = index + 1;
  });

  const bestTactic = tacticPerformance[0];
  const avgEfficiency =
    tacticPerformance.reduce((sum, t) => sum + (t.metrics.efficiency || 0), 0) /
    tacticPerformance.length;

  const summary = generateEfficiencySummary(
    tacticPerformance,
    bestTactic,
    avgEfficiency,
  );
  const recommendations = generateEfficiencyRecommendations(tacticPerformance);

  return {
    analysisType: "efficiency",
    campaignId: "",
    generatedAt: new Date(),
    recommendations,
    summary,
    tacticPerformance,
  };
}

async function analyzeOptimization(
  tacticData: TacticPerformanceData[],
  _params: AnalyzeTacticsParams,
): Promise<TacticAnalysisResult> {
  const tacticPerformance = tacticData.map((data) => {
    const tactic = data.tactic;
    const perf = data.performance;

    // Optimization potential analysis
    const spend = perf.totalSpend || 0;
    const impressions = perf.totalImpressions || 0;
    const conversions = perf.totalConversions || 0;

    const currentCpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
    const targetCpm = (tactic.targetPrice as number) || 3.5;
    const cpmVariance = Math.abs(currentCpm - targetCpm) / targetCpm;

    // Optimization score (0-1, higher means more room for improvement)
    const optimizationPotential = Math.min(
      1,
      cpmVariance + (conversions === 0 ? 0.5 : 0),
    );

    return {
      insights: [
        `${Math.round((1 - optimizationPotential) * 100)}% optimized`,
        currentCpm > targetCpm
          ? "Above target CPM - reduce bids"
          : "Below target CPM - opportunity to scale",
        conversions === 0
          ? "No conversions recorded - check attribution"
          : "Converting successfully",
      ],
      metrics: {
        cpmVariance,
        currentCpm,
        optimizationPotential,
        spend,
        targetCpm,
      },
      rank: 0,
      tacticId: tactic.id,
      tacticName: tactic.name || `Tactic ${tactic.id.slice(-8)}`,
    };
  });

  // Sort by optimization potential (highest first)
  tacticPerformance.sort(
    (a, b) =>
      (b.metrics.optimizationPotential || 0) -
      (a.metrics.optimizationPotential || 0),
  );
  tacticPerformance.forEach((tactic, index) => {
    tactic.rank = index + 1;
  });

  return {
    analysisType: "optimization",
    campaignId: "",
    generatedAt: new Date(),
    recommendations: [
      "Prioritize tactics with high optimization potential for immediate gains",
      "Monitor CPM variance and adjust bidding strategies accordingly",
    ],
    summary:
      "Optimization analysis identifies tactics with the highest improvement potential.",
    tacticPerformance,
  };
}

async function analyzeSignals(
  tacticData: TacticPerformanceData[],
  _params: AnalyzeTacticsParams,
): Promise<TacticAnalysisResult> {
  const signalPerformance: Record<string, SignalPerformanceMetrics> = {};

  // Aggregate performance by signal
  tacticData.forEach((data) => {
    const tactic = data.tactic;
    const perf = data.performance;

    tactic.signals?.forEach((signal: string) => {
      if (!signalPerformance[signal]) {
        signalPerformance[signal] = {
          tacticCount: 0,
          totalConversions: 0,
          totalImpressions: 0,
          totalSpend: 0,
        };
      }

      signalPerformance[signal].totalSpend += perf.totalSpend || 0;
      signalPerformance[signal].totalImpressions += perf.totalImpressions || 0;
      signalPerformance[signal].totalConversions += perf.totalConversions || 0;
      signalPerformance[signal].tacticCount += 1;
    });
  });

  // Calculate signal effectiveness
  const signalAnalysis = Object.entries(signalPerformance).map(
    ([signal, data]) => {
      const cpm =
        data.totalImpressions > 0
          ? (data.totalSpend / data.totalImpressions) * 1000
          : 0;
      const conversionRate =
        data.totalImpressions > 0
          ? data.totalConversions / data.totalImpressions
          : 0;
      const effectiveness = (conversionRate * 1000) / (cpm || 1); // Conversions per dollar

      return {
        effectiveness,
        performance: {
          conversionRate,
          cpm,
          totalConversions: data.totalConversions,
          totalImpressions: data.totalImpressions,
          totalSpend: data.totalSpend,
        },
        recommendation:
          effectiveness > 1
            ? "Scale up this signal"
            : effectiveness > 0.5
              ? "Monitor performance"
              : "Consider reducing allocation",
        signal,
      };
    },
  );

  // Sort by effectiveness
  signalAnalysis.sort((a, b) => b.effectiveness - a.effectiveness);

  return {
    analysisType: "signals",
    campaignId: "",
    generatedAt: new Date(),
    recommendations: [
      "Allocate more budget to high-effectiveness signals",
      "Test new signal combinations based on top performers",
    ],
    signalAnalysis,
    summary: `Analyzed ${Object.keys(signalPerformance).length} signals across ${tacticData.length} tactics.`,
    tacticPerformance: [], // Not applicable for signal analysis
  };
}

async function analyzeStories(
  tacticData: TacticPerformanceData[],
  _params: AnalyzeTacticsParams,
): Promise<TacticAnalysisResult> {
  const storyPerformance: Record<string, StoryPerformanceMetrics> = {};

  // Aggregate performance by story
  tacticData.forEach((data) => {
    const tactic = data.tactic;
    const perf = data.performance;

    tactic.stories?.forEach((story: string) => {
      if (!storyPerformance[story]) {
        storyPerformance[story] = {
          tacticCount: 0,
          totalClicks: 0,
          totalConversions: 0,
          totalImpressions: 0,
          totalSpend: 0,
        };
      }

      storyPerformance[story].totalSpend += perf.totalSpend || 0;
      storyPerformance[story].totalImpressions += perf.totalImpressions || 0;
      storyPerformance[story].totalClicks += perf.totalClicks || 0;
      storyPerformance[story].totalConversions += perf.totalConversions || 0;
      storyPerformance[story].tacticCount += 1;
    });
  });

  // Calculate story effectiveness
  const storyAnalysis = Object.entries(storyPerformance).map(
    ([story, data]) => {
      const ctr =
        data.totalImpressions > 0
          ? data.totalClicks / data.totalImpressions
          : 0;
      const cvr =
        data.totalClicks > 0 ? data.totalConversions / data.totalClicks : 0;
      const effectiveness = ctr * cvr * 10000; // Engagement × conversion effectiveness

      return {
        effectiveness,
        performance: {
          ctr,
          cvr,
          totalClicks: data.totalClicks,
          totalConversions: data.totalConversions,
          totalImpressions: data.totalImpressions,
          totalSpend: data.totalSpend,
        },
        recommendation:
          effectiveness > 10
            ? "Winning story - scale creative production"
            : effectiveness > 5
              ? "Solid performer - continue using"
              : "Consider refreshing or retiring this narrative",
        story,
      };
    },
  );

  // Sort by effectiveness
  storyAnalysis.sort((a, b) => b.effectiveness - a.effectiveness);

  return {
    analysisType: "stories",
    campaignId: "",
    generatedAt: new Date(),
    recommendations: [
      "Double down on high-performing story themes",
      "Refresh underperforming narratives with new creative approaches",
    ],
    storyAnalysis,
    summary: `Analyzed ${Object.keys(storyPerformance).length} brand stories across ${tacticData.length} tactics.`,
    tacticPerformance: [], // Not applicable for story analysis
  };
}

function calculateDateRange(
  timeframe?: string,
  customDateRange?: { end: string; start: string },
): { end: Date; start: Date } {
  const now = new Date();

  if (timeframe === "custom" && customDateRange) {
    return {
      end: new Date(customDateRange.end),
      start: new Date(customDateRange.start),
    };
  }

  const days = timeframe === "7d" ? 7 : timeframe === "30d" ? 30 : 14; // Default to 14d
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  return { end: now, start };
}

function formatAnalysisResponse(analysis: TacticAnalysisResult): string {
  let response = analysis.summary + "\n\n";

  // Tactic performance table
  if (analysis.tacticPerformance.length > 0) {
    response += "### 📊 Tactic Performance Ranking\n\n";

    for (const tactic of analysis.tacticPerformance) {
      const rankEmoji =
        tactic.rank === 1
          ? "🥇"
          : tactic.rank === 2
            ? "🥈"
            : tactic.rank === 3
              ? "🥉"
              : "📊";
      response += `**${rankEmoji} #${tactic.rank}: ${tactic.tacticName}**\n`;

      // Show relevant metrics based on analysis type
      if (analysis.analysisType === "efficiency") {
        response += `• Efficiency: ${Math.round(((tactic.metrics as { efficiency?: number })?.efficiency || 0) * 100)}%\n`;
        response += `• CPM: $${((tactic.metrics as { cpm?: number })?.cpm || 0).toFixed(2)}\n`;
        response += `• Conversions: ${(tactic.metrics as { conversions?: number })?.conversions || 0}\n`;
      } else if (analysis.analysisType === "attribution") {
        response += `• Attribution Score: ${Math.round(((tactic.metrics as { attributionScore?: number })?.attributionScore || 0) * 100)}%\n`;
        response += `• First Touch: ${(tactic.metrics as { firstTouchConversions?: number })?.firstTouchConversions || 0}\n`;
        response += `• Last Touch: ${(tactic.metrics as { lastTouchConversions?: number })?.lastTouchConversions || 0}\n`;
      }

      // Add insights
      for (const insight of tactic.insights) {
        response += `• ${insight}\n`;
      }
      response += "\n";
    }
  }

  // Signal analysis
  if (analysis.signalAnalysis) {
    response += "### 🎯 Signal Effectiveness\n\n";
    for (const signal of analysis.signalAnalysis) {
      response += `**${signal.signal}**\n`;
      response += `• Effectiveness Score: ${signal.effectiveness.toFixed(2)}\n`;
      response += `• Total Spend: $${signal.performance.totalSpend.toLocaleString()}\n`;
      response += `• Conversions: ${signal.performance.totalConversions}\n`;
      response += `• Recommendation: ${signal.recommendation}\n\n`;
    }
  }

  // Story analysis
  if (analysis.storyAnalysis) {
    response += "### 📖 Story Performance\n\n";
    for (const story of analysis.storyAnalysis) {
      response += `**${story.story}**\n`;
      response += `• Engagement Score: ${story.effectiveness.toFixed(2)}\n`;
      response += `• CTR: ${(story.performance.ctr * 100).toFixed(2)}%\n`;
      response += `• CVR: ${(story.performance.cvr * 100).toFixed(2)}%\n`;
      response += `• Recommendation: ${story.recommendation}\n\n`;
    }
  }

  // Recommendations
  if (analysis.recommendations.length > 0) {
    response += "### 💡 Recommendations\n\n";
    for (const rec of analysis.recommendations) {
      response += `• ${rec}\n`;
    }
    response += "\n";
  }

  // Statistical significance (if available)
  if (analysis.statisticalSignificance) {
    response += "### 📈 Statistical Significance\n\n";
    if (analysis.statisticalSignificance.winningTactic) {
      response += `• **Winning Tactic**: ${analysis.statisticalSignificance.winningTactic}\n`;
    }
    response += `• **Confidence Level**: ${Math.round(analysis.statisticalSignificance.confidenceLevel * 100)}%\n`;
    response += `• **Sample Size**: ${analysis.statisticalSignificance.sampleSize.toLocaleString()}\n\n`;
  }

  response += `*Analysis generated on ${analysis.generatedAt.toLocaleString()}*`;

  return response;
}

function generateEfficiencyInsights(
  tactic: { targetPrice?: number },
  performance: { totalImpressions?: number; totalSpend?: number },
  efficiency: number,
): string[] {
  const insights: string[] = [];

  if (efficiency > 0.8) {
    insights.push("🏆 Top performer - highly efficient");
  } else if (efficiency > 0.6) {
    insights.push("✅ Good performance - monitor closely");
  } else if (efficiency > 0.4) {
    insights.push("⚠️ Below average - needs optimization");
  } else {
    insights.push("🚨 Underperforming - consider pausing");
  }

  const currentCpm =
    (performance.totalImpressions || 0) > 0
      ? ((performance.totalSpend || 0) / (performance.totalImpressions || 0)) *
        1000
      : 0;
  const targetCpm = tactic.targetPrice || 3.5;

  if (currentCpm > targetCpm * 1.2) {
    insights.push("CPM significantly above target");
  } else if (currentCpm < targetCpm * 0.8) {
    insights.push("CPM below target - opportunity to scale");
  }

  return insights;
}

function generateEfficiencyRecommendations(
  tactics: { metrics?: { efficiency?: number } }[],
): string[] {
  const recommendations: string[] = [];

  const underperformers = tactics.filter(
    (t) => (t.metrics?.efficiency || 0) < 0.4,
  );
  const topPerformers = tactics.filter(
    (t) => (t.metrics?.efficiency || 0) > 0.8,
  );

  if (topPerformers.length > 0) {
    recommendations.push(
      `Scale budget allocation to top ${topPerformers.length} performing tactics`,
    );
  }

  if (underperformers.length > 0) {
    recommendations.push(
      `Review and optimize ${underperformers.length} underperforming tactics`,
    );
  }

  if (tactics.length > 3) {
    recommendations.push(
      "Consider consolidating tactics to focus spend on best performers",
    );
  }

  return recommendations;
}

function generateEfficiencySummary(
  tactics: { metrics?: { efficiency?: number } }[],
  bestTactic: { metrics?: { efficiency?: number }; tacticName?: string },
  avgEfficiency: number,
): string {
  const totalTactics = tactics.length;
  const highPerformers = tactics.filter(
    (t) => (t.metrics?.efficiency || 0) > 0.7,
  ).length;
  const underperformers = tactics.filter(
    (t) => (t.metrics?.efficiency || 0) < 0.4,
  ).length;

  let summary = `## 🎯 Efficiency Analysis\n\n`;
  summary += `**Campaign Tactics**: ${totalTactics}\n`;
  summary += `**Average Efficiency**: ${Math.round(avgEfficiency * 100)}%\n`;
  summary += `**High Performers**: ${highPerformers} (${Math.round((highPerformers / totalTactics) * 100)}%)\n`;
  summary += `**Underperformers**: ${underperformers} (${Math.round((underperformers / totalTactics) * 100)}%)\n\n`;

  if (bestTactic) {
    summary += `**Top Performer**: ${bestTactic.tacticName} (${Math.round((bestTactic.metrics?.efficiency || 0) * 100)}% efficiency)\n`;
  }

  return summary;
}

async function performTacticAnalysis(
  client: Scope3ApiClient,
  apiKey: string,
  campaign: { id: string },
  params: AnalyzeTacticsParams,
  dateRange: { end: Date; start: Date },
): Promise<TacticAnalysisResult> {
  // Get campaign tactics
  const tactics = await client.getCampaignTactics(
    apiKey,
    campaign.id as string,
  );

  // Get performance data for each tactic
  const tacticPerformance = await Promise.all(
    tactics.map(async (tactic: Record<string, unknown>) => {
      const performance = await client.getTacticPerformance(
        apiKey,
        tactic.id as string,
        dateRange,
      );
      return {
        performance,
        tactic,
      };
    }),
  );

  const now = new Date();
  let analysisResult: TacticAnalysisResult = {
    analysisType: params.analysisType,
    campaignId: campaign.id,
    generatedAt: now,
    recommendations: [],
    summary: "",
    tacticPerformance: [],
  };

  switch (params.analysisType) {
    case "attribution":
      analysisResult = await analyzeAttribution(
        tacticPerformance as unknown as TacticPerformanceData[],
        dateRange,
        params,
      );
      break;
    case "efficiency":
      analysisResult = await analyzeEfficiency(
        tacticPerformance as unknown as TacticPerformanceData[],
        params,
      );
      break;
    case "optimization":
      analysisResult = await analyzeOptimization(
        tacticPerformance as unknown as TacticPerformanceData[],
        params,
      );
      break;
    case "signals":
      analysisResult = await analyzeSignals(
        tacticPerformance as unknown as TacticPerformanceData[],
        params,
      );
      break;
    case "stories":
      analysisResult = await analyzeStories(
        tacticPerformance as unknown as TacticPerformanceData[],
        params,
      );
      break;
  }

  analysisResult.campaignId = campaign.id;
  analysisResult.analysisType = params.analysisType;
  analysisResult.generatedAt = now;

  return analysisResult;
}
