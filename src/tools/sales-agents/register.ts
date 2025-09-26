import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { SalesAgentService } from "../../services/sales-agent-service.js";
import { requireSessionAuth } from "../../utils/auth.js";
import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const registerSalesAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Sales Agents",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Register Sales Agent",
  },

  description:
    "Register a new sales agent or create an account with an existing sales agent. This allows you to use your own sales agent relationship for product discovery, which will override Scope3's default agents. Supports ADCP (Advertising Data Control Protocol) compliant agents.",

  execute: async (
    args: {
      account_identifier?: string;
      auth_config?: Record<string, unknown>;
      description?: string;
      endpoint_url: string;
      name: string;
      protocol?: string;
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Universal session authentication check
    const { apiKey, customerId: _customerId } = requireSessionAuth(context);

    try {
      // Get customer ID from auth service
      const authResult = await client.validateApiKey(apiKey);
      if (!authResult.isValid || !authResult.customerId) {
        return createAuthErrorResponse();
      }

      const salesAgentService = new SalesAgentService();
      const result = await salesAgentService.registerSalesAgent(
        {
          account_identifier: args.account_identifier,
          auth_config: args.auth_config,
          description: args.description,
          endpoint_url: args.endpoint_url,
          name: args.name,
          protocol: args.protocol || "adcp",
        },
        authResult.customerId,
        authResult.customerId.toString(),
      );

      let summary = `✅ **Sales Agent ${result.isNewAgent ? "Registered" : "Account Created"} Successfully!**

`;

      if (result.isNewAgent) {
        summary += `**🆕 New Agent Added to Global Registry:**
• **Agent ID:** \`${result.agent.id}\`
• **Name:** ${result.agent.name}
• **Endpoint:** ${result.agent.endpoint_url}
• **Protocol:** ${result.agent.protocol.toUpperCase()}
${result.agent.description ? `• **Description:** ${result.agent.description}` : ""}

This agent has been added to the global registry and is now available for all users to discover.

`;
      } else {
        summary += `**🔗 Account Created with Existing Agent:**
• **Agent:** ${result.agent.name}
• **Endpoint:** ${result.agent.endpoint_url}
• **Protocol:** ${result.agent.protocol.toUpperCase()}

`;
      }

      summary += `**👤 Your Account Details:**
• **Account ID:** Your account with ${result.agent.name}
${result.account.account_identifier ? `• **Account Identifier:** ${result.account.account_identifier}` : ""}
• **Status:** ${result.account.status.charAt(0).toUpperCase() + result.account.status.slice(1)}
• **Registered:** ${new Date(result.account.registered_at).toLocaleString()}

**🎯 Usage Impact:**
• This agent will now be available for your product discovery calls
• Your account with ${result.agent.name} will override Scope3's default relationship
• Use \`tactic_discover_products\` to leverage this agent for campaign targeting

**🔧 Management:**
• Use \`sales_agents_update\` to modify your account details
• Use \`sales_agents_unregister\` to remove your account
• Use \`sales_agents_list\` to view all available agents

**⚠️ Important Notes:**
• Registration requires valid agent credentials if authentication is needed
• Make sure the endpoint URL is accessible and responds to ADCP protocol
• Your account configuration is private and secure`;

      return createMCPResponse({
        data: {
          agentId: result.agent.id,
          customerId: authResult.customerId,
          isNewAgent: result.isNewAgent,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        `Failed to register sales agent: ${error instanceof Error ? error.message : String(error)}`,
        {
          context: "sales_agent_registration",
          errorType:
            error instanceof Error ? error.constructor.name : "UnknownError",
        },
      );
    }
  },

  name: "sales_agents_register",
  parameters: z.object({
    account_identifier: z
      .string()
      .optional()
      .describe(
        "Your account ID or username with this sales agent (if applicable)",
      ),
    auth_config: z
      .record(z.unknown())
      .optional()
      .describe(
        "Authentication configuration for your account with this agent (credentials, tokens, etc.)",
      ),
    description: z
      .string()
      .optional()
      .describe("Optional description of the sales agent's services"),
    endpoint_url: z
      .string()
      .url()
      .describe(
        "The ADCP endpoint URL for the sales agent (e.g., 'https://ads.scribd.com/adcp')",
      ),
    name: z
      .string()
      .min(1)
      .max(100)
      .describe(
        "Human-readable name for the sales agent (e.g., 'Scribd Sales', 'PubMatic Direct')",
      ),
    protocol: z
      .enum(["adcp", "mcp", "a2a"])
      .optional()
      .default("adcp")
      .describe("Protocol used by the sales agent (default: adcp)"),
  }),
});
