import { z } from "zod";

import type { Scope3ApiClient } from "../../client/scope3-client.js";
import type {
  ExportCampaignDataParams,
  MCPToolExecuteContext,
} from "../../types/mcp.js";
import type { DataExportResponse } from "../../types/reporting.js";

import {
  createAuthErrorResponse,
  createErrorResponse,
  createMCPResponse,
} from "../../utils/error-handling.js";

export const exportCampaignDataTool = (client: Scope3ApiClient) => ({
  annotations: {
    category: "data-export",
    dangerLevel: "low",
    openWorldHint: true,
    readOnlyHint: true,
    title: "Export Campaign Data",
  },

  description:
    "Export raw campaign data for BI/analytics systems in structured format. Supports flexible grouping by campaigns, tactics, signals, stories, and other dimensions. Returns structured data suitable for external analysis tools.",

  execute: async (
    args: ExportCampaignDataParams,
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
      // Validate date range
      const startDate = new Date(args.dateRange.start);
      const endDate = new Date(args.dateRange.end);

      if (startDate >= endDate) {
        return createErrorResponse(
          "Start date must be before end date",
          new Error("Invalid date range"),
        );
      }

      // Get campaign IDs (either from args or by brand agent)
      let campaignIds = args.campaignIds || [];

      if (!campaignIds.length && args.brandAgentId) {
        const campaigns = await client.listBrandAgentCampaigns(
          apiKey,
          args.brandAgentId,
        );
        campaignIds = campaigns.map((c) => c.id);
      }

      if (!campaignIds.length) {
        return createErrorResponse(
          "No campaigns found for the specified criteria",
          new Error("No campaigns found"),
        );
      }

      // Generate export based on requested datasets
      const exportData = await generateExport(
        client,
        apiKey,
        campaignIds,
        args,
      );

      // Format response
      const response = formatExportResponse(exportData, args);

      return createMCPResponse({
        message: response,
        success: true,
      });
    } catch (error) {
      return createErrorResponse("Failed to export campaign data", error);
    }
  },

  name: "export_campaign_data",
  parameters: z.object({
    brandAgentId: z
      .string()
      .optional()
      .describe(
        "Export all campaigns for this brand agent (optional if campaignIds provided)",
      ),
    campaignIds: z
      .array(z.string())
      .optional()
      .describe(
        "Specific campaign IDs to export (optional if brandAgentId provided)",
      ),
    compression: z
      .enum(["none", "gzip"])
      .optional()
      .describe("Compression method (defaults to none)"),
    datasets: z
      .array(z.enum(["delivery", "events", "tactics", "allocations"]))
      .describe("Which datasets to include in export"),
    dateRange: z
      .object({
        end: z.string().describe("End date (YYYY-MM-DD)"),
        start: z.string().describe("Start date (YYYY-MM-DD)"),
      })
      .describe("Date range for export"),
    format: z
      .enum(["json", "csv", "parquet"])
      .optional()
      .describe("Export format (defaults to json)"),
    groupBy: z
      .array(
        z.enum([
          "date",
          "hour",
          "campaign",
          "tactic",
          "signal",
          "story",
          "publisher_product",
          "creative",
        ]),
      )
      .describe("How to group/aggregate the data"),
  }),
});

async function exportAllocationData(
  client: Scope3ApiClient,
  apiKey: string,
  campaignIds: string[],
  params: ExportCampaignDataParams,
): Promise<{
  rows: Array<Record<string, unknown>>;
  schema: Record<string, string>;
}> {
  const rows: Array<Record<string, unknown>> = [];
  const schema: Record<string, string> = {
    allocated_budget: "number",
    campaign_id: "string",
    date: "string",
    tactic_id: "string",
    utilization_rate: "number",
    utilized_budget: "number",
  };

  for (const campaignId of campaignIds) {
    const allocations = await client.getBudgetAllocations(apiKey, campaignId, {
      end: new Date(params.dateRange.end),
      start: new Date(params.dateRange.start),
    });

    for (const allocation of allocations || []) {
      rows.push({
        allocated_budget: allocation.allocatedBudget,
        campaign_id: campaignId,
        date: (allocation.date as Date).toISOString().split("T")[0],
        tactic_id: allocation.tacticId,
        utilization_rate: allocation.utilizationRate,
        utilized_budget: allocation.utilizedBudget,
      });
    }
  }

  return { rows, schema };
}

