import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  MCPToolExecuteContext,
  UpdateCustomSignalParams,
} from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const updateCustomSignalTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "custom-signals",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Update Custom Signal",
  },

  description:
    "Update an existing custom signal definition. Can modify name, description, and cluster configurations. Note: Key type cannot be changed after creation. Requires authentication.",

  execute: async (
    args: UpdateCustomSignalParams,
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
      // First get current signal to show changes
      let currentSignal;
      try {
        currentSignal = await client.getCustomSignal(apiKey, args.signalId);
      } catch (error) {
        return createErrorResponse(
          "Signal not found. Please check the signal ID.",
          error,
        );
      }

      // Validate clusters if provided
      if (args.clusters && args.clusters.length === 0) {
        return createErrorResponse(
          "At least one cluster configuration is required",
          null,
        );
      }

      const updateData: Record<string, unknown> = {};
      if (args.name !== undefined) updateData.name = args.name;
      if (args.description !== undefined)
        updateData.description = args.description;
      if (args.clusters !== undefined) updateData.clusters = args.clusters;

      if (Object.keys(updateData).length === 0) {
        return createErrorResponse(
          "At least one field must be provided for update (name, description, or clusters)",
          null,
        );
      }

      const signal = await client.updateCustomSignal(
        apiKey,
        args.signalId,
        updateData,
      );

      let summary = `✅ Custom Signal Updated Successfully!\n\n`;
      summary += `### ${signal.name}\n`;
      summary += `**ID:** ${signal.id}\n`;
      summary += `**Key Type:** ${signal.key} *(unchanged)*\n\n`;

      // Show what changed
      summary += `## Changes Made\n\n`;
      if (args.name && args.name !== currentSignal.name) {
        summary += `• **Name:** "${currentSignal.name}" → "${signal.name}"\n`;
      }
      if (args.description && args.description !== currentSignal.description) {
        summary += `• **Description:** Updated\n`;
      }
      if (args.clusters) {
        summary += `• **Clusters:** Configuration updated (${signal.clusters.length} cluster(s))\n`;
      }
      summary += `\n`;

      // Current configuration
      summary += `## Current Configuration\n\n`;
      summary += `**Description:** ${signal.description}\n`;
      summary += `**Key Type:** ${signal.key}\n\n`;

      // Cluster information
      summary += `### Regional Configuration\n`;
      signal.clusters.forEach((cluster, index) => {
        summary += `**Cluster ${index + 1}:**\n`;
        summary += `• Region: ${cluster.region}\n`;
        if (cluster.channel) {
          summary += `• Channel: ${cluster.channel}\n`;
        }
        summary += `• GDPR Compliant: ${cluster.gdpr ? "Yes" : "No"}\n`;
        summary += `\n`;
      });

      // Show impact if clusters changed
      if (args.clusters) {
        const newRegions = [...new Set(signal.clusters.map((c) => c.region))];
        const oldRegions = [
          ...new Set(currentSignal.clusters.map((c) => c.region)),
        ];
        const newGdprClusters = signal.clusters.filter((c) => c.gdpr).length;
        const oldGdprClusters = currentSignal.clusters.filter(
          (c) => c.gdpr,
        ).length;

        summary += `### Impact Analysis\n`;
        if (
          JSON.stringify(newRegions.sort()) !==
          JSON.stringify(oldRegions.sort())
        ) {
          summary += `• **Regional Coverage:** ${oldRegions.join(", ")} → ${newRegions.join(", ")}\n`;
        }
        if (newGdprClusters !== oldGdprClusters) {
          summary += `• **GDPR Compliance:** ${oldGdprClusters} → ${newGdprClusters} cluster(s)\n`;
        }
        summary += `• **Data Migration:** Existing signal data will be migrated to new cluster configuration\n`;
        summary += `• **API Endpoints:** No change - key type remains ${signal.key}\n\n`;
      }

      // Usage information
      const isComposite = signal.key.includes(",");
      summary += `## Updated Usage\n\n`;
      if (isComposite) {
        summary += `**Composite Key Format:** \`${signal.key}\`\n`;
        const exampleValues = signal.key.split(",").map((k) => {
          switch (k.trim()) {
            case "domain":
              return "cnn.com";
            case "maid":
              return "abcd-1234";
            case "postal_code":
              return "90210";
            default:
              return `${k.trim()}_value`;
          }
        });
        summary += `**Example:** \`${exampleValues.join(",")}\`\n`;
      } else {
        const exampleValue =
          signal.key === "maid"
            ? "abcd-1234-efgh-5678"
            : signal.key === "postal_code"
              ? "90210"
              : `${signal.key}_example`;
        summary += `**Single Key Format:** \`${signal.key}\`\n`;
        summary += `**Example:** \`${exampleValue}\`\n`;
      }
      summary += `**API Endpoint:** \`/signals/${signal.key}\`\n\n`;

      // Next steps
      summary += `**Next Steps:**\n`;
      summary += `• Signal data continues to work with updated configuration\n`;
      summary += `• Regional data will be automatically migrated if clusters changed\n`;
      summary += `• Use \`get_custom_signal\` to view complete updated details\n`;
      summary += `• Update campaign prompts if signal name or description changed\n\n`;

      summary += `**Metadata:**\n`;
      summary += `• **Created:** ${new Date(signal.createdAt).toLocaleString()}\n`;
      summary += `• **Updated:** ${new Date(signal.updatedAt).toLocaleString()}\n`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to update custom signal", error);
    }
  },

  name: "signal/update",
  parameters: z.object({
    clusters: z
      .array(
        z.object({
          channel: z
            .string()
            .optional()
            .describe(
              "Optional channel targeting (e.g., 'ctv', 'web', 'mobile')",
            ),
          gdpr: z
            .boolean()
            .optional()
            .describe("Enable GDPR compliance for EU data residency"),
          region: z
            .string()
            .describe(
              "Region code (e.g., 'us-east-1', 'eu-west-1', 'emea-ex-eu')",
            ),
        }),
      )
      .optional()
      .describe("Updated cluster configurations for regional deployment"),
    description: z
      .string()
      .optional()
      .describe("Updated description of the signal's purpose and usage"),
    name: z
      .string()
      .optional()
      .describe("Updated human-readable name for the custom signal"),
    signalId: z
      .string()
      .describe("The unique ID of the custom signal to update"),
  }),
});
