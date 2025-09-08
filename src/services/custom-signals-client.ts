import {
  getBigQueryConfig,
  validateBigQueryConfig,
} from "../config/bigquery-config.js";
import { SignalStorageService } from "./signal-storage-service.js";

/**
 * Enhanced Custom Signals Client that uses BigQuery backend when available,
 * falls back to REST API for compatibility
 */

export interface CreateCustomSignalInput {
  clusters: Array<{
    channel?: string;
    gdpr?: boolean;
    region: string;
  }>;
  description: string;
  key: string;
  name: string;
}

export interface CustomSignalDefinition {
  clusters: Array<{
    channel?: string;
    gdpr?: boolean;
    region: string;
  }>;
  createdAt: string;
  description: string;
  id: string;
  key: string;
  name: string;
  updatedAt?: string;
}

export interface UpdateCustomSignalInput {
  clusters?: Array<{
    channel?: string;
    gdpr?: boolean;
    region: string;
  }>;
  description?: string;
  name?: string;
}

export class CustomSignalsClient {
  private bigQueryEnabled: boolean = false;
  private fallbackToRest: boolean = true;
  private storageService: null | SignalStorageService = null;

  constructor() {
    this.initializeBigQuery();
  }

  /**
   * Create a new custom signal definition
   */
  async createCustomSignal(
    apiKey: string,
    input: CreateCustomSignalInput,
  ): Promise<CustomSignalDefinition> {
    // Use BigQuery if available
    if (this.bigQueryEnabled && this.storageService) {
      try {
        const result = await this.storageService.createSignalDefinition({
          clusters: input.clusters.map((c) => ({
            channel: c.channel,
            gdpr_compliant: c.gdpr || false,
            region: c.region,
          })),
          created_by: "mcp-api", // Could extract from API key context
          description: input.description,
          key_type: input.key,
          name: input.name,
        });

        return {
          clusters: result.clusters.map((c) => ({
            channel: c.channel,
            gdpr: c.gdpr_compliant,
            region: c.region,
          })),
          createdAt: result.created_at,
          description: result.description,
          id: result.signal_id,
          key: result.key_type,
          name: result.name,
          updatedAt: result.updated_at,
        };
      } catch (error) {
        console.error("BigQuery createCustomSignal failed:", error);
        if (!this.fallbackToRest) {
          throw error;
        }
        console.info("Falling back to REST API");
      }
    }

    // REST API fallback
    return this.createCustomSignalRest(apiKey, input);
  }

  /**
   * Delete a custom signal definition
   */
  async deleteCustomSignal(
    apiKey: string,
    signalId: string,
  ): Promise<{
    deleted: boolean;
    id: string;
  }> {
    // Use BigQuery if available
    if (this.bigQueryEnabled && this.storageService) {
      try {
        const deleted =
          await this.storageService.deleteSignalDefinition(signalId);
        return {
          deleted,
          id: signalId,
        };
      } catch (error) {
        console.error("BigQuery deleteCustomSignal failed:", error);
        if (!this.fallbackToRest) {
          throw error;
        }
        console.info("Falling back to REST API");
      }
    }

    // REST API fallback
    return this.deleteCustomSignalRest(apiKey, signalId);
  }

  /**
   * Get a custom signal definition by ID
   */
  async getCustomSignal(
    apiKey: string,
    signalId: string,
  ): Promise<CustomSignalDefinition | null> {
    // Use BigQuery if available
    if (this.bigQueryEnabled && this.storageService) {
      try {
        const result = await this.storageService.getSignalDefinition(signalId);
        if (!result) {
          return null;
        }

        return {
          clusters: result.clusters.map((c) => ({
            channel: c.channel,
            gdpr: c.gdpr_compliant,
            region: c.region,
          })),
          createdAt: result.created_at,
          description: result.description,
          id: result.signal_id,
          key: result.key_type,
          name: result.name,
          updatedAt: result.updated_at,
        };
      } catch (error) {
        console.error("BigQuery getCustomSignal failed:", error);
        if (!this.fallbackToRest) {
          throw error;
        }
        console.info("Falling back to REST API");
      }
    }

    // REST API fallback
    return this.getCustomSignalRest(apiKey, signalId);
  }

  /**
   * Get signal statistics
   */
  async getSignalStatistics(_apiKey: string): Promise<{
    bigQueryEnabled: boolean;
    healthStatus: boolean;
    totalSignals: number;
  }> {
    let totalSignals = 0;
    let healthStatus = false;

    if (this.bigQueryEnabled && this.storageService) {
      try {
        totalSignals = await this.storageService.getSignalCount();
        healthStatus = await this.storageService.healthCheck();
      } catch (error) {
        console.error("Failed to get BigQuery statistics:", error);
      }
    }

    return {
      bigQueryEnabled: this.bigQueryEnabled,
      healthStatus,
      totalSignals,
    };
  }

