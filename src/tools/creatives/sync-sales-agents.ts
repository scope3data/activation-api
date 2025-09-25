import { z } from "zod";
import { BigQuery } from "@google-cloud/bigquery";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";
import { CreativeSyncService } from "../../services/creative-sync-service.js";
import { NotificationService } from "../../services/notification-service.js";
import { AuthenticationService } from "../../services/auth-service.js";

import { createMCPResponse } from "../../utils/error-handling.js";

/**
 * Schema for sync sales agents tool parameters
 */
const SyncSalesAgentsSchema = z.object({
  creativeId: z.string().min(1, "Creative ID is required"),

  autoDetect: z
    .object({
      daysBack: z
        .number()
        .min(1)
        .max(90)
        .optional()
        .describe("Look at tactics from past N days (default: 30)"),
      includeActive: z
        .boolean()
        .optional()
        .describe("Include agents from active campaigns (default: true)"),
    })
    .optional()
    .describe("Smart auto-detection settings (default behavior)"),

  salesAgentIds: z
    .array(z.string())
    .optional()
    .describe("Explicitly specify sales agent IDs (overrides auto-detection)"),

  campaignId: z
    .string()
    .optional()
    .describe("Sync to sales agents used by this campaign's tactics only"),

  preApproval: z
    .boolean()
    .optional()
    .describe("Request pre-approval before campaign launch (default: false)"),
});

export const creativeSyncSalesAgentsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Creative Assets",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Sync Creative to Sales Agents",
  },

  description:
    "Sync a creative to sales agents using smart auto-detection or manual specification. Features intelligent format matching (video creatives only sync to video-capable agents) and recent activity analysis (30-60 day lookback). Provides detailed sync status and actionable next steps. Requires authentication.",

  execute: async (
    args: unknown,
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    const validatedArgs = SyncSalesAgentsSchema.parse(args);

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
      // Initialize services
      const authService = new AuthenticationService(new BigQuery());
      await authService.validateApiKey(apiKey);

      const creativeSyncService = new CreativeSyncService(authService);
      const notificationService = new NotificationService(authService);
      creativeSyncService.setNotificationService(notificationService);

      // Get creative info
      const creative = await client.getCreative(
        apiKey,
        validatedArgs.creativeId,
      );
      if (!creative) {
        throw new Error(`Creative ${validatedArgs.creativeId} not found`);
      }

      // Determine sales agents to sync to
      let salesAgentIds: string[];
      let syncMethod = "auto_detect_30days";

      if (validatedArgs.salesAgentIds) {
        salesAgentIds = validatedArgs.salesAgentIds;
        syncMethod = "manual_override";
      } else if (validatedArgs.campaignId) {
        // Campaign-specific: get agents from campaign tactics
        const campaign = await client.getCampaign(
          apiKey,
          validatedArgs.campaignId,
        );
        if (!campaign) {
          throw new Error(`Campaign ${validatedArgs.campaignId} not found`);
        }

        // TODO: Get tactics from campaign and extract sales agent IDs
        // For now, use auto-detection as fallback
        salesAgentIds = await creativeSyncService.determineRelevantSalesAgents(
          validatedArgs.creativeId,
          parseInt(creative.buyerAgentId),
          validatedArgs.autoDetect || {},
        );
        syncMethod = "campaign_tactics";
      } else {
        // Auto-detection mode
        salesAgentIds = await creativeSyncService.determineRelevantSalesAgents(
          validatedArgs.creativeId,
          parseInt(creative.buyerAgentId),
          validatedArgs.autoDetect || {},
        );

        const daysBack = validatedArgs.autoDetect?.daysBack || 30;
        syncMethod = `auto_detect_${daysBack}days`;
      }

      if (salesAgentIds.length === 0) {
        return createMCPResponse({
          data: {
            creative: {
              id: creative.creativeId,
              name: creative.creativeName,
              format: creative.format?.formatId,
            },
            salesAgents: [],
            syncResults: { success: [], failed: [] },
            smartSync: { method: syncMethod, agentsFound: 0 },
          },
          message: `🔍 **No Relevant Sales Agents Found**

📦 **Creative**: ${creative.creativeName} (${validatedArgs.creativeId})
🎯 **Format**: ${creative.format?.formatId || "unknown"}

**Why no agents were found:**
• No recent activity in the last ${validatedArgs.autoDetect?.daysBack || 30} days
• No format-compatible sales agents available  
• Try manually specifying \`salesAgentIds\` or expanding \`daysBack\`

**Next Steps:**
• Use \`salesAgentIds: ["agent1", "agent2"]\` to manually specify agents
• Increase \`daysBack\` to 60-90 days for broader search
• Check if sales agents support this creative format`,
          success: true,
        });
      }

      // Perform the sync
      const syncResults = await creativeSyncService.syncCreativeToSalesAgents(
        validatedArgs.creativeId,
        salesAgentIds,
        {
          campaignId: validatedArgs.campaignId,
          triggeredBy: "manual",
        },
      );

      // Get detailed status for response
      const syncStatus = await creativeSyncService.getCreativeSyncStatus(
        validatedArgs.creativeId,
      );

      // Categorize results for display
      const approved = syncStatus.filter(
        (s) => s.approvalStatus === "approved",
      );
      const pending = syncStatus.filter(
        (s) => s.approvalStatus === "pending" && s.status === "synced",
      );
      const failed = syncStatus.filter((s) => s.status === "failed");
      const synced = syncStatus.filter((s) => s.status === "synced");

      // Build response message
      let message = `🔄 **Creative Sales Agent Sync Results**

📦 **Creative**: ${creative.creativeName} (${validatedArgs.creativeId})
🎯 **Format**: ${creative.format?.formatId || "unknown"}  
📅 **Sync Method**: ${syncMethod}


📊 **Sync Summary**
• Sales Agents Targeted: ${salesAgentIds.length}
• Successfully Synced: ${syncResults.success.length}
• Failed: ${syncResults.failed.length}

---

## 🏢 **Sales Agent Status**

✅ **Successfully Synced** (${synced.length})`;

      synced.forEach((agent) => {
        const statusIcon =
          agent.approvalStatus === "approved"
            ? "✅"
            : agent.approvalStatus === "rejected"
              ? "❌"
              : "⏳";
        message += `\n• **${agent.salesAgentName}**: ${statusIcon} ${agent.approvalStatus || "synced"}`;
      });

      if (failed.length > 0) {
        message += `\n\n❌ **Sync Failed** (${failed.length})`;
        failed.forEach((agent) => {
          message += `\n• **${agent.salesAgentName}**: ${agent.rejectionReason || "Sync failed"}`;
        });
      }

      message += `\n\n---

## 💡 **Next Steps**`;

      if (approved.length > 0) {
        message += `\n\n**✅ Ready for Campaign Deployment** (${approved.length} agents)
• Creative is approved and ready for immediate use
• Can be assigned to campaigns targeting these sales agents`;
      }

      if (pending.length > 0) {
        message += `\n\n**⏳ Awaiting Approval** (${pending.length} agents)  
• Sales agents will review based on their policies
• You'll receive notifications when approvals are complete
• Estimated review time: Within 24 hours`;
      }

      if (failed.length > 0) {
        message += `\n\n**❌ Address Sync Failures** (${failed.length} agents)
• Check creative format compatibility with sales agent
• Verify all required assets are valid and accessible
• Consider using alternative creative formats
• Use \`creative/revise\` if changes are needed`;
      }

      message += `\n\n**🎯 Smart Sync Info**
• Auto-detected agents based on recent ${validatedArgs.autoDetect?.daysBack || 30}-day activity
• Only format-compatible agents were selected
• Use \`salesAgentIds: []\` to manually override if needed`;

      if (validatedArgs.preApproval) {
        message += `\n\n**⏰ Pre-Approval Requested**
• Creative will be reviewed before campaign launch
• Faster campaign activation when you're ready to go live`;
      }

      return createMCPResponse({
        data: {
          creative: {
            id: creative.creativeId,
            name: creative.creativeName,
            format: creative.format?.formatId,
          },
          salesAgents: syncStatus.map((agent) => ({
            id: agent.salesAgentId,
            name: agent.salesAgentName,
            status: agent.status,
            approvalStatus: agent.approvalStatus,
            lastSyncAttempt: agent.lastSyncAttempt,
          })),
          syncResults,
          smartSync: {
            method: syncMethod,
            agentsFound: salesAgentIds.length,
            agentsTargeted: salesAgentIds,
          },
          nextSteps: {
            readyForDeployment: approved.length,
            awaitingApproval: pending.length,
            needsAttention: failed.length,
          },
        },
        message,
        success: true,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not found")) {
        throw error; // Re-throw "not found" errors as-is for better UX
      }

      throw new Error(
        `Failed to sync creative to sales agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  inputSchema: SyncSalesAgentsSchema,
  name: "creative_sync_sales_agents",
});
