import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

/**
 * Attach creative(s) to a campaign with option to create new creatives inline
 * Campaign-centric approach for creative management
 */
export const campaignAttachCreativeTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "campaign-management",
    dangerLevel: "medium",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Attach Creatives to Campaign",
  },

  description:
    "Attach existing creatives to a campaign or create new creatives and attach them in one operation. This is the campaign-centric way to manage creative assignments, allowing you to build a campaign's creative strategy efficiently.",

  execute: async (
    args: {
      campaignId: string;
      buyerAgentId: string;
      creativeIds?: string[];
      newCreatives?: Array<{
        creativeName: string;
        assets: Array<{
          assetName: string;
          assetType: 'image' | 'video' | 'text' | 'audio' | 'html' | 'native_component';
          fileUrl?: string;
          textContent?: {
            headline?: string;
            bodyText?: string;
            callToAction?: string;
          };
        }>;
        advertiserDomains: string[];
      }>;
      prompt?: string;
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

    if (!args.creativeIds?.length && !args.newCreatives?.length && !args.prompt) {
      return createErrorResponse(
        "Must provide either existing creative IDs, new creatives to create, or a prompt",
        new Error("No creatives specified")
      );
    }

    try {
      const results: string[] = [];
      const attachedCreativeIds: string[] = [];

      // Attach existing creatives
      if (args.creativeIds?.length) {
        for (const creativeId of args.creativeIds) {
          const result = await client.assignCreativeToCampaign(
            apiKey,
            creativeId,
            args.campaignId,
            args.buyerAgentId
          );
          if (result.success) {
            results.push(`✅ Attached existing creative ${creativeId}`);
            attachedCreativeIds.push(creativeId);
          } else {
            results.push(`❌ Failed to attach creative ${creativeId}: ${result.message}`);
          }
        }
      }

      // Create and attach new creatives
      if (args.newCreatives?.length) {
        for (const newCreative of args.newCreatives) {
          try {
            const creative = await client.createCreative(apiKey, args.buyerAgentId, {
              creativeName: newCreative.creativeName,
              assets: newCreative.assets,
              advertiserDomains: newCreative.advertiserDomains,
            });

            const assignResult = await client.assignCreativeToCampaign(
              apiKey,
              creative.creativeId,
              args.campaignId,
              args.buyerAgentId
            );

            if (assignResult.success) {
              results.push(`✅ Created and attached new creative "${newCreative.creativeName}" (${creative.creativeId})`);
              attachedCreativeIds.push(creative.creativeId);
            } else {
              results.push(`⚠️ Created creative "${newCreative.creativeName}" but failed to attach: ${assignResult.message}`);
            }
          } catch (error) {
            results.push(`❌ Failed to create creative "${newCreative.creativeName}": ${error}`);
          }
        }
      }

      // Process prompt for creative requirements
      if (args.prompt) {
        try {
          const parsed = await client.parseCreativePrompt(apiKey, args.prompt);
          
          const creative = await client.createCreative(apiKey, args.buyerAgentId, {
            creativeName: parsed.suggestedName,
            assets: parsed.suggestedAssets,
            advertiserDomains: parsed.advertiserDomains || ['example.com'],
            contentCategories: parsed.contentCategories,
          });

          const assignResult = await client.assignCreativeToCampaign(
            apiKey,
            creative.creativeId,
            args.campaignId,
            args.buyerAgentId
          );

          if (assignResult.success) {
            results.push(`✅ Created and attached creative from prompt: "${parsed.suggestedName}" (${creative.creativeId})`);
            attachedCreativeIds.push(creative.creativeId);
          } else {
            results.push(`⚠️ Created creative from prompt but failed to attach: ${assignResult.message}`);
          }
        } catch (error) {
          results.push(`❌ Failed to process prompt: ${error}`);
        }
      }

      const response = `🎯 **Campaign Creative Update Complete**

📊 **Campaign**: ${args.campaignId}
🏢 **Buyer Agent**: ${args.buyerAgentId}

📋 **Results (${results.length} operations):**
${results.join('\n')}

${attachedCreativeIds.length > 0 ? `✅ **Successfully Attached (${attachedCreativeIds.length} creatives):**
${attachedCreativeIds.map(id => `• ${id}`).join('\n')}` : ''}

💡 **What's Next:**
• Check campaign performance with updated creatives
• Use \`campaign/list_creatives\` to see all assigned creatives
• Monitor creative performance and optimize as needed

🔄 **[STUB]** Creative attachments will be processed by AdCP publishers:
• Validation of creative-campaign compatibility
• Automatic optimization based on campaign targeting
• Real-time performance tracking setup`;

      return createMCPResponse({ message: response, success: true });

    } catch (error) {
      return createErrorResponse("Failed to attach creatives to campaign", error);
    }
  },

  name: "campaign/attach_creative",

  parameters: z.object({
    campaignId: z.string().describe("Campaign/strategy ID to attach creatives to"),
    buyerAgentId: z.string().describe("Buyer agent ID (must match campaign's agent)"),
    
    // Option 1: Attach existing creatives
    creativeIds: z.array(z.string()).optional().describe("Existing creative IDs to attach"),
    
    // Option 2: Create and attach new creatives
    newCreatives: z.array(z.object({
      creativeName: z.string().describe("Name for the new creative"),
      assets: z.array(z.object({
        assetName: z.string(),
        assetType: z.enum(['image', 'video', 'text', 'audio', 'html', 'native_component']),
        fileUrl: z.string().optional(),
        textContent: z.object({
          headline: z.string().optional(),
          bodyText: z.string().optional(),
          callToAction: z.string().optional(),
        }).optional(),
      })),
      advertiserDomains: z.array(z.string()).describe("Domains for click-through"),
    })).optional().describe("New creatives to create and attach"),
    
    // Option 3: Natural language prompt
    prompt: z.string().optional().describe("Natural language description of creatives to create and attach"),
  }),
});