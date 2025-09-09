import type { BrandAgentCampaign } from "../types/brand-agent.js";

import { BigQueryBaseService } from "./base/bigquery-base-service.js";

/**
 * Service for campaign operations backed by BigQuery
 * Handles campaign CRUD operations and campaign-creative assignments
 */
export class CampaignService extends BigQueryBaseService {
  /**
   * Assign a brand story to a campaign
   */
  async assignBrandStoryToCampaign(
    campaignId: string,
    storyId: string,
  ): Promise<void> {
    const query = `
      INSERT INTO ${this.getTableRef("campaign_brand_stories")} (
        campaign_id, brand_story_id, status, created_at, updated_at
      ) VALUES (
        @campaignId, @storyId, 'active', ${this.getCurrentTimestamp()}, ${this.getCurrentTimestamp()}
      )
    `;

    await this.executeQuery(query, { campaignId, storyId });
  }

  /**
   * Assign a creative to a campaign
   */
  async assignCreativeToCampaign(
    campaignId: string,
    creativeId: string,
  ): Promise<void> {
    const query = `
      INSERT INTO ${this.getTableRef("campaign_creatives")} (
        campaign_id, creative_id, status, created_at, updated_at
      ) VALUES (
        @campaignId, @creativeId, 'active', ${this.getCurrentTimestamp()}, ${this.getCurrentTimestamp()}
      )
    `;

    await this.executeQuery(query, { campaignId, creativeId });
  }

  /**
   * Create a new campaign
   */
  async createCampaign(data: {
    brandAgentId: string;
    budget?: {
      currency: string;
      dailyCap?: number;
      pacing?: string;
      total: number;
    };
    creativeIds?: string[];
    endDate?: Date;
    name: string;
    prompt: string;
    startDate?: Date;
    status?: string;
  }): Promise<string> {
    const campaignId = `camp_${Math.random().toString(36).substring(2, 15)}`;

    const insertQuery = `
      INSERT INTO ${this.getTableRef("campaigns")} (
        id, brand_agent_id, name, prompt, budget_total, budget_currency, 
        budget_daily_cap, budget_pacing, start_date, end_date, status, 
        created_at, updated_at
      ) VALUES (
        @campaignId, @brandAgentId, @name, @prompt, @budgetTotal, @budgetCurrency,
        @budgetDailyCap, @budgetPacing, @startDate, @endDate, @status,
        ${this.getCurrentTimestamp()}, ${this.getCurrentTimestamp()}
      )
    `;

    await this.executeQuery(insertQuery, {
      brandAgentId: data.brandAgentId,
      budgetCurrency: data.budget?.currency || "USD",
      budgetDailyCap: data.budget?.dailyCap || null,
      budgetPacing: data.budget?.pacing || null,
      budgetTotal: data.budget?.total || null,
      campaignId,
      endDate: data.endDate || null,
      name: data.name,
      prompt: data.prompt,
      startDate: data.startDate || null,
      status: data.status || "draft",
    });

    // Assign creatives if provided
    if (data.creativeIds && data.creativeIds.length > 0) {
      await Promise.all(
        data.creativeIds.map((creativeId) =>
          this.assignCreativeToCampaign(campaignId, creativeId),
        ),
      );
    }

    return campaignId;
  }

  /**
   * Get campaign with relationships
   */
  async getCampaign(campaignId: string): Promise<BrandAgentCampaign | null> {
    const query = `
      SELECT 
        c.*,
        ARRAY(
          SELECT cc.creative_id 
          FROM ${this.getTableRef("campaign_creatives")} cc 
          WHERE cc.campaign_id = c.id AND cc.status = 'active'
        ) as creative_ids
      FROM ${this.getTableRef("campaigns")} c
      WHERE c.id = @campaignId
      LIMIT 1
    `;

    const row = await this.executeQuerySingle(query, { campaignId });
    if (!row) return null;

    return this.mapCampaignRow(row);
  }

  /**
   * List campaigns for a brand agent
   */
  async listCampaigns(
    brandAgentId: string,
    status?: string,
  ): Promise<BrandAgentCampaign[]> {
    let whereClause = "WHERE c.brand_agent_id = @brandAgentId";
    const params: Record<string, unknown> = { brandAgentId };

    if (status) {
      whereClause += " AND c.status = @status";
      params.status = status;
    }

    const query = `
      SELECT 
        c.*,
        ARRAY(
          SELECT cc.creative_id 
          FROM ${this.getTableRef("campaign_creatives")} cc 
          WHERE cc.campaign_id = c.id AND cc.status = 'active'
        ) as creative_ids
      FROM ${this.getTableRef("campaigns")} c
      ${whereClause}
      ORDER BY c.created_at DESC
    `;

    const rows = await this.executeQuery(query, params);
    return rows.map((row) => this.mapCampaignRow(row));
  }

  /**
   * Unassign a creative from a campaign
   */
  async unassignCreativeFromCampaign(
    campaignId: string,
    creativeId: string,
  ): Promise<void> {
    const query = `
      UPDATE ${this.getTableRef("campaign_creatives")}
      SET status = 'inactive', updated_at = ${this.getCurrentTimestamp()}
      WHERE campaign_id = @campaignId AND creative_id = @creativeId
    `;

    await this.executeQuery(query, { campaignId, creativeId });
  }

  /**
   * Map BigQuery row to BrandAgentCampaign interface
   */
  private mapCampaignRow(row: Record<string, unknown>): BrandAgentCampaign {
    return {
      audienceIds: Array.isArray(row.audience_ids) ? row.audience_ids : [],
      brandAgentId: String(row.brand_agent_id),
      budget: row.budget_total
        ? {
            currency: String(row.budget_currency || "USD"),
            dailyCap: row.budget_daily_cap
              ? Number(row.budget_daily_cap)
              : undefined,
            pacing: row.budget_pacing ? String(row.budget_pacing) : undefined,
            total: Number(row.budget_total),
          }
        : undefined,
      createdAt: new Date(row.created_at as Date | number | string),
      creativeIds: Array.isArray(row.creative_ids) ? row.creative_ids : [],
      endDate: row.end_date
        ? new Date(row.end_date as Date | number | string)
        : undefined,
      id: String(row.id),
      name: String(row.name),
      prompt: String(row.prompt),
      startDate: row.start_date
        ? new Date(row.start_date as Date | number | string)
        : undefined,
      status: String(row.status || "draft"),
      updatedAt: new Date(row.updated_at as Date | number | string),
    };
  }
}
