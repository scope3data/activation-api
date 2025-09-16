import type { BrandAgent } from "../types/brand-agent.js";

import { BigQueryBaseService } from "./base/bigquery-base-service.js";

/**
 * Service for brand agent operations backed by BigQuery
 * Handles brand agent CRUD operations and customer-scoped extensions
 */
export class BrandAgentService extends BigQueryBaseService {
  /**
   * Enhance GraphQL agent with BigQuery extension data
   */
  enhanceAgentWithExtensions(
    graphqlAgent: Record<string, unknown>,
    extension?: Record<string, unknown>,
  ): BrandAgent {
    return {
      advertiserDomains:
        extension && Array.isArray(extension.advertiser_domains)
          ? (extension.advertiser_domains as string[])
          : [],
      createdAt: extension?.created_at
        ? new Date(extension.created_at as Date | number | string)
        : new Date(graphqlAgent.createdAt as Date | number | string),
      customerId: Number(graphqlAgent.customerId),
      description: extension?.description
        ? String(extension.description)
        : graphqlAgent.description
          ? String(graphqlAgent.description)
          : undefined,
      dspSeats:
        extension && Array.isArray(extension.dsp_seats)
          ? (extension.dsp_seats as string[])
          : [],
      externalId: extension?.external_id
        ? String(extension.external_id)
        : undefined,
      id: String(graphqlAgent.id),
      name: String(graphqlAgent.name),
      nickname: extension?.nickname ? String(extension.nickname) : undefined,
      tacticSeedDataCoop: extension?.tactic_seed_data_coop
        ? Boolean(extension.tactic_seed_data_coop)
        : false,
      updatedAt: extension?.updated_at
        ? new Date(extension.updated_at as Date | number | string)
        : graphqlAgent.updatedAt
          ? new Date(graphqlAgent.updatedAt as Date | number | string)
          : new Date(graphqlAgent.createdAt as Date | number | string),
    };
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
        ext.external_id,
        ext.nickname,
        COALESCE(ext.created_at, a.created_at) as created_at,
        COALESCE(ext.updated_at, a.updated_at, a.created_at) as updated_at
      FROM \`${this.agentTableRef}\` a
      LEFT JOIN ${this.getTableRef("brand_agent_extensions")} ext
        ON CAST(a.id AS STRING) = ext.agent_id
      WHERE a.id = @agentId
      LIMIT 1
    `;

    const row = await this.executeQuerySingle(query, { agentId });
    if (!row) return null;

    const typedRow = row as Record<string, unknown>;
    return {
      advertiserDomains: Array.isArray(typedRow.advertiser_domains)
        ? (typedRow.advertiser_domains as string[])
        : [],
      createdAt: new Date(typedRow.created_at as Date | number | string),
      customerId: Number(typedRow.customer_id),
      description: typedRow.description
        ? String(typedRow.description)
        : undefined,
      dspSeats: Array.isArray(typedRow.dsp_seats)
        ? (typedRow.dsp_seats as string[])
        : [],
      externalId: typedRow.external_id
        ? String(typedRow.external_id)
        : undefined,
      id: String(typedRow.id),
      name: String(typedRow.name),
      nickname: typedRow.nickname ? String(typedRow.nickname) : undefined,
      updatedAt: new Date(typedRow.updated_at as Date | number | string),
    };
  }

  /**
   * Get brand agent extensions in bulk for a customer
   * Returns a map of agent_id -> extension data for efficient joining
   */
  async getBrandAgentExtensionsByCustomer(
    customerId: number,
  ): Promise<Map<string, Record<string, unknown>>> {
    const query = `
      SELECT 
        ext.agent_id,
        ext.advertiser_domains,
        ext.dsp_seats,
        ext.description,
        ext.external_id,
        ext.nickname,
        ext.tactic_seed_data_coop,
        ext.created_at,
        ext.updated_at
      FROM ${this.getTableRef("brand_agent_extensions")} ext
      INNER JOIN \`${this.agentTableRef}\` a
        ON CAST(a.id AS STRING) = ext.agent_id
      WHERE a.customer_id = @customerId
    `;

    const rows = await this.executeQuery(query, { customerId });

    const extensionsMap = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const typedRow = row as Record<string, unknown>;
      const agentId = String(typedRow.agent_id);
      extensionsMap.set(agentId, typedRow);
    }

