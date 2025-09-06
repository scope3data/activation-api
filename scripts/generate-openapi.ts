#!/usr/bin/env tsx

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
 */

import { execSync } from "child_process";
import { writeFileSync } from "fs";
import { join } from "path";
import { parse, stringify } from "yaml";

// Import MCP tools dynamically
import * as toolsModule from "../src/tools/index.js";
import { Scope3ApiClient } from "../src/client/scope3-client.js";

// Create a function to get all tools
function getAllTools(client: Scope3ApiClient): Record<string, any> {
  const tools: Record<string, any> = {};
  
  // Extract individual tools from the tools module
  const toolNames = [
    'checkAuthTool',
    'getAmpAgentsTool', 
    'createBrandAgentTool',
    'updateBrandAgentTool',
    'deleteBrandAgentTool',
    'getBrandAgentTool',
    'listBrandAgentsTool',
    'createBrandAgentCampaignTool',
    'updateBrandAgentCampaignTool',
    'listBrandAgentCampaignsTool',
    'createBrandAgentCreativeTool',
    'updateBrandAgentCreativeTool',
    'listBrandAgentCreativesTool',
    'setBrandStandardsTool',
    'getBrandStandardsTool',
    'createSyntheticAudienceTool',
    'listSyntheticAudiencesTool',
    'addMeasurementSourceTool',
    'listMeasurementSourcesTool',
    'createCampaignTool',
    'updateCampaignTool'
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

interface OpenAPIOperation {
  operationId: string;
  summary: string;
  description: string;
  "x-llm-hints": string[];
  "x-migration-notes"?: Record<string, string>;
  parameters?: Array<{
    name: string;
    in: "query" | "path" | "header";
    required?: boolean;
    schema: unknown;
    description?: string;
  }>;
  requestBody?: {
    required: boolean;
    content: {
      "application/json": {
        schema: unknown;
        examples?: Record<string, unknown>;
      };
    };
  };
  responses: {
    [statusCode: string]: {
      description: string;
      content: {
        "application/json": {
          schema: unknown;
          examples?: Record<string, unknown>;
        };
      };
    };
  };
}

interface OpenAPIPath {
  [method: string]: OpenAPIOperation;
}

interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{
    url: string;
    description: string;
  }>;
  paths: Record<string, OpenAPIPath>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
  security: Array<Record<string, string[]>>;
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
        type: "object",
        properties,
        required: required.length > 0 ? required : undefined,
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
        type: "array",
        items: convertZodToJsonSchema(schema._def.type),
      };
    }
  }
  
  // Fallback
  return { type: "string" };
}

function generateMigrationNotes(toolName: string): Record<string, string> {
  const migrationMappings: Record<string, Record<string, string>> = {
    create_brand_agent: {
      ttd: "Creates an Advertiser account equivalent",
      dv360: "Creates an Advertiser account equivalent",
      amazon: "Creates an Account equivalent"
    },
    create_campaign: {
      ttd: "Creates a Line Item equivalent within your Advertiser",
      dv360: "Creates an Insertion Order equivalent",
      amazon: "Creates an Order equivalent"
    },
    create_creative: {
      ttd: "Creates a Creative asset (same concept, but shared across campaigns)",
      dv360: "Creates a Creative asset (same concept, but shared across campaigns)",
      amazon: "Creates a Creative asset (same concept, but shared across campaigns)"
    },
    create_audience: {
      ttd: "Creates an enhanced Audience Segment with AI modeling",
      dv360: "Creates an enhanced Audience List with AI modeling", 
      amazon: "Creates an enhanced Audience with AI modeling"
    },
    set_brand_standards: {
      ttd: "Configures Brand Safety rules (same concept, applied at brand agent level)",
      dv360: "Configures Brand Safety rules (same concept, applied at brand agent level)",
      amazon: "Configures Brand Safety and content filtering"
    }
  };
  
  return migrationMappings[toolName] || {};
}

