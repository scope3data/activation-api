/**
 * BigQuery configuration for Custom Signals Platform
 */

export interface BigQueryConfig {
  batchSize?: number;
  credentialsPath?: string;
  datasetId: string;
  enabled?: boolean;
  location: string;
  projectId: string;
  timeout?: number;
}

/**
 * Get BigQuery configuration from environment variables
 */
export function getBigQueryConfig(): BigQueryConfig {
  return {
    batchSize: parseInt(process.env.BIGQUERY_BATCH_SIZE || "500"),
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    datasetId: process.env.BIGQUERY_SIGNALS_DATASET || "custom_signals",
    enabled: process.env.USE_BIGQUERY_STORAGE !== "false", // Default to enabled
    location: process.env.BIGQUERY_LOCATION || "US",
    projectId: process.env.BIGQUERY_PROJECT_ID || "bok-playground",
    timeout: parseInt(process.env.BIGQUERY_TIMEOUT_MS || "30000"),
  };
}

/**
 * Validate BigQuery configuration
 */
export function validateBigQueryConfig(config: BigQueryConfig): string[] {
  const errors: string[] = [];

  if (!config.projectId) {
    errors.push("BIGQUERY_PROJECT_ID is required");
  }

  if (!config.datasetId) {
    errors.push("BIGQUERY_SIGNALS_DATASET is required");
  }

  if (!config.location) {
    errors.push("BIGQUERY_LOCATION is required");
  }

  if (config.timeout && (config.timeout < 1000 || config.timeout > 300000)) {
    errors.push("BIGQUERY_TIMEOUT_MS must be between 1000 and 300000");
  }

  if (config.batchSize && (config.batchSize < 1 || config.batchSize > 10000)) {
    errors.push("BIGQUERY_BATCH_SIZE must be between 1 and 10000");
  }

  return errors;
}

/**
 * Get dataset tables configuration
 */
export const SIGNAL_TABLES = {
  AUDIT_LOG: "signal_audit_log",
  CLUSTERS: "signal_clusters",
  DATA: "signal_data",
  DEFINITIONS: "signal_definitions",
} as const;

/**
 * Get view names
 */
export const SIGNAL_VIEWS = {
  ACTIVE_SIGNALS: "active_signals_view",
  CLUSTER_SUMMARY: "cluster_summary_view",
} as const;

/**
 * Default BigQuery settings
 */
export const DEFAULT_SETTINGS = {
  MAX_RETRIES: 3,
  QUERY_TIMEOUT: 30000,
  RETRY_DELAY: 1000,
  STREAM_TIMEOUT: 10000,
  TTL_SECONDS: 30 * 24 * 60 * 60, // 30 days
} as const;
