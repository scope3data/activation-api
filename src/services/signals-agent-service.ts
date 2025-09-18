import { BigQuery } from "@google-cloud/bigquery";
import { v4 as uuidv4 } from "uuid";

import type {
  ActivateSignalResponse,
  ADCPRequest,
  ADCPResponse,
  GetSignalsRequest,
  GetSignalsResponse,
  SignalsAgent,
  SignalsAgentActivity,
  SignalsAgentInput,
  SignalsAgentUpdateInput,
} from "../types/signals-agent.js";

import { AuthenticationService } from "./auth-service.js";
import { BigQueryBaseService } from "./base/bigquery-base-service.js";
import { SignalStorageService } from "./signal-storage-service.js";

/**
 * Service for signals agent operations backed by BigQuery
 * Handles registration, management, and interaction with external signals agents
 */
export class SignalsAgentService extends BigQueryBaseService {
  private signalStorageService: SignalStorageService;

  constructor() {
    const bigquery = new BigQuery();
    const authService = new AuthenticationService(bigquery);
    super(authService);
    // Initialize signal storage service for managing segments
    this.signalStorageService = new SignalStorageService(
      "bok-playground", // projectId
      "custom_signals", // datasetId
    );
  }

  /**
   * Tell agent to activate a signal (create segments using our API)
   */
  async activateSignal(
    agentId: string,
    signalId: string,
  ): Promise<ActivateSignalResponse> {
    const agent = await this.getSignalsAgent(agentId);
    if (!agent) {
      throw new Error(`Signals agent ${agentId} not found`);
    }

    if (agent.status !== "active") {
      throw new Error(`Signals agent ${agent.name} is not active`);
    }

    const start = Date.now();

    try {
      const response = await this.callAgentEndpoint(agent, {
        action: "activate_signal",
        data: { signalId },
        requestId: uuidv4(),
        timestamp: new Date().toISOString(),
      });

      // Record successful activity
      await this.recordActivity({
        activityType: "activate_signal",
        brandAgentId: agent.brandAgentId,
        executedAt: new Date(),
        id: uuidv4(),
        request: { signalId },
        response,
        responseTimeMs: Date.now() - start,
        segmentIds:
          (response.segmentIds as string[]) ||
          (response.segmentId ? [response.segmentId as string] : undefined),
        signalsAgentId: agentId,
        status: "success",
      });

      return {
        segmentId: response.segmentId as string,
        segmentIds: response.segmentIds as string[],
      };
    } catch (error) {
      // Record failed activity
      await this.recordActivity({
        activityType: "activate_signal",
        brandAgentId: agent.brandAgentId,
        errorDetails: error instanceof Error ? error.message : String(error),
        executedAt: new Date(),
        id: uuidv4(),
        request: { signalId },
        responseTimeMs: Date.now() - start,
        signalsAgentId: agentId,
        status: "failed",
      });

      throw error;
    }
  }

  /**
   * Get activity history for a signals agent
   */
  async getAgentHistory(
    agentId: string,
    limit: number = 50,
  ): Promise<SignalsAgentActivity[]> {
    const query = `
      SELECT 
        id,
        signals_agent_id,
        brand_agent_id,
        activity_type,
        request,
        response,
        segment_ids,
        status,
        response_time_ms,
        error_details,
        executed_at
      FROM ${this.getTableRef("signals_agent_activity")}
      WHERE signals_agent_id = @agentId
      ORDER BY executed_at DESC
      LIMIT @limit
    `;

    const rows = await this.executeQuery(query, { agentId, limit });

    return rows.map((row) =>
      this.mapRowToActivity(row as Record<string, unknown>),
    );
  }

