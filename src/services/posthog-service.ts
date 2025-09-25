import { PostHog } from "posthog-node";

import { PostHogConfig } from "../utils/config.js";

/**
 * PostHog analytics service for tracking tool usage and errors
 */
export class PostHogService {
  private static instance: null | PostHogService = null;
  private client: null | PostHog = null;

  constructor() {
    if (PostHogConfig.enabled) {
      this.client = new PostHog(PostHogConfig.apiKey, {
        host: PostHogConfig.host,
      });
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(): PostHogService {
    if (!PostHogService.instance) {
      PostHogService.instance = new PostHogService();
    }
    return PostHogService.instance;
  }

  /**
   * Flush events immediately (use in serverless environments)
   */
  async flush(): Promise<void> {
    if (this.client) {
      await this.client.flush();
    }
  }

  /**
   * Shutdown client (use at process exit)
   */
  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.shutdown();
    }
  }

  /**
   * Track authentication events
   */
  trackAuth(data: {
    apiKeyPrefix?: string;
    errorMessage?: string;
    event: "auth_failure" | "auth_success";
  }): void {
    if (!this.client) return;

    const distinctId = data.apiKeyPrefix || "anonymous";

    this.client.capture({
      distinctId,
      event: data.event,
      properties: {
        has_error: Boolean(data.errorMessage),
      },
    });
  }

  /**
   * Track sales agent performance
   */
  trackSalesAgentResult(data: {
    agentId: string;
    agentName: string;
    apiKeyPrefix?: string;
    errorMessage?: string;
    productCount?: number;
    success: boolean;
    toolName: string;
    userId?: string;
  }): void {
    if (!this.client) return;

    const distinctId = data.userId || data.apiKeyPrefix || "anonymous";

    this.client.capture({
      distinctId,
      event: "sales_agent_result",
      properties: {
        agent_id: data.agentId,
        agent_name: data.agentName,
        has_error: Boolean(data.errorMessage),
        product_count: data.productCount || 0,
        success: data.success,
        tool_name: data.toolName,
      },
    });
  }

  /**
   * Track tool error
   */
  trackToolError(data: {
    apiKeyPrefix?: string;
    duration?: number;
    errorMessage: string;
    errorType: string;
    toolName: string;
    userId?: string;
  }): void {
    if (!this.client) return;

    const distinctId = data.userId || data.apiKeyPrefix || "anonymous";

    this.client.capture({
      distinctId,
      event: "tool_error",
      properties: {
        duration_ms: data.duration,
        error_message: data.errorMessage,
        error_type: data.errorType,
        tool_name: data.toolName,
      },
    });
  }

  /**
   * Track tool invocation
   */
  trackToolInvocation(data: {
    apiKeyPrefix?: string; // First 6 chars for tracking without exposing full key
    duration?: number;
    parameters?: Record<string, unknown>;
    success: boolean;
    toolName: string;
    userId?: string;
  }): void {
    if (!this.client) return;

    const distinctId = data.userId || data.apiKeyPrefix || "anonymous";

    this.client.capture({
      distinctId,
      event: "tool_invocation",
      properties: {
        duration_ms: data.duration,
        // Don't include actual parameter values for privacy
        has_parameters: Boolean(
          data.parameters && Object.keys(data.parameters).length > 0,
        ),
        parameter_count: data.parameters
          ? Object.keys(data.parameters).length
          : 0,
        success: data.success,
        tool_name: data.toolName,
      },
    });
  }
}

// Export singleton instance
export const posthogService = PostHogService.getInstance();
