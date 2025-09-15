import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  GetSignalsAgentHistoryParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";

import { SignalsAgentService } from "../../services/signals-agent-service.js";
import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const getSignalsAgentHistoryTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Signals Agents",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Get Signals Agent History",
  },

  description:
    "View complete activity history for a signals agent including all interactions, segment operations, and performance metrics. Provides audit trail of agent actions. Requires authentication.",

  execute: async (
    args: GetSignalsAgentHistoryParams,
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
      // Validate API key
      const authResult = await client.validateApiKey(apiKey);
      if (!authResult.isValid) {
        return createAuthErrorResponse();
      }

      const signalsAgentService = new SignalsAgentService();

      // Get agent details for context
      const agent = await signalsAgentService.getSignalsAgent(args.agentId);
      if (!agent) {
        return createErrorResponse(
          `Signals agent ${args.agentId} not found`,
          null,
        );
      }

      const activities = await signalsAgentService.getAgentHistory(
        args.agentId,
        args.limit || 50,
      );

      let summary = `📋 **Signals Agent Activity History**\n\n`;
      summary += `**Agent:** ${agent.name}\n`;
      summary += `**Agent ID:** ${args.agentId}\n`;
      summary += `**Total Activities:** ${activities.length}\n`;
      summary += `**Query Limit:** ${args.limit || 50}\n`;
      summary += `**Generated:** ${new Date().toLocaleString()}\n\n`;

      if (activities.length === 0) {
        summary += `📭 **No Activity Found**\n\n`;
        summary += `This signals agent has no recorded activity yet.\n\n`;
        summary += `**Getting Started:**\n`;
        summary += `• Use \`signals-agent/get-signals\` to query this agent\n`;
        summary += `• Use \`signals-agent/activate\` to create segments\n`;
        summary += `• All interactions will be logged here\n`;

        return createMCPResponse({
          message: summary,
          success: true,
        });
      }

      // Group activities by type for summary
      const activityTypes = activities.reduce(
        (acc, activity) => {
          acc[activity.activityType] = (acc[activity.activityType] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );

      const successful = activities.filter(
        (a) => a.status === "success",
      ).length;
      const failed = activities.filter((a) => a.status === "failed").length;
      const avgResponseTime =
        activities
          .filter((a) => a.responseTimeMs)
          .reduce((sum, a) => sum + (a.responseTimeMs || 0), 0) /
        activities.length;

      summary += `## 📊 Activity Summary\n\n`;
      Object.entries(activityTypes).forEach(([type, count]) => {
        const icon =
          type === "get_signals"
            ? "🎯"
            : type === "activate_signal"
              ? "🚀"
              : type.includes("segment")
                ? "📂"
                : "📋";
        summary += `• **${icon} ${type.replace(/_/g, " ")}:** ${count}\n`;
      });
      summary += `\n`;

      summary += `**Performance Metrics:**\n`;
      summary += `• **Success Rate:** ${((successful / activities.length) * 100).toFixed(1)}% (${successful}/${activities.length})\n`;
      summary += `• **Failed Operations:** ${failed}\n`;
      if (avgResponseTime > 0) {
        summary += `• **Avg Response Time:** ${avgResponseTime.toFixed(0)}ms\n`;
      }
      summary += `\n`;

      summary += `## 📝 Recent Activities\n\n`;

      activities.forEach((activity, index) => {
        const statusIcon =
          activity.status === "success"
            ? "✅"
            : activity.status === "failed"
              ? "❌"
              : "⏳";

        const typeIcon =
          activity.activityType === "get_signals"
            ? "🎯"
            : activity.activityType === "activate_signal"
              ? "🚀"
              : activity.activityType.includes("segment")
                ? "📂"
                : "📋";

        summary += `### ${index + 1}. ${typeIcon} ${activity.activityType.replace(/_/g, " ")} ${statusIcon}\n`;
        summary += `**Time:** ${new Date(activity.executedAt).toLocaleString()}\n`;
        summary += `**Status:** ${activity.status.toUpperCase()}\n`;

        if (activity.responseTimeMs) {
          summary += `**Response Time:** ${activity.responseTimeMs}ms\n`;
        }

        if (activity.request) {
          summary += `**Request:**\n`;
          if (activity.request.brief) {
            summary += `• Brief: "${activity.request.brief}"\n`;
          }
          if (activity.request.signalId) {
            summary += `• Signal ID: ${activity.request.signalId}\n`;
          }
          if (activity.request.agentId) {
            summary += `• Target Agent: ${activity.request.agentId}\n`;
          }
        }

        if (activity.segmentIds && activity.segmentIds.length > 0) {
          summary += `**Affected Segments:** ${activity.segmentIds.length}\n`;
          if (activity.segmentIds.length <= 3) {
            activity.segmentIds.forEach((id) => {
              summary += `• ${id}\n`;
            });
          } else {
            activity.segmentIds.slice(0, 2).forEach((id) => {
              summary += `• ${id}\n`;
            });
            summary += `• ... and ${activity.segmentIds.length - 2} more\n`;
          }
        }

        if (activity.response && activity.status === "success") {
          if (
            activity.activityType === "get_signals" &&
            activity.response.signals
          ) {
            const signalCount = Array.isArray(activity.response.signals)
              ? activity.response.signals.length
              : 0;
            summary += `**Result:** ${signalCount} signals returned\n`;
          } else if (
            activity.activityType === "activate_signal" &&
            activity.response.segmentId
          ) {
            summary += `**Result:** Created segment ${activity.response.segmentId}\n`;
          }
        }

        if (activity.errorDetails) {
          summary += `**Error:** ${activity.errorDetails}\n`;
        }

        summary += `\n`;
      });

      // Show trends if we have enough data
      if (activities.length >= 5) {
        const recentActivities = activities.slice(0, 10);
        const recentSuccessRate =
          (recentActivities.filter((a) => a.status === "success").length /
            recentActivities.length) *
          100;

        summary += `## 📈 Recent Trends (Last 10 Activities)\n\n`;
        summary += `• **Success Rate:** ${recentSuccessRate.toFixed(1)}%\n`;

        const recentAvgTime =
          recentActivities
            .filter((a) => a.responseTimeMs)
            .reduce((sum, a) => sum + (a.responseTimeMs || 0), 0) /
          recentActivities.length;

        if (recentAvgTime > 0) {
          summary += `• **Avg Response Time:** ${recentAvgTime.toFixed(0)}ms\n`;
        }
        summary += `\n`;
      }

      summary += `**Available Actions:**\n`;
      summary += `• Use \`signals-agent/get-signals\` to query this agent again\n`;
      summary += `• Use \`signals-agent/get\` for detailed agent configuration\n`;
      summary += `• Use \`signal/list\` to view segments managed by this agent\n`;
      summary += `• Increase limit parameter to see more history\n`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to get signals agent history", error);
    }
  },

  name: "signals-agent/history",
  parameters: z.object({
    agentId: z.string().describe("ID of the signals agent to get history for"),
    limit: z
      .number()
      .optional()
      .default(50)
      .describe("Maximum number of activities to return (default: 50)"),
  }),
});
