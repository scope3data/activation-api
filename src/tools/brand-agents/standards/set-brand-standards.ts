import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  SetBrandStandardsParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const setBrandStandardsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "brand-safety",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Set Brand Standards",
  },

  description:
    "Set or update brand safety standards and media controls for a brand agent. These standards apply to all campaigns within the brand agent and help ensure brand-safe media placements. Currently supports domain blocklists/allowlists, keyword filters, and content categories (stub implementation). Requires authentication.",

  execute: async (
    args: SetBrandStandardsParams,
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
      // First, verify the brand agent exists
      let brandAgentName: string;
      try {
        const brandAgent = await client.getBrandAgent(apiKey, args.brandAgentId);
        brandAgentName = brandAgent.name;
      } catch (fetchError) {
        return createErrorResponse(
          "Brand agent not found. Please check the brand agent ID.",
          fetchError,
        );
      }

      const standardsInput = {
        domainBlocklist: args.domainBlocklist,
        domainAllowlist: args.domainAllowlist,
        keywordFilters: args.keywordFilters,
        contentCategories: args.contentCategories,
      };

      // Filter out undefined values
      const filteredInput = Object.entries(standardsInput)
        .filter(([_, value]) => value !== undefined)
        .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

      if (Object.keys(filteredInput).length === 0) {
        return createMCPResponse({
          message: "No brand standards specified. Please provide at least one standard to set (domainBlocklist, domainAllowlist, keywordFilters, or contentCategories).",
          success: false,
        });
      }

      const brandStandards = await client.setBrandStandards(
        apiKey,
        args.brandAgentId,
        filteredInput,
      );

      let summary = `✅ Brand Standards Updated Successfully!\n\n`;
      summary += `**Brand Agent:** ${brandAgentName} (${args.brandAgentId})\n`;
      summary += `**Updated:** ${new Date(brandStandards.updatedAt).toLocaleString()}\n\n`;
      
      summary += `**Applied Standards:**\n`;
      
      if (brandStandards.domainBlocklist && brandStandards.domainBlocklist.length > 0) {
        summary += `• **Domain Blocklist** (${brandStandards.domainBlocklist.length} domains):\n`;
        brandStandards.domainBlocklist.slice(0, 5).forEach(domain => {
          summary += `   - ${domain}\n`;
        });
        if (brandStandards.domainBlocklist.length > 5) {
          summary += `   ... and ${brandStandards.domainBlocklist.length - 5} more\n`;
        }
      }
      
      if (brandStandards.domainAllowlist && brandStandards.domainAllowlist.length > 0) {
        summary += `• **Domain Allowlist** (${brandStandards.domainAllowlist.length} domains):\n`;
        brandStandards.domainAllowlist.slice(0, 5).forEach(domain => {
          summary += `   - ${domain}\n`;
        });
        if (brandStandards.domainAllowlist.length > 5) {
          summary += `   ... and ${brandStandards.domainAllowlist.length - 5} more\n`;
        }
      }
      
      if (brandStandards.keywordFilters && brandStandards.keywordFilters.length > 0) {
        summary += `• **Keyword Filters** (${brandStandards.keywordFilters.length} filters):\n`;
        brandStandards.keywordFilters.slice(0, 5).forEach(keyword => {
          summary += `   - ${keyword}\n`;
        });
        if (brandStandards.keywordFilters.length > 5) {
          summary += `   ... and ${brandStandards.keywordFilters.length - 5} more\n`;
        }
      }
      
      if (brandStandards.contentCategories && brandStandards.contentCategories.length > 0) {
        summary += `• **Content Categories** (${brandStandards.contentCategories.length} categories):\n`;
        brandStandards.contentCategories.slice(0, 5).forEach(category => {
          summary += `   - ${category}\n`;
        });
        if (brandStandards.contentCategories.length > 5) {
          summary += `   ... and ${brandStandards.contentCategories.length - 5} more\n`;
        }
      }

      summary += `\n📋 **Impact:**\n`;
      summary += `• These standards now apply to ALL campaigns within this brand agent\n`;
      summary += `• New campaigns will automatically inherit these settings\n`;
      summary += `• Existing campaigns will be updated with these standards\n\n`;
      
      summary += `🛡️ **Brand Safety:**\n`;
      if (brandStandards.domainBlocklist && brandStandards.domainBlocklist.length > 0) {
        summary += `• Ads will NOT appear on ${brandStandards.domainBlocklist.length} blocked domains\n`;
      }
      if (brandStandards.keywordFilters && brandStandards.keywordFilters.length > 0) {
        summary += `• Content with ${brandStandards.keywordFilters.length} filtered keywords will be avoided\n`;
      }
      
      summary += `\n💡 **Note:** This is a stub implementation. Full brand safety features will be expanded in future releases.`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to set brand standards", error);
    }
  },

  name: "set_brand_standards",
  parameters: z.object({
    brandAgentId: z.string().describe("ID of the brand agent to set standards for"),
    domainBlocklist: z
      .array(z.string())
      .optional()
      .describe("List of domains to block (e.g., ['competitor.com', 'inappropriate-site.com'])"),
    domainAllowlist: z
      .array(z.string())
      .optional()
      .describe("List of domains to allow (overrides other restrictions)"),
    keywordFilters: z
      .array(z.string())
      .optional()
      .describe("Keywords to filter out from content (e.g., ['gambling', 'politics'])"),
    contentCategories: z
      .array(z.string())
      .optional()
      .describe("Content categories to avoid (e.g., ['adult', 'violence', 'drugs'])"),
  }),
});