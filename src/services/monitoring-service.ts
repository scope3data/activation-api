import { PostHog } from 'posthog-node';
import { register, Counter, Histogram, Gauge } from 'prom-client';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';

// PostHog Analytics Service
export class AnalyticsService {
  private posthog: PostHog | null = null;
  private isEnabled: boolean;

  constructor() {
    const posthogApiKey = process.env.POSTHOG_API_KEY;
    const posthogHost = process.env.POSTHOG_HOST || 'https://app.posthog.com';
    
    this.isEnabled = !!posthogApiKey;
    
    if (this.isEnabled) {
      this.posthog = new PostHog(posthogApiKey!, {
        host: posthogHost,
        // Disable in development to avoid noise
        disabled: process.env.NODE_ENV !== 'production'
      });
    }
  }

  // Track asset upload events
  trackAssetUpload(data: {
    customerId: string;
    buyerAgentId?: string;
    assetType: string;
    fileSize: number;
    success: boolean;
    duration: number;
    requestId: string;
  }) {
    if (!this.isEnabled || !this.posthog) return;

    this.posthog.capture({
      distinctId: data.customerId,
      event: 'asset_upload',
      properties: {
        buyer_agent_id: data.buyerAgentId,
        asset_type: data.assetType,
        file_size_bytes: data.fileSize,
        file_size_mb: Math.round(data.fileSize / (1024 * 1024) * 100) / 100,
        success: data.success,
        duration_ms: data.duration,
        request_id: data.requestId,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Track MCP tool usage
  trackToolUsage(data: {
    customerId: string;
    toolName: string;
    success: boolean;
    duration: number;
    requestId: string;
    errorType?: string;
  }) {
    if (!this.isEnabled || !this.posthog) return;

    this.posthog.capture({
      distinctId: data.customerId,
      event: 'mcp_tool_usage',
      properties: {
        tool_name: data.toolName,
        success: data.success,
        duration_ms: data.duration,
        request_id: data.requestId,
        error_type: data.errorType,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Track user feature usage
  trackFeatureUsage(customerId: string, feature: string, properties?: Record<string, any>) {
    if (!this.isEnabled || !this.posthog) return;

    this.posthog.capture({
      distinctId: customerId,
      event: 'feature_usage',
      properties: {
        feature_name: feature,
        ...properties,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Track errors for debugging
  trackError(data: {
    customerId?: string;
    error: Error;
    context: string;
    requestId: string;
    metadata?: Record<string, any>;
  }) {
    if (!this.isEnabled || !this.posthog) return;

    this.posthog.capture({
      distinctId: data.customerId || 'anonymous',
      event: 'error_occurred',
      properties: {
        error_name: data.error.name,
        error_message: data.error.message,
        error_stack: data.error.stack?.substring(0, 1000), // Truncate stack trace
        context: data.context,
        request_id: data.requestId,
        ...data.metadata,
        timestamp: new Date().toISOString()
      }
    });
  }

  async shutdown() {
    if (this.posthog) {
      await this.posthog.shutdown();
    }
  }
}

// Prometheus Metrics Service
export class MetricsService {
  // Counters
  public readonly uploadAttempts = new Counter({
    name: 'asset_uploads_total',
    help: 'Total number of asset upload attempts',
    labelNames: ['customer_id', 'asset_type', 'status'] as const
  });

  public readonly toolCalls = new Counter({
    name: 'mcp_tool_calls_total',
    help: 'Total number of MCP tool calls',
    labelNames: ['tool_name', 'status'] as const
  });

  public readonly errors = new Counter({
    name: 'errors_total',
    help: 'Total number of errors',
    labelNames: ['error_type', 'context'] as const
  });

  public readonly httpRequests = new Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'status_code', 'endpoint'] as const
  });

  // Histograms
  public readonly uploadDuration = new Histogram({
    name: 'asset_upload_duration_seconds',
    help: 'Asset upload duration in seconds',
    labelNames: ['asset_type'] as const,
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60] // Buckets for upload times
  });

  public readonly toolDuration = new Histogram({
    name: 'mcp_tool_duration_seconds',
    help: 'MCP tool execution duration in seconds',
    labelNames: ['tool_name'] as const,
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5] // Buckets for tool execution
  });

  public readonly httpDuration = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'HTTP request duration in seconds',
    labelNames: ['method', 'endpoint'] as const,
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  });

  // Gauges
  public readonly activeConnections = new Gauge({
    name: 'active_connections',
    help: 'Number of active connections'
  });

  public readonly memoryUsage = new Gauge({
    name: 'memory_usage_bytes',
    help: 'Process memory usage in bytes',
    labelNames: ['type'] as const
  });

  public readonly cacheSize = new Gauge({
    name: 'cache_size_items',
    help: 'Number of items in cache',
    labelNames: ['cache_type'] as const
  });

  constructor() {
    // Start memory monitoring
    this.startMemoryMonitoring();
  }

  private startMemoryMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.memoryUsage.set({ type: 'rss' }, memUsage.rss);
      this.memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
      this.memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
      this.memoryUsage.set({ type: 'external' }, memUsage.external);
    }, 10000); // Update every 10 seconds
  }

  // Get metrics for health check
  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}

// Structured Logging Service
export class LoggingService {
  private logger: winston.Logger;
  private readonly serviceName: string;

  constructor(serviceName = 'scope3-campaign-api') {
    this.serviceName = serviceName;
    
    const isProduction = process.env.NODE_ENV === 'production';
    const logLevel = process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug');

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        isProduction
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.simple()
            )
      ),
      defaultMeta: {
        service: this.serviceName,
        environment: process.env.NODE_ENV || 'development',
        version: process.env.npm_package_version || '1.0.0'
      },
      transports: [
        new winston.transports.Console(),
        ...(isProduction
          ? [
              new winston.transports.File({
                filename: 'logs/error.log',
                level: 'error',
                maxsize: 5242880, // 5MB
                maxFiles: 5
              }),
              new winston.transports.File({
                filename: 'logs/combined.log',
                maxsize: 5242880, // 5MB
                maxFiles: 5
              })
            ]
          : [])
      ]
    });
  }

  info(message: string, meta?: Record<string, any>) {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, any>) {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, any>) {
    this.logger.error(message, {
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined,
      ...meta
    });
  }

  debug(message: string, meta?: Record<string, any>) {
    this.logger.debug(message, meta);
  }

  // Create child logger with additional context
  child(context: Record<string, any>): LoggingService {
    const childLogger = new LoggingService(this.serviceName);
    childLogger.logger = this.logger.child(context);
    return childLogger;
  }
}

