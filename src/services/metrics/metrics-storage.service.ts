import { BigQuery } from "@google-cloud/bigquery";
import { v4 as uuidv4 } from "uuid";

import type { MetricEntry } from "../../types/metrics.js";

export interface MetricsCollectionJob {
  completed_at?: Date;
  error_details?: Record<string, unknown>;
  job_id: string;
  job_type: "full_refresh" | "partial_refresh" | "scheduled";
  metrics_collected: number;
  sources_attempted: string[];
  sources_failed: string[];
  sources_succeeded: string[];
  started_at: Date;
  status: "completed" | "failed" | "running";
  total_duration_ms?: number;
  triggered_by: "api" | "cron" | "user";
}

export class MetricsStorageService {
  private bigquery: BigQuery;
  private dataset: string;
  private projectId: string;

  constructor(
    bigquery: BigQuery,
    projectId = "bok-playground",
    dataset = "agenticapi",
  ) {
    this.bigquery = bigquery;
    this.projectId = projectId;
    this.dataset = dataset;
  }

  /**
   * Clean up old metrics (retention policy)
   */
  async cleanupOldMetrics(daysToKeep = 90): Promise<number> {
    const query = `
      DELETE FROM \`${this.projectId}.${this.dataset}.platform_metrics\`
      WHERE collected_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @days_to_keep DAY)
    `;

    const [job] = await this.bigquery.query({
      params: { days_to_keep: daysToKeep },
      query,
    });

    const jobData = job as {
      statistics?: { query?: { numDmlAffectedRows?: string } };
    };
    return jobData.statistics?.query?.numDmlAffectedRows
      ? parseInt(jobData.statistics.query.numDmlAffectedRows.toString())
      : 0;
  }

  /**
   * Complete a metrics collection job
   */
  async completeCollectionJob(
    jobId: string,
    status: "completed" | "failed",
    updates: {
      error_details?: Record<string, unknown>;
      metrics_collected: number;
      sources_failed: string[];
      sources_succeeded: string[];
      total_duration_ms: number;
    },
  ): Promise<void> {
    const query = `
      UPDATE \`${this.projectId}.${this.dataset}.metrics_collection_jobs\`
      SET 
        completed_at = CURRENT_TIMESTAMP(),
        status = @status,
        metrics_collected = @metrics_collected,
        sources_succeeded = @sources_succeeded,
        sources_failed = @sources_failed,
        error_details = @error_details,
        total_duration_ms = @total_duration_ms
      WHERE job_id = @job_id
    `;

    await this.bigquery.query({
      params: {
        error_details: updates.error_details,
        job_id: jobId,
        metrics_collected: updates.metrics_collected,
        sources_failed: updates.sources_failed,
        sources_succeeded: updates.sources_succeeded,
        status,
        total_duration_ms: updates.total_duration_ms,
      },
      query,
    });
  }

  /**
   * Helper to create metric entries
   */
  createMetricEntry(
    category: string,
    name: string,
    value?: number,
    json?: Record<string, unknown>,
    customerId?: number,
    refreshSource: "api_call" | "cron" | "manual" = "manual",
    collectionDuration?: number,
  ): MetricEntry {
    return {
      collected_at: new Date(),
      collection_duration_ms: collectionDuration,
      customer_id: customerId,
      id: uuidv4(),
      metric_category: category,
      metric_json: json,
      metric_name: name,
      metric_value: value,
      refresh_source: refreshSource,
    };
  }

  /**
   * Get metrics collection job status
   */
  async getCollectionJobStatus(
    jobId: string,
  ): Promise<MetricsCollectionJob | null> {
    const query = `
      SELECT *
      FROM \`${this.projectId}.${this.dataset}.metrics_collection_jobs\`
      WHERE job_id = @job_id
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      params: { job_id: jobId },
      query,
    });

    if (rows.length === 0) return null;

    const row = rows[0];
    return {
      completed_at: row.completed_at ? new Date(row.completed_at) : undefined,
      error_details: row.error_details,
      job_id: row.job_id,
      job_type: row.job_type,
      metrics_collected: row.metrics_collected,
      sources_attempted: row.sources_attempted,
      sources_failed: row.sources_failed,
      sources_succeeded: row.sources_succeeded,
      started_at: new Date(row.started_at),
      status: row.status,
      total_duration_ms: row.total_duration_ms,
      triggered_by: row.triggered_by,
    };
  }

  /**
   * Get the latest metrics, optionally filtered by max age
   */
  async getLatestMetrics(params: {
    categories?: string[];
    customer_id?: number;
    max_age_minutes?: number;
  }): Promise<MetricEntry[]> {
    let whereClause = "WHERE rn = 1";
    const queryParams: Record<string, unknown> = {};

    if (params.customer_id) {
      whereClause += " AND customer_id = @customer_id";
      queryParams.customer_id = params.customer_id;
    }

    if (params.max_age_minutes) {
      whereClause += " AND collected_at >= @min_timestamp";
      queryParams.min_timestamp = new Date(
        Date.now() - params.max_age_minutes * 60 * 1000,
      ).toISOString();
    }

    if (params.categories && params.categories.length > 0) {
      whereClause += " AND metric_category IN UNNEST(@categories)";
      queryParams.categories = params.categories;
    }

    const query = `
      SELECT 
        id,
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
        FROM \`${this.projectId}.${this.dataset}.platform_metrics\`
      )
      ${whereClause}
      ORDER BY metric_category, metric_name
    `;

    const [rows] = await this.bigquery.query({
      params: queryParams,
      query,
    });

    return rows.map(this.mapRowToMetricEntry);
  }

