import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

/**
 * Assign creative to campaign (both must belong to same buyer agent)
 * Validates buyer agent ownership before assignment
 */
export const creativeAssignTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "creative-management",
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
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      return createAuthErrorResponse();
    }

    try {
      // Assign creative to campaign with buyer agent validation
      const result = await client.assignCreativeToCampaign(
        apiKey,
        args.creativeId,
        args.campaignId,
        args.buyerAgentId,
      );

      if (result.success) {
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

🔄 **[STUB]** Assignment will be processed by AdCP publishers:
• Validation of buyer agent ownership
• Creative-campaign compatibility checks  
• Performance tracking setup
• Real-time inventory allocation`;

        return createMCPResponse({ message: response, success: true });
      } else {
        return createErrorResponse(
          `Failed to assign creative: ${result.message}`,
          new Error("Assignment failed"),
        );
      }
    } catch (error) {
      return createErrorResponse(
        "Failed to assign creative to campaign",
        error,
      );
    }
  },

  name: "creative/assign",

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
    category: "creative-management",
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
    // Check authentication
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      return createAuthErrorResponse();
    }

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

        return createMCPResponse({ message: response, success: true });
      } else {
        return createErrorResponse(
          `Failed to unassign creative: ${result.message}`,
          new Error("Unassignment failed"),
        );
      }
    } catch (error) {
      return createErrorResponse(
        "Failed to unassign creative from campaign",
        error,
      );
    }
  },

  name: "creative/unassign",

  parameters: z.object({
    campaignId: z
      .string()
      .describe("ID of the campaign to remove the creative from"),
    creativeId: z.string().describe("ID of the creative to unassign"),
  }),
});
