import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { createMCPResponse } from "../../utils/error-handling.js";

export const listPMPsTool = (client: Scope3ApiClient) =>
  ({
    annotations: {
      category: "PMPs",
      dangerLevel: "low",
      openWorldHint: true,
      readOnlyHint: true,
      title: "List PMPs",
    },
    description:
      "List all PMPs for a brand agent with their deal IDs and status",
    execute: async (
      {
        brand_agent_id,
      }: {
        brand_agent_id: string;
      },
      context: MCPToolExecuteContext,
    ) => {
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
        const pmps = await client.listBrandAgentPMPs(apiKey, brand_agent_id);

        if (pmps.length === 0) {
          const message = `## No PMPs Found\n\nNo Private Marketplace deals found for brand agent \`${brand_agent_id}\`.\n\n💡 **Tip:** Use \`create_brand_agent_pmp\` to create your first PMP deal.`;
          return createMCPResponse({
            message,
            success: true,
            data: {
              brandAgentId: brand_agent_id,
              pmps: [],
              count: 0,
              summary: {
                totalPmps: 0,
                activePmps: 0,
                pausedPmps: 0,
                draftPmps: 0,
                totalDealIds: 0,
                activeDealIds: 0,
                pendingDealIds: 0,
                sspList: [],
              },
            },
          });
        }

        // Format PMPs in a readable table
        const pmpsFormatted = pmps
          .map((pmp) => {
            const statusIcon =
              pmp.status === "active"
                ? "✅"
                : pmp.status === "paused"
                  ? "⏸️"
                  : "📝";
            const statusText =
              pmp.status.charAt(0).toUpperCase() + pmp.status.slice(1);

            const dealIdsList =
              pmp.dealIds.length > 0
                ? pmp.dealIds
                    .map((d) => {
                      const dealStatusIcon =
                        d.status === "active"
                          ? "🟢"
                          : d.status === "pending"
                            ? "🟡"
                            : "⏸️";
                      return `    • ${d.ssp}: ${d.dealId} ${dealStatusIcon}`;
                    })
                    .join("\n")
                : "    • No deal IDs available";

            const createdDate = new Date(pmp.createdAt).toLocaleDateString();

            return (
              `### ${statusIcon} ${pmp.name}\n` +
              `**ID:** ${pmp.id}\n` +
              `**Status:** ${statusText}\n` +
              `**Created:** ${createdDate}\n` +
              `**Deal IDs:**\n${dealIdsList}\n` +
              `**Summary:** ${pmp.summary || "No summary available"}\n`
            );
          })
          .join("\n---\n\n");

        const totalActive = pmps.filter((p) => p.status === "active").length;
        const totalDealIds = pmps.reduce(
          (sum, pmp) => sum + pmp.dealIds.length,
          0,
        );

        const response =
          `## PMPs for Brand Agent ${brand_agent_id}\n\n` +
          `**Summary:** ${pmps.length} PMP(s) total • ${totalActive} active • ${totalDealIds} deal ID(s)\n\n` +
          `${pmpsFormatted}\n\n` +
          `*Use \`update_brand_agent_pmp\` to modify existing PMPs or \`create_brand_agent_pmp\` to create new ones.*`;

        const activeDealIds = pmps.reduce(
          (sum, pmp) => sum + pmp.dealIds.filter(d => d.status === "active").length,
          0,
        );
        const pendingDealIds = pmps.reduce(
          (sum, pmp) => sum + pmp.dealIds.filter(d => d.status === "pending").length,
          0,
        );
        const allSsps = [...new Set(pmps.flatMap(pmp => pmp.dealIds.map(d => d.ssp)))];
        const pausedPmps = pmps.filter(p => p.status === "paused").length;
        const draftPmps = pmps.filter(p => p.status === "draft").length;

        return createMCPResponse({
          message: response,
          success: true,
          data: {
            brandAgentId: brand_agent_id,
            pmps,
            count: pmps.length,
            summary: {
              totalPmps: pmps.length,
              activePmps: totalActive,
              pausedPmps,
              draftPmps,
              totalDealIds,
              activeDealIds,
              pendingDealIds,
              sspList: allSsps,
            },
            groupedByStatus: {
              active: pmps.filter(p => p.status === "active"),
              paused: pmps.filter(p => p.status === "paused"),
              draft: pmps.filter(p => p.status === "draft"),
            },
          },
        });
      } catch (error) {
        throw new Error(
          `Error listing PMPs: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
    name: "pmp/list",
    parameters: z.object({
      brand_agent_id: z.string().describe("Brand agent ID to list PMPs for"),
    }),
  }) as const;

export { listPMPsTool as default };
