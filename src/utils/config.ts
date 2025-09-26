import type { ServerConfig } from "../types/auth.js";

export const config: ServerConfig = {
  endpoint: "/mcp",
  port: parseInt(process.env.MCP_PORT || "3001"),
  scope3GraphQLUrl:
    process.env.SCOPE3_GRAPHQL_URL || "https://api.scope3.com/api/graphql",
};

/**
 * PostHog analytics configuration
 */
export const PostHogConfig = {
  apiKey:
    process.env.POSTHOG_API_KEY ||
    "phc_LOrnbPcOPcPQvlhjwzk0TMdx8HaUbUvh2U2GkQBQmTv",
  enabled: process.env.POSTHOG_API_KEY !== undefined,
  host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
} as const;

/**
 * BigQuery service configuration constants
 * NOTE: All BigQuery operations require explicit customer ID resolution - no defaults for security
 */
export const BigQueryConfig = {
  // Removed DEFAULT_CUSTOMER_ID - all operations must explicitly resolve customer ID
} as const;
