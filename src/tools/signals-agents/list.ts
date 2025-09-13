import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  ListSignalsAgentsParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";

import { SignalsAgentService } from "../../services/signals-agent-service.js";
import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const listSignalsAgentsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Signals Agents",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Signals Agents",
  },

  description:
    "List all registered signals agents for a brand agent. Shows agent status, endpoints, and registration details. Requires authentication.",

  execute: async (
    args: ListSignalsAgentsParams,
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
      // Validate API key
      const authResult = await client.validateApiKey(apiKey);
      if (!authResult.isValid) {
        return createAuthErrorResponse();
      }

      const signalsAgentService = new SignalsAgentService();
      const agents = await signalsAgentService.listSignalsAgents(
        args.brandAgentId,
      );

      if (agents.length === 0) {
        let summary = `📭 **No Signals Agents Found**\n\n`;
        summary += `**Brand Agent:** ${args.brandAgentId}\n\n`;
        summary += `**Getting Started:**\n`;
        summary += `• Register your first signals agent with \`signals-agent/register\`\n`;
        summary += `• Configure your agent to implement the ADCP protocol\n`;
        summary += `• Start querying agents for signal recommendations\n\n`;

        summary += `**What are Signals Agents?**\n`;
        summary += `Signals agents are external services that can:\n`;
        summary += `• Analyze campaign briefs and provide targeting recommendations\n`;
        summary += `• Create and manage audience segments via our API\n`;
        summary += `• Optimize campaigns based on their algorithms\n`;
        summary += `• Integrate with your existing data and systems\n`;

        return createMCPResponse({
          message: summary,
          success: true,
        });
      }

      let summary = `🤖 **Signals Agents Overview**\n\n`;
      summary += `**Brand Agent:** ${args.brandAgentId}\n`;
      summary += `**Total Agents:** ${agents.length}\n\n`;

      // Group by status
      const activeAgents = agents.filter((a) => a.status === "active");
      const inactiveAgents = agents.filter((a) => a.status !== "active");

      if (activeAgents.length > 0) {
        summary += `## 🟢 Active Agents (${activeAgents.length})\n\n`;

        activeAgents.forEach((agent) => {
          summary += `### ${agent.name}\n`;
          summary += `• **ID:** ${agent.id}\n`;
          summary += `• **Endpoint:** ${agent.endpointUrl}\n`;
          if (agent.description) {
            summary += `• **Description:** ${agent.description}\n`;
          }
          summary += `• **Registered:** ${new Date(agent.registeredAt).toLocaleString()}\n`;
          if (agent.registeredBy) {
            summary += `• **Registered by:** ${agent.registeredBy}\n`;
          }
          summary += `• **Last Updated:** ${new Date(agent.updatedAt).toLocaleString()}\n`;

          if (agent.config && Object.keys(agent.config).length > 0) {
            summary += `• **Configuration:** ${Object.keys(agent.config).length} parameter(s)\n`;
          }
          summary += `\n`;
        });
      }

      if (inactiveAgents.length > 0) {
        summary += `## ⭕ Inactive/Suspended Agents (${inactiveAgents.length})\n\n`;

        inactiveAgents.forEach((agent) => {
          summary += `### ${agent.name}\n`;
          summary += `• **ID:** ${agent.id}\n`;
          summary += `• **Status:** ${agent.status.toUpperCase()}\n`;
          summary += `• **Endpoint:** ${agent.endpointUrl}\n`;
          summary += `• **Registered:** ${new Date(agent.registeredAt).toLocaleString()}\n`;
          summary += `\n`;
        });
      }

      summary += `## 📊 Quick Stats\n\n`;
      summary += `• **Active:** ${activeAgents.length}\n`;
      summary += `• **Inactive:** ${inactiveAgents.filter((a) => a.status === "inactive").length}\n`;
      summary += `• **Suspended:** ${inactiveAgents.filter((a) => a.status === "suspended").length}\n\n`;

      summary += `**Available Actions:**\n`;
      summary += `• Use \`signals-agent/get\` for detailed agent information\n`;
      summary += `• Use \`signals-agent/get-signals\` to query agents for recommendations\n`;
      summary += `• Use \`signals-agent/history\` to view agent activity\n`;
      summary += `• Use \`signals-agent/update\` to modify agent configuration\n`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to list signals agents", error);
    }
  },

  name: "signals-agent/list",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to list signals agents for"),
  }),
});
