import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { requireSessionAuth } from "../../utils/auth.js";

export const deleteBrandAgentBrandStoryTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Brand Stories",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Delete Brand Agent Brand Story",
  },

  description:
    "Archive (soft delete) a brand story. This disables the brand story and removes its targeting guidance from active campaigns. The brand story and its model history are preserved for audit purposes but will no longer inform campaign targeting or audience segmentation. This action affects all campaigns within the brand agent. Requires authentication.",

  execute: async (
    args: { brandStoryId: string },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Universal session authentication check
    const { apiKey, customerId: _customerId } = requireSessionAuth(context);

    try {
      const result = await client.deleteBrandAgentSyntheticAudience(
        apiKey,
        args.brandStoryId,
      );

      let summary = `✅ **Brand Story Archived Successfully!**\n\n`;
      summary += `**Brand Story ID:** ${result.id}\n`;
      summary += `**Archived At:** ${new Date(result.archivedAt).toLocaleString()}\n\n`;

      summary += `📋 **What Happened:**\n`;
      summary += `• The brand story has been archived (soft deleted)\n`;
      summary += `• All targeting guidance from this brand story is now inactive\n`;
      summary += `• The brand story no longer informs campaign targeting development\n`;
      summary += `• Historical data and model versions are preserved for audit\n\n`;

      summary += `🔄 **Impact on Campaigns:**\n`;
      summary += `• Existing campaigns will no longer use this brand story for targeting\n`;
      summary += `• New campaigns will not inherit this brand story profile\n`;
      summary += `• Campaign targeting may revert to other active brand stories or defaults\n`;
      summary += `• Campaign targeting and segmentation strategies may be affected\n\n`;

      summary += `🎯 **Brand Story Applications No Longer Active:**\n`;
      summary += `• **Campaign Targeting:** Brand story definition no longer guides campaign targeting\n`;
      summary += `• **Campaign Strategy:** Brand story profile no longer informs campaign development\n`;
      summary += `• **Creative Direction:** Brand story insights no longer influence content creation\n`;
      summary += `• **Market Segmentation:** Brand story profile no longer shapes targeting strategy\n\n`;

      summary += `⚠️  **Important Notes:**\n`;
      summary += `• This is a soft delete - data is preserved for compliance\n`;
      summary += `• The brand story can potentially be restored by support if needed\n`;
      summary += `• Consider creating replacement brand stories before archiving\n`;
      summary += `• Review campaign performance after archiving the brand story\n\n`;

      summary += `🔧 **Next Steps:**\n`;
      summary += `• Use \`list_brand_agent_brand_stories\` to verify the archive\n`;
      summary += `• Consider creating new brand stories to fill targeting gaps\n`;
      summary += `• Monitor campaign metrics for any targeting changes\n`;
      summary += `• Update other brand stories to provide comprehensive coverage\n\n`;

      summary += `💡 **Recovery:** If you need to restore similar functionality, use \`create_brand_agent_brand_story\` with the same or updated brand story definition.`;

      return summary;
    } catch (error) {
      throw new Error(
        `Failed to archive brand story: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "brand_story_delete",
  parameters: z.object({
    brandStoryId: z.string().describe("ID of the brand story to archive"),
  }),
});
