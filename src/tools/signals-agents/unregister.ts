import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  MCPToolExecuteContext,
  UnregisterSignalsAgentParams,
} from "../../types/mcp.js";

import { SignalsAgentService } from "../../services/signals-agent-service.js";
import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const unregisterSignalsAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Signals Agents",
    dangerLevel: "high",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Unregister Signals Agent",
  },

  description:
    "Unregister a signals agent from your seat. This revokes the agent's API access and sets its status to inactive. The agent will no longer be able to manage segments. Requires authentication.",

  execute: async (
    args: UnregisterSignalsAgentParams,
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

      // Get agent details before unregistering for better reporting
      const agent = await signalsAgentService.getSignalsAgent(args.agentId);
      if (!agent) {
        return createErrorResponse(
          `Signals agent ${args.agentId} not found`,
          null,
        );
      }

      await signalsAgentService.unregisterSignalsAgent(args.agentId);

      let summary = `✅ Signals Agent Unregistered Successfully!\n\n`;
      summary += `**Unregistered Agent:**\n`;
      summary += `• **Name:** ${agent.name}\n`;
      summary += `• **ID:** ${args.agentId}\n`;
      summary += `• **Brand Agent:** ${agent.brandAgentId}\n`;
      summary += `• **Previous Status:** ${agent.status}\n`;
      summary += `• **Unregistered:** ${new Date().toLocaleString()}\n\n`;

      summary += `**🔒 Access Revoked:**\n`;
      summary += `This signals agent no longer has:\n`;
      summary += `• Permission to create new segments\n`;
      summary += `• Permission to update existing segments\n`;
      summary += `• Permission to delete segments it created\n`;
      summary += `• API access to your account\n\n`;

      summary += `**📂 Existing Segments:**\n`;
      summary += `• Segments previously created by this agent remain in your account\n`;
      summary += `• These segments are no longer managed by the agent\n`;
      summary += `• You can view them with \`signal/list\`\n`;
      summary += `• You can manually manage them via standard signal tools\n\n`;

      summary += `**📋 Activity History:**\n`;
      summary += `• All activity history has been preserved\n`;
      summary += `• Use \`signals-agent/history ${args.agentId}\` to view past interactions\n`;
      summary += `• Audit trail remains available for compliance\n\n`;

      summary += `**⚠️ Important Notes:**\n`;
      summary += `• The agent service will receive HTTP errors when attempting API calls\n`;
      summary += `• Any ongoing operations by the agent will be denied\n`;
      summary += `• Re-registration requires using \`signals-agent/register\` again\n`;
      summary += `• The agent ID will remain the same if re-registered\n\n`;

      summary += `**Next Steps:**\n`;
      summary += `• Review segments created by this agent: \`signal/list\`\n`;
      summary += `• Update campaigns that may have used agent-created segments\n`;
      summary += `• Inform the agent operator about the deregistration\n`;
      summary += `• Consider registering alternative agents if needed\n\n`;

      summary += `**Re-registration:**\n`;
      summary += `If you need this agent again:\n`;
      summary += `\`\`\`bash\n`;
      summary += `signals-agent/register ${agent.brandAgentId} "${agent.name}" ${agent.endpointUrl}\n`;
      summary += `\`\`\`\n\n`;

      summary += `The signals agent has been successfully unregistered and access has been revoked.`;

      return createMCPResponse({
        message: summary,
        success: true,
        data: {
          unregisteredAgent: agent,
          configuration: {
            agentId: args.agentId,
            unregistrationTime: new Date().toISOString()
          },
          revokedAccess: {
            segmentCreation: false,
            segmentUpdates: false,
            segmentDeletion: false,
            apiAccess: false
          },
          preservation: {
            existingSegmentsPreserved: true,
            activityHistoryPreserved: true,
            auditTrailAvailable: true
          },
          metadata: {
            agentId: args.agentId,
            agentName: agent.name,
            brandAgentId: agent.brandAgentId,
            previousStatus: agent.status,
            action: "unregister",
            status: "revoked",
            reregistrationPossible: true
          }
        }
      });
    } catch (error) {
      return createErrorResponse("Failed to unregister signals agent", error);
    }
  },

  name: "signals-agent/unregister",
  parameters: z.object({
    agentId: z.string().describe("ID of the signals agent to unregister"),
  }),
});