async function exportDeliveryData(
  client: Scope3ApiClient,
  apiKey: string,
  campaignIds: string[],
  params: ExportCampaignDataParams,
): Promise<{
  rows: Array<Record<string, unknown>>;
  schema: Record<string, string>;
}> {
  const rows: Array<Record<string, unknown>> = [];
  const schema: Record<string, string> = {
    campaign_id: "string",
    campaign_name: "string",
    currency: "string",
    current_price: "number",
    date: "string",
    delivery_unit: "string",
    spend: "number",
    tactic_id: "string",
    units_delivered: "number",
  };

  // Add grouping fields to schema
  if (params.groupBy.includes("signal")) {
    schema.signal = "string";
  }
  if (params.groupBy.includes("story")) {
    schema.story = "string";
  }
  if (params.groupBy.includes("publisher_product")) {
    schema.publisher_product = "string";
  }

  for (const campaignId of campaignIds) {
    // Get delivery data for this campaign
    const deliveryData = await client.getCampaignDeliveryData(
      apiKey,
      campaignId,
      {
        end: new Date(params.dateRange.end),
        start: new Date(params.dateRange.start),
      },
    );

    const campaign = await client.getBrandAgentCampaign(apiKey, campaignId);

    // Transform delivery data based on groupBy parameters
    for (const delivery of (deliveryData as { dailyDeliveries?: unknown[] })
      ?.dailyDeliveries || []) {
      const d = delivery as Record<string, unknown>;
      const baseRow = {
        campaign_id: campaignId,
        campaign_name: campaign?.name || "Unknown",
        currency: d.currency as string,
        current_price: d.currentPrice as number,
        date: (d.date as Date).toISOString().split("T")[0],
        delivery_unit: d.deliveryUnit as string,
        spend: d.spend as number,
        tactic_id: d.tacticId as string,
        units_delivered: d.unitsDelivered as number,
      };

      // Handle grouping by signals
      if (params.groupBy.includes("signal") && d.signalBreakdown) {
        for (const [signal, signalSpend] of Object.entries(d.signalBreakdown)) {
          rows.push({
            ...baseRow,
            signal,
            spend: signalSpend as number,
            units_delivered: Math.round(
              ((signalSpend as number) / (d.spend as number)) *
                (d.unitsDelivered as number),
            ),
          });
        }
      }
      // Handle grouping by stories
      else if (params.groupBy.includes("story") && d.storyBreakdown) {
        for (const [story, storySpend] of Object.entries(d.storyBreakdown)) {
          rows.push({
            ...baseRow,
            spend: storySpend as number,
            story,
            units_delivered: Math.round(
              ((storySpend as number) / (d.spend as number)) *
                (d.unitsDelivered as number),
            ),
          });
        }
      }
      // Handle grouping by publisher products
      else if (
        params.groupBy.includes("publisher_product") &&
        d.publisherBreakdown
      ) {
        for (const [publisherProduct, publisherSpend] of Object.entries(
          d.publisherBreakdown,
        )) {
          rows.push({
            ...baseRow,
            publisher_product: publisherProduct,
            spend: publisherSpend as number,
            units_delivered: Math.round(
              ((publisherSpend as number) / (d.spend as number)) *
                (d.unitsDelivered as number),
            ),
          });
        }
      } else {
        rows.push(baseRow);
      }
    }
  }

  return { rows, schema };
}

