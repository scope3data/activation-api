import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

/**
 * Update existing creative properties
 * Orchestration tool for modifying creative metadata and content
 */
export const creativeUpdateTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Creatives",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Update Creative",
  },

  description:
    "Update existing creative properties including name, status, content sources, and advertiser domains. Creates new version while preserving campaign assignments. This is orchestration only - no file uploads.",

  execute: async (
    args: {
      creativeId: string;
      updates: {
        advertiserDomains?: string[];
        content?: {
          assetIds?: string[];
          htmlSnippet?: string;
          javascriptTag?: string;
          productUrl?: string;
          vastTag?: string;
        };
        name?: string;
        status?:
          | "active"
          | "archived"
          | "draft"
          | "paused"
          | "pending_review"
          | "rejected";
      };
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check authentication
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
      // Validate that at least one update is provided
      const { advertiserDomains, content, name, status } = args.updates;
      if (!name && !status && !content && !advertiserDomains) {
        throw new Error(
          "At least one update field must be provided: name, status, content, or advertiserDomains",
        );
      }

      // Update creative through orchestration
      const updatedCreative = await client.updateCreative(apiKey, {
        creativeId: args.creativeId,
        updates: args.updates,
      });

      // Create human-readable response
      let response = `🎨 **Creative updated successfully!**

📦 **Creative Details**
• Creative ID: ${updatedCreative.creativeId}
• Name: ${updatedCreative.creativeName}
• Version: ${updatedCreative.version} (updated)
• Status: ${updatedCreative.status}
• Buyer Agent: ${updatedCreative.buyerAgentId}

🔧 **Changes Applied:**`;

      // Show what was updated
      if (name) {
        response += `
• Name updated to: ${name}`;
      }

      if (status) {
        response += `
• Status changed to: ${status}`;
      }

      if (content) {
        const contentUpdates: string[] = [];
        if (content.htmlSnippet) contentUpdates.push("HTML Snippet");
        if (content.javascriptTag) contentUpdates.push("JavaScript Tag");
        if (content.vastTag) contentUpdates.push("VAST Tag");
        if (content.assetIds?.length)
          contentUpdates.push(`${content.assetIds.length} Asset References`);
        if (content.productUrl) contentUpdates.push("Product URL");

        if (contentUpdates.length > 0) {
          response += `
• Content updated: ${contentUpdates.join(", ")}`;
        }
      }

      if (advertiserDomains) {
        response += `
• Advertiser Domains updated: ${advertiserDomains.join(", ")}`;
      }

      response += `

🌐 **Current Settings**
• Format: ${updatedCreative.format.type}/${updatedCreative.format.formatId}
• Assembly Method: ${updatedCreative.assemblyMethod}`;

      // Show asset references
      if (updatedCreative.assetIds?.length) {
        response += `
• Referenced Assets: ${updatedCreative.assetIds.join(", ")}`;
      }

      // Show campaign assignments
      if (updatedCreative.campaignAssignments?.length) {
        response += `

📋 **Campaign Assignments (${updatedCreative.campaignAssignments.length})**`;
        for (const assignment of updatedCreative.campaignAssignments) {
          const statusIcon = assignment.isActive ? "🟢" : "⚪";
          response += `
${statusIcon} ${assignment.campaignName} (${assignment.campaignId})`;
        }
      }

      response += `

⏰ **Timeline**
• Created: ${new Date(updatedCreative.createdDate).toLocaleDateString()}
• Last Modified: ${new Date(updatedCreative.lastModifiedDate).toLocaleDateString()}
• Modified By: ${updatedCreative.lastModifiedBy}

🔄 **[ARCHITECTURE]** Creative update orchestration complete:
• Version bumped automatically (safe for active campaigns)
• Campaign assignments preserved across update
• Changes processed through appropriate ${updatedCreative.format.type} provider`;

      return response;
    } catch (error) {
      throw new Error(
        `Failed to update creative: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  },

  name: "creative/update",

  parameters: z.object({
    creativeId: z.string().describe("ID of the creative to update"),

    updates: z
      .object({
        // Marketing metadata
        advertiserDomains: z
          .array(z.string())
          .optional()
          .describe("Updated advertiser click domains"),
        // Content updates (partial update)
        content: z
          .object({
            assetIds: z
              .array(z.string())
              .optional()
              .describe("Updated array of asset ID references"),
            htmlSnippet: z
              .string()
              .optional()
              .describe("Updated HTML5 creative snippet"),
            javascriptTag: z
              .string()
              .optional()
              .describe("Updated JavaScript ad tag"),
            productUrl: z
              .string()
              .optional()
              .describe("Updated product page URL"),
            vastTag: z.string().optional().describe("Updated VAST XML tag"),
          })
          .optional()
          .describe("Content sources to update"),

        // Basic properties
        name: z.string().optional().describe("New name for the creative"),

        status: z
          .enum([
            "draft",
            "pending_review",
            "active",
            "paused",
            "archived",
            "rejected",
          ])
          .optional()
          .describe("New status for the creative"),
      })
      .refine(
        (data) =>
          data.name || data.status || data.content || data.advertiserDomains,
        { message: "At least one update field must be provided" },
      )
      .describe("Update fields - at least one must be provided"),
  }),
});
