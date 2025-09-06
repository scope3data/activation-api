import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  ListMeasurementSourcesParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const listMeasurementSourcesTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "data-retrieval",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Measurement Sources",
  },

  description:
    "List all measurement sources configured for a specific brand agent. Shows all tracking and analytics integrations including conversion APIs, analytics platforms, brand studies, and MMM sources. Requires authentication.",

  execute: async (
    args: ListMeasurementSourcesParams,
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
      // First, verify the brand agent exists and get its name
      let brandAgentName: string;
      try {
        const brandAgent = await client.getBrandAgent(
          apiKey,
          args.brandAgentId,
        );
        brandAgentName = brandAgent.name;
      } catch (fetchError) {
        return createErrorResponse(
          "Brand agent not found. Please check the brand agent ID.",
          fetchError,
        );
      }

      const measurementSources = await client.listMeasurementSources(
        apiKey,
        args.brandAgentId,
      );

      if (measurementSources.length === 0) {
        return createMCPResponse({
          message:
            `No measurement sources found for brand agent "${brandAgentName}".\n\n` +
            `📊 **Why Add Measurement Sources?**\n` +
            `• Track campaign performance and ROI\n` +
            `• Measure brand awareness and perception\n` +
            `• Understand cross-channel attribution\n` +
            `• Optimize budget allocation based on data\n\n` +
            `**Supported Source Types:**\n` +
            `• **conversion_api**: Track conversions and revenue\n` +
            `• **analytics**: Monitor website traffic and engagement\n` +
            `• **brand_study**: Measure brand lift and awareness\n` +
            `• **mmm**: Media Mix Modeling for attribution\n\n` +
            `Add your first measurement source to start tracking campaign effectiveness!`,
          success: true,
        });
      }

      let summary = `Found ${measurementSources.length} measurement source${measurementSources.length === 1 ? "" : "s"} for brand agent **${brandAgentName}**:\n\n`;

      measurementSources.forEach((source, index) => {
        summary += `**${index + 1}. ${source.name}**\n`;
        summary += `   • ID: ${source.id}\n`;
        summary += `   • Type: ${source.type}\n`;
        summary += `   • Status: ${source.status}`;

        // Add status indicator
        switch (source.status) {
          case "active":
            summary += ` ✅\n`;
            break;
          case "error":
            summary += ` ❌\n`;
            break;
          case "inactive":
            summary += ` ⏸️\n`;
            break;
          default:
            summary += `\n`;
        }

        if (
          source.configuration &&
          Object.keys(source.configuration).length > 0
        ) {
          summary += `   • Configuration: ${Object.keys(source.configuration).length} parameter${Object.keys(source.configuration).length === 1 ? "" : "s"}\n`;
        }

        summary += `   • Created: ${new Date(source.createdAt).toLocaleString()}\n`;
        summary += `   • Updated: ${new Date(source.updatedAt).toLocaleString()}\n`;

        if (index < measurementSources.length - 1) {
          summary += `\n`;
        }
      });

      // Add summary statistics
      const statusCounts = measurementSources.reduce(
        (counts, source) => {
          counts[source.status] = (counts[source.status] || 0) + 1;
          return counts;
        },
        {} as Record<string, number>,
      );

      const typeCounts = measurementSources.reduce(
        (counts, source) => {
          counts[source.type] = (counts[source.type] || 0) + 1;
          return counts;
        },
        {} as Record<string, number>,
      );

      summary += `\n📊 **Status Summary:**\n`;
      Object.entries(statusCounts).forEach(([status, count]) => {
        const indicator =
          status === "active" ? "✅" : status === "error" ? "❌" : "⏸️";
        summary += `   • ${status}: ${count} ${indicator}\n`;
      });

      summary += `\n📈 **Source Type Summary:**\n`;
      Object.entries(typeCounts).forEach(([type, count]) => {
        summary += `   • ${type.replace("_", " ")}: ${count}\n`;
      });

      summary += `\n🔧 **Management:**\n`;
      if (statusCounts.error > 0) {
        summary += `   ⚠️ ${statusCounts.error} source${statusCounts.error === 1 ? "" : "s"} with errors need attention\n`;
      }
      if (statusCounts.inactive > 0) {
        summary += `   ⏸️ ${statusCounts.inactive} inactive source${statusCounts.inactive === 1 ? "" : "s"} available to enable\n`;
      }
      summary += `   • Use source IDs to reference in campaign configurations\n`;
      summary += `   • Monitor source status for data collection issues\n`;

      summary += `\n🚧 **Current Status:** Basic measurement source management (stub implementation)\n`;
      summary += `**Coming Soon:**\n`;
      summary += `• Real-time data synchronization and validation\n`;
      summary += `• Advanced configuration management\n`;
      summary += `• Performance dashboards and reporting\n`;
      summary += `• Automated alerts for source issues\n`;
      summary += `• Cross-source attribution modeling`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to fetch measurement sources", error);
    }
  },

  name: "list_measurement_sources",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to list measurement sources for"),
  }),
});
