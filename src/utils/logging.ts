import type { MCPToolExecuteContext } from "../types/mcp.js";

import { posthogService } from "../services/posthog-service.js";
import { categorizeError } from "./error-handling.js";

/**
 * Enhanced logging service that combines console logging with PostHog analytics
 */
export class Logger {
  private context?: MCPToolExecuteContext;
  private toolName: string;

  constructor(toolName: string, context?: MCPToolExecuteContext) {
    this.toolName = toolName;
    this.context = context;
  }

  /**
   * Log general information
   */
  logInfo(message: string, data?: Record<string, unknown>): void {
    const isDev =
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

    if (isDev) {
      console.log(`[${this.toolName}] ${message}`, data);
    }
  }

  /**
   * Log sales agent results (specific to product discovery tools)
   */
  logSalesAgentResults(results: {
    failed: Array<{
      agent: { name: string; principal_id: string };
      error: string;
    }>;
    successful: Array<{
      products: unknown[];
      sales_agent: { name: string; principal_id: string };
    }>;
  }): void {
    const isDev =
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

    if (isDev) {
      console.log(`[${this.toolName}] Sales agent results`, {
        failed_agents: results.failed.length,
        successful_agents: results.successful.length,
        total_products: results.successful.reduce(
          (sum, r) => sum + r.products.length,
          0,
        ),
      });

      // Log individual failures for debugging
      if (results.failed.length > 0) {
        console.warn(
          `[${this.toolName}] Sales agent failures:`,
          results.failed.map((f) => ({ error: f.error, name: f.agent.name })),
        );
      }
    }

    // Track each agent result in PostHog
    [...results.successful, ...results.failed].forEach((result) => {
      if ("products" in result) {
        // Successful result
        posthogService.trackSalesAgentResult({
          agentId: result.sales_agent.principal_id,
          agentName: result.sales_agent.name,
          apiKeyPrefix: this.getApiKeyPrefix(),
          productCount: result.products.length,
          success: true,
          toolName: this.toolName,
          userId: this.getUserId(),
        });
      } else {
        // Failed result
        posthogService.trackSalesAgentResult({
          agentId: result.agent.principal_id,
          agentName: result.agent.name,
          apiKeyPrefix: this.getApiKeyPrefix(),
          errorMessage: result.error,
          success: false,
          toolName: this.toolName,
          userId: this.getUserId(),
        });
      }
    });
  }

  /**
   * Log tool error
   */
  logToolError(
    error: unknown,
    data: { context?: string; startTime: number },
  ): void {
    const duration = Date.now() - data.startTime;
    const errorDetails = categorizeError(error);
    const isDev =
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

    if (isDev) {
      console.error(`[${this.toolName}] Tool failed`, {
        context: data.context,
        duration_ms: duration,
        error_code: errorDetails.code,
        error_message: errorDetails.message,
        timestamp: new Date().toISOString(),
      });
    }

    // Track in PostHog
    posthogService.trackToolError({
      apiKeyPrefix: this.getApiKeyPrefix(),
      duration,
      errorMessage: errorDetails.userMessage,
      errorType: errorDetails.code,
      toolName: this.toolName,
      userId: this.getUserId(),
    });
  }

  /**
   * Log tool invocation start
   */
  logToolStart(parameters: Record<string, unknown>): { startTime: number } {
    const startTime = Date.now();
    const isDev =
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

    if (isDev) {
      console.log(`[${this.toolName}] Tool invocation started`, {
        parameters: Object.keys(parameters).length > 0 ? "present" : "none",
        timestamp: new Date().toISOString(),
      });
    }

    return { startTime };
  }

  /**
   * Log successful tool completion
   */
  logToolSuccess(data: {
    metadata?: Record<string, unknown>;
    resultSummary?: string;
    startTime: number;
  }): void {
    const duration = Date.now() - data.startTime;
    const isDev =
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

    if (isDev) {
      console.log(`[${this.toolName}] Tool completed successfully`, {
        duration_ms: duration,
        result_summary: data.resultSummary,
        ...data.metadata,
      });
    }

    // Track in PostHog
    posthogService.trackToolInvocation({
      apiKeyPrefix: this.getApiKeyPrefix(),
      duration,
      success: true,
      toolName: this.toolName,
      userId: this.getUserId(),
    });
  }

  /**
   * Log warnings
   */
  logWarning(message: string, data?: Record<string, unknown>): void {
    const isDev =
      process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

    if (isDev) {
      console.warn(`[${this.toolName}] ${message}`, data);
    }
  }

  /**
   * Get API key prefix for tracking (first 6 chars only)
   */
  private getApiKeyPrefix(): string | undefined {
    const apiKey = this.context?.session?.scope3ApiKey;
    return apiKey ? `${apiKey.substring(0, 6)}...` : undefined;
  }

  /**
   * Get user identifier for tracking (without exposing sensitive info)
   */
  private getUserId(): string | undefined {
    return this.context?.session?.customerId?.toString();
  }
}

/**
 * Factory function to create logger instances
 */
export function createLogger(
  toolName: string,
  context?: MCPToolExecuteContext,
): Logger {
  return new Logger(toolName, context);
}
