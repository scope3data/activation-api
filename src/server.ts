import { FastMCP } from "fastmcp";

import { Scope3ApiClient } from "./client/scope3-client.js";
import { registerTools } from "./tools/index.js";
import { config } from "./utils/config.js";

// Initialize client and server
const scope3Client = new Scope3ApiClient(config.scope3GraphQLUrl);
const server = new FastMCP({
  name: "Scope3 Campaign API Server",
  version: "1.0.0",
});

// Register all tools
registerTools(server, scope3Client);

// Start the server with configurable options (skip in test environment)
if (process.env.NODE_ENV !== "test") {
  // Check if we should use stdio (for Claude Desktop) or HTTP (for testing)
  if (process.env.MCP_TRANSPORT === "http") {
    server.start({
      httpStream: {
        endpoint: config.endpoint as `/${string}`,
        port: config.port,
      },
      transportType: "httpStream",
    });
    // Only log in HTTP mode since stdio mode can't handle console output
    console.log(`MCP Server started in HTTP mode on port ${config.port}`);
  } else {
    // Default to stdio for Claude Desktop - no console.log allowed
    server.start({
      transportType: "stdio",
    });
  }
}
