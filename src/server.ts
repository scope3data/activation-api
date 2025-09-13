import { FastMCP } from "fastmcp";
import http from "http";

import type { FastMCPSessionAuth } from "./types/mcp.js";

import { Scope3ApiClient } from "./client/scope3-client.js";
import { registerTools } from "./tools/index.js";
import { config } from "./utils/config.js";

// Initialize client and server
const scope3Client = new Scope3ApiClient(config.scope3GraphQLUrl);
const server = new FastMCP<FastMCPSessionAuth>({
  authenticate: async (request: http.IncomingMessage) => {
    const canLog =
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

    try {
      if (canLog) {
        console.log("[Auth] Authenticating HTTP request");
      }

      let apiKey: string | undefined;

      // Check x-scope3-api-key header
      if (request.headers["x-scope3-api-key"]) {
        apiKey = request.headers["x-scope3-api-key"] as string;
        if (canLog) {
          console.log("[Auth] Using x-scope3-api-key header");
        }
      }
      // Check Authorization: Bearer header
      else if (request.headers.authorization) {
        const authHeader = request.headers.authorization as string;
        if (authHeader.startsWith("Bearer ")) {
          apiKey = authHeader.substring(7);
          if (canLog) {
            console.log("[Auth] Using Authorization Bearer header");
          }
        }
      }

      if (!apiKey) {
        if (canLog) {
          console.log("[Auth] No valid authentication header found");
        }
        throw new Response(
          JSON.stringify({
            error: "Authentication required",
            message:
              "Provide API key via x-scope3-api-key or Authorization: Bearer header",
          }),
          { headers: { "Content-Type": "application/json" }, status: 401 },
        );
      }

      if (canLog) {
        console.log(
          `[Auth] Authenticated with API key: ${apiKey.substring(0, 6)}...`,
        );
      }

      return {
        scope3ApiKey: apiKey,
      };
    } catch (error) {
      if (canLog) {
        console.log(
          "[Auth] Authentication failed:",
          error instanceof Error ? error.message : String(error),
        );
      }
      throw error;
    }
  },
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
