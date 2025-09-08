import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const deleteBrandAgentSyntheticAudienceTool = (
  client: Scope3ApiClient,
) => ({
  annotations: {
    category: "audience-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Delete Brand Agent Synthetic Audience",
  },

  description:
    "Archive (soft delete) a synthetic audience agent. This disables the audience agent and removes its targeting guidance from active campaigns. The agent and its model history are preserved for audit purposes but will no longer inform campaign targeting or audience segmentation. This action affects all campaigns within the brand agent. Requires authentication.",

  execute: async (
    args: { syntheticAudienceId: string },
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
      const result = await client.deleteBrandAgentSyntheticAudience(
        apiKey,
        args.syntheticAudienceId,
      );

      let summary = `✅ **Synthetic Audience Archived Successfully!**\n\n`;
      summary += `**Audience Agent ID:** ${result.id}\n`;
      summary += `**Archived At:** ${new Date(result.archivedAt).toLocaleString()}\n\n`;

      summary += `📋 **What Happened:**\n`;
      summary += `• The synthetic audience agent has been archived (soft deleted)\n`;
      summary += `• All targeting guidance from this agent is now inactive\n`;
      summary += `• The agent no longer informs campaign targeting development\n`;
      summary += `• Historical data and model versions are preserved for audit\n\n`;

      summary += `🔄 **Impact on Campaigns:**\n`;
      summary += `• Existing campaigns will no longer use this audience definition for targeting\n`;
      summary += `• New campaigns will not inherit this audience profile\n`;
      summary += `• Campaign targeting may revert to other active audiences or defaults\n`;
      summary += `• Campaign targeting and segmentation strategies may be affected\n\n`;

      summary += `🎯 **Audience Applications No Longer Active:**\n`;
      summary += `• **Campaign Targeting:** Audience definition no longer guides campaign targeting\n`;
      summary += `• **Campaign Strategy:** Audience profile no longer informs campaign development\n`;
      summary += `• **Creative Direction:** Audience insights no longer influence content creation\n`;
      summary += `• **Market Segmentation:** Audience profile no longer shapes targeting strategy\n\n`;

      summary += `⚠️  **Important Notes:**\n`;
      summary += `• This is a soft delete - data is preserved for compliance\n`;
      summary += `• The agent can potentially be restored by support if needed\n`;
      summary += `• Consider creating replacement synthetic audiences before archiving\n`;
      summary += `• Review campaign performance after archiving the audience\n\n`;

      summary += `🔧 **Next Steps:**\n`;
      summary += `• Use \`list_brand_agent_synthetic_audiences\` to verify the archive\n`;
      summary += `• Consider creating new synthetic audiences to fill targeting gaps\n`;
      summary += `• Monitor campaign metrics for any targeting changes\n`;
      summary += `• Update other synthetic audiences to provide comprehensive coverage\n\n`;

      summary += `💡 **Recovery:** If you need to restore similar functionality, use \`create_brand_agent_synthetic_audience\` with the same or updated audience definition.`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse(
        "Failed to archive brand synthetic audience",
        error,
      );
    }
  },

  name: "delete_brand_agent_synthetic_audience",
  parameters: z.object({
    syntheticAudienceId: z
      .string()
      .describe("ID of the synthetic audience agent to archive"),
  }),
});