// Request Context Service
export class RequestContextService {
  private static contexts = new Map<string, RequestContext>();
  private static readonly MAX_CONTEXTS = 10000;
  private static readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static lastCleanup = 0;

  static create(customerId?: string): RequestContext {
    const requestId = uuidv4();
    const context = new RequestContext(requestId, customerId);
    
    // Periodic cleanup to prevent memory leaks
    this.cleanupExpiredContexts();
    
    // Force cleanup if we're approaching the limit
    if (this.contexts.size >= this.MAX_CONTEXTS) {
      this.forceCleanup();
    }
    
    this.contexts.set(requestId, context);
    return context;
  }

  static get(requestId: string): RequestContext | undefined {
    return this.contexts.get(requestId);
  }

  static cleanup(requestId: string): void {
    this.contexts.delete(requestId);
  }

  private static cleanupExpiredContexts(): void {
    const now = Date.now();
    if (now - this.lastCleanup < this.CLEANUP_INTERVAL) {
      return;
    }

    const expiredKeys: string[] = [];
    const maxAge = 30 * 60 * 1000; // 30 minutes

    for (const [requestId, context] of this.contexts.entries()) {
      if (now - context.startTime > maxAge) {
        expiredKeys.push(requestId);
      }
    }

    for (const key of expiredKeys) {
      this.contexts.delete(key);
    }

    this.lastCleanup = now;

    if (expiredKeys.length > 0) {
      logger.debug('Cleaned up expired request contexts', {
        cleanedCount: expiredKeys.length,
        remainingCount: this.contexts.size
      });
    }
  }

  private static forceCleanup(): void {
    // Remove oldest 25% of contexts
    const sortedEntries = Array.from(this.contexts.entries())
      .sort(([, a], [, b]) => a.startTime - b.startTime);
    
    const removeCount = Math.floor(this.contexts.size * 0.25);
    
    for (let i = 0; i < removeCount; i++) {
      this.contexts.delete(sortedEntries[i][0]);
    }

    logger.warn('Forced cleanup of request contexts', {
      removedCount: removeCount,
      remainingCount: this.contexts.size
    });
  }
}

export class RequestContext {
  public readonly requestId: string;
  public readonly startTime: number;
  private metadata: Record<string, any> = {};

  constructor(requestId: string, customerId?: string) {
    this.requestId = requestId;
    this.startTime = Date.now();
    if (customerId) {
      this.metadata.customerId = customerId;
    }
  }

  get customerId(): string | undefined {
    return this.metadata.customerId;
  }

  setMetadata(key: string, value: any): void {
    this.metadata[key] = value;
  }

  getMetadata(): Record<string, any> {
    return { ...this.metadata };
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }

  cleanup(): void {
    RequestContextService.cleanup(this.requestId);
  }
}

// Singleton instances
export const analytics = new AnalyticsService();
export const metrics = new MetricsService();
export const logger = new LoggingService();