function generateExampleForTool(toolName: string): Record<string, unknown> {
  const examples: Record<string, Record<string, unknown>> = {
    create_brand_agent: {
      nike: {
        summary: "Create Nike brand agent",
        value: {
          name: "Nike Global",
          description: "Global athletic wear and equipment brand"
        }
      },
      agency: {
        summary: "Create agency client brand agent",
        value: {
          name: "Acme Corp",
          description: "B2B software company targeting enterprise customers"
        }
      }
    },
    create_campaign: {
      holiday: {
        summary: "Holiday campaign",
        value: {
          brandAgentId: "ba_nike_123",
          name: "Holiday Sale 2024",
          prompt: "Target gift buyers during holiday season with our premium athletic wear, focusing on people shopping for fitness enthusiasts and athletes",
          budget: {
            total: 5000000,
            currency: "USD",
            dailyCap: 100000,
            pacing: "even"
          }
        }
      },
      product_launch: {
        summary: "Product launch campaign",
        value: {
          brandAgentId: "ba_nike_123", 
          name: "New Running Shoe Launch",
          prompt: "Launch our latest running shoe to serious runners and marathon enthusiasts aged 25-45 in major metropolitan areas",
          budget: {
            total: 7500000,
            currency: "USD"
          }
        }
      }
    },
    create_creative: {
      video: {
        summary: "Video creative",
        value: {
          brandAgentId: "ba_nike_123",
          name: "Hero Video 30s", 
          type: "video",
          url: "https://cdn.nike.com/hero-video-30s.mp4",
          headline: "Just Do It",
          cta: "Shop Now"
        }
      },
      image: {
        summary: "Image creative",
        value: {
          brandAgentId: "ba_nike_123",
          name: "Product Hero Image",
          type: "image", 
          url: "https://cdn.nike.com/product-hero.jpg",
          headline: "Premium Athletic Wear",
          cta: "Discover More"
        }
      }
    }
  };
  
  return examples[toolName] || {
    basic: {
      summary: "Basic example",
      value: {}
    }
  };
}

function toolToOpenAPIOperation(
  tool: any,
  method: "GET" | "POST" | "PUT" | "DELETE"
): OpenAPIOperation {
  const operation: OpenAPIOperation = {
    operationId: tool.name,
    summary: tool.annotations?.title || tool.name.replace(/_/g, " "),
    description: tool.description || "",
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
      required: true,
      content: {
        "application/json": {
          schema: convertZodToJsonSchema(tool.parameters),
          examples: generateExampleForTool(tool.name)
        }
      }
    };
  }
  
  // Handle query parameters for GET
  if (method === "GET" && tool.parameters) {
    const schema = tool.parameters as any;
    const parameters = [];
    
    if (schema._def?.shape) {
      for (const [key, value] of Object.entries(schema._def.shape)) {
        parameters.push({
          name: key,
          in: "query" as const,
          required: !(value as any).isOptional?.(),
          schema: convertZodToJsonSchema(value),
          description: `Filter by ${key}`
        });
      }
    }
    
    if (parameters.length > 0) {
      operation.parameters = parameters;
    }
  }
  
  // Standard responses
  operation.responses = {
    "200": {
      description: "Successful response",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
              data: { type: "object" }
            }
          },
          examples: {
            success: {
              summary: "Successful operation",
              value: {
                success: true,
                message: "Operation completed successfully",
                data: {}
              }
            }
          }
        }
      }
    },
    "400": {
      description: "Bad request",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string" },
              details: { type: "object" }
            }
          }
        }
      }
    },
    "401": {
      description: "Unauthorized",
      content: {
        "application/json": {
          schema: {
            type: "object",
            properties: {
              error: { type: "string" }
            }
          }
        }
      }
    }
  };
  
  return operation;
}

function extractLLMHints(description: string): string[] {
  // Extract hints from tool descriptions
  const hints = [
    "Use this tool when user wants to " + description.toLowerCase().split(".")[0]
  ];
  
  // Add more specific hints based on tool patterns
  if (description.includes("create")) {
    hints.push("Call this when user says 'create', 'make', 'set up', or 'add'");
  }
  if (description.includes("list") || description.includes("get")) {
    hints.push("Call this when user asks 'show me', 'list', or 'what are my'");
  }
  if (description.includes("update")) {
    hints.push("Call this when user says 'change', 'update', 'modify', or 'edit'");
  }
  if (description.includes("delete")) {
    hints.push("Call this when user says 'delete', 'remove', or 'destroy'");
  }
  
  return hints;
}

