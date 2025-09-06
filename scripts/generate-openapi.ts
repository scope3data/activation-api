#!/usr/bin/env tsx

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * OpenAPI Generation Script
 *
 * This script extracts MCP tool definitions and generates a comprehensive
 * OpenAPI specification for the Scope3 Agentic Campaign API.
 *
 * Features:
 * - Auto-generates from MCP tool definitions
 * - Includes x-llm-hints from tool descriptions
 * - Creates proper schema definitions
 * - Adds migration notes and examples
 * - Validates output against OpenAPI 3.1 spec
 *
 * Note: Uses 'any' types due to dynamic MCP tool schema processing
 */

import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";
import { stringify } from "yaml";

import { Scope3ApiClient } from "../src/client/scope3-client.js";
// Import MCP tools dynamically
import * as toolsModule from "../src/tools/index.js";

interface OpenAPIOperation {
  description: string;
  operationId: string;
  parameters?: Array<{
    description?: string;
    in: "header" | "path" | "query";
    name: string;
    required?: boolean;
    schema: unknown;
  }>;
  requestBody?: {
    content: {
      "application/json": {
        examples?: Record<string, unknown>;
        schema: unknown;
      };
    };
    required: boolean;
  };
  responses: {
    [statusCode: string]: {
      content: {
        "application/json": {
          examples?: Record<string, unknown>;
          schema: unknown;
        };
      };
      description: string;
    };
  };
  summary: string;
  "x-llm-hints": string[];
  "x-migration-notes"?: Record<string, string>;
}

interface OpenAPIPath {
  [method: string]: OpenAPIOperation;
}

interface OpenAPISpec {
  components: {
    schemas: Record<string, unknown>;
    securitySchemes: Record<string, unknown>;
  };
  info: {
    description: string;
    title: string;
    version: string;
  };
  openapi: string;
  paths: Record<string, OpenAPIPath>;
  security: Array<Record<string, string[]>>;
  servers: Array<{
    description: string;
    url: string;
  }>;
}

function convertZodToJsonSchema(zodSchema: unknown): unknown {
  // Simple Zod to JSON Schema conversion
  // In production, you'd use a proper library like zod-to-json-schema
  if (typeof zodSchema === "object" && zodSchema !== null) {
    const schema = zodSchema as any;

    // Handle Zod object schemas
    if (schema._def?.typeName === "ZodObject") {
      const properties: Record<string, unknown> = {};
      const required: string[] = [];

      for (const [key, value] of Object.entries(schema._def.shape || {})) {
        properties[key] = convertZodToJsonSchema(value);
        if (!(value as any).isOptional?.()) {
          required.push(key);
        }
      }

      return {
        properties,
        required: required.length > 0 ? required : undefined,
        type: "object",
      };
    }

    // Handle Zod string schemas
    if (schema._def?.typeName === "ZodString") {
      return { type: "string" };
    }

    // Handle Zod number schemas
    if (schema._def?.typeName === "ZodNumber") {
      return { type: "number" };
    }

    // Handle Zod boolean schemas
    if (schema._def?.typeName === "ZodBoolean") {
      return { type: "boolean" };
    }

    // Handle Zod array schemas
    if (schema._def?.typeName === "ZodArray") {
      return {
        items: convertZodToJsonSchema(schema._def.type),
        type: "array",
      };
    }
  }

  // Fallback
  return { type: "string" };
}

function extractLLMHints(description: string): string[] {
  // Extract hints from tool descriptions
  const hints = [
    "Use this tool when user wants to " +
      description.toLowerCase().split(".")[0],
  ];

  // Add more specific hints based on tool patterns
  if (description.includes("create")) {
    hints.push("Call this when user says 'create', 'make', 'set up', or 'add'");
  }
  if (description.includes("list") || description.includes("get")) {
    hints.push("Call this when user asks 'show me', 'list', or 'what are my'");
  }
  if (description.includes("update")) {
    hints.push(
      "Call this when user says 'change', 'update', 'modify', or 'edit'",
    );
  }
  if (description.includes("delete")) {
    hints.push("Call this when user says 'delete', 'remove', or 'destroy'");
  }

  return hints;
}

