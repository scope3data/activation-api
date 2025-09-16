import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { PublisherSyncResult } from "../../types/creative.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createMCPResponse } from "../../utils/error-handling.js";

/**
 * Update a creative's content, metadata, or assets
 * Supports both general updates and publisher revision workflows
 */
export const creativeReviseTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Creatives",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Update Creative",
  },

  description:
    "Update a creative's content, assets, or metadata. Can be used for general updates or to address publisher feedback. Optionally re-sync to specified publisher after updates.",

  execute: async (
    args: {
      autoResync?: boolean;
      creativeId: string;
      publisherId: string;
      revisionNotes?: string;
      revisions: {
        assetIds?: string[];
        contentCategories?: string[];
        htmlSnippet?: string;
        javascriptTag?: string;
        targetAudience?: string;
        vastTag?: string;
      };
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check authentication
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      throw new Error(
        "Authentication required. Please set the SCOPE3_API_KEY environment variable or provide via headers.",
      );
    }

    try {
      // First get the creative to check current status
      const creative = await client.getCreative(apiKey, args.creativeId);

      if (!creative) {
        throw new Error(
          `Creative not found: Creative ${args.creativeId} does not exist`,
        );
      }

      // Check if publisher has actually rejected or requested changes
      const publisherApproval = creative.publisherApprovals?.find(
        (a) => a.publisherId === args.publisherId,
      );

      if (!publisherApproval) {
        throw new Error(
          `Creative not synced to this publisher: Creative ${args.creativeId} has not been synced to publisher ${args.publisherId}`,
        );
      }

      if (
        publisherApproval.approvalStatus === "approved" ||
        publisherApproval.approvalStatus === "auto_approved"
      ) {
        return `ℹ️ Creative already approved by ${publisherApproval.publisherName}. No revision needed.`;
      }

      // Apply revisions
      await client.reviseCreative(apiKey, {
        creativeId: args.creativeId,
        publisherId: args.publisherId,
        revisionNotes: args.revisionNotes,
        revisions: {
          content: {
            assetIds: args.revisions.assetIds,
            htmlSnippet: args.revisions.htmlSnippet,
            javascriptTag: args.revisions.javascriptTag,
            vastTag: args.revisions.vastTag,
          },
          contentCategories: args.revisions.contentCategories,
          targetAudience: args.revisions.targetAudience,
        },
      });

      // Create response
      let response = `✏️ **Creative Revision Complete**

🎨 **Creative**: ${creative.creativeName} (${args.creativeId})
🏢 **Publisher**: ${publisherApproval.publisherName}
📝 **Previous Status**: ${publisherApproval.approvalStatus}

---

## 📋 **Revision Summary**`;

      // Show what was changed
      const changes: string[] = [];
      if (args.revisions.htmlSnippet) changes.push("HTML snippet updated");
      if (args.revisions.javascriptTag) changes.push("JavaScript tag updated");
      if (args.revisions.vastTag) changes.push("VAST tag updated");
      if (args.revisions.assetIds)
        changes.push(
          `Assets updated (${args.revisions.assetIds.length} assets)`,
        );
      if (args.revisions.contentCategories)
        changes.push("Content categories updated");
      if (args.revisions.targetAudience)
        changes.push("Target audience updated");

      for (const change of changes) {
        response += `
• ${change}`;
      }

      if (args.revisionNotes) {
        response += `

**Revision Notes**: ${args.revisionNotes}`;
      }

      // Show previous feedback that was addressed
      if (publisherApproval.rejectionReason) {
        response += `

## 🔍 **Addressed Feedback**
**Previous Rejection Reason**: ${publisherApproval.rejectionReason}`;
      }

      if (
        publisherApproval.requestedChanges &&
        publisherApproval.requestedChanges.length > 0
      ) {
        response += `

**Requested Changes That Were Addressed**:`;
        for (const change of publisherApproval.requestedChanges) {
          response += `
• ${change}`;
        }
      }

      // Auto-resync if requested
      let resyncResults: null | PublisherSyncResult[] = null;
      if (args.autoResync !== false) {
        response += `

---

## 🔄 **Re-Syncing to Publisher**`;

        resyncResults = await client.syncCreativeToPublishers(apiKey, {
          creativeId: args.creativeId,
          preApproval: false,
          publisherIds: [args.publisherId],
        });

        const syncResult = resyncResults[0];

        if (syncResult.syncStatus === "success") {
          response += `
✅ Creative successfully re-synced to ${publisherApproval.publisherName}`;

          if (syncResult.approvalStatus === "auto_approved") {
            response += `
🎉 **Creative Auto-Approved!** Ready for campaign deployment.`;
          } else if (syncResult.approvalStatus === "pending") {
            response += `
⏳ **Pending Review**: Publisher will review the revised creative
• Estimated review time: ${syncResult.estimatedReviewTime || "Within 24 hours"}`;
          }
        } else {
          response += `
❌ Re-sync failed: ${syncResult.error || "Unknown error"}
• **Action Required**: Manually sync using creative/sync_publishers`;
        }
      } else {
        response += `

---

## ⚠️ **Manual Sync Required**
Creative revised but not re-synced. Use creative/sync_publishers to submit revised creative for approval.`;
      }

      response += `

---

## 💡 **Next Steps**`;

      if (
        args.autoResync !== false &&
        resyncResults &&
        resyncResults.length > 0 &&
        resyncResults[0].approvalStatus === "pending"
      ) {
        response += `
1. Wait for publisher review (typically 24 hours)
2. Check status with creative/approval_status
3. If approved, creative will be ready for campaigns
4. If rejected again, review feedback and revise accordingly`;
      } else if (args.autoResync === false) {
        response += `
1. Review your changes
2. Run creative/sync_publishers to submit for approval
3. Monitor approval status with creative/approval_status`;
      }

      return createMCPResponse({
        data: {
          configuration: {
            autoResync: args.autoResync !== false,
            creativeId: args.creativeId,
            publisherId: args.publisherId,
            revisionDate: new Date().toISOString(),
            revisionNotes: args.revisionNotes,
            revisions: args.revisions,
          },
          creative,
          metadata: {
            action: "revise",
            creativeType: "creative",
            publisherName: publisherApproval.publisherName,
            requiresFollowUp:
              args.autoResync === false ||
              (resyncResults &&
                resyncResults.length > 0 &&
                resyncResults[0].approvalStatus === "pending"),
            wasAlreadyApproved: false, // TODO: Fix approval status type check
          },
          publisherApproval,
          resyncResults: resyncResults
            ? {
                attempted: args.autoResync !== false,
                newApprovalStatus:
                  resyncResults.length > 0
                    ? resyncResults[0].approvalStatus
                    : null,
                results: resyncResults,
                successful:
                  resyncResults.length > 0 &&
                  resyncResults[0].syncStatus === "success",
              }
            : {
                attempted: false,
                manualSyncRequired: true,
              },
          revisionSummary: {
            changes,
            previousStatus: publisherApproval.approvalStatus,
            rejectionReason: publisherApproval.rejectionReason,
            requestedChanges: publisherApproval.requestedChanges || [],
          },
        },
        message: response,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to revise creative: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "creative/revise",

  parameters: z.object({
    autoResync: z
      .boolean()
      .optional()
      .describe(
        "Automatically re-sync to publisher after revision (default: true)",
      ),
    creativeId: z.string().describe("ID of the creative to revise"),

    publisherId: z
      .string()
      .describe("ID of the publisher that rejected or requested changes"),

    revisionNotes: z
      .string()
      .optional()
      .describe("Notes explaining what was changed and why"),
    revisions: z
      .object({
        assetIds: z
          .array(z.string())
          .optional()
          .describe("Updated array of asset IDs"),
        // Metadata updates
        contentCategories: z
          .array(z.string())
          .optional()
          .describe("Updated IAB content categories"),
        // Content updates
        htmlSnippet: z
          .string()
          .optional()
          .describe("Updated HTML5 creative snippet"),
        javascriptTag: z
          .string()
          .optional()
          .describe("Updated JavaScript ad tag"),

        targetAudience: z
          .string()
          .optional()
          .describe("Updated target audience description"),
        vastTag: z.string().optional().describe("Updated VAST XML tag"),
      })
      .describe("Specific revisions to make based on publisher feedback"),
  }),
});
