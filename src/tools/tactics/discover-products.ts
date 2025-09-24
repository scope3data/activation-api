import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { ADCPProductDiscoveryService } from "../../services/adcp-product-discovery.js";

// ADCP Multi-Agent Discovery Function
async function executeADCPDiscovery(
  args: {
    campaignBrief?: string;
    deliveryType?: "guaranteed" | "non_guaranteed";
    formats?: ("audio" | "display" | "html5" | "native" | "video")[];
    maxCpm?: number;
    minCpm?: number;
    salesAgents?: string[];
  },
  customerId: number,
): Promise<string> {
  try {
    // Create ADCP client from database configuration
    const adcpService = await ADCPProductDiscoveryService.fromDatabase(
      customerId,
      { debug: true },
    );

    const availableAgents = adcpService.getAvailableAgents();
    if (availableAgents.length === 0) {
      return "⚠️ **ADCP Discovery Unavailable**\n\nNo ADCP sales agents are enabled for your account. This could mean:\n\n• No sales agents have been configured in the system\n• All sales agents have been disabled for your account\n• There may be a database connectivity issue\n\n**Setup Guide:**\n• Use `sales_agents_list` to see available agents\n• Use `sales_agents_manage` to enable agents for your account\n• Contact your administrator to configure sales agents in the system";
    }

    // Build query for ADCP
    const query = {
      campaignBrief: args.campaignBrief,
      deliveryType: args.deliveryType,
      formats: args.formats as
        | ("audio" | "display" | "html5" | "native" | "video")[]
        | undefined,
      maxCpm: args.maxCpm,
      minCpm: args.minCpm,
    };

    let result;
    if (args.salesAgents && args.salesAgents.length > 0) {
      // Query specific sales agents
      result = await adcpService.discoverProductsFromAgents(
        args.salesAgents,
        query,
      );
    } else {
      // Query all available sales agents
      result = await adcpService.discoverProducts(query, {
        minSuccessfulAgents: 1,
      });
    }

    const { agentResults, products } = result;

    if (products.length === 0) {
      let summary = "🔍 **No Products Found via ADCP**\n\n";
      summary +=
        "No publisher products match your criteria across all sales agents.\n\n";

      // Show agent results
      summary += "**Sales Agent Results:**\n";
      agentResults.forEach((agent) => {
        const status = agent.success ? "✅" : "❌";
        summary += `• ${status} **${agent.agentName}** (${agent.agentId}): ${agent.productCount} products`;
        if (agent.error) {
          summary += ` - ${agent.error}`;
        }
        summary += "\n";
      });

      return summary;
    }

    // Build response with multi-agent insights
    let summary = "🚀 **ADCP Multi-Agent Discovery**\n\n";
    summary += `📦 Found **${products.length} products** from **${agentResults.filter((a) => a.success).length}/${agentResults.length} sales agents**\n\n`;

    // Agent performance summary
    summary += "**Sales Agent Results:**\n";
    agentResults.forEach((agent) => {
      const status = agent.success ? "✅" : "❌";
      summary += `• ${status} **${agent.agentName}**: ${agent.productCount} products`;
      if (agent.error) {
        summary += ` (Error: ${agent.error})`;
      }
      summary += "\n";
    });
    summary += "\n";

    // Group products by publisher
    const productsByPublisher = products.reduce(
      (acc, product) => {
        if (!acc[product.publisherName]) {
          acc[product.publisherName] = [];
        }
        acc[product.publisherName].push(product);
        return acc;
      },
      {} as Record<string, typeof products>,
    );

    // Display products grouped by publisher
    for (const [publisherName, publisherProducts] of Object.entries(
      productsByPublisher,
    )) {
      summary += `## 🏢 **${publisherName}** (${publisherProducts.length} products)\n\n`;

      publisherProducts.slice(0, 5).forEach((product, index) => {
        // Limit to 5 per publisher for readability
        summary += `### ${index + 1}. **${product.name}**\n`;
        summary += `   - **Product ID:** ${product.productId}\n`;
        summary += `   - **Type:** ${product.inventoryType.replace(/_/g, " ")} • ${product.deliveryType.replace(/_/g, " ")}\n`;
        summary += `   - **Formats:** ${product.formats.join(", ")}\n`;

        // Pricing information
        if (
          product.basePricing.model === "fixed_cpm" &&
          product.basePricing.fixedCpm
        ) {
          summary += `   - **Pricing:** $${product.basePricing.fixedCpm.toFixed(2)} CPM (fixed)\n`;
        } else if (product.basePricing.model === "auction") {
          summary += `   - **Pricing:** Auction`;
          if (product.basePricing.floorCpm) {
            summary += ` (floor: $${product.basePricing.floorCpm.toFixed(2)})`;
          }
          if (product.basePricing.targetCpm) {
            summary += ` (target: $${product.basePricing.targetCpm.toFixed(2)})`;
          }
          summary += "\n";
        }

        summary += `   - **Description:** ${product.description}\n\n`;
      });

      if (publisherProducts.length > 5) {
        summary += `   *... and ${publisherProducts.length - 5} more products*\n\n`;
      }

      summary += "---\n\n";
    }

    // Summary statistics
    const guaranteedCount = products.filter(
      (p) => p.deliveryType === "guaranteed",
    ).length;
    const nonGuaranteedCount = products.filter(
      (p) => p.deliveryType === "non_guaranteed",
    ).length;
    const premiumCount = products.filter(
      (p) => p.inventoryType === "premium",
    ).length;

    summary += "## 📊 **Multi-Agent Summary**\n\n";
    summary += `• **Publishers:** ${Object.keys(productsByPublisher).length}\n`;
    summary += `• **Guaranteed:** ${guaranteedCount} products\n`;
    summary += `• **Non-guaranteed:** ${nonGuaranteedCount} products\n`;
    summary += `• **Premium inventory:** ${premiumCount} products\n`;
    summary += `• **Successful agents:** ${agentResults.filter((a) => a.success).length}/${agentResults.length}\n\n`;

    summary += "🔗 **ADCP Protocol Benefits:**\n";
    summary += "• Parallel discovery across multiple sales agents\n";
    summary += "• Standardized product data format\n";
    summary += "• Real-time inventory availability\n";
    summary += "• Cross-platform product comparison\n\n";

    summary += "**Next Steps:**\n";
    summary +=
      "• Use create_inventory_option to combine products with targeting\n";
    summary += "• Compare pricing and delivery guarantees across agents\n";
    summary += "• Use sales_agents_list to see all available agents";

    return summary;
  } catch (error) {
    console.error("ADCP Discovery Error:", error);
    return `❌ **ADCP Discovery Failed**\n\nError: ${error instanceof Error ? error.message : String(error)}\n\nUse sales_agents_list to check agent configuration.`;
  }
}