  /**
   * Get signals from one or more agents
   */
  async getSignals(
    brandAgentId: string,
    agentIds?: string[],
    brief?: string,
  ): Promise<GetSignalsResponse[]> {
    let agents: SignalsAgent[];

    if (agentIds && agentIds.length > 0) {
      // Get specific agents
      agents = await this.getAgentsByIds(agentIds);
    } else {
      // Get all active agents for the brand agent
      agents = (await this.listSignalsAgents(brandAgentId)).filter(
        (a) => a.status === "active",
      );
    }

    const responses = await Promise.allSettled(
      agents.map(async (agent) => {
        const start = Date.now();
        try {
          const response = await this.queryAgent(agent, {
            brief,
            context: { brandAgentId },
          });

          // Record successful activity
          await this.recordActivity({
            activityType: "get_signals",
            brandAgentId,
            executedAt: new Date(),
            id: uuidv4(),
            request: { agentId: agent.id, brief },
            response,
            responseTimeMs: Date.now() - start,
            signalsAgentId: agent.id,
            status: "success",
          });

          return {
            agentId: agent.id,
            agentName: agent.name,
            metadata: response.metadata,
            signals: response.signals || [],
          } as GetSignalsResponse;
        } catch (error) {
          // Record failed activity
          await this.recordActivity({
            activityType: "get_signals",
            brandAgentId,
            errorDetails:
              error instanceof Error ? error.message : String(error),
            executedAt: new Date(),
            id: uuidv4(),
            request: { agentId: agent.id, brief },
            responseTimeMs: Date.now() - start,
            signalsAgentId: agent.id,
            status: "failed",
          });

          throw error;
        }
      }),
    );

    // Return only successful responses
    return responses
      .filter(
        (result): result is PromiseFulfilledResult<GetSignalsResponse> =>
          result.status === "fulfilled",
      )
      .map((result) => result.value);
  }

  /**
   * Get signals agent by ID
   */
  async getSignalsAgent(agentId: string): Promise<null | SignalsAgent> {
    const query = `
      SELECT 
        id,
        brand_agent_id,
        name,
        description,
        endpoint_url,
        status,
        config,
        registered_at,
        registered_by,
        updated_at
      FROM ${this.getTableRef("signals_agents")}
      WHERE id = @agentId
      LIMIT 1
    `;

    const row = await this.executeQuerySingle(query, { agentId });
    if (!row) return null;

    return this.mapRowToSignalsAgent(row as Record<string, unknown>);
  }

  /**
   * List signals agents for a brand agent
   */
  async listSignalsAgents(brandAgentId: string): Promise<SignalsAgent[]> {
    const query = `
      SELECT 
        id,
        brand_agent_id,
        name,
        description,
        endpoint_url,
        status,
        config,
        registered_at,
        registered_by,
        updated_at
      FROM ${this.getTableRef("signals_agents")}
      WHERE brand_agent_id = @brandAgentId
      ORDER BY registered_at DESC
    `;

    const rows = await this.executeQuery(query, {
      brandAgentId: parseInt(brandAgentId, 10), // Convert to INT64 to match schema
    });

    return rows.map((row) =>
      this.mapRowToSignalsAgent(row as Record<string, unknown>),
    );
  }

  /**
   * Record activity for audit trail
   */
  async recordActivity(activity: SignalsAgentActivity): Promise<void> {
    const query = `
      INSERT INTO ${this.getTableRef("signals_agent_activity")}
      (id, signals_agent_id, brand_agent_id, activity_type, request, response, segment_ids, status, response_time_ms, error_details, executed_at)
      VALUES (@id, @signalsAgentId, @brandAgentId, @activityType, @request, @response, @segmentIds, @status, @responseTimeMs, @errorDetails, @executedAt)
    `;

    await this.executeQuery(query, {
      activityType: activity.activityType,
      brandAgentId: parseInt(activity.brandAgentId, 10), // Convert to INT64 to match schema
      errorDetails: activity.errorDetails || null,
      executedAt: activity.executedAt.toISOString(),
      id: activity.id,
      request: activity.request ? JSON.stringify(activity.request) : null,
      response: activity.response ? JSON.stringify(activity.response) : null,
      responseTimeMs: activity.responseTimeMs || null,
      segmentIds: activity.segmentIds || null,
      signalsAgentId: activity.signalsAgentId,
      status: activity.status,
    });
  }

