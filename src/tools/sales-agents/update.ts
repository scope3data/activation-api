import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { SalesAgentService } from "../../services/sales-agent-service.js";
import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const updateSalesAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Sales Agents",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Update Sales Agent Account",
  },

  description:
    "Update your account details with a registered sales agent. You can modify your account identifier, authentication configuration, or status. This only updates YOUR account relationship with the agent, not the global agent configuration.",

  execute: async (
    args: {
      account_identifier?: string;
      auth_config?: Record<string, unknown>;
      sales_agent_id: string;
      status?: "active" | "inactive";
    },
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
      // Get customer ID from auth service
      const authResult = await client.validateApiKey(apiKey);
      if (!authResult.isValid || !authResult.customerId) {
        return createAuthErrorResponse();
      }

      const salesAgentService = new SalesAgentService();

      // Get the agent info first for display purposes
      const agentsWithAccounts =
        await salesAgentService.getSalesAgentsWithAccounts(
          authResult.customerId,
        );
      const agentInfo = agentsWithAccounts.find(
        (a) => a.id === args.sales_agent_id,
      );

      if (!agentInfo) {
        return createErrorResponse(
          `Sales agent with ID '${args.sales_agent_id}' not found.`,
          { context: "sales_agent_lookup" },
        );
      }

      if (agentInfo.account_type !== "your_account") {
        return createErrorResponse(
          `You don't have a registered account with '${agentInfo.name}'. Use 'sales_agents_register' to create an account first.`,
          { context: "sales_agent_account_missing" },
        );
      }

      const updatedAccount = await salesAgentService.updateSalesAgentAccount(
        authResult.customerId,
        args.sales_agent_id,
        {
          account_identifier: args.account_identifier,
          auth_config: args.auth_config,
          status: args.status,
        },
      );

      let summary = `✅ **Sales Agent Account Updated Successfully!**

**Agent:** ${agentInfo.name}
• **Endpoint:** ${agentInfo.endpoint_url}
• **Protocol:** ${agentInfo.protocol.toUpperCase()}

**Updated Account Details:**
`;

      if (args.account_identifier) {
        summary += `• **Account Identifier:** ${updatedAccount.account_identifier}\n`;
      }

      if (args.auth_config) {
        summary += `• **Authentication:** Updated (configuration is private)\n`;
      }

      if (args.status) {
        summary += `• **Status:** ${updatedAccount.status.charAt(0).toUpperCase() + updatedAccount.status.slice(1)}\n`;
      }

      summary += `• **Last Updated:** ${new Date(updatedAccount.updated_at).toLocaleString()}

**🎯 Impact:**
`;

      if (args.status === "inactive") {
        summary += `• This agent will no longer be used for your product discovery calls
• You can reactivate it by setting status back to 'active'`;
      } else if (args.status === "active") {
        summary += `• This agent is now active and will be used for product discovery calls
• Your account overrides Scope3's default relationship with ${agentInfo.name}`;
      } else {
        summary += `• Changes take effect immediately for future product discovery calls
• Your account continues to override Scope3's default relationship`;
      }

      summary += `

**🔧 Management Commands:**
• Use \`sales_agents_list\` to view all your agents and their status
• Use \`sales_agents_unregister\` to remove your account entirely
• Use \`tactic_discover_products\` to test the updated configuration`;

      return createMCPResponse({
        data: {
          agentId: args.sales_agent_id,
          customerId: authResult.customerId,
          updatedFields: Object.keys(args).filter(
            (key) =>
              key !== "sales_agent_id" &&
              args[key as keyof typeof args] !== undefined,
          ),
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        `Failed to update sales agent account: ${error instanceof Error ? error.message : String(error)}`,
        {
          context: "sales_agent_update",
          errorType:
            error instanceof Error ? error.constructor.name : "UnknownError",
        },
      );
    }
  },

  name: "sales_agents_update",
  parameters: z.object({
    account_identifier: z
      .string()
      .optional()
      .describe("Update your account ID or username with this sales agent"),
    auth_config: z
      .record(z.unknown())
      .optional()
      .describe(
        "Update authentication configuration for your account (credentials, tokens, etc.)",
      ),
    sales_agent_id: z
      .string()
      .min(1)
      .describe("The ID of the sales agent to update your account with"),
    status: z
      .enum(["active", "inactive"])
      .optional()
      .describe(
        "Set account status - 'inactive' will stop using this agent for discovery",
      ),
  }),
});
