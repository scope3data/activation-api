import type { ServerConfig } from "../types/auth.js";

export const config: ServerConfig = {
  endpoint: "/mcp",
  port: parseInt(process.env.MCP_PORT || "3001"),
  scope3GraphQLUrl:
    process.env.SCOPE3_GRAPHQL_URL || "https://api.scope3.com/graphql",
};
