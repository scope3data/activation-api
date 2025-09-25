import { z } from "zod";

import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { TacticBigQueryService } from "../../services/tactic-bigquery-service.js";
import { createMCPResponse } from "../../utils/error-handling.js";

const GetPrebidSegmentsSchema = z.object({
  orgId: z.string().min(1, "Organization ID is required"),
});

export const getPrebidSegmentsTool = () => ({
  annotations: {
    category: "Prebid",
    dangerLevel: "low",
    openWorldHint: false,
    readOnlyHint: true,
    title: "Get Prebid Segments",
  },

  description:
    "Get AXE inclusion segments for a publisher organization ID. Used by prebid integration to determine which buyer campaigns are targeting this publisher's inventory. Returns segment IDs and maximum CPM for auction prioritization.",

  inputSchema: GetPrebidSegmentsSchema,
  name: "get_prebid_segments",

  execute: async (
    args: unknown,
    _context: MCPToolExecuteContext,
  ): Promise<string> => {
    try {
      const validatedArgs = GetPrebidSegmentsSchema.parse(args);

      const tacticService = new TacticBigQueryService();
      const segments = await tacticService.getPrebidSegments(
        validatedArgs.orgId,
      );

      if (segments.length === 0) {
        return createMCPResponse({
          data: {
            orgId: args.orgId,
            segments: [],
            totalSegments: 0,
          },
          message: `No active campaigns targeting publisher org ${args.orgId}`,
          success: true,
        });
      }

      // Format for prebid integration
      const prebidResponse = segments.map((segment) => ({
        maxCpm: segment.max_cpm,
        segment: segment.axe_include_segment,
      }));

      let summary = `🎯 **AXE Segments for Publisher ${args.orgId}**\n\n`;

      summary += `Found **${segments.length}** active campaign targeting segments:\n\n`;

      // Show segments in order of CPM (highest first)
      segments.forEach((segment, index) => {
        summary += `${index + 1}. **${segment.axe_include_segment}**\n`;
        summary += `   • Max CPM: $${segment.max_cpm.toFixed(2)}\n`;
        summary += `   • Priority: ${index === 0 ? "Highest" : index < 3 ? "High" : "Standard"}\n\n`;
      });

      summary += `### Integration Notes\n`;
      summary += `• Pass these segments to your ad server as **inclusion targeting**\n`;
      summary += `• Higher CPM segments should get priority in auction logic\n`;
      summary += `• Segments are automatically generated and updated as campaigns change\n`;

      return createMCPResponse({
        data: {
          orgId: args.orgId,
          segments: prebidResponse,
          totalSegments: segments.length,
        },
        message: summary,
        success: true,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map((issue) => issue.message).join(", ");
        throw new Error(`Validation error: ${issues}`);
      }

      throw new Error(
        `Failed to get prebid segments: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  inputSchema: {
    properties: {
      orgId: {
        description: "Publisher organization ID (from prebid request)",
        type: "string",
      },
    },
    required: ["orgId"],
    type: "object",
  },

  name: "get_prebid_segments",
});