function generateSchemas(): Record<string, unknown> {
  return {
    BrandAgent: {
      type: "object",
      properties: {
        id: { type: "string", description: "Unique brand agent identifier" },
        name: { type: "string", description: "Brand agent name" },
        description: { type: "string", description: "Brand agent description" },
        customerId: { type: "number", description: "Associated customer ID" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" }
      },
      required: ["id", "name", "customerId", "createdAt", "updatedAt"]
    },
    Campaign: {
      type: "object", 
      properties: {
        id: { type: "string", description: "Unique campaign identifier" },
        name: { type: "string", description: "Campaign name" },
        prompt: { type: "string", description: "Natural language campaign description" },
        brandAgentId: { type: "string", description: "Parent brand agent ID" },
        status: { 
          type: "string", 
          enum: ["active", "paused", "completed", "draft"],
          description: "Campaign status"
        },
        budget: { $ref: "#/components/schemas/Budget" },
        creativeIds: { 
          type: "array", 
          items: { type: "string" },
          description: "Associated creative asset IDs"
        },
        audienceIds: {
          type: "array",
          items: { type: "string" }, 
          description: "Associated synthetic audience IDs"
        },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" }
      },
      required: ["id", "name", "prompt", "brandAgentId", "status", "createdAt", "updatedAt"]
    },
    Creative: {
      type: "object",
      properties: {
        id: { type: "string", description: "Unique creative identifier" },
        name: { type: "string", description: "Creative name" },
        type: {
          type: "string",
          enum: ["video", "image", "native", "html5"],
          description: "Creative asset type"
        },
        url: { type: "string", format: "uri", description: "Creative asset URL" },
        headline: { type: "string", description: "Creative headline text" },
        body: { type: "string", description: "Creative body text" },
        cta: { type: "string", description: "Call-to-action text" },
        brandAgentId: { type: "string", description: "Parent brand agent ID" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" }
      },
      required: ["id", "name", "type", "url", "brandAgentId", "createdAt", "updatedAt"]
    },
    Budget: {
      type: "object",
      properties: {
        total: { 
          type: "integer", 
          description: "Total budget amount in cents (e.g., 5000000 = $50,000)"
        },
        currency: { 
          type: "string", 
          enum: ["USD", "EUR", "GBP", "CAD", "AUD"],
          description: "Budget currency"
        },
        dailyCap: { 
          type: "integer", 
          description: "Daily spending limit in cents"
        },
        pacing: {
          type: "string",
          enum: ["even", "accelerated", "front_loaded"],
          description: "Budget pacing strategy"
        }
      },
      required: ["total", "currency"]
    },
    SyntheticAudience: {
      type: "object",
      properties: {
        id: { type: "string", description: "Unique audience identifier" },
        name: { type: "string", description: "Audience name" },
        description: { type: "string", description: "Natural language audience description" },
        brandAgentId: { type: "string", description: "Parent brand agent ID" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" }
      },
      required: ["id", "name", "brandAgentId", "createdAt", "updatedAt"]
    }
  };
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
      openapi: "3.1.0",
      info: {
        title: "Scope3 Agentic Campaign Management API",
        version: "1.0.0",
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
        `.trim()
      },
      servers: [
        {
          url: "https://api.agentic.scope3.com",
          description: "Scope3 Agentic API Server"
        }
      ],
      paths: {},
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            description: "Use your Scope3 API key as the bearer token"
          },
          apiKeyAuth: {
            type: "apiKey",
            in: "header",
            name: "x-scope3-api-key",
            description: "Scope3 API key for authentication"
          }
        },
        schemas: generateSchemas()
      },
      security: [
        { bearerAuth: [] },
        { apiKeyAuth: [] }
      ]
    };
    
    // Convert tools to OpenAPI paths
    for (const [toolName, tool] of Object.entries(tools)) {
      let path = "";
      let method: "GET" | "POST" | "PUT" | "DELETE" = "POST";
      
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
      spec.paths[path][method.toLowerCase()] = toolToOpenAPIOperation(tool, method);
    }
    
    console.log(`🚀 Generated OpenAPI spec with ${Object.keys(spec.paths).length} paths`);
    
    // Write OpenAPI spec to file
    const outputPath = join(process.cwd(), "openapi.yaml");
    const yamlContent = stringify(spec, {
      indent: 2,
      lineWidth: 100,
      quotingType: '"'
    });
    
    writeFileSync(outputPath, yamlContent, "utf8");
    console.log(`✅ OpenAPI specification written to: ${outputPath}`);
    
    // Validate the generated spec
    try {
      execSync(`npx @redocly/cli lint "${outputPath}"`, {
        stdio: "pipe",
        encoding: "utf8"
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

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  generateOpenAPISpec();
}

export { generateOpenAPISpec };