function generateExampleForTool(toolName: string): Record<string, unknown> {
  const examples: Record<string, Record<string, unknown>> = {
    create_brand_agent: {
      agency: {
        summary: "Create agency client brand agent",
        value: {
          description: "B2B software company targeting enterprise customers",
          name: "Acme Corp",
        },
      },
      nike: {
        summary: "Create Nike brand agent",
        value: {
          description: "Global athletic wear and equipment brand",
          name: "Nike Global",
        },
      },
    },
    create_campaign: {
      holiday: {
        summary: "Holiday campaign",
        value: {
          brandAgentId: "ba_nike_123",
          budget: {
            currency: "USD",
            dailyCap: 100000,
            pacing: "even",
            total: 5000000,
          },
          name: "Holiday Sale 2024",
          prompt:
            "Target gift buyers during holiday season with our premium athletic wear, focusing on people shopping for fitness enthusiasts and athletes",
        },
      },
      product_launch: {
        summary: "Product launch campaign",
        value: {
          brandAgentId: "ba_nike_123",
          budget: {
            currency: "USD",
            total: 7500000,
          },
          name: "New Running Shoe Launch",
          prompt:
            "Launch our latest running shoe to serious runners and marathon enthusiasts aged 25-45 in major metropolitan areas",
        },
      },
    },
    create_creative: {
      image: {
        summary: "Image creative",
        value: {
          brandAgentId: "ba_nike_123",
          cta: "Discover More",
          headline: "Premium Athletic Wear",
          name: "Product Hero Image",
          type: "image",
          url: "https://cdn.nike.com/product-hero.jpg",
        },
      },
      video: {
        summary: "Video creative",
        value: {
          brandAgentId: "ba_nike_123",
          cta: "Shop Now",
          headline: "Just Do It",
          name: "Hero Video 30s",
          type: "video",
          url: "https://cdn.nike.com/hero-video-30s.mp4",
        },
      },
    },
  };

  return (
    examples[toolName] || {
      basic: {
        summary: "Basic example",
        value: {},
      },
    }
  );
}

function generateMigrationNotes(toolName: string): Record<string, string> {
  const migrationMappings: Record<string, Record<string, string>> = {
    create_audience: {
      amazon: "Creates an enhanced Audience with AI modeling",
      dv360: "Creates an enhanced Audience List with AI modeling",
      ttd: "Creates an enhanced Audience Segment with AI modeling",
    },
    create_brand_agent: {
      amazon: "Creates an Account equivalent",
      dv360: "Creates an Advertiser account equivalent",
      ttd: "Creates an Advertiser account equivalent",
    },
    create_campaign: {
      amazon: "Creates an Order equivalent",
      dv360: "Creates an Insertion Order equivalent",
      ttd: "Creates a Line Item equivalent within your Advertiser",
    },
    create_creative: {
      amazon:
        "Creates a Creative asset (same concept, but shared across campaigns)",
      dv360:
        "Creates a Creative asset (same concept, but shared across campaigns)",
      ttd: "Creates a Creative asset (same concept, but shared across campaigns)",
    },
    set_brand_standards: {
      amazon: "Configures Brand Safety and content filtering",
      dv360:
        "Configures Brand Safety rules (same concept, applied at brand agent level)",
      ttd: "Configures Brand Safety rules (same concept, applied at brand agent level)",
    },
  };

  return migrationMappings[toolName] || {};
}

