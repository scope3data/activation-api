import { BigQuery } from "@google-cloud/bigquery";

import type { BrandAgent, BrandAgentCampaign } from "../types/brand-agent.js";
import type { Creative } from "../types/creative.js";

export class CampaignBigQueryService {
  private agentTableRef: string;
  private bigquery: BigQuery;
  private dataset: string;
  private projectId: string;

  constructor(
    projectId: string = "bok-playground",
    dataset: string = "agenticapi",
    agentTableRef: string = "swift-catfish-337215.postgres_datastream.public_agent",
  ) {
    this.bigquery = new BigQuery({ location: "us-central1", projectId });
    this.projectId = projectId;
    this.dataset = dataset;
    this.agentTableRef = agentTableRef;
  }

  // ============================================================================
  // BRAND AGENT METHODS (joining with existing table)
  // ============================================================================

  /**
   * Assign brand story to campaign
   */
  async assignBrandStoryToCampaign(
    campaignId: string,
    brandStoryId: string,
    weight?: number,
  ): Promise<void> {
    const query = `
      INSERT INTO \`${this.projectId}.${this.dataset}.campaign_brand_stories\`
      (campaign_id, brand_story_id, weight)
      VALUES (@campaignId, @brandStoryId, @weight)
    `;

    await this.bigquery.query({
      params: {
        brandStoryId,
        campaignId,
        weight: weight || 1.0,
      },
      query,
    });
  }

  /**
   * Assign creative to campaign
   */
  async assignCreativeToCampaign(
    campaignId: string,
    creativeId: string,
    assignedBy?: string,
  ): Promise<void> {
    const query = `
      INSERT INTO \`${this.projectId}.${this.dataset}.campaign_creatives\`
      (campaign_id, creative_id, assigned_by)
      VALUES (@campaignId, @creativeId, @assignedBy)
    `;

    await this.bigquery.query({
      params: {
        assignedBy: assignedBy || "api",
        campaignId,
        creativeId,
      },
      query,
    });
  }

  /**
   * Create a new campaign
   */
  async createCampaign(data: {
    brandAgentId: string;
    budgetCurrency?: string;
    budgetDailyCap?: number;
    budgetPacing?: string;
    budgetTotal?: number;
    endDate?: Date;
    name: string;
    outcomeScoreWindowDays?: number;
    prompt?: string;
    scoringWeights?: Record<string, unknown>;
    startDate?: Date;
    status?: string;
  }): Promise<string> {
    const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const query = `
      INSERT INTO \`${this.projectId}.${this.dataset}.campaigns\`
      (id, brand_agent_id, name, prompt, status, budget_total, budget_currency, budget_daily_cap, budget_pacing, scoring_weights, outcome_score_window_days, start_date, end_date)
      VALUES (@id, @brandAgentId, @name, @prompt, @status, @budgetTotal, @budgetCurrency, @budgetDailyCap, @budgetPacing, PARSE_JSON(@scoringWeights), @outcomeScoreWindowDays, @startDate, @endDate)
    `;

    await this.bigquery.query({
      params: {
        brandAgentId: data.brandAgentId,
        budgetCurrency: data.budgetCurrency || "USD",
        budgetDailyCap: data.budgetDailyCap || null,
        budgetPacing: data.budgetPacing || "even",
        budgetTotal: data.budgetTotal || null,
        endDate: data.endDate || null,
        id: campaignId,
        name: data.name,
        outcomeScoreWindowDays: data.outcomeScoreWindowDays || 7,
        prompt: data.prompt || null,
        scoringWeights: data.scoringWeights
          ? JSON.stringify(data.scoringWeights)
          : null,
        startDate: data.startDate || null,
        status: data.status || "draft",
      },
      query,
    });

    return campaignId;
  }

  // ============================================================================
  // CAMPAIGN METHODS
  // ============================================================================

