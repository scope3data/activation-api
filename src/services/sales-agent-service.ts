// Sales Agent Service - manages ADCP sales agents and customer accounts
// Uses the new sales_agents (global registry) and sales_agent_accounts tables

import type { AgentConfig } from "@adcp/client";

import { BigQuery } from "@google-cloud/bigquery";

export interface RegisterSalesAgentRequest {
  account_identifier?: string;
  auth_config?: Record<string, unknown>;
  description?: string;
  endpoint_url: string;
  name: string;
  protocol?: string;
}

// Global sales agent registry
export interface SalesAgent {
  added_at: string;
  added_by?: string;
  description?: string;
  endpoint_url: string;
  id: string;
  name: string;
  protocol: string;
  status: string;
  updated_at: string;
}

// Customer account with a sales agent
export interface SalesAgentAccount {
  account_identifier?: string;
  auth_config?: Record<string, unknown>;
  customer_id: number;
  registered_at: string;
  registered_by?: string;
  sales_agent_id: string;
  status: string;
  updated_at: string;
}

// Combined view for customer - agents with account indicators
export interface SalesAgentWithAccount extends SalesAgent {
  account?: SalesAgentAccount;
  account_type: "scope3_account" | "unavailable" | "your_account";
}

export class SalesAgentService {
  private bigquery: BigQuery;
  private datasetId: string;
  private projectId: string;

  constructor(
    projectId: string = "bok-playground",
    datasetId: string = "agenticapi",
  ) {
    this.bigquery = new BigQuery({ projectId });
    this.projectId = projectId;
    this.datasetId = datasetId;
  }

  /**
   * Get agent configs for discovery - returns configs with proper account precedence
   */
  async getAgentConfigsForDiscovery(
    customerId: number,
  ): Promise<AgentConfig[]> {
    const agentsWithAccounts =
      await this.getSalesAgentsWithAccounts(customerId);

    // Filter to only agents with accounts (your_account or scope3_account)
    const availableAgents = agentsWithAccounts.filter(
      (agent) => agent.account_type !== "unavailable",
    );

    return availableAgents.map((agent) => {
      const authConfig = agent.account?.auth_config || {};

      return {
        agent_uri: agent.endpoint_url,
        id: agent.id,
        name: agent.name,
        protocol:
          (agent.protocol === "adcp"
            ? "mcp"
            : (agent.protocol as "a2a" | "mcp")) || "mcp", // ADCP maps to MCP for client compatibility
        requires_auth: Boolean(authConfig),
        ...authConfig, // Spread auth config into the agent config
      };
    });
  }