async function generateOpenAPISpec(): Promise<void> {
  console.log("🔧 Generating OpenAPI specification from MCP tools...");

  try {
    // Get all tools from MCP server
    const client = new Scope3ApiClient("https://api.scope3.com/graphql"); // Dummy client for tools
    const tools = getAllTools(client);

    console.log(`📋 Found ${Object.keys(tools).length} MCP tools`);

    // Build OpenAPI spec
    const spec: OpenAPISpec = {
      components: {
        schemas: generateSchemas(),
        securitySchemes: {
          apiKeyAuth: {
            description: "Scope3 API key for authentication",
            in: "header",
            name: "x-scope3-api-key",
            type: "apiKey",
          },
          bearerAuth: {
            description: "Use your Scope3 API key as the bearer token",
            scheme: "bearer",
            type: "http",
          },
        },
      },
      info: {
        description: `
API for managing agentic advertising campaigns executed via AdCP using Scope3 media quality, synthetic audience, cross-publisher frequency capping, custom signals integration, and intelligent allocation.

## Key Concepts
- **Brand Agent**: Your advertiser account - the top-level container for campaigns, creatives, and settings
- **Campaign**: Individual budget allocation units created with natural language prompts  
- **Creative**: Reusable ad assets shared across campaigns within a brand agent
- **Synthetic Audience**: AI-enhanced targeting profiles built from natural language descriptions
- **Brand Standards**: Brand safety and content filtering rules applied across all campaigns

## Platform Migration
This API is designed to make migration from traditional DSPs seamless:

### The Trade Desk Users
- **Advertiser** → Brand Agent
- **Line Item** → Campaign  
- **Creative** → Creative (shared across campaigns)
- **Audience Segment** → Synthetic Audience

### DV360 Users  
- **Advertiser** → Brand Agent
- **Insertion Order** → Campaign
- **Creative** → Creative (shared across campaigns)
- **Audience List** → Synthetic Audience

## Natural Language Campaign Management
Instead of configuring complex targeting parameters, describe your campaign goals in plain English:

\`\`\`
"Target young professionals interested in sustainable products in major cities with a $10K budget"
\`\`\`

The AI handles audience creation, bidding optimization, and performance management automatically.

## Getting Started
1. Create a Brand Agent (your advertiser account)
2. Upload Creative assets to the shared library
3. Create Campaigns using natural language prompts
4. Monitor AI-powered optimization and performance

For detailed guides, see our [documentation](https://docs.scope3.com).
        `.trim(),
        license: {
          name: "MIT",
          url: "https://opensource.org/licenses/MIT",
        },
        title: "Scope3 Agentic Campaign Management API",
        version: "1.0.0",
      },
      openapi: "3.1.0",
      paths: {},
      security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      servers: [
        {
          description: "Scope3 Agentic API Server",
          url: "https://api.agentic.scope3.com",
        },
      ],
    };

    // Convert tools to OpenAPI paths
    for (const [toolName, tool] of Object.entries(tools)) {
      let path = "";
      let method: "DELETE" | "GET" | "POST" | "PUT" = "POST";

      // Map tool names to REST paths and methods
      if (toolName.startsWith("create_")) {
        const resource = toolName.replace("create_", "").replace(/_/g, "-");
        path = `/${resource}s`;
        method = "POST";
      } else if (toolName.startsWith("list_")) {
        const resource = toolName.replace("list_", "").replace(/_/g, "-");
        path = `/${resource}s`;
        method = "GET";
      } else if (toolName.startsWith("get_")) {
        const resource = toolName.replace("get_", "").replace(/_/g, "-");
        path = `/${resource}s/{id}`;
        method = "GET";
      } else if (toolName.startsWith("update_")) {
        const resource = toolName.replace("update_", "").replace(/_/g, "-");
        path = `/${resource}s/{id}`;
        method = "PUT";
      } else if (toolName.startsWith("delete_")) {
        const resource = toolName.replace("delete_", "").replace(/_/g, "-");
        path = `/${resource}s/{id}`;
        method = "DELETE";
      } else {
        // Custom tool handling
        path = `/${toolName.replace(/_/g, "-")}`;
        method = "POST";
      }

      // Initialize path if it doesn't exist
      if (!spec.paths[path]) {
        spec.paths[path] = {};
      }

      // Add operation to path
      spec.paths[path][method.toLowerCase()] = toolToOpenAPIOperation(
        tool,
        method,
        path,
      );
    }

    console.log(
      `🚀 Generated OpenAPI spec with ${Object.keys(spec.paths).length} paths`,
    );

    // Write OpenAPI spec to file
    const outputPath = join(process.cwd(), "openapi.yaml");
    const yamlContent = stringify(spec, {
      indent: 2,
      lineWidth: 100,
      quotingType: '"',
    });

    writeFileSync(outputPath, yamlContent, "utf8");
    console.log(`✅ OpenAPI specification written to: ${outputPath}`);

    // Validate the generated spec
    try {
      execSync(`npx @redocly/cli lint "${outputPath}"`, {
        encoding: "utf8",
        stdio: "pipe",
      });
      console.log("✅ Generated OpenAPI specification is valid!");
    } catch (error: any) {
      console.warn("⚠️  OpenAPI validation warnings:");
      console.warn(error.stdout || error.message);
    }
  } catch (error) {
    console.error("❌ Failed to generate OpenAPI specification:");
    console.error(error);
    process.exit(1);
  }
}

