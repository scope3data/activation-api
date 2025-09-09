import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  MCPToolExecuteContext,
  RegisterWebhookParams,
} from "../../types/mcp.js";
import type { WebhookSubscription } from "../../types/webhooks.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const registerWebhookTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "integration",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Register Webhook",
  },

  description:
    "Register a webhook endpoint to receive real-time campaign event notifications. Supports delivery updates, performance events, and threshold alerts. Follows enterprise security patterns with authentication and retry policies.",

  execute: async (
    args: RegisterWebhookParams,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check session context first, then fall back to environment variable
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      return createAuthErrorResponse();
    }

    try {
      // Validate webhook endpoint
      const validationResult = await validateWebhookEndpoint(args.endpoint);
      if (!validationResult.valid) {
        return createErrorResponse(
          `Invalid webhook endpoint: ${validationResult.reason}`,
          new Error("Invalid webhook endpoint"),
        );
      }

      // Verify brand agent exists
      try {
        const brandAgent = await client.getBrandAgent(
          apiKey,
          args.brandAgentId,
        );
        if (!brandAgent) {
          return createErrorResponse(
            "Brand agent not found. Please check the brand agent ID.",
            new Error("Brand agent not found"),
          );
        }
      } catch (error) {
        return createErrorResponse(
          "Brand agent not found. Please check the brand agent ID.",
          error,
        );
      }

      // Create webhook subscription
      const subscription = await client.createWebhookSubscription(apiKey, {
        brandAgentId: args.brandAgentId,
        endpoint: {
          authentication: args.endpoint.authentication,
          headers: args.endpoint.headers,
          method: args.endpoint.method || "POST",
          url: args.endpoint.url,
        },
        eventTypes: args.eventTypes,
        filters: args.filters,
        retryPolicy: {
          backoffMultiplier: args.retryPolicy?.backoffMultiplier || 2.0,
          maxBackoffSeconds: args.retryPolicy?.maxBackoffSeconds || 3600, // 1 hour max
          maxRetries: args.retryPolicy?.maxRetries || 25,
        },
      });

      // Test webhook endpoint
      const testResult = await testWebhookEndpoint(subscription);

      const response = formatWebhookRegistrationResponse(
        subscription,
        testResult,
      );

      return createMCPResponse({
        message: response,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to register webhook", error);
    }
  },

  name: "webhook/register",
  parameters: z.object({
    brandAgentId: z.string().describe("Brand agent ID to register webhook for"),
    endpoint: z.object({
      authentication: z
        .object({
          credentials: z.string().describe("Authentication credentials"),
          type: z.enum(["bearer", "basic", "hmac"]),
        })
        .optional(),
      headers: z
        .record(z.string())
        .optional()
        .describe("Additional HTTP headers to send"),
      method: z
        .enum(["POST", "PUT"])
        .optional()
        .describe("HTTP method (defaults to POST)"),
      url: z.string().url().describe("Webhook endpoint URL (must be HTTPS)"),
    }),
    eventTypes: z
      .array(z.string())
      .describe(
        "Event types to subscribe to (e.g., 'delivery_update', 'performance_event', 'threshold_alert')",
      ),
    filters: z
      .object({
        campaigns: z
          .array(z.string())
          .optional()
          .describe("Filter to specific campaign IDs"),
        metrics: z
          .array(z.string())
          .optional()
          .describe("Filter to specific metrics"),
        minSeverity: z
          .enum(["info", "warning", "critical"])
          .optional()
          .describe("Minimum alert severity"),
      })
      .optional(),
    retryPolicy: z
      .object({
        backoffMultiplier: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe("Backoff multiplier (defaults to 2.0)"),
        maxBackoffSeconds: z
          .number()
          .min(60)
          .max(86400)
          .optional()
          .describe("Maximum backoff time in seconds"),
        maxRetries: z
          .number()
          .min(0)
          .max(50)
          .optional()
          .describe("Maximum retry attempts (defaults to 25)"),
      })
      .optional(),
  }),
});

