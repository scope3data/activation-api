import { FastMCP } from "fastmcp";
import http from "http";

import type { FastMCPSessionAuth } from "./types/mcp.js";

import { Scope3ApiClient } from "./client/scope3-client.js";
import { posthogService } from "./services/posthog-service.js";
import { AuthenticationService } from "./services/auth-service.js";
import { CampaignBigQueryService } from "./services/campaign-bigquery-service.js";
import { CachedBigQuery, DEFAULT_CACHE_CONFIG } from "./services/cache/cached-bigquery.js";
import { PreloadService, DEFAULT_PRELOAD_CONFIG } from "./services/cache/preload-service.js";
import { registerTools } from "./tools/index.js";
import { config } from "./utils/config.js";

// Initialize cached BigQuery with configuration
const cacheConfig = {
  ...DEFAULT_CACHE_CONFIG,
  // Override with environment variables if provided
  ttl: {
    brandAgents: parseInt(process.env.CACHE_TTL_BRAND_AGENTS || "300000"), // 5 minutes
    campaigns: parseInt(process.env.CACHE_TTL_CAMPAIGNS || "120000"),     // 2 minutes
    creatives: parseInt(process.env.CACHE_TTL_CREATIVES || "300000"),     // 5 minutes
    default: parseInt(process.env.CACHE_TTL_DEFAULT || "60000")           // 1 minute
  }
};

console.log('[Cache] Initializing with config:', cacheConfig);
const cachedBigQuery = new CachedBigQuery(
  { location: "us-central1", projectId: "bok-playground" },
  cacheConfig
);

// Initialize services with cached BigQuery
const authService = new AuthenticationService(cachedBigQuery);
const campaignService = new CampaignBigQueryService(
  "bok-playground",
  "agenticapi", 
  "swift-catfish-337215.postgres_datastream.public_agent",
  cachedBigQuery // Inject cached BigQuery
);

// Initialize preload service
const preloadService = new PreloadService(campaignService, authService, DEFAULT_PRELOAD_CONFIG);

// Initialize client with cached services
const scope3Client = new Scope3ApiClient(config.scope3GraphQLUrl, campaignService, authService);
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

      // Track successful authentication
      posthogService.trackAuth({
        apiKeyPrefix: `${apiKey.substring(0, 6)}...`,
        event: "auth_success",
      });

      // Trigger async preload for this customer (fire-and-forget)
      preloadService.triggerPreload(apiKey);

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

      // Track authentication failure
      posthogService.trackAuth({
        errorMessage: error instanceof Error ? error.message : String(error),
        event: "auth_failure",
      });

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

  // Graceful shutdown handler to flush PostHog events
  process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down gracefully...");
    await posthogService.shutdown();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("SIGINT received, shutting down gracefully...");
    await posthogService.shutdown();
    process.exit(0);
  });
}