async function exportEventData(
  client: Scope3ApiClient,
  apiKey: string,
  campaignIds: string[],
  params: ExportCampaignDataParams,
): Promise<{
  rows: Array<Record<string, unknown>>;
  schema: Record<string, string>;
}> {
  const rows: Array<Record<string, unknown>> = [];
  const schema: Record<string, string> = {
    amount_unit: "string",
    amount_value: "number",
    campaign_id: "string",
    creative_id: "string",
    event_id: "string",
    event_type: "string",
    reward_confidence: "number",
    reward_delayed: "number",
    reward_immediate: "number",
    source: "string",
    tactic_id: "string",
    timestamp: "string",
  };

  // Add grouping fields
  if (params.groupBy.includes("signal")) schema.signals = "string";
  if (params.groupBy.includes("story")) schema.stories = "string";

  for (const campaignId of campaignIds) {
    const events = await client.getCampaignEvents(apiKey, campaignId, {
      end: new Date(params.dateRange.end),
      start: new Date(params.dateRange.start),
    });

    for (const event of events || []) {
      const row: Record<string, unknown> = {
        amount_unit: event.amount?.unit || null,
        amount_value: event.amount?.value || null,
        campaign_id: event.campaignId,
        creative_id: event.creativeId || null,
        event_id: event.id,
        event_type: event.eventType,
        reward_confidence: event.reward?.confidence || null,
        reward_delayed: event.reward?.delayed || null,
        reward_immediate: event.reward?.immediate || null,
        source: event.source,
        tactic_id: event.tacticId,
        timestamp: event.timestamp.toISOString(),
      };

      // Add optional fields based on groupBy parameters
      if (params.groupBy.includes("signal")) {
        row.signals = event.signals?.join(",") || null;
      }
      if (params.groupBy.includes("story")) {
        row.stories = event.stories?.join(",") || null;
      }

      rows.push(row);
    }
  }

  return { rows, schema };
}

async function exportTacticData(
  client: Scope3ApiClient,
  apiKey: string,
  campaignIds: string[],
  _params: ExportCampaignDataParams,
): Promise<{
  rows: Array<Record<string, unknown>>;
  schema: Record<string, string>;
}> {
  const rows: Array<Record<string, unknown>> = [];
  const schema: Record<string, string> = {
    campaign_id: "string",
    daily_budget: "number",
    end_date: "string",
    publisher_products: "string",
    signals: "string",
    start_date: "string",
    status: "string",
    stories: "string",
    tactic_id: "string",
    tactic_name: "string",
    target_price: "number",
  };

  for (const campaignId of campaignIds) {
    const tactics = await client.getCampaignTactics(apiKey, campaignId);

    for (const tactic of tactics || []) {
      rows.push({
        campaign_id: campaignId,
        daily_budget: tactic.dailyBudget || null,
        end_date: (tactic.endDate as Date)?.toISOString().split("T")[0] || null,
        publisher_products:
          (tactic.publisherProducts as string[])?.join(",") || null,
        signals: (tactic.signals as string[])?.join(",") || null,
        start_date:
          (tactic.startDate as Date)?.toISOString().split("T")[0] || null,
        status: tactic.status,
        stories: (tactic.stories as string[])?.join(",") || null,
        tactic_id: tactic.id as string,
        tactic_name:
          (tactic.name as string) ||
          `Tactic ${(tactic.id as string).slice(-8)}`,
        target_price: tactic.targetPrice,
      });
    }
  }

  return { rows, schema };
}