  /**
   * Get all sales agents from global registry
   */
  async getAllSalesAgents(): Promise<SalesAgent[]> {
    const query = `
      SELECT 
        id,
        name,
        description,
        endpoint_url,
        protocol,
        status,
        added_at,
        added_by,
        updated_at
      FROM \`${this.projectId}.${this.datasetId}.sales_agents\`
      WHERE status = 'active'
      ORDER BY name ASC
    `;

    try {
      const [rows] = await this.bigquery.query({ query });
      return rows as SalesAgent[];
    } catch (error) {
      throw new Error(
        `Failed to query sales agents: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get all sales agents with account indicators for a customer
   */
  async getSalesAgentsWithAccounts(
    customerId: number,
  ): Promise<SalesAgentWithAccount[]> {
    const query = `
      SELECT 
        sa.id,
        sa.name,
        sa.description,
        sa.endpoint_url,
        sa.protocol,
        sa.status,
        sa.added_at,
        sa.added_by,
        sa.updated_at,
        -- Customer's account
        cust_acc.customer_id as customer_account_id,
        cust_acc.account_identifier as customer_account_identifier,
        cust_acc.auth_config as customer_auth_config,
        cust_acc.status as customer_account_status,
        cust_acc.registered_at as customer_registered_at,
        cust_acc.registered_by as customer_registered_by,
        -- Scope3's account (customer_id = 1)
        scope_acc.customer_id as scope3_account_id,
        scope_acc.account_identifier as scope3_account_identifier,
        scope_acc.auth_config as scope3_auth_config,
        scope_acc.status as scope3_account_status
      FROM \`${this.projectId}.${this.datasetId}.sales_agents\` sa
      -- Left join customer's account
      LEFT JOIN \`${this.projectId}.${this.datasetId}.sales_agent_accounts\` cust_acc
        ON sa.id = cust_acc.sales_agent_id AND cust_acc.customer_id = @customerId AND cust_acc.status = 'active'
      -- Left join Scope3's account (customer_id = 1)
      LEFT JOIN \`${this.projectId}.${this.datasetId}.sales_agent_accounts\` scope_acc
        ON sa.id = scope_acc.sales_agent_id AND scope_acc.customer_id = 1 AND scope_acc.status = 'active'
      WHERE sa.status = 'active'
      ORDER BY sa.name ASC
    `;

    try {
      const [rows] = await this.bigquery.query({
        params: { customerId },
        query,
      });

      return (rows as Record<string, unknown>[]).map((row) => {
        // Determine account type based on precedence
        let accountType: "scope3_account" | "unavailable" | "your_account";
        let account: SalesAgentAccount | undefined;

        if (row.customer_account_id) {
          accountType = "your_account";
          account = {
            account_identifier: row.customer_account_identifier as
              | string
              | undefined,
            auth_config: row.customer_auth_config as
              | Record<string, unknown>
              | undefined,
            customer_id: row.customer_account_id as number,
            registered_at: row.customer_registered_at as string,
            registered_by: row.customer_registered_by as string | undefined,
            sales_agent_id: row.id as string,
            status: row.customer_account_status as string,
            updated_at: row.customer_registered_at as string, // Simplified - should track separately
          };
        } else if (row.scope3_account_id) {
          accountType = "scope3_account";
          account = {
            account_identifier: row.scope3_account_identifier as
              | string
              | undefined,
            auth_config: row.scope3_auth_config as
              | Record<string, unknown>
              | undefined,
            customer_id: row.scope3_account_id as number,
            registered_at: "", // Not needed for scope3 accounts in display
            registered_by: "scope3",
            sales_agent_id: row.id as string,
            status: row.scope3_account_status as string,
            updated_at: "",
          };
        } else {
          accountType = "unavailable";
        }

        return {
          account,
          account_type: accountType,
          added_at: row.added_at as string,
          added_by: row.added_by as string | undefined,
          description: row.description as string | undefined,
          endpoint_url: row.endpoint_url as string,
          id: row.id as string,
          name: row.name as string,
          protocol: row.protocol as string,
          status: row.status as string,
          updated_at: row.updated_at as string,
        };
      });
    } catch (error) {
      throw new Error(
        `Failed to get sales agents with accounts for customer ${customerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Health check - test BigQuery connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const query = `SELECT COUNT(*) as agent_count FROM \`${this.projectId}.${this.datasetId}.sales_agents\` LIMIT 1`;
      await this.bigquery.query({ query });
      return true;
    } catch (error) {
      console.error("Sales agent service health check failed:", error);
      return false;
    }
  }

  /**
   * Register a new sales agent or create account with existing agent
   */
  async registerSalesAgent(
    request: RegisterSalesAgentRequest,
    customerId: number,
    registeredBy: string,
  ): Promise<{
    account: SalesAgentAccount;
    agent: SalesAgent;
    isNewAgent: boolean;
  }> {
    // Check if agent already exists by endpoint URL
    const existingAgentQuery = `
      SELECT id, name, endpoint_url, protocol, status
      FROM \`${this.projectId}.${this.datasetId}.sales_agents\`
      WHERE endpoint_url = @endpoint_url AND status = 'active'
      LIMIT 1
    `;

    const [existingAgentRows] = await this.bigquery.query({
      params: { endpoint_url: request.endpoint_url },
      query: existingAgentQuery,
    });

    let agent: SalesAgent;
    let isNewAgent = false;

    if (existingAgentRows.length > 0) {
      // Agent exists, use existing one
      agent = existingAgentRows[0] as SalesAgent;
    } else {
      // Create new agent
      isNewAgent = true;
      const agentId = `agent_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const insertAgentQuery = `
        INSERT INTO \`${this.projectId}.${this.datasetId}.sales_agents\`
        (id, name, description, endpoint_url, protocol, status, added_by)
        VALUES (@id, @name, @description, @endpoint_url, @protocol, 'active', @added_by)
      `;

      await this.bigquery.query({
        params: {
          added_by: customerId.toString(),
          description: request.description || null,
          endpoint_url: request.endpoint_url,
          id: agentId,
          name: request.name,
          protocol: request.protocol || "adcp",
        },
        query: insertAgentQuery,
      });

      // Fetch the created agent
      const [newAgentRows] = await this.bigquery.query({
        params: { id: agentId },
        query: `SELECT * FROM \`${this.projectId}.${this.datasetId}.sales_agents\` WHERE id = @id`,
      });
      agent = newAgentRows[0] as SalesAgent;
    }

    // Check if account already exists
    const existingAccountQuery = `
      SELECT * FROM \`${this.projectId}.${this.datasetId}.sales_agent_accounts\`
      WHERE customer_id = @customer_id AND sales_agent_id = @sales_agent_id
      LIMIT 1
    `;

    const [existingAccountRows] = await this.bigquery.query({
      params: { customer_id: customerId, sales_agent_id: agent.id },
      query: existingAccountQuery,
    });

    if (existingAccountRows.length > 0) {
      throw new Error(
        `You already have an account registered with ${agent.name}`,
      );
    }

    // Create account
    const insertAccountQuery = `
      INSERT INTO \`${this.projectId}.${this.datasetId}.sales_agent_accounts\`
      (customer_id, sales_agent_id, account_identifier, auth_config, status, registered_by)
      VALUES (@customer_id, @sales_agent_id, @account_identifier, @auth_config, 'active', @registered_by)
    `;

    await this.bigquery.query({
      params: {
        account_identifier: request.account_identifier || null,
        auth_config: JSON.stringify(request.auth_config || {}),
        customer_id: customerId,
        registered_by: registeredBy,
        sales_agent_id: agent.id,
      },
      query: insertAccountQuery,
    });

    // Fetch the created account
    const [newAccountRows] = await this.bigquery.query({
      params: { customer_id: customerId, sales_agent_id: agent.id },
      query: existingAccountQuery,
    });
    const account = newAccountRows[0] as SalesAgentAccount;

    return { account, agent, isNewAgent };
  }

  /**
   * Unregister (deactivate) a customer's account with a sales agent
   */
  async unregisterSalesAgentAccount(
    customerId: number,
    salesAgentId: string,
  ): Promise<void> {
    const updateQuery = `
      UPDATE \`${this.projectId}.${this.datasetId}.sales_agent_accounts\`
      SET status = 'inactive', updated_at = CURRENT_TIMESTAMP()
      WHERE customer_id = @customer_id AND sales_agent_id = @sales_agent_id
    `;

    await this.bigquery.query({
      params: {
        customer_id: customerId,
        sales_agent_id: salesAgentId,
      },
      query: updateQuery,
    });

    // Note: We rely on the constraint check rather than row count validation
    // as BigQuery's numDmlAffectedRows may not be immediately available
  }

  /**
   * Update a customer's account with a sales agent
   */
  async updateSalesAgentAccount(
    customerId: number,
    salesAgentId: string,
    updates: {
      account_identifier?: string;
      auth_config?: Record<string, unknown>;
      status?: string;
    },
  ): Promise<SalesAgentAccount> {
    const updateQuery = `
      UPDATE \`${this.projectId}.${this.datasetId}.sales_agent_accounts\`
      SET 
        account_identifier = COALESCE(@account_identifier, account_identifier),
        auth_config = COALESCE(@auth_config, auth_config),
        status = COALESCE(@status, status),
        updated_at = CURRENT_TIMESTAMP()
      WHERE customer_id = @customer_id AND sales_agent_id = @sales_agent_id
    `;

    await this.bigquery.query({
      params: {
        account_identifier: updates.account_identifier || null,
        auth_config: updates.auth_config
          ? JSON.stringify(updates.auth_config)
          : null,
        customer_id: customerId,
        sales_agent_id: salesAgentId,
        status: updates.status || null,
      },
      query: updateQuery,
    });

    // Return updated account
    const selectQuery = `
      SELECT * FROM \`${this.projectId}.${this.datasetId}.sales_agent_accounts\`
      WHERE customer_id = @customer_id AND sales_agent_id = @sales_agent_id
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      params: { customer_id: customerId, sales_agent_id: salesAgentId },
      query: selectQuery,
    });

    if (rows.length === 0) {
      throw new Error("Sales agent account not found");
    }

    return rows[0] as SalesAgentAccount;
  }
}
