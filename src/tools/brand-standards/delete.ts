import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const deleteBrandAgentStandardsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "brand-safety",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Delete Brand Agent Standards",
  },

  description:
    "Archive (soft delete) a brand standards agent. This disables the standards agent and removes its safety rules from active campaigns. The agent and its model history are preserved for audit purposes but will no longer be applied to content classification. This action affects all campaigns within the brand agent. Requires authentication.",

  execute: async (
    args: { standardsId: string },
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
      const result = await client.deleteBrandAgentStandards(
        apiKey,
        args.standardsId,
      );

      let summary = `✅ **Brand Standards Agent Archived Successfully!**\n\n`;
      summary += `**Standards Agent ID:** ${result.id}\n`;
      summary += `**Archived At:** ${new Date(result.archivedAt).toLocaleString()}\n\n`;

      summary += `📋 **What Happened:**\n`;
      summary += `• The brand standards agent has been archived (soft deleted)\n`;
      summary += `• All safety rules from this agent are now inactive\n`;
      summary += `• The agent no longer applies to campaign content classification\n`;
      summary += `• Historical data and model versions are preserved for audit\n\n`;

      summary += `🔄 **Impact on Campaigns:**\n`;
      summary += `• Existing campaigns will no longer use these safety standards\n`;
      summary += `• New campaigns will not inherit these rules\n`;
      summary += `• Content classification will revert to other active standards or defaults\n`;
      summary += `• Campaign targeting and delivery may be affected\n\n`;

      summary += `⚠️  **Important Notes:**\n`;
      summary += `• This is a soft delete - data is preserved for compliance\n`;
      summary += `• The agent can potentially be restored by support if needed\n`;
      summary += `• Consider creating replacement standards before archiving\n`;
      summary += `• Review campaign performance after archiving standards\n\n`;

      summary += `🔧 **Next Steps:**\n`;
      summary += `• Use \`list_brand_agent_standards\` to verify the archive\n`;
      summary += `• Consider creating new standards agents if needed\n`;
      summary += `• Monitor campaign metrics for any classification changes\n`;
      summary += `• Update other standards agents to cover the gap if necessary\n\n`;

      summary += `💡 **Recovery:** If you need to restore similar functionality, use \`create_brand_agent_standards\` with the same or updated safety prompt.`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        "Failed to archive brand standards agent",
        error,
      );
    }
  },

  name: "brand-standards/delete",
  parameters: z.object({
    standardsId: z
      .string()
      .describe("ID of the brand standards agent to archive"),
  }),
});
