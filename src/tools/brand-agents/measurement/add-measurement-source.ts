import { z } from "zod";

import type { Scope3ApiClient } from "../../../client/scope3-client.js";
import type {
  AddMeasurementSourceParams,
  MCPToolExecuteContext,
} from "../../../types/mcp.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../../utils/error-handling.js";

export const addMeasurementSourceTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "measurement-management",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: false,
    title: "Add Measurement Source",
  },

  description:
    "Add a measurement source to a brand agent for tracking campaign performance. Supports conversion APIs, analytics platforms, brand studies, and MMM (Media Mix Modeling) integrations. Currently supports basic configuration (stub implementation). Requires authentication.",

  execute: async (
    args: AddMeasurementSourceParams,
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

      const sourceInput = {
        brandAgentId: args.brandAgentId,
        name: args.name,
        type: args.type,
        configuration: args.configuration,
      };

      const measurementSource = await client.addMeasurementSource(apiKey, sourceInput);

      let summary = `✅ Measurement Source Added Successfully!\n\n`;
      summary += `**Source Details:**\n`;
      summary += `• **Name:** ${measurementSource.name}\n`;
      summary += `• **ID:** ${measurementSource.id}\n`;
      summary += `• **Brand Agent:** ${brandAgentName} (${measurementSource.brandAgentId})\n`;
      summary += `• **Type:** ${measurementSource.type}\n`;
      summary += `• **Status:** ${measurementSource.status}\n`;
      summary += `• **Created:** ${new Date(measurementSource.createdAt).toLocaleString()}\n`;

      if (measurementSource.configuration && Object.keys(measurementSource.configuration).length > 0) {
        summary += `\n**Configuration:**\n`;
        Object.entries(measurementSource.configuration).forEach(([key, value]) => {
          summary += `• ${key}: ${JSON.stringify(value)}\n`;
        });
      }

      summary += `\n📊 **Measurement Source Type: ${measurementSource.type.toUpperCase()}**\n`;
      switch (measurementSource.type) {
        case 'conversion_api':
          summary += `• Track conversions and attributions from campaigns\n`;
          summary += `• Integrate with e-commerce platforms and CRMs\n`;
          summary += `• Measure campaign ROI and effectiveness\n`;
          summary += `• Support for real-time conversion tracking\n`;
          break;
        case 'analytics':
          summary += `• Connect to Google Analytics, Adobe Analytics, or similar\n`;
          summary += `• Monitor website traffic and user engagement\n`;
          summary += `• Track campaign-driven site behavior\n`;
          summary += `• Analyze audience segments and demographics\n`;
          break;
        case 'brand_study':
          summary += `• Measure brand awareness and perception\n`;
          summary += `• Track brand lift from advertising campaigns\n`;
          summary += `• Monitor brand sentiment and recall\n`;
          summary += `• Compare brand metrics across different audiences\n`;
          break;
        case 'mmm':
          summary += `• Media Mix Modeling for attribution analysis\n`;
          summary += `• Understand cross-channel media effectiveness\n`;
          summary += `• Optimize budget allocation across channels\n`;
          summary += `• Long-term brand impact measurement\n`;
          break;
      }

      summary += `\n**Integration Benefits:**\n`;
      summary += `• Unified measurement across all campaigns in this brand agent\n`;
      summary += `• Consistent attribution and performance tracking\n`;
      summary += `• Cross-campaign performance comparisons\n`;
      summary += `• Data-driven optimization opportunities\n\n`;

      summary += `🚧 **Note:** This is a stub implementation. Advanced measurement features including:\n`;
      summary += `• Real-time data synchronization\n`;
      summary += `• Custom attribution models\n`;
      summary += `• Cross-platform identity resolution\n`;
      summary += `• Advanced analytics dashboards\n`;
      summary += `• Automated optimization recommendations\n`;
      summary += `...will be added in future releases.\n\n`;

      summary += `The measurement source is ready to track campaign performance!`;

      return createMCPResponse({
        message: summary,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to add measurement source", error);
    }
  },

  name: "add_measurement_source",
  parameters: z.object({
    brandAgentId: z.string().describe("ID of the brand agent that will own this measurement source"),
    name: z.string().describe("Name of the measurement source (e.g., 'Google Analytics', 'Facebook Conversions API')"),
    type: z
      .enum(['conversion_api', 'analytics', 'brand_study', 'mmm'])
      .describe("Type of measurement: conversion_api, analytics, brand_study, or mmm (Media Mix Modeling)"),
    configuration: z
      .record(z.any())
      .optional()
      .describe("Optional configuration parameters specific to the measurement source type"),
  }),
});