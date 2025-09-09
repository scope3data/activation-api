import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  ListCustomSignalsParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const listCustomSignalsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "custom-signals",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Custom Signals",
  },

  description:
    "List all custom signal definitions in the Custom Signals Platform. Optionally filter by region or channel. Shows signal metadata, key types, and cluster configurations. Requires authentication.",

  execute: async (
    args: ListCustomSignalsParams,
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
      const result = await client.listCustomSignals(apiKey, {
        channel: args.channel,
        region: args.region,
      });

      if (result.signals.length === 0) {
        let message = `📭 **No Custom Signals Found**\n\n`;
        if (args.region || args.channel) {
          message += `**Applied Filters:**\n`;
          if (args.region) message += `• **Region:** ${args.region}\n`;
          if (args.channel) message += `• **Channel:** ${args.channel}\n`;
          message += `\nTry removing filters or creating new signals with different configurations.\n\n`;
        }
        message += `**Getting Started:**\n`;
        message += `• Create your first custom signal with \`create_custom_signal\`\n`;
        message += `• Upload signal data via the Custom Signals data API\n`;
        message += `• Reference signals in campaign prompts for enhanced targeting\n\n`;

        return createMCPResponse({
          message,
          success: true,
        });
      }

      let summary = `📊 **Custom Signals Overview**\n\n`;
      summary += `**Total Signals:** ${result.total}\n`;

      if (args.region || args.channel) {
        summary += `**Applied Filters:**\n`;
        if (args.region) summary += `• **Region:** ${args.region}\n`;
        if (args.channel) summary += `• **Channel:** ${args.channel}\n`;
      }
      summary += `\n`;

      // Group by key type for better organization
      const signalsByKeyType = result.signals.reduce(
        (acc, signal) => {
          const keyType = signal.key.includes(",")
            ? "Composite Keys"
            : "Single Keys";
          if (!acc[keyType]) acc[keyType] = [];
          acc[keyType].push(signal);
          return acc;
        },
        {} as Record<string, typeof result.signals>,
      );

      Object.entries(signalsByKeyType).forEach(([keyType, signals]) => {
        summary += `## ${keyType}\n\n`;

        signals.forEach((signal) => {
          summary += `### ${signal.name}\n`;
          summary += `• **ID:** ${signal.id}\n`;
          summary += `• **Key Type:** ${signal.key}\n`;
          summary += `• **Description:** ${signal.description}\n`;

          // Cluster information
          const regions = [...new Set(signal.clusters.map((c) => c.region))];
          const channels = signal.clusters
            .map((c) => c.channel)
            .filter(Boolean);
          const gdprClusters = signal.clusters.filter((c) => c.gdpr).length;

          summary += `• **Regions:** ${regions.join(", ")}\n`;
          if (channels.length > 0) {
            summary += `• **Channels:** ${[...new Set(channels)].join(", ")}\n`;
          }
          if (gdprClusters > 0) {
            summary += `• **GDPR Compliant:** ${gdprClusters} cluster(s)\n`;
          }

          summary += `• **Created:** ${new Date(signal.createdAt).toLocaleString()}\n`;
          if (signal.updatedAt) {
            summary += `• **Updated:** ${new Date(signal.updatedAt).toLocaleString()}\n`;
          }
          summary += `\n`;
        });
      });

      // Usage insights
      const totalRegions = new Set(
        result.signals.flatMap((s) => s.clusters.map((c) => c.region)),
      ).size;
      const totalChannels = new Set(
        result.signals.flatMap((s) =>
          s.clusters.map((c) => c.channel).filter(Boolean),
        ),
      ).size;
      const gdprCompliantSignals = result.signals.filter((s) =>
        s.clusters.some((c) => c.gdpr),
      ).length;
      const compositeSignals = result.signals.filter((s) =>
        s.key.includes(","),
      ).length;

      summary += `## 📈 Platform Statistics\n\n`;
      summary += `• **Active Regions:** ${totalRegions}\n`;
      summary += `• **Channel Configurations:** ${totalChannels || "None specified"}\n`;
      summary += `• **GDPR Compliant Signals:** ${gdprCompliantSignals}\n`;
      summary += `• **Composite Key Signals:** ${compositeSignals}\n`;
      summary += `• **Single Key Signals:** ${result.total - compositeSignals}\n\n`;

      summary += `**Next Steps:**\n`;
      summary += `• Use \`get_custom_signal\` for detailed signal information\n`;
      summary += `• Update signal configurations with \`update_custom_signal\`\n`;
      summary += `• Reference signals in campaign prompts for targeting\n`;
      summary += `• Upload signal data via the Custom Signals data API\n`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to list custom signals", error);
    }
  },

  name: "signal/list",
  parameters: z.object({
    channel: z
      .string()
      .optional()
      .describe("Filter by channel (e.g., 'ctv', 'web', 'mobile')"),
    region: z
      .string()
      .optional()
      .describe(
        "Filter by region (e.g., 'us-east-1', 'eu-west-1', 'emea-ex-eu')",
      ),
  }),
});
