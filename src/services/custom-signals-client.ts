import { BigQuery } from "@google-cloud/bigquery";

import type { Scope3ApiClient } from "../client/scope3-client.js";

import {
  getBigQueryConfig,
  validateBigQueryConfig,
} from "../config/bigquery-config.js";
import { AuthenticationService } from "./auth-service.js";
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
  private authService: AuthenticationService;
  private initializationError: null | string = null;
  private initialized: boolean = false;
  private storageService: null | SignalStorageService = null;

  constructor() {
    // Initialize authentication service
    this.authService = new AuthenticationService(new BigQuery());

    // Initialize asynchronously - client will be ready when first method is called
    this.initializeBigQuery();
  }

  /**
   * Create a new custom signal definition
   */
  async createCustomSignal(
    apiKey: string,
    input: CreateCustomSignalInput,
  ): Promise<CustomSignalDefinition> {
    await this.ensureInitialized();

    if (!this.storageService) {
      throw new Error("BigQuery storage service not available");
    }

    // Resolve customer ID from API key for security
    const customerId = await this.authService.getCustomerIdFromToken(apiKey);
    if (!customerId) {
      throw new Error("Invalid API key or customer not found");
    }

    const result = await this.storageService.createSignalDefinition({
      clusters: input.clusters.map((c) => ({
        channel: c.channel,
        gdpr_compliant: c.gdpr || false,
        region: c.region,
      })),
      created_by: "mcp-api",
      customer_id: customerId,
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
    apiKey: string,
    signalId: string,
  ): Promise<{
    deleted: boolean;
    id: string;
  }> {
    await this.ensureInitialized();

    if (!this.storageService) {
      throw new Error("BigQuery storage service not available");
    }

    // Resolve customer ID from API key for security
    const customerId = await this.authService.getCustomerIdFromToken(apiKey);
    if (!customerId) {
      throw new Error("Invalid API key or customer not found");
    }

    const deleted = await this.storageService.deleteSignalDefinition(
      signalId,
      customerId,
    );
    return {
      deleted,
      id: signalId,
    };
  }

  /**
   * Get a custom signal definition by ID
   */
  async getCustomSignal(
    apiKey: string,
    signalId: string,
  ): Promise<CustomSignalDefinition | null> {
    await this.ensureInitialized();

    if (!this.storageService) {
      throw new Error("BigQuery storage service not available");
    }

    // Resolve customer ID from API key for security
    const customerId = await this.authService.getCustomerIdFromToken(apiKey);
    if (!customerId) {
      throw new Error("Invalid API key or customer not found");
    }

    const result = await this.storageService.getSignalDefinition(
      signalId,
      customerId,
    );
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
   * Get partner visibility - list brand agents (seats) accessible to an API key
   */
  async getPartnerSeats(
    scope3Client: Scope3ApiClient,
    apiKey: string,
  ): Promise<Array<{ customerId: number; id: string; name: string }>> {
    await this.ensureInitialized();

    // Use the provided scope3 client to get brand agents
    const brandAgents = await scope3Client.listBrandAgents(apiKey);

    return brandAgents.map((agent) => ({
      customerId: agent.customerId,
      id: agent.id,
      name: agent.name,
    }));
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
    apiKey: string,
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

    // Resolve customer ID from API key for security
    const customerId = await this.authService.getCustomerIdFromToken(apiKey);
    if (!customerId) {
      throw new Error("Invalid API key or customer not found");
    }

    const results = await this.storageService.listSignalDefinitions(
      customerId,
      filters,
    );

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
   * List custom signal definitions with seat filtering (for partner visibility)
   */
  async listCustomSignalsWithSeatFilter(
    scope3Client: Scope3ApiClient,
    apiKey: string,
    filters?: {
      channel?: string;
      region?: string;
      seatId?: string;
    },
  ): Promise<{
    signals: ({ seatId: string; seatName: string } & CustomSignalDefinition)[];
    total: number;
  }> {
    await this.ensureInitialized();

    if (filters?.seatId) {
      // Filter by specific seat
      const brandAgents = await scope3Client.listBrandAgents(apiKey);
      const seat = brandAgents.find((agent) => agent.id === filters.seatId);

      if (!seat) {
        throw new Error(`Seat ${filters.seatId} not found or not accessible`);
      }

      if (!this.storageService) {
        throw new Error("BigQuery storage service not available");
      }

      const results = await this.storageService.listSignalDefinitions(
        seat.customerId,
        { channel: filters.channel, region: filters.region },
      );

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
        seatId: seat.id,
        seatName: seat.name,
        updatedAt: result.updated_at,
      }));

      return {
        signals,
        total: signals.length,
      };
    } else {
      // List across all accessible seats
      const brandAgents = await scope3Client.listBrandAgents(apiKey);
      const allSignals: ({
        seatId: string;
        seatName: string;
      } & CustomSignalDefinition)[] = [];

      if (!this.storageService) {
        throw new Error("BigQuery storage service not available");
      }

      for (const seat of brandAgents) {
        const results = await this.storageService.listSignalDefinitions(
          seat.customerId,
          { channel: filters?.channel, region: filters?.region },
        );

        const seatSignals = results.map((result) => ({
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
          seatId: seat.id,
          seatName: seat.name,
          updatedAt: result.updated_at,
        }));

        allSignals.push(...seatSignals);
      }

      return {
        signals: allSignals,
        total: allSignals.length,
      };
    }
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
