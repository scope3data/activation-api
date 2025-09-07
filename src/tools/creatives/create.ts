import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { Creative } from "../../types/creative.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

/**
 * Create creatives via MCP orchestration (no file uploads)
 * Handles HTML snippets, JavaScript tags, VAST tags, and asset ID references
 * Supports multiple content types and assembly methods
 */
export const creativeCreateTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "creative-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Creative (Orchestration)",
  },

  description:
    "Create creatives with format specification and content sources. Supports HTML snippets, JavaScript ad tags, VAST tags, asset ID references, and product URLs. This is orchestration only - no file uploads. Can create multiple creatives at once with different assembly methods.",

  execute: async (
    args: {
      assemblyMethod?: "creative_agent" | "pre_assembled" | "publisher";
      assignToCampaignIds?: string[];
      buyerAgentId: string;
      content?: {
        assetIds?: string[];
        htmlSnippet?: string;
        javascriptTag?: string;
        productUrl?: string;
        vastTag?: string;
      };
      contentCategories?: string[];
      creativeDescription?: string;
      creativeName: string;
      externalId?: string;
      format: {
        formatId: string;
        type: "adcp" | "creative_agent" | "publisher";
      };
      targetAudience?: string;
      variants?: number;
    },
    context: MCPToolExecuteContext,
  ): Promise<string> => {
    // Check authentication
    let apiKey = context.session?.scope3ApiKey;

    if (!apiKey) {
      apiKey = process.env.SCOPE3_API_KEY;
    }

    if (!apiKey) {
      return createAuthErrorResponse();
    }

    try {
      // Validate format specification
      if (!args.format?.type || !args.format?.formatId) {
        return createErrorResponse(
          "Format specification is required. Use format.type and format.formatId to specify creative format.",
          new Error("Missing format specification"),
        );
      }

      // Validate content sources
      const { assetIds, htmlSnippet, javascriptTag, productUrl, vastTag } =
        args.content || {};
      const hasContent =
        htmlSnippet ||
        javascriptTag ||
        vastTag ||
        assetIds?.length ||
        productUrl;

      if (!hasContent) {
        return createErrorResponse(
          "At least one content source is required: htmlSnippet, javascriptTag, vastTag, assetIds, or productUrl",
          new Error("Missing content source"),
        );
      }

      // Determine variants (default 1)
      const variantCount = args.variants || 1;
      const creatives: Creative[] = [];

      // Create creative(s) through orchestration
      for (let i = 0; i < variantCount; i++) {
        const creativeName =
          variantCount > 1
            ? `${args.creativeName} (Variant ${i + 1})`
            : args.creativeName;

        const creative = await client.createCreative(apiKey, {
          assemblyMethod: args.assemblyMethod || "pre_assembled",
          buyerAgentId: args.buyerAgentId,
          content: args.content || {},
          contentCategories: args.contentCategories,
          creativeDescription: args.creativeDescription,
          creativeName,
          externalId: args.externalId,
          format: args.format,
          targetAudience: args.targetAudience,
          // Add slight variation for multiple variants
          ...(variantCount > 1 && { variantId: i }),
        });

        creatives.push(creative);
      }

      // Assign to campaigns if requested
      const assignments: { campaignIds: string[]; creativeId: string }[] = [];
      if (args.assignToCampaignIds?.length) {
        for (const creative of creatives) {
          const assignedCampaigns: string[] = [];
          for (const campaignId of args.assignToCampaignIds) {
            const result = await client.assignCreativeToCampaign(
              apiKey,
              creative.creativeId,
              campaignId,
              args.buyerAgentId,
            );
            if (result.success) {
              assignedCampaigns.push(campaignId);
            }
          }
          assignments.push({
            campaignIds: assignedCampaigns,
            creativeId: creative.creativeId,
          });
        }
      }

      // Simple response with just creative IDs as requested
      if (creatives.length === 1) {
        return createMCPResponse({
          message: `Creative created: ${creatives[0].creativeId}`,
          success: true,
        });
      } else {
        const creativeIds = creatives.map((c) => c.creativeId);
        return createMCPResponse({
          message: `Creatives created: ${creativeIds.join(", ")}`,
          success: true,
        });
      }
    } catch (error) {
      return createErrorResponse("Failed to create creative", error);
    }
  },

  name: "creative/create",

  parameters: z.object({
    // Assembly configuration
    assemblyMethod: z
      .enum(["publisher", "creative_agent", "pre_assembled"])
      .optional()
      .describe("Who assembles the creative (default: pre_assembled)"),
    // Optional immediate assignment
    assignToCampaignIds: z
      .array(z.string())
      .optional()
      .describe("Campaign IDs to immediately assign these creatives to"),
    buyerAgentId: z
      .string()
      .describe("The buyer agent that will own this creative"),
    // Content sources (at least one required)
    content: z
      .object({
        // Asset references (not uploads)
        assetIds: z
          .array(z.string())
          .optional()
          .describe("Array of asset IDs from assets/add"),
        // Pre-assembled content (ad server tags)
        htmlSnippet: z.string().optional().describe("HTML5 creative snippet"),
        javascriptTag: z
          .string()
          .optional()
          .describe("JavaScript ad tag from ad server"),

        // External sources
        productUrl: z
          .string()
          .optional()
          .describe("Product page URL for creative agent to extract from"),

        vastTag: z.string().optional().describe("VAST XML tag for video ads"),
      })
      .optional()
      .describe("Content sources - at least one is required"),

    // Marketing metadata (advertiserDomains now at brand agent level)
    contentCategories: z
      .array(z.string())
      .optional()
      .describe("IAB content categories for this creative"),

    creativeDescription: z
      .string()
      .optional()
      .describe("Description of the creative's purpose and usage"),

    creativeName: z.string().describe("Human-readable name for the creative"),
    externalId: z
      .string()
      .optional()
      .describe("Your external ID for managing this creative in your system"),

    // Format specification (required)
    format: z
      .object({
        formatId: z
          .string()
          .describe(
            "Specific format ID, e.g., 'display_banner', 'ctv_video', 'dynamic_product'",
          ),
        type: z
          .enum(["adcp", "publisher", "creative_agent"])
          .describe("Format provider type"),
      })
      .describe(
        "Creative format specification - use list_creative_formats to see available options",
      ),

    targetAudience: z
      .string()
      .optional()
      .describe("Natural language description of target audience"),

    // Multiple creatives
    variants: z
      .number()
      .min(1)
      .max(10)
      .optional()
      .describe("Number of creative variants to generate (default: 1)"),
  }),
});
