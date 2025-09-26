import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  GetSignalsParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";

import { SignalsAgentService } from "../../services/signals-agent-service.js";
import { requireSessionAuth } from "../../utils/auth.js";
import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const getSignalsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Signals Agents",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Get Signals from Agents",
  },

  description:
    "Query signals agents for targeting recommendations and signal insights. Can query specific agents or all active agents for a brand agent. Stateless operation that can be called anytime. Requires authentication.",

  execute: async (
    args: GetSignalsParams,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Universal session authentication check
    const { apiKey, customerId: _customerId } = requireSessionAuth(context);

    try {
      // Validate API key
      const authResult = await client.validateApiKey(apiKey);
      if (!authResult.isValid) {
        return createAuthErrorResponse();
      }

      const signalsAgentService = new SignalsAgentService();
      const responses = await signalsAgentService.getSignals(
        args.brandAgentId,
        args.agentIds,
        args.brief,
      );

      if (responses.length === 0) {
        let summary = `📭 **No Signal Responses**\n\n`;
        summary += `**Brand Agent:** ${args.brandAgentId}\n`;
        if (args.agentIds?.length) {
          summary += `**Queried Agents:** ${args.agentIds.length}\n`;
        }
        if (args.brief) {
          summary += `**Brief:** "${args.brief}"\n`;
        }
        summary += `\n`;

        summary += `**Possible Reasons:**\n`;
        summary += `• No active signals agents registered\n`;
        summary += `• All agents failed to respond\n`;
        summary += `• Agents returned empty signal lists\n`;
        summary += `• Network connectivity issues\n\n`;

        summary += `**Next Steps:**\n`;
        summary += `• Use \`signals-agent/list\` to check registered agents\n`;
        summary += `• Use \`signals-agent/history\` to check for errors\n`;
        summary += `• Register new agents with \`signals-agent/register\`\n`;

        return createMCPResponse({
          message: summary,
          success: true,
        });
      }

      let summary = `🎯 **Signal Recommendations**\n\n`;
      summary += `**Brand Agent:** ${args.brandAgentId}\n`;
      summary += `**Responding Agents:** ${responses.length}\n`;
      if (args.brief) {
        summary += `**Brief:** "${args.brief}"\n`;
      }
      summary += `**Query Time:** ${new Date().toLocaleString()}\n\n`;

      // Show signals by agent
      responses.forEach((response, index) => {
        summary += `## ${index + 1}. ${response.agentName}\n`;
        summary += `**Agent ID:** ${response.agentId}\n`;

        if (response.signals && response.signals.length > 0) {
          summary += `**Signals:** ${response.signals.length}\n\n`;

          response.signals.forEach((signal, signalIndex) => {
            summary += `### Signal ${signalIndex + 1}: ${signal.name}\n`;
            summary += `• **Description:** ${signal.description}\n`;
            summary += `• **Key Type:** ${signal.keyType}\n`;

            if (signal.clusters && signal.clusters.length > 0) {
              const regions = [
                ...new Set(signal.clusters.map((c) => c.region)),
              ];
              summary += `• **Regions:** ${regions.join(", ")}\n`;

              const channels = signal.clusters
                .map((c) => c.channel)
                .filter(Boolean);
              if (channels.length > 0) {
                summary += `• **Channels:** ${[...new Set(channels)].join(", ")}\n`;
              }

              const gdprClusters = signal.clusters.filter((c) => c.gdpr).length;
              if (gdprClusters > 0) {
                summary += `• **GDPR Compliant:** ${gdprClusters} cluster(s)\n`;
              }
            }

            if (signal.confidence !== undefined) {
              summary += `• **Confidence:** ${(signal.confidence * 100).toFixed(1)}%\n`;
            }

            if (signal.reasoning) {
              summary += `• **Reasoning:** ${signal.reasoning}\n`;
            }

            if (signal.id) {
              summary += `• **Signal ID:** \`${signal.id}\` (use with activate)\n`;
            }

            summary += `\n`;
          });
        } else {
          summary += `**Signals:** 0 (no recommendations)\n\n`;
        }

        if (response.metadata && Object.keys(response.metadata).length > 0) {
          summary += `**Additional Metadata:**\n`;
          Object.entries(response.metadata).forEach(([key, value]) => {
            summary += `• **${key}:** ${String(value)}\n`;
          });
          summary += `\n`;
        }
      });

      // Summary statistics
      const totalSignals = responses.reduce(
        (sum, r) => sum + (r.signals?.length || 0),
        0,
      );
      const highConfidenceSignals = responses.reduce(
        (sum, r) =>
          sum +
          (r.signals?.filter((s) => (s.confidence || 0) > 0.8).length || 0),
        0,
      );

      summary += `## 📊 Summary\n\n`;
      summary += `• **Total Signals:** ${totalSignals}\n`;
      summary += `• **High Confidence:** ${highConfidenceSignals} (>80%)\n`;
      summary += `• **Unique Agents:** ${responses.length}\n`;

      // Show available signal IDs for activation
      const activatableSignals = responses.flatMap(
        (r) =>
          r.signals
            ?.filter((s) => s.id)
            .map((s) => ({
              agentId: r.agentId,
              agentName: r.agentName,
              signalId: s.id,
              signalName: s.name,
            })) || [],
      );

      if (activatableSignals.length > 0) {
        summary += `\n**🚀 Ready to Activate:**\n`;
        activatableSignals.forEach((signal) => {
          summary += `• \`signals-agent/activate ${signal.agentId} ${signal.signalId}\` - ${signal.signalName}\n`;
        });
        summary += `\n`;
      }

      summary += `**Next Steps:**\n`;
      summary += `• Use \`signals-agent/activate\` to create recommended segments\n`;
      summary += `• Use \`signals-agent/history\` to view detailed interaction logs\n`;
      summary += `• Refine your brief and query again for different recommendations\n`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to get signals from agents", error);
    }
  },

  name: "signals_agent_get_signals",
  parameters: z.object({
    agentIds: z
      .array(z.string())
      .optional()
      .describe(
        "Optional array of specific agent IDs to query. If not provided, queries all active agents.",
      ),
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to get signals for"),
    brief: z
      .string()
      .optional()
      .describe(
        "Optional campaign brief or targeting description to get tailored recommendations",
      ),
  }),
});
