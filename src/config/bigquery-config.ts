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
  const config = {
    batchSize: process.env.BIGQUERY_BATCH_SIZE
      ? parseInt(process.env.BIGQUERY_BATCH_SIZE)
      : 500,
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    datasetId: process.env.BIGQUERY_SIGNALS_DATASET || "custom_signals",
    enabled: process.env.USE_BIGQUERY_STORAGE === "true",
    location: process.env.BIGQUERY_LOCATION || "US",
    projectId: process.env.BIGQUERY_PROJECT_ID || "",
    timeout: process.env.BIGQUERY_TIMEOUT_MS
      ? parseInt(process.env.BIGQUERY_TIMEOUT_MS)
      : 30000,
  };

  // Warn about missing required configuration
  if (!config.projectId) {
    console.warn(
      "⚠️  BIGQUERY_PROJECT_ID not set - BigQuery operations will fail",
    );
  }

  if (!config.enabled) {
    console.info(
      "ℹ️  BigQuery storage disabled - set USE_BIGQUERY_STORAGE=true to enable",
    );
  }

  return config;
}

/**
 * Validate BigQuery configuration
 */
export function validateBigQueryConfig(config: BigQueryConfig): string[] {
  const errors: string[] = [];

  if (!config.projectId || config.projectId.trim() === "") {
    errors.push("BIGQUERY_PROJECT_ID is required and cannot be empty");
  }

  if (!config.datasetId || config.datasetId.trim() === "") {
    errors.push("BIGQUERY_SIGNALS_DATASET is required and cannot be empty");
  }

  if (!config.location || config.location.trim() === "") {
    errors.push("BIGQUERY_LOCATION is required and cannot be empty");
  }

  // Validate timeout range
  if (config.timeout !== undefined) {
    if (
      isNaN(config.timeout) ||
      config.timeout < 1000 ||
      config.timeout > 300000
    ) {
      errors.push(
        "BIGQUERY_TIMEOUT_MS must be a number between 1000 and 300000",
      );
    }
  }

  // Validate batch size range
  if (config.batchSize !== undefined) {
    if (
      isNaN(config.batchSize) ||
      config.batchSize < 1 ||
      config.batchSize > 10000
    ) {
      errors.push("BIGQUERY_BATCH_SIZE must be a number between 1 and 10000");
    }
  }

  // Validate location format (basic check)
  if (config.location && !config.location.match(/^[A-Z]{2}(-[A-Z0-9]+)?$/)) {
    errors.push(
      "BIGQUERY_LOCATION must be a valid location (e.g., US, EU, us-central1)",
    );
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
