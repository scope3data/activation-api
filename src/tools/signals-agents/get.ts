import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  GetSignalsAgentParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";

import { SignalsAgentService } from "../../services/signals-agent-service.js";
import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const getSignalsAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Signals Agents",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Get Signals Agent",
  },

  description:
    "Get detailed information about a specific signals agent including configuration, status, and metadata. Requires authentication.",

  execute: async (
    args: GetSignalsAgentParams,
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
      const agent = await signalsAgentService.getSignalsAgent(args.agentId);

      if (!agent) {
        return createErrorResponse(
          `Signals agent ${args.agentId} not found`,
          null,
        );
      }

      let summary = `🤖 **Signals Agent Details**\n\n`;
      summary += `**Basic Information:**\n`;
      summary += `• **ID:** ${agent.id}\n`;
      summary += `• **Name:** ${agent.name}\n`;
      summary += `• **Status:** ${agent.status.toUpperCase()}\n`;
      summary += `• **Brand Agent:** ${agent.brandAgentId}\n`;

      if (agent.description) {
        summary += `• **Description:** ${agent.description}\n`;
      }
      summary += `\n`;

      summary += `**Technical Configuration:**\n`;
      summary += `• **Endpoint URL:** ${agent.endpointUrl}\n`;
      summary += `• **Protocol:** ADCP (Advertising Data Control Protocol)\n`;
      summary += `• **Registered:** ${new Date(agent.registeredAt).toLocaleString()}\n`;
      summary += `• **Last Updated:** ${new Date(agent.updatedAt).toLocaleString()}\n`;

      if (agent.registeredBy) {
        summary += `• **Registered by:** ${agent.registeredBy}\n`;
      }
      summary += `\n`;

      if (agent.config && Object.keys(agent.config).length > 0) {
        summary += `**Configuration Parameters:**\n`;
        Object.entries(agent.config).forEach(([key, value]) => {
          summary += `• **${key}:** ${JSON.stringify(value)}\n`;
        });
        summary += `\n`;
      }

      summary += `**Status Details:**\n`;
      switch (agent.status) {
        case "active":
          summary += `• ✅ Agent is active and ready to process requests\n`;
          summary += `• Can receive get-signals and activate-signal requests\n`;
          summary += `• Authorized to manage segments via API\n`;
          break;
        case "inactive":
          summary += `• ⭕ Agent is inactive and will not process requests\n`;
          summary += `• Cannot create or manage segments\n`;
          summary += `• May be temporarily disabled\n`;
          break;
        case "suspended":
          summary += `• ⛔ Agent is suspended due to errors or policy violations\n`;
          summary += `• All API access has been revoked\n`;
          summary += `• Manual review required for reactivation\n`;
          break;
      }
      summary += `\n`;

      summary += `**Available Actions:**\n`;
      if (agent.status === "active") {
        summary += `• \`signals-agent/get-signals\` - Query this agent for recommendations\n`;
        summary += `• \`signals-agent/activate\` - Tell this agent to create segments\n`;
      }
      summary += `• \`signals-agent/history\` - View this agent's activity log\n`;
      summary += `• \`signals-agent/update\` - Modify agent configuration\n`;
      summary += `• \`signals-agent/unregister\` - Remove agent registration\n\n`;

      summary += `**Integration Information:**\n`;
      summary += `• **ADCP Endpoint:** \`POST ${agent.endpointUrl}\`\n`;
      summary += `• **Expected Request Format:**\n`;
      summary += `  \`\`\`json\n`;
      summary += `  {\n`;
      summary += `    "action": "get_signals" | "activate_signal",\n`;
      summary += `    "data": { ... },\n`;
      summary += `    "requestId": "uuid",\n`;
      summary += `    "timestamp": "2024-01-01T00:00:00Z"\n`;
      summary += `  }\n`;
      summary += `  \`\`\`\n`;
      summary += `• **Expected Response Format:**\n`;
      summary += `  \`\`\`json\n`;
      summary += `  {\n`;
      summary += `    "status": "success" | "error",\n`;
      summary += `    "data": { ... },\n`;
      summary += `    "requestId": "uuid",\n`;
      summary += `    "timestamp": "2024-01-01T00:00:00Z"\n`;
      summary += `  }\n`;
      summary += `  \`\`\`\n\n`;

      if (agent.status === "active") {
        summary += `**Quick Test:**\n`;
        summary += `\`\`\`bash\n`;
        summary += `# Query this agent for signals\n`;
        summary += `signals-agent/get-signals ${agent.brandAgentId} --agent-ids ${agent.id} --brief "Test brief"\n`;
        summary += `\`\`\``;
      }

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to get signals agent", error);
    }
  },

  name: "signals_agent_get",
  parameters: z.object({
    agentId: z.string().describe("ID of the signals agent to retrieve"),
  }),
});
