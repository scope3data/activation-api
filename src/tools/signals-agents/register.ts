import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  MCPToolExecuteContext,
  RegisterSignalsAgentParams,
} from "../../types/mcp.js";

import { SignalsAgentService } from "../../services/signals-agent-service.js";
import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const registerSignalsAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Signals Agents",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Register Signals Agent",
  },

  description:
    "Register a new signals agent to your seat. The agent will receive permissions to manage segments in your account using our API. Supports ADCP (Advertising Data Control Protocol) compliant agents. Requires authentication.",

  execute: async (
    args: RegisterSignalsAgentParams,
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

      const signalsAgentService = new SignalsAgentService();
      const agent = await signalsAgentService.registerSignalsAgent(
        {
          brandAgentId: args.brandAgentId,
          config: args.config,
          description: args.description,
          endpointUrl: args.endpointUrl,
          name: args.name,
          registeredBy: authResult.customerId.toString(),
        },
        authResult.customerId,
      );

      let summary = `✅ Signals Agent Registered Successfully!\n\n`;
      summary += `**Agent Details:**\n`;
      summary += `• **ID:** ${agent.id}\n`;
      summary += `• **Name:** ${agent.name}\n`;
      summary += `• **Endpoint:** ${agent.endpointUrl}\n`;
      if (agent.description) {
        summary += `• **Description:** ${agent.description}\n`;
      }
      summary += `• **Brand Agent:** ${agent.brandAgentId}\n`;
      summary += `• **Status:** ${agent.status}\n`;
      summary += `• **Registered:** ${new Date(agent.registeredAt).toLocaleString()}\n\n`;

      summary += `**🔑 Agent Permissions:**\n`;
      summary += `This agent is now authorized to:\n`;
      summary += `• Create new segments using our API\n`;
      summary += `• Update segments it has created\n`;
      summary += `• Delete segments it manages\n`;
      summary += `• View segments it has access to\n\n`;

      summary += `**📡 ADCP Protocol:**\n`;
      summary += `Your agent should implement the Advertising Data Control Protocol (ADCP) with these endpoints:\n`;
      summary += `• \`POST ${agent.endpointUrl}\` - Receive get_signals and activate_signal requests\n`;
      summary += `• Response format: \`{"status": "success", "data": {...}, "requestId": "..."}\`\n\n`;

      summary += `**Next Steps:**\n`;
      summary += `• Use \`signals-agent/get-signals\` to query this agent for recommendations\n`;
      summary += `• Use \`signals-agent/activate\` to tell the agent to create segments\n`;
      summary += `• Monitor agent activity with \`signals-agent/history\`\n`;
      summary += `• Configure your agent to call our API endpoints for segment management\n\n`;

      summary += `**Integration Example:**\n`;
      summary += `\`\`\`javascript\n`;
      summary += `// Query agent for signals\n`;
      summary += `const signals = await getSignals("${agent.id}", "Target millennials interested in sustainable fashion");\n\n`;
      summary += `// Activate a recommended signal\n`;
      summary += `const segmentId = await activateSignal("${agent.id}", "recommended_signal_id");\n`;
      summary += `\`\`\`\n\n`;

      summary += `The signals agent is ready to manage segments in your account!`;

      return createMCPResponse({
        data: {
          agent,
          configuration: {
            brandAgentId: args.brandAgentId,
            config: args.config,
            description: args.description,
            endpointUrl: args.endpointUrl,
            name: args.name,
          },
          integration: {
            apiEndpoints: [
              `getSignals("${agent.id}", query)`,
              `activateSignal("${agent.id}", signalId)`,
              `signals-agent/history for monitoring`,
            ],
            exampleUsage: {
              activateSignal: `activateSignal("${agent.id}", "recommended_signal_id")`,
              getSignals: `getSignals("${agent.id}", "Target millennials interested in sustainable fashion")`,
            },
          },
          metadata: {
            agentId: agent.id,
            isReadyForUse: true,
            protocol: "ADCP",
            registrationDate: agent.createdAt,
            status: "active",
          },
          permissions: {
            accountId: authResult.customerId,
            apiAccess: true,
            segmentManagement: true,
          },
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to register signals agent", error);
    }
  },

  name: "signals_agent_register",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent this signals agent will work with"),
    config: z
      .record(z.unknown())
      .optional()
      .describe("Optional configuration parameters for the agent"),
    description: z
      .string()
      .optional()
      .describe("Optional description of what this agent does"),
    endpointUrl: z
      .string()
      .url()
      .describe(
        "ADCP-compliant endpoint URL where the agent receives requests",
      ),
    name: z.string().describe("Human-readable name for the signals agent"),
  }),
});
