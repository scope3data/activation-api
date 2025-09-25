import { BigQuery } from "@google-cloud/bigquery";

import type { BrandAgent, BrandAgentCampaign } from "../types/brand-agent.js";
import type { Creative } from "../types/creative.js";

import { BigQueryConfig } from "../utils/config.js";
import { AuthenticationService } from "./auth-service.js";
import { BriefSanitizationService } from "./brief-sanitization-service.js";

export class CampaignBigQueryService {
  private agentTableRef: string;
  private authService: AuthenticationService;
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
    this.authService = new AuthenticationService(this.bigquery);
  }

  // ============================================================================
  // CUSTOMER ID RESOLUTION (using AuthenticationService)
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
      types: {
        assignedBy: "STRING",
        campaignId: "STRING",
        creativeId: "STRING",
      },
    });
  }

  // ============================================================================
  // BRAND AGENT METHODS (joining with existing table)
  // ============================================================================

  /**
   * Create a new campaign
   */
  async createCampaign(
    data: {
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
    },
    apiToken?: string,
  ): Promise<string> {
    const campaignId = `campaign_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const customerId = await this.resolveCustomerId(apiToken);

    // Generate sanitized brief for sales agent privacy
    let sanitizedBrief: null | string = null;
    if (data.prompt) {
      try {
        const sanitizationService = new BriefSanitizationService();
        const result = await sanitizationService.sanitizeBrief(
          data.prompt,
          undefined, // No tactic budget at campaign creation time
          data.budgetTotal,
        );
        sanitizedBrief = result.sanitized_brief;
      } catch (error) {
        console.warn(
          `Failed to sanitize campaign brief for ${campaignId}:`,
          error,
        );
        // Continue without sanitized brief rather than failing campaign creation
        sanitizedBrief = null;
      }
    }

    const query = `
      INSERT INTO \`${this.projectId}.${this.dataset}.campaigns\`
      (id, brand_agent_id, customer_id, name, prompt, sanitized_brief, status, budget_total, budget_currency, budget_daily_cap, budget_pacing, scoring_weights, outcome_score_window_days, start_date, end_date)
      VALUES (@id, @brandAgentId, @customerId, @name, @prompt, @sanitizedBrief, @status, @budgetTotal, @budgetCurrency, @budgetDailyCap, @budgetPacing, PARSE_JSON(@scoringWeights), @outcomeScoreWindowDays, @startDate, @endDate)
    `;

    await this.bigquery.query({
      params: {
        brandAgentId: parseInt(data.brandAgentId, 10),
        budgetCurrency: data.budgetCurrency || "USD",
        budgetDailyCap: data.budgetDailyCap || null,
        budgetPacing: data.budgetPacing || "even",
        budgetTotal: data.budgetTotal || null,
        customerId,
        endDate: data.endDate || null,
        id: campaignId,
        name: data.name,
        outcomeScoreWindowDays: data.outcomeScoreWindowDays || 7,
        prompt: data.prompt || null,
        sanitizedBrief,
        scoringWeights: data.scoringWeights
          ? JSON.stringify(data.scoringWeights)
          : null,
        startDate: data.startDate || null,
        status: data.status || "draft",
      },
      query,
      types: {
        brandAgentId: "INT64",
        budgetCurrency: "STRING",
        budgetDailyCap: "FLOAT64",
        budgetPacing: "STRING",
        budgetTotal: "FLOAT64",
        customerId: "INT64",
        endDate: "TIMESTAMP",
        id: "STRING",
        name: "STRING",
        outcomeScoreWindowDays: "INT64",
        prompt: "STRING",
        sanitizedBrief: "STRING",
        scoringWeights: "STRING",
        startDate: "TIMESTAMP",
        status: "STRING",
      },
    });

    return campaignId;
  }

  /**
   * Create a new creative
   */
  async createCreative(
    data: {
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
    },
    apiToken?: string,
  ): Promise<string> {
    const creativeId = `creative_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const customerId = await this.resolveCustomerId(apiToken);

    const query = `
      INSERT INTO \`${this.projectId}.${this.dataset}.creatives\`
      (id, brand_agent_id, customer_id, name, description, format_type, format_id, content, status, version, assembly_method, target_audience, content_categories, created_by)
      VALUES (@id, @brandAgentId, @customerId, @name, @description, @formatType, @formatId, PARSE_JSON(@content), @status, @version, @assemblyMethod, PARSE_JSON(@targetAudience), @contentCategories, @createdBy)
    `;

    await this.bigquery.query({
      params: {
        assemblyMethod: data.assemblyMethod || "pre_assembled",
        brandAgentId: data.brandAgentId,
        content: data.content ? JSON.stringify(data.content) : null,
        contentCategories: data.contentCategories || null,
        createdBy: data.createdBy || "api",
        customerId,
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
   * Delete a campaign
   */
  async deleteCampaign(campaignId: string, apiToken?: string): Promise<void> {
    // Resolve customer ID for security
    const customerId = await this.resolveCustomerId(apiToken);

    // Delete campaign assignments first (foreign key constraints)
    await this.bigquery.query({
      params: { campaignId },
      query: `DELETE FROM \`${this.projectId}.${this.dataset}.campaign_creatives\` WHERE campaign_id = @campaignId`,
    });

    await this.bigquery.query({
      params: { campaignId },
      query: `DELETE FROM \`${this.projectId}.${this.dataset}.campaign_brand_stories\` WHERE campaign_id = @campaignId`,
    });

    // Delete the campaign itself (with customer security check)
    const query = `
      DELETE FROM \`${this.projectId}.${this.dataset}.campaigns\`
      WHERE id = @campaignId AND customer_id = @customerId
    `;

    await this.bigquery.query({
      params: { campaignId, customerId },
      query,
    });
  }

  // ============================================================================
  // CAMPAIGN METHODS
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
        ext.external_id,
        ext.nickname,
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
      externalId: row.external_id ? String(row.external_id) : undefined,
      id: String(row.id),
      name: String(row.name),
      nickname: row.nickname ? String(row.nickname) : undefined,
      updatedAt: new Date(row.updated_at as Date | number | string),
    };
  }

  /**
   * Get campaign with relationships (customer-scoped)
   */
  async getCampaign(
    campaignId: string,
    apiToken?: string,
  ): Promise<BrandAgentCampaign | null> {
    // Resolve customer ID for security
    const customerId = await this.resolveCustomerId(apiToken);

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
      WHERE c.id = @campaignId AND c.customer_id = @customerId
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      params: { campaignId, customerId },
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

  /**
   * Get creative by ID (customer-scoped)
   */
  async getCreative(
    creativeId: string,
    apiToken?: string,
  ): Promise<Creative | null> {
    // Resolve customer ID for security
    const customerId = await this.resolveCustomerId(apiToken);

    const query = `
      SELECT c.*
      FROM \`${this.projectId}.${this.dataset}.creatives\` c
      WHERE c.id = @creativeId AND c.customer_id = @customerId
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      params: { creativeId, customerId },
      query,
    });

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      assemblyMethod: String(row.assembly_method) as
        | "creative_agent"
        | "pre_assembled"
        | "publisher",
      assetIds: [], // No assets table implemented yet
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
      customerId: await this.resolveCustomerId(apiToken),
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
   * Get assignment counts for creatives by brand agent
   */
  async getCreativeAssignmentCounts(
    brandAgentId: string,
  ): Promise<Record<string, number>> {
    const query = `
      SELECT 
        cc.creative_id,
        COUNT(*) as assignment_count
      FROM \`${this.projectId}.${this.dataset}.campaign_creatives\` cc
      JOIN \`${this.projectId}.${this.dataset}.campaigns\` c ON cc.campaign_id = c.id
      WHERE c.brand_agent_id = @brandAgentId AND cc.status = 'active'
      GROUP BY cc.creative_id
    `;

    const [rows] = await this.bigquery.query({
      params: { brandAgentId },
      query,
    });

    const counts: Record<string, number> = {};
    rows.forEach((row: Record<string, unknown>) => {
      counts[String(row.creative_id)] = Number(row.assignment_count);
    });

    return counts;
  }

  /**
   * Get customer ID from API token (backward compatibility)
   */
  async getCustomerIdFromToken(apiToken: string): Promise<null | number> {
    return this.authService.getCustomerIdFromToken(apiToken);
  }

  // ============================================================================
  // CREATIVE METHODS
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
    apiToken?: string,
  ): Promise<BrandAgentCampaign[]> {
    // Resolve customer ID for security
    const customerId = await this.resolveCustomerId(apiToken);

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
      WHERE c.brand_agent_id = @brandAgentId AND c.customer_id = @customerId
    `;

    const params: Record<string, unknown> = {
      brandAgentId: parseInt(brandAgentId, 10), // Convert to INT64 to match schema
      customerId: Number(customerId),
    };

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

  /**
   * List creatives for a brand agent
   */
  async listCreatives(
    brandAgentId: string,
    status?: string,
    apiToken?: string,
  ): Promise<Creative[]> {
    // Resolve customer ID for security
    const customerId = await this.resolveCustomerId(apiToken);

    let query = `
      SELECT c.*
      FROM \`${this.projectId}.${this.dataset}.creatives\` c
      WHERE c.brand_agent_id = @brandAgentId AND c.customer_id = @customerId
    `;

    const params: Record<string, unknown> = {
      brandAgentId: parseInt(brandAgentId, 10), // Convert to INT64 to match schema
      customerId: Number(customerId),
    };

    if (status) {
      query += ` AND c.status = @status`;
      params.status = status;
    }

    query += ` ORDER BY c.created_at DESC`;

    const [rows] = await this.bigquery.query({ params, query });

    return rows.map((row: Record<string, unknown>) => ({
      assemblyMethod: String(row.assembly_method) as
        | "creative_agent"
        | "pre_assembled"
        | "publisher",
      assetIds: [], // No assets table implemented yet
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
      customerId,
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

  // ============================================================================
  // RELATIONSHIP METHODS
  // ============================================================================

  /**
   * Resolve brand agent descriptor to brand agent ID
   * Supports lookup by ID, external ID, or nickname (customer-scoped)
   */
  async resolveBrandAgentId(
    descriptor: { externalId?: string; id?: string; nickname?: string },
    customerId: number,
  ): Promise<null | string> {
    if (descriptor.id) {
      // Direct ID lookup - verify it exists and belongs to customer
      const query = `
        SELECT a.id
        FROM \`${this.agentTableRef}\` a
        WHERE a.id = @agentId AND a.customer_id = @customerId
        LIMIT 1
      `;

      const [rows] = await this.bigquery.query({
        params: { agentId: descriptor.id, customerId },
        query,
      });

      return rows.length > 0 ? descriptor.id : null;
    }

    // Lookup by external ID or nickname in extensions table
    const conditions: string[] = [];
    const params: Record<string, unknown> = { customerId };

    if (descriptor.externalId) {
      conditions.push("ext.external_id = @externalId");
      params.externalId = descriptor.externalId;
    }

    if (descriptor.nickname) {
      conditions.push("ext.nickname = @nickname");
      params.nickname = descriptor.nickname;
    }

    if (conditions.length === 0) {
      return null; // No valid descriptor provided
    }

    const query = `
      SELECT a.id
      FROM \`${this.agentTableRef}\` a
      INNER JOIN \`${this.projectId}.${this.dataset}.brand_agent_extensions\` ext
        ON a.id = ext.agent_id
      WHERE a.customer_id = @customerId AND (${conditions.join(" OR ")})
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      params,
      query,
    });

    return rows.length > 0 ? String(rows[0].id) : null;
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
      types: {
        campaignId: "STRING",
        creativeId: "STRING",
      },
    });
  }

  /**
   * Update an existing campaign
   */
  async updateCampaign(
    campaignId: string,
    updates: {
      budgetCurrency?: string;
      budgetDailyCap?: number;
      budgetPacing?: string;
      budgetTotal?: number;
      endDate?: Date;
      name?: string;
      outcomeScoreWindowDays?: number;
      prompt?: string;
      scoringWeights?: Record<string, unknown>;
      startDate?: Date;
      status?: string;
    },
    apiToken?: string,
  ): Promise<BrandAgentCampaign> {
    // Resolve customer ID for security
    const customerId = await this.resolveCustomerId(apiToken);

    const setClause = [];
    const params: Record<string, unknown> = { campaignId, customerId };

    if (updates.name) {
      setClause.push("name = @name");
      params.name = updates.name;
    }

    if (updates.prompt !== undefined) {
      setClause.push("prompt = @prompt");
      params.prompt = updates.prompt;
    }

    if (updates.status) {
      setClause.push("status = @status");
      params.status = updates.status;
    }

    if (updates.budgetTotal !== undefined) {
      setClause.push("budget_total = @budgetTotal");
      params.budgetTotal = updates.budgetTotal;
    }

    if (updates.budgetCurrency) {
      setClause.push("budget_currency = @budgetCurrency");
      params.budgetCurrency = updates.budgetCurrency;
    }

    if (updates.budgetDailyCap !== undefined) {
      setClause.push("budget_daily_cap = @budgetDailyCap");
      params.budgetDailyCap = updates.budgetDailyCap;
    }

    if (updates.budgetPacing) {
      setClause.push("budget_pacing = @budgetPacing");
      params.budgetPacing = updates.budgetPacing;
    }

    if (updates.scoringWeights) {
      setClause.push("scoring_weights = PARSE_JSON(@scoringWeights)");
      params.scoringWeights = JSON.stringify(updates.scoringWeights);
    }

    if (updates.outcomeScoreWindowDays !== undefined) {
      setClause.push("outcome_score_window_days = @outcomeScoreWindowDays");
      params.outcomeScoreWindowDays = updates.outcomeScoreWindowDays;
    }

    if (updates.startDate !== undefined) {
      setClause.push("start_date = @startDate");
      params.startDate = updates.startDate;
    }

    if (updates.endDate !== undefined) {
      setClause.push("end_date = @endDate");
      params.endDate = updates.endDate;
    }

    // Always update the updated_at timestamp
    setClause.push("updated_at = CURRENT_TIMESTAMP()");

    if (setClause.length === 1) {
      // Only updated_at
      throw new Error("No fields to update");
    }

    const query = `
      UPDATE \`${this.projectId}.${this.dataset}.campaigns\`
      SET ${setClause.join(", ")}
      WHERE id = @campaignId AND customer_id = @customerId
    `;

    await this.bigquery.query({ params, query });

    // Return the updated campaign
    const updatedCampaign = await this.getCampaign(campaignId, apiToken);
    if (!updatedCampaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }

    return updatedCampaign;
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
    apiToken?: string,
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
    const updatedCreative = await this.getCreative(creativeId, apiToken);
    if (!updatedCreative) {
      throw new Error(`Creative not found: ${creativeId}`);
    }

    return updatedCreative;
  }

  /**
   * Create or update brand agent extension with customer-scoped fields
   */
  async upsertBrandAgentExtension(
    agentId: string,
    data: {
      advertiserDomains?: string[];
      description?: string;
      dspSeats?: string[];
      externalId?: string;
      nickname?: string;
    },
  ): Promise<void> {
    const query = `
      MERGE \`${this.projectId}.${this.dataset}.brand_agent_extensions\` ext
      USING (
        SELECT 
          @agentId as agent_id,
          @advertiserDomains as advertiser_domains,
          @description as description,
          @dspSeats as dsp_seats,
          @externalId as external_id,
          @nickname as nickname,
          CURRENT_TIMESTAMP() as created_at,
          CURRENT_TIMESTAMP() as updated_at
      ) new
      ON ext.agent_id = new.agent_id
      WHEN MATCHED THEN
        UPDATE SET
          advertiser_domains = COALESCE(new.advertiser_domains, ext.advertiser_domains),
          description = COALESCE(new.description, ext.description),
          dsp_seats = COALESCE(new.dsp_seats, ext.dsp_seats),
          external_id = COALESCE(new.external_id, ext.external_id),
          nickname = COALESCE(new.nickname, ext.nickname),
          updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN
        INSERT (agent_id, advertiser_domains, description, dsp_seats, external_id, nickname, created_at, updated_at)
        VALUES (new.agent_id, new.advertiser_domains, new.description, new.dsp_seats, new.external_id, new.nickname, new.created_at, new.updated_at)
    `;

    await this.bigquery.query({
      params: {
        advertiserDomains: data.advertiserDomains || null,
        agentId,
        description: data.description || null,
        dspSeats: data.dspSeats || null,
        externalId: data.externalId || null,
        nickname: data.nickname || null,
      },
      query,
    });
  }

  /**
   * Helper method to resolve customer ID from token or use fallback
   */
  private async resolveCustomerId(apiToken?: string): Promise<number> {
    if (apiToken) {
      const customerId =
        await this.authService.getCustomerIdFromToken(apiToken);
      if (customerId) {
        return customerId;
      }
    }
    return BigQueryConfig.DEFAULT_CUSTOMER_ID;
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================
}
