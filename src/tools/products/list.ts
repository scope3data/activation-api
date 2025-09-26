import { z } from "zod";

import type { SalesAgent } from "../../services/bigquery-service.js";
import type {
  ADCPGetProductsRequest,
  ADCPGetProductsResponse,
  ADCPProduct,
  AggregatedProductsResponse,
} from "../../types/adcp.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { BigQueryService } from "../../services/bigquery-service.js";
import { MCPClientService } from "../../services/mcp-client-service.js";
import { createMCPResponse } from "../../utils/error-handling.js";
import { createLogger } from "../../utils/logging.js";

// Initialize services (these could be injected via dependency injection in a more sophisticated setup)
const bigQueryService = new BigQueryService();
const mcpClientService = new MCPClientService();

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
      brief?: string;
      customer_id?: string; // Optional: filter by specific customer
      delivery_type?: "guaranteed" | "non_guaranteed";
      format_ids?: string[];
      format_types?: string[];
      formats?: string[];
      is_fixed_price?: boolean;
      max_cpm?: number;
      min_cpm?: number;
      promoted_offering: string;
      publisher_ids?: string[];
      standard_formats_only?: boolean;
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

      // Build ADCP request
      const adcpRequest: ADCPGetProductsRequest = {
        brief: args.brief,
        delivery_type: args.delivery_type,
        format_ids: args.format_ids,
        format_types: args.format_types,
        formats: args.formats,
        is_fixed_price: args.is_fixed_price,
        max_cpm: args.max_cpm,
        min_cpm: args.min_cpm,
        promoted_offering: args.promoted_offering,
        publisher_ids: args.publisher_ids,
        standard_formats_only: args.standard_formats_only,
      };

      // Remove undefined values
      Object.keys(adcpRequest).forEach((key) => {
        if (adcpRequest[key] === undefined) {
          delete adcpRequest[key];
        }
      });

      // Phase 1: Fetch sales agents
      context.log?.info("🔍 Discovering available sales agents...");
      logger.logInfo("Fetching sales agents", {
        customer_id: args.customer_id,
      });
      let salesAgents;
      try {
        if (args.customer_id) {
          salesAgents = await bigQueryService.getSalesAgentsByCustomer(
            args.customer_id,
          );
        } else {
          salesAgents = await bigQueryService.getMCPSalesAgents();
        }
        context.log?.info(
          `✅ Found ${salesAgents.length} available sales agents`,
        );
        logger.logInfo("Sales agents fetched", { count: salesAgents.length });
      } catch (error) {
        context.log?.error("❌ Failed to fetch sales agents");
        logger.logToolError(error, {
          context: "fetching_sales_agents",
          startTime,
        });
        throw new Error(
          `Failed to query sales agents from BigQuery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (salesAgents.length === 0) {
        const message = args.customer_id
          ? `🔍 **No Sales Agents Found for Customer ${args.customer_id}**\n\nNo MCP-enabled sales agents found for the specified customer.`
          : `🔍 **No Sales Agents Found**\n\nNo MCP-enabled sales agents are currently available.`;

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

      // Phase 2: Query sales agents for products
      context.log?.info(
        `🚀 Querying ${salesAgents.length} sales agents for "${args.promoted_offering}"`,
      );
      logger.logInfo("Querying sales agents for products", {
        agent_count: salesAgents.length,
        promoted_offering: args.promoted_offering,
      });

      // Report initial progress
      await context.reportProgress?.({
        progress: 0,
        total: salesAgents.length,
      });

      // Create individual promises to track progress
      let completedCount = 0;
      const progressUpdates: string[] = [];

      const trackProgress = async (
        agent: SalesAgent,
        promise: Promise<ADCPGetProductsResponse>,
      ) => {
        try {
          const result = await promise;
          completedCount++;
          const progressMessage = `✅ ${agent.name} responded with ${result.products?.length || 0} products`;
          progressUpdates.push(progressMessage);

          // Log successful agent response
          context.log?.info(
            `📦 ${agent.name}: Found ${result.products?.length || 0} products`,
          );

          await context.reportProgress?.({
            progress: completedCount,
            total: salesAgents.length,
          });
          return { agent, response: result, success: true };
        } catch (error) {
          completedCount++;
          const errorMessage = `❌ ${agent.name} failed: ${error instanceof Error ? error.message : String(error)}`;
          progressUpdates.push(errorMessage);

          // Log failed agent response
          context.log?.warn(
            `⚠️ ${agent.name}: ${error instanceof Error ? error.message : String(error)}`,
          );

          await context.reportProgress?.({
            progress: completedCount,
            total: salesAgents.length,
          });
          return {
            agent,
            error: error instanceof Error ? error.message : String(error),
            success: false,
          };
        }
      };

      const agentPromises = salesAgents.map(async (agent) => {
        const promise = mcpClientService.callGetProducts(agent, adcpRequest);
        return trackProgress(agent, promise);
      });

      const results = await Promise.allSettled(agentPromises);

      // Process results
      const successful: ADCPGetProductsResponse[] = [];
      const failed: { agent: SalesAgent; error: string }[] = [];

      results.forEach((result) => {
        if (result.status === "fulfilled") {
          if (result.value.success && result.value.response) {
            successful.push(result.value.response);
          } else {
            failed.push({
              agent: result.value.agent,
              error: result.value.error || "Unknown error",
            });
          }
        } else {
          // This shouldn't happen since we're catching errors in trackProgress
          failed.push({
            agent: {
              agent_uri: "",
              auth_token: "",
              customer_id: "",
              name: "Unknown",
              principal_id: "",
              protocol: "",
            },
            error: result.reason?.message || "Promise rejected",
          });
        }
      });

      // Phase 3: Process and aggregate results
      context.log?.info(
        `🔄 Processing results from ${successful.length} successful agents...`,
      );

      // Log detailed results
      logger.logSalesAgentResults({ failed, successful });

      // Aggregate products from all successful responses
      const allProducts = successful.flatMap((response) =>
        response.products.map((product: ADCPProduct) => ({
          ...product,
          // Add source information to each product
          source_agent: response.sales_agent.name,
          source_agent_id: response.sales_agent.principal_id,
        })),
      );

      // Calculate summary statistics
      const guaranteedProducts = allProducts.filter(
        (p) => p.delivery_type === "guaranteed",
      ).length;
      const nonGuaranteedProducts = allProducts.filter(
        (p) => p.delivery_type === "non_guaranteed",
      ).length;
      const uniquePublishers = new Set(
        allProducts
          .filter((p) => p.publisher_name)
          .map((p) => p.publisher_name),
      ).size;
      const availableFormats = Array.from(
        new Set(allProducts.flatMap((p) => p.formats || [])),
      );

      // Calculate price statistics
      const cpmPrices = allProducts
        .map(
          (p) =>
            p.pricing?.cpm ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (p.pricing as any)?.fixed_cpm ||
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (p.pricing as any)?.target_cpm,
        )
        .filter(Boolean) as number[];

      const priceRange =
        cpmPrices.length > 0
          ? {
              avg_cpm: cpmPrices.reduce((a, b) => a + b, 0) / cpmPrices.length,
              max_cpm: Math.max(...cpmPrices),
              min_cpm: Math.min(...cpmPrices),
            }
          : undefined;

      const duration = Date.now() - startTime;

      // Phase 4: Generate final summary
      context.log?.info(
        `📊 Generating summary for ${allProducts.length} total products...`,
      );

      // Build response
      const _response: AggregatedProductsResponse = {
        agent_responses: successful,
        failed_agents: failed.length,
        failures: failed.map((f) => ({
          agent_name: f.agent.name,
          error: f.error,
          principal_id: f.agent.principal_id,
        })),
        message: `Found ${allProducts.length} products from ${successful.length} sales agents`,
        products: allProducts,
        successful_agents: successful.length,
        summary: {
          formats_available: availableFormats,
          guaranteed_products: guaranteedProducts,
          non_guaranteed_products: nonGuaranteedProducts,
          price_range: priceRange,
          unique_publishers: uniquePublishers,
        },
        total_agents_queried: salesAgents.length,
        total_products: allProducts.length,
      };

      // Format human-readable response
      let summary = `🛒 **Product Discovery Results**\n\n`;
      summary += `**Query:** "${args.promoted_offering}"${args.brief ? ` - ${args.brief}` : ""}\n\n`;

      // Show progress updates if we have them
      if (progressUpdates.length > 0) {
        summary += `## 🚀 **Discovery Progress**\n`;
        progressUpdates.forEach((update) => {
          summary += `${update}\n`;
        });
        summary += `\n`;
      }

      summary += `## 📊 **Summary**\n`;
      summary += `• **Total Products:** ${allProducts.length}\n`;
      summary += `• **Sales Agents Queried:** ${salesAgents.length}\n`;
      summary += `• **Successful Responses:** ${successful.length}\n`;
      if (failed.length > 0) {
        summary += `• **Failed Responses:** ${failed.length}\n`;
      }
      summary += `• **Unique Publishers:** ${uniquePublishers}\n`;
      summary += `• **Guaranteed Products:** ${guaranteedProducts}\n`;
      summary += `• **Non-Guaranteed Products:** ${nonGuaranteedProducts}\n`;

      if (priceRange) {
        summary += `• **Price Range:** $${priceRange.min_cpm.toFixed(2)} - $${priceRange.max_cpm.toFixed(2)} CPM\n`;
        summary += `• **Average CPM:** $${priceRange.avg_cpm.toFixed(2)}\n`;
      }

      if (availableFormats.length > 0) {
        summary += `• **Available Formats:** ${availableFormats.join(", ")}\n`;
      }

      summary += `• **Query Duration:** ${duration}ms\n\n`;

      // Phase 5: Discovery completed
      context.log?.info(
        `🎉 Product discovery completed! Found ${allProducts.length} products from ${successful.length}/${salesAgents.length} agents (${duration}ms)`,
      );

      // Log successful completion
      logger.logToolSuccess({
        metadata: {
          failed_agents: failed.length,
          successful_agents: successful.length,
          total_products: allProducts.length,
          unique_publishers: uniquePublishers,
        },
        resultSummary: `Found ${allProducts.length} products from ${successful.length}/${salesAgents.length} agents`,
        startTime,
      });

      // Group products by sales agent for display
      if (successful.length > 0) {
        summary += `## 🏪 **Products by Sales Agent**\n\n`;

        successful.forEach((agentResponse) => {
          summary += `### 🤖 **${agentResponse.sales_agent.name}**\n`;
          summary += `${agentResponse.products.length} products found\n\n`;

          if (agentResponse.products.length > 0) {
            agentResponse.products
              .slice(0, 5)
              .forEach((product: ADCPProduct, index: number) => {
                summary += `${index + 1}. **${product.name}**`;
                if (product.publisher_name)
                  summary += ` (${product.publisher_name})`;
                summary += `\n`;

                if (product.description) {
                  summary += `   ${product.description}\n`;
                }

                if (
                  product.pricing &&
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  (product.pricing.cpm || (product.pricing as any)?.fixed_cpm)
                ) {
                  const cpm =
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    product.pricing.cpm || (product.pricing as any)?.fixed_cpm;
                  summary += `   💰 $${cpm?.toFixed(2)} CPM\n`;
                }

                if (product.formats?.length) {
                  summary += `   📺 ${product.formats.join(", ")}\n`;
                }

                summary += `\n`;
              });

            if (agentResponse.products.length > 5) {
              summary += `   ... and ${agentResponse.products.length - 5} more products\n\n`;
            }
          }

          summary += `---\n\n`;
        });
      }

      // Show any failures
      if (failed.length > 0) {
        summary += `## ⚠️ **Failed Queries**\n\n`;
        failed.forEach((failure) => {
          summary += `• **${failure.agent.name}:** ${failure.error}\n`;
        });
        summary += `\n`;
      }

      summary += `**Next Steps:**\n`;
      summary += `• Review product details and pricing\n`;
      summary += `• Filter results by delivery type or format if needed\n`;
      summary += `• Contact specific sales agents for detailed proposals\n`;
      summary += `• Consider using create_inventory_option to set up targeting strategies`;

      return createMCPResponse({
        data: {
          agentResponses: successful,
          agentsQueried: salesAgents.length,
          brief: args.brief,
          duration,
          failedAgents: failed.length,
          failures: failed.map((f) => ({
            agentName: f.agent.name,
            error: f.error,
            principalId: f.agent.principal_id,
          })),
          filters: {
            customer_id: args.customer_id,
            delivery_type: args.delivery_type,
            format_ids: args.format_ids,
            format_types: args.format_types,
            formats: args.formats,
            is_fixed_price: args.is_fixed_price,
            max_cpm: args.max_cpm,
            min_cpm: args.min_cpm,
            publisher_ids: args.publisher_ids,
            standard_formats_only: args.standard_formats_only,
          },
          products: allProducts,
          query: args.promoted_offering,
          successfulAgents: successful.length,
          summary: {
            availableFormats,
            guaranteedProducts,
            nonGuaranteedProducts,
            priceRange,
            uniquePublishers,
          },
          totalProducts: allProducts.length,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      logger.logToolError(error, { context: "product_discovery", startTime });
      throw new Error(
        `Failed to discover products from sales agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      // Clean up MCP connections (optional, could be done on process exit)
      // await mcpClientService.closeAll();
    }
  },

  name: "media_product_list",
  parameters: z.object({
    brief: z
      .string()
      .optional()
      .describe("Natural language description of campaign requirements"),
    customer_id: z
      .string()
      .optional()
      .describe("Filter to sales agents for a specific customer ID"),
    delivery_type: z
      .enum(["guaranteed", "non_guaranteed"])
      .optional()
      .describe("Filter by delivery guarantee type"),
    format_ids: z
      .array(z.string())
      .optional()
      .describe("Specific format IDs to filter by"),
    format_types: z
      .array(z.string())
      .optional()
      .describe("Format categories to include"),
    formats: z
      .array(z.string())
      .optional()
      .describe("Specific format types (e.g., ['video', 'display'])"),
    is_fixed_price: z
      .boolean()
      .optional()
      .describe("Filter for fixed pricing vs auction"),
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
    standard_formats_only: z
      .boolean()
      .optional()
      .describe("Restrict to standard format types only"),
  }),
});
