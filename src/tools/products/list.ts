import { z } from "zod";

import type {
  ADCPGetProductsRequest,
  AggregatedProductsResponse,
} from "../../types/adcp.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { BigQueryService } from "../../services/bigquery-service.js";
import { MCPClientService } from "../../services/mcp-client-service.js";
import { createMCPResponse } from "../../utils/error-handling.js";

// Initialize services (these could be injected via dependency injection in a more sophisticated setup)
const bigQueryService = new BigQueryService();
const mcpClientService = new MCPClientService();

export const getProductsTool = () => ({
  annotations: {
    category: "Tactics",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Discover Products",
  },

  description:
    "Discover available advertising products from multiple sales agents based on campaign requirements. This tool queries BigQuery for active sales agents and then calls their get_products endpoints to aggregate results. Follows the Ad Context Protocol (ADCP) specification.",

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
    _context: MCPToolExecuteContext,
  ): Promise<string> => {
    const startTime = Date.now();

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

      // Get sales agents from BigQuery
      let salesAgents;
      try {
        if (args.customer_id) {
          salesAgents = await bigQueryService.getSalesAgentsByCustomer(
            args.customer_id,
          );
        } else {
          salesAgents = await bigQueryService.getMCPSalesAgents();
        }
      } catch (error) {
        throw new Error(
          `Failed to query sales agents from BigQuery: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (salesAgents.length === 0) {
        const message = args.customer_id
          ? `🔍 **No Sales Agents Found for Customer ${args.customer_id}**\n\nNo MCP-enabled sales agents found for the specified customer.`
          : `🔍 **No Sales Agents Found**\n\nNo MCP-enabled sales agents are currently available.`;

        return createMCPResponse({
          message,
          success: true,
          data: {
            products: [],
            totalProducts: 0,
            agentsQueried: 0,
            successfulAgents: 0,
            failedAgents: 0,
            customerId: args.customer_id,
            query: args.promoted_offering,
          },
        });
      }

      // Call get_products on all sales agents concurrently
      console.log(
        `Querying ${salesAgents.length} sales agents for products...`,
      );
      const { failed, successful } =
        await mcpClientService.callGetProductsMultiple(
          salesAgents,
          adcpRequest,
        );

      // Aggregate products from all successful responses
      const allProducts = successful.flatMap((response) =>
        response.products.map((product) => ({
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

      // Group products by sales agent for display
      if (successful.length > 0) {
        summary += `## 🏪 **Products by Sales Agent**\n\n`;

        successful.forEach((agentResponse) => {
          summary += `### 🤖 **${agentResponse.sales_agent.name}**\n`;
          summary += `${agentResponse.products.length} products found\n\n`;

          if (agentResponse.products.length > 0) {
            agentResponse.products.slice(0, 5).forEach((product, index) => {
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
        message: summary,
        success: true,
        data: {
          products: allProducts,
          totalProducts: allProducts.length,
          agentsQueried: salesAgents.length,
          successfulAgents: successful.length,
          failedAgents: failed.length,
          query: args.promoted_offering,
          brief: args.brief,
          duration,
          summary: {
            guaranteedProducts,
            nonGuaranteedProducts,
            uniquePublishers,
            availableFormats,
            priceRange,
          },
          filters: {
            delivery_type: args.delivery_type,
            format_ids: args.format_ids,
            format_types: args.format_types,
            formats: args.formats,
            is_fixed_price: args.is_fixed_price,
            max_cpm: args.max_cpm,
            min_cpm: args.min_cpm,
            publisher_ids: args.publisher_ids,
            standard_formats_only: args.standard_formats_only,
            customer_id: args.customer_id,
          },
          agentResponses: successful,
          failures: failed.map((f) => ({
            agentName: f.agent.name,
            principalId: f.agent.principal_id,
            error: f.error,
          })),
        },
      });
    } catch (error) {
      throw new Error(
        `Failed to discover products from sales agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      // Clean up MCP connections (optional, could be done on process exit)
      // await mcpClientService.closeAll();
    }
  },

  name: "product/list",
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
