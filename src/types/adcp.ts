// Ad Context Protocol (ADCP) types for get_products task
// Based on https://adcontextprotocol.org/docs/media-buy/tasks/get_products

// Error types
export interface ADCPError {
  code: string;
  details?: Record<string, unknown>;
  message: string;
}

export interface ADCPGetProductsRequest extends Record<string, unknown> {
  // OPTIONAL: Natural language description of campaign requirements
  brief?: string;

  // Optional filters
  delivery_type?: "guaranteed" | "non_guaranteed";

  format_ids?: string[];
  format_types?: string[];
  formats?: string[];
  inventory_type?: string;
  is_fixed_price?: boolean;
  // Additional filters that might be supported
  max_cpm?: number;

  min_cpm?: number;
  // REQUIRED: Clear description of the advertiser and what is being promoted
  promoted_offering: string;
  publisher_ids?: string[];
  standard_formats_only?: boolean;
  targeting_requirements?: string[];
}

export interface ADCPGetProductsResponse {
  // Human-readable message explaining product matches
  message: string;

  // Array of matching products
  products: ADCPProduct[];

  query_info?: {
    filters_applied?: string[];
    matched_criteria?: string[];
    search_duration_ms?: number;
  };

  // Information about the responding sales agent
  sales_agent: {
    customer_id?: string;
    name: string;
    principal_id: string;
  };
  // Optional metadata
  total_products?: number;
}

export interface ADCPProduct {
  brand_safety_features?: string[];
  // Timestamps
  created_at?: string;
  // Policies and constraints
  creative_policies?: string[];

  delivery_type?: "guaranteed" | "non_guaranteed";
  description?: string;
  // Product characteristics
  formats?: string[];

  // Core product identification
  id: string;

  inventory_type?: "premium" | "run_of_site" | "targeted_package";
  measurement_capabilities?: string[];

  name: string;
  // Pricing information
  pricing?: {
    cpm?: number;
    fixed_cpm?: number;
    fixed_price?: boolean; // Alternative naming
    floor_cpm?: number;
    is_fixed_price?: boolean;
    model: string; // Can be "auction", "fixed_cpm", or other values
    target_cpm?: number;
  };

  // Publisher information
  publisher_id?: string;
  publisher_name?: string;

  // Capabilities
  supported_targeting?: string[];
  updated_at?: string;
}

// Aggregated response from multiple sales agents
export interface AggregatedProductsResponse {
  // Breakdown by sales agent
  agent_responses: ADCPGetProductsResponse[];
  failed_agents: number;
  // Failed queries
  failures?: {
    agent_name: string;
    error: string;
    principal_id: string;
  }[];
  message: string;
  products: ADCPProduct[];

  successful_agents: number;

  // Summary statistics
  summary?: {
    formats_available: string[];
    guaranteed_products: number;
    non_guaranteed_products: number;
    price_range?: {
      avg_cpm?: number;
      max_cpm?: number;
      min_cpm?: number;
    };
    unique_publishers: number;
  };

  total_agents_queried: number;

  total_products: number;
}

// Sales agent metadata from BigQuery
export interface SalesAgentInfo {
  agent_uri: string;
  auth_token: string;
  customer_id: string;
  name: string;
  principal_id: string;
  protocol: string;
}
