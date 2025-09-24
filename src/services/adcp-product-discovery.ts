// ADCP Multi-Agent Product Discovery Service
// Integrates with @adcp/client library for parallel product discovery across multiple agents

import type { AgentConfig, GetProductsRequest } from "@adcp/client";

import { ADCPMultiAgentClient } from "@adcp/client";

import type {
  ProductDiscoveryQuery,
  PublisherMediaProduct,
} from "../types/tactics.js";

import { SalesAgentService } from "./sales-agent-service.js";

export interface ADCPProductDiscoveryConfig {
  agents: AgentConfig[];
  debug?: boolean;
  timeout?: number;
}

export class ADCPProductDiscoveryService {
  private client: ADCPMultiAgentClient;
  private salesAgentService: SalesAgentService;

  constructor(config: ADCPProductDiscoveryConfig) {
    this.client = new ADCPMultiAgentClient(config.agents, {
      debug: config.debug || false,
      workingTimeout: config.timeout || 30000,
    });
    this.salesAgentService = new SalesAgentService();
  }

  /**
   * Create service from database configuration for a specific customer
   */
  static async fromDatabase(
    customerId: number,
    config?: {
      debug?: boolean;
      timeout?: number;
    },
  ): Promise<ADCPProductDiscoveryService> {
    const salesAgentService = new SalesAgentService();
    const agents =
      await salesAgentService.getAgentConfigsForDiscovery(customerId);

    return new ADCPProductDiscoveryService({
      agents,
      debug: config?.debug,
      timeout: config?.timeout,
    });
  }

  /**
   * Create service from environment configuration (fallback for testing)
   */
  static fromEnv(config?: {
    debug?: boolean;
    timeout?: number;
  }): ADCPProductDiscoveryService {
    const client = ADCPMultiAgentClient.fromEnv({
      debug: config?.debug || false,
      workingTimeout: config?.timeout || 30000,
    });

    return new ADCPProductDiscoveryService({
      agents: client.getAgentConfigs(),
      debug: config?.debug,
      timeout: config?.timeout,
    });
  }

  /**
   * Discover products using multi-agent ADCP get-products call
   */
  async discoverProducts(
    query: ProductDiscoveryQuery,
    options?: {
      minSuccessfulAgents?: number;
      requireAllAgents?: boolean;
    },
  ): Promise<{
    agentResults: Array<{
      agentId: string;
      agentName: string;
      error?: string;
      productCount: number;
      success: boolean;
    }>;
    products: PublisherMediaProduct[];
  }> {
    // Convert our ProductDiscoveryQuery to ADCP GetProductsRequest format
    const adcpRequest: GetProductsRequest = {
      adcp_version: "1.6.0",
      brief: query.campaignBrief,
      filters: {
        delivery_type: query.deliveryType,
        format_types: this.mapFormatsToADCP(query.formats),
        is_fixed_price: this.shouldFilterFixedPrice(query),
      },
      promoted_offering: query.campaignBrief || "Campaign products", // Required field
    };

    // Execute get-products across all agents in parallel
    const results = await this.client.allAgents().getProducts(
      adcpRequest,
      undefined, // inputHandler - not needed for this simple case
      {
        timeout: 30000,
      },
    );

    // Process results
    const agentResults = results.map((result) => ({
      agentId: result.metadata.agent.id,
      agentName: result.metadata.agent.name,
      error: result.success ? undefined : result.error,
      productCount: result.success ? result.data?.products?.length || 0 : 0,
      success: result.success,
    }));

    // Check if we meet minimum success criteria
    const successfulResults = results.filter((r) => r.success);
    const minRequired = options?.minSuccessfulAgents || 1;

    if (
      options?.requireAllAgents &&
      successfulResults.length !== results.length
    ) {
      throw new Error(
        `Not all agents succeeded: ${successfulResults.length}/${results.length} agents returned results`,
      );
    }

    if (successfulResults.length < minRequired) {
      throw new Error(
        `Insufficient successful agents: ${successfulResults.length}/${minRequired} required`,
      );
    }

    // Aggregate and deduplicate products from successful agents
    const allProducts = successfulResults.flatMap((result) =>
      this.convertADCPProductsToInternal(result.data?.products || []),
    );

    const deduplicatedProducts = this.deduplicateProducts(allProducts);

    return {
      agentResults,
      products: deduplicatedProducts,
    };
  }

