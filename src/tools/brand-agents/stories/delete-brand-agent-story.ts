import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const deleteBrandAgentStoryTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "audience-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Delete Brand Agent Story",
  },

  description:
    "Archive (soft delete) a brand story agent. This disables the story agent and removes its narrative guidance from active campaigns. The agent and its model history are preserved for audit purposes but will no longer inform campaign strategies or audience targeting. This action affects all campaigns within the brand agent. Requires authentication.",

  execute: async (
    args: { storyId: string },
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
      const result = await client.deleteBrandAgentStory(apiKey, args.storyId);

      let summary = `✅ **Brand Story Agent Archived Successfully!**\n\n`;
      summary += `**Story Agent ID:** ${result.id}\n`;
      summary += `**Archived At:** ${new Date(result.archivedAt).toLocaleString()}\n\n`;

      summary += `📋 **What Happened:**\n`;
      summary += `• The brand story agent has been archived (soft deleted)\n`;
      summary += `• All narrative guidance from this agent is now inactive\n`;
      summary += `• The agent no longer informs campaign strategy development\n`;
      summary += `• Historical data and model versions are preserved for audit\n\n`;

      summary += `🔄 **Impact on Campaigns:**\n`;
      summary += `• Existing campaigns will no longer use this brand story for guidance\n`;
      summary += `• New campaigns will not inherit this narrative framework\n`;
      summary += `• Audience targeting may revert to other active stories or defaults\n`;
      summary += `• Campaign messaging and positioning strategies may be affected\n\n`;

      summary += `🎯 **Story Applications No Longer Active:**\n`;
      summary += `• **Campaign Strategy:** Story no longer guides campaign development\n`;
      summary += `• **Audience Targeting:** Narrative no longer informs synthetic audiences\n`;
      summary += `• **Creative Direction:** Story no longer influences content creation\n`;
      summary += `• **Market Positioning:** Narrative no longer shapes brand positioning\n\n`;

      summary += `⚠️  **Important Notes:**\n`;
      summary += `• This is a soft delete - data is preserved for compliance\n`;
      summary += `• The agent can potentially be restored by support if needed\n`;
      summary += `• Consider creating replacement story agents before archiving\n`;
      summary += `• Review campaign performance after archiving the story\n\n`;

      summary += `🔧 **Next Steps:**\n`;
      summary += `• Use \`list_brand_agent_stories\` to verify the archive\n`;
      summary += `• Consider creating new story agents to fill narrative gaps\n`;
      summary += `• Monitor campaign metrics for any strategy changes\n`;
      summary += `• Update other story agents to provide comprehensive coverage\n\n`;

      summary += `💡 **Recovery:** If you need to restore similar functionality, use \`create_brand_agent_story\` with the same or updated brand narrative.`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to archive brand story agent", error);
    }
  },

  name: "delete_brand_agent_story",
  parameters: z.object({
    storyId: z.string().describe("ID of the brand story agent to archive"),
  }),
});
