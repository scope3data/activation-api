import type { Creative, CreativeContent } from "../types/creative.js";

import {
  BigQueryTypes,
  createBigQueryParams,
  toBigQueryInt64,
  toBigQueryJson,
  toBigQueryString,
} from "../utils/bigquery-types.js";
import { BigQueryBaseService } from "./base/bigquery-base-service.js";

/**
 * Service for creative operations backed by BigQuery
 * Handles creative CRUD operations and creative-campaign assignments
 */
export class CreativeService extends BigQueryBaseService {
  /**
   * Create a new creative
   */
  async createCreative(data: {
    brandAgentId: string;
    content: CreativeContent;
    creativeDescription?: string;
    creativeName?: string;
    format: string;
    targetAudience?: Record<string, unknown>;
  }): Promise<string> {
    const creativeId = `creative_${Math.random().toString(36).substring(2, 15)}`;

    const query = `
      INSERT INTO ${this.getTableRef("creatives")} (
        id, brand_agent_id, name, description, format_id, content, 
        target_audience, updated_at, created_at
      ) VALUES (
        @creativeId, @brandAgentId, @creativeName, @creativeDescription, @format, 
        PARSE_JSON(@content), PARSE_JSON(@targetAudience), ${this.getCurrentTimestamp()}, ${this.getCurrentTimestamp()}
      )
    `;

    const { params, types } = createBigQueryParams(
      {
        brandAgentId: toBigQueryInt64(data.brandAgentId),
        content: toBigQueryJson(data.content),
        creativeDescription: data.creativeDescription || null,
        creativeId,
        creativeName: toBigQueryString(
          data.creativeName || `Creative ${creativeId}`,
        ),
        format: data.format,
        targetAudience: toBigQueryJson(data.targetAudience),
      },
      {
        brandAgentId: BigQueryTypes.INT64,
        content: BigQueryTypes.JSON,
        creativeDescription: BigQueryTypes.STRING,
        creativeId: BigQueryTypes.STRING,
        creativeName: BigQueryTypes.STRING,
        format: BigQueryTypes.STRING,
        targetAudience: BigQueryTypes.JSON,
      },
    );

    await this.bigquery.query({ params, query, types });

    return creativeId;
  }

  /**
   * Delete a creative and its assignments
   */
  async deleteCreative(creativeId: string, apiToken?: string): Promise<void> {
    // First verify the creative exists and user has access
    const existingCreative = await this.getCreative(
      creativeId,
      undefined,
      apiToken,
    );
    if (!existingCreative) {
      throw new Error("Creative not found or access denied");
    }

    // Delete campaign assignments first
    await this.bigquery.query({
      params: { creativeId },
      query: `DELETE FROM ${this.getTableRef("campaign_creatives")} WHERE creative_id = @creativeId`,
    });

    // Delete the creative itself
    await this.bigquery.query({
      params: { creativeId },
      query: `DELETE FROM ${this.getTableRef("creatives")} WHERE id = @creativeId`,
    });
  }

  /**
   * Get a creative by ID
   */
  async getCreative(
    creativeId: string,
    brandAgentId?: string,
    apiToken?: string,
  ): Promise<Creative | null> {
    const customerId = await this.resolveCustomerId(apiToken);

    const query = `
      SELECT c.*, agent.customer_id
      FROM ${this.getTableRef("creatives")} c
      LEFT JOIN \`${this.agentTableRef}\` agent ON c.brand_agent_id = agent.id
      WHERE c.id = @creativeId 
        AND (@brandAgentId IS NULL OR c.brand_agent_id = @brandAgentId)
        AND agent.customer_id = @customerId
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      params: {
        brandAgentId: brandAgentId ? parseInt(brandAgentId, 10) : null, // Convert to INT64 to match schema
        creativeId,
        customerId,
      },
      query,
      types: {
        brandAgentId: "INT64",
        creativeId: "STRING",
        customerId: "INT64",
      },
    });

    const row = rows.length > 0 ? rows[0] : null;

    return row ? this.mapCreativeRow(row as Record<string, unknown>) : null;
  }

  /**
   * Get creative assignment counts for a brand agent
   */
  async getCreativeAssignmentCounts(
    brandAgentId: string,
  ): Promise<Record<string, number>> {
    const query = `
      SELECT 
        cc.creative_id,
        COUNT(*) as assignment_count
      FROM ${this.getTableRef("campaign_creatives")} cc
      INNER JOIN ${this.getTableRef("campaigns")} c ON cc.campaign_id = c.id
      WHERE c.brand_agent_id = @brandAgentId 
        AND cc.status = 'active'
      GROUP BY cc.creative_id
    `;

    const [rows] = await this.bigquery.query({
      params: {
        brandAgentId: parseInt(brandAgentId, 10), // Convert to INT64 to match schema
      },
      query,
      types: {
        brandAgentId: "INT64",
      },
    });

    const counts: Record<string, number> = {};
    for (const row of rows) {
      const typedRow = row as Record<string, unknown>;
      counts[String(typedRow.creative_id)] = Number(typedRow.assignment_count);
    }

    return counts;
  }

  /**
   * List creatives for a brand agent
   */
  async listCreatives(
    brandAgentId: string,
    format?: string,
    apiToken?: string,
  ): Promise<Creative[]> {
    const customerId = await this.resolveCustomerId(apiToken);

    let whereClause = `
      WHERE c.brand_agent_id = @brandAgentId 
        AND agent.customer_id = @customerId
    `;
    const params: Record<string, unknown> = {
      brandAgentId: parseInt(brandAgentId, 10), // Convert to INT64 to match schema
      customerId,
    };

    if (format) {
      whereClause += " AND c.format = @format";
      params.format = format;
    }

    const query = `
      SELECT c.*, agent.customer_id
      FROM ${this.getTableRef("creatives")} c
      LEFT JOIN \`${this.agentTableRef}\` agent ON c.brand_agent_id = agent.id
      ${whereClause}
      ORDER BY c.created_at DESC
    `;

    const [rows] = await this.bigquery.query({
      params,
      query,
      types: {
        brandAgentId: "INT64",
        customerId: "INT64",
        format: "STRING",
      },
    });

    return rows.map((row) =>
      this.mapCreativeRow(row as Record<string, unknown>),
    );
  }

