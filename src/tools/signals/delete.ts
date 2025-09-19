import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  DeleteCustomSignalParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";

import { createMCPResponse } from "../../utils/error-handling.js";

export const deleteCustomSignalTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Signals",
    dangerLevel: "high",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Delete Custom Signal",
  },

  description:
    "Delete a custom signal definition from the Custom Signals Platform. WARNING: This will permanently remove the signal definition and all associated data. This action cannot be undone. Requires authentication.",

  execute: async (
    args: DeleteCustomSignalParams,
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
      // First get signal details to show what's being deleted
      let signalDetails;
      try {
        signalDetails = await client.getCustomSignal(apiKey, args.signalId);
      } catch (error) {
        throw new Error(
          `Signal not found. Please check the signal ID.: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Perform the deletion
      const result = await client.deleteCustomSignal(apiKey, args.signalId);

      if (!result.deleted) {
        throw new Error(
          "Signal deletion failed. The signal may be in use by active campaigns.",
        );
      }

      let summary = `🗑️ **Custom Signal Deleted**\n\n`;
      summary += `### ${signalDetails.name}\n`;
      summary += `**ID:** ${result.id}\n`;
      summary += `**Key Type:** ${signalDetails.key}\n`;
      summary += `**Description:** ${signalDetails.description}\n\n`;

      // Show what was removed
      summary += `## Deleted Configuration\n\n`;

      const isComposite = signalDetails.key.includes(",");
      if (isComposite) {
        summary += `**Composite Key:** ${signalDetails.key.split(",").join(" + ")}\n`;
      } else {
        summary += `**Single Key:** ${signalDetails.key}\n`;
      }

      summary += `**Regional Clusters:** ${signalDetails.clusters.length}\n`;
      signalDetails.clusters.forEach((cluster, index) => {
        summary += `• Cluster ${index + 1}: ${cluster.region}`;
        if (cluster.channel) {
          summary += ` (${cluster.channel})`;
        }
        if (cluster.gdpr) {
          summary += ` [GDPR]`;
        }
        summary += `\n`;
      });
      summary += `\n`;

      // Data impact warning
      summary += `## ⚠️ Data Impact\n\n`;
      summary += `**PERMANENT DELETION:** This action has permanently removed:\n`;
      summary += `• Signal definition and metadata\n`;
      summary += `• All regional cluster configurations\n`;
      summary += `• All associated signal data across regions\n`;
      summary += `• Historical performance data\n\n`;

      summary += `**API Endpoints:** The following endpoints are no longer available:\n`;
      summary += `• \`POST /signals/${signalDetails.key}\`\n`;
      summary += `• \`GET /signals/${signalDetails.key}/{identifier}\`\n\n`;

      // Campaign impact
      summary += `## Campaign Impact\n\n`;
      summary += `**⚠️ Active Campaigns:** Any campaigns referencing "${signalDetails.name}" signals will:\n`;
      summary += `• No longer receive this signal data for targeting\n`;
      summary += `• Continue running with remaining available signals\n`;
      summary += `• May show reduced targeting effectiveness\n\n`;

      summary += `**Recommended Actions:**\n`;
      summary += `• Review active campaigns that may have referenced this signal\n`;
      summary += `• Update campaign prompts to remove references to "${signalDetails.name}"\n`;
      summary += `• Consider creating replacement signals with similar targeting\n`;
      summary += `• Monitor campaign performance for any targeting impact\n\n`;

      // Recovery information
      summary += `## Recovery Options\n\n`;
      summary += `**⚠️ This deletion cannot be undone.** If you need to restore this signal:\n`;
      summary += `1. Create a new signal with \`create_custom_signal\`\n`;
      summary += `2. Use the same key type: \`${signalDetails.key}\`\n`;
      summary += `3. Configure similar regional clusters\n`;
      summary += `4. Re-upload all signal data via the data API\n`;
      summary += `5. Update campaign references to the new signal ID\n\n`;

      summary += `**Previous Configuration (for reference):**\n`;
      summary += `\`\`\`json\n`;
      summary += JSON.stringify(
        {
          clusters: signalDetails.clusters,
          description: signalDetails.description,
          key: signalDetails.key,
          name: signalDetails.name,
        },
        null,
        2,
      );
      summary += `\n\`\`\`\n\n`;

      summary += `**Next Steps:**\n`;
      summary += `• Verify campaigns are still performing as expected\n`;
      summary += `• Create replacement signals if needed\n`;
      summary += `• Update documentation and team communications\n`;
      summary += `• Consider data governance policies to prevent accidental deletions\n\n`;

      summary += `The custom signal has been permanently removed from the platform.`;

      return createMCPResponse({
        data: {
          configuration: {
            signalId: args.signalId,
          },
          deletedSignal: {
            clusters: signalDetails.clusters,
            description: signalDetails.description,
            id: result.id,
            key: signalDetails.key,
            name: signalDetails.name,
          },
          deletionResult: result,
          impact: {
            apiEndpointsRemoved: [
              `/signals/${signalDetails.key}`,
              `/signals/${signalDetails.key}/{identifier}`,
            ],
            channelSpecificClustersRemoved: signalDetails.clusters.filter(
              (c) => c.channel,
            ).length,
            clustersRemoved: signalDetails.clusters.length,
            gdprClustersRemoved: signalDetails.clusters.filter((c) => c.gdpr)
              .length,
            isComposite: signalDetails.key.includes(","),
            keyTypes: signalDetails.key.split(",").map((k) => k.trim()),
            regionsAffected: [
              ...new Set(signalDetails.clusters.map((c) => c.region)),
            ],
          },
          recoveryData: {
            previousConfiguration: {
              clusters: signalDetails.clusters,
              description: signalDetails.description,
              key: signalDetails.key,
              name: signalDetails.name,
            },
          },
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to delete custom signal: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "signal_delete",
  parameters: z.object({
    signalId: z
      .string()
      .describe(
        "The unique ID of the custom signal to delete (WARNING: This action cannot be undone)",
      ),
  }),
});
