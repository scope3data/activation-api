import { BigQuery } from "@google-cloud/bigquery";

export interface SalesAgent {
  agent_uri: string;
  auth_token: string;
  customer_id: string;
  name: string;
  principal_id: string;
  protocol: string;
}

export class BigQueryService {
  private bigquery: BigQuery;
  private datasetId: string;
  private projectId: string;
  private tableId: string;

  constructor(
    projectId: string = "bok-playground",
    datasetId: string = "agenticapi",
    tableId: string = "sales_agent",
  ) {
    this.bigquery = new BigQuery({ projectId });
    this.projectId = projectId;
    this.datasetId = datasetId;
    this.tableId = tableId;
  }

  /**
   * Query all active sales agents from BigQuery
   */
  async getAllSalesAgents(): Promise<SalesAgent[]> {
    const query = `
      SELECT 
        customer_id,
        principal_id,
        name,
        agent_uri,
        protocol,
        auth_token
      FROM \`${this.projectId}.${this.datasetId}.${this.tableId}\`
      WHERE agent_uri IS NOT NULL 
        AND protocol IS NOT NULL
      ORDER BY name ASC
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
        // Let BigQuery auto-detect location
      });

      return rows as SalesAgent[];
    } catch (error) {
      throw new Error(
        `Failed to query sales agents from BigQuery: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get sales agents that support MCP protocol specifically
   */
  async getMCPSalesAgents(): Promise<SalesAgent[]> {
    const query = `
      SELECT 
        customer_id,
        principal_id,
        name,
        agent_uri,
        protocol,
        auth_token
      FROM \`${this.projectId}.${this.datasetId}.${this.tableId}\`
      WHERE LOWER(protocol) = 'mcp'
        AND agent_uri IS NOT NULL 
        AND auth_token IS NOT NULL
      ORDER BY name ASC
    `;

    try {
      const [rows] = await this.bigquery.query({
        query,
      });

      return rows as SalesAgent[];
    } catch (error) {
      throw new Error(
        `Failed to query MCP sales agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get a specific sales agent by principal_id
   */
  async getSalesAgentById(principalId: string): Promise<null | SalesAgent> {
    const query = `
      SELECT 
        customer_id,
        principal_id,
        name,
        agent_uri,
        protocol,
        auth_token
      FROM \`${this.projectId}.${this.datasetId}.${this.tableId}\`
      WHERE principal_id = @principalId
        AND agent_uri IS NOT NULL 
        AND protocol IS NOT NULL
      LIMIT 1
    `;

    try {
      const [rows] = await this.bigquery.query({
        params: { principalId },
        query,
      });

      return rows.length > 0 ? (rows[0] as SalesAgent) : null;
    } catch (error) {
      throw new Error(
        `Failed to query sales agent ${principalId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get sales agents filtered by customer ID
   */
  async getSalesAgentsByCustomer(customerId: string): Promise<SalesAgent[]> {
    const query = `
      SELECT 
        customer_id,
        principal_id,
        name,
        agent_uri,
        protocol,
        auth_token
      FROM \`${this.projectId}.${this.datasetId}.${this.tableId}\`
      WHERE customer_id = @customerId
        AND agent_uri IS NOT NULL 
        AND protocol IS NOT NULL
      ORDER BY name ASC
    `;

    try {
      const [rows] = await this.bigquery.query({
        params: { customerId },
        query,
      });

      return rows as SalesAgent[];
    } catch (error) {
      throw new Error(
        `Failed to query sales agents for customer ${customerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Health check - test BigQuery connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const query = `SELECT COUNT(*) as agent_count FROM \`${this.projectId}.${this.datasetId}.${this.tableId}\` LIMIT 1`;
      await this.bigquery.query({ query });
      return true;
    } catch (error) {
      console.error("BigQuery health check failed:", error);
      return false;
    }
  }
}
