// Product Discovery Service - handles querying and aggregating publisher inventory

import type {
  ProductDiscoveryQuery,
  PublisherMediaProduct,
  PublisherMediaProductsData,
} from "../../types/inventory-options.js";

export interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

export class ProductDiscoveryService {
  private graphqlUrl: string;

  constructor(graphqlUrl: string) {
    this.graphqlUrl = graphqlUrl;
  }

  // Aggregate products by signal type compatibility
  async aggregateBySignal(products: PublisherMediaProduct[]): Promise<{
    buyerSignal: PublisherMediaProduct[];
    noSignal: PublisherMediaProduct[];
    scope3Signal: PublisherMediaProduct[];
    thirdParty: PublisherMediaProduct[];
  }> {
    const aggregated = {
      buyerSignal: [] as PublisherMediaProduct[],
      noSignal: [] as PublisherMediaProduct[],
      scope3Signal: [] as PublisherMediaProduct[],
      thirdParty: [] as PublisherMediaProduct[],
    };

    for (const product of products) {
      // All products support no-signal (contextual targeting)
      aggregated.noSignal.push(product);

      // Check supported targeting to determine signal compatibility
      const supportedTargeting = product.supportedTargeting || [];

      if (supportedTargeting.includes("buyer_signals")) {
        aggregated.buyerSignal.push(product);
      }

      if (supportedTargeting.includes("scope3_signals")) {
        aggregated.scope3Signal.push(product);
      }

      if (
        supportedTargeting.some((targeting) =>
          targeting.includes("third_party"),
        )
      ) {
        aggregated.thirdParty.push(product);
      }
    }

    return aggregated;
  }

  // Natural language product discovery
  async discoverByDescription(
    apiKey: string,
    campaignBrief: string,
    maxResults: number = 20,
  ): Promise<PublisherMediaProduct[]> {
    const query: ProductDiscoveryQuery = {
      campaignBrief,
    };

    const products = await this.discoverProducts(apiKey, query);

    // Return top results based on relevance (API should handle ranking)
    return products.slice(0, maxResults);
  }

  // Query available products from publishers
  async discoverProducts(
    apiKey: string,
    params: ProductDiscoveryQuery,
  ): Promise<PublisherMediaProduct[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: DISCOVER_PRODUCTS_QUERY,
        variables: { input: params },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      discoverProducts: PublisherMediaProductsData;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.discoverProducts) {
      throw new Error("No data received");
    }

    return result.data.discoverProducts.publisherMediaProducts;
  }

  // Get products filtered by specific criteria
  async getProductsByDeliveryType(
    apiKey: string,
    deliveryType: "guaranteed" | "non_guaranteed",
    maxCpm?: number,
  ): Promise<PublisherMediaProduct[]> {
    const query: ProductDiscoveryQuery = {
      deliveryType,
      maxCpm,
    };

    const products = await this.discoverProducts(apiKey, query);
    return products;
  }

  // Get products from specific publishers
  async getProductsByPublishers(
    apiKey: string,
    publisherIds: string[],
  ): Promise<PublisherMediaProduct[]> {
    const query: ProductDiscoveryQuery = {
      publisherIds,
    };

    const products = await this.discoverProducts(apiKey, query);
    return products;
  }

  // Get product recommendations based on campaign characteristics
  async getRecommendedProducts(
    apiKey: string,
    params: {
      budget: number;
      campaignBrief: string;
      preferredFormats?: string[];
      targetSignals?: ("buyer" | "scope3" | "third_party")[];
    },
  ): Promise<{
    guaranteed: PublisherMediaProduct[];
    nonGuaranteed: PublisherMediaProduct[];
    recommendations: {
      product: PublisherMediaProduct;
      reason: string;
      signalTypes: string[];
    }[];
  }> {
    // Discover products based on campaign brief
    const products = await this.discoverByDescription(
      apiKey,
      params.campaignBrief,
    );

    // Separate by delivery type
    const guaranteed = products.filter((p) => p.deliveryType === "guaranteed");
    const nonGuaranteed = products.filter(
      (p) => p.deliveryType === "non_guaranteed",
    );

    // Generate recommendations with reasoning
    const recommendations = products
      .slice(0, 10) // Top 10 products
      .map((product) => {
        const supportedSignals: string[] = [];
        const reasons: string[] = [];

        // Check signal compatibility
        if (product.supportedTargeting?.includes("buyer_signals")) {
          supportedSignals.push("buyer");
          reasons.push("supports first-party data");
        }
        if (product.supportedTargeting?.includes("scope3_signals")) {
          supportedSignals.push("scope3");
          reasons.push("eco-conscious targeting available");
        }
        if (
          product.supportedTargeting?.some((t) => t.includes("third_party"))
        ) {
          supportedSignals.push("third_party");
          reasons.push("third-party data integration");
        }

        // Add pricing-based reasons
        if (
          product.basePricing.model === "fixed_cpm" &&
          product.basePricing.fixedCpm &&
          product.basePricing.fixedCpm < 30
        ) {
          reasons.push("cost-effective CPM");
        }

        if (product.inventoryType === "premium") {
          reasons.push("premium inventory placement");
        }

        return {
          product,
          reason: reasons.join(", ") || "contextual targeting available",
          signalTypes: supportedSignals,
        };
      });

    return {
      guaranteed,
      nonGuaranteed,
      recommendations,
    };
  }
}

// GraphQL query for discovering products
// This is a placeholder - in real implementation, this would call actual AdCP endpoints
const DISCOVER_PRODUCTS_QUERY = `
  query DiscoverProducts($input: ProductDiscoveryInput!) {
    discoverProducts(input: $input) {
      publisherMediaProducts {
        id
        publisherId
        publisherName
        productId
        name
        description
        formats
        deliveryType
        inventoryType
        basePricing {
          model
          fixedCpm
          floorCpm
          targetCpm
        }
        supportedTargeting
        createdAt
        updatedAt
      }
    }
  }
`;
