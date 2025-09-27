import { analytics, logger, metrics } from "../services/monitoring-service.js";

export interface RateLimitConfig {
  maxRequests: number;
  skipFailedRequests?: boolean;
  skipSuccessfulRequests?: boolean;
  windowMs: number;
}

interface RateLimitEntry {
  count: number;
  lastRequest: number;
  windowStart: number;
}

export class RateLimiter {
  private cleanupInterval: NodeJS.Timeout;
  private limits = new Map<string, RateLimitEntry>();

  constructor(private readonly config: RateLimitConfig) {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  async checkLimit(
    key: string,
    requestId: string,
    success?: boolean,
  ): Promise<void> {
    const now = Date.now();
    const entry = this.limits.get(key) || {
      count: 0,
      lastRequest: now,
      windowStart: now,
    };

    // Check if we're in a new window
    if (now - entry.windowStart >= this.config.windowMs) {
      entry.count = 0;
      entry.windowStart = now;
    }

    // Check rate limit
    if (entry.count >= this.config.maxRequests) {
      const retryAfterMs = this.config.windowMs - (now - entry.windowStart);

      metrics.errors.inc({
        context: "rate_limiter",
        error_type: "rate_limit_exceeded",
      });

      logger.warn("Rate limit exceeded", {
        count: entry.count,
        key,
        maxRequests: this.config.maxRequests,
        requestId,
        retryAfterMs,
        windowMs: this.config.windowMs,
      });

      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${Math.ceil(retryAfterMs / 1000)} seconds.`,
        retryAfterMs,
        requestId,
      );
    }

    // Update counters based on configuration
    const shouldCount =
      success === undefined ||
      (!this.config.skipSuccessfulRequests && success) ||
      (!this.config.skipFailedRequests && !success);

    if (shouldCount) {
      entry.count++;
    }

    entry.lastRequest = now;
    this.limits.set(key, entry);

    metrics.toolCalls.inc({
      status: "request_allowed",
      tool_name: "rate_limiter",
    });

    logger.debug("Rate limit check passed", {
      count: entry.count,
      key,
      maxRequests: this.config.maxRequests,
      requestId,
      windowStart: entry.windowStart,
    });
  }

  getRemainingRequests(key: string): { remaining: number; resetTime: number } {
    const entry = this.limits.get(key);
    if (!entry) {
      return {
        remaining: this.config.maxRequests,
        resetTime: Date.now() + this.config.windowMs,
      };
    }

    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const resetTime = entry.windowStart + this.config.windowMs;

    return { remaining, resetTime };
  }

  async shutdown(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.limits.entries()) {
      // Remove entries that haven't been used in the last 2 window periods
      if (now - entry.lastRequest > this.config.windowMs * 2) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.limits.delete(key);
    }

    if (expiredKeys.length > 0) {
      logger.debug("Cleaned up expired rate limit entries", {
        cleanedCount: expiredKeys.length,
        remainingCount: this.limits.size,
      });
    }
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
    public readonly requestId: string,
  ) {
    super(message);
    this.name = "RateLimitError";
  }
}

// Global rate limiters for different operations
export const rateLimiters = {
  analytics: new RateLimiter({
    maxRequests: 20, // 20 analytics requests per 5 minutes per customer
    skipFailedRequests: true,
    skipSuccessfulRequests: false,
    windowMs: 5 * 60 * 1000, // 5 minutes
  }),

  list: new RateLimiter({
    maxRequests: 100, // 100 list requests per minute per customer
    skipFailedRequests: true,
    skipSuccessfulRequests: false,
    windowMs: 1 * 60 * 1000, // 1 minute
  }),

  upload: new RateLimiter({
    maxRequests: 50, // 50 uploads per 15 minutes per customer
    skipFailedRequests: true,
    skipSuccessfulRequests: false,
    windowMs: 15 * 60 * 1000, // 15 minutes
  }),
};

// Rate limiting middleware factory
export function createRateLimitMiddleware(
  limiter: RateLimiter,
  operation: string,
) {
  return async (
    customerId: string,
    requestId: string,
    success?: boolean,
  ): Promise<void> => {
    const key = `${operation}:${customerId}`;

    try {
      await limiter.checkLimit(key, requestId, success);

      // Track rate limit stats
      const stats = limiter.getRemainingRequests(key);

      if (customerId) {
        analytics.trackFeatureUsage(customerId, "rate_limit_check", {
          operation,
          remaining_requests: stats.remaining,
          reset_time: new Date(stats.resetTime).toISOString(),
        });
      }
    } catch (error) {
      // Track rate limit violation
      if (customerId && error instanceof RateLimitError) {
        analytics.trackError({
          context: `rate_limit_${operation}`,
          customerId,
          error,
          metadata: {
            operation,
            retry_after_ms: error.retryAfterMs,
          },
          requestId,
        });
      }
      throw error;
    }
  };
}

// Pre-configured rate limit middleware
export const checkUploadRateLimit = createRateLimitMiddleware(
  rateLimiters.upload,
  "upload",
);

export const checkListRateLimit = createRateLimitMiddleware(
  rateLimiters.list,
  "list",
);

export const checkAnalyticsRateLimit = createRateLimitMiddleware(
  rateLimiters.analytics,
  "analytics",
);

// Graceful shutdown for all rate limiters
export async function shutdownRateLimiters(): Promise<void> {
  await Promise.all([
    rateLimiters.upload.shutdown(),
    rateLimiters.list.shutdown(),
    rateLimiters.analytics.shutdown(),
  ]);

  logger.info("Rate limiters shut down gracefully");
}
