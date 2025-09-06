import { FastMCP } from "fastmcp";

import { Scope3ApiClient } from "./client/scope3-client.js";
import { registerTools } from "./tools/index.js";
import { config } from "./utils/config.js";

// Initialize client and server
const scope3Client = new Scope3ApiClient(config.scope3GraphQLUrl);
const server = new FastMCP({
  health: {
    enabled: true,
    message: "ok",
    path: "/health",
    status: 200,
  },
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
      host: "0.0.0.0", // Bind to all network interfaces for Cloud Run accessibility
      port,
    },
    transportType: "httpStream",
  });

  console.log(
    `MCP Server started on port ${port} (accessible on all interfaces)`,
  );
  console.log(`Endpoint: http://0.0.0.0:${port}${config.endpoint}`);
  console.log(`Health check: http://0.0.0.0:${port}/health`);
}