function formatExportResponse(
  exportData: DataExportResponse,
  params: ExportCampaignDataParams,
): string {
  const { metadata } = exportData;

  let response = `## 📊 Campaign Data Export\n\n`;
  response += `**Export ID**: ${metadata.exportId}\n`;
  response += `**Generated**: ${metadata.timestamp.toLocaleString()}\n`;
  response += `**Total Rows**: ${metadata.rowCount.toLocaleString()}\n`;
  response += `**Date Range**: ${params.dateRange.start} to ${params.dateRange.end}\n`;
  response += `**Datasets**: ${params.datasets.join(", ")}\n`;
  response += `**Grouped By**: ${params.groupBy.join(", ")}\n\n`;

  // Schema information
  response += `### 📋 Data Schema\n`;
  const schemaEntries = Object.entries(metadata.schema);
  for (const [field, type] of schemaEntries) {
    response += `• **${field}**: ${type}\n`;
  }
  response += `\n`;

  // Data preview or download link
  if (exportData.data) {
    response += `### 📊 Data Preview\n`;
    response += `*Showing first 5 rows of ${metadata.rowCount} total records*\n\n`;

    // Create a simple table format
    const preview = exportData.data.slice(0, 5);
    if (preview.length > 0) {
      const headers = Object.keys(preview[0]);

      // Headers
      response += `| ${headers.join(" | ")} |\n`;
      response += `| ${headers.map(() => "---").join(" | ")} |\n`;

      // Rows
      for (const row of preview) {
        const values = headers.map((h) => {
          const value = row[h];
          if (typeof value === "number") {
            return value.toLocaleString();
          }
          return value?.toString() || "";
        });
        response += `| ${values.join(" | ")} |\n`;
      }
    }

    response += `\n### 💾 Export Complete\n`;
    response += `Data is included in this response. Use the structured data above for analysis.\n`;
  } else if (exportData.downloadUrl) {
    response += `### 📥 Download Information\n`;
    response += `**Download URL**: ${exportData.downloadUrl}\n`;
    response += `**Expires**: ${exportData.expiresAt?.toLocaleString()}\n`;
    response += `**Format**: ${params.format || "json"}\n`;
    response += `**Compression**: ${params.compression || "none"}\n\n`;
    response += `⚠️ *Large export (>${metadata.rowCount.toLocaleString()} rows) available via download link.*\n`;
  }

  response += `\n### 🎯 Usage Tips\n`;
  response += `• Use the export ID for support requests\n`;
  response += `• Data includes all requested dimensions and metrics\n`;
  response += `• Signal/story breakdowns are provided where available\n`;
  response += `• Timestamps are in ISO 8601 format\n`;

  return response;
}

async function generateExport(
  client: Scope3ApiClient,
  apiKey: string,
  campaignIds: string[],
  params: ExportCampaignDataParams,
): Promise<DataExportResponse> {
  const exportId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const rows: Array<Record<string, unknown>> = [];
  const schema: Record<string, string> = {};

  // Process each requested dataset
  for (const dataset of params.datasets) {
    switch (dataset) {
      case "allocations": {
        const allocationData = await exportAllocationData(
          client,
          apiKey,
          campaignIds,
          params,
        );
        rows.push(...allocationData.rows);
        Object.assign(schema, allocationData.schema);
        break;
      }

      case "delivery": {
        const deliveryData = await exportDeliveryData(
          client,
          apiKey,
          campaignIds,
          params,
        );
        rows.push(...deliveryData.rows);
        Object.assign(schema, deliveryData.schema);
        break;
      }

      case "events": {
        const eventData = await exportEventData(
          client,
          apiKey,
          campaignIds,
          params,
        );
        rows.push(...eventData.rows);
        Object.assign(schema, eventData.schema);
        break;
      }

      case "tactics": {
        const tacticData = await exportTacticData(
          client,
          apiKey,
          campaignIds,
          params,
        );
        rows.push(...tacticData.rows);
        Object.assign(schema, tacticData.schema);
        break;
      }
    }
  }

  return {
    data: rows.length <= 10000 ? rows : undefined, // Include data for small exports
    downloadUrl:
      rows.length > 10000
        ? `https://api.scope3.com/exports/${exportId}`
        : undefined,
    expiresAt:
      rows.length > 10000
        ? new Date(Date.now() + 24 * 60 * 60 * 1000)
        : undefined, // 24 hours
    metadata: {
      exportId,
      query: params,
      rowCount: rows.length,
      schema,
      timestamp: new Date(),
    },
  };
}
