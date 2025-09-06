import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  GetAmpAgentsParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";
import type { AgentWhereInput } from "../../types/scope3.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const getAmpAgentsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "data-retrieval",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Get Scope3 AMP Agents",
  },

  description:
    "Get all agents and their models from Scope3 API. Optionally filter by customer ID or agent name. Requires authentication.",

  execute: async (
    args: GetAmpAgentsParams,
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
      // Convert simple parameter format to GraphQL input format
      const whereInput: AgentWhereInput | undefined = args.where
        ? {
            customerId: args.where.customerId
              ? { equals: args.where.customerId }
              : undefined,
            name: args.where.name ? { contains: args.where.name } : undefined,
          }
        : undefined;

      const agents = await client.getAgents(apiKey, whereInput);

      const agentSummary = `Found ${agents.length} agents:\n${agents.map((agent) => `  • ${agent.name} (ID: ${agent.id})`).join("\n")}`;

      return createMCPResponse({
        message: agentSummary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to fetch agents", error);
    }
  },

  name: "get_amp_agents",
  parameters: z.object({
    where: z
      .object({
        customerId: z.number().optional().describe("Filter by customer ID"),
        name: z
          .string()
          .optional()
          .describe("Filter by agent name (partial match)"),
      })
      .optional()
      .describe("Optional filters for agents"),
  }),
});
