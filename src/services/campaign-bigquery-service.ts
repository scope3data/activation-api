import { BigQuery } from "@google-cloud/bigquery";
import type { BrandAgent, BrandAgentCampaign, BrandAgentCreative } from "../types/brand-agent.js";
import type { Creative } from "../types/creative.js";

export class CampaignBigQueryService {
  private bigquery: BigQuery;
  private projectId: string;
  private dataset: string;
  private agentTableRef: string;

  constructor(
    projectId: string = "bok-playground",
    dataset: string = "agenticapi",
    agentTableRef: string = "swift-catfish-337215.postgres_datastream.public_agent"
  ) {
    this.bigquery = new BigQuery({ projectId, location: "us-central1" });
    this.projectId = projectId;
    this.dataset = dataset;
    this.agentTableRef = agentTableRef;
  }

  // ============================================================================
  // BRAND AGENT METHODS (joining with existing table)
  // ============================================================================

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
      query,
      params: { agentId }
    });

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      customerId: row.customer_id,
      advertiserDomains: row.advertiser_domains || [],
      dspSeats: row.dsp_seats || [],
      description: row.description,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
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

    const params: Record<string, any> = {};
    if (customerId) {
      query += ` WHERE a.customer_id = @customerId`;
      params.customerId = customerId;
    }
    
    query += ` ORDER BY a.name ASC`;

    const [rows] = await this.bigquery.query({ query, params });

    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      customerId: row.customer_id,
      advertiserDomains: row.advertiser_domains || [],
      dspSeats: row.dsp_seats || [],
      description: row.description,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  /**
   * Create or update brand agent extension data
   */
  async upsertBrandAgentExtension(agentId: string, data: {
    advertiserDomains?: string[];
    dspSeats?: string[];
    description?: string;
  }): Promise<void> {
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
      query,
      params: {
        agentId,
        advertiserDomains: data.advertiserDomains || null,
        dspSeats: data.dspSeats || null,
        description: data.description || null
      }
    });
  }

  // ============================================================================
  // CAMPAIGN METHODS
  // ============================================================================

  /**
   * Create a new campaign
   */
  async createCampaign(data: {
    brandAgentId: string;
    name: string;
    prompt?: string;
    status?: string;
    budgetTotal?: number;
    budgetCurrency?: string;
    budgetDailyCap?: number;
    budgetPacing?: string;
    scoringWeights?: Record<string, any>;
    outcomeScoreWindowDays?: number;
  }): Promise<string> {
    const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const query = `
      INSERT INTO \`${this.projectId}.${this.dataset}.campaigns\`
      (id, brand_agent_id, name, prompt, status, budget_total, budget_currency, budget_daily_cap, budget_pacing, scoring_weights, outcome_score_window_days)
      VALUES (@id, @brandAgentId, @name, @prompt, @status, @budgetTotal, @budgetCurrency, @budgetDailyCap, @budgetPacing, PARSE_JSON(@scoringWeights), @outcomeScoreWindowDays)
    `;

    await this.bigquery.query({
      query,
      params: {
        id: campaignId,
        brandAgentId: data.brandAgentId,
        name: data.name,
        prompt: data.prompt || null,
        status: data.status || 'draft',
        budgetTotal: data.budgetTotal || null,
        budgetCurrency: data.budgetCurrency || 'USD',
        budgetDailyCap: data.budgetDailyCap || null,
        budgetPacing: data.budgetPacing || 'even',
        scoringWeights: data.scoringWeights ? JSON.stringify(data.scoringWeights) : null,
        outcomeScoreWindowDays: data.outcomeScoreWindowDays || 7
      }
    });

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
      query,
      params: { campaignId }
    });

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      id: row.id,
      brandAgentId: row.brand_agent_id,
      name: row.name,
      prompt: row.prompt,
      status: row.status,
      budget: {
        total: row.budget_total,
        currency: row.budget_currency,
        dailyCap: row.budget_daily_cap,
        pacing: row.budget_pacing
      },
      creativeIds: row.creative_ids || [],
      audienceIds: row.audience_ids || [],
      scoringWeights: row.scoring_weights ? {
        affinity: row.scoring_weights.affinity || 0.33,
        outcome: row.scoring_weights.outcome || 0.33,
        quality: row.scoring_weights.quality || 0.34
      } : undefined,
      outcomeScoreWindowDays: row.outcome_score_window_days,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  /**
   * List campaigns for a brand agent
   */
  async listCampaigns(brandAgentId: string, status?: string): Promise<BrandAgentCampaign[]> {
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

    const params: Record<string, any> = { brandAgentId };
    
    if (status) {
      query += ` AND c.status = @status`;
      params.status = status;
    }
    
    query += ` ORDER BY c.created_at DESC`;

    const [rows] = await this.bigquery.query({ query, params });

    return rows.map((row: any) => ({
      id: row.id,
      brandAgentId: row.brand_agent_id,
      name: row.name,
      prompt: row.prompt,
      status: row.status,
      budget: {
        total: row.budget_total,
        currency: row.budget_currency,
        dailyCap: row.budget_daily_cap,
        pacing: row.budget_pacing
      },
      creativeIds: row.creative_ids || [],
      audienceIds: row.audience_ids || [],
      scoringWeights: row.scoring_weights ? {
        affinity: row.scoring_weights.affinity || 0.33,
        outcome: row.scoring_weights.outcome || 0.33,
        quality: row.scoring_weights.quality || 0.34
      } : undefined,
      outcomeScoreWindowDays: row.outcome_score_window_days,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    }));
  }

  // ============================================================================
  // CREATIVE METHODS
  // ============================================================================

  /**
   * Create a new creative
   */
  async createCreative(data: {
    brandAgentId: string;
    name: string;
    description?: string;
    formatType?: string;
    formatId?: string;
    content?: Record<string, any>;
    status?: string;
    version?: string;
    assemblyMethod?: string;
    targetAudience?: Record<string, any>;
    contentCategories?: string[];
    createdBy?: string;
  }): Promise<string> {
    const creativeId = `creative_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    
    const query = `
      INSERT INTO \`${this.projectId}.${this.dataset}.creatives\`
      (id, brand_agent_id, name, description, format_type, format_id, content, status, version, assembly_method, target_audience, content_categories, created_by)
      VALUES (@id, @brandAgentId, @name, @description, @formatType, @formatId, PARSE_JSON(@content), @status, @version, @assemblyMethod, PARSE_JSON(@targetAudience), @contentCategories, @createdBy)
    `;

    await this.bigquery.query({
      query,
      params: {
        id: creativeId,
        brandAgentId: data.brandAgentId,
        name: data.name,
        description: data.description || null,
        formatType: data.formatType || null,
        formatId: data.formatId || null,
        content: data.content ? JSON.stringify(data.content) : null,
        status: data.status || 'draft',
        version: data.version || '1.0.0',
        assemblyMethod: data.assemblyMethod || 'pre_assembled',
        targetAudience: data.targetAudience ? JSON.stringify(data.targetAudience) : null,
        contentCategories: data.contentCategories || null,
        createdBy: data.createdBy || 'api'
      }
    });

    return creativeId;
  }

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
      query,
      params: { creativeId }
    });

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      creativeId: row.id,
      creativeName: row.name,
      buyerAgentId: row.brand_agent_id,
      creativeDescription: row.description,
      format: row.format_type && row.format_id ? {
        type: row.format_type as "adcp" | "creative_agent" | "publisher",
        formatId: row.format_id
      } : { type: "adcp", formatId: "unknown" },
      content: row.content || {},
      status: row.status,
      version: row.version,
      assemblyMethod: row.assembly_method,
      targetAudience: row.target_audience,
      contentCategories: row.content_categories || [],
      createdBy: row.created_by,
      lastModifiedBy: row.created_by, // Same as created_by for now
      createdDate: new Date(row.created_at).toISOString(),
      lastModifiedDate: new Date(row.updated_at).toISOString(),
      customerId: 1, // TODO: Get from brand agent
      assetIds: [] // TODO: Implement when we add assets
    };
  }

  /**
   * List creatives for a brand agent
   */
  async listCreatives(brandAgentId: string, status?: string): Promise<Creative[]> {
    let query = `
      SELECT * FROM \`${this.projectId}.${this.dataset}.creatives\`
      WHERE brand_agent_id = @brandAgentId
    `;

    const params: Record<string, any> = { brandAgentId };
    
    if (status) {
      query += ` AND status = @status`;
      params.status = status;
    }
    
    query += ` ORDER BY created_at DESC`;

    const [rows] = await this.bigquery.query({ query, params });

    return rows.map((row: any) => ({
      creativeId: row.id,
      creativeName: row.name,
      buyerAgentId: row.brand_agent_id,
      creativeDescription: row.description,
      format: row.format_type && row.format_id ? {
        type: row.format_type as "adcp" | "creative_agent" | "publisher",
        formatId: row.format_id
      } : { type: "adcp", formatId: "unknown" },
      content: row.content || {},
      status: row.status,
      version: row.version,
      assemblyMethod: row.assembly_method,
      targetAudience: row.target_audience,
      contentCategories: row.content_categories || [],
      createdBy: row.created_by,
      lastModifiedBy: row.created_by,
      createdDate: new Date(row.created_at).toISOString(),
      lastModifiedDate: new Date(row.updated_at).toISOString(),
      customerId: 1, // TODO: Get from brand agent
      assetIds: [] // TODO: Implement when we add assets
    }));
  }

  /**
   * Update an existing creative
   */
  async updateCreative(creativeId: string, updates: {
    name?: string;
    description?: string;
    content?: Record<string, any>;
    status?: string;
    targetAudience?: Record<string, any>;
    contentCategories?: string[];
    lastModifiedBy?: string;
  }): Promise<Creative> {
    const setClause = [];
    const params: Record<string, any> = { creativeId };
    
    if (updates.name) {
      setClause.push('name = @name');
      params.name = updates.name;
    }
    
    if (updates.description !== undefined) {
      setClause.push('description = @description');
      params.description = updates.description;
    }
    
    if (updates.content) {
      setClause.push('content = @content');
      params.content = JSON.stringify(updates.content);
    }
    
    if (updates.status) {
      setClause.push('status = @status');
      params.status = updates.status;
    }
    
    if (updates.targetAudience) {
      setClause.push('target_audience = @targetAudience');
      params.targetAudience = JSON.stringify(updates.targetAudience);
    }
    
    if (updates.contentCategories) {
      setClause.push('content_categories = @contentCategories');
      params.contentCategories = JSON.stringify(updates.contentCategories);
    }
    
    if (updates.lastModifiedBy) {
      setClause.push('last_modified_by = @lastModifiedBy');
      params.lastModifiedBy = updates.lastModifiedBy;
    }
    
    // Always update the updated_at timestamp
    setClause.push('updated_at = CURRENT_TIMESTAMP()');
    
    if (setClause.length === 1) { // Only updated_at
      throw new Error('No fields to update');
    }
    
    const query = `
      UPDATE \`${this.projectId}.${this.dataset}.creatives\`
      SET ${setClause.join(', ')}
      WHERE id = @creativeId
    `;
    
    await this.bigquery.query({ query, params });
    
    // Return the updated creative
    const updatedCreative = await this.getCreative(creativeId);
    if (!updatedCreative) {
      throw new Error(`Creative not found: ${creativeId}`);
    }
    
    return updatedCreative;
  }

  // ============================================================================
  // RELATIONSHIP METHODS
  // ============================================================================

  /**
   * Assign creative to campaign
   */
  async assignCreativeToCampaign(campaignId: string, creativeId: string, assignedBy?: string): Promise<void> {
    const query = `
      INSERT INTO \`${this.projectId}.${this.dataset}.campaign_creatives\`
      (campaign_id, creative_id, assigned_by)
      VALUES (@campaignId, @creativeId, @assignedBy)
    `;

    await this.bigquery.query({
      query,
      params: {
        campaignId,
        creativeId,
        assignedBy: assignedBy || 'api'
      }
    });
  }

  /**
   * Remove creative from campaign
   */
  async unassignCreativeFromCampaign(campaignId: string, creativeId: string): Promise<void> {
    const query = `
      DELETE FROM \`${this.projectId}.${this.dataset}.campaign_creatives\`
      WHERE campaign_id = @campaignId AND creative_id = @creativeId
    `;

    await this.bigquery.query({
      query,
      params: { campaignId, creativeId }
    });
  }

  /**
   * Assign brand story to campaign
   */
  async assignBrandStoryToCampaign(campaignId: string, brandStoryId: string, weight?: number): Promise<void> {
    const query = `
      INSERT INTO \`${this.projectId}.${this.dataset}.campaign_brand_stories\`
      (campaign_id, brand_story_id, weight)
      VALUES (@campaignId, @brandStoryId, @weight)
    `;

    await this.bigquery.query({
      query,
      params: {
        campaignId,
        brandStoryId,
        weight: weight || 1.0
      }
    });
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

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
}