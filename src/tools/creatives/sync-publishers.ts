import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

/**
 * Sync creative to publishers for pre-approval or campaign deployment
 * Handles the publisher approval workflow
 */
export const creativeSyncPublishersTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "creative-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Sync Creative to Publishers",
  },

  description:
    "Sync a creative to one or more publishers for approval. Can be used for pre-approval before campaign launch or when inventory is selected. Publishers may auto-approve standard formats or require manual review.",

  execute: async (
    args: {
      campaignId?: string;
      creativeId: string;
      preApproval?: boolean;
      publisherIds: string[];
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check authentication
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      return createAuthErrorResponse();
    }

    try {
      // Sync creative to publishers
      const syncResults = await client.syncCreativeToPublishers(apiKey, {
        campaignId: args.campaignId,
        creativeId: args.creativeId,
        preApproval: args.preApproval || false,
        publisherIds: args.publisherIds,
      });

      // Create human-readable response
      let response = `🔄 **Creative Publisher Sync Results**

📦 **Creative ID**: ${args.creativeId}
${args.campaignId ? `🎯 **Campaign**: ${args.campaignId}` : ""}
${args.preApproval ? "✅ **Pre-Approval Request**" : ""}

📊 **Sync Summary**
• Publishers Targeted: ${args.publisherIds.length}
• Successfully Synced: ${syncResults.filter((r) => r.syncStatus === "success").length}
• Failed: ${syncResults.filter((r) => r.syncStatus === "failed").length}
• Pending: ${syncResults.filter((r) => r.syncStatus === "pending").length}

---

## 🏢 **Publisher Status**`;

      // Group by status
      const autoApproved = syncResults.filter(
        (r) => r.approvalStatus === "auto_approved",
      );
      const pendingReview = syncResults.filter(
        (r) => r.approvalStatus === "pending",
      );
      const failed = syncResults.filter((r) => r.syncStatus === "failed");

      if (autoApproved.length > 0) {
        response += `

✅ **Auto-Approved** (${autoApproved.length})`;
        for (const result of autoApproved) {
          response += `
• **${result.publisherName}**: Creative automatically approved for standard format`;
        }
      }

      if (pendingReview.length > 0) {
        response += `

⏳ **Pending Review** (${pendingReview.length})`;
        for (const result of pendingReview) {
          response += `
• **${result.publisherName}**: Manual review required
  - Estimated review time: ${result.estimatedReviewTime || "Within 24 hours"}`;
        }
      }

      if (failed.length > 0) {
        response += `

❌ **Sync Failed** (${failed.length})`;
        for (const result of failed) {
          response += `
• **${result.publisherName}**: ${result.error || "Sync failed"}`;
        }
      }

      response += `

---

## 💡 **Next Steps**`;

      if (pendingReview.length > 0) {
        response += `

**For Pending Reviews:**
1. Publishers will review the creative based on their policies
2. You'll receive approval notifications (check with creative/approval_status)
3. If rejected, use creative/revise to address feedback
4. Re-sync after making requested changes`;
      }

      if (autoApproved.length > 0) {
        response += `

**For Auto-Approved Creatives:**
• Ready for immediate campaign deployment
• No further action required`;
      }

      if (failed.length > 0) {
        response += `

**For Failed Syncs:**
• Check creative format compatibility with publisher
• Verify all required assets are valid
• Ensure creative meets publisher specifications`;
      }

      return createMCPResponse({ message: response, success: true });
    } catch (error) {
      return createErrorResponse(
        "Failed to sync creative to publishers",
        error,
      );
    }
  },

  name: "creative/sync_publishers",

  parameters: z.object({
    campaignId: z
      .string()
      .optional()
      .describe("Campaign ID if syncing for specific campaign"),
    creativeId: z.string().describe("ID of the creative to sync"),
    preApproval: z
      .boolean()
      .optional()
      .describe("Request pre-approval before campaign launch (default: false)"),
    publisherIds: z
      .array(z.string())
      .describe("Array of publisher IDs to sync to"),
  }),
});
