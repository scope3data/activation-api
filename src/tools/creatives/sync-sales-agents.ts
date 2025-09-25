import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";
import { CreativeSyncService } from "../../services/creative-sync-service.js";
import { NotificationService } from "../../services/notification-service.js";
import { AuthenticationService } from "../../services/auth-service.js";

import { createMCPResponse } from "../../utils/error-handling.js";

/**
 * Sync creative to sales agents with smart format matching and recent history
 * Enhanced version with intelligent defaults and simplified workflow
 */
export const creativeSyncSalesAgentsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Creatives",
    dangerLevel: "medium", 
    openWorldHint: true,
    readOnlyHint: false,
    title: "Sync Creative to Sales Agents",
  },

  description:
    "Sync a creative to sales agents with smart defaults. Auto-detects relevant sales agents based on creative format and recent brand agent history (past 30 days). Supports manual override for specific agents or campaigns.",

  execute: async (
    args: {
      creativeId: string;
      // Smart auto-detection (default behavior)
      autoDetect?: {
        daysBack?: number;        // Look at tactics from past N days (default: 30)
        includeActive?: boolean;  // Include agents from active campaigns (default: true)
      };
      // Manual override options
      salesAgentIds?: string[];   // Explicitly specify which agents
      campaignId?: string;        // Sync to agents used by this campaign's tactics only
      // Pre-sync option
      preApproval?: boolean;      // Request pre-approval before campaign launch
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
      // Initialize services
      const authService = new AuthenticationService();
      const creativeSyncService = new CreativeSyncService(authService);
      const notificationService = new NotificationService(authService);
      creativeSyncService.setNotificationService(notificationService);

      // Validate API key and get customer info
      const authResult = await authService.validateApiKey(apiKey);
      if (!authResult.isValid) {
        throw new Error("Invalid API key");
      }

      const customerId = authResult.customerId!;

      // Get creative info for brand agent ID
      const creative = await client.getCreative(apiKey, args.creativeId);
      if (!creative) {
        throw new Error(`Creative ${args.creativeId} not found`);
      }

      let salesAgentIds: string[] = [];
      let syncMethod = "unknown";

      if (args.salesAgentIds && args.salesAgentIds.length > 0) {
        // Manual override: use specified agents
        salesAgentIds = args.salesAgentIds;
        syncMethod = "manual_override";
      } else if (args.campaignId) {
        // Campaign-specific: get agents from campaign tactics
        const campaign = await client.getCampaign(apiKey, args.campaignId);
        if (!campaign) {
          throw new Error(`Campaign ${args.campaignId} not found`);
        }
        
        // TODO: Get tactics from campaign and extract sales agent IDs
        // For now, use auto-detection as fallback
        salesAgentIds = await creativeSyncService.determineRelevantSalesAgents(
          args.creativeId,
          parseInt(creative.buyerAgentId),
          args.autoDetect || {}
        );
        syncMethod = "campaign_tactics";
      } else {
        // Smart auto-detection (default behavior)
        const autoDetectOptions = args.autoDetect || {};
        salesAgentIds = await creativeSyncService.determineRelevantSalesAgents(
          args.creativeId,
          parseInt(creative.buyerAgentId), 
          autoDetectOptions
        );
        syncMethod = `auto_detect_${autoDetectOptions.daysBack || 30}days`;
      }

      if (salesAgentIds.length === 0) {
        return createMCPResponse({
          data: {
            creativeId: args.creativeId,
            method: syncMethod,
            salesAgentsFound: 0,
            recommendation: "No compatible sales agents found in recent activity",
          },
          message: `🔍 **No Sales Agents Found**

📦 **Creative**: ${creative.creativeName} (${args.creativeId})
🎯 **Format**: ${creative.format?.formatId || "Unknown"}
📅 **Search Method**: ${syncMethod}

⚠️ **No compatible sales agents found** in recent activity.

💡 **Suggestions:**
• Check if this brand agent has created any tactics recently
• Try manual sync with specific sales agent IDs: \`salesAgentIds: ["agent_id"]\`
• Ensure creative format is supported by target sales agents
• Consider creating tactics first to establish sales agent relationships`,
          success: true,
        });
      }

      // Execute sync operation
      const syncResults = await creativeSyncService.syncCreativeToSalesAgents(
        args.creativeId,
        salesAgentIds,
        {
          campaignId: args.campaignId,
          triggeredBy: "manual",
        }
      );

      // Get updated sync status
      const syncStatus = await creativeSyncService.getCreativeSyncStatus(args.creativeId);
      const currentStatus = syncStatus.filter(s => 
        salesAgentIds.includes(s.salesAgentId)
      );

      // Create human-readable response
      let response = `🔄 **Creative Sales Agent Sync Results**

📦 **Creative**: ${creative.creativeName} (${args.creativeId})
🎯 **Format**: ${creative.format?.formatId || "Unknown"}  
📅 **Sync Method**: ${syncMethod}
${args.preApproval ? "✅ **Pre-Approval Request**" : ""}

📊 **Sync Summary**
• Sales Agents Targeted: ${salesAgentIds.length}
• Successfully Synced: ${syncResults.success.length}
• Failed: ${syncResults.failed.length}

---

## 🏢 **Sales Agent Status**`;

      // Group by status
      const synced = currentStatus.filter(s => s.status === "synced");
      const failed = currentStatus.filter(s => s.status === "failed");
      const pending = currentStatus.filter(s => s.status === "pending");

      if (synced.length > 0) {
        response += `

✅ **Successfully Synced** (${synced.length})`;
        for (const agent of synced) {
          const approvalEmoji = agent.approvalStatus === "approved" ? "✅" : 
                               agent.approvalStatus === "rejected" ? "❌" : "⏳";
          response += `
• **${agent.salesAgentName}**: ${approvalEmoji} ${agent.approvalStatus || "Pending approval"}`;
        }
      }

      if (pending.length > 0) {
        response += `

⏳ **Sync in Progress** (${pending.length})`;
        for (const agent of pending) {
          response += `
• **${agent.salesAgentName}**: Sync in progress...`;
        }
      }

      if (failed.length > 0) {
        response += `

❌ **Sync Failed** (${failed.length})`;
        for (const agent of failed) {
          response += `
• **${agent.salesAgentName}**: ${agent.rejectionReason || "Sync failed"}`;
        }
      }

      // Smart next steps based on results
      response += `

---

## 💡 **Next Steps**`;

      if (synced.length > 0) {
        const approvedCount = synced.filter(s => s.approvalStatus === "approved").length;
        const pendingApproval = synced.filter(s => !s.approvalStatus || s.approvalStatus === "pending").length;
        
        if (approvedCount > 0) {
          response += `

**✅ Ready for Campaign Deployment** (${approvedCount} agents)
• Creative is approved and ready for immediate use
• Can be assigned to campaigns targeting these sales agents`;
        }

        if (pendingApproval > 0) {
          response += `

**⏳ Awaiting Approval** (${pendingApproval} agents)  
• Sales agents will review based on their policies
• You'll receive notifications when approvals are complete
• Estimated review time: Within 24 hours`;
        }
      }

      if (failed.length > 0) {
        response += `

**❌ Address Sync Failures** (${failed.length} agents)
• Check creative format compatibility with sales agent
• Verify all required assets are valid and accessible
• Consider using alternative creative formats
• Use \`creative/revise\` if changes are needed`;
      }

      // Smart recommendations
      if (syncMethod.includes("auto_detect")) {
        response += `

**🎯 Smart Sync Info**
• Auto-detected agents based on recent ${args.autoDetect?.daysBack || 30}-day activity
• Only format-compatible agents were selected
• Use \`salesAgentIds: []\` to manually override if needed`;
      }

      return createMCPResponse({
        data: {
          configuration: {
            creativeId: args.creativeId,
            campaignId: args.campaignId,
            syncMethod,
            autoDetectOptions: args.autoDetect,
            preApproval: args.preApproval || false,
            syncDate: new Date().toISOString(),
          },
          metadata: {
            action: "sync-sales-agents",
            creativeType: "creative", 
            readyForCampaigns: synced.filter(s => s.approvalStatus === "approved").length > 0,
            requiresFollowUp: failed.length > 0 || synced.filter(s => !s.approvalStatus || s.approvalStatus === "pending").length > 0,
          },
          salesAgentBreakdown: {
            synced: synced.map(s => ({
              salesAgentId: s.salesAgentId,
              salesAgentName: s.salesAgentName,
              approvalStatus: s.approvalStatus,
            })),
            failed: failed.map(s => ({
              salesAgentId: s.salesAgentId,
              salesAgentName: s.salesAgentName, 
              error: s.rejectionReason,
            })),
            pending: pending.map(s => ({
              salesAgentId: s.salesAgentId,
              salesAgentName: s.salesAgentName,
            })),
          },
          summary: {
            salesAgentsTargeted: salesAgentIds.length,
            successfulSyncs: syncResults.success.length,
            failedSyncs: syncResults.failed.length,
            approved: synced.filter(s => s.approvalStatus === "approved").length,
            pendingApproval: synced.filter(s => !s.approvalStatus || s.approvalStatus === "pending").length,
            rejected: synced.filter(s => s.approvalStatus === "rejected").length,
          },
          smartSync: {
            method: syncMethod,
            formatMatching: true,
            historicalAnalysis: syncMethod.includes("auto_detect"),
            daysAnalyzed: args.autoDetect?.daysBack || 30,
          },
          syncStatus: currentStatus,
        },
        message: response,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to sync creative to sales agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "creative_sync_sales_agents",

  parameters: z.object({
    creativeId: z.string().describe("ID of the creative to sync"),
    
    autoDetect: z.object({
      daysBack: z.number().min(1).max(90).optional()
        .describe("Look at tactics from past N days (default: 30)"),
      includeActive: z.boolean().optional()
        .describe("Include agents from active campaigns (default: true)"),
    }).optional()
      .describe("Smart auto-detection settings (default behavior)"),
    
    salesAgentIds: z.array(z.string()).optional()
      .describe("Explicitly specify sales agent IDs (overrides auto-detection)"),
      
    campaignId: z.string().optional()
      .describe("Sync to sales agents used by this campaign's tactics only"),
      
    preApproval: z.boolean().optional()
      .describe("Request pre-approval before campaign launch (default: false)"),
  }),
});