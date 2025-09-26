import { PostHog } from "posthog-node";
import { Counter, Gauge, Histogram, register } from "prom-client";
import { v4 as uuidv4 } from "uuid";
import winston from "winston";

// PostHog Analytics Service
export class AnalyticsService {
  private isEnabled: boolean;
  private posthog: null | PostHog = null;

  constructor() {
    const posthogApiKey = process.env.POSTHOG_API_KEY;
    const posthogHost = process.env.POSTHOG_HOST || "https://app.posthog.com";

    this.isEnabled = !!posthogApiKey;

    if (this.isEnabled) {
      this.posthog = new PostHog(posthogApiKey!, {
        // Disable in development to avoid noise
        disabled: process.env.NODE_ENV !== "production",
        host: posthogHost,
      });
    }
  }

  async shutdown() {
    if (this.posthog) {
      await this.posthog.shutdown();
    }
  }

  // Track asset upload events
  trackAssetUpload(data: {
    assetType: string;
    buyerAgentId?: string;
    customerId: string;
    duration: number;
    fileSize: number;
    requestId: string;
    success: boolean;
  }) {
    if (!this.isEnabled || !this.posthog) return;

    this.posthog.capture({
      distinctId: data.customerId,
      event: "asset_upload",
      properties: {
        asset_type: data.assetType,
        buyer_agent_id: data.buyerAgentId,
        duration_ms: data.duration,
        file_size_bytes: data.fileSize,
        file_size_mb: Math.round((data.fileSize / (1024 * 1024)) * 100) / 100,
        request_id: data.requestId,
        success: data.success,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Track errors for debugging
  trackError(data: {
    context: string;
    customerId?: string;
    error: Error;
    metadata?: Record<string, unknown>;
    requestId: string;
  }) {
    if (!this.isEnabled || !this.posthog) return;

    this.posthog.capture({
      distinctId: data.customerId || "anonymous",
      event: "error_occurred",
      properties: {
        context: data.context,
        error_message: data.error.message,
        error_name: data.error.name,
        error_stack: data.error.stack?.substring(0, 1000), // Truncate stack trace
        request_id: data.requestId,
        ...data.metadata,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Track user feature usage
  trackFeatureUsage(
    customerId: string,
    feature: string,
    properties?: Record<string, unknown>,
  ) {
    if (!this.isEnabled || !this.posthog) return;

    this.posthog.capture({
      distinctId: customerId,
      event: "feature_usage",
      properties: {
        feature_name: feature,
        ...properties,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Track MCP tool usage
  trackToolUsage(data: {
    customerId: string;
    duration: number;
    errorType?: string;
    requestId: string;
    success: boolean;
    toolName: string;
  }) {
    if (!this.isEnabled || !this.posthog) return;

    this.posthog.capture({
      distinctId: data.customerId,
      event: "mcp_tool_usage",
      properties: {
        duration_ms: data.duration,
        error_type: data.errorType,
        request_id: data.requestId,
        success: data.success,
        timestamp: new Date().toISOString(),
        tool_name: data.toolName,
      },
    });
  }
}

// Structured Logging Service
export class LoggingService {
  private logger: winston.Logger;
  private readonly serviceName: string;

  constructor(serviceName = "scope3-campaign-api") {
    this.serviceName = serviceName;

    const isProduction = process.env.NODE_ENV === "production";
    const logLevel = process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

    this.logger = winston.createLogger({
      defaultMeta: {
        environment: process.env.NODE_ENV || "development",
        service: this.serviceName,
        version: process.env.npm_package_version || "1.0.0",
      },
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        isProduction
          ? winston.format.json()
          : winston.format.combine(
              winston.format.colorize(),
              winston.format.simple(),
            ),
      ),
      level: logLevel,
      transports: [
        new winston.transports.Console(),
        ...(isProduction
          ? [
              new winston.transports.File({
                filename: "logs/error.log",
                level: "error",
                maxFiles: 5,
                maxsize: 5242880, // 5MB
              }),
              new winston.transports.File({
                filename: "logs/combined.log",
                maxFiles: 5,
                maxsize: 5242880, // 5MB
              }),
            ]
          : []),
      ],
    });
  }

  // Create child logger with additional context
  child(context: Record<string, unknown>): LoggingService {
    const childLogger = new LoggingService(this.serviceName);
    childLogger.logger = this.logger.child(context);
    return childLogger;
  }

  debug(message: string, meta?: Record<string, unknown>) {
    this.logger.debug(message, meta);
  }

  error(message: string, error?: Error, meta?: Record<string, unknown>) {
    this.logger.error(message, {
      error: error
        ? {
            message: error.message,
            name: error.name,
            stack: error.stack,
          }
        : undefined,
      ...meta,
    });
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.logger.info(message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>) {
    this.logger.warn(message, meta);
  }
}

// Prometheus Metrics Service
export class MetricsService {
  // Gauges
  public readonly activeConnections = new Gauge({
    help: "Number of active connections",
    name: "active_connections",
  });

  public readonly cacheSize = new Gauge({
    help: "Number of items in cache",
    labelNames: ["cache_type"] as const,
    name: "cache_size_items",
  });

  public readonly errors = new Counter({
    help: "Total number of errors",
    labelNames: ["error_type", "context"] as const,
    name: "errors_total",
  });

  public readonly httpDuration = new Histogram({
    buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
    help: "HTTP request duration in seconds",
    labelNames: ["method", "endpoint"] as const,
    name: "http_request_duration_seconds",
  });

  public readonly httpRequests = new Counter({
    help: "Total number of HTTP requests",
    labelNames: ["method", "status_code", "endpoint"] as const,
    name: "http_requests_total",
  });

  public readonly memoryUsage = new Gauge({
    help: "Process memory usage in bytes",
    labelNames: ["type"] as const,
    name: "memory_usage_bytes",
  });

  public readonly toolCalls = new Counter({
    help: "Total number of MCP tool calls",
    labelNames: ["tool_name", "status"] as const,
    name: "mcp_tool_calls_total",
  });

  public readonly toolDuration = new Histogram({
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5], // Buckets for tool execution
    help: "MCP tool execution duration in seconds",
    labelNames: ["tool_name"] as const,
    name: "mcp_tool_duration_seconds",
  });

  // Counters
  public readonly uploadAttempts = new Counter({
    help: "Total number of asset upload attempts",
    labelNames: ["customer_id", "asset_type", "status"] as const,
    name: "asset_uploads_total",
  });

  // Histograms
  public readonly uploadDuration = new Histogram({
    buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60], // Buckets for upload times
    help: "Asset upload duration in seconds",
    labelNames: ["asset_type"] as const,
    name: "asset_upload_duration_seconds",
  });

  constructor() {
    // Start memory monitoring
    this.startMemoryMonitoring();
  }

  // Get metrics for health check
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  private startMemoryMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.memoryUsage.set({ type: "rss" }, memUsage.rss);
      this.memoryUsage.set({ type: "heap_used" }, memUsage.heapUsed);
      this.memoryUsage.set({ type: "heap_total" }, memUsage.heapTotal);
      this.memoryUsage.set({ type: "external" }, memUsage.external);
    }, 10000); // Update every 10 seconds
  }
}

export class RequestContext {
  public readonly requestId: string;
  public readonly startTime: number;
  get customerId(): string | undefined {
    return typeof this.metadata.customerId === "string"
      ? this.metadata.customerId
      : undefined;
  }

  private metadata: Record<string, unknown> = {};

  constructor(requestId: string, customerId?: string) {
    this.requestId = requestId;
    this.startTime = Date.now();
    if (customerId) {
      this.metadata.customerId = customerId;
    }
  }

  cleanup(): void {
    RequestContextService.cleanup(this.requestId);
  }

  getDuration(): number {
    return Date.now() - this.startTime;
  }

  getMetadata(): Record<string, unknown> {
    return { ...this.metadata };
  }

  setMetadata(key: string, value: unknown): void {
    this.metadata[key] = value;
  }
}

// Request Context Service
export class RequestContextService {
  private static readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private static contexts = new Map<string, RequestContext>();
  private static lastCleanup = 0;
  private static readonly MAX_CONTEXTS = 10000;

  static cleanup(requestId: string): void {
    this.contexts.delete(requestId);
  }

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
      logger.debug("Cleaned up expired request contexts", {
        cleanedCount: expiredKeys.length,
        remainingCount: this.contexts.size,
      });
    }
  }

  private static forceCleanup(): void {
    // Remove oldest 25% of contexts
    const sortedEntries = Array.from(this.contexts.entries()).sort(
      ([, a], [, b]) => a.startTime - b.startTime,
    );

    const removeCount = Math.floor(this.contexts.size * 0.25);

    for (let i = 0; i < removeCount; i++) {
      this.contexts.delete(sortedEntries[i][0]);
    }

    logger.warn("Forced cleanup of request contexts", {
      remainingCount: this.contexts.size,
      removedCount: removeCount,
    });
  }
}

// Singleton instances
export const analytics = new AnalyticsService();
export const metrics = new MetricsService();
export const logger = new LoggingService();
