import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { SalesAgentService } from "../../services/sales-agent-service.js";
import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const listSalesAgentsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Sales Agents",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Sales Agents",
  },

  description:
    "List all available sales agents for ADCP multi-agent product discovery. Shows global agents with account indicators - which agents you have direct relationships with, which use Scope3's default relationships, and which are unavailable. Use this to understand your sales agent access before running product discovery.",

  execute: async (
    args: {
      filter_available?: boolean;
      include_details?: boolean;
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
      const agentsWithAccounts =
        await salesAgentService.getSalesAgentsWithAccounts(
          authResult.customerId,
        );

      if (agentsWithAccounts.length === 0) {
        return createMCPResponse({
          data: {
            availableAgents: 0,
            customerId: authResult.customerId,
            totalAgents: 0,
          },
          message: `📭 **No Sales Agents Available**

No ADCP sales agents are currently registered in the system. This means:

• No product discovery agents are available for \`tactic_discover_products\`
• You cannot register accounts with sales agents yet
• Contact your administrator to add sales agents to the global registry

**What are Sales Agents?**
Sales agents are third-party services that provide publisher inventory through the ADCP protocol. They require business relationships and provide access to premium advertising inventory.

**Next Steps:**
• Contact support to enable sales agents for your account
• Check back later as new agents are added to the global registry`,
          success: true,
        });
      }

      // Filter agents if requested
      let displayAgents = agentsWithAccounts;
      if (args.filter_available) {
        displayAgents = agentsWithAccounts.filter(
          (agent) => agent.account_type !== "unavailable",
        );
      }

      // Categorize agents
      const yourAgents = displayAgents.filter(
        (agent) => agent.account_type === "your_account",
      );
      const scope3Agents = displayAgents.filter(
        (agent) => agent.account_type === "scope3_account",
      );
      const unavailableAgents = displayAgents.filter(
        (agent) => agent.account_type === "unavailable",
      );

      let summary = `🤝 **Sales Agents Available for Product Discovery**

**Summary:** ${yourAgents.length} your accounts, ${scope3Agents.length} Scope3 accounts, ${unavailableAgents.length} unavailable
**Customer ID:** ${authResult.customerId}

`;

      if (yourAgents.length > 0) {
        summary += `## ✅ **Your Direct Accounts** (${yourAgents.length})
_These agents use your direct relationship and override Scope3's defaults_

`;

        yourAgents.forEach((agent, index) => {
          summary += `**${index + 1}. ${agent.name}** 🟢
   • **Agent ID:** \`${agent.id}\`
   • **Endpoint:** ${agent.endpoint_url}
   • **Protocol:** ${agent.protocol.toUpperCase()}
   • **Account:** Your account${agent.account?.account_identifier ? ` (${agent.account.account_identifier})` : ""}
   • **Registered:** ${agent.account?.registered_at ? new Date(agent.account.registered_at).toLocaleDateString() : "N/A"}
`;

          if (args.include_details && agent.description) {
            summary += `   • **Description:** ${agent.description}\n`;
          }

          summary += `\n`;
        });
      }

      if (scope3Agents.length > 0) {
        summary += `## 🏢 **Scope3 Default Accounts** (${scope3Agents.length})
_These agents use Scope3's relationship - available as fallback_

`;

        scope3Agents.forEach((agent, index) => {
          summary += `**${index + 1}. ${agent.name}** 🔵
   • **Agent ID:** \`${agent.id}\`
   • **Endpoint:** ${agent.endpoint_url}
   • **Protocol:** ${agent.protocol.toUpperCase()}
   • **Account:** Scope3 account (default)
   • **Override:** Register your own account to use your relationship
`;

          if (args.include_details && agent.description) {
            summary += `   • **Description:** ${agent.description}\n`;
          }

          summary += `\n`;
        });
      }

      if (unavailableAgents.length > 0 && !args.filter_available) {
        summary += `## ❌ **Unavailable Agents** (${unavailableAgents.length})
_These agents are in the global registry but have no available accounts_

`;

        unavailableAgents.forEach((agent, index) => {
          summary += `**${index + 1}. ${agent.name}** ⚪
   • **Agent ID:** \`${agent.id}\`
   • **Endpoint:** ${agent.endpoint_url}
   • **Protocol:** ${agent.protocol.toUpperCase()}
   • **Account:** None available
   • **Action Needed:** Register your account to use this agent
`;

          if (args.include_details && agent.description) {
            summary += `   • **Description:** ${agent.description}\n`;
          }

          summary += `\n`;
        });
      }

      // Add usage instructions
      const availableAgents = [...yourAgents, ...scope3Agents];
      if (availableAgents.length > 0) {
        summary += `## 🎯 **Usage Examples**

**Discover products using all available agents:**
\`\`\`
tactic_discover_products({
  campaignBrief: "Premium coffee brands",
  // No salesAgents specified = uses all available agents
})
\`\`\`

**Discover products using specific agents:**
\`\`\`
tactic_discover_products({
  campaignBrief: "Coffee brands",
  salesAgents: ["${availableAgents
    .slice(0, 2)
    .map((a) => a.id)
    .join('", "')}"]
})
\`\`\`

`;
      }

      summary += `## 🔧 **Management Commands**

• **\`sales_agents_register\`** - Register your account with a sales agent
• **\`sales_agents_update\`** - Update your account details with an agent
• **\`sales_agents_unregister\`** - Remove your account from an agent
• **\`tactic_discover_products\`** - Use sales agents for product discovery

**💡 Pro Tips:**
• Your accounts always override Scope3's defaults
• Unavailable agents can be activated by registering your account
• Each agent provides access to different publisher inventory
• Use specific agent lists to target particular inventory sources`;

      return createMCPResponse({
        data: {
          availableAgents: availableAgents.length,
          customerId: authResult.customerId,
          scope3Agents: scope3Agents.length,
          totalAgents: agentsWithAccounts.length,
          unavailableAgents: unavailableAgents.length,
          yourAgents: yourAgents.length,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        `Failed to list sales agents: ${error instanceof Error ? error.message : String(error)}`,
        {
          context: "sales_agent_listing",
          errorType:
            error instanceof Error ? error.constructor.name : "UnknownError",
        },
      );
    }
  },

  name: "sales_agents_list",
  parameters: z.object({
    filter_available: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Only show agents that are available (have accounts) - hide unavailable agents",
      ),
    include_details: z
      .boolean()
      .optional()
      .default(false)
      .describe(
        "Include detailed information like descriptions and additional metadata",
      ),
  }),
});
