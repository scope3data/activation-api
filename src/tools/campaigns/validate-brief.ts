import { z } from "zod";

import type { BriefValidationResult } from "../../types/brief-validation.js";
import type {
  MCPToolExecuteContext,
  ValidateBriefParams,
} from "../../types/mcp.js";

import { BriefValidationService } from "../../services/brief-validation-service.js";
import { createMCPResponse } from "../../utils/error-handling.js";

export const validateBriefTool = () => ({
  annotations: {
    category: "Campaigns",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Validate Campaign Brief",
  },

  description:
    "Validate a campaign brief against Ad Context Protocol standards using AI evaluation. Returns a quality score (0-100), identifies missing elements, and provides specific suggestions for improvement. Used to ensure briefs meet quality standards before campaign creation.",

  execute: async (
    args: ValidateBriefParams,
    _context: MCPToolExecuteContext,
  ): Promise<string> => {
    try {
      const validationService = new BriefValidationService();

      const result: BriefValidationResult =
        await validationService.validateBrief({
          brandAgentId: args.brandAgentId,
          brief: args.brief,
          threshold: args.threshold ?? 70,
        });

      let summary = `## Brief Validation Results\n\n`;

      // Score and status
      const statusIcon = result.meetsThreshold ? "✅" : "❌";
      const statusText = result.meetsThreshold ? "PASSES" : "FAILS";

      summary += `**Overall Score: ${result.score}/100** ${statusIcon}\n`;
      summary += `**Quality Level:** ${result.qualityLevel}\n`;
      summary += `**Threshold:** ${result.threshold}/100\n`;
      summary += `**Status:** ${statusText} validation requirements\n\n`;

      // AI feedback
      if (result.feedback) {
        summary += `**AI Evaluation:**\n${result.feedback}\n\n`;
      }

      // Missing elements
      if (result.missingElements.length > 0) {
        summary += `**Missing Critical Elements:**\n`;
        for (const element of result.missingElements) {
          summary += `• ${element}\n`;
        }
        summary += `\n`;
      }

      // Suggestions for improvement
      if (result.suggestions.length > 0) {
        summary += `**Suggestions for Improvement:**\n`;
        for (const suggestion of result.suggestions) {
          summary += `• ${suggestion}\n`;
        }
        summary += `\n`;
      }

      // Quality guidelines
      summary += `**Brief Quality Guidelines:**\n`;
      summary += `• **Comprehensive (80-100):** Complete brief with all elements\n`;
      summary += `• **Standard (60-79):** Good brief with most key elements\n`;
      summary += `• **Minimal (30-59):** Basic brief missing important details\n`;
      summary += `• **No Brief (0-29):** Insufficient information for effective campaigns\n\n`;

      // Next steps
      if (result.meetsThreshold) {
        summary += `**✅ Brief Ready for Campaign Creation**\n`;
        summary += `This brief meets the quality threshold and can be used for campaign creation.\n\n`;
        summary += `**Recommended Actions:**\n`;
        summary += `• Proceed with campaign creation using this brief\n`;
        summary += `• Consider implementing any suggestions to further improve quality\n`;
        summary += `• Use campaign_create tool with this brief content\n`;
      } else {
        summary += `**❌ Brief Needs Improvement**\n`;
        summary += `This brief does not meet the minimum quality threshold (${result.threshold}/100).\n`;
        summary += `Campaign creation will be blocked until brief quality improves.\n\n`;
        summary += `**Required Actions:**\n`;
        summary += `• Address the missing critical elements listed above\n`;
        summary += `• Implement the suggested improvements\n`;
        summary += `• Re-validate the brief before attempting campaign creation\n`;
        summary += `• Or use skipBriefValidation: true to bypass (not recommended)\n`;
      }

      return createMCPResponse({
        data: {
          briefAnalysis: {
            characterCount: args.brief.length,
            wordCount: args.brief.split(/\s+/).length,
          },
          validation: result,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      throw new Error(
        `Failed to validate campaign brief: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "campaign_validate_brief",
  parameters: z.object({
    brandAgentId: z
      .string()
      .optional()
      .describe("Optional brand agent ID for context-aware validation"),
    brief: z
      .string()
      .min(1)
      .describe(
        "The campaign brief text to validate against Ad Context Protocol standards",
      ),
    threshold: z
      .number()
      .min(0)
      .max(100)
      .default(70)
      .describe(
        "Minimum quality score required to pass validation (default: 70)",
      ),
  }),
});
