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
 * Array-first design: Always takes array of creatives to create
 * Supports ADCP snippet formats, template variables, and asset references
 * Handles bulk creative operations with shared defaults
 */
export const creativeCreateTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Creatives",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Create Creative",
  },

  description:
    "Create one or more creatives with array-first design. Each creative can have different formats, content, and assembly methods. Supports ADCP snippets, template variables for native ads, and shared defaults. Single creative = array with 1 item.",

  execute: async (
    args: {
      buyerAgentId: string;
      creatives: Array<{
        assemblyMethod?: "creative_agent" | "pre_assembled" | "publisher";
        content: {
          assetIds?: string[];
          htmlSnippet?: string;
          javascriptTag?: string;
          productUrl?: string;
          // ADCP snippet support
          snippet?: string;
          snippetType?: "DAAST" | "HTML" | "iFrame" | "JavaScript" | "VAST";
          // Native ad template variables
          templateVariables?: Record<string, string>;
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
      }>;
      processingMode?: "continue_on_error" | "fail_fast";
      sharedDefaults?: {
        assemblyMethod?: "creative_agent" | "pre_assembled" | "publisher";
        assignToCampaignIds?: string[];
        contentCategories?: string[];
        targetAudience?: string;
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
      return createAuthErrorResponse();
    }

    try {
      // Validate we have creatives to process
      if (!args.creatives || args.creatives.length === 0) {
        return createErrorResponse(
          "At least one creative is required in the creatives array",
          new Error("Empty creatives array"),
        );
      }

      const processingMode = args.processingMode || "continue_on_error";
      const createdCreatives: Creative[] = [];
      const errors: Array<{ creativeName: string; error: string }> = [];

      // Process each creative in the array
      for (const creativeSpec of args.creatives) {
        try {
          // Validate format specification for this creative
          if (!creativeSpec.format?.type || !creativeSpec.format?.formatId) {
            const error = `Creative "${creativeSpec.creativeName}": Format specification required (format.type and format.formatId)`;
            if (processingMode === "fail_fast") {
              return createErrorResponse(
                error,
                new Error("Missing format specification"),
              );
            }
            errors.push({ creativeName: creativeSpec.creativeName, error });
            continue;
          }

          // Validate content sources for this creative
          const {
            assetIds,
            htmlSnippet,
            javascriptTag,
            productUrl,
            snippet,
            snippetType,
            vastTag,
          } = creativeSpec.content;

          const hasContent =
            htmlSnippet ||
            javascriptTag ||
            vastTag ||
            assetIds?.length ||
            productUrl ||
            snippet;

          if (!hasContent) {
            const error = `Creative "${creativeSpec.creativeName}": At least one content source required (htmlSnippet, javascriptTag, vastTag, assetIds, productUrl, or snippet)`;
            if (processingMode === "fail_fast") {
              return createErrorResponse(
                error,
                new Error("Missing content source"),
              );
            }
            errors.push({ creativeName: creativeSpec.creativeName, error });
            continue;
          }

          // Validate snippet format if snippet is provided
          if (snippet && !snippetType) {
            const error = `Creative "${creativeSpec.creativeName}": snippetType required when snippet is provided`;
            if (processingMode === "fail_fast") {
              return createErrorResponse(
                error,
                new Error("Missing snippet type"),
              );
            }
            errors.push({ creativeName: creativeSpec.creativeName, error });
            continue;
          }

          // Merge with shared defaults
          const assemblyMethod =
            creativeSpec.assemblyMethod ||
            args.sharedDefaults?.assemblyMethod ||
            "pre_assembled";
          const contentCategories =
            creativeSpec.contentCategories ||
            args.sharedDefaults?.contentCategories;
          const targetAudience =
            creativeSpec.targetAudience || args.sharedDefaults?.targetAudience;

          // Create the creative
          const creative = await client.createCreative(apiKey, {
            assemblyMethod,
            buyerAgentId: args.buyerAgentId,
            content: creativeSpec.content,
            contentCategories,
            creativeDescription: creativeSpec.creativeDescription,
            creativeName: creativeSpec.creativeName,
            externalId: creativeSpec.externalId,
            format: creativeSpec.format,
            targetAudience,
          });

          createdCreatives.push(creative);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          const fullError = `Creative "${creativeSpec.creativeName}": ${errorMessage}`;

          if (processingMode === "fail_fast") {
            return createErrorResponse(fullError, error);
          }
          errors.push({
            creativeName: creativeSpec.creativeName,
            error: fullError,
          });
        }
      }

      // Assign to campaigns if requested in shared defaults
      const assignments: { campaignIds: string[]; creativeId: string }[] = [];
      if (
        args.sharedDefaults?.assignToCampaignIds?.length &&
        createdCreatives.length > 0
      ) {
        for (const creative of createdCreatives) {
          const assignedCampaigns: string[] = [];
          for (const campaignId of args.sharedDefaults.assignToCampaignIds) {
            try {
              const result = await client.assignCreativeToCampaign(
                apiKey,
                creative.creativeId,
                campaignId,
                args.buyerAgentId,
              );
              if (result.success) {
                assignedCampaigns.push(campaignId);
              }
            } catch (assignError) {
              // Continue with other assignments even if one fails
              console.warn(
                `Failed to assign creative ${creative.creativeId} to campaign ${campaignId}:`,
                assignError,
              );
            }
          }
          assignments.push({
            campaignIds: assignedCampaigns,
            creativeId: creative.creativeId,
          });
        }
      }

      // Build comprehensive response following BulkAssetImportResponse pattern
      const successCount = createdCreatives.length;
      const errorCount = errors.length;
      const totalRequested = args.creatives.length;

      let message = `📊 **Creative Creation Summary**\n\n`;
      message += `• **Success**: ${successCount}/${totalRequested} creatives created\n`;

      if (errorCount > 0) {
        message += `• **Errors**: ${errorCount} creatives failed\n\n`;
        message += `❌ **Failed Creatives:**\n`;
        errors.forEach((error) => {
          message += `  • ${error.creativeName}: ${error.error}\n`;
        });
        message += `\n`;
      }

      if (successCount > 0) {
        message += `✅ **Created Creatives:**\n`;
        createdCreatives.forEach((creative) => {
          message += `  • **${creative.creativeName}** (ID: ${creative.creativeId})\n`;
        });

        if (assignments.length > 0) {
          message += `\n🎯 **Campaign Assignments:**\n`;
          assignments.forEach((assignment) => {
            const creative = createdCreatives.find(
              (c) => c.creativeId === assignment.creativeId,
            );
            if (assignment.campaignIds.length > 0) {
              message += `  • ${creative?.creativeName}: Assigned to ${assignment.campaignIds.length} campaign(s)\n`;
            }
          });
        }
      }

      // Return appropriate response based on results
      if (errorCount === 0) {
        return createMCPResponse({
          message,
          success: true,
        });
      } else if (successCount > 0) {
        return createMCPResponse({
          message:
            message +
            `\n⚠️ **Partial Success**: ${successCount} created, ${errorCount} failed`,
          success: true,
        });
      } else {
        return createErrorResponse(
          `Failed to create any creatives. ${errorCount} errors occurred.`,
          new Error("All creative creations failed"),
        );
      }
    } catch (error) {
      return createErrorResponse(
        "Failed to process creative creation request",
        error,
      );
    }
  },

  name: "creative/create",

  parameters: z.object({
    buyerAgentId: z
      .string()
      .describe("The buyer agent that will own all creatives"),

    // Always an array - single creative is just array with 1 item
    creatives: z
      .array(
        z.object({
          // Optional per-creative overrides
          assemblyMethod: z
            .enum(["publisher", "creative_agent", "pre_assembled"])
            .optional()
            .describe("Who assembles this creative (overrides shared default)"),

          // Content sources (at least one required per creative)
          content: z
            .object({
              // Asset references (not uploads)
              assetIds: z
                .array(z.string())
                .optional()
                .describe("Array of asset IDs from assets/add"),

              // Pre-assembled content (ad server tags)
              htmlSnippet: z
                .string()
                .optional()
                .describe("HTML5 creative snippet"),
              javascriptTag: z
                .string()
                .optional()
                .describe("JavaScript ad tag from ad server"),
              // External sources
              productUrl: z
                .string()
                .optional()
                .describe(
                  "Product page URL for creative agent to extract from",
                ),

              // ADCP snippet support (new)
              snippet: z
                .string()
                .optional()
                .describe("Third-party creative snippet (ADCP format)"),
              snippetType: z
                .enum(["VAST", "HTML", "JavaScript", "iFrame", "DAAST"])
                .optional()
                .describe(
                  "Type of creative snippet (required if snippet provided)",
                ),

              // Native ad template variables (new)
              templateVariables: z
                .record(z.string())
                .optional()
                .describe("Template variable mapping for native ad formats"),

              vastTag: z
                .string()
                .optional()
                .describe("VAST XML tag for video ads"),
            })
            .describe("Content sources - at least one is required"),

          contentCategories: z
            .array(z.string())
            .optional()
            .describe(
              "IAB content categories for this creative (overrides shared default)",
            ),

          creativeDescription: z
            .string()
            .optional()
            .describe("Description of this creative's purpose and usage"),

          creativeName: z
            .string()
            .describe("Human-readable name for this creative"),

          externalId: z
            .string()
            .optional()
            .describe(
              "Your external ID for managing this creative in your system",
            ),

          // Format specification (required per creative)
          format: z
            .object({
              formatId: z
                .string()
                .describe(
                  "Specific format ID, e.g., 'display_banner', 'native_sponsored_post'",
                ),
              type: z
                .enum(["adcp", "publisher", "creative_agent"])
                .describe("Format provider type"),
            })
            .describe(
              "Creative format specification - use format/list to see available options",
            ),

          targetAudience: z
            .string()
            .optional()
            .describe(
              "Target audience for this creative (overrides shared default)",
            ),
        }),
      )
      .min(1)
      .describe("Array of creatives to create (minimum 1, no maximum limit)"),

    // Processing configuration
    processingMode: z
      .enum(["fail_fast", "continue_on_error"])
      .optional()
      .describe(
        "How to handle errors: fail_fast stops on first error, continue_on_error processes all creatives (default: continue_on_error)",
      ),

    // Shared defaults applied to all creatives
    sharedDefaults: z
      .object({
        assemblyMethod: z
          .enum(["publisher", "creative_agent", "pre_assembled"])
          .optional()
          .describe(
            "Default assembly method for all creatives (default: pre_assembled)",
          ),

        assignToCampaignIds: z
          .array(z.string())
          .optional()
          .describe("Campaign IDs to assign all created creatives to"),

        contentCategories: z
          .array(z.string())
          .optional()
          .describe("Default IAB content categories for all creatives"),

        targetAudience: z
          .string()
          .optional()
          .describe("Default target audience description for all creatives"),
      })
      .optional()
      .describe(
        "Shared defaults applied to all creatives (can be overridden per creative)",
      ),
  }),
});
