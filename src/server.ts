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

// Start the server in HTTP mode (skip in test environment)
if (process.env.NODE_ENV !== "test") {
  const port = parseInt(process.env.PORT || String(config.port));
  
  server.start({
    httpStream: {
      endpoint: config.endpoint as `/${string}`,
      port,
    },
    transportType: "httpStream",
  });
  
  console.log(`MCP Server started on port ${port}`);
  console.log(`Endpoint: http://localhost:${port}${config.endpoint}`);
}
