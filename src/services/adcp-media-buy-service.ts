// AdCP Media Buy Service - Executes real media buys via sales agents
// Uses @adcp/client to call create_media_buy with axe segment targeting

import type {
  AgentConfig,
  CreateMediaBuyRequest,
  CreateMediaBuyResponse,
  TaskResult,
} from "@adcp/client";

import { ADCPClient } from "@adcp/client";
import crypto from "crypto";

import type { SalesAgent } from "./sales-agent-service.js";
import type { TacticBigQueryRecord } from "./tactic-bigquery-service.js";

import { AuthHandlerFactory } from "./auth/auth-handler-factory.js";
import { SalesAgentService } from "./sales-agent-service.js";

export interface MediaBuyPackage {
  axe_include_segment: string; // Key targeting via axe
  budget: {
    amount: number;
    currency: string;
    pacing: string; // "even" by default
  };
  buyer_ref: string; // tactic ID
  cpm: number;
  end_date?: string;
  product_id: string;
  start_date?: string;
}

export interface MediaBuyResult {
  error_message?: string;
  media_buy_id?: string;
  request: CreateMediaBuyRequest;
  response?: CreateMediaBuyResponse;
  status: "active" | "failed" | "pending_approval" | "rejected" | "submitted";
  webhook_secret?: string;
  webhook_url?: string;
}

export class AdCPMediaBuyService {
  private salesAgentService: SalesAgentService;

  constructor() {
    this.salesAgentService = new SalesAgentService();
  }