function generateSchemas(): Record<string, unknown> {
  return {
    BrandAgent: {
      properties: {
        createdAt: { format: "date-time", type: "string" },
        customerId: { description: "Associated customer ID", type: "number" },
        description: { description: "Brand agent description", type: "string" },
        id: { description: "Unique brand agent identifier", type: "string" },
        name: { description: "Brand agent name", type: "string" },
        updatedAt: { format: "date-time", type: "string" },
      },
      required: ["id", "name", "customerId", "createdAt", "updatedAt"],
      type: "object",
    },
    Budget: {
      properties: {
        currency: {
          description: "Budget currency",
          enum: ["USD", "EUR", "GBP", "CAD", "AUD"],
          type: "string",
        },
        dailyCap: {
          description: "Daily spending limit in cents",
          type: "integer",
        },
        pacing: {
          description: "Budget pacing strategy",
          enum: ["even", "accelerated", "front_loaded"],
          type: "string",
        },
        total: {
          description: "Total budget amount in cents (e.g., 5000000 = $50,000)",
          type: "integer",
        },
      },
      required: ["total", "currency"],
      type: "object",
    },
    Campaign: {
      properties: {
        audienceIds: {
          description: "Associated synthetic audience IDs",
          items: { type: "string" },
          type: "array",
        },
        brandAgentId: { description: "Parent brand agent ID", type: "string" },
        budget: { $ref: "#/components/schemas/Budget" },
        createdAt: { format: "date-time", type: "string" },
        creativeIds: {
          description: "Associated creative asset IDs",
          items: { type: "string" },
          type: "array",
        },
        id: { description: "Unique campaign identifier", type: "string" },
        name: { description: "Campaign name", type: "string" },
        prompt: {
          description: "Natural language campaign description",
          type: "string",
        },
        status: {
          description: "Campaign status",
          enum: ["active", "paused", "completed", "draft"],
          type: "string",
        },
        updatedAt: { format: "date-time", type: "string" },
      },
      required: [
        "id",
        "name",
        "prompt",
        "brandAgentId",
        "status",
        "createdAt",
        "updatedAt",
      ],
      type: "object",
    },
    Creative: {
      properties: {
        body: { description: "Creative body text", type: "string" },
        brandAgentId: { description: "Parent brand agent ID", type: "string" },
        createdAt: { format: "date-time", type: "string" },
        cta: { description: "Call-to-action text", type: "string" },
        headline: { description: "Creative headline text", type: "string" },
        id: { description: "Unique creative identifier", type: "string" },
        name: { description: "Creative name", type: "string" },
        type: {
          description: "Creative asset type",
          enum: ["video", "image", "native", "html5"],
          type: "string",
        },
        updatedAt: { format: "date-time", type: "string" },
        url: {
          description: "Creative asset URL",
          format: "uri",
          type: "string",
        },
      },
      required: [
        "id",
        "name",
        "type",
        "url",
        "brandAgentId",
        "createdAt",
        "updatedAt",
      ],
      type: "object",
    },
    SyntheticAudience: {
      properties: {
        brandAgentId: { description: "Parent brand agent ID", type: "string" },
        createdAt: { format: "date-time", type: "string" },
        description: {
          description: "Natural language audience description",
          type: "string",
        },
        id: { description: "Unique audience identifier", type: "string" },
        name: { description: "Audience name", type: "string" },
        updatedAt: { format: "date-time", type: "string" },
      },
      required: ["id", "name", "brandAgentId", "createdAt", "updatedAt"],
      type: "object",
    },
  };
}

