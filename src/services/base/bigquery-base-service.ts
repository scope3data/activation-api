import { BigQuery } from "@google-cloud/bigquery";

import { AuthenticationService } from "../auth-service.js";

/**
 * Base service for BigQuery operations with shared utilities
 * All BigQuery-backed services should extend this class
 */
export abstract class BigQueryBaseService {
  protected readonly agentTableRef: string;
  protected readonly authService: AuthenticationService;
  protected readonly bigquery: BigQuery;
  protected readonly dataset: string;
  protected readonly projectId: string;

  constructor(authService: AuthenticationService) {
    this.authService = authService;
    this.bigquery = new BigQuery();
    this.projectId = "bok-playground";
    this.dataset = "agenticapi";
    this.agentTableRef =
      "swift-catfish-337215.postgres_datastream.public_agent";
  }

  /**
   * Health check for BigQuery connection
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Test BigQuery connection with a simple query
      const query = "SELECT 1 as test";
      const [rows] = await this.bigquery.query({ query });
      return rows.length > 0;
    } catch (error) {
      console.error("BigQuery health check failed:", error);
      return false;
    }
  }

  /**
   * Execute a BigQuery query with error handling
   */
  protected async executeQuery<T = unknown>(
    query: string,
    params: Record<string, unknown> = {},
  ): Promise<T[]> {
    try {
      const [rows] = await this.bigquery.query({
        params,
        query,
      });
      return rows as T[];
    } catch (error) {
      console.error("BigQuery query failed:", { error, params, query });
      throw error;
    }
  }

  /**
   * Execute a BigQuery query and return a single row
   */
  protected async executeQuerySingle<T = unknown>(
    query: string,
    params: Record<string, unknown> = {},
  ): Promise<null | T> {
    const rows = await this.executeQuery<T>(query, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Get current timestamp for BigQuery operations
   */
  protected getCurrentTimestamp(): string {
    return "CURRENT_TIMESTAMP()";
  }

  /**
   * Format table reference with project and dataset
   */
  protected getTableRef(tableName: string): string {
    return `\`${this.projectId}.${this.dataset}.${tableName}\``;
  }

  /**
   * Resolve customer ID from API token (with authentication service)
   */
  protected async resolveCustomerId(apiToken?: string): Promise<number> {
    if (!apiToken) {
      return 1; // Default fallback
    }

    try {
      const customerId =
        await this.authService.getCustomerIdFromToken(apiToken);
      return customerId || 1; // Fallback to customer 1 if resolution fails
    } catch (error) {
      console.warn("Failed to resolve customer ID from token:", error);
      return 1; // Fallback to customer 1
    }
  }
}
