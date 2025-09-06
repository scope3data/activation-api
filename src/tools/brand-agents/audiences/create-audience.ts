import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  CreateSyntheticAudienceParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const createSyntheticAudienceTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "audience-management",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Synthetic Audience",
  },

  description:
    "Create a new synthetic audience for a brand agent. Synthetic audiences represent target customer or prospect profiles that can be used across multiple campaigns within the same brand agent. Currently supports basic name and description (stub implementation). Requires authentication.",

  execute: async (
    args: CreateSyntheticAudienceParams,
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
      // First, verify the brand agent exists
      let brandAgentName: string;
      try {
        const brandAgent = await client.getBrandAgent(apiKey, args.brandAgentId);
        brandAgentName = brandAgent.name;
      } catch (fetchError) {
        return createErrorResponse(
          "Brand agent not found. Please check the brand agent ID.",
          fetchError,
        );
      }

      const audienceInput = {
        brandAgentId: args.brandAgentId,
        name: args.name,
        description: args.description,
      };

      const audience = await client.createSyntheticAudience(apiKey, audienceInput);

      let summary = `✅ Synthetic Audience Created Successfully!\n\n`;
      summary += `**Audience Details:**\n`;
      summary += `• **Name:** ${audience.name}\n`;
      summary += `• **ID:** ${audience.id}\n`;
      summary += `• **Brand Agent:** ${brandAgentName} (${audience.brandAgentId})\n`;
      if (audience.description) {
        summary += `• **Description:** ${audience.description}\n`;
      }
      summary += `• **Created:** ${new Date(audience.createdAt).toLocaleString()}\n\n`;
      
      summary += `🎯 **What are Synthetic Audiences?**\n`;
      summary += `Synthetic audiences are AI-generated profiles that represent your ideal customers or prospects. They help you:\n`;
      summary += `• Target campaigns more effectively\n`;
      summary += `• Find lookalike audiences across different publishers\n`;
      summary += `• Optimize media buying based on audience behavior patterns\n`;
      summary += `• Evaluate media quality against audience preferences\n\n`;
      
      summary += `**Next Steps:**\n`;
      summary += `• Assign this audience to campaigns within the same brand agent\n`;
      summary += `• Monitor campaign performance with this audience\n`;
      summary += `• Create additional audience variants for different campaign objectives\n`;
      summary += `• Use audience insights to refine targeting strategies\n\n`;
      
      summary += `🚧 **Note:** This is a stub implementation. Advanced audience features including:\n`;
      summary += `• Demographics and psychographic profiling\n`;
      summary += `• Behavioral targeting parameters\n`;
      summary += `• Interest and intent mapping\n`;
      summary += `• Lookalike audience generation\n`;
      summary += `• Cross-publisher audience matching\n`;
      summary += `...will be added in future releases.\n\n`;
      
      summary += `The audience is ready to be assigned to campaigns!`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to create synthetic audience", error);
    }
  },

  name: "create_audience",
  parameters: z.object({
    brandAgentId: z.string().describe("ID of the brand agent that will own this audience"),
    name: z.string().describe("Name of the synthetic audience (e.g., 'Tech Enthusiasts 25-34')"),
    description: z
      .string()
      .optional()
      .describe("Optional description of the audience characteristics and targeting goals"),
  }),
});