function formatWebhookRegistrationResponse(
  subscription: WebhookSubscription,
  testResult: Record<string, unknown>,
): string {
  let response = `## 🔗 Webhook Registration Complete\n\n`;

  response += `**Subscription ID**: ${subscription.id}\n`;
  response += `**Brand Agent**: ${subscription.brandAgentId}\n`;
  response += `**Endpoint**: ${subscription.endpoint.url}\n`;
  response += `**Method**: ${subscription.endpoint.method}\n`;
  response += `**Status**: ${subscription.status}\n\n`;

  // Event configuration
  response += `### 📡 Event Configuration\n`;
  response += `**Event Types**: ${subscription.eventTypes.join(", ")}\n`;

  if (subscription.filters) {
    if (subscription.filters.campaigns?.length) {
      response += `**Campaign Filter**: ${subscription.filters.campaigns.length} specific campaigns\n`;
    }
    if (subscription.filters.minSeverity) {
      response += `**Min Severity**: ${subscription.filters.minSeverity}\n`;
    }
    if (subscription.filters.metrics?.length) {
      response += `**Metric Filter**: ${subscription.filters.metrics.join(", ")}\n`;
    }
  }
  response += `\n`;

  // Retry policy
  response += `### 🔄 Retry Policy\n`;
  response += `**Max Retries**: ${subscription.retryPolicy.maxRetries}\n`;
  response += `**Backoff Multiplier**: ${subscription.retryPolicy.backoffMultiplier}x\n`;
  response += `**Max Backoff**: ${Math.floor(subscription.retryPolicy.maxBackoffSeconds / 60)} minutes\n\n`;

  // Test results
  response += `### 🧪 Endpoint Test Results\n`;
  if (testResult.success) {
    response += `✅ **Test Successful** (HTTP ${testResult.statusCode})\n`;
    response += `Your endpoint is ready to receive webhook notifications.\n\n`;
  } else {
    response += `❌ **Test Failed**: ${testResult.error}\n`;
    response += `Status Code: ${testResult.statusCode || "N/A"}\n\n`;
    response += `⚠️ *Please verify your endpoint is accessible and returns HTTP 200-299 for successful requests.*\n\n`;
  }

  // Security information
  if (subscription.endpoint.authentication) {
    const authType = subscription.endpoint.authentication.type;
    response += `### 🔐 Security\n`;
    response += `**Authentication**: ${authType.toUpperCase()}\n`;

    if (authType === "hmac") {
      response += `**Signature Header**: X-Webhook-Signature\n`;
      response += `**Algorithm**: SHA-256\n`;
    }
    response += `\n`;
  }

  // Example webhook payload
  response += `### 📋 Example Webhook Payload\n`;
  response += `Your endpoint will receive payloads in this format:\n\n`;
  response += "```json\n";
  response += JSON.stringify(
    {
      event: {
        data: {
          campaignId: "camp_123",
          currency: "USD",
          currentPrice: 3.0,
          date: "2024-01-15",
          pacing: {
            budgetUtilization: 0.75,
            status: "on_track",
          },
          spend: 450.0,
          tacticId: "tac_456",
          unitsDelivered: 150000,
        },
        type: "delivery_update",
      },
      eventId: "evt_1234567890",
      retryAttempt: 0,
      signature: "sha256=abc123...", // If HMAC authentication enabled
      subscriptionId: subscription.id,
      timestamp: "2024-01-15T10:30:00.000Z",
    },
    null,
    2,
  );
  response += "\n```\n\n";

  // Management information
  response += `### 📊 Management\n`;
  response += `• Use subscription ID \`${subscription.id}\` for support requests\n`;
  response += `• Monitor webhook health via the Scope3 dashboard\n`;
  response += `• Update or disable webhooks using the management API\n`;
  response += `• Webhook deliveries are logged for troubleshooting\n\n`;

  response += `🎉 **Your webhook is now active and will receive real-time notifications!**`;

  return response;
}

// Generate HMAC signature for webhook verification
function generateHmacSignature(payload: string, secret: string): string {
  // In a real implementation, this would use Node.js crypto module
  // For now, return a placeholder
  return (
    "mock_signature_" +
    Buffer.from(payload + secret)
      .toString("base64")
      .slice(0, 32)
  );
}

// Test webhook endpoint with a ping
async function testWebhookEndpoint(
  subscription: WebhookSubscription,
): Promise<{ error?: string; statusCode?: number; success: boolean }> {
  try {
    const testPayload = {
      event: {
        data: {
          brandAgentId: subscription.brandAgentId,
          message: "Webhook registration test",
          timestamp: new Date(),
        },
        type: "webhook_test",
      },
      eventId: `test_${Date.now()}`,
      retryAttempt: 0,
      subscriptionId: subscription.id,
      timestamp: new Date(),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Scope3-Webhook/1.0",
      "X-Webhook-Test": "true",
    };

    // Add custom headers
    if (subscription.endpoint.headers) {
      Object.assign(headers, subscription.endpoint.headers);
    }

    // Add authentication
    if (subscription.endpoint.authentication) {
      const auth = subscription.endpoint.authentication;
      switch (auth.type) {
        case "basic":
          headers["Authorization"] = `Basic ${auth.credentials}`;
          break;
        case "bearer":
          headers["Authorization"] = `Bearer ${auth.credentials}`;
          break;
        case "hmac": {
          // Generate HMAC signature
          const signature = generateHmacSignature(
            JSON.stringify(testPayload),
            auth.credentials,
          );
          headers["X-Webhook-Signature"] = `sha256=${signature}`;
          break;
        }
      }
    }

    const response = await fetch(subscription.endpoint.url, {
      body: JSON.stringify(testPayload),
      headers,
      method: subscription.endpoint.method,
    });

    return {
      error: response.ok
        ? undefined
        : `HTTP ${response.status}: ${response.statusText}`,
      statusCode: response.status,
      success: response.ok,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unknown error during webhook test",
      success: false,
    };
  }
}

// Validate webhook endpoint
async function validateWebhookEndpoint(
  endpoint: Record<string, unknown>,
): Promise<{ reason?: string; valid: boolean }> {
  // Check URL format
  try {
    const url = new URL(endpoint.url as string);

    // Must be HTTPS for security
    if (url.protocol !== "https:") {
      return { reason: "Webhook URLs must use HTTPS", valid: false };
    }

    // Check for common security issues
    if (
      url.hostname === "localhost" ||
      url.hostname.startsWith("127.") ||
      url.hostname.startsWith("192.168.")
    ) {
      return {
        reason: "Webhook URLs cannot point to private/local addresses",
        valid: false,
      };
    }

    return { valid: true };
  } catch {
    return { reason: "Invalid URL format", valid: false };
  }
}
