import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { BriefValidationResult } from "../../types/brief-validation.js";
import type {
  CreateCampaignParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";

import { BriefValidationService } from "../../services/brief-validation-service.js";
import { createMCPResponse } from "../../utils/error-handling.js";

export const createCampaignTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Campaigns",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Campaign",
  },

  description:
    "Create a new campaign within a brand agent. This creates a budget-allocated marketing initiative with natural language targeting. The campaign will be managed within the specified brand agent context and can use the brand agent's shared creatives and audiences. Supports campaign scheduling with start and end dates. By default, validates campaign briefs against Ad Context Protocol standards using AI evaluation - campaign creation will fail if brief quality is below threshold unless validation is skipped. Requires authentication.",

  execute: async (
    args: CreateCampaignParams,
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
      // Validate campaign brief unless explicitly skipped
      let briefValidation: BriefValidationResult | null = null;

      if (!args.skipBriefValidation) {
        const validationService = new BriefValidationService();
        const threshold = args.briefValidationThreshold ?? 70;

        briefValidation = await validationService.validateBrief({
          brandAgentId: args.brandAgentId,
          brief: args.prompt,
          threshold,
        });

        // Block campaign creation if brief doesn't meet threshold
        if (!briefValidation.meetsThreshold) {
          let errorMessage = `❌ Campaign Creation Failed - Brief Quality Below Threshold\n\n`;
          errorMessage += `**Score:** ${briefValidation.score}/100 (Required: ${threshold}/100)\n`;
          errorMessage += `**Quality Level:** ${briefValidation.qualityLevel}\n\n`;

          if (briefValidation.missingElements.length > 0) {
            errorMessage += `**Missing Critical Elements:**\n`;
            for (const element of briefValidation.missingElements) {
              errorMessage += `• ${element}\n`;
            }
            errorMessage += `\n`;
          }

          if (briefValidation.suggestions.length > 0) {
            errorMessage += `**Suggestions to Improve:**\n`;
            for (const suggestion of briefValidation.suggestions) {
              errorMessage += `• ${suggestion}\n`;
            }
            errorMessage += `\n`;
          }

          errorMessage += `**Options:**\n`;
          errorMessage += `• Improve the brief based on suggestions above and try again\n`;
          errorMessage += `• Use campaign_validate_brief tool to check quality before creation\n`;
          errorMessage += `• Set skipBriefValidation: true to bypass validation (not recommended)`;

          throw new Error(errorMessage);
        }
      }

      const campaign = await client.createBrandAgentCampaign(apiKey, {
        brandAgentId: args.brandAgentId,
        budget: {
          ...args.budget,
          currency: args.budget.currency || "USD", // Default to USD if not specified
        },
        creativeIds: args.creativeIds,
        endDate: args.endDate ? new Date(args.endDate) : undefined,
        name: args.name,
        prompt: args.prompt,
        startDate: args.startDate ? new Date(args.startDate) : undefined,
      });

      let summary = `✅ Campaign Created Successfully!\n\n`;

      // Include brief validation results if validation was performed
      if (briefValidation) {
        summary += `**Brief Validation Results:**\n`;
        summary += `• Quality Score: ${briefValidation.score}/100 ✅\n`;
        summary += `• Quality Level: ${briefValidation.qualityLevel}\n`;
        if (briefValidation.feedback) {
          summary += `• AI Assessment: ${briefValidation.feedback}\n`;
        }
        summary += `\n`;
      }

      summary += `**Campaign Details:**\n`;
      summary += `• ID: ${campaign.id}\n`;
      summary += `• Name: ${campaign.name}\n`;
      summary += `• Brand Agent: ${campaign.brandAgentId}\n`;
      summary += `• Status: ${campaign.status}\n`;
      summary += `• Created: ${new Date(campaign.createdAt).toLocaleString()}\n\n`;

      if (campaign.budget) {
        summary += `**Budget Configuration:**\n`;
        summary += `• Total: ${campaign.budget.currency} ${(campaign.budget.total / 100).toLocaleString()}\n`;
        if (campaign.budget.dailyCap) {
          summary += `• Daily Cap: ${campaign.budget.currency} ${(campaign.budget.dailyCap / 100).toLocaleString()}\n`;
        }
        if (campaign.budget.pacing) {
          summary += `• Pacing: ${campaign.budget.pacing}\n`;
        }
        summary += `\n`;
      }

      if (args.startDate || args.endDate) {
        summary += `**Campaign Schedule:**\n`;
        if (args.startDate) {
          summary += `• Start Date: ${new Date(args.startDate).toLocaleString()}\n`;
        }
        if (args.endDate) {
          summary += `• End Date: ${new Date(args.endDate).toLocaleString()}\n`;
        }
        summary += `\n`;
      }

      if (campaign.creativeIds && campaign.creativeIds.length > 0) {
        summary += `**Assigned Creatives:**\n`;
        summary += `• ${campaign.creativeIds.length} creative(s) assigned\n`;
        summary += `• Creative IDs: ${campaign.creativeIds.join(", ")}\n\n`;
      }

      summary += `**Campaign Prompt:**\n`;
      summary += `"${campaign.prompt}"\n\n`;

      summary += `**What Happens Next:**\n`;
      summary += `• The AI will analyze your prompt and set up targeting\n`;
      summary += `• Campaign will begin optimization and delivery\n`;
      summary += `• You can monitor performance and make adjustments\n`;
      summary += `• Use campaign ID \`${campaign.id}\` for reporting and updates\n\n`;

      summary += `🎯 **Campaign Management:**\n`;
      summary += `• View performance: Use get_campaign_summary with this campaign ID\n`;
      summary += `• Assign more creatives: Use creative/assign tool\n`;
      summary += `• Export data: Use export_campaign_data for analytics\n`;
      summary += `• Update settings: Use update_campaign with new parameters`;

      return createMCPResponse({
        data: {
          briefValidation, // Include validation results in response data
          campaign,
          configuration: {
            brandAgentId: args.brandAgentId,
            budget: {
              ...args.budget,
              currency: args.budget.currency || "USD",
            },
            creativeIds: args.creativeIds || [],
            endDate: args.endDate,
            prompt: args.prompt,
            startDate: args.startDate,
          },
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to create brand agent campaign: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "campaign_create",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent that will own this campaign"),
    briefValidationThreshold: z
      .number()
      .min(0)
      .max(100)
      .default(70)
      .optional()
      .describe(
        "Minimum quality score required for brief validation (0-100, default: 70). Campaign creation will fail if brief scores below this threshold.",
      ),
    budget: z
      .object({
        currency: z
          .string()
          .default("USD")
          .describe("Budget currency (e.g., 'USD', 'EUR')"),
        dailyCap: z
          .number()
          .optional()
          .describe(
            "Daily spending limit in cents (e.g., 100000 = $1,000/day)",
          ),
        pacing: z
          .string()
          .optional()
          .describe(
            "Budget pacing strategy ('even', 'accelerated', or 'front_loaded')",
          ),
        total: z
          .number()
          .describe("Total campaign budget in cents (e.g., 5000000 = $50,000)"),
      })
      .describe("Budget configuration for the campaign"),
    creativeIds: z
      .array(z.string())
      .optional()
      .describe("Optional array of creative IDs to assign to this campaign"),
    endDate: z
      .string()
      .optional()
      .describe(
        "Campaign end date in UTC (ISO 8601 format, e.g., '2024-12-31T23:59:59Z')",
      ),
    name: z.string().describe("Name of the campaign"),
    prompt: z
      .string()
      .describe(
        "Natural language description of campaign objectives, targeting, and strategy",
      ),
    skipBriefValidation: z
      .boolean()
      .default(false)
      .optional()
      .describe(
        "Skip AI-powered brief validation (default: false). When false, the campaign brief will be validated against Ad Context Protocol standards.",
      ),
    startDate: z
      .string()
      .optional()
      .describe(
        "Campaign start date in UTC (ISO 8601 format, e.g., '2024-01-01T00:00:00Z')",
      ),
  }),
});
