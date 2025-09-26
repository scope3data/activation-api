import { BigQuery } from "@google-cloud/bigquery";
import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { requireSessionAuth } from "../../utils/auth.js";
import { AuthenticationService } from "../../services/auth-service.js";
import { CreativeSyncService } from "../../services/creative-sync-service.js";
import { NotificationService } from "../../services/notification-service.js";
import { createMCPResponse } from "../../utils/error-handling.js";

/**
 * Assign creative to campaign (both must belong to same buyer agent)
 * Validates buyer agent ownership before assignment
 */
export const creativeAssignTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Creatives",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Assign Creative to Campaign",
  },

  description:
    "Assign a creative to a campaign. Both the creative and campaign must belong to the same buyer agent. This ensures proper ownership and access control while enabling creative reuse across campaigns within the same advertiser account.",

  execute: async (
    args: {
      buyerAgentId: string;
      campaignId: string;
      creativeId: string;
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check authentication
    // Universal session authentication check
    const { apiKey, customerId: _customerId } = requireSessionAuth(context);

    try {
      // Assign creative to campaign with buyer agent validation
      const result = await client.assignCreativeToCampaign(
        apiKey,
        args.creativeId,
        args.campaignId,
        args.buyerAgentId,
      );

      if (result.success) {
        // Trigger automatic sync to sales agents used by this campaign
        try {
          const authService = new AuthenticationService(new BigQuery());
          const creativeSyncService = new CreativeSyncService(authService);
          const notificationService = new NotificationService(authService);
          creativeSyncService.setNotificationService(notificationService);

          // Trigger sync in background - don't wait for completion
          creativeSyncService
            .onCreativeAssignedToCampaign(args.creativeId, args.campaignId)
            .catch((syncError) => {
              console.warn(
                `Background sync failed for creative ${args.creativeId} in campaign ${args.campaignId}:`,
                syncError,
              );
            });
        } catch (syncError) {
          console.warn("Failed to initialize sync services:", syncError);
          // Don't fail the assignment if sync setup fails
        }
        const response = `✅ **Creative assigned successfully!**

📋 **Assignment Details**
• Creative ID: ${args.creativeId}
• Campaign ID: ${args.campaignId}
• Buyer Agent: ${args.buyerAgentId}

📊 **Assignment Information**
• Assignment Status: ${result.success ? "✅ Success" : "❌ Failed"}
• Assignment Date: ${new Date().toLocaleDateString()}
• Message: ${result.message}

💡 **What this means:**
• The creative is now available for use in this campaign
• Campaign targeting and budget will apply to this creative
• Performance metrics will be tracked for this creative-campaign pair
• You can assign the same creative to multiple campaigns

🔄 **Automatic Sync in Progress:**
• Creative is being automatically synced to sales agents used by this campaign
• Format-compatible sales agents will receive the creative for approval
• You'll receive notifications if any sync issues occur

🔄 **[STUB]** Assignment will be processed by AdCP publishers:
• Validation of buyer agent ownership
• Creative-campaign compatibility checks  
• Performance tracking setup
• Real-time inventory allocation`;

        return createMCPResponse({
          data: {
            assignment: result,
            configuration: {
              assignmentDate: new Date().toISOString(),
              buyerAgentId: args.buyerAgentId,
              campaignId: args.campaignId,
              creativeId: args.creativeId,
            },
            metadata: {
              action: "assign",
              assignmentType: "creative-campaign",
              ownershipValidated: true,
              performanceTrackingEnabled: true,
            },
            status: {
              isActive: true,
              message: result.message,
              success: result.success,
            },
          },
          message: response,
          success: true,
        });
      } else {
        throw new Error(`Failed to assign creative: ${result.message}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to assign creative to campaign: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "creative_assign",

  parameters: z.object({
    buyerAgentId: z
      .string()
      .describe("The buyer agent that owns both the creative and campaign"),
    campaignId: z
      .string()
      .describe("ID of the campaign/strategy to assign the creative to"),
    creativeId: z.string().describe("ID of the creative to assign"),
  }),
});

/**
 * Unassign creative from campaign
 */
export const creativeUnassignTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Creatives",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Unassign Creative from Campaign",
  },

  description:
    "Remove a creative assignment from a campaign. This stops the creative from being used in that campaign but keeps it available for other campaigns or future reassignment.",

  execute: async (
    args: {
      campaignId: string;
      creativeId: string;
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Universal session authentication check
    const { apiKey, customerId: _customerId } = requireSessionAuth(context);

    try {
      const result = await client.unassignCreativeFromCampaign(
        apiKey,
        args.creativeId,
        args.campaignId,
      );

      if (result.success) {
        const response = `🔄 **Creative unassigned successfully!**

📋 **Details**
• Creative ID: ${args.creativeId}
• Campaign ID: ${args.campaignId}
• Action: Unassigned

💡 **What this means:**
• Creative is no longer active in this campaign
• Performance tracking for this pair will stop
• Creative remains available for other campaigns
• Can be reassigned to this campaign later if needed

📊 **Next Steps**
• View creative status with \`creative/list\`
• Assign to different campaigns with \`creative/assign\`
• Check campaign creatives with \`campaign/list_creatives\`

🔄 **[STUB]** Unassignment will be processed by AdCP publishers.`;

        return createMCPResponse({
          data: {
            configuration: {
              campaignId: args.campaignId,
              creativeId: args.creativeId,
              unassignmentDate: new Date().toISOString(),
            },
            metadata: {
              action: "unassign",
              assignmentType: "creative-campaign",
              availableForReassignment: true,
              performanceTrackingStopped: true,
            },
            status: {
              isActive: false,
              message: result.message,
              success: result.success,
            },
            unassignment: result,
          },
          message: response,
          success: true,
        });
      } else {
        throw new Error(`Failed to unassign creative: ${result.message}`);
      }
    } catch (error) {
      throw new Error(
        `Failed to unassign creative from campaign: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "creative_unassign",

  parameters: z.object({
    campaignId: z
      .string()
      .describe("ID of the campaign to remove the creative from"),
    creativeId: z.string().describe("ID of the creative to unassign"),
  }),
});
