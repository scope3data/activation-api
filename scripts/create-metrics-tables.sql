-- BigQuery metrics storage table for Agentic Platform Dashboard
-- Dataset: bok-playground.agenticapi
-- Location: us-central1

-- Platform Metrics Storage Table
CREATE TABLE IF NOT EXISTS `bok-playground.agenticapi.platform_metrics` (
  id STRING NOT NULL,                    -- UUID for the metric entry
  metric_category STRING NOT NULL,       -- 'platform', 'github', 'slack', 'api_usage', 'trends'
  metric_name STRING NOT NULL,           -- Specific metric identifier
  metric_value FLOAT64,                  -- Numeric value (optional)
  metric_json JSON,                      -- Complex data structures (breakdowns, objects)
  customer_id INT64,                     -- NULL for platform-wide metrics
  collected_at TIMESTAMP NOT NULL,       -- When the metric was collected
  refresh_source STRING NOT NULL,        -- 'cron', 'manual', 'api_call'
  collection_duration_ms INT64,          -- Time taken to collect this metric
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
)
PARTITION BY DATE(collected_at)
CLUSTER BY metric_category, metric_name, collected_at;

-- Metrics Collection Jobs Tracking
CREATE TABLE IF NOT EXISTS `bok-playground.agenticapi.metrics_collection_jobs` (
  job_id STRING NOT NULL,               -- UUID for the collection job
  job_type STRING NOT NULL,             -- 'full_refresh', 'partial_refresh', 'scheduled'
  started_at TIMESTAMP NOT NULL,
  completed_at TIMESTAMP,
  status STRING NOT NULL,               -- 'running', 'completed', 'failed'
  metrics_collected INT64 DEFAULT 0,    -- Count of metrics collected
  sources_attempted ARRAY<STRING>,      -- ['platform', 'github', 'slack', 'posthog']
  sources_succeeded ARRAY<STRING>,      -- Successfully collected sources
  sources_failed ARRAY<STRING>,         -- Failed sources
  error_details JSON,                   -- Error information for failed sources
  total_duration_ms INT64,              -- Total job duration
  triggered_by STRING                   -- 'cron', 'user', 'api'
)
PARTITION BY DATE(started_at)
CLUSTER BY job_type, status, started_at;


-- Views for easy querying

-- Latest metrics view (most recent values per metric)
CREATE OR REPLACE VIEW `bok-playground.agenticapi.latest_metrics` AS
SELECT 
  metric_category,
  metric_name,
  metric_value,
  metric_json,
  customer_id,
  collected_at,
  refresh_source,
  collection_duration_ms
FROM (
  SELECT 
    *,
    ROW_NUMBER() OVER (
      PARTITION BY metric_category, metric_name, COALESCE(customer_id, -1)
      ORDER BY collected_at DESC
    ) AS rn
  FROM `bok-playground.agenticapi.platform_metrics`
)
WHERE rn = 1;

-- Metrics summary view (aggregated by category)
CREATE OR REPLACE VIEW `bok-playground.agenticapi.metrics_summary` AS
SELECT
  metric_category,
  COUNT(*) as total_metrics,
  MAX(collected_at) as last_collected,
  AVG(collection_duration_ms) as avg_collection_time_ms,
  COUNT(DISTINCT DATE(collected_at)) as collection_days
FROM `bok-playground.agenticapi.platform_metrics`
WHERE collected_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
GROUP BY metric_category;

-- Retention policy (optional - can be run periodically)
-- DELETE FROM `bok-playground.agenticapi.platform_metrics` 
-- WHERE collected_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY);

-- DELETE FROM `bok-playground.agenticapi.metrics_collection_jobs`
-- WHERE started_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY);