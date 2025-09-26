import { Storage } from '@google-cloud/storage';
import { BigQuery } from '@google-cloud/bigquery';
import { analytics, metrics, logger } from '../services/monitoring-service.js';
import { circuitBreakers } from '../utils/error-handling.js';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  duration: number;
  error?: string;
  metadata?: Record<string, any>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: HealthCheck[];
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

export class HealthCheckService {
  private startTime = Date.now();
  private storage: Storage | null = null;
  private bigquery: BigQuery | null = null;

  constructor() {
    // Initialize services if credentials are available
    try {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        this.storage = new Storage();
        this.bigquery = new BigQuery();
      }
    } catch (error) {
      logger.warn('Failed to initialize Google Cloud services for health checks', {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async performHealthCheck(includeExtended = false): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checks: HealthCheck[] = [];

    logger.debug('Starting health check', { includeExtended });

    // Basic system checks
    checks.push(await this.checkMemoryUsage());
    checks.push(await this.checkNodeVersion());

    // Service availability checks
    if (this.storage) {
      checks.push(await this.checkGCSConnection());
    }

    if (this.bigquery && includeExtended) {
      checks.push(await this.checkBigQueryConnection());
    }

    // Circuit breaker status
    checks.push(this.checkCircuitBreakers());

    // Environment checks
    checks.push(this.checkEnvironmentVariables());

    // Calculate overall status
    const summary = this.calculateSummary(checks);
    const overallStatus = this.determineOverallStatus(summary);

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks,
      summary,
    };

    const duration = Date.now() - startTime;
    
    logger.info('Health check completed', {
      status: overallStatus,
      duration,
      totalChecks: checks.length,
      healthyChecks: summary.healthy
    });

    // Track health check metrics
    metrics.toolCalls.inc({ 
      tool_name: 'health_check', 
      status: overallStatus 
    });

    metrics.toolDuration.observe(
      { tool_name: 'health_check' }, 
      duration / 1000
    );

    return result;
  }

  private async checkMemoryUsage(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
      const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
      const heapUsagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

      // Memory thresholds
      const warningThreshold = 80; // 80% heap usage
      const criticalThreshold = 95; // 95% heap usage

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
      
      if (heapUsagePercent >= criticalThreshold) {
        status = 'unhealthy';
      } else if (heapUsagePercent >= warningThreshold) {
        status = 'degraded';
      }

      return {
        name: 'memory_usage',
        status,
        duration: Date.now() - startTime,
        metadata: {
          heap_used_mb: heapUsedMB,
          heap_total_mb: heapTotalMB,
          heap_usage_percent: heapUsagePercent,
          rss_mb: Math.round(memUsage.rss / 1024 / 1024),
          external_mb: Math.round(memUsage.external / 1024 / 1024),
        }
      };
    } catch (error) {
      return {
        name: 'memory_usage',
        status: 'unhealthy',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkNodeVersion(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
      
      // Check if Node.js version meets requirements
      const minVersion = 22;
      const status = majorVersion >= minVersion ? 'healthy' : 'unhealthy';
      
      return {
        name: 'node_version',
        status,
        duration: Date.now() - startTime,
        metadata: {
          version: nodeVersion,
          major_version: majorVersion,
          min_required: minVersion,
          platform: process.platform,
          arch: process.arch,
        }
      };
    } catch (error) {
      return {
        name: 'node_version',
        status: 'unhealthy',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async checkGCSConnection(): Promise<HealthCheck> {
    const startTime = Date.now();
    const bucketName = process.env.GCS_ASSETS_BUCKET || process.env.GCS_BUCKET_NAME;

    try {
      if (!this.storage) {
        throw new Error('GCS client not initialized');
      }

      if (!bucketName) {
        throw new Error('GCS bucket name not configured');
      }

      // Test bucket access with timeout
      const bucket = this.storage.bucket(bucketName);
      const [exists] = await Promise.race([
        bucket.exists(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('GCS connection timeout')), 5000)
        )
      ]);

      if (!exists) {
        throw new Error(`Bucket ${bucketName} does not exist or is not accessible`);
      }

      return {
        name: 'gcs_connection',
        status: 'healthy',
        duration: Date.now() - startTime,
        metadata: {
          bucket_name: bucketName,
          project_id: process.env.GCS_PROJECT_ID,
        }
      };
    } catch (error) {
      logger.warn('GCS health check failed', {
        error: error instanceof Error ? error.message : String(error),
        bucketName
      });

      return {
        name: 'gcs_connection',
        status: 'unhealthy',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          bucket_name: bucketName,
          project_id: process.env.GCS_PROJECT_ID,
        }
      };
    }
  }

  private async checkBigQueryConnection(): Promise<HealthCheck> {
    const startTime = Date.now();
    const projectId = process.env.GCS_PROJECT_ID || process.env.BIGQUERY_PROJECT_ID;
    const dataset = process.env.BIGQUERY_DATASET || 'agenticapi';

    try {
      if (!this.bigquery) {
        throw new Error('BigQuery client not initialized');
      }

      if (!projectId) {
        throw new Error('BigQuery project ID not configured');
      }

      // Test dataset access with timeout
      const [datasets] = await Promise.race([
        this.bigquery.getDatasets(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('BigQuery connection timeout')), 10000)
        )
      ]);

      const datasetExists = datasets.some(ds => ds.id === dataset);

      return {
        name: 'bigquery_connection',
        status: datasetExists ? 'healthy' : 'degraded',
        duration: Date.now() - startTime,
        metadata: {
          project_id: projectId,
          dataset,
          dataset_exists: datasetExists,
          available_datasets: datasets.length,
        }
      };
    } catch (error) {
      logger.warn('BigQuery health check failed', {
        error: error instanceof Error ? error.message : String(error),
        projectId,
        dataset
      });

      return {
        name: 'bigquery_connection',
        status: 'unhealthy',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
        metadata: {
          project_id: projectId,
          dataset,
        }
      };
    }
  }

