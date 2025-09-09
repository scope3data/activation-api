import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  MCPToolExecuteContext,
  UpdateCampaignParams,
} from "../../types/mcp.js";

import {
  getTargetingDimensionsMap,
  transformTargetingProfiles,
} from "../../client/transformers/targeting.js";
import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const updateCampaignTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "campaign-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Update Campaign",
  },

  description:
    "Update an existing campaign strategy with a new prompt. This tool parses the new prompt, updates the strategy with new targeting, agents, channels, and countries, and provides a summary of changes made. Requires strategy ID and authentication.",

  execute: async (
    args: UpdateCampaignParams,
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
      // Step 1: Parse the new prompt to understand what changes are needed
      const parsedStrategy = await client.parseStrategyPrompt(apiKey, {
        prompt: args.prompt,
        strategyType: "INTELLIGENT_PMPS",
      });

      // Step 2: Get customer ID for targeting profile operations
      const customerId = await client.getCustomerId(apiKey);

      // Step 3: Update the strategy with new information
      await client.updateOneStrategy(apiKey, {
        brandStandardsAgentId:
          parsedStrategy.brandStandardsAgents?.[0]?.id?.toString(),
        brandStoryAgentIds: parsedStrategy.brandStoryAgents?.map((agent) =>
          agent.id.toString(),
        ),
        channelCodes: parsedStrategy.channels || undefined,
        countryCodes: parsedStrategy.countries || undefined,
        name: args.name || undefined,
        prompt: args.prompt,
        strategyId: args.campaignId,
      });

      // Step 4: Update targeting profiles
      // Note: For simplicity, we'll add new targeting profiles rather than trying to update existing ones
      // In a production system, you might want to implement more sophisticated profile management
      const createdTargetingProfiles = [];
      for (const bitmapProfile of parsedStrategy.bitmapTargetingProfiles ||
        []) {
        try {
          const targetingProfile = await client.createBitmapTargetingProfile(
            apiKey,
            {
              anyOf: (bitmapProfile.anyOfItems || []).map((item) =>
                item.id.toString(),
              ),
              customerId: customerId.toString(),
              dimensionName: bitmapProfile.dimensionName,
              noneOf: (bitmapProfile.noneOfItems || []).map((item) =>
                item.id.toString(),
              ),
              strategyId: args.campaignId.toString(),
            },
          );
          createdTargetingProfiles.push({
            dimensionName: bitmapProfile.dimensionName,
            excludeCount: (bitmapProfile.noneOfItems || []).length,
            id: targetingProfile.id,
            includeCount: (bitmapProfile.anyOfItems || []).length,
          });
        } catch (error) {
          // Continue with other targeting profiles if one fails
          console.warn(
            `Failed to create targeting profile for ${bitmapProfile.dimensionName}:`,
            error,
          );
        }
      }

      // Step 5: Get human-readable targeting summary
      const dimensionsMap = await getTargetingDimensionsMap(client, apiKey);
      const targetingProfiles = transformTargetingProfiles(
        parsedStrategy.bitmapTargetingProfiles,
        dimensionsMap,
      );

      // Step 6: Build friendly text summary
      let summary = `Campaign ${args.name ? `"${args.name}"` : args.campaignId} updated successfully\n\n`;

      // Add updated strategy details
      if (parsedStrategy.channels?.length) {
        summary += `Channels: ${parsedStrategy.channels.join(", ")}\n`;
      }
      if (parsedStrategy.countries?.length) {
        summary += `Countries: ${parsedStrategy.countries.join(", ")}\n`;
      }

      // Add agents
      if (parsedStrategy.brandStandardsAgents?.length) {
        summary += `Brand Standards Agent: ${parsedStrategy.brandStandardsAgents[0].name}\n`;
      }
      if (parsedStrategy.brandStoryAgents?.length) {
        summary += `Brand Story Agents: ${parsedStrategy.brandStoryAgents.map((a) => a.name).join(", ")}\n`;
      }

      // Add targeting updates
      if (createdTargetingProfiles.length > 0) {
        summary += `\nTargeting Updated (${createdTargetingProfiles.length} new profiles):\n`;
        targetingProfiles.forEach((profile) => {
          if (
            profile.includeTargets?.length ||
            profile.excludeTargets?.length
          ) {
            summary += `  • ${profile.category}:`;
            if (profile.includeTargets?.length) {
              summary += ` include ${profile.includeTargets.length} items`;
            }
            if (profile.excludeTargets?.length) {
              summary += ` exclude ${profile.excludeTargets.length} items`;
            }
            summary += `\n`;
          }
        });
      }

      summary += `\nCampaign updates have been applied!`;
      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Campaign update failed", error);
    }
  },

  name: "campaign/update",
  parameters: z.object({
    campaignId: z.string().describe("ID of the campaign to update"),
    name: z
      .string()
      .optional()
      .describe("New name for the campaign (optional)"),
    prompt: z
      .string()
      .describe("New campaign prompt with updated objectives and strategy"),
  }),
});
