import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  CreateCustomSignalParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";

import { CustomSignalsClient } from "../../services/custom-signals-client.js";
import { createMCPResponse } from "../../utils/error-handling.js";

export const createCustomSignalTool = (_client?: Scope3ApiClient) => ({
  annotations: {
    category: "Signals",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Custom Signal",
  },

  description:
    "Create a new custom signal definition for the Custom Signals Platform. Defines the signal metadata, key type (single or composite), and regional cluster configuration for data residency and compliance. Requires authentication.",

  execute: async (
    args: CreateCustomSignalParams,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check session context first, then fall back to environment variable
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      throw new Error(
        "Authentication required. Please set the SCOPE3_API_KEY environment variable or provide via headers.",
      );
    }

    try {
      // Validate key format
      const validKeyTypes = [
        "maid",
        "rampid",
        "id5",
        "coreid",
        "yahoo_connect",
        "postal_code",
        "lat_long",
        "uk_postal_district",
        "domain",
        "app_bundle",
        "property_id",
      ];

      const keyParts = args.key.split(",").map((k) => k.trim());
      const invalidKeys = keyParts.filter((k) => !validKeyTypes.includes(k));

      if (invalidKeys.length > 0) {
        throw new Error(
          `Invalid key type(s): ${invalidKeys.join(", ")}. Valid types: ${validKeyTypes.join(", ")}`,
        );
      }

      // Validate clusters have required region
      if (!args.clusters || args.clusters.length === 0) {
        throw new Error("At least one cluster configuration is required");
      }

      const customSignalsClient = new CustomSignalsClient();
      const signal = await customSignalsClient.createCustomSignal(apiKey, {
        clusters: args.clusters.map((c) => ({
          channel: c.channel,
          gdpr: c.gdpr,
          region: c.region,
        })),
        description: args.description,
        key: args.key,
        name: args.name,
      });

      let summary = `✅ Custom Signal Created Successfully!\n\n`;
      summary += `**Signal Details:**\n`;
      summary += `• **Name:** ${signal.name}\n`;
      summary += `• **ID:** ${signal.id}\n`;
      summary += `• **Key Type:** ${signal.key}\n`;
      summary += `• **Description:** ${signal.description}\n`;
      summary += `• **Created:** ${new Date(signal.createdAt).toLocaleString()}\n\n`;

      summary += `**Cluster Configuration:**\n`;
      signal.clusters.forEach((cluster, index) => {
        summary += `• **Cluster ${index + 1}:** ${cluster.region}`;
        if (cluster.channel) {
          summary += ` (${cluster.channel})`;
        }
        if (cluster.gdpr) {
          summary += ` [GDPR Compliant]`;
        }
        summary += `\n`;
      });
      summary += `\n`;

      const isComposite = signal.key.includes(",");
      if (isComposite) {
        summary += `🔗 **Composite Key Signal**\n`;
        summary += `This signal uses composite keys combining: ${signal.key.split(",").join(" + ")}\n`;
        summary += `Example usage: \`${signal.key
          .split(",")
          .map((k) =>
            k === "postal_code"
              ? "90210"
              : k === "domain"
                ? "cnn.com"
                : k === "maid"
                  ? "abcd-1234-efgh-5678"
                  : `${k}_value`,
          )
          .join(",")}\`\n\n`;
      } else {
        summary += `🎯 **Single Key Signal**\n`;
        summary += `This signal uses ${signal.key} identifiers\n`;
        const exampleValue =
          signal.key === "postal_code"
            ? "90210"
            : signal.key === "domain"
              ? "cnn.com"
              : signal.key === "maid"
                ? "abcd-1234-efgh-5678"
                : `${signal.key}_value`;
        summary += `Example usage: \`${exampleValue}\`\n\n`;
      }

      summary += `📊 **What are Custom Signals?**\n`;
      summary += `Custom signals are metadata definitions that specify:\n`;
      summary += `• Which identifier types can be used (${signal.key})\n`;
      summary += `• Regional data residency and compliance requirements\n`;
      summary += `• Channel-specific configurations for targeting\n`;
      summary += `• Business context for campaign optimization\n\n`;

      summary += `**Next Steps:**\n`;
      summary += `• Upload actual signal data using the Custom Signals data API\n`;
      summary += `• Reference this signal in campaign prompts for targeting\n`;
      summary += `• Monitor signal performance through campaign analytics\n`;
      summary += `• Create additional signal variants for different use cases\n\n`;

      summary += `**Regional Configuration:**\n`;
      const regions = signal.clusters.map((c) => c.region).join(", ");
      summary += `• **Active Regions:** ${regions}\n`;
      const gdprClusters = signal.clusters.filter((c) => c.gdpr).length;
      if (gdprClusters > 0) {
        summary += `• **GDPR Compliance:** ${gdprClusters} cluster(s) configured for EU data residency\n`;
      }
      summary += `• **Data Processing:** Distributed across configured regions for optimal performance\n\n`;

      summary += `The custom signal definition is ready for data ingestion!`;

      return createMCPResponse({
        data: {
          configuration: {
            clusters: args.clusters,
            description: args.description,
            key: args.key,
            name: args.name,
          },
          metadata: {
            channelSpecificClusters: signal.clusters.filter((c) => c.channel)
              .length,
            gdprCompliantClusters: signal.clusters.filter((c) => c.gdpr).length,
            isComposite: signal.key.includes(","),
            keyTypes: signal.key.split(",").map((k) => k.trim()),
            regions: signal.clusters.map((c) => c.region),
            totalClusters: signal.clusters.length,
          },
          signal,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to create custom signal: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "signal/create",
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
      .min(1)
      .describe("Array of cluster configurations for regional deployment"),
    description: z
      .string()
      .describe("Detailed description of the signal's purpose and usage"),
    key: z
      .string()
      .describe(
        "Key type for the signal. Single types: 'maid', 'domain', 'postal_code', etc. Composite types: 'postal_code,domain', 'maid,domain'",
      ),
    name: z.string().describe("Human-readable name for the custom signal"),
  }),
});
