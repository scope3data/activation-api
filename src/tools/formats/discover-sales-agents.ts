import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

/**
 * Discover creative formats by calling registered sales agents
 * This implements the sales agent format discovery pattern from ADCP
 */
export const discoverSalesAgentFormatsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Creatives",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Discover Sales Agent Formats",
  },

  description:
    "Discover creative formats by calling list_creative_formats on registered sales agents. This pulls the latest supported formats directly from active sales agents in the network, ensuring our format library stays current with what's actually available.",

  execute: async (
    args: {
      includeAdcpStandards?: boolean;
      refreshCache?: boolean;
      salesAgentUrl?: string;
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check authentication
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      return createAuthErrorResponse();
    }

    try {
      // Get list of registered sales agents (or use provided URL)
      const salesAgents = args.salesAgentUrl
        ? [{ name: "Provided Sales Agent", url: args.salesAgentUrl }]
        : await client.getRegisteredSalesAgents(apiKey);

      let discoveredFormats: Array<{
        description: string;
        formatId: string;
        name: string;
        requirements: {
          acceptsThirdPartyTags: boolean;
          assemblyCapable: boolean;
          requiredAssets: Array<{
            specs: {
              dimensions?: string;
              formats?: string[];
              maxSize?: string;
            };
            type: string;
          }>;
        };
        salesAgentName: string;
        salesAgentUrl: string;
      }> = [];

      let successCount = 0;
      let errorCount = 0;
      const errors: Array<{ agent: string; error: string }> = [];

      // Call list_creative_formats on each sales agent
      for (const agent of salesAgents) {
        try {
          console.log(
            `[DISCOVERY] Calling list_creative_formats on ${agent.url}`,
          );

          const agentFormats = await client.callSalesAgentFormatDiscovery(
            agent.url,
            {
              acceptsThirdPartyTags: true, // We want all formats
              includeRequirements: true,
            },
          );

          // Add sales agent context to each format
          for (const format of agentFormats.formats) {
            discoveredFormats.push({
              ...format,
              salesAgentName: agent.name,
              salesAgentUrl: agent.url,
            });
          }

          successCount++;
        } catch (error) {
          errorCount++;
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          errors.push({
            agent: `${agent.name} (${agent.url})`,
            error: errorMessage,
          });
          console.warn(
            `[DISCOVERY] Failed to get formats from ${agent.url}:`,
            error,
          );
        }
      }

      // Optionally include ADCP standards
      if (args.includeAdcpStandards !== false) {
        const adcpStandards = await client.getAdcpStandardFormats();
        discoveredFormats = [
          ...adcpStandards.map((format) => ({
            ...format,
            salesAgentName: "ADCP Standards",
            salesAgentUrl: "https://adcontextprotocol.org",
          })),
          ...discoveredFormats,
        ];
      }

      // Build response
      let response = `🔍 **Sales Agent Format Discovery Results**

📊 **Discovery Summary**
• Sales Agents Contacted: ${salesAgents.length}
• Successful Responses: ${successCount}
• Failed Responses: ${errorCount}
• Total Formats Discovered: ${discoveredFormats.length}

`;

      if (errorCount > 0) {
        response += `⚠️ **Failed Sales Agents:**
`;
        errors.forEach((error) => {
          response += `  • ${error.agent}: ${error.error}
`;
        });
        response += `

`;
      }

      if (discoveredFormats.length === 0) {
        response += `❌ **No formats discovered**

This could mean:
• All sales agents are offline or unreachable
• Sales agents don't support list_creative_formats
• Network connectivity issues

Try again later or check specific sales agent URLs.`;

        return createMCPResponse({ message: response, success: false });
      }

      // Group formats by sales agent
      const formatsBySalesAgent = discoveredFormats.reduce(
        (acc, format) => {
          const key = format.salesAgentName;
          if (!acc[key]) acc[key] = [];
          acc[key].push(format);
          return acc;
        },
        {} as Record<string, typeof discoveredFormats>,
      );

      response += `## 🤖 **Discovered Formats by Sales Agent**

`;

      for (const [agentName, formats] of Object.entries(formatsBySalesAgent)) {
        response += `### **${agentName}** (${formats.length} formats)

`;

        formats.forEach((format) => {
          response += `**${format.name}**
• **Format ID**: \`${format.formatId}\`
• **Description**: ${format.description}`;

          // Show capabilities
          const capabilities: string[] = [];
          if (format.requirements.assemblyCapable)
            capabilities.push("Assembly from assets");
          if (format.requirements.acceptsThirdPartyTags)
            capabilities.push("Third-party ad tags");

          if (capabilities.length > 0) {
            response += `
• **Capabilities**: ${capabilities.join(", ")}`;
          }

          // Show required assets
          if (format.requirements.requiredAssets.length > 0) {
            response += `
• **Required Assets**:`;
            for (const asset of format.requirements.requiredAssets) {
              response += `
  - ${asset.type}`;
              if (asset.specs.dimensions)
                response += ` (${asset.specs.dimensions})`;
              if (asset.specs.maxSize)
                response += ` (max: ${asset.specs.maxSize})`;
              if (asset.specs.formats?.length)
                response += ` [${asset.specs.formats.join(", ")}]`;
            }
          }

          response += `

`;
        });
      }

      response += `---

## 💡 **Usage in Creative Creation**

Use discovered format IDs in creative/create:

\`\`\`json
{
  "buyerAgentId": "brand_123",
  "creatives": [{
    "creativeName": "My Creative",
    "format": {
      "type": "publisher",
      "formatId": "discovered_format_id_here"
    },
    "content": { ... }
  }]
}
\`\`\`

💾 **Cache Update**: ${args.refreshCache ? "Formats refreshed from live sales agents" : "Using cached format data (use refreshCache: true to update)"}
`;

      return createMCPResponse({ message: response, success: true });
    } catch (error) {
      return createErrorResponse(
        "Failed to discover sales agent formats",
        error,
      );
    }
  },

  name: "format/discover-sales-agents",

  parameters: z.object({
    includeAdcpStandards: z
      .boolean()
      .optional()
      .describe("Include ADCP standard formats in results (default: true)"),

    refreshCache: z
      .boolean()
      .optional()
      .describe(
        "Refresh format cache from live sales agents (default: false, uses cached data)",
      ),

    salesAgentUrl: z
      .string()
      .optional()
      .describe(
        "Specific sales agent URL to query (if not provided, queries all registered agents)",
      ),
  }),
});