    return extensionsMap;
  }

  /**
   * List brand agents for a customer
   */
  async listBrandAgents(customerId?: number): Promise<BrandAgent[]> {
    let whereClause = "";
    const params: Record<string, unknown> = {};

    if (customerId) {
      whereClause = "WHERE a.customer_id = @customerId";
      params.customerId = customerId;
    }

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
      LEFT JOIN ${this.getTableRef("brand_agent_extensions")} ext
        ON CAST(a.id AS STRING) = ext.agent_id
      ${whereClause}
      ORDER BY a.created_at DESC
    `;

    const rows = await this.executeQuery(query, params);

    return rows.map((row): BrandAgent => {
      const typedRow = row as Record<string, unknown>;
      return {
        advertiserDomains: Array.isArray(typedRow.advertiser_domains)
          ? (typedRow.advertiser_domains as string[])
          : [],
        createdAt: new Date(typedRow.created_at as Date | number | string),
        customerId: Number(typedRow.customer_id),
        description: typedRow.description
          ? String(typedRow.description)
          : undefined,
        dspSeats: Array.isArray(typedRow.dsp_seats)
          ? (typedRow.dsp_seats as string[])
          : [],
        externalId: typedRow.external_id
          ? String(typedRow.external_id)
          : undefined,
        id: String(typedRow.id),
        name: String(typedRow.name),
        nickname: typedRow.nickname ? String(typedRow.nickname) : undefined,
        updatedAt: new Date(typedRow.updated_at as Date | number | string),
      };
    });
  }

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

      const row = await this.executeQuerySingle(query, {
        agentId: descriptor.id,
        customerId,
      });

      return row ? descriptor.id : null;
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
      INNER JOIN ${this.getTableRef("brand_agent_extensions")} ext
        ON CAST(a.id AS STRING) = ext.agent_id
      WHERE a.customer_id = @customerId AND (${conditions.join(" OR ")})
      LIMIT 1
    `;

    const row = await this.executeQuerySingle(query, params);
    return row ? String((row as Record<string, unknown>).id) : null;
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
      MERGE ${this.getTableRef("brand_agent_extensions")} ext
      USING (
        SELECT 
          @agentId as agent_id,
          @advertiserDomains as advertiser_domains,
          @description as description,
          @dspSeats as dsp_seats,
          @externalId as external_id,
          @nickname as nickname,
          ${this.getCurrentTimestamp()} as created_at,
          ${this.getCurrentTimestamp()} as updated_at
      ) new
      ON ext.agent_id = new.agent_id
      WHEN MATCHED THEN
        UPDATE SET
          advertiser_domains = COALESCE(new.advertiser_domains, ext.advertiser_domains),
          description = COALESCE(new.description, ext.description),
          dsp_seats = COALESCE(new.dsp_seats, ext.dsp_seats),
          external_id = COALESCE(new.external_id, ext.external_id),
          nickname = COALESCE(new.nickname, ext.nickname),
          updated_at = ${this.getCurrentTimestamp()}
      WHEN NOT MATCHED THEN
        INSERT (agent_id, advertiser_domains, description, dsp_seats, external_id, nickname, created_at, updated_at)
        VALUES (new.agent_id, new.advertiser_domains, new.description, new.dsp_seats, new.external_id, new.nickname, new.created_at, new.updated_at)
    `;

    await this.executeQuery(query, {
      advertiserDomains: data.advertiserDomains || null,
      agentId,
      description: data.description || null,
      dspSeats: data.dspSeats || null,
      externalId: data.externalId || null,
      nickname: data.nickname || null,
    });
  }
}