  /**
   * List custom signal definitions with optional filtering
   */
  async listCustomSignals(
    apiKey: string,
    filters?: {
      channel?: string;
      region?: string;
    },
  ): Promise<{
    signals: CustomSignalDefinition[];
    total: number;
  }> {
    // Use BigQuery if available
    if (this.bigQueryEnabled && this.storageService) {
      try {
        const results =
          await this.storageService.listSignalDefinitions(filters);

        const signals = results.map((result) => ({
          clusters: result.clusters.map((c) => ({
            channel: c.channel,
            gdpr: c.gdpr_compliant,
            region: c.region,
          })),
          createdAt: result.created_at,
          description: result.description,
          id: result.signal_id,
          key: result.key_type,
          name: result.name,
          updatedAt: result.updated_at,
        }));

        return {
          signals,
          total: signals.length,
        };
      } catch (error) {
        console.error("BigQuery listCustomSignals failed:", error);
        if (!this.fallbackToRest) {
          throw error;
        }
        console.info("Falling back to REST API");
      }
    }

    // REST API fallback
    return this.listCustomSignalsRest(apiKey, filters);
  }

  /**
   * Update a custom signal definition
   */
  async updateCustomSignal(
    apiKey: string,
    signalId: string,
    input: UpdateCustomSignalInput,
  ): Promise<CustomSignalDefinition> {
    // Use BigQuery if available
    if (this.bigQueryEnabled && this.storageService) {
      try {
        const updateInput: Record<string, unknown> = {};

        if (input.name) updateInput.name = input.name;
        if (input.description) updateInput.description = input.description;
        if (input.clusters) {
          updateInput.clusters = input.clusters.map((c) => ({
            channel: c.channel,
            gdpr_compliant: c.gdpr || false,
            region: c.region,
          }));
        }

        const result = await this.storageService.updateSignalDefinition(
          signalId,
          updateInput,
        );

        return {
          clusters: result.clusters.map((c) => ({
            channel: c.channel,
            gdpr: c.gdpr_compliant,
            region: c.region,
          })),
          createdAt: result.created_at,
          description: result.description,
          id: result.signal_id,
          key: result.key_type,
          name: result.name,
          updatedAt: result.updated_at,
        };
      } catch (error) {
        console.error("BigQuery updateCustomSignal failed:", error);
        if (!this.fallbackToRest) {
          throw error;
        }
        console.info("Falling back to REST API");
      }
    }

    // REST API fallback
    return this.updateCustomSignalRest(apiKey, signalId, input);
  }

  // REST API fallback methods
  private async createCustomSignalRest(
    apiKey: string,
    input: CreateCustomSignalInput,
  ): Promise<CustomSignalDefinition> {
    const response = await fetch("https://api.scope3.com/signal", {
      body: JSON.stringify(input),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    return (await response.json()) as CustomSignalDefinition;
  }

  private async deleteCustomSignalRest(
    apiKey: string,
    signalId: string,
  ): Promise<{
    deleted: boolean;
    id: string;
  }> {
    const response = await fetch(`https://api.scope3.com/signal/${signalId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "MCP-Server/1.0",
      },
      method: "DELETE",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status === 404) {
        throw new Error("Signal not found");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    return (await response.json()) as {
      deleted: boolean;
      id: string;
    };
  }

  private async getCustomSignalRest(
    apiKey: string,
    signalId: string,
  ): Promise<CustomSignalDefinition | null> {
    const response = await fetch(`https://api.scope3.com/signal/${signalId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "MCP-Server/1.0",
      },
      method: "GET",
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    return (await response.json()) as CustomSignalDefinition;
  }

  /**
   * Initialize BigQuery backend if configured
   */
  private async initializeBigQuery(): Promise<void> {
    try {
      const config = getBigQueryConfig();
      const errors = validateBigQueryConfig(config);

      if (errors.length > 0) {
        console.warn("BigQuery configuration errors:", errors);
        console.warn("Custom Signals will use REST API fallback");
        return;
      }

      if (!config.enabled) {
        console.info("BigQuery storage disabled, using REST API fallback");
        return;
      }

      this.storageService = new SignalStorageService(
        config.projectId,
        config.datasetId,
      );

      // Test connectivity
      const isHealthy = await this.storageService.healthCheck();
      if (isHealthy) {
        this.bigQueryEnabled = true;
        console.info("✅ BigQuery backend initialized for Custom Signals");
      } else {
        console.warn(
          "⚠️ BigQuery health check failed, using REST API fallback",
        );
      }
    } catch (error) {
      console.warn("Failed to initialize BigQuery backend:", error);
      console.warn("Custom Signals will use REST API fallback");
    }
  }

  private async listCustomSignalsRest(
    apiKey: string,
    filters?: {
      channel?: string;
      region?: string;
    },
  ): Promise<{
    signals: CustomSignalDefinition[];
    total: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.region) params.append("region", filters.region);
    if (filters?.channel) params.append("channel", filters.channel);

    const url = `https://api.scope3.com/signal${params.toString() ? `?${params.toString()}` : ""}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "MCP-Server/1.0",
      },
      method: "GET",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    return (await response.json()) as {
      signals: CustomSignalDefinition[];
      total: number;
    };
  }

  private async updateCustomSignalRest(
    apiKey: string,
    signalId: string,
    input: UpdateCustomSignalInput,
  ): Promise<CustomSignalDefinition> {
    const response = await fetch(`https://api.scope3.com/signal/${signalId}`, {
      body: JSON.stringify(input),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "PUT",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status === 404) {
        throw new Error("Signal not found");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    return (await response.json()) as CustomSignalDefinition;
  }
}