  /**
   * Create a new creative
   */
  async createCreative(data: {
    assemblyMethod?: string;
    brandAgentId: string;
    content?: Record<string, unknown>;
    contentCategories?: string[];
    createdBy?: string;
    description?: string;
    formatId?: string;
    formatType?: string;
    name: string;
    status?: string;
    targetAudience?: Record<string, unknown>;
    version?: string;
  }): Promise<string> {
    const creativeId = `creative_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const query = `
      INSERT INTO \`${this.projectId}.${this.dataset}.creatives\`
      (id, brand_agent_id, name, description, format_type, format_id, content, status, version, assembly_method, target_audience, content_categories, created_by)
      VALUES (@id, @brandAgentId, @name, @description, @formatType, @formatId, PARSE_JSON(@content), @status, @version, @assemblyMethod, PARSE_JSON(@targetAudience), @contentCategories, @createdBy)
    `;

    await this.bigquery.query({
      params: {
        assemblyMethod: data.assemblyMethod || "pre_assembled",
        brandAgentId: data.brandAgentId,
        content: data.content ? JSON.stringify(data.content) : null,
        contentCategories: data.contentCategories || null,
        createdBy: data.createdBy || "api",
        description: data.description || null,
        formatId: data.formatId || null,
        formatType: data.formatType || null,
        id: creativeId,
        name: data.name,
        status: data.status || "draft",
        targetAudience: data.targetAudience
          ? JSON.stringify(data.targetAudience)
          : null,
        version: data.version || "1.0.0",
      },
      query,
    });

    return creativeId;
  }

