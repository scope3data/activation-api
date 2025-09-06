import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  GetBrandStandardsParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const getBrandStandardsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "data-retrieval",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Get Brand Standards",
  },

  description:
    "Retrieve the current brand safety standards and media controls for a brand agent. Shows all configured domain lists, keyword filters, and content categories that apply to campaigns within this brand agent. Requires authentication.",

  execute: async (
    args: GetBrandStandardsParams,
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
      // First, verify the brand agent exists and get its name
      let brandAgentName: string;
      try {
        const brandAgent = await client.getBrandAgent(
          apiKey,
          args.brandAgentId,
        );
        brandAgentName = brandAgent.name;
      } catch (fetchError) {
        return createErrorResponse(
          "Brand agent not found. Please check the brand agent ID.",
          fetchError,
        );
      }

      const brandStandards = await client.getBrandStandards(
        apiKey,
        args.brandAgentId,
      );

      let summary = `**Brand Standards for ${brandAgentName}**\n\n`;
      summary += `**Brand Agent ID:** ${args.brandAgentId}\n`;
      summary += `**Last Updated:** ${new Date(brandStandards.updatedAt).toLocaleString()}\n\n`;

      let hasStandards = false;

      if (
        brandStandards.domainBlocklist &&
        brandStandards.domainBlocklist.length > 0
      ) {
        hasStandards = true;
        summary += `🚫 **Domain Blocklist** (${brandStandards.domainBlocklist.length} domains):\n`;
        brandStandards.domainBlocklist.forEach((domain, index) => {
          summary += `   ${index + 1}. ${domain}\n`;
        });
        summary += `\n`;
      }

      if (
        brandStandards.domainAllowlist &&
        brandStandards.domainAllowlist.length > 0
      ) {
        hasStandards = true;
        summary += `✅ **Domain Allowlist** (${brandStandards.domainAllowlist.length} domains):\n`;
        brandStandards.domainAllowlist.forEach((domain, index) => {
          summary += `   ${index + 1}. ${domain}\n`;
        });
        summary += `\n`;
      }

      if (
        brandStandards.keywordFilters &&
        brandStandards.keywordFilters.length > 0
      ) {
        hasStandards = true;
        summary += `🔍 **Keyword Filters** (${brandStandards.keywordFilters.length} keywords):\n`;
        brandStandards.keywordFilters.forEach((keyword, index) => {
          summary += `   ${index + 1}. "${keyword}"\n`;
        });
        summary += `\n`;
      }

      if (
        brandStandards.contentCategories &&
        brandStandards.contentCategories.length > 0
      ) {
        hasStandards = true;
        summary += `📂 **Content Categories** (${brandStandards.contentCategories.length} categories):\n`;
        brandStandards.contentCategories.forEach((category, index) => {
          summary += `   ${index + 1}. ${category}\n`;
        });
        summary += `\n`;
      }

      if (!hasStandards) {
        summary += `⚠️ **No Brand Standards Configured**\n\n`;
        summary += `This brand agent currently has no brand safety standards configured.\n\n`;
        summary += `**Recommendations:**\n`;
        summary += `• Set up a domain blocklist to avoid competitor or inappropriate sites\n`;
        summary += `• Configure keyword filters to avoid unwanted content associations\n`;
        summary += `• Define content categories that don't align with your brand\n`;
        summary += `• Consider setting up a domain allowlist for premium publishers\n\n`;
        summary += `Use \`set_brand_standards\` to configure brand safety rules.`;
      } else {
        summary += `📊 **Standards Summary:**\n`;
        if (brandStandards.domainBlocklist?.length) {
          summary += `• ${brandStandards.domainBlocklist.length} blocked domains\n`;
        }
        if (brandStandards.domainAllowlist?.length) {
          summary += `• ${brandStandards.domainAllowlist.length} allowed domains\n`;
        }
        if (brandStandards.keywordFilters?.length) {
          summary += `• ${brandStandards.keywordFilters.length} keyword filters\n`;
        }
        if (brandStandards.contentCategories?.length) {
          summary += `• ${brandStandards.contentCategories.length} content category filters\n`;
        }

        summary += `\n🛡️ **Brand Safety Impact:**\n`;
        summary += `• These standards apply to ALL campaigns within this brand agent\n`;
        summary += `• New campaigns automatically inherit these settings\n`;
        summary += `• Standards help ensure brand-safe media placements\n\n`;

        summary += `💡 **Management:**\n`;
        summary += `• Use \`set_brand_standards\` to update these rules\n`;
        summary += `• Changes affect all current and future campaigns`;
      }

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to fetch brand standards", error);
    }
  },

  name: "get_brand_standards",
  parameters: z.object({
    brandAgentId: z
      .string()
      .describe("ID of the brand agent to retrieve standards for"),
  }),
});
