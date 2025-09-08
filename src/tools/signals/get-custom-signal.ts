import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  GetCustomSignalParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const getCustomSignalTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "custom-signals",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Get Custom Signal",
  },

  description:
    "Retrieve detailed information about a specific custom signal definition. Shows complete configuration including all cluster settings, metadata, and usage instructions. Requires authentication.",

  execute: async (
    args: GetCustomSignalParams,
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
      const signal = await client.getCustomSignal(apiKey, args.signalId);

      let summary = `🎯 **Custom Signal Details**\n\n`;
      summary += `### ${signal.name}\n`;
      summary += `**ID:** ${signal.id}\n`;
      summary += `**Description:** ${signal.description}\n\n`;

      // Key type analysis
      const isComposite = signal.key.includes(",");
      summary += `## Key Configuration\n\n`;
      if (isComposite) {
        const keyParts = signal.key.split(",").map((k) => k.trim());
        summary += `**Type:** Composite Key\n`;
        summary += `**Components:** ${keyParts.join(" + ")}\n`;
        summary += `**Format:** \`${keyParts.join(",")}\`\n\n`;

        summary += `**Usage Examples:**\n`;
        const exampleValues = keyParts.map((k) => {
          switch (k) {
            case "app_bundle":
              return "com.example.app";
            case "domain":
              return "cnn.com";
            case "lat_long":
              return "34.0522,-118.2437";
            case "maid":
              return "abcd-1234-efgh-5678";
            case "postal_code":
              return "90210";
            case "rampid":
              return "RMP_12345";
            default:
              return `${k}_value`;
          }
        });
        summary += `• **Example Key:** \`${exampleValues.join(",")}\`\n`;
        summary += `• **API Endpoint:** \`/signals/${signal.key}\`\n\n`;
      } else {
        summary += `**Type:** Single Key\n`;
        summary += `**Key Type:** ${signal.key}\n\n`;

        const exampleValue =
          signal.key === "postal_code"
            ? "90210"
            : signal.key === "domain"
              ? "cnn.com"
              : signal.key === "maid"
                ? "abcd-1234-efgh-5678"
                : signal.key === "rampid"
                  ? "RMP_12345"
                  : `${signal.key}_value`;

        summary += `**Usage Examples:**\n`;
        summary += `• **Example Key:** \`${exampleValue}\`\n`;
        summary += `• **API Endpoint:** \`/signals/${signal.key}/${exampleValue}\`\n\n`;
      }

      // Cluster configuration details
      summary += `## Regional Configuration\n\n`;
      summary += `**Total Clusters:** ${signal.clusters.length}\n\n`;

      signal.clusters.forEach((cluster, index) => {
        summary += `### Cluster ${index + 1}\n`;
        summary += `• **Region:** ${cluster.region}\n`;
        if (cluster.channel) {
          summary += `• **Channel:** ${cluster.channel}\n`;
        }
        summary += `• **GDPR Compliant:** ${cluster.gdpr ? "Yes" : "No"}\n`;

        // Add region-specific context
        if (cluster.region.includes("eu") || cluster.gdpr) {
          summary += `• **Data Residency:** EU/European data centers\n`;
        } else if (cluster.region.includes("us")) {
          summary += `• **Data Residency:** US data centers\n`;
        }
        summary += `\n`;
      });

      // Usage guidance
      summary += `## Usage Instructions\n\n`;
      summary += `### Data Upload Methods\n`;
      summary += `1. **Real-time API:** POST to \`/signals/${signal.key}\`\n`;
      summary += `2. **Batch Upload:** CSV files to designated cloud buckets\n`;
      summary += `3. **LiveRamp Integration:** Automated RampID resolution\n\n`;

      summary += `### Signal Data Operations\n`;
      summary += `• **SET:** Replace all signals for an identifier\n`;
      summary += `• **ADD:** Add new signals to an identifier\n`;
      summary += `• **REM:** Remove specific signals from an identifier\n`;
      summary += `• **DEL:** Remove all signals for an identifier\n\n`;

      if (isComposite) {
        summary += `### Composite Key Example\n`;
        summary += `\`\`\`bash\n`;
        summary += `curl -X POST https://api.scope3.com/signals/${signal.key} \\\n`;
        summary += `  -H "Authorization: Bearer YOUR_API_KEY" \\\n`;
        summary += `  -H "Content-Type: text/plain" \\\n`;
        summary += `  -d "SET ${signal.key
          .split(",")
          .map((k) => {
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
          })
          .join(",")} premium_audience high_value"\n`;
        summary += `\`\`\`\n\n`;
      } else {
        const exampleValue =
          signal.key === "maid"
            ? "abcd-1234-efgh-5678"
            : signal.key === "postal_code"
              ? "90210"
              : `${signal.key}_example`;
        summary += `### Single Key Example\n`;
        summary += `\`\`\`bash\n`;
        summary += `curl -X POST https://api.scope3.com/signals/${signal.key} \\\n`;
        summary += `  -H "Authorization: Bearer YOUR_API_KEY" \\\n`;
        summary += `  -H "Content-Type: text/plain" \\\n`;
        summary += `  -d "SET ${exampleValue} premium_audience high_value"\n`;
        summary += `\`\`\`\n\n`;
      }

      // Campaign integration
      summary += `### Campaign Integration\n`;
      summary += `Reference this signal in campaign prompts:\n`;
      summary += `\`\`\`javascript\n`;
      summary += `const campaign = await createCampaign({\n`;
      summary += `  brandAgentId: "ba_123",\n`;
      summary += `  name: "Premium ${signal.name} Campaign",\n`;
      summary += `  prompt: "Target premium_audience and high_value signals from ${signal.name}",\n`;
      summary += `  budget: { total: 50000, currency: "USD" }\n`;
      summary += `});\n`;
      summary += `\`\`\`\n\n`;

      // Metadata
      summary += `## Metadata\n\n`;
      summary += `• **Created:** ${new Date(signal.createdAt).toLocaleString()}\n`;
      if (signal.updatedAt) {
        summary += `• **Last Updated:** ${new Date(signal.updatedAt).toLocaleString()}\n`;
      }

      // Regional compliance summary
      const gdprClusters = signal.clusters.filter((c) => c.gdpr).length;
      const regions = [...new Set(signal.clusters.map((c) => c.region))];
      const channels = signal.clusters.map((c) => c.channel).filter(Boolean);

      summary += `• **Geographic Coverage:** ${regions.length} region(s)\n`;
      if (gdprClusters > 0) {
        summary += `• **GDPR Compliance:** ${gdprClusters}/${signal.clusters.length} clusters\n`;
      }
      if (channels.length > 0) {
        summary += `• **Channel Targeting:** ${[...new Set(channels)].join(", ")}\n`;
      }

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to get custom signal", error);
    }
  },

  name: "get_custom_signal",
  parameters: z.object({
    signalId: z
      .string()
      .describe("The unique ID of the custom signal to retrieve"),
  }),
});
