import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const analyzeInventoryPerformanceTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "inventory-management",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Analyze Inventory Performance",
  },

  description:
    "Analyze performance metrics across all inventory options in a campaign. Provides detailed breakdowns by publisher, signal type, and delivery model. Includes performance comparisons, efficiency metrics, and optimization recommendations. Use this to understand which inventory tactics are performing best. Requires authentication.",

  execute: async (
    args: {
      campaignId: string;
      includeRecommendations?: boolean;
      optimizationGoal?:
        | "clicks"
        | "conversions"
        | "cost_efficiency"
        | "impressions";
    },
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
      const performanceData = await client.getInventoryPerformance(
        apiKey,
        args.campaignId,
      );

      const { campaign, options, summary } = performanceData;

      if (options.length === 0) {
        return createMCPResponse({
          message: `📊 **No Inventory Performance Data Available**\n\nCampaign "${campaign.name}" doesn't have any inventory options with performance data yet.\n\n**This could mean:**\n• Campaign is newly created and hasn't started delivery\n• All inventory options are in draft status\n• Performance data hasn't been collected yet\n\n**Next Steps:**\n• Activate inventory options to start delivery\n• Check back after campaign has been running for a few hours`,
          success: true,
        });
      }

      let analysis = `📊 **Inventory Performance Analysis**\n\n`;
      analysis += `**Campaign:** ${campaign.name} (${campaign.id})\n\n`;

      // Executive Summary
      analysis += `## 🎯 **Executive Summary**\n\n`;
      analysis += `• **Total Spend:** $${summary.totalSpend.toLocaleString()}\n`;
      analysis += `• **Total Impressions:** ${summary.totalImpressions.toLocaleString()}\n`;
      analysis += `• **Average CPM:** $${summary.averageCpm.toFixed(2)}\n`;

      if (summary.totalClicks && summary.totalClicks > 0) {
        const overallCtr =
          (summary.totalClicks / summary.totalImpressions) * 100;
        analysis += `• **Overall CTR:** ${overallCtr.toFixed(3)}%\n`;
      }

      if (summary.totalConversions && summary.totalConversions > 0) {
        const overallCvr =
          (summary.totalConversions / summary.totalImpressions) * 100;
        const avgCpa = summary.totalSpend / summary.totalConversions;
        analysis += `• **Conversions:** ${summary.totalConversions.toLocaleString()}\n`;
        analysis += `• **CVR:** ${overallCvr.toFixed(3)}%\n`;
        analysis += `• **Average CPA:** $${avgCpa.toFixed(2)}\n`;
      }

      analysis += `• **Active Options:** ${options.filter((opt) => opt.option.budgetAllocation.amount > 0).length}\n\n`;

      // Performance by Option
      analysis += `## 📈 **Performance by Option**\n\n`;

      // Sort options by spend to show top performers first
      const sortedOptions = [...options].sort(
        (a, b) => b.performance.spend - a.performance.spend,
      );

      sortedOptions.forEach((optionData, index) => {
        const { option, performance } = optionData;

        analysis += `### ${index + 1}. **${option.name}**\n`;

        // Publisher and targeting info
        analysis += `**Publisher:** ${option.mediaProduct.publisherName} → ${option.mediaProduct.name}\n`;
        analysis += `**Signal:** ${option.targeting.signalType.replace(/_/g, " ")}`;
        if (option.targeting.signalProvider) {
          analysis += ` (${option.targeting.signalProvider})`;
        }
        analysis += `\n`;

        // Budget vs Spend
        const spendPercentage =
          (performance.spend / option.budgetAllocation.amount) * 100;
        analysis += `**Budget:** $${option.budgetAllocation.amount.toLocaleString()} | **Spent:** $${performance.spend.toLocaleString()} (${spendPercentage.toFixed(1)}%)\n`;

        // Core metrics
        analysis += `\n**📊 Metrics:**\n`;
        analysis += `• **Impressions:** ${performance.impressions.toLocaleString()}\n`;
        analysis += `• **CPM:** $${performance.cpm.toFixed(2)}`;

        // CPM performance indicator (for future use)
        // const expectedCpm = option.budgetAllocation.amount > 0 ? option.budgetAllocation.amount / (performance.impressions / 1000) : 0;

        if (performance.cpm > summary.averageCpm * 1.2) {
          analysis += ` 🔴 (High)`;
        } else if (performance.cpm < summary.averageCpm * 0.8) {
          analysis += ` 🟢 (Efficient)`;
        } else {
          analysis += ` 🟡 (Average)`;
        }
        analysis += `\n`;

        // Click metrics
        if (performance.clicks && performance.clicks > 0) {
          analysis += `• **Clicks:** ${performance.clicks.toLocaleString()}\n`;
          analysis += `• **CTR:** ${(performance.ctr! * 100).toFixed(3)}%`;

          // CTR performance indicator
          const avgCtr =
            summary.totalClicks && summary.totalImpressions
              ? summary.totalClicks / summary.totalImpressions
              : 0;

          if (performance.ctr! > avgCtr * 1.2) {
            analysis += ` 🟢 (Above average)`;
          } else if (performance.ctr! < avgCtr * 0.8) {
            analysis += ` 🔴 (Below average)`;
          }
          analysis += `\n`;

          if (performance.cpc) {
            analysis += `• **CPC:** $${performance.cpc.toFixed(2)}\n`;
          }
        }

        // Conversion metrics
        if (performance.conversions && performance.conversions > 0) {
          analysis += `• **Conversions:** ${performance.conversions}\n`;
          analysis += `• **CVR:** ${(performance.cvr! * 100).toFixed(3)}%\n`;
          analysis += `• **CPA:** $${performance.cpa!.toFixed(2)}`;

          // CPA efficiency indicator
          if (summary.totalConversions && summary.totalSpend > 0) {
            const avgCpa = summary.totalSpend / summary.totalConversions;
            if (performance.cpa! < avgCpa * 0.8) {
              analysis += ` 🟢 (Efficient)`;
            } else if (performance.cpa! > avgCpa * 1.2) {
              analysis += ` 🔴 (Expensive)`;
            }
          }
          analysis += `\n`;
        }

        // Performance alerts and insights
        const alerts = [];
        if (performance.cpm > summary.averageCpm * 1.5) {
          alerts.push("High CPM relative to campaign average");
        }
        if (performance.ctr && performance.ctr < 0.001) {
          alerts.push("Low click-through rate");
        }
        if (spendPercentage > 90) {
          alerts.push("Budget nearly exhausted");
        }
        if (spendPercentage < 10 && performance.impressions > 1000) {
          alerts.push("Underspending budget allocation");
        }

        if (alerts.length > 0) {
          analysis += `\n**⚠️ Alerts:** ${alerts.join(" • ")}\n`;
        }

        analysis += `\n**Last Updated:** ${new Date(performance.lastUpdated).toLocaleString()}\n`;
        analysis += `---\n\n`;
      });

      // Performance Analysis by Dimensions
      analysis += `## 🔍 **Analysis by Dimension**\n\n`;

      // By Publisher
      const publisherStats = new Map<
        string,
        {
          clicks: number;
          conversions: number;
          impressions: number;
          options: number;
          spend: number;
        }
      >();

      options.forEach(({ option, performance }) => {
        const publisher = option.mediaProduct.publisherName;
        const current = publisherStats.get(publisher) || {
          clicks: 0,
          conversions: 0,
          impressions: 0,
          options: 0,
          spend: 0,
        };

        publisherStats.set(publisher, {
          clicks: current.clicks + (performance.clicks || 0),
          conversions: current.conversions + (performance.conversions || 0),
          impressions: current.impressions + performance.impressions,
          options: current.options + 1,
          spend: current.spend + performance.spend,
        });
      });

      if (publisherStats.size > 1) {
        analysis += `### 📰 **By Publisher**\n\n`;
        Array.from(publisherStats.entries())
          .sort((a, b) => b[1].spend - a[1].spend)
          .forEach(([publisher, stats]) => {
            const avgCpm =
              stats.impressions > 0
                ? (stats.spend / stats.impressions) * 1000
                : 0;
            const ctr =
              stats.impressions > 0
                ? (stats.clicks / stats.impressions) * 100
                : 0;

            analysis += `• **${publisher}:** $${stats.spend.toLocaleString()} spend, ${stats.impressions.toLocaleString()} impressions`;
            analysis += ` (${stats.options} option${stats.options > 1 ? "s" : ""})\n`;
            analysis += `  CPM: $${avgCpm.toFixed(2)}`;
            if (stats.clicks > 0) {
              analysis += ` | CTR: ${ctr.toFixed(3)}%`;
            }
            if (stats.conversions > 0) {
              const cpa = stats.spend / stats.conversions;
              analysis += ` | CPA: $${cpa.toFixed(2)}`;
            }
            analysis += `\n\n`;
          });
      }

      // By Signal Type
      const signalStats = new Map<
        string,
        {
          clicks: number;
          conversions: number;
          impressions: number;
          options: number;
          spend: number;
        }
      >();

      options.forEach(({ option, performance }) => {
        const signal = option.targeting.signalType;
        const current = signalStats.get(signal) || {
          clicks: 0,
          conversions: 0,
          impressions: 0,
          options: 0,
          spend: 0,
        };

        signalStats.set(signal, {
          clicks: current.clicks + (performance.clicks || 0),
          conversions: current.conversions + (performance.conversions || 0),
          impressions: current.impressions + performance.impressions,
          options: current.options + 1,
          spend: current.spend + performance.spend,
        });
      });

      if (signalStats.size > 1) {
        analysis += `### 📡 **By Signal Type**\n\n`;
        Array.from(signalStats.entries())
          .sort((a, b) => b[1].spend - a[1].spend)
          .forEach(([signal, stats]) => {
            const avgCpm =
              stats.impressions > 0
                ? (stats.spend / stats.impressions) * 1000
                : 0;
            const ctr =
              stats.impressions > 0
                ? (stats.clicks / stats.impressions) * 100
                : 0;

            analysis += `• **${signal.replace(/_/g, " ")}:** $${stats.spend.toLocaleString()} spend, ${stats.impressions.toLocaleString()} impressions`;
            analysis += ` (${stats.options} option${stats.options > 1 ? "s" : ""})\n`;
            analysis += `  CPM: $${avgCpm.toFixed(2)}`;
            if (stats.clicks > 0) {
              analysis += ` | CTR: ${ctr.toFixed(3)}%`;
            }
            if (stats.conversions > 0) {
              const cpa = stats.spend / stats.conversions;
              analysis += ` | CPA: $${cpa.toFixed(2)}`;
            }
            analysis += `\n\n`;
          });
      }

      // Efficiency Rankings
      analysis += `## 🏆 **Efficiency Rankings**\n\n`;

      // Top performers by different metrics
      const rankedByCpm = [...sortedOptions].sort(
        (a, b) => a.performance.cpm - b.performance.cpm,
      );
      const rankedByCtr = [...sortedOptions]
        .filter((opt) => opt.performance.ctr && opt.performance.ctr > 0)
        .sort((a, b) => (b.performance.ctr || 0) - (a.performance.ctr || 0));
      const rankedByCpa = [...sortedOptions]
        .filter((opt) => opt.performance.cpa && opt.performance.cpa > 0)
        .sort(
          (a, b) =>
            (a.performance.cpa || Infinity) - (b.performance.cpa || Infinity),
        );

      analysis += `### 💰 **Most Cost-Efficient (Lowest CPM)**\n`;
      rankedByCpm.slice(0, 3).forEach((optionData, index) => {
        analysis += `${index + 1}. **${optionData.option.name}** - $${optionData.performance.cpm.toFixed(2)} CPM\n`;
      });

      if (rankedByCtr.length > 0) {
        analysis += `\n### 👆 **Highest Engagement (CTR)**\n`;
        rankedByCtr.slice(0, 3).forEach((optionData, index) => {
          analysis += `${index + 1}. **${optionData.option.name}** - ${((optionData.performance.ctr || 0) * 100).toFixed(3)}% CTR\n`;
        });
      }

      if (rankedByCpa.length > 0) {
        analysis += `\n### 🎯 **Best Conversion Efficiency (CPA)**\n`;
        rankedByCpa.slice(0, 3).forEach((optionData, index) => {
          analysis += `${index + 1}. **${optionData.option.name}** - $${optionData.performance.cpa!.toFixed(2)} CPA\n`;
        });
      }

      // Optimization Recommendations
      if (args.includeRecommendations && args.optimizationGoal) {
        try {
          const recommendations = await client.getOptimizationRecommendations(
            apiKey!,
            args.campaignId,
            args.optimizationGoal,
          );

          analysis += `\n## 🎯 **Optimization Recommendations** (Goal: ${recommendations.goal.replace(/_/g, " ")})\n\n`;

          if (recommendations.suggestions.length > 0) {
            recommendations.suggestions.forEach((suggestion, index) => {
              const optionName =
                options.find(
                  (opt) => opt.option.id === suggestion.currentOptionId,
                )?.option.name || suggestion.currentOptionId;
              const changeType =
                suggestion.suggestedBudgetChange > 0 ? "Increase" : "Decrease";
              const changeAmount = Math.abs(suggestion.suggestedBudgetChange);

              analysis += `### ${index + 1}. **${optionName}**\n`;
              analysis += `• **Recommendation:** ${changeType} budget by $${changeAmount.toLocaleString()}\n`;
              analysis += `• **Reason:** ${suggestion.reason}\n`;
              analysis += `• **Expected Impact:** ${suggestion.expectedImpact}\n`;
              analysis += `• **Confidence:** ${(suggestion.confidence * 100).toFixed(0)}%\n\n`;
            });

            // Projected improvement
            if (recommendations.projectedImprovement) {
              const improvement = recommendations.projectedImprovement;
              analysis += `### 📈 **Projected Impact**\n`;
              analysis += `• **Metric:** ${improvement.metric}\n`;
              analysis += `• **Current:** ${improvement.currentValue.toLocaleString()}\n`;
              analysis += `• **Projected:** ${improvement.projectedValue.toLocaleString()}\n`;
              analysis += `• **Improvement:** +${improvement.improvement.toFixed(1)}%\n\n`;
            }
          } else {
            analysis += `No specific optimization recommendations available at this time.\n\n`;
          }
        } catch {
          analysis += `\n*Optimization recommendations temporarily unavailable*\n\n`;
        }
      }

      // Action Items
      analysis += `## ✅ **Action Items**\n\n`;

      // Identify underperforming options
      const underperformingOptions = options.filter(
        (opt) =>
          opt.performance.cpm > summary.averageCpm * 1.3 ||
          (opt.performance.ctr && opt.performance.ctr < 0.001),
      );

      if (underperformingOptions.length > 0) {
        analysis += `• **Review ${underperformingOptions.length} underperforming option(s)** for budget reallocation\n`;
      }

      // Identify top performers
      const topPerformers = options.filter(
        (opt) =>
          opt.performance.cpm < summary.averageCpm * 0.8 ||
          (opt.performance.ctr && opt.performance.ctr > 0.002),
      );

      if (topPerformers.length > 0) {
        analysis += `• **Consider increasing budget** for ${topPerformers.length} high-performing option(s)\n`;
      }

      // Budget utilization
      const lowUtilizationOptions = options.filter((opt) => {
        const utilization =
          opt.performance.spend / opt.option.budgetAllocation.amount;
        return utilization < 0.5 && opt.performance.impressions > 100;
      });

      if (lowUtilizationOptions.length > 0) {
        analysis += `• **Investigate ${lowUtilizationOptions.length} option(s)** with low budget utilization\n`;
      }

      analysis += `• **Monitor performance trends** and adjust allocations weekly\n`;
      analysis += `• **Test new signal types** on high-performing publisher products\n`;

      analysis += `\n*Analysis generated: ${new Date().toLocaleString()}*`;

      return createMCPResponse({
        message: analysis,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        "Failed to analyze inventory performance",
        error,
      );
    }
  },

  name: "analyze_inventory_performance",
  parameters: z.object({
    campaignId: z.string().describe("ID of the campaign to analyze"),
    includeRecommendations: z
      .boolean()
      .default(true)
      .describe("Whether to include AI-powered optimization recommendations"),
    optimizationGoal: z
      .enum(["impressions", "clicks", "conversions", "cost_efficiency"])
      .default("cost_efficiency")
      .describe("Goal for optimization recommendations"),
  }),
});