  /**
   * Register a new signals agent
   */
  async registerSignalsAgent(
    data: SignalsAgentInput,
    _customerId: number,
  ): Promise<SignalsAgent> {
    const agentId = uuidv4();
    const now = this.getCurrentTimestamp();

    const query = `
      INSERT INTO ${this.getTableRef("signals_agents")}
      (id, brand_agent_id, name, description, endpoint_url, status, config, registered_at, registered_by, updated_at)
      VALUES (@agentId, @brandAgentId, @name, @description, @endpointUrl, 'active', @config, ${now}, @registeredBy, ${now})
    `;

    await this.bigquery.query({
      params: {
        agentId,
        brandAgentId: parseInt(data.brandAgentId, 10), // Convert to INT64 to match schema
        config: data.config ? JSON.stringify(data.config) : null,
        description: data.description || null,
        endpointUrl: data.endpointUrl,
        name: data.name,
        registeredBy: data.registeredBy || null,
      },
      query,
      types: {
        agentId: "STRING",
        brandAgentId: "INT64",
        config: "JSON",
        description: "STRING",
        endpointUrl: "STRING",
        name: "STRING",
        registeredBy: "STRING",
      },
    });

    const agent = await this.getSignalsAgent(agentId);
    if (!agent) {
      throw new Error("Failed to retrieve created signals agent");
    }

    // Record the registration activity
    await this.recordActivity({
      activityType: "get_signals", // Use as generic registration activity
      brandAgentId: data.brandAgentId,
      executedAt: new Date(),
      id: uuidv4(),
      request: { action: "register", data },
      responseTimeMs: 0,
      signalsAgentId: agentId,
      status: "success",
    });

    return agent;
  }

  /**
   * Unregister (soft delete) a signals agent
   */
  async unregisterSignalsAgent(agentId: string): Promise<void> {
    const query = `
      UPDATE ${this.getTableRef("signals_agents")}
      SET status = 'inactive', updated_at = ${this.getCurrentTimestamp()}
      WHERE id = @agentId
    `;

    await this.executeQuery(query, { agentId });
  }

  /**
   * Update signals agent
   */
  async updateSignalsAgent(
    agentId: string,
    data: SignalsAgentUpdateInput,
  ): Promise<SignalsAgent> {
    const updateFields: string[] = [];
    const params: Record<string, unknown> = { agentId };

    if (data.name) {
      updateFields.push("name = @name");
      params.name = data.name;
    }

    if (data.description !== undefined) {
      updateFields.push("description = @description");
      params.description = data.description || null;
    }

    if (data.endpointUrl) {
      updateFields.push("endpoint_url = @endpointUrl");
      params.endpointUrl = data.endpointUrl;
    }

    if (data.status) {
      updateFields.push("status = @status");
      params.status = data.status;
    }

    if (data.config) {
      updateFields.push("config = @config");
      params.config = JSON.stringify(data.config);
    }

    if (updateFields.length === 0) {
      throw new Error("No fields to update");
    }

    updateFields.push(`updated_at = ${this.getCurrentTimestamp()}`);

    const query = `
      UPDATE ${this.getTableRef("signals_agents")}
      SET ${updateFields.join(", ")}
      WHERE id = @agentId
    `;

    await this.executeQuery(query, params);

    const agent = await this.getSignalsAgent(agentId);
    if (!agent) {
      throw new Error("Failed to retrieve updated signals agent");
    }

    return agent;
  }

