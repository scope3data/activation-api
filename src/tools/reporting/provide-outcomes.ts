import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { ScoringOutcome } from "../../types/events.js";
import type {
  MCPToolExecuteContext,
  ProvideScoringOutcomesParams,
} from "../../types/mcp.js";

import { createMCPResponse } from "../../utils/error-handling.js";

export const provideScoringOutcomesTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Reporting & Analytics",
    dangerLevel: "low",
    openWorldHint: false,
    readOnlyHint: false,
    title: "Provide Scoring Outcomes",
  },

  description:
    "Provide scoring outcomes for campaign optimization. This replaces the old campaign events system with a focus on performance measurement. Takes campaign and optional tactic/creative, exposure range, and performance index (100 = expected performance).",

  execute: async (
    args: ProvideScoringOutcomesParams,
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
      // Validate date range
      const startDate = new Date(args.exposureRange.start);
      const endDate = new Date(args.exposureRange.end);

      if (startDate >= endDate) {
        throw new Error("Exposure range start date must be before end date");
      }

      // Validate performance index
      if (args.performanceIndex < 0) {
        throw new Error(
          "Performance index must be non-negative (0 = no value, 100 = expected, 1000 = 10x)",
        );
      }

      // Create scoring outcome input
      const outcomeInput = {
        campaignId: args.campaignId,
        creativeId: args.creativeId,
        exposureRange: {
          end: endDate,
          start: startDate,
        },
        performanceIndex: args.performanceIndex,
        source: "scope3", // Default source
        tacticId: args.tacticId,
        timestamp: new Date(), // When the outcome was provided
      };

      const outcome = await client.createScoringOutcome(apiKey, outcomeInput);

      // Format response
      const response = formatOutcomeResponse(outcome, args);

      return createMCPResponse({
        data: {
          configuration: {
            campaignId: args.campaignId,
            creativeId: args.creativeId,
            exposureRange: args.exposureRange,
            performanceIndex: args.performanceIndex,
            submissionTime: new Date().toISOString(),
            tacticId: args.tacticId,
          },
          exposureAnalysis: {
            durationDays: Math.ceil(
              (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
            ),
            endDate: endDate.toISOString(),
            startDate: startDate.toISOString(),
          },
          metadata: {
            action: "provide-scoring-outcomes",
            budgetOptimizationEnabled: true,
            outcomeType: "performance-measurement",
            recommendsIncreasedBudget: args.performanceIndex >= 150,
            recommendsReview: args.performanceIndex < 50,
            scoringAlgorithm: "3-component",
          },
          outcome,
          performanceAnalysis: {
            isExpectedPerformance: args.performanceIndex === 100,
            isHighPerformance: args.performanceIndex >= 150,
            isLowPerformance: args.performanceIndex < 50,
            multiplier: args.performanceIndex / 100,
            percentageOfExpected: args.performanceIndex,
            performanceIndex: args.performanceIndex,
          },
          scoring: {
            algorithmComponents: [
              "Quality Score (Scope3)",
              "Story Affinity Score",
              "Performance Index",
            ],
            outcomeId: outcome.id,
            source: "scope3",
            timestamp: outcome.timestamp,
            willInfluenceBudgetAllocation: true,
          },
        },
        message: response,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to provide scoring outcome: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "reporting/provide-outcomes",
  parameters: z.object({
    campaignId: z.string().describe("Campaign ID that this outcome applies to"),
    creativeId: z
      .string()
      .optional()
      .describe("Optional creative ID associated with this outcome"),
    exposureRange: z
      .object({
        end: z
          .string()
          .describe("End of exposure range (YYYY-MM-DD or ISO date)"),
        start: z
          .string()
          .describe("Start of exposure range (YYYY-MM-DD or ISO date)"),
      })
      .describe("Time range when this performance was measured"),
    performanceIndex: z
      .number()
      .min(0)
      .describe(
        "Performance index: 0 = no value, 100 = expected performance, 1000 = 10x expected",
      ),
    tacticId: z
      .string()
      .optional()
      .describe("Optional tactic ID that this outcome measures"),
  }),
});

function formatOutcomeResponse(
  outcome: ScoringOutcome,
  params: ProvideScoringOutcomesParams,
): string {
  const exposureDays = Math.ceil(
    (new Date(params.exposureRange.end).getTime() -
      new Date(params.exposureRange.start).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  let response = `## 🎯 Scoring Outcome Recorded\n\n`;
  response += `**Outcome ID**: ${outcome.id}\n`;
  response += `**Campaign**: ${params.campaignId}\n`;
  if (params.tacticId) {
    response += `**Tactic**: ${params.tacticId}\n`;
  }
  if (params.creativeId) {
    response += `**Creative**: ${params.creativeId}\n`;
  }

  response += `\n### 📊 Performance Measurement\n`;
  response += `**Performance Index**: ${params.performanceIndex}`;

  if (params.performanceIndex === 100) {
    response += ` (Expected Performance) ✅\n`;
  } else if (params.performanceIndex > 100) {
    const multiplier = (params.performanceIndex / 100).toFixed(1);
    response += ` (${multiplier}x Expected Performance) 🚀\n`;
  } else if (params.performanceIndex > 0) {
    const percentage = params.performanceIndex.toFixed(0);
    response += ` (${percentage}% of Expected) ⚠️\n`;
  } else {
    response += ` (No Measurable Value) ❌\n`;
  }

  response += `\n### 📅 Exposure Range\n`;
  response += `**Period**: ${params.exposureRange.start} to ${params.exposureRange.end} (${exposureDays} days)\n`;

  // Removed scoring details section as we only use performanceIndex

  response += `\n### 🎯 Next Steps\n`;
  response += `• This outcome will be used in the 3-component scoring algorithm\n`;
  response += `• Combined with Quality Score (Scope3) and Story Affinity Score\n`;
  response += `• Will influence budget allocation for this tactic\n`;

  if (params.performanceIndex >= 150) {
    response += `• High performance detected - tactic may receive increased budget\n`;
  } else if (params.performanceIndex < 50) {
    response += `• Low performance detected - consider reviewing tactic configuration\n`;
  }

  return response;
}
