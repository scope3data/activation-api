import type { ServerConfig } from "../types/auth.js";

export const config: ServerConfig = {
  endpoint: "/mcp",
  port: parseInt(process.env.MCP_PORT || "3001"),
  scope3GraphQLUrl:
    process.env.SCOPE3_GRAPHQL_URL || "https://api.scope3.com/api/graphql",
};

/**
 * BigQuery service configuration constants
 */
export const BigQueryConfig = {
  /** Default customer ID when authentication cannot determine the customer */
  DEFAULT_CUSTOMER_ID: 1,
} as const;
