import { z } from "zod";

import type { MCPToolExecuteContext } from "../../types/mcp.js";
import type { ProductDiscoveryQuery } from "../../types/tactics.js";

import { ADCPProductDiscoveryService } from "../../services/adcp-product-discovery.js";
import { createMCPResponse } from "../../utils/error-handling.js";
import { createLogger } from "../../utils/logging.js";

export const getProductsTool = () => ({
  annotations: {
    category: "Media Products",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Media Product List",
  },

  description:
    "Discover available media advertising products from all active sales agents based on campaign requirements. This tool queries all configured sales agents and calls their get_products endpoints to aggregate inventory results. Follows the Ad Context Protocol (ADCP) specification.",

  execute: async (
    args: {
      brief?: string; // Optional: Natural language campaign description
      customer_id?: string; // Optional: filter by specific customer
      delivery_type?: "guaranteed" | "non_guaranteed";
      formats?: ("audio" | "display" | "html5" | "native" | "video")[];
      inventory_type?: "premium" | "run_of_site" | "targeted_package";
      max_cpm?: number;
      min_cpm?: number;
      promoted_offering: string; // Required: Clear description of what is being promoted
      publisher_ids?: string[];
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    const logger = createLogger("media_product_list", context);
    const { startTime } = logger.logToolStart(args);

    try {
      // Validate required parameters
      if (!args.promoted_offering || args.promoted_offering.trim() === "") {
        throw new Error(
          "Missing required parameter 'promoted_offering': promoted_offering must be provided and non-empty",
        );
      }

      // Build ProductDiscoveryQuery from args
      const query: ProductDiscoveryQuery = {
        campaignBrief: args.promoted_offering, // Use promoted_offering as campaign brief
        deliveryType: args.delivery_type,
        formats: args.formats,
        inventoryType: args.inventory_type,
        maxCpm: args.max_cpm,
        minCpm: args.min_cpm,
        publisherIds: args.publisher_ids,
      };

      // Initialize ADCP Product Discovery Service
      context.log?.info("🔍 Initializing ADCP product discovery...");
      let adcpService: ADCPProductDiscoveryService;

      try {
        if (args.customer_id) {
          adcpService = await ADCPProductDiscoveryService.fromDatabase(
            parseInt(args.customer_id, 10),
          );
        } else {
          // Fallback to environment configuration
          adcpService = ADCPProductDiscoveryService.fromEnv({ debug: false });
        }

        const availableAgents = adcpService.getAvailableAgents();
        context.log?.info(
          `✅ Found ${availableAgents.length} available sales agents`,
        );
        logger.logInfo("ADCP service initialized", {
          agentCount: availableAgents.length,
          customerFiltered: !!args.customer_id,
        });

        if (availableAgents.length === 0) {
          const message = args.customer_id
            ? `🔍 **No Sales Agents Found for Customer ${args.customer_id}**\n\nNo ADCP-enabled sales agents found for the specified customer.`
            : `🔍 **No Sales Agents Found**\n\nNo ADCP-enabled sales agents are currently available.`;

          return createMCPResponse({
            data: {
              agentsQueried: 0,
              customerId: args.customer_id,
              failedAgents: 0,
              products: [],
              query: args.promoted_offering,
              successfulAgents: 0,
              totalProducts: 0,
            },
            message,
            success: true,
          });
        }
      } catch (error) {
        context.log?.error("❌ Failed to initialize ADCP service");
        logger.logToolError(error, {
          context: "adcp_initialization",
          startTime,
        });
        throw new Error(
          `Failed to initialize ADCP product discovery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      // Discover products using ADCP service
      const availableAgents = adcpService.getAvailableAgents();
      context.log?.info(
        `🚀 Querying ${availableAgents.length} sales agents for "${args.promoted_offering}"`,
      );
      logger.logInfo("Starting ADCP product discovery", {
        agentCount: availableAgents.length,
        promotedOffering: args.promoted_offering,
      });

      // Report initial progress
      await context.reportProgress?.({
        progress: 0,
        total: availableAgents.length,
      });

      // Execute product discovery via ADCP service
      const discoveryResult = await adcpService.discoverProducts(query);

      // Report completion
      await context.reportProgress?.({
        progress: availableAgents.length,
        total: availableAgents.length,
      });

      // Process results
      const { agentResults, products } = discoveryResult;
      const successfulAgents = agentResults.filter((r) => r.success).length;
      const failedAgents = agentResults.filter((r) => !r.success).length;

      // Log results
      logger.logInfo("ADCP product discovery completed", {
        agentsQueried: agentResults.length,
        failedAgents,
        successfulAgents,
        totalProducts: products.length,
      });

      // Calculate summary statistics
      const guaranteedProducts = products.filter(
        (p) => p.deliveryType === "guaranteed",
      ).length;
      const nonGuaranteedProducts = products.filter(
        (p) => p.deliveryType === "non_guaranteed",
      ).length;
      const uniquePublishers = new Set(
        products.map((p) => p.publisherName).filter(Boolean),
      ).size;
      const availableFormats = Array.from(
        new Set(products.flatMap((p) => p.formats || [])),
      );

      // Calculate price statistics
      const cpmPrices = products
        .map((p) => p.basePricing?.targetCpm || p.basePricing?.fixedCpm)
        .filter(Boolean) as number[];

      const priceRange =
        cpmPrices.length > 0
          ? {
              avgCpm: cpmPrices.reduce((a, b) => a + b, 0) / cpmPrices.length,
              maxCpm: Math.max(...cpmPrices),
              minCpm: Math.min(...cpmPrices),
            }
          : undefined;

      const duration = Date.now() - startTime;

      // Generate human-readable summary
      let summary = `🛒 **Product Discovery Results**\n\n`;
      summary += `**Query:** "${args.promoted_offering}"${args.brief ? ` - ${args.brief}` : ""}\n\n`;

      summary += `## 🚀 **Discovery Progress**\n`;
      agentResults.forEach((result) => {
        if (result.success) {
          summary += `✅ ${result.agentName} found ${result.productCount} products\n`;
        } else {
          summary += `❌ ${result.agentName} failed: ${result.error}\n`;
        }
      });

      summary += `\n## 📊 **Summary**\n`;
      summary += `• **Total Products:** ${products.length}\n`;
      summary += `• **Sales Agents Queried:** ${agentResults.length}\n`;
      summary += `• **Successful Responses:** ${successfulAgents}\n`;
      summary += `• **Failed Responses:** ${failedAgents}\n`;
      summary += `• **Unique Publishers:** ${uniquePublishers}\n`;
      summary += `• **Guaranteed Products:** ${guaranteedProducts}\n`;
      summary += `• **Non-Guaranteed Products:** ${nonGuaranteedProducts}\n`;
      summary += `• **Query Duration:** ${duration}ms\n`;

      if (availableFormats.length > 0) {
        summary += `• **Available Formats:** ${availableFormats.join(", ")}\n`;
      }

      if (priceRange) {
        summary += `• **Price Range:** $${priceRange.minCpm.toFixed(2)} - $${priceRange.maxCpm.toFixed(2)} CPM (avg: $${priceRange.avgCpm.toFixed(2)})\n`;
      }

      // Add failed queries section if any
      const failures = agentResults.filter((r) => !r.success);
      if (failures.length > 0) {
        summary += `\n## ⚠️ **Failed Queries**\n\n`;
        failures.forEach((failure) => {
          summary += `• **${failure.agentName}:** ${failure.error}\n`;
        });
      }

      summary += `\n**Next Steps:**\n`;
      summary += `• Review product details and pricing\n`;
      summary += `• Filter results by delivery type or format if needed\n`;
      summary += `• Contact specific sales agents for detailed proposals\n`;
      summary += `• Consider using create_inventory_option to set up targeting strategies\n`;

      // Log successful completion
      logger.logToolSuccess({
        metadata: {
          agentsQueried: agentResults.length,
          duration,
          failedAgents,
          productsFound: products.length,
          successfulAgents,
        },
        resultSummary: `Found ${products.length} products from ${successfulAgents}/${agentResults.length} agents (${duration}ms)`,
        startTime,
      });

      return createMCPResponse({
        data: {
          agentResponses: agentResults,
          agentsQueried: agentResults.length,
          duration,
          failedAgents,
          failures: failures.map((f) => ({
            agentName: f.agentName,
            error: f.error || "Unknown error",
            principalId: f.agentId,
          })),
          filters: {
            deliveryType: args.delivery_type,
            formats: args.formats,
            inventoryType: args.inventory_type,
            maxCpm: args.max_cpm,
            minCpm: args.min_cpm,
            publisherIds: args.publisher_ids,
          },
          products: products.map((p) => ({
            ...p,
            created_at: p.createdAt.toISOString(),
            delivery_type: p.deliveryType,
            description: p.description,
            formats: p.formats,
            // Convert back to the expected format for the response
            id: p.id,
            inventory_type: p.inventoryType,
            name: p.name,
            pricing: {
              fixed_cpm: p.basePricing.fixedCpm,
              floor_cpm: p.basePricing.floorCpm,
              model: p.basePricing.model,
              target_cpm: p.basePricing.targetCpm,
            },
            publisher_id: p.publisherId,
            publisher_name: p.publisherName,
            supported_targeting: p.supportedTargeting,
            updated_at: p.updatedAt.toISOString(),
          })),
          query: args.promoted_offering,
          successfulAgents,
          summary: {
            availableFormats,
            guaranteedProducts,
            nonGuaranteedProducts,
            priceRange,
            uniquePublishers,
          },
          totalProducts: products.length,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      logger.logToolError(error, { context: "product_discovery", startTime });
      throw new Error(
        `Failed to discover products from sales agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "media_product_list",
  parameters: z.object({
    brief: z
      .string()
      .optional()
      .describe(
        "Optional: Natural language description of campaign requirements",
      ),
    customer_id: z
      .string()
      .optional()
      .describe("Optional: Filter to sales agents for a specific customer ID"),
    delivery_type: z
      .enum(["guaranteed", "non_guaranteed"])
      .optional()
      .describe("Filter by delivery guarantee type"),
    formats: z
      .array(z.enum(["audio", "display", "html5", "native", "video"]))
      .optional()
      .describe("Specific creative formats to search for"),
    inventory_type: z
      .enum(["premium", "run_of_site", "targeted_package"])
      .optional()
      .describe("Type of inventory placement"),
    max_cpm: z.number().optional().describe("Maximum CPM price filter"),
    min_cpm: z.number().optional().describe("Minimum CPM price filter"),
    promoted_offering: z
      .string()
      .min(1)
      .describe(
        "REQUIRED: Clear description of the advertiser and what is being promoted",
      ),
    publisher_ids: z
      .array(z.string())
      .optional()
      .describe("Specific publisher IDs to search within"),
  }),
});
