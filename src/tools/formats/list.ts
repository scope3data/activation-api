import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

/**
 * List all available creative formats from AdCP, publishers, and creative agents
 * Discovery tool for understanding what creative formats can be created
 */
export const listCreativeFormatsTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "Creatives",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "List Creative Formats",
  },

  description:
    "List all available creative formats from AdCP standards, publishers, and creative agents. Use this to discover format options before creating creatives. Shows requirements, capabilities, and assembly methods for each format.",

  execute: async (
    args: {
      acceptsThirdPartyTags?: boolean;
      assemblyCapable?: boolean;
      search?: string;
      type?: "adcp" | "creative_agent" | "publisher";
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
      // Get creative formats from all providers
      const formats = await client.listCreativeFormats(apiKey, {
        acceptsThirdPartyTags: args.acceptsThirdPartyTags,
        assemblyCapable: args.assemblyCapable,
        search: args.search,
        type: args.type,
      });

      // Create human-readable response
      let response = `🎨 **Available Creative Formats**

📊 **Summary**
• AdCP Formats: ${formats.adcp_formats.length}
• Publisher Formats: ${formats.publisher_formats.length}  
• Creative Agent Formats: ${formats.creative_agent_formats.length}
• Total Formats: ${formats.adcp_formats.length + formats.publisher_formats.length + formats.creative_agent_formats.length}

---

## 🌐 **AdCP Standard Formats**
*Industry-standard formats from Ad Context Protocol*
`;

      // List AdCP formats
      if (formats.adcp_formats.length === 0) {
        response += `
*No AdCP formats available*`;
      } else {
        for (const format of formats.adcp_formats) {
          response += `

### **${format.name}**
• **Format ID**: \`adcp/${format.formatId}\`
• **Description**: ${format.description}`;

          // Show capabilities
          const capabilities: string[] = [];
          if (format.requirements.assemblyCapable)
            capabilities.push("Assembly from assets");
          if (format.requirements.acceptsThirdPartyTags)
            capabilities.push("Third-party ad tags");

          if (capabilities.length > 0) {
            response += `
• **Capabilities**: ${capabilities.join(", ")}`;
          }

          // Show required assets
          if (format.requirements.requiredAssets.length > 0) {
            response += `
• **Required Assets**:`;
            for (const asset of format.requirements.requiredAssets) {
              response += `
  - ${asset.type}`;
              if (asset.specs.dimensions)
                response += ` (${asset.specs.dimensions})`;
              if (asset.specs.maxSize)
                response += ` (max: ${asset.specs.maxSize})`;
              if (asset.specs.formats?.length)
                response += ` [${asset.specs.formats.join(", ")}]`;
            }
          }
        }
      }

      response += `

---

## 🏢 **Publisher-Specific Formats**
*Custom formats from advertising publishers*
`;

      // List Publisher formats
      if (formats.publisher_formats.length === 0) {
        response += `
*No publisher formats available*`;
      } else {
        for (const format of formats.publisher_formats) {
          response += `

### **${format.name}**
• **Format ID**: \`publisher/${format.formatId}\`
• **Description**: ${format.description}`;

          // Show capabilities
          const capabilities: string[] = [];
          if (format.requirements.assemblyCapable)
            capabilities.push("Assembly from assets");
          if (format.requirements.acceptsThirdPartyTags)
            capabilities.push("Third-party ad tags");

          if (capabilities.length > 0) {
            response += `
• **Capabilities**: ${capabilities.join(", ")}`;
          }

          // Show required assets
          if (format.requirements.requiredAssets.length > 0) {
            response += `
• **Required Assets**:`;
            for (const asset of format.requirements.requiredAssets) {
              response += `
  - ${asset.type}`;
              if (asset.specs.dimensions)
                response += ` (${asset.specs.dimensions})`;
              if (asset.specs.maxSize)
                response += ` (max: ${asset.specs.maxSize})`;
              if (asset.specs.formats?.length)
                response += ` [${asset.specs.formats.join(", ")}]`;
            }
          }
        }
      }

      response += `

---

## 🤖 **Creative Agent Formats**
*AI-powered creative assembly and generation*
`;

      // List Creative Agent formats
      if (formats.creative_agent_formats.length === 0) {
        response += `
*No creative agent formats available*`;
      } else {
        for (const format of formats.creative_agent_formats) {
          response += `

### **${format.name}**
• **Format ID**: \`creative_agent/${format.formatId}\`
• **Description**: ${format.description}`;

          // Show capabilities
          const capabilities: string[] = [];
          if (format.requirements.assemblyCapable)
            capabilities.push("Assembly from assets");
          if (format.requirements.acceptsThirdPartyTags)
            capabilities.push("Third-party ad tags");

          if (capabilities.length > 0) {
            response += `
• **Capabilities**: ${capabilities.join(", ")}`;
          }

          // Show required assets
          if (format.requirements.requiredAssets.length > 0) {
            response += `
• **Required Assets**:`;
            for (const asset of format.requirements.requiredAssets) {
              response += `
  - ${asset.type}`;
              if (asset.specs.dimensions)
                response += ` (${asset.specs.dimensions})`;
              if (asset.specs.maxSize)
                response += ` (max: ${asset.specs.maxSize})`;
              if (asset.specs.formats?.length)
                response += ` [${asset.specs.formats.join(", ")}]`;
            }
          }
        }
      }

      response += `

---

## 💡 **Usage Examples**

**Using AdCP formats:**
\`\`\`
creative/create format.type="adcp" format.formatId="display_banner"
\`\`\`

**Using publisher formats:**
\`\`\`
creative/create format.type="publisher" format.formatId="ctv_video"  
\`\`\`

**Using creative agent formats:**
\`\`\`
creative/create format.type="creative_agent" format.formatId="dynamic_product"
\`\`\`

🔄 **[DISCOVERY]** Format discovery complete:
• ${formats.adcp_formats.length + formats.publisher_formats.length + formats.creative_agent_formats.length} total formats available
• Use format IDs exactly as shown in creative/create calls
• Check capabilities before choosing assembly methods`;

      return createMCPResponse({ message: response, success: true });
    } catch (error) {
      return createErrorResponse("Failed to list creative formats", error);
    }
  },

  name: "format/list",

  parameters: z.object({
    acceptsThirdPartyTags: z
      .boolean()
      .optional()
      .describe("Filter formats that accept ad server tags"),
    assemblyCapable: z
      .boolean()
      .optional()
      .describe("Filter formats that can assemble from assets"),
    search: z
      .string()
      .optional()
      .describe("Search in format names and descriptions"),
    // Optional filters
    type: z
      .enum(["adcp", "publisher", "creative_agent"])
      .optional()
      .describe("Filter by format provider type"),
  }),
});
