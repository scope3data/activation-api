import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  ActivateSignalParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";

import { SignalsAgentService } from "../../services/signals-agent-service.js";
import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const activateSignalTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Signals Agents",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Activate Signal",
  },

  description:
    "Tell a signals agent to activate a recommended signal by creating segments using our API. The agent will handle all signal configuration details. Requires authentication.",

  execute: async (
    args: ActivateSignalParams,
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

      // Get agent details for better error messages
      const agent = await signalsAgentService.getSignalsAgent(args.agentId);
      if (!agent) {
        return createErrorResponse(
          `Signals agent ${args.agentId} not found`,
          null,
        );
      }

      if (agent.status !== "active") {
        return createErrorResponse(
          `Signals agent "${agent.name}" is ${agent.status} and cannot activate signals`,
          null,
        );
      }

      const result = await signalsAgentService.activateSignal(
        args.agentId,
        args.signalId,
      );

      let summary = `✅ Signal Activated Successfully!\n\n`;
      summary += `**Activation Details:**\n`;
      summary += `• **Agent:** ${agent.name}\n`;
      summary += `• **Agent ID:** ${args.agentId}\n`;
      summary += `• **Signal ID:** ${args.signalId}\n`;
      summary += `• **Activation Time:** ${new Date().toLocaleString()}\n\n`;

      summary += `**Created Segments:**\n`;
      if (result.segmentIds && result.segmentIds.length > 1) {
        summary += `• **Primary Segment:** ${result.segmentId}\n`;
        summary += `• **Additional Segments:** ${result.segmentIds.length - 1}\n`;
        summary += `• **Total Segments:** ${result.segmentIds.length}\n`;

        summary += `\n**All Segment IDs:**\n`;
        result.segmentIds.forEach((id, index) => {
          summary += `• ${index + 1}. ${id}\n`;
        });
      } else {
        summary += `• **Segment ID:** ${result.segmentId}\n`;
      }
      summary += `\n`;

      summary += `**🔄 What Happened:**\n`;
      summary += `1. Your request was sent to the signals agent\n`;
      summary += `2. The agent processed the signal activation request\n`;
      summary += `3. The agent used its API credentials to create segment(s)\n`;
      summary += `4. The segment(s) are now managed by the agent\n`;
      summary += `5. All activity has been logged for audit trail\n\n`;

      summary += `**📊 Segment Management:**\n`;
      summary += `• The signals agent now owns and manages these segments\n`;
      summary += `• Only this agent can update or delete these segments\n`;
      summary += `• Segment data will be handled according to agent's configuration\n`;
      summary += `• Use \`signal/list\` to view all segments (including agent-managed)\n\n`;

      summary += `**Next Steps:**\n`;
      summary += `• Use the segment ID(s) in campaign targeting\n`;
      summary += `• Monitor segment performance through campaign analytics\n`;
      summary += `• Use \`signals-agent/history\` to track agent activities\n`;
      summary += `• Query the agent again for additional recommendations\n\n`;

      summary += `**Campaign Integration:**\n`;
      summary += `\`\`\`javascript\n`;
      summary += `// Use the activated segment in a campaign\n`;
      summary += `const campaign = await createCampaign({\n`;
      summary += `  brandAgentId: "${agent.brandAgentId}",\n`;
      summary += `  name: "Campaign with Agent-Optimized Segments",\n`;
      summary += `  prompt: "Target using signals agent recommendations",\n`;
      summary += `  // The segment will be automatically considered for targeting\n`;
      summary += `});\n`;
      summary += `\`\`\`\n\n`;

      summary += `The signal has been successfully activated and is ready for use!`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to activate signal", error);
    }
  },

  name: "signals-agent/activate",
  parameters: z.object({
    agentId: z
      .string()
      .describe("ID of the signals agent to activate the signal with"),
    signalId: z
      .string()
      .describe("Signal ID from the agent's get-signals response to activate"),
  }),
});
