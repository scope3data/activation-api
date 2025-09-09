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
    category: "Campaigns",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Update Campaign",
  },

  description:
    "Update an existing campaign including strategy, targeting, and tactic budget allocations. Can update campaign prompt/strategy, tactic budget amounts, percentages, daily caps, or pacing strategies. Supports bulk tactic updates. Use this to modify campaign parameters and rebalance budget based on performance or changing priorities. Requires campaign ID and authentication.",

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
      let summary = `✅ Campaign ${args.name ? `"${args.name}"` : args.campaignId} updated successfully\n\n`;

      if (args.reason) {
        summary += `**Reason for Update:** ${args.reason}\n\n`;
      }

      // Step 1: Handle strategy updates if prompt is provided
      if (args.prompt) {
        const parsedStrategy = await client.parseStrategyPrompt(apiKey, {
          prompt: args.prompt,
          strategyType: "INTELLIGENT_PMPS",
        });

        // Get customer ID for targeting profile operations
        const customerId = await client.getCustomerId(apiKey);

        // Update the strategy with new information
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

        // Update targeting profiles
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
            console.warn(
              `Failed to create targeting profile for ${bitmapProfile.dimensionName}:`,
              error,
            );
          }
        }

        // Get human-readable targeting summary
        const dimensionsMap = await getTargetingDimensionsMap(client, apiKey);
        const targetingProfiles = transformTargetingProfiles(
          parsedStrategy.bitmapTargetingProfiles,
          dimensionsMap,
        );

        // Add strategy update details to summary
        summary += `## 🎯 **Strategy Updates**\n\n`;

        if (parsedStrategy.channels?.length) {
          summary += `**Channels:** ${parsedStrategy.channels.join(", ")}\n`;
        }
        if (parsedStrategy.countries?.length) {
          summary += `**Countries:** ${parsedStrategy.countries.join(", ")}\n`;
        }

        if (parsedStrategy.brandStandardsAgents?.length) {
          summary += `**Brand Standards Agent:** ${parsedStrategy.brandStandardsAgents[0].name}\n`;
        }
        if (parsedStrategy.brandStoryAgents?.length) {
          summary += `**Brand Story Agents:** ${parsedStrategy.brandStoryAgents.map((a) => a.name).join(", ")}\n`;
        }

        if (createdTargetingProfiles.length > 0) {
          summary += `\n**Targeting Updated** (${createdTargetingProfiles.length} new profiles):\n`;
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
        summary += `\n`;
      }

      // Step 2: Handle tactic adjustments if provided
      if (args.tacticAdjustments && args.tacticAdjustments.length > 0) {
        const updatedTactics = [];
        const errors = [];

        for (const adjustment of args.tacticAdjustments) {
          try {
            const updateInput = {
              budgetAllocation: adjustment.budgetAllocation,
            };

            // Remove undefined values
            if (updateInput.budgetAllocation) {
              Object.keys(updateInput.budgetAllocation).forEach((key) => {
                if (
                  (updateInput.budgetAllocation as Record<string, unknown>)[
                    key
                  ] === undefined
                ) {
                  delete (
                    updateInput.budgetAllocation as Record<string, unknown>
                  )[key];
                }
              });
            }

            const updatedTactic = await client.updateTactic(
              apiKey!,
              adjustment.tacticId,
              updateInput,
            );

            updatedTactics.push(updatedTactic);
          } catch (error) {
            errors.push({
              error: error instanceof Error ? error.message : String(error),
              tacticId: adjustment.tacticId,
            });
          }
        }

        if (updatedTactics.length > 0) {
          summary += `## 📊 **Tactic Budget Updates** (${updatedTactics.length} updated)\n\n`;

          const totalNewBudget = updatedTactics.reduce(
            (sum, tactic) => sum + tactic.budgetAllocation.amount,
            0,
          );

          updatedTactics.forEach((tactic, index) => {
            summary += `### ${index + 1}. **${tactic.name}**\n`;
            summary += `**Publisher:** ${tactic.mediaProduct.publisherName} → ${tactic.mediaProduct.name}\n`;
            summary += `**Signal:** ${tactic.targeting.signalType.replace(/_/g, " ")}`;
            if (tactic.targeting.signalProvider) {
              summary += ` (${tactic.targeting.signalProvider})`;
            }
            summary += `\n`;

            summary += `\n**💳 New Budget Allocation:**\n`;
            summary += `• **Budget:** $${tactic.budgetAllocation.amount.toLocaleString()} ${tactic.budgetAllocation.currency}`;

            if (tactic.budgetAllocation.percentage) {
              summary += ` (${tactic.budgetAllocation.percentage}% of campaign)`;
            }
            summary += `\n`;

            if (tactic.budgetAllocation.dailyCap) {
              summary += `• **Daily Cap:** $${tactic.budgetAllocation.dailyCap.toLocaleString()}\n`;
            }

            summary += `• **Pacing:** ${tactic.budgetAllocation.pacing.replace(/_/g, " ")}\n`;
            summary += `• **Effective CPM:** $${tactic.effectivePricing.totalCpm.toFixed(2)}\n`;

            const projectedImpressions = Math.floor(
              (tactic.budgetAllocation.amount /
                tactic.effectivePricing.totalCpm) *
                1000,
            );
            summary += `• **Projected Impressions:** ~${projectedImpressions.toLocaleString()}\n\n`;
          });

          if (updatedTactics.length > 1) {
            summary += `**Total Budget (Updated Tactics):** $${totalNewBudget.toLocaleString()}\n\n`;
          }
        }

        if (errors.length > 0) {
          summary += `## ⚠️ **Tactic Update Errors** (${errors.length})\n\n`;
          errors.forEach((error, index) => {
            summary += `${index + 1}. **Tactic ID:** ${error.tacticId} - ${error.error}\n`;
          });
          summary += `\n`;
        }
      }

      summary += `**Campaign updates have been applied successfully!**`;

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
      .optional()
      .describe(
        "New campaign prompt with updated objectives and strategy (optional if only updating tactics)",
      ),
    reason: z
      .string()
      .optional()
      .describe(
        "Optional reason for the update/adjustment (for documentation)",
      ),
    tacticAdjustments: z
      .array(
        z.object({
          budgetAllocation: z
            .object({
              amount: z
                .number()
                .min(0)
                .optional()
                .describe("New budget amount"),
              dailyCap: z
                .number()
                .min(0)
                .optional()
                .describe("New daily spending cap"),
              pacing: z
                .enum(["even", "asap", "front_loaded"])
                .optional()
                .describe("New pacing strategy"),
              percentage: z
                .number()
                .min(0)
                .max(100)
                .optional()
                .describe("New percentage of campaign budget"),
            })
            .optional()
            .describe("Budget allocation updates"),
          tacticId: z.string().describe("ID of the tactic to update"),
        }),
      )
      .optional()
      .describe("Optional array of tactic budget adjustments to make"),
  }),
});
