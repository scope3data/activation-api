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

export const unregisterSalesAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Sales Agents",
    dangerLevel: "medium", // Medium because it removes access
    openWorldHint: true,
    readOnlyHint: false,
    title: "Unregister Sales Agent Account",
  },

  description:
    "Remove your account with a sales agent. This will stop using your direct relationship and fall back to Scope3's default relationship (if available) for future product discovery calls. The global sales agent remains available for other users.",

  execute: async (
    args: {
      confirm?: boolean;
      sales_agent_id: string;
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
          `You don't have a registered account with '${agentInfo.name}' to unregister.`,
          { context: "sales_agent_account_missing" },
        );
      }

      // Safety confirmation check
      if (!args.confirm) {
        return createMCPResponse({
          data: {
            agentId: args.sales_agent_id,
            agentName: agentInfo.name,
            requiresConfirmation: true,
          },
          message: `⚠️  **Confirm Sales Agent Account Removal**

**Agent to Unregister:** ${agentInfo.name}
• **Endpoint:** ${agentInfo.endpoint_url}
• **Your Account:** ${agentInfo.account?.account_identifier || "Registered"}

**⚠️ This action will:**
• Remove your direct account relationship with ${agentInfo.name}
• Stop using your credentials for product discovery with this agent
• Fall back to Scope3's default relationship (if available)
• The global agent remains available for other users

**🔄 Fallback Behavior:**
${
  agentInfo.account_type === "your_account" &&
  agentsWithAccounts.some(
    (a) => a.id === args.sales_agent_id && a.account_type === "scope3_account",
  )
    ? `✅ Scope3 has a relationship with ${agentInfo.name} - you'll automatically use that`
    : `❌ Scope3 has no relationship with ${agentInfo.name} - this agent will become unavailable to you`
}

**To proceed, call this command again with:**
\`\`\`
sales_agents_unregister({
  sales_agent_id: "${args.sales_agent_id}",
  confirm: true
})
\`\`\``,
          success: true,
        });
      }

      await salesAgentService.unregisterSalesAgentAccount(
        authResult.customerId,
        args.sales_agent_id,
      );

      // Check what will happen after unregistering
      const updatedAgents = await salesAgentService.getSalesAgentsWithAccounts(
        authResult.customerId,
      );
      const updatedAgentInfo = updatedAgents.find(
        (a) => a.id === args.sales_agent_id,
      );
      const fallbackType = updatedAgentInfo?.account_type || "unavailable";

      let summary = `✅ **Sales Agent Account Unregistered Successfully!**

**Removed Account:**
• **Agent:** ${agentInfo.name}
• **Endpoint:** ${agentInfo.endpoint_url}
• **Your Account:** Removed
• **Status:** Unregistered

**🔄 Fallback Status:**
`;

      if (fallbackType === "scope3_account") {
        summary += `✅ **Automatically using Scope3's account**
• You can still discover products through ${agentInfo.name}
• Scope3's relationship will be used for product discovery
• No action needed - service continues seamlessly`;
      } else {
        summary += `❌ **Agent no longer available**
• ${agentInfo.name} is not available for your product discovery
• Scope3 has no relationship with this agent  
• You can re-register if you want to use this agent again`;
      }

      summary += `

**📊 Impact on Product Discovery:**
• \`tactic_discover_products\` will ${fallbackType === "scope3_account" ? "continue working with" : "no longer include"} ${agentInfo.name}
• Other sales agents remain unaffected
• Changes take effect immediately

**🔧 Recovery Options:**
• Use \`sales_agents_register\` to re-create your account with ${agentInfo.name}
• Use \`sales_agents_list\` to see all available agents
• Contact support if you need help with agent relationships`;

      return createMCPResponse({
        data: {
          agentId: args.sales_agent_id,
          agentName: agentInfo.name,
          customerId: authResult.customerId,
          fallbackType,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        `Failed to unregister sales agent account: ${error instanceof Error ? error.message : String(error)}`,
        {
          context: "sales_agent_unregister",
          errorType:
            error instanceof Error ? error.constructor.name : "UnknownError",
        },
      );
    }
  },

  name: "sales_agents_unregister",
  parameters: z.object({
    confirm: z
      .boolean()
      .optional()
      .describe(
        "Set to true to confirm the unregistration (required for safety)",
      ),
    sales_agent_id: z
      .string()
      .min(1)
      .describe("The ID of the sales agent to remove your account from"),
  }),
});