export const discoverPublisherProductsTool = (_client: Scope3ApiClient) => ({
  annotations: {
    category: "Tactics",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Discover Publisher Products",
  },

  description:
    "Discover available publisher media products based on campaign requirements using multi-agent ADCP protocol. Returns raw publisher inventory from multiple sales agents in parallel before applying any targeting strategies. Requires authentication and configured sales agents.",

  execute: async (
    args: {
      campaignBrief?: string;
      campaignId?: string;
      deliveryType?: "guaranteed" | "non_guaranteed";
      formats?: string[];
      inventoryType?: "premium" | "run_of_site" | "targeted_package";
      maxCpm?: number;
      minCpm?: number;
      publisherIds?: string[];
      salesAgents?: string[];
      supportedSignals?: ("buyer" | "scope3" | "third_party")[];
    },
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
      // Get customer ID from session context (defaulting to 1 for testing)
      const customerId = context.session?.customerId || 1;

      // Always use ADCP multi-agent discovery
      return await executeADCPDiscovery(
        {
          campaignBrief: args.campaignBrief,
          deliveryType: args.deliveryType,
          formats: args.formats as
            | ("audio" | "display" | "html5" | "native" | "video")[]
            | undefined,
          maxCpm: args.maxCpm,
          minCpm: args.minCpm,
          salesAgents: args.salesAgents,
        },
        customerId,
      );
    } catch (error) {
      throw new Error(
        `Failed to discover publisher products: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "tactic_discover_products",
  parameters: z.object({
    campaignBrief: z
      .string()
      .optional()
      .describe(
        "Natural language description of campaign goals to help match relevant inventory",
      ),
    campaignId: z
      .string()
      .optional()
      .describe("Campaign ID to enable tactic seed data cooperative insights"),
    deliveryType: z
      .enum(["guaranteed", "non_guaranteed"])
      .optional()
      .describe("Filter by delivery guarantee type"),
    formats: z
      .array(z.enum(["display", "video", "native", "audio", "html5"]))
      .optional()
      .describe("Creative formats to filter by"),
    inventoryType: z
      .enum(["run_of_site", "premium", "targeted_package"])
      .optional()
      .describe("Type of inventory to search for"),
    maxCpm: z.number().optional().describe("Maximum CPM price filter"),
    minCpm: z.number().optional().describe("Minimum CPM price filter"),
    publisherIds: z
      .array(z.string())
      .optional()
      .describe("Specific publisher IDs to search within"),
    salesAgents: z
      .array(z.string())
      .optional()
      .describe(
        "Specific sales agent IDs to query. If not provided, queries all available sales agents",
      ),
    supportedSignals: z
      .array(z.enum(["buyer", "scope3", "third_party"]))
      .optional()
      .describe("Filter products by signal support"),
  }),
});
