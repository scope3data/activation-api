import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

/**
 * Revise a creative that was rejected or had changes requested by publishers
 * Allows updating specific aspects based on publisher feedback
 */
export const creativeReviseTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "creative-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Revise Creative for Publisher",
  },

  description: 
    "Revise a creative that was rejected or had changes requested by a publisher. Update content, assets, or metadata based on publisher feedback, then automatically re-sync for approval.",

  execute: async (
    args: {
      creativeId: string;
      publisherId: string;
      revisions: {
        htmlSnippet?: string;
        javascriptTag?: string;
        vastTag?: string;
        assetIds?: string[];
        contentCategories?: string[];
        targetAudience?: string;
      };
      revisionNotes?: string;
      autoResync?: boolean;
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
      // First get the creative to check current status
      const creative = await client.getCreative(apiKey, args.creativeId);
      
      if (!creative) {
        return createErrorResponse(
          "Creative not found",
          new Error(`Creative ${args.creativeId} does not exist`)
        );
      }

      // Check if publisher has actually rejected or requested changes
      const publisherApproval = creative.publisherApprovals?.find(
        a => a.publisherId === args.publisherId
      );

      if (!publisherApproval) {
        return createErrorResponse(
          "Creative not synced to this publisher",
          new Error(`Creative ${args.creativeId} has not been synced to publisher ${args.publisherId}`)
        );
      }

      if (publisherApproval.approvalStatus === 'approved' || publisherApproval.approvalStatus === 'auto_approved') {
        return createMCPResponse({ 
          message: `ℹ️ Creative already approved by ${publisherApproval.publisherName}. No revision needed.`, 
          success: true 
        });
      }

      // Apply revisions
      const revisionResult = await client.reviseCreative(apiKey, {
        creativeId: args.creativeId,
        publisherId: args.publisherId,
        revisions: {
          content: {
            htmlSnippet: args.revisions.htmlSnippet,
            javascriptTag: args.revisions.javascriptTag,
            vastTag: args.revisions.vastTag,
            assetIds: args.revisions.assetIds,
          },
          contentCategories: args.revisions.contentCategories,
          targetAudience: args.revisions.targetAudience,
        },
        revisionNotes: args.revisionNotes,
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
      if (args.revisions.assetIds) changes.push(`Assets updated (${args.revisions.assetIds.length} assets)`);
      if (args.revisions.contentCategories) changes.push("Content categories updated");
      if (args.revisions.targetAudience) changes.push("Target audience updated");

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

      if (publisherApproval.requestedChanges && publisherApproval.requestedChanges.length > 0) {
        response += `

**Requested Changes That Were Addressed**:`;
        for (const change of publisherApproval.requestedChanges) {
          response += `
• ${change}`;
        }
      }

      // Auto-resync if requested
      let resyncResult: any = null;
      if (args.autoResync !== false) {
        response += `

---

## 🔄 **Re-Syncing to Publisher**`;

        resyncResult = await client.syncCreativeToPublishers(apiKey, {
          creativeId: args.creativeId,
          publisherIds: [args.publisherId],
          preApproval: false,
        });

        const syncResult = resyncResult[0];
        
        if (syncResult.syncStatus === 'success') {
          response += `
✅ Creative successfully re-synced to ${publisherApproval.publisherName}`;
          
          if (syncResult.approvalStatus === 'auto_approved') {
            response += `
🎉 **Creative Auto-Approved!** Ready for campaign deployment.`;
          } else if (syncResult.approvalStatus === 'pending') {
            response += `
⏳ **Pending Review**: Publisher will review the revised creative
• Estimated review time: ${syncResult.estimatedReviewTime || 'Within 24 hours'}`;
          }
        } else {
          response += `
❌ Re-sync failed: ${syncResult.error || 'Unknown error'}
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

      if (args.autoResync !== false && resyncResult && resyncResult[0].approvalStatus === 'pending') {
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

      return createMCPResponse({ message: response, success: true });

    } catch (error) {
      return createErrorResponse("Failed to revise creative", error);
    }
  },

  name: "creative/revise",

  parameters: z.object({
    creativeId: z.string().describe("ID of the creative to revise"),
    publisherId: z.string().describe("ID of the publisher that rejected or requested changes"),
    
    revisions: z.object({
      // Content updates
      htmlSnippet: z.string().optional().describe("Updated HTML5 creative snippet"),
      javascriptTag: z.string().optional().describe("Updated JavaScript ad tag"),
      vastTag: z.string().optional().describe("Updated VAST XML tag"),
      assetIds: z.array(z.string()).optional().describe("Updated array of asset IDs"),
      
      // Metadata updates
      contentCategories: z.array(z.string()).optional().describe("Updated IAB content categories"),
      targetAudience: z.string().optional().describe("Updated target audience description"),
    }).describe("Specific revisions to make based on publisher feedback"),
    
    revisionNotes: z.string().optional().describe("Notes explaining what was changed and why"),
    autoResync: z.boolean().optional().describe("Automatically re-sync to publisher after revision (default: true)"),
  }),
});