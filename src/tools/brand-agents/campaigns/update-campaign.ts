import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  MCPToolExecuteContext,
  UpdateBrandAgentCampaignParams,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const updateBrandAgentCampaignTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "campaign-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Update Brand Agent Campaign",
  },

  description:
    "Update an existing campaign's settings including name, prompt, budget, assigned creatives, or audiences. This tool supports partial updates - only provide the fields you want to change. Creative and audience assignments will replace existing assignments. Requires authentication.",

  execute: async (
    args: UpdateBrandAgentCampaignParams,
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
      const updateInput: Record<string, unknown> = {};
      const changes: string[] = [];

      // Build update input with only provided fields
      if (args.name !== undefined) {
        updateInput.name = args.name;
        changes.push(`Name updated to: "${args.name}"`);
      }
      if (args.prompt !== undefined) {
        updateInput.prompt = args.prompt;
        changes.push(`Prompt updated`);
      }
      if (args.budget !== undefined) {
        updateInput.budget = args.budget;
        changes.push(`Budget updated`);
      }
      if (args.creativeIds !== undefined) {
        updateInput.creativeIds = args.creativeIds;
        changes.push(
          `Creative assignments updated (${args.creativeIds.length} creatives)`,
        );
      }
      if (args.audienceIds !== undefined) {
        updateInput.audienceIds = args.audienceIds;
        changes.push(
          `Audience assignments updated (${args.audienceIds.length} audiences)`,
        );
      }
      if (args.status !== undefined) {
        updateInput.status = args.status;
        changes.push(`Status updated to: ${args.status}`);
      }

      // Check if there are actually fields to update
      if (Object.keys(updateInput).length === 0) {
        return createMCPResponse({
          message:
            "No changes specified. Please provide at least one field to update (name, prompt, budget, creativeIds, audienceIds, or status).",
          success: false,
        });
      }

      const updatedCampaign = await client.updateBrandAgentCampaign(
        apiKey,
        args.campaignId,
        updateInput,
      );

      let summary = `✅ Campaign Updated Successfully!\n\n`;
      summary += `**Updated Campaign:**\n`;
      summary += `• **Name:** ${updatedCampaign.name}\n`;
      summary += `• **ID:** ${updatedCampaign.id}\n`;
      summary += `• **Brand Agent ID:** ${updatedCampaign.brandAgentId}\n`;
      summary += `• **Prompt:** ${updatedCampaign.prompt}\n`;

      if (updatedCampaign.budget) {
        summary += `• **Budget:** ${updatedCampaign.budget.total} ${updatedCampaign.budget.currency}`;
        if (updatedCampaign.budget.dailyCap) {
          summary += ` (Daily cap: ${updatedCampaign.budget.dailyCap} ${updatedCampaign.budget.currency})`;
        }
        summary += `\n`;
        if (updatedCampaign.budget.pacing) {
          summary += `• **Pacing:** ${updatedCampaign.budget.pacing}\n`;
        }
      }

      summary += `• **Status:** ${updatedCampaign.status}\n`;
      summary += `• **Last Updated:** ${new Date(updatedCampaign.updatedAt).toLocaleString()}\n`;

      // Show current creative assignments
      if (
        updatedCampaign.creativeIds &&
        updatedCampaign.creativeIds.length > 0
      ) {
        summary += `\n**Current Creative Assignments:**\n`;
        updatedCampaign.creativeIds.forEach((creativeId, index) => {
          summary += `   ${index + 1}. Creative ID: ${creativeId}\n`;
        });
      } else {
        summary += `\n⚠️ **No creatives assigned.**\n`;
      }

      // Show current audience assignments
      if (
        updatedCampaign.audienceIds &&
        updatedCampaign.audienceIds.length > 0
      ) {
        summary += `\n**Current Audience Assignments:**\n`;
        updatedCampaign.audienceIds.forEach((audienceId, index) => {
          summary += `   ${index + 1}. Audience ID: ${audienceId}\n`;
        });
      } else {
        summary += `\n💡 **No audiences assigned.**\n`;
      }

      summary += `\n**Changes Made:**\n`;
      changes.forEach((change, index) => {
        summary += `   ${index + 1}. ${change}\n`;
      });

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to update campaign", error);
    }
  },

  name: "update_campaign",
  parameters: z.object({
    audienceIds: z
      .array(z.string())
      .optional()
      .describe("New audience assignments (replaces existing assignments)"),
    budget: z
      .object({
        currency: z.string().optional().describe("New budget currency"),
        dailyCap: z.number().optional().describe("New daily spending limit"),
        pacing: z.string().optional().describe("New budget pacing strategy"),
        total: z.number().optional().describe("New total campaign budget"),
      })
      .optional()
      .describe("New budget configuration"),
    campaignId: z.string().describe("ID of the campaign to update"),
    creativeIds: z
      .array(z.string())
      .optional()
      .describe("New creative assignments (replaces existing assignments)"),
    name: z.string().optional().describe("New name for the campaign"),
    prompt: z
      .string()
      .optional()
      .describe("New campaign objectives and strategy description"),
    status: z
      .string()
      .optional()
      .describe("New campaign status (e.g., 'active', 'paused', 'completed')"),
  }),
});