  /**
   * Get metrics trends (current vs previous period)
   */
  async getMetricsTrends(
    metricNames: string[],
    hoursBack = 24,
  ): Promise<
    Array<{
      current_value: number;
      metric_category: string;
      metric_name: string;
      previous_value: number;
    }>
  > {
    const query = `
      WITH metric_periods AS (
        SELECT 
          metric_category,
          metric_name,
          metric_value,
          collected_at,
          CASE 
            WHEN collected_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @hours_back HOUR)
            THEN 'current'
            WHEN collected_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @hours_back_double HOUR)
            THEN 'previous'
            ELSE NULL
          END AS period
        FROM \`${this.projectId}.${this.dataset}.platform_metrics\`
        WHERE metric_name IN UNNEST(@metric_names)
          AND metric_value IS NOT NULL
          AND collected_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @hours_back_double HOUR)
      ),
      latest_by_period AS (
        SELECT 
          metric_category,
          metric_name,
          period,
          metric_value,
          ROW_NUMBER() OVER (
            PARTITION BY metric_category, metric_name, period 
            ORDER BY collected_at DESC
          ) AS rn
        FROM metric_periods
        WHERE period IS NOT NULL
      )
      SELECT 
        metric_category,
        metric_name,
        MAX(CASE WHEN period = 'current' THEN metric_value END) AS current_value,
        MAX(CASE WHEN period = 'previous' THEN metric_value END) AS previous_value
      FROM latest_by_period
      WHERE rn = 1
      GROUP BY metric_category, metric_name
      HAVING current_value IS NOT NULL AND previous_value IS NOT NULL
    `;

    const [rows] = await this.bigquery.query({
      params: {
        hours_back: hoursBack,
        hours_back_double: hoursBack * 2,
        metric_names: metricNames,
      },
      query,
    });

    return rows as Array<{
      current_value: number;
      metric_category: string;
      metric_name: string;
      previous_value: number;
    }>;
  }

  /**
   * Get random fun facts
   */
  async getRandomFunFacts(count = 3): Promise<string[]> {
    const query = `
      SELECT fact_text
      FROM \`${this.projectId}.${this.dataset}.fun_facts\`
      WHERE is_active = TRUE
      ORDER BY RAND()
      LIMIT @count
    `;

    const [rows] = await this.bigquery.query({
      params: { count },
      query,
    });

    return rows.map((row: { fact_text: string }) => row.fact_text);
  }

  /**
   * Start a metrics collection job
   */
  async startCollectionJob(
    job: Omit<MetricsCollectionJob, "job_id">,
  ): Promise<string> {
    const jobId = uuidv4();
    const table = this.bigquery
      .dataset(this.dataset)
      .table("metrics_collection_jobs");

    await table.insert([
      {
        error_details: job.error_details,
        job_id: jobId,
        job_type: job.job_type,
        metrics_collected: job.metrics_collected,
        sources_attempted: job.sources_attempted,
        sources_failed: job.sources_failed,
        sources_succeeded: job.sources_succeeded,
        started_at: job.started_at.toISOString(),
        status: job.status,
        triggered_by: job.triggered_by,
      },
    ]);

    return jobId;
  }

  /**
   * Store multiple metrics in a single transaction
   */
  async storeMetrics(metrics: MetricEntry[]): Promise<void> {
    if (metrics.length === 0) return;

    const table = this.bigquery.dataset(this.dataset).table("platform_metrics");

    const rows = metrics.map((metric) => ({
      collected_at: metric.collected_at.toISOString(),
      collection_duration_ms: metric.collection_duration_ms,
      customer_id: metric.customer_id,
      id: metric.id,
      metric_category: metric.metric_category,
      metric_json: metric.metric_json
        ? JSON.stringify(metric.metric_json)
        : null,
      metric_name: metric.metric_name,
      metric_value: metric.metric_value,
      refresh_source: metric.refresh_source,
    }));

    await table.insert(rows);
  }

  /**
   * Map BigQuery row to MetricEntry
   */
  private mapRowToMetricEntry(row: Record<string, unknown>): MetricEntry {
    return {
      collected_at: new Date(row.collected_at as Date | number | string),
      collection_duration_ms: row.collection_duration_ms as number | undefined,
      customer_id: row.customer_id as number | undefined,
      id: row.id as string,
      metric_category: row.metric_category as string,
      metric_json: row.metric_json
        ? JSON.parse(row.metric_json as string)
        : undefined,
      metric_name: row.metric_name as string,
      metric_value: row.metric_value as number | undefined,
      refresh_source: row.refresh_source as "api_call" | "cron" | "manual",
    };
  }
}
