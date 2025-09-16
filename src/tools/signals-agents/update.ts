import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  MCPToolExecuteContext,
  UpdateSignalsAgentParams,
} from "../../types/mcp.js";

import { SignalsAgentService } from "../../services/signals-agent-service.js";
import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const updateSignalsAgentTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Signals Agents",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Update Signals Agent",
  },

  description:
    "Update configuration and settings for a registered signals agent. Can modify name, description, endpoint, status, and configuration parameters. Requires authentication.",

  execute: async (
    args: UpdateSignalsAgentParams,
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

      // Get current agent state for comparison
      const currentAgent = await signalsAgentService.getSignalsAgent(
        args.agentId,
      );
      if (!currentAgent) {
        return createErrorResponse(
          `Signals agent ${args.agentId} not found`,
          null,
        );
      }

      const updatedAgent = await signalsAgentService.updateSignalsAgent(
        args.agentId,
        {
          config: args.config,
          description: args.description,
          endpointUrl: args.endpointUrl,
          name: args.name,
          status: args.status,
        },
      );

      let summary = `✅ Signals Agent Updated Successfully!\n\n`;
      summary += `**Agent:** ${updatedAgent.name}\n`;
      summary += `**Agent ID:** ${args.agentId}\n`;
      summary += `**Updated:** ${new Date().toLocaleString()}\n\n`;

      // Show what changed
      const changes: string[] = [];

      if (args.name && args.name !== currentAgent.name) {
        changes.push(`**Name:** "${currentAgent.name}" → "${args.name}"`);
      }

      if (
        args.description !== undefined &&
        args.description !== currentAgent.description
      ) {
        const oldDesc = currentAgent.description || "(none)";
        const newDesc = args.description || "(none)";
        changes.push(`**Description:** "${oldDesc}" → "${newDesc}"`);
      }

      if (args.endpointUrl && args.endpointUrl !== currentAgent.endpointUrl) {
        changes.push(
          `**Endpoint:** "${currentAgent.endpointUrl}" → "${args.endpointUrl}"`,
        );
      }

      if (args.status && args.status !== currentAgent.status) {
        changes.push(`**Status:** ${currentAgent.status} → ${args.status}`);
      }

      if (args.config) {
        changes.push(
          `**Configuration:** Updated with ${Object.keys(args.config).length} parameter(s)`,
        );
      }

      if (changes.length > 0) {
        summary += `**Changes Made:**\n`;
        changes.forEach((change) => {
          summary += `• ${change}\n`;
        });
        summary += `\n`;
      } else {
        summary += `**No Changes:** All provided values were the same as existing values.\n\n`;
      }

      summary += `**Current Configuration:**\n`;
      summary += `• **Name:** ${updatedAgent.name}\n`;
      summary += `• **Status:** ${updatedAgent.status.toUpperCase()}\n`;
      summary += `• **Endpoint:** ${updatedAgent.endpointUrl}\n`;
      summary += `• **Brand Agent:** ${updatedAgent.brandAgentId}\n`;

      if (updatedAgent.description) {
        summary += `• **Description:** ${updatedAgent.description}\n`;
      }

      if (updatedAgent.config && Object.keys(updatedAgent.config).length > 0) {
        summary += `• **Config Parameters:** ${Object.keys(updatedAgent.config).length}\n`;
      }
      summary += `\n`;

      // Status-specific information
      if (args.status) {
        summary += `**Status Impact:**\n`;
        switch (args.status) {
          case "active":
            summary += `• ✅ Agent is now active and can process requests\n`;
            summary += `• Can receive get-signals and activate-signal requests\n`;
            summary += `• Authorized to manage segments via API\n`;
            break;
          case "inactive":
            summary += `• ⭕ Agent is now inactive and will not process requests\n`;
            summary += `• Cannot create or manage segments\n`;
            summary += `• Existing segments remain unaffected\n`;
            break;
          case "suspended":
            summary += `• ⛔ Agent is now suspended\n`;
            summary += `• All API access has been revoked\n`;
            summary += `• Cannot process any requests\n`;
            break;
        }
        summary += `\n`;
      }

      if (args.endpointUrl) {
        summary += `**⚠️ Endpoint Change:**\n`;
        summary += `• Make sure your agent service is running at the new endpoint\n`;
        summary += `• Test connectivity with \`signals-agent/get-signals\`\n`;
        summary += `• Update any monitoring or alerting for the new URL\n\n`;
      }

      summary += `**Verification:**\n`;
      summary += `• Use \`signals-agent/get\` to verify all changes\n`;
      if (updatedAgent.status === "active") {
        summary += `• Use \`signals-agent/get-signals\` to test agent connectivity\n`;
      }
      summary += `• Use \`signals-agent/history\` to monitor agent activity\n\n`;

      if (updatedAgent.config && Object.keys(updatedAgent.config).length > 0) {
        summary += `**Configuration Details:**\n`;
        Object.entries(updatedAgent.config).forEach(([key, value]) => {
          summary += `• **${key}:** ${JSON.stringify(value)}\n`;
        });
        summary += `\n`;
      }

      summary += `The signals agent configuration has been successfully updated!`;

      return createMCPResponse({
        data: {
          changesSummary: {
            changes: changes,
            changesCount: changes.length,
            hasConfigUpdates: !!args.config,
            hasEndpointChange:
              !!args.endpointUrl &&
              args.endpointUrl !== currentAgent.endpointUrl,
            hasStatusChange:
              !!args.status && args.status !== currentAgent.status,
          },
          configuration: {
            agentId: args.agentId,
            updates: {
              config: args.config,
              description: args.description,
              endpointUrl: args.endpointUrl,
              name: args.name,
              status: args.status,
            },
            updateTime: new Date().toISOString(),
          },
          currentState: {
            brandAgentId: updatedAgent.brandAgentId,
            config: updatedAgent.config,
            description: updatedAgent.description,
            endpointUrl: updatedAgent.endpointUrl,
            name: updatedAgent.name,
            status: updatedAgent.status,
          },
          metadata: {
            action: "update",
            agentId: args.agentId,
            agentName: updatedAgent.name,
            brandAgentId: updatedAgent.brandAgentId,
            isOperational: updatedAgent.status === "active",
            requiresConnectivityTest: !!args.endpointUrl,
            status: updatedAgent.status,
          },
          previousAgent: currentAgent,
          updatedAgent,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to update signals agent", error);
    }
  },

  name: "signals-agent/update",
  parameters: z.object({
    agentId: z.string().describe("ID of the signals agent to update"),
    config: z
      .record(z.unknown())
      .optional()
      .describe("Optional configuration parameters to update"),
    description: z
      .string()
      .optional()
      .describe("Optional new description for the agent"),
    endpointUrl: z
      .string()
      .url()
      .optional()
      .describe("Optional new ADCP endpoint URL"),
    name: z.string().optional().describe("Optional new name for the agent"),
    status: z
      .enum(["active", "inactive", "suspended"])
      .optional()
      .describe("Optional new status for the agent"),
  }),
});