  /**
   * Execute a media buy for a tactic via AdCP
   */
  async executeMediaBuy(
    tactic: TacticBigQueryRecord,
    salesAgent: SalesAgent,
    campaignBrief?: string,
    customerId: number = 1,
  ): Promise<MediaBuyResult> {
    try {
      // 1. Build the AdCP request with axe segment targeting
      const webhookSecret = this.generateWebhookSecret();
      const webhookUrl = this.generateWebhookUrl(tactic.id as string);

      // Set campaign timing (default to 30 days from now)
      const startTime = new Date();
      const endTime = new Date(startTime.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

      const request: CreateMediaBuyRequest = {
        adcp_version: "1.6.0",
        // Budget at top level (required)
        budget: {
          currency: (tactic.budget_currency as string) || "USD",
          pacing:
            (tactic.budget_pacing as "asap" | "even" | "front_loaded") ||
            "even",
          total: tactic.budget_amount as number,
        },

        buyer_ref: tactic.id as string,

        end_time: endTime.toISOString(),
        packages: [
          {
            // Targeting via axe segment - this handles all targeting
            axe_include_segment: tactic.axe_include_segment as string,
            // Package identification
            buyer_ref: tactic.id as string,

            // Pricing
            cpm: tactic.total_cpm as number,

            product_id: tactic.media_product_id as string,
          },
        ],

        promoted_offering:
          campaignBrief ||
          (tactic.description as string) ||
          `Campaign for ${tactic.name}`,
        // Campaign timing (required)
        start_time: startTime.toISOString(),

        // Note: webhook is not supported in standard CreateMediaBuyRequest
        // Webhook URL and secret are stored separately for callback handling
      };

      // 2. Get authenticated AdCP client for the sales agent
      const client = await this.getClientForSalesAgent(salesAgent, customerId);

      // 3. Execute the create_media_buy call
      const result: TaskResult<CreateMediaBuyResponse> =
        await client.createMediaBuy(request);

      // 4. Process the response
      if (result.success && result.data) {
        const status = this.mapAdcpStatusToInternal(result.data.status);

        return {
          media_buy_id: result.data.media_buy_id,
          request,
          response: result.data,
          status,
          webhook_secret: webhookSecret,
          webhook_url: webhookUrl,
        };
      } else {
        // Handle error case
        return {
          error_message: result.error || "Unknown error executing media buy",
          request,
          response: undefined,
          status: "failed",
        };
      }
    } catch (error) {
      return {
        error_message: error instanceof Error ? error.message : String(error),
        request: {} as CreateMediaBuyRequest, // Fallback empty request
        status: "failed",
      };
    }
  }

  /**
   * Find appropriate sales agent for a publisher/media product
   */
  async findSalesAgentForPublisher(
    publisherId: string,
    customerId: number = 1,
  ): Promise<null | SalesAgent> {
    // Get all available sales agents for this customer
    const agentsWithAccounts =
      await this.salesAgentService.getSalesAgentsWithAccounts(customerId);

    // Filter to agents with accounts (can actually be used)
    const availableAgents = agentsWithAccounts.filter(
      (agent) => agent.account_type !== "unavailable",
    );

    if (availableAgents.length === 0) {
      return null;
    }

    // For now, return the first available agent
    // TODO: In the future, we could implement publisher-specific routing
    // based on publisher_id or other criteria
    return availableAgents[0];
  }

  /**
   * Validate webhook signature
   */
  validateWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    // Compare with constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex"),
    );
  }

  /**
   * Generate a secure webhook secret for validation
   */
  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  /**
   * Generate webhook URL for tactic status updates
   */
  private generateWebhookUrl(tacticId: string): string {
    // TODO: Make this configurable based on environment
    const baseUrl =
      process.env.WEBHOOK_BASE_URL || "https://api.agentic.scope3.com";
    return `${baseUrl}/webhooks/media-buy/${tacticId}`;
  }

  /**
   * Create an authenticated AdCP client for a sales agent
   */
  private async getClientForSalesAgent(
    salesAgent: SalesAgent,
    customerId: number,
  ): Promise<ADCPClient> {
    // Get the account for this customer with this sales agent
    const agentsWithAccounts =
      await this.salesAgentService.getSalesAgentsWithAccounts(customerId);

    const agentWithAccount = agentsWithAccounts.find(
      (a) => a.id === salesAgent.id,
    );

    if (!agentWithAccount || !agentWithAccount.account) {
      throw new Error(`No account found for sales agent ${salesAgent.name}`);
    }

    // Build agent config with authentication
    let authFields: Record<string, string> = {};

    if (agentWithAccount.account.auth_config) {
      try {
        // Get auth handler and process authentication
        const handler = AuthHandlerFactory.getHandler(salesAgent.auth_type);
        const typedConfig = AuthHandlerFactory.createTypedConfig(
          salesAgent.auth_type,
          agentWithAccount.account.auth_config,
        );

        // Get authentication token
        const token = await handler.getToken(salesAgent.id, typedConfig);

        // Get auth fields to include in agent config
        authFields = handler.getAgentAuthFields(token);
      } catch (error) {
        throw new Error(
          `Failed to authenticate with sales agent ${salesAgent.name}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    const agentConfig: AgentConfig = {
      agent_uri: salesAgent.endpoint_url,
      id: salesAgent.id,
      name: salesAgent.name,
      protocol: (salesAgent.protocol === "adcp"
        ? "mcp"
        : salesAgent.protocol) as "a2a" | "mcp", // ADCP maps to MCP
      requiresAuth: Boolean(
        agentWithAccount.account.auth_config &&
          Object.keys(agentWithAccount.account.auth_config).length > 0,
      ),
      ...authFields, // Spread auth fields
    };

    return new ADCPClient(agentConfig);
  }

  /**
   * Map AdCP status to our internal status
   */
  private mapAdcpStatusToInternal(
    adcpStatus?: string,
  ): "active" | "failed" | "pending_approval" | "rejected" | "submitted" {
    switch (adcpStatus?.toLowerCase()) {
      case "active":
      case "approved":
      case "live":
        return "active";
      case "awaiting_approval":
      case "pending":
      case "pending_approval":
        return "pending_approval";
      case "declined":
      case "rejected":
        return "rejected";
      case "error":
      case "failed":
        return "failed";
      case "submitted":
        return "submitted";
      default:
        // Default to pending_approval for unknown statuses
        return "pending_approval";
    }
  }
}
