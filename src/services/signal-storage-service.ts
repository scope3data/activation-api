import { BigQuery } from "@google-cloud/bigquery";
import { v4 as uuidv4 } from "uuid";

export interface CreateSignalDefinitionInput {
  clusters: Array<{
    channel?: string;
    gdpr_compliant?: boolean;
    region: string;
  }>;
  created_by?: string;
  description: string;
  key_type: string;
  metadata?: Record<string, unknown>;
  name: string;
}

export interface SignalCluster {
  channel?: string;
  cluster_id: string;
  created_at: string;
  gdpr_compliant: boolean;
  is_active: boolean;
  region: string;
  signal_id: string;
}

export interface SignalDefinition {
  created_at: string;
  created_by?: string;
  description: string;
  is_active: boolean;
  key_type: string;
  metadata?: Record<string, unknown>;
  name: string;
  signal_id: string;
  updated_at?: string;
}

export interface SignalDefinitionWithClusters extends SignalDefinition {
  clusters: SignalCluster[];
}

export interface UpdateSignalDefinitionInput {
  clusters?: Array<{
    channel?: string;
    gdpr_compliant?: boolean;
    region: string;
  }>;
  description?: string;
  metadata?: Record<string, unknown>;
  name?: string;
}

export class SignalStorageService {
  private bigquery: BigQuery;
  private clustersTableId: string;
  private datasetId: string;
  private definitionsTableId: string;
  private projectId: string;

  constructor(
    projectId: string = "bok-playground",
    datasetId: string = "custom_signals",
    definitionsTableId: string = "signal_definitions",
    clustersTableId: string = "signal_clusters",
  ) {
    this.bigquery = new BigQuery({ projectId });
    this.projectId = projectId;
    this.datasetId = datasetId;
    this.definitionsTableId = definitionsTableId;
    this.clustersTableId = clustersTableId;
  }

