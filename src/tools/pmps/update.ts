import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const updateBrandAgentPMPTool = (client: Scope3ApiClient) =>
  ({
    annotations: {
      category: "System",
      dangerLevel: "medium",
      openWorldHint: true,
      readOnlyHint: false,
      title: "Update Brand Agent PMP",
    },
    description:
      "Update an existing PMP with new requirements. The backend will parse the new prompt and adjust deal IDs accordingly.",
    execute: async (
      {
        name,
        pmp_id,
        prompt,
        status,
      }: {
        name?: string;
        pmp_id: string;
        prompt?: string;
        status?: "active" | "draft" | "paused";
      },
      context: MCPToolExecuteContext,
    ) => {
      // Check session context first, then fall back to environment variable
      let apiKey = context.session?.scope3ApiKey;

      if (!apiKey) {
        apiKey = process.env.SCOPE3_API_KEY;
      }

      if (!apiKey) {
        return createAuthErrorResponse();
      }

      if (!prompt && !name && !status) {
        return createErrorResponse(
          "At least one of prompt, name, or status must be provided to update the PMP.",
          new Error("Missing required parameters"),
        );
      }

      try {
        const updatedPMP = await client.updateBrandAgentPMP(apiKey, pmp_id, {
          name,
          prompt,
          status,
        });

        // Format deal IDs with status indicators
        const dealIdsList = updatedPMP.dealIds
          .map((d) => {
            const statusIcon =
              d.status === "active"
                ? "🟢"
                : d.status === "pending"
                  ? "🟡"
                  : "⏸️";
            return `  • **${d.ssp}**: ${d.dealId} ${statusIcon} ${d.status}`;
          })
          .join("\n");

        const statusIcon =
          updatedPMP.status === "active"
            ? "✅"
            : updatedPMP.status === "paused"
              ? "⏸️"
              : "📝";
        const statusText =
          updatedPMP.status === "active"
            ? "Active"
            : updatedPMP.status === "paused"
              ? "Paused"
              : "Draft";

        const updateSummary = [];
        if (name) updateSummary.push("name");
        if (prompt) updateSummary.push("requirements");
        if (status) updateSummary.push("status");

        const response =
          `${statusIcon} **PMP Updated Successfully!**\n\n` +
          `**PMP ID:** ${updatedPMP.id}\n` +
          `**Name:** ${updatedPMP.name}\n` +
          `**Status:** ${statusText}\n` +
          `**Updated:** ${updateSummary.join(", ")}\n\n` +
          `**Current Deal IDs:**\n${dealIdsList}\n\n` +
          `**Summary:**\n${updatedPMP.summary}\n\n` +
          `*Last updated: ${updatedPMP.updatedAt.toLocaleString()}*`;

        return createMCPResponse({
          message: response,
          success: true,
        });
      } catch (error) {
        return createErrorResponse("Error updating PMP", error);
      }
    },
    name: "pmp/update",
    parameters: z.object({
      name: z.string().optional().describe("New name for the PMP"),
      pmp_id: z.string().describe("ID of the PMP to update"),
      prompt: z
        .string()
        .optional()
        .describe(
          "New requirements in natural language (e.g., 'Add Netflix CTV inventory and increase budget by 20%')",
        ),
      status: z
        .enum(["active", "paused", "draft"])
        .optional()
        .describe("Update the PMP status"),
    }),
  }) as const;

export { updateBrandAgentPMPTool as default };
