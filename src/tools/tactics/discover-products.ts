import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const discoverPublisherProductsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Tactics",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Discover Publisher Products",
  },

  description:
    "Discover available publisher media products based on campaign requirements. Returns raw publisher inventory before applying any targeting strategies. Use this to explore available inventory options from various publishers. Requires authentication.",

  execute: async (
    args: {
      campaignBrief?: string;
      deliveryType?: "guaranteed" | "non_guaranteed";
      formats?: string[];
      inventoryType?: "premium" | "run_of_site" | "targeted_package";
      maxCpm?: number;
      minCpm?: number;
      publisherIds?: string[];
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
      return createAuthErrorResponse();
    }

    try {
      // Build discovery query from parameters
      const discoveryQuery = {
        campaignBrief: args.campaignBrief,
        deliveryType: args.deliveryType,
        formats: args.formats as (
          | "audio"
          | "display"
          | "html5"
          | "native"
          | "video"
        )[],
        inventoryType: args.inventoryType,
        maxCpm: args.maxCpm,
        minCpm: args.minCpm,
        publisherIds: args.publisherIds,
        supportedSignals: args.supportedSignals,
      };

      // Remove undefined values
      Object.keys(discoveryQuery).forEach((key) => {
        if ((discoveryQuery as Record<string, unknown>)[key] === undefined) {
          delete (discoveryQuery as Record<string, unknown>)[key];
        }
      });

      const products = await client.discoverPublisherProducts(
        apiKey,
        discoveryQuery,
      );

      if (products.length === 0) {
        return createMCPResponse({
          message:
            "🔍 **No Publisher Products Found**\n\nNo publisher products match your current criteria. Try adjusting your filters or requirements.",
          success: true,
        });
      }

      let summary = `📦 **Found ${products.length} Publisher Products**\n\n`;

      // Group products by publisher for better organization
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

        publisherProducts.forEach((product, index) => {
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
            summary += `\n`;
          }

          // Signal support
          if (
            product.supportedTargeting &&
            product.supportedTargeting.length > 0
          ) {
            const signals = [];
            if (product.supportedTargeting.includes("buyer_signals"))
              signals.push("1st Party");
            if (product.supportedTargeting.includes("scope3_signals"))
              signals.push("Scope3");
            if (
              product.supportedTargeting.some((t) => t.includes("third_party"))
            )
              signals.push("3rd Party");

            if (signals.length > 0) {
              summary += `   - **Signal Support:** ${signals.join(", ")}\n`;
            }
          }

          summary += `   - **Description:** ${product.description}\n\n`;
        });

        summary += `---\n\n`;
      }

      // Add summary statistics
      const guaranteedCount = products.filter(
        (p) => p.deliveryType === "guaranteed",
      ).length;
      const nonGuaranteedCount = products.filter(
        (p) => p.deliveryType === "non_guaranteed",
      ).length;
      const premiumCount = products.filter(
        (p) => p.inventoryType === "premium",
      ).length;

      const cpmPrices = products
        .map((p) => p.basePricing.fixedCpm || p.basePricing.targetCpm)
        .filter(Boolean) as number[];

      summary += `## 📊 **Summary**\n\n`;
      summary += `• **Publishers:** ${Object.keys(productsByPublisher).length}\n`;
      summary += `• **Guaranteed:** ${guaranteedCount} products\n`;
      summary += `• **Non-guaranteed:** ${nonGuaranteedCount} products\n`;
      summary += `• **Premium inventory:** ${premiumCount} products\n`;

      if (cpmPrices.length > 0) {
        const avgCpm = cpmPrices.reduce((a, b) => a + b, 0) / cpmPrices.length;
        const minPrice = Math.min(...cpmPrices);
        const maxPrice = Math.max(...cpmPrices);
        summary += `• **Price range:** $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)} CPM\n`;
        summary += `• **Average CPM:** $${avgCpm.toFixed(2)}\n`;
      }

      summary += `\n**Next Steps:**\n`;
      summary += `• Use create_inventory_option to combine products with targeting strategies\n`;
      summary += `• Consider different signal types for the same publisher product\n`;
      summary += `• Review pricing and delivery guarantees for budget planning`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        "Failed to discover publisher products",
        error,
      );
    }
  },

  name: "tactic/discover-products",
  parameters: z.object({
    campaignBrief: z
      .string()
      .optional()
      .describe(
        "Natural language description of campaign goals to help match relevant inventory",
      ),
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
    supportedSignals: z
      .array(z.enum(["buyer", "scope3", "third_party"]))
      .optional()
      .describe("Filter products by signal support"),
  }),
});
