import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

/**
 * Check publisher approval status for a creative
 * Shows which publishers have approved, rejected, or are still reviewing
 */
export const creativeApprovalStatusTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "creative-management",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Check Creative Approval Status",
  },

  description: 
    "Check the publisher approval status for a creative. Shows which publishers have approved, rejected, or are still reviewing the creative, along with any feedback or requested changes.",

  execute: async (
    args: {
      creativeId: string;
      publisherId?: string;
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
      // Get creative with approval status
      const creative = await client.getCreative(apiKey, args.creativeId);

      if (!creative) {
        return createErrorResponse(
          "Creative not found",
          new Error(`Creative ${args.creativeId} does not exist`)
        );
      }

      // Check asset validation first
      let response = `📋 **Creative Approval Status**

🎨 **Creative**: ${creative.creativeName} (${creative.creativeId})
📊 **Overall Status**: ${creative.status}

---

## 🔍 **Asset Validation**`;

      if (creative.assetValidation) {
        if (creative.assetValidation.allAssetsValid) {
          response += `
✅ All assets validated successfully`;
        } else {
          response += `
⚠️ **Asset Issues Detected**`;
          
          if (creative.assetValidation.invalidAssets) {
            for (const invalid of creative.assetValidation.invalidAssets) {
              response += `

❌ **Asset ${invalid.assetId}**
• Error: ${invalid.error}
• Message: ${invalid.errorMessage}`;
              
              // Provide helpful suggestions based on error type
              switch (invalid.error) {
                case 'not_found':
                  response += `
• **Action Required**: Re-upload the asset or provide a valid URL`;
                  break;
                case 'download_failed':
                  response += `
• **Action Required**: Check asset URL accessibility and permissions`;
                  break;
                case 'format_mismatch':
                  response += `
• **Action Required**: Convert asset to required format or upload correct version`;
                  break;
                case 'size_exceeded':
                  response += `
• **Action Required**: Compress asset or provide smaller file`;
                  break;
                case 'corrupted':
                  response += `
• **Action Required**: Re-upload a valid, uncorrupted asset file`;
                  break;
              }
            }
          }
        }
      } else {
        response += `
⏳ Assets pending validation`;
      }

      response += `

---

## 🏢 **Publisher Approvals**`;

      if (!creative.publisherApprovals || creative.publisherApprovals.length === 0) {
        response += `
ℹ️ No publisher syncs yet - use creative/sync_publishers to submit for approval`;
      } else {
        // Filter by publisher if specified
        let approvals = creative.publisherApprovals;
        if (args.publisherId) {
          approvals = approvals.filter(a => a.publisherId === args.publisherId);
          if (approvals.length === 0) {
            response += `
ℹ️ Creative not synced to publisher ${args.publisherId}`;
            return createMCPResponse({ message: response, success: true });
          }
        }

        // Group by status
        const approved = approvals.filter(a => a.approvalStatus === 'approved' || a.approvalStatus === 'auto_approved');
        const rejected = approvals.filter(a => a.approvalStatus === 'rejected');
        const changesRequested = approvals.filter(a => a.approvalStatus === 'changes_requested');
        const pending = approvals.filter(a => a.approvalStatus === 'pending');

        response += `

**Summary**: ${approved.length} approved, ${rejected.length} rejected, ${changesRequested.length} changes requested, ${pending.length} pending`;

        if (approved.length > 0) {
          response += `

### ✅ **Approved** (${approved.length})`;
          for (const approval of approved) {
            response += `
• **${approval.publisherName}**`;
            if (approval.approvalStatus === 'auto_approved') {
              response += ` (Auto-approved)`;
            }
            if (approval.reviewedAt) {
              response += `
  - Approved: ${approval.reviewedAt}`;
            }
          }
        }

        if (rejected.length > 0) {
          response += `

### ❌ **Rejected** (${rejected.length})`;
          for (const approval of rejected) {
            response += `
• **${approval.publisherName}**
  - Rejected: ${approval.reviewedAt}
  - Reason: ${approval.rejectionReason || 'No reason provided'}`;
            
            response += `
  - **Action Required**: Use creative/revise to address rejection or create new creative`;
          }
        }

        if (changesRequested.length > 0) {
          response += `

### 🔧 **Changes Requested** (${changesRequested.length})`;
          for (const approval of changesRequested) {
            response += `
• **${approval.publisherName}**
  - Reviewed: ${approval.reviewedAt}`;
            
            if (approval.requestedChanges && approval.requestedChanges.length > 0) {
              response += `
  - **Requested Changes**:`;
              for (const change of approval.requestedChanges) {
                response += `
    • ${change}`;
              }
            }
            
            response += `
  - **Action Required**: Use creative/revise to make requested changes`;
          }
        }

        if (pending.length > 0) {
          response += `

### ⏳ **Pending Review** (${pending.length})`;
          for (const approval of pending) {
            response += `
• **${approval.publisherName}**
  - Synced: ${approval.syncedAt}
  - Status: Awaiting publisher review`;
            
            if (approval.autoApprovalPolicy) {
              response += `
  - Note: Publisher typically auto-approves standard formats`;
            }
          }
        }
      }

      // Campaign sync status
      if (creative.campaignAssignments && creative.campaignAssignments.length > 0) {
        response += `

---

## 🎯 **Campaign Assignments**`;
        
        for (const assignment of creative.campaignAssignments) {
          response += `

**${assignment.campaignName}** (${assignment.campaignId})`;
          if (assignment.publishersSynced && assignment.publishersSynced.length > 0) {
            response += `
• Publishers synced: ${assignment.publishersSynced.join(', ')}`;
          } else {
            response += `
• No publishers synced yet`;
          }
        }
      }

      response += `

---

## 💡 **Recommendations**`;

      // Provide actionable recommendations
      if (creative.assetValidation && !creative.assetValidation.allAssetsValid) {
        response += `
1. **Fix asset issues** before syncing to publishers`;
      }

      const hasRejections = creative.publisherApprovals?.some(a => 
        a.approvalStatus === 'rejected' || a.approvalStatus === 'changes_requested'
      );
      
      if (hasRejections) {
        response += `
2. **Address publisher feedback** using creative/revise command`;
      }

      const hasPending = creative.publisherApprovals?.some(a => a.approvalStatus === 'pending');
      if (hasPending) {
        response += `
3. **Monitor pending approvals** - check back in 24 hours`;
      }

      if (!creative.publisherApprovals || creative.publisherApprovals.length === 0) {
        response += `
4. **Submit for approval** using creative/sync_publishers`;
      }

      return createMCPResponse({ message: response, success: true });

    } catch (error) {
      return createErrorResponse("Failed to get creative approval status", error);
    }
  },

  name: "creative/approval_status",

  parameters: z.object({
    creativeId: z.string().describe("ID of the creative to check"),
    publisherId: z.string().optional().describe("Filter to specific publisher (optional)"),
  }),
});