  private checkCircuitBreakers(): HealthCheck {
    const startTime = Date.now();

    try {
      const states = {
        gcs: circuitBreakers.gcs.getState(),
        bigquery: circuitBreakers.bigquery.getState(),
        auth: circuitBreakers.auth.getState(),
      };

      const openBreakers = Object.entries(states)
        .filter(([_, state]) => state.state === 'open')
        .map(([name]) => name);

      const halfOpenBreakers = Object.entries(states)
        .filter(([_, state]) => state.state === 'half-open')
        .map(([name]) => name);

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

      if (openBreakers.length > 0) {
        status = 'unhealthy';
      } else if (halfOpenBreakers.length > 0) {
        status = 'degraded';
      }

      return {
        name: 'circuit_breakers',
        status,
        duration: Date.now() - startTime,
        metadata: {
          states,
          open_breakers: openBreakers,
          half_open_breakers: halfOpenBreakers,
        }
      };
    } catch (error) {
      return {
        name: 'circuit_breakers',
        status: 'unhealthy',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private checkEnvironmentVariables(): HealthCheck {
    const startTime = Date.now();

    try {
      const requiredVars = ['NODE_ENV'];
      const recommendedVars = [
        'SCOPE3_API_KEY',
        'GCS_PROJECT_ID',
        'GOOGLE_APPLICATION_CREDENTIALS',
      ];

      const optionalVars = [
        'POSTHOG_API_KEY',
        'LOG_LEVEL',
        'GCS_ASSETS_BUCKET',
        'BIGQUERY_DATASET',
      ];

      const missing = requiredVars.filter(varName => !process.env[varName]);
      const missingRecommended = recommendedVars.filter(varName => !process.env[varName]);
      const presentOptional = optionalVars.filter(varName => !!process.env[varName]);

      let status: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';

      if (missing.length > 0) {
        status = 'unhealthy';
      } else if (missingRecommended.length > 0) {
        status = 'degraded';
      }

      return {
        name: 'environment_variables',
        status,
        duration: Date.now() - startTime,
        metadata: {
          missing_required: missing,
          missing_recommended: missingRecommended,
          present_optional: presentOptional,
          node_env: process.env.NODE_ENV,
        }
      };
    } catch (error) {
      return {
        name: 'environment_variables',
        status: 'unhealthy',
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private calculateSummary(checks: HealthCheck[]) {
    return checks.reduce(
      (summary, check) => {
        summary.total++;
        summary[check.status]++;
        return summary;
      },
      { total: 0, healthy: 0, unhealthy: 0, degraded: 0 }
    );
  }

  private determineOverallStatus(summary: { healthy: number; unhealthy: number; degraded: number }): 'healthy' | 'unhealthy' | 'degraded' {
    if (summary.unhealthy > 0) {
      return 'unhealthy';
    }
    if (summary.degraded > 0) {
      return 'degraded';
    }
    return 'healthy';
  }
}

// Graceful shutdown handler
export class GracefulShutdownHandler {
  private isShuttingDown = false;
  private shutdownCallbacks: Array<() => Promise<void>> = [];

  constructor() {
    // Register shutdown signals
    process.on('SIGTERM', () => this.handleShutdown('SIGTERM'));
    process.on('SIGINT', () => this.handleShutdown('SIGINT'));
    process.on('SIGUSR2', () => this.handleShutdown('SIGUSR2')); // Nodemon restart
    
    // Handle uncaught exceptions and unhandled rejections
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', error);
      this.handleShutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: String(promise)
      });
      this.handleShutdown('unhandledRejection');
    });
  }

  registerShutdownCallback(callback: () => Promise<void>): void {
    this.shutdownCallbacks.push(callback);
  }

  private async handleShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, forcing exit');
      process.exit(1);
    }

    this.isShuttingDown = true;
    
    logger.info('Graceful shutdown initiated', { signal });

    try {
      // Execute shutdown callbacks in parallel with timeout
      const shutdownPromises = this.shutdownCallbacks.map(async (callback, index) => {
        try {
          await callback();
          logger.debug(`Shutdown callback ${index} completed successfully`);
        } catch (error) {
          logger.error(`Shutdown callback ${index} failed`, {
            error: error instanceof Error ? error.message : String(error)
          });
        }
      });

      // Wait for all callbacks to complete or timeout after 30 seconds
      await Promise.race([
        Promise.all(shutdownPromises),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Shutdown timeout')), 30000)
        )
      ]);

      // Cleanup monitoring services
      await analytics.shutdown();
      
      logger.info('Graceful shutdown completed successfully');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', {
        error: error instanceof Error ? error.message : String(error)
      });
      process.exit(1);
    }
  }

  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
}

// Singleton instances
export const healthCheckService = new HealthCheckService();
export const gracefulShutdown = new GracefulShutdownHandler();