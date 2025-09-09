import type { Creative, CreativeContent } from "../types/creative.js";

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
    format: string;
    targetAudience?: Record<string, unknown>;
  }): Promise<string> {
    const creativeId = `creative_${Math.random().toString(36).substring(2, 15)}`;

    const query = `
      INSERT INTO ${this.getTableRef("creatives")} (
        id, brand_agent_id, creative_description, format, content, 
        target_audience, last_modified_date, created_date
      ) VALUES (
        @creativeId, @brandAgentId, @creativeDescription, @format, 
        @content, @targetAudience, ${this.getCurrentTimestamp()}, ${this.getCurrentTimestamp()}
      )
    `;

    await this.executeQuery(query, {
      brandAgentId: data.brandAgentId,
      content: JSON.stringify(data.content),
      creativeDescription: data.creativeDescription || null,
      creativeId,
      format: data.format,
      targetAudience: data.targetAudience
        ? JSON.stringify(data.targetAudience)
        : null,
    });

    return creativeId;
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

    const row = await this.executeQuerySingle(query, {
      brandAgentId: brandAgentId || null,
      creativeId,
      customerId,
    });

    return row ? this.mapCreativeRow(row) : null;
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

    const rows = await this.executeQuery(query, { brandAgentId });

    const counts: Record<string, number> = {};
    for (const row of rows) {
      counts[String(row.creative_id)] = Number(row.assignment_count);
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
    const params: Record<string, unknown> = { brandAgentId, customerId };

    if (format) {
      whereClause += " AND c.format = @format";
      params.format = format;
    }

    const query = `
      SELECT c.*, agent.customer_id
      FROM ${this.getTableRef("creatives")} c
      LEFT JOIN \`${this.agentTableRef}\` agent ON c.brand_agent_id = agent.id
      ${whereClause}
      ORDER BY c.created_date DESC
    `;

    const rows = await this.executeQuery(query, params);
    return rows.map((row) => this.mapCreativeRow(row));
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

    const setParts: string[] = [
      `last_modified_date = ${this.getCurrentTimestamp()}`,
    ];
    const params: Record<string, unknown> = { creativeId };

    if (updates.content !== undefined) {
      setParts.push("content = @content");
      params.content = JSON.stringify(updates.content);
    }

    if (updates.creativeDescription !== undefined) {
      setParts.push("creative_description = @creativeDescription");
      params.creativeDescription = updates.creativeDescription;
    }

    if (updates.targetAudience !== undefined) {
      setParts.push("target_audience = @targetAudience");
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

    await this.executeQuery(query, params);
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
      createdDate: new Date(
        row.created_date as Date | number | string,
      ).toISOString(),
      creativeDescription: row.creative_description
        ? String(row.creative_description)
        : undefined,
      creativeId: String(row.id),
      creativeName: String(
        row.creative_name || row.name || `Creative ${row.id}`,
      ),
      customerId: Number(row.customer_id),
      format: {
        formatId: String(row.format),
        type: "publisher", // Default type for BigQuery stored formats
      },
      lastModifiedBy: "system", // Default - could be enhanced later
      lastModifiedDate: new Date(
        row.last_modified_date as Date | number | string,
      ).toISOString(),
      status: String(row.status || "active"),
      targetAudience,
      version: "1.0", // Default version
    };
  }
}