// Create a function to get all tools
function getAllTools(client: Scope3ApiClient): Record<string, any> {
  const tools: Record<string, any> = {};

  // Extract individual tools from the tools module
  const toolNames = [
    "checkAuthTool",
    "getAmpAgentsTool",
    "createBrandAgentTool",
    "updateBrandAgentTool",
    "deleteBrandAgentTool",
    "getBrandAgentTool",
    "listBrandAgentsTool",
    "createBrandAgentCampaignTool",
    "updateBrandAgentCampaignTool",
    "listBrandAgentCampaignsTool",
    "createBrandAgentCreativeTool",
    "updateBrandAgentCreativeTool",
    "listBrandAgentCreativesTool",
    "setBrandStandardsTool",
    "getBrandStandardsTool",
    "createSyntheticAudienceTool",
    "listSyntheticAudiencesTool",
    "addMeasurementSourceTool",
    "listMeasurementSourcesTool",
    "createCampaignTool",
    "updateCampaignTool",
  ];

  for (const toolName of toolNames) {
    if ((toolsModule as any)[toolName]) {
      const toolFactory = (toolsModule as any)[toolName];
      const tool = toolFactory(client);
      tools[tool.name] = tool;
    }
  }

  return tools;
}

function toolToOpenAPIOperation(
  tool: any,
  method: "DELETE" | "GET" | "POST" | "PUT",
  path: string,
): OpenAPIOperation {
  const operation: OpenAPIOperation = {
    description: tool.description || "",
    operationId: tool.name,
    summary: tool.annotations?.title || tool.name.replace(/_/g, " "),
    "x-llm-hints": extractLLMHints(tool.description),
  };

  // Add migration notes
  const migrationNotes = generateMigrationNotes(tool.name);
  if (Object.keys(migrationNotes).length > 0) {
    operation["x-migration-notes"] = migrationNotes;
  }

  // Handle request body for POST/PUT
  if (method === "POST" || method === "PUT") {
    operation.requestBody = {
      content: {
        "application/json": {
          examples: generateExampleForTool(tool.name),
          schema: convertZodToJsonSchema(tool.parameters),
        },
      },
      required: true,
    };
  }

  // Handle path parameters (for paths with {id})
  const parameters = [];
  if (path.includes("{id}")) {
    parameters.push({
      description: "Resource identifier",
      in: "path" as const,
      name: "id",
      required: true,
      schema: { type: "string" },
    });
  }

  // Handle query parameters for GET
  if (method === "GET" && tool.parameters) {
    const schema = tool.parameters as any;

    if (schema._def?.shape) {
      for (const [key, value] of Object.entries(schema._def.shape)) {
        parameters.push({
          description: `Filter by ${key}`,
          in: "query" as const,
          name: key,
          required: !(value as any).isOptional?.(),
          schema: convertZodToJsonSchema(value),
        });
      }
    }
  }

  if (parameters.length > 0) {
    operation.parameters = parameters;
  }

  // Standard responses
  operation.responses = {
    "200": {
      content: {
        "application/json": {
          examples: {
            success: {
              summary: "Successful operation",
              value: {
                data: {},
                message: "Operation completed successfully",
                success: true,
              },
            },
          },
          schema: {
            properties: {
              data: { type: "object" },
              message: { type: "string" },
              success: { type: "boolean" },
            },
            type: "object",
          },
        },
      },
      description: "Successful response",
    },
    "400": {
      content: {
        "application/json": {
          schema: {
            properties: {
              details: { type: "object" },
              error: { type: "string" },
            },
            type: "object",
          },
        },
      },
      description: "Bad request",
    },
    "401": {
      content: {
        "application/json": {
          schema: {
            properties: {
              error: { type: "string" },
            },
            type: "object",
          },
        },
      },
      description: "Unauthorized",
    },
  };

  return operation;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateOpenAPISpec();
}

export { generateOpenAPISpec };