  /**
   * Call agent endpoint for activation
   */
  private async callAgentEndpoint(
    agent: SignalsAgent,
    request: ADCPRequest,
  ): Promise<Record<string, unknown>> {
    const response = await fetch(agent.endpointUrl, {
      body: JSON.stringify(request),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(
        `Agent ${agent.name} returned ${response.status}: ${response.statusText}`,
      );
    }

    const adcpResponse = (await response.json()) as ADCPResponse;

    if (adcpResponse.status === "error") {
      throw new Error(
        `Agent ${agent.name} error: ${adcpResponse.error?.message || "Unknown error"}`,
      );
    }

    return adcpResponse.data || {};
  }

  /**
   * Get agents by IDs
   */
  private async getAgentsByIds(agentIds: string[]): Promise<SignalsAgent[]> {
    if (agentIds.length === 0) return [];

    const placeholders = agentIds.map((_, i) => `@agentId${i}`).join(", ");
    const params: Record<string, unknown> = {};
    agentIds.forEach((id, i) => {
      params[`agentId${i}`] = id;
    });

    const query = `
      SELECT 
        id,
        brand_agent_id,
        name,
        description,
        endpoint_url,
        status,
        config,
        registered_at,
        registered_by,
        updated_at
      FROM ${this.getTableRef("signals_agents")}
      WHERE id IN (${placeholders})
      AND status = 'active'
      ORDER BY registered_at DESC
    `;

    const rows = await this.executeQuery(query, params);

    return rows.map((row) =>
      this.mapRowToSignalsAgent(row as Record<string, unknown>),
    );
  }

  /**
   * Map database row to SignalsAgentActivity
   */
  private mapRowToActivity(row: Record<string, unknown>): SignalsAgentActivity {
    return {
      activityType: String(
        row.activity_type,
      ) as SignalsAgentActivity["activityType"],
      brandAgentId: String(row.brand_agent_id),
      errorDetails: row.error_details ? String(row.error_details) : undefined,
      executedAt: new Date(row.executed_at as Date | number | string),
      id: String(row.id),
      request: row.request ? JSON.parse(String(row.request)) : undefined,
      response: row.response ? JSON.parse(String(row.response)) : undefined,
      responseTimeMs: row.response_time_ms
        ? Number(row.response_time_ms)
        : undefined,
      segmentIds: Array.isArray(row.segment_ids)
        ? (row.segment_ids as string[])
        : undefined,
      signalsAgentId: String(row.signals_agent_id),
      status: String(row.status) as "failed" | "success" | "timeout",
    };
  }

  /**
   * Map database row to SignalsAgent
   */
  private mapRowToSignalsAgent(row: Record<string, unknown>): SignalsAgent {
    return {
      brandAgentId: String(row.brand_agent_id),
      config: row.config ? JSON.parse(String(row.config)) : undefined,
      createdAt: new Date(row.registered_at as Date | number | string),
      description: row.description ? String(row.description) : undefined,
      endpointUrl: String(row.endpoint_url),
      id: String(row.id),
      name: String(row.name),
      registeredAt: new Date(row.registered_at as Date | number | string),
      registeredBy: row.registered_by ? String(row.registered_by) : undefined,
      status: String(row.status) as "active" | "inactive" | "suspended",
      updatedAt: new Date(row.updated_at as Date | number | string),
    };
  }

  /**
   * Query an external signals agent via ADCP protocol
   */
  private async queryAgent(
    agent: SignalsAgent,
    request: GetSignalsRequest,
  ): Promise<Record<string, unknown>> {
    const adcpRequest: ADCPRequest = {
      action: "get_signals",
      data: request as Record<string, unknown>,
      requestId: uuidv4(),
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(agent.endpointUrl, {
      body: JSON.stringify(adcpRequest),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(
        `Agent ${agent.name} returned ${response.status}: ${response.statusText}`,
      );
    }

    const adcpResponse = (await response.json()) as ADCPResponse;

    if (adcpResponse.status === "error") {
      throw new Error(
        `Agent ${agent.name} error: ${adcpResponse.error?.message || "Unknown error"}`,
      );
    }

    return adcpResponse.data || {};
  }
}