  /**
   * Create a new signal definition with clusters
   */
  async createSignalDefinition(
    input: CreateSignalDefinitionInput,
  ): Promise<SignalDefinitionWithClusters> {
    const signalId = uuidv4();
    const now = new Date().toISOString();

    // Insert signal definition
    const definitionRow = {
      created_at: now,
      created_by: input.created_by || null,
      description: input.description,
      is_active: true,
      key_type: input.key_type,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      name: input.name,
      signal_id: signalId,
    };

    // Insert cluster configurations
    const clusterRows = input.clusters.map((cluster) => ({
      channel: cluster.channel || null,
      cluster_id: uuidv4(),
      created_at: now,
      gdpr_compliant: cluster.gdpr_compliant || false,
      is_active: true,
      region: cluster.region,
      signal_id: signalId,
    }));

    try {
      // Insert definition
      await this.bigquery
        .dataset(this.datasetId)
        .table(this.definitionsTableId)
        .insert([definitionRow]);

      // Insert clusters
      if (clusterRows.length > 0) {
        await this.bigquery
          .dataset(this.datasetId)
          .table(this.clustersTableId)
          .insert(clusterRows);
      }

      return {
        clusters: clusterRows.map((row) => ({
          channel: row.channel || undefined,
          cluster_id: row.cluster_id,
          created_at: row.created_at,
          gdpr_compliant: row.gdpr_compliant,
          is_active: row.is_active,
          region: row.region,
          signal_id: row.signal_id,
        })),
        created_at: now,
        created_by: input.created_by,
        description: input.description,
        is_active: true,
        key_type: input.key_type,
        metadata: input.metadata,
        name: input.name,
        signal_id: signalId,
      };
    } catch (error) {
      throw new Error(
        `Failed to create signal definition: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Delete a signal definition (soft delete)
   */
  async deleteSignalDefinition(signalId: string): Promise<boolean> {
    const now = new Date().toISOString();

    try {
      // Soft delete the signal definition
      const deleteDefQuery = `
        UPDATE \`${this.projectId}.${this.datasetId}.${this.definitionsTableId}\`
        SET is_active = false, updated_at = @updated_at
        WHERE signal_id = @signalId AND is_active = true
      `;

      // Soft delete associated clusters
      const deleteClustersQuery = `
        UPDATE \`${this.projectId}.${this.datasetId}.${this.clustersTableId}\`
        SET is_active = false
        WHERE signal_id = @signalId
      `;

      await this.bigquery.query({
        params: { signalId, updated_at: now },
        query: deleteDefQuery,
      });

      await this.bigquery.query({
        params: { signalId },
        query: deleteClustersQuery,
      });

      return true;
    } catch (error) {
      throw new Error(
        `Failed to delete signal definition ${signalId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get signal definition count for statistics
   */
  async getSignalCount(): Promise<number> {
    try {
      const query = `
        SELECT COUNT(*) as total
        FROM \`${this.projectId}.${this.datasetId}.${this.definitionsTableId}\`
        WHERE is_active = true
      `;

      const [rows] = await this.bigquery.query({ query });
      return rows[0]?.total || 0;
    } catch (error) {
      throw new Error(
        `Failed to get signal count: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get a signal definition by ID with its clusters
   */
  async getSignalDefinition(
    signalId: string,
  ): Promise<null | SignalDefinitionWithClusters> {
    const query = `
      SELECT 
        d.signal_id,
        d.name,
        d.description,
        d.key_type,
        d.created_at,
        d.updated_at,
        d.created_by,
        d.is_active,
        d.metadata,
        c.cluster_id,
        c.region,
        c.channel,
        c.gdpr_compliant
      FROM \`${this.projectId}.${this.datasetId}.${this.definitionsTableId}\` d
      LEFT JOIN \`${this.projectId}.${this.datasetId}.${this.clustersTableId}\` c
        ON d.signal_id = c.signal_id AND c.is_active = true
      WHERE d.signal_id = @signalId 
        AND d.is_active = true
    `;

    try {
      const [rows] = await this.bigquery.query({
        params: { signalId },
        query,
      });

      if (rows.length === 0) {
        return null;
      }

      const definition = rows[0];
      const clusters = rows
        .filter((row) => row.cluster_id)
        .map((row) => ({
          channel: row.channel,
          cluster_id: row.cluster_id,
          created_at: row.created_at,
          gdpr_compliant: row.gdpr_compliant,
          is_active: true,
          region: row.region,
          signal_id: row.signal_id,
        }));

      return {
        clusters,
        created_at: definition.created_at,
        created_by: definition.created_by,
        description: definition.description,
        is_active: definition.is_active,
        key_type: definition.key_type,
        metadata: definition.metadata
          ? JSON.parse(definition.metadata)
          : undefined,
        name: definition.name,
        signal_id: definition.signal_id,
        updated_at: definition.updated_at,
      };
    } catch (error) {
      throw new Error(
        `Failed to get signal definition ${signalId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Health check - test BigQuery connectivity for signal tables
   */
  async healthCheck(): Promise<boolean> {
    try {
      const query = `
        SELECT COUNT(*) as signal_count 
        FROM \`${this.projectId}.${this.datasetId}.${this.definitionsTableId}\` 
        LIMIT 1
      `;
      await this.bigquery.query({ query });
      return true;
    } catch (error) {
      console.error("Signal storage BigQuery health check failed:", error);
      return false;
    }
  }

  /**
   * List all signal definitions with optional filtering
   */
  async listSignalDefinitions(filters?: {
    channel?: string;
    key_type?: string;
    region?: string;
  }): Promise<SignalDefinitionWithClusters[]> {
    let whereClause = "WHERE d.is_active = true";
    const params: Record<string, unknown> = {};

    if (filters?.region) {
      whereClause += " AND c.region = @region";
      params.region = filters.region;
    }

    if (filters?.channel) {
      whereClause += " AND c.channel = @channel";
      params.channel = filters.channel;
    }

    if (filters?.key_type) {
      whereClause += " AND d.key_type = @key_type";
      params.key_type = filters.key_type;
    }

    const query = `
      SELECT 
        d.signal_id,
        d.name,
        d.description,
        d.key_type,
        d.created_at,
        d.updated_at,
        d.created_by,
        d.is_active,
        d.metadata,
        c.cluster_id,
        c.region,
        c.channel,
        c.gdpr_compliant
      FROM \`${this.projectId}.${this.datasetId}.${this.definitionsTableId}\` d
      LEFT JOIN \`${this.projectId}.${this.datasetId}.${this.clustersTableId}\` c
        ON d.signal_id = c.signal_id AND c.is_active = true
      ${whereClause}
      ORDER BY d.created_at DESC
    `;

    try {
      const [rows] = await this.bigquery.query({
        params,
        query,
      });

      // Group by signal_id to consolidate clusters
      const signalMap = new Map<string, SignalDefinitionWithClusters>();

      for (const row of rows) {
        if (!signalMap.has(row.signal_id)) {
          signalMap.set(row.signal_id, {
            clusters: [],
            created_at: row.created_at,
            created_by: row.created_by,
            description: row.description,
            is_active: row.is_active,
            key_type: row.key_type,
            metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
            name: row.name,
            signal_id: row.signal_id,
            updated_at: row.updated_at,
          });
        }

        if (row.cluster_id) {
          signalMap.get(row.signal_id)!.clusters.push({
            channel: row.channel,
            cluster_id: row.cluster_id,
            created_at: row.created_at,
            gdpr_compliant: row.gdpr_compliant,
            is_active: true,
            region: row.region,
            signal_id: row.signal_id,
          });
        }
      }

      return Array.from(signalMap.values());
    } catch (error) {
      throw new Error(
        `Failed to list signal definitions: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update a signal definition
   */
  async updateSignalDefinition(
    signalId: string,
    input: UpdateSignalDefinitionInput,
  ): Promise<SignalDefinitionWithClusters> {
    const now = new Date().toISOString();

    try {
      // Update the signal definition
      if (input.name || input.description || input.metadata) {
        const updateFields: string[] = [];
        const params: Record<string, unknown> = { signalId };

        if (input.name) {
          updateFields.push("name = @name");
          params.name = input.name;
        }

        if (input.description) {
          updateFields.push("description = @description");
          params.description = input.description;
        }

        if (input.metadata) {
          updateFields.push("metadata = @metadata");
          params.metadata = JSON.stringify(input.metadata);
        }

        updateFields.push("updated_at = @updated_at");
        params.updated_at = now;

        const updateQuery = `
          UPDATE \`${this.projectId}.${this.datasetId}.${this.definitionsTableId}\`
          SET ${updateFields.join(", ")}
          WHERE signal_id = @signalId AND is_active = true
        `;

        await this.bigquery.query({
          params,
          query: updateQuery,
        });
      }

      // Update clusters if provided
      if (input.clusters) {
        // Deactivate existing clusters
        const deactivateQuery = `
          UPDATE \`${this.projectId}.${this.datasetId}.${this.clustersTableId}\`
          SET is_active = false
          WHERE signal_id = @signalId
        `;

        await this.bigquery.query({
          params: { signalId },
          query: deactivateQuery,
        });

        // Insert new clusters
        const clusterRows = input.clusters.map((cluster) => ({
          channel: cluster.channel || null,
          cluster_id: uuidv4(),
          created_at: now,
          gdpr_compliant: cluster.gdpr_compliant || false,
          is_active: true,
          region: cluster.region,
          signal_id: signalId,
        }));

        if (clusterRows.length > 0) {
          await this.bigquery
            .dataset(this.datasetId)
            .table(this.clustersTableId)
            .insert(clusterRows);
        }
      }

      // Return the updated signal definition
      const updated = await this.getSignalDefinition(signalId);
      if (!updated) {
        throw new Error(`Signal definition ${signalId} not found after update`);
      }

      return updated;
    } catch (error) {
      throw new Error(
        `Failed to update signal definition ${signalId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
