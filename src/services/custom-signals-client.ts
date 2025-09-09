import {
  getBigQueryConfig,
  validateBigQueryConfig,
} from "../config/bigquery-config.js";
import { SignalStorageService } from "./signal-storage-service.js";

/**
 * Custom Signals Client - BigQuery backend for custom signal definitions
 * Provides CRUD operations for signal definitions stored in BigQuery
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
  private initializationError: null | string = null;
  private initialized: boolean = false;
  private storageService: null | SignalStorageService = null;

  constructor() {
    // Initialize asynchronously - client will be ready when first method is called
    this.initializeBigQuery();
  }

  /**
   * Create a new custom signal definition
   */
  async createCustomSignal(
    _apiKey: string, // Not used for BigQuery operations, but kept for interface consistency
    input: CreateCustomSignalInput,
  ): Promise<CustomSignalDefinition> {
    await this.ensureInitialized();

    if (!this.storageService) {
      throw new Error("BigQuery storage service not available");
    }

    const result = await this.storageService.createSignalDefinition({
      clusters: input.clusters.map((c) => ({
        channel: c.channel,
        gdpr_compliant: c.gdpr || false,
        region: c.region,
      })),
      created_by: "mcp-api",
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
  }

  /**
   * Delete a custom signal definition
   */
  async deleteCustomSignal(
    _apiKey: string,
    signalId: string,
  ): Promise<{
    deleted: boolean;
    id: string;
  }> {
    await this.ensureInitialized();

    if (!this.storageService) {
      throw new Error("BigQuery storage service not available");
    }

    const deleted = await this.storageService.deleteSignalDefinition(signalId);
    return {
      deleted,
      id: signalId,
    };
  }

  /**
   * Get a custom signal definition by ID
   */
  async getCustomSignal(
    _apiKey: string,
    signalId: string,
  ): Promise<CustomSignalDefinition | null> {
    await this.ensureInitialized();

    if (!this.storageService) {
      throw new Error("BigQuery storage service not available");
    }

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
  }

  /**
   * Get signal statistics and health information
   */
  async getSignalStatistics(_apiKey: string): Promise<{
    bigQueryEnabled: boolean;
    healthStatus: boolean;
    initializationError?: string;
    totalSignals: number;
  }> {
    let totalSignals = 0;
    let healthStatus = false;

    try {
      await this.ensureInitialized();

      if (this.storageService) {
        totalSignals = await this.storageService.getSignalCount();
        healthStatus = await this.storageService.healthCheck();
      }
    } catch (error) {
      console.error("Failed to get BigQuery statistics:", error);
    }

    return {
      bigQueryEnabled: this.initialized,
      healthStatus,
      initializationError: this.initializationError || undefined,
      totalSignals,
    };
  }

  /**
   * Get initialization status
   */
  getStatus(): {
    error?: string;
    initialized: boolean;
  } {
    return {
      error: this.initializationError || undefined,
      initialized: this.initialized,
    };
  }

  /**
   * Test BigQuery connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      return this.storageService
        ? await this.storageService.healthCheck()
        : false;
    } catch (error) {
      console.error("CustomSignalsClient health check failed:", error);
      return false;
    }
  }

  /**
   * List custom signal definitions with optional filtering
   */
  async listCustomSignals(
    _apiKey: string,
    filters?: {
      channel?: string;
      region?: string;
    },
  ): Promise<{
    signals: CustomSignalDefinition[];
    total: number;
  }> {
    await this.ensureInitialized();

    if (!this.storageService) {
      throw new Error("BigQuery storage service not available");
    }

    const results = await this.storageService.listSignalDefinitions(filters);

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
  }

  /**
   * Update a custom signal definition
   */
  async updateCustomSignal(
    _apiKey: string,
    signalId: string,
    input: UpdateCustomSignalInput,
  ): Promise<CustomSignalDefinition> {
    await this.ensureInitialized();

    if (!this.storageService) {
      throw new Error("BigQuery storage service not available");
    }

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
  }

  /**
   * Ensure client is initialized before operations
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized && this.storageService) {
      return;
    }

    if (this.initializationError) {
      throw new Error(
        `CustomSignalsClient initialization failed: ${this.initializationError}`,
      );
    }

    await this.initializeBigQuery();
  }

  /**
   * Initialize BigQuery backend
   */
  private async initializeBigQuery(): Promise<void> {
    if (this.initialized) return;

    try {
      const config = getBigQueryConfig();
      const errors = validateBigQueryConfig(config);

      if (errors.length > 0) {
        throw new Error(`BigQuery configuration invalid: ${errors.join(", ")}`);
      }

      this.storageService = new SignalStorageService(
        config.projectId,
        config.datasetId,
      );

      // Test connectivity
      const isHealthy = await this.storageService.healthCheck();
      if (!isHealthy) {
        throw new Error("BigQuery health check failed - tables may not exist");
      }

      this.initialized = true;
      console.info(
        "✅ BigQuery Custom Signals client initialized successfully",
      );
    } catch (error) {
      this.initializationError =
        error instanceof Error ? error.message : String(error);
      console.error(
        "❌ Failed to initialize BigQuery Custom Signals client:",
        this.initializationError,
      );
      throw error;
    }
  }
}