  /**
   * Update a creative
   */
  async updateCreative(
    creativeId: string,
    updates: {
      content?: CreativeContent;
      creativeDescription?: string;
      targetAudience?: Record<string, unknown>;
    },
    apiToken?: string,
  ): Promise<void> {
    // First verify the creative exists and user has access
    const existingCreative = await this.getCreative(
      creativeId,
      undefined,
      apiToken,
    );
    if (!existingCreative) {
      throw new Error("Creative not found or access denied");
    }

    const setParts: string[] = [`updated_at = ${this.getCurrentTimestamp()}`];
    const params: Record<string, unknown> = { creativeId };

    if (updates.content !== undefined) {
      setParts.push("content = PARSE_JSON(@content)");
      params.content = JSON.stringify(updates.content);
    }

    if (updates.creativeDescription !== undefined) {
      setParts.push("description = @creativeDescription");
      params.creativeDescription = updates.creativeDescription;
    }

    if (updates.targetAudience !== undefined) {
      setParts.push("target_audience = PARSE_JSON(@targetAudience)");
      params.targetAudience = JSON.stringify(updates.targetAudience);
    }

    if (setParts.length === 1) {
      // Only timestamp update, nothing else changed
      return;
    }

    const query = `
      UPDATE ${this.getTableRef("creatives")}
      SET ${setParts.join(", ")}
      WHERE id = @creativeId
    `;

    await this.bigquery.query({ params, query });
  }

  /**
   * Map BigQuery row to Creative interface
   */
  private mapCreativeRow(row: Record<string, unknown>): Creative {
    let content: CreativeContent = {};
    let targetAudience: string | undefined;
    let contentCategories: string[] = [];

    try {
      if (row.content) {
        content =
          typeof row.content === "string"
            ? JSON.parse(row.content)
            : (row.content as Record<string, unknown>);
      }
    } catch (error) {
      console.warn("Failed to parse creative content:", error);
    }

    try {
      if (row.target_audience) {
        const parsed =
          typeof row.target_audience === "string"
            ? JSON.parse(row.target_audience)
            : (row.target_audience as Record<string, unknown>);
        // Convert object to natural language description
        targetAudience =
          typeof parsed === "object" ? JSON.stringify(parsed) : String(parsed);
      }
    } catch (error) {
      console.warn("Failed to parse creative target audience:", error);
    }

    try {
      if (row.content_categories) {
        contentCategories = Array.isArray(row.content_categories)
          ? (row.content_categories as string[])
          : [];
      }
    } catch (error) {
      console.warn("Failed to parse creative content categories:", error);
    }

    return {
      assemblyMethod: "pre_assembled", // Default for BigQuery stored creatives
      assetIds: content.assetIds || [], // Extract from content
      buyerAgentId: String(row.brand_agent_id),
      campaignAssignments: [], // Populated separately if needed
      content,
      contentCategories,
      createdBy: "system", // Default - could be enhanced later
      createdDate: this.safeParseDate(row.created_at),
      creativeDescription: row.description
        ? String(row.description)
        : undefined,
      creativeId: String(row.id),
      creativeName: String(row.name || `Creative ${row.id}`),
      customerId: Number(row.customer_id),
      format: {
        formatId: String(row.format_id),
        type: "publisher", // Default type for BigQuery stored formats
      },
      lastModifiedBy: "system", // Default - could be enhanced later
      lastModifiedDate: this.safeParseDate(row.updated_at),
      status: String(row.status || "active") as
        | "active"
        | "archived"
        | "draft"
        | "paused"
        | "pending_review"
        | "rejected",
      targetAudience,
      version: "1.0", // Default version
    };
  }

  /**
   * Safely parse date value from BigQuery
   */
  private safeParseDate(dateValue: unknown): string {
    if (!dateValue) return new Date().toISOString();

    try {
      // Handle BigQuery timestamp objects
      if (dateValue && typeof dateValue === "object" && "value" in dateValue) {
        const timestamp = (dateValue as { value: string }).value;
        return new Date(timestamp).toISOString();
      }

      const date = new Date(dateValue as Date | number | string);
      if (isNaN(date.getTime())) {
        console.warn("Invalid date value:", dateValue);
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch (error) {
      console.warn("Failed to parse date:", dateValue, error);
      return new Date().toISOString();
    }
  }
}