  /**
   * Get products from specific agents
   */
  async discoverProductsFromAgents(
    agentIds: string[],
    query: ProductDiscoveryQuery,
  ): Promise<{
    agentResults: Array<{
      agentId: string;
      agentName: string;
      error?: string;
      productCount: number;
      success: boolean;
    }>;
    products: PublisherMediaProduct[];
  }> {
    const adcpRequest: GetProductsRequest = {
      adcp_version: "1.6.0",
      brief: query.campaignBrief,
      filters: {
        delivery_type: query.deliveryType,
        format_types: this.mapFormatsToADCP(query.formats),
        is_fixed_price: this.shouldFilterFixedPrice(query),
      },
      promoted_offering: query.campaignBrief || "Campaign products",
    };

    // Execute get-products on specific agents
    const results = await this.client.agents(agentIds).getProducts(adcpRequest);

    const agentResults = results.map((result) => ({
      agentId: result.metadata.agent.id,
      agentName: result.metadata.agent.name,
      error: result.success ? undefined : result.error,
      productCount: result.success ? result.data?.products?.length || 0 : 0,
      success: result.success,
    }));

    const successfulResults = results.filter((r) => r.success);
    const allProducts = successfulResults.flatMap((result) =>
      this.convertADCPProductsToInternal(result.data?.products || []),
    );

    return {
      agentResults,
      products: this.deduplicateProducts(allProducts),
    };
  }

  /**
   * Get list of available agents
   */
  getAvailableAgents(): Array<{ id: string; name: string; protocol: string }> {
    return this.client.getAgentConfigs().map((config) => ({
      id: config.id,
      name: config.name,
      protocol: config.protocol || "mcp",
    }));
  }

  /**
   * Convert ADCP products to our internal format
   */
  private convertADCPProductsToInternal(
    adcpProducts: Record<string, unknown>[],
  ): PublisherMediaProduct[] {
    return adcpProducts.map((product) => {
      const pricing = product.pricing as Record<string, unknown> | undefined;
      return {
        basePricing: {
          fixedCpm: pricing?.fixed_cpm as number | undefined,
          floorCpm: pricing?.floor_cpm as number | undefined,
          model: (pricing?.model as "auction" | "fixed_cpm") || "auction",
          targetCpm: pricing?.target_cpm as number | undefined,
        },
        createdAt: new Date(
          (product.created_at as string) || new Date().toISOString(),
        ),
        deliveryType:
          (product.delivery_type as "guaranteed" | "non_guaranteed") ||
          "non_guaranteed",
        description:
          (product.description as string) || "No description available",
        formats: (product.formats as (
          | "audio"
          | "display"
          | "html5"
          | "native"
          | "video"
        )[]) || ["display"], // Default to display if not specified
        id: (product.id as string) || `adcp-${Date.now()}-${Math.random()}`,
        inventoryType:
          (product.inventory_type as
            | "premium"
            | "run_of_site"
            | "targeted_package") || "run_of_site",
        name: (product.name as string) || "Unnamed Product",
        productId:
          (product.product_id as string) || (product.id as string) || "unknown",
        publisherId: (product.publisher_id as string) || "unknown",
        publisherName:
          (product.publisher_name as string) || "Unknown Publisher",
        supportedTargeting: (product.supported_targeting as string[]) || [],
        updatedAt: new Date(
          (product.updated_at as string) || new Date().toISOString(),
        ),
      };
    });
  }

  /**
   * Remove duplicate products based on product ID and publisher ID
   */
  private deduplicateProducts(
    products: PublisherMediaProduct[],
  ): PublisherMediaProduct[] {
    const seen = new Set<string>();
    const deduplicated: PublisherMediaProduct[] = [];

    for (const product of products) {
      const key = `${product.publisherId}-${product.productId}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(product);
      }
    }

    return deduplicated;
  }

  /**
   * Map our internal format types to ADCP format types
   */
  private mapFormatsToADCP(
    formats?: string[],
  ): ("audio" | "display" | "video")[] | undefined {
    if (!formats) return undefined;

    const adcpFormats: ("audio" | "display" | "video")[] = [];

    for (const format of formats) {
      switch (format.toLowerCase()) {
        case "audio":
          adcpFormats.push("audio");
          break;
        case "display":
        case "html5":
        case "native":
          adcpFormats.push("display");
          break;
        case "video":
          adcpFormats.push("video");
          break;
      }
    }

    return adcpFormats.length > 0 ? adcpFormats : undefined;
  }

  /**
   * Determine if we should filter for fixed price based on query
   */
  private shouldFilterFixedPrice(
    query: ProductDiscoveryQuery,
  ): boolean | undefined {
    // If both min and max CPM are specified, prefer fixed price
    if (query.minCpm !== undefined && query.maxCpm !== undefined) {
      return true;
    }

    return undefined; // Don't filter
  }
}
