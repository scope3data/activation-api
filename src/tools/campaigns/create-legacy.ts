import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  getTargetingDimensionsMap,
  transformTargetingProfiles,
} from "../../client/transformers/targeting.js";

export const createCampaignLegacyTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Campaigns",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Campaign",
  },

  description:
    "Create a complete campaign in Scope3 by parsing a natural language prompt and automatically creating the strategy and targeting profiles. Returns the created strategy ID and a human-readable summary of what was created. Uses INTELLIGENT_PMPS strategy type by default (future versions will support media buys). Requires authentication.",

  execute: async (
    args: { name: string; prompt: string },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check session context first, then fall back to environment variable
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
      // Step 1: Parse the strategy prompt
      const parsedStrategy = await client.parseStrategyPrompt(apiKey, {
        prompt: args.prompt,
        strategyType: "INTELLIGENT_PMPS",
      });

      // Step 2: Get customer ID for targeting profile creation
      const customerId = await client.getCustomerId(apiKey);

      // Step 3: Create the strategy
      const strategy = await client.createStrategy(apiKey, {
        brandStandardsAgentId:
          parsedStrategy.brandStandardsAgents?.[0]?.id?.toString(),
        brandStoryAgentIds: parsedStrategy.brandStoryAgents?.map((agent) =>
          agent.id.toString(),
        ),
        channelCodes: parsedStrategy.channels || undefined,
        countryCodes: parsedStrategy.countries || undefined,
        name: args.name,
        prompt: args.prompt,
        strategyType: "INTELLIGENT_PMPS",
      });

      // Step 4: Create targeting profiles for each bitmap targeting profile
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
              strategyId: strategy.id.toString(),
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
      let summary = `Campaign "${args.name}" created successfully (ID: ${strategy.id})\n\n`;

      // Add strategy details
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

      // Add targeting
      if (createdTargetingProfiles.length > 0) {
        summary += `\nTargeting Setup (${createdTargetingProfiles.length} profiles):\n`;
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

      summary += `\nCampaign is ready for activation!`;
      return summary;
    } catch (error) {
      throw new Error(
        `Campaign creation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "campaign/create-legacy",
  parameters: z.object({
    name: z.string().describe("Name for the campaign strategy"),
    prompt: z
      .string()
      .describe(
        "Natural language description of campaign objectives and strategy",
      ),
  }),
});