  /**
   * Get brand agent with extensions (joins with existing agent table)
   */
  async getBrandAgent(agentId: string): Promise<BrandAgent | null> {
    const query = `
      SELECT 
        a.id,
        a.name,
        a.customer_id,
        ext.advertiser_domains,
        ext.dsp_seats,
        ext.description,
        COALESCE(ext.created_at, a.created_at) as created_at,
        COALESCE(ext.updated_at, a.updated_at, a.created_at) as updated_at
      FROM \`${this.agentTableRef}\` a
      LEFT JOIN \`${this.projectId}.${this.dataset}.brand_agent_extensions\` ext
        ON a.id = ext.agent_id
      WHERE a.id = @agentId
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      params: { agentId },
      query,
    });

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      advertiserDomains: Array.isArray(row.advertiser_domains)
        ? (row.advertiser_domains as string[])
        : [],
      createdAt: new Date(row.created_at as Date | number | string),
      customerId: Number(row.customer_id),
      description: row.description ? String(row.description) : undefined,
      dspSeats: Array.isArray(row.dsp_seats) ? (row.dsp_seats as string[]) : [],
      id: String(row.id),
      name: String(row.name),
      updatedAt: new Date(row.updated_at as Date | number | string),
    };
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
          FROM \`${this.projectId}.${this.dataset}.campaign_creatives\` cc 
          WHERE cc.campaign_id = c.id AND cc.status = 'active'
        ) as creative_ids,
        ARRAY(
          SELECT cbs.brand_story_id 
          FROM \`${this.projectId}.${this.dataset}.campaign_brand_stories\` cbs 
          WHERE cbs.campaign_id = c.id
        ) as audience_ids
      FROM \`${this.projectId}.${this.dataset}.campaigns\` c
      WHERE c.id = @campaignId
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      params: { campaignId },
      query,
    });

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      audienceIds: Array.isArray(row.audience_ids)
        ? (row.audience_ids as string[])
        : [],
      brandAgentId: String(row.brand_agent_id),
      budget: {
        currency: String(row.budget_currency),
        dailyCap: row.budget_daily_cap
          ? Number(row.budget_daily_cap)
          : undefined,
        pacing: row.budget_pacing ? String(row.budget_pacing) : undefined,
        total: Number(row.budget_total),
      },
      createdAt: new Date(row.created_at as Date | number | string),
      creativeIds: Array.isArray(row.creative_ids)
        ? (row.creative_ids as string[])
        : [],
      id: String(row.id),
      name: String(row.name),
      outcomeScoreWindowDays: row.outcome_score_window_days
        ? Number(row.outcome_score_window_days)
        : undefined,
      prompt: String(row.prompt),
      scoringWeights:
        row.scoring_weights && typeof row.scoring_weights === "object"
          ? {
              affinity:
                Number(
                  (row.scoring_weights as Record<string, unknown>).affinity,
                ) || 0.33,
              outcome:
                Number(
                  (row.scoring_weights as Record<string, unknown>).outcome,
                ) || 0.33,
              quality:
                Number(
                  (row.scoring_weights as Record<string, unknown>).quality,
                ) || 0.34,
            }
          : undefined,
      status: String(row.status),
      updatedAt: new Date(row.updated_at as Date | number | string),
    };
  }

  // ============================================================================
  // CREATIVE METHODS
  // ============================================================================

  /**
   * Get creative by ID
   */
  async getCreative(creativeId: string): Promise<Creative | null> {
    const query = `
      SELECT * FROM \`${this.projectId}.${this.dataset}.creatives\`
      WHERE id = @creativeId
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      params: { creativeId },
      query,
    });

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      assemblyMethod: String(row.assembly_method) as
        | "creative_agent"
        | "pre_assembled"
        | "publisher",
      assetIds: [], // TODO: Implement when we add assets
      buyerAgentId: String(row.brand_agent_id),
      content:
        row.content && typeof row.content === "object"
          ? (row.content as Record<string, unknown>)
          : {},
      contentCategories: Array.isArray(row.content_categories)
        ? (row.content_categories as string[])
        : [],
      createdBy: String(row.created_by),
      createdDate: new Date(
        row.created_at as Date | number | string,
      ).toISOString(),
      creativeDescription: row.description
        ? String(row.description)
        : undefined,
      creativeId: String(row.id),
      creativeName: String(row.name),
      customerId: 1, // TODO: Get from brand agent
      format:
        row.format_type && row.format_id
          ? {
              formatId: String(row.format_id),
              type: String(row.format_type) as
                | "adcp"
                | "creative_agent"
                | "publisher",
            }
          : { formatId: "unknown", type: "adcp" },
      lastModifiedBy: String(row.created_by), // Same as created_by for now
      lastModifiedDate: new Date(
        row.updated_at as Date | number | string,
      ).toISOString(),
      status: String(row.status) as
        | "active"
        | "archived"
        | "draft"
        | "paused"
        | "pending_review"
        | "rejected",
      targetAudience: row.target_audience
        ? String(row.target_audience)
        : undefined,
      version: String(row.version),
    };
  }

  /**
   * Health check - test BigQuery connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const query = `SELECT COUNT(*) as count FROM \`${this.projectId}.${this.dataset}.campaigns\` LIMIT 1`;
      await this.bigquery.query({ query });
      return true;
    } catch (error) {
      console.error("Campaign BigQuery health check failed:", error);
      return false;
    }
  }

  /**
   * List brand agents for a customer
   */
  async listBrandAgents(customerId?: number): Promise<BrandAgent[]> {
    let query = `
      SELECT 
        a.id,
        a.name,
        a.customer_id,
        ext.advertiser_domains,
        ext.dsp_seats,
        ext.description,
        COALESCE(ext.created_at, a.created_at) as created_at,
        COALESCE(ext.updated_at, a.updated_at, a.created_at) as updated_at
      FROM \`${this.agentTableRef}\` a
      LEFT JOIN \`${this.projectId}.${this.dataset}.brand_agent_extensions\` ext
        ON a.id = ext.agent_id
    `;

    const params: Record<string, unknown> = {};
    if (customerId) {
      query += ` WHERE a.customer_id = @customerId`;
      params.customerId = customerId;
    }

    query += ` ORDER BY a.name ASC`;

    const [rows] = await this.bigquery.query({ params, query });

    return rows.map((row: Record<string, unknown>) => ({
      advertiserDomains: Array.isArray(row.advertiser_domains)
        ? (row.advertiser_domains as string[])
        : [],
      createdAt: new Date(row.created_at as Date | number | string),
      customerId: Number(row.customer_id),
      description: row.description ? String(row.description) : undefined,
      dspSeats: Array.isArray(row.dsp_seats) ? (row.dsp_seats as string[]) : [],
      id: String(row.id),
      name: String(row.name),
      updatedAt: new Date(row.updated_at as Date | number | string),
    }));
  }

  /**
   * List campaigns for a brand agent
   */
  async listCampaigns(
    brandAgentId: string,
    status?: string,
  ): Promise<BrandAgentCampaign[]> {
    let query = `
      SELECT 
        c.*,
        ARRAY(
          SELECT cc.creative_id 
          FROM \`${this.projectId}.${this.dataset}.campaign_creatives\` cc 
          WHERE cc.campaign_id = c.id AND cc.status = 'active'
        ) as creative_ids,
        ARRAY(
          SELECT cbs.brand_story_id 
          FROM \`${this.projectId}.${this.dataset}.campaign_brand_stories\` cbs 
          WHERE cbs.campaign_id = c.id
        ) as audience_ids
      FROM \`${this.projectId}.${this.dataset}.campaigns\` c
      WHERE c.brand_agent_id = @brandAgentId
    `;

    const params: Record<string, unknown> = { brandAgentId };

    if (status) {
      query += ` AND c.status = @status`;
      params.status = status;
    }

    query += ` ORDER BY c.created_at DESC`;

    const [rows] = await this.bigquery.query({ params, query });

    return rows.map((row: Record<string, unknown>) => ({
      audienceIds: Array.isArray(row.audience_ids)
        ? (row.audience_ids as string[])
        : [],
      brandAgentId: String(row.brand_agent_id),
      budget: {
        currency: String(row.budget_currency),
        dailyCap: row.budget_daily_cap
          ? Number(row.budget_daily_cap)
          : undefined,
        pacing: row.budget_pacing ? String(row.budget_pacing) : undefined,
        total: Number(row.budget_total),
      },
      createdAt: new Date(row.created_at as Date | number | string),
      creativeIds: Array.isArray(row.creative_ids)
        ? (row.creative_ids as string[])
        : [],
      endDate: row.end_date
        ? new Date(row.end_date as Date | number | string)
        : undefined,
      id: String(row.id),
      name: String(row.name),
      outcomeScoreWindowDays: row.outcome_score_window_days
        ? Number(row.outcome_score_window_days)
        : undefined,
      prompt: String(row.prompt),
      scoringWeights:
        row.scoring_weights && typeof row.scoring_weights === "object"
          ? {
              affinity:
                Number(
                  (row.scoring_weights as Record<string, unknown>).affinity,
                ) || 0.33,
              outcome:
                Number(
                  (row.scoring_weights as Record<string, unknown>).outcome,
                ) || 0.33,
              quality:
                Number(
                  (row.scoring_weights as Record<string, unknown>).quality,
                ) || 0.34,
            }
          : undefined,
      startDate: row.start_date
        ? new Date(row.start_date as Date | number | string)
        : undefined,
      status: String(row.status),
      updatedAt: new Date(row.updated_at as Date | number | string),
    }));
  }

  // ============================================================================
  // RELATIONSHIP METHODS
  // ============================================================================

  /**
   * List creatives for a brand agent
   */
  async listCreatives(
    brandAgentId: string,
    status?: string,
  ): Promise<Creative[]> {
    let query = `
      SELECT * FROM \`${this.projectId}.${this.dataset}.creatives\`
      WHERE brand_agent_id = @brandAgentId
    `;

    const params: Record<string, unknown> = { brandAgentId };

    if (status) {
      query += ` AND status = @status`;
      params.status = status;
    }

    query += ` ORDER BY created_at DESC`;

    const [rows] = await this.bigquery.query({ params, query });

    return rows.map((row: Record<string, unknown>) => ({
      assemblyMethod: String(row.assembly_method) as
        | "creative_agent"
        | "pre_assembled"
        | "publisher",
      assetIds: [], // TODO: Implement when we add assets
      buyerAgentId: String(row.brand_agent_id),
      content:
        row.content && typeof row.content === "object"
          ? (row.content as Record<string, unknown>)
          : {},
      contentCategories: Array.isArray(row.content_categories)
        ? (row.content_categories as string[])
        : [],
      createdBy: String(row.created_by),
      createdDate: new Date(
        row.created_at as Date | number | string,
      ).toISOString(),
      creativeDescription: row.description
        ? String(row.description)
        : undefined,
      creativeId: String(row.id),
      creativeName: String(row.name),
      customerId: 1, // TODO: Get from brand agent
      format:
        row.format_type && row.format_id
          ? {
              formatId: String(row.format_id),
              type: String(row.format_type) as
                | "adcp"
                | "creative_agent"
                | "publisher",
            }
          : { formatId: "unknown", type: "adcp" },
      lastModifiedBy: String(row.created_by),
      lastModifiedDate: new Date(
        row.updated_at as Date | number | string,
      ).toISOString(),
      status: String(row.status) as
        | "active"
        | "archived"
        | "draft"
        | "paused"
        | "pending_review"
        | "rejected",
      targetAudience: row.target_audience
        ? String(row.target_audience)
        : undefined,
      version: String(row.version),
    }));
  }

  /**
   * Remove creative from campaign
   */
  async unassignCreativeFromCampaign(
    campaignId: string,
    creativeId: string,
  ): Promise<void> {
    const query = `
      DELETE FROM \`${this.projectId}.${this.dataset}.campaign_creatives\`
      WHERE campaign_id = @campaignId AND creative_id = @creativeId
    `;

    await this.bigquery.query({
      params: { campaignId, creativeId },
      query,
    });
  }

  /**
   * Update an existing creative
   */
  async updateCreative(
    creativeId: string,
    updates: {
      content?: Record<string, unknown>;
      contentCategories?: string[];
      description?: string;
      lastModifiedBy?: string;
      name?: string;
      status?: string;
      targetAudience?: Record<string, unknown>;
    },
  ): Promise<Creative> {
    const setClause = [];
    const params: Record<string, unknown> = { creativeId };

    if (updates.name) {
      setClause.push("name = @name");
      params.name = updates.name;
    }

    if (updates.description !== undefined) {
      setClause.push("description = @description");
      params.description = updates.description;
    }

    if (updates.content) {
      setClause.push("content = @content");
      params.content = JSON.stringify(updates.content);
    }

    if (updates.status) {
      setClause.push("status = @status");
      params.status = updates.status;
    }

    if (updates.targetAudience) {
      setClause.push("target_audience = @targetAudience");
      params.targetAudience = JSON.stringify(updates.targetAudience);
    }

    if (updates.contentCategories) {
      setClause.push("content_categories = @contentCategories");
      params.contentCategories = JSON.stringify(updates.contentCategories);
    }

    if (updates.lastModifiedBy) {
      setClause.push("last_modified_by = @lastModifiedBy");
      params.lastModifiedBy = updates.lastModifiedBy;
    }

    // Always update the updated_at timestamp
    setClause.push("updated_at = CURRENT_TIMESTAMP()");

    if (setClause.length === 1) {
      // Only updated_at
      throw new Error("No fields to update");
    }

    const query = `
      UPDATE \`${this.projectId}.${this.dataset}.creatives\`
      SET ${setClause.join(", ")}
      WHERE id = @creativeId
    `;

    await this.bigquery.query({ params, query });

    // Return the updated creative
    const updatedCreative = await this.getCreative(creativeId);
    if (!updatedCreative) {
      throw new Error(`Creative not found: ${creativeId}`);
    }

    return updatedCreative;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Create or update brand agent extension data
   */
  async upsertBrandAgentExtension(
    agentId: string,
    data: {
      advertiserDomains?: string[];
      description?: string;
      dspSeats?: string[];
    },
  ): Promise<void> {
    const query = `
      MERGE \`${this.projectId}.${this.dataset}.brand_agent_extensions\` AS target
      USING (SELECT 
        @agentId as agent_id,
        @advertiserDomains as advertiser_domains,
        @dspSeats as dsp_seats,
        @description as description,
        CURRENT_TIMESTAMP() as created_at,
        CURRENT_TIMESTAMP() as updated_at
      ) AS source
      ON target.agent_id = source.agent_id
      WHEN MATCHED THEN
        UPDATE SET 
          advertiser_domains = source.advertiser_domains,
          dsp_seats = source.dsp_seats,
          description = source.description,
          updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN
        INSERT (agent_id, advertiser_domains, dsp_seats, description, created_at, updated_at)
        VALUES (source.agent_id, source.advertiser_domains, source.dsp_seats, source.description, source.created_at, source.updated_at)
    `;

    await this.bigquery.query({
      params: {
        advertiserDomains: data.advertiserDomains || null,
        agentId,
        description: data.description || null,
        dspSeats: data.dspSeats || null,
      },
      query,
    });
  }
}
