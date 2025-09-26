import { analytics, metrics, logger } from '../services/monitoring-service.js';

// Enhanced error codes
export enum ErrorCode {
  AGENTS_FETCH_FAILED = "AGENTS_FETCH_FAILED",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  CAMPAIGN_CREATION_FAILED = "CAMPAIGN_CREATION_FAILED",
  CAMPAIGN_UPDATE_FAILED = "CAMPAIGN_UPDATE_FAILED",
  INVALID_REQUEST = "INVALID_REQUEST",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
  // New upload-specific error codes
  UPLOAD_FAILED = "UPLOAD_FAILED",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  GCS_ERROR = "GCS_ERROR",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  TIMEOUT = "TIMEOUT",
  RETRY_EXHAUSTED = "RETRY_EXHAUSTED",
  CIRCUIT_BREAKER_OPEN = "CIRCUIT_BREAKER_OPEN",
}

// Custom error types
export class UploadError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly retryable: boolean = false,
    public readonly statusCode: number = 500,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

export class GCSError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly retryable: boolean = true,
    public readonly statusCode: number = 503,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = 'GCSError';
  }
}

export class AuthenticationError extends Error {
  constructor(
    message: string = 'Authentication failed',
    public readonly code: ErrorCode = ErrorCode.AUTHENTICATION_FAILED,
    public readonly statusCode: number = 401
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: any,
    public readonly code: ErrorCode = ErrorCode.VALIDATION_FAILED,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfterMs: number,
    public readonly requestId: string,
    public readonly code: ErrorCode = ErrorCode.RATE_LIMIT_EXCEEDED,
    public readonly statusCode: number = 429
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

interface ErrorDetails {
  code: ErrorCode;
  message: string;
  userMessage: string;
  retryable?: boolean;
  statusCode?: number;
}

// Retry configuration
export interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: string[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: [
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EAI_AGAIN',
    'NETWORK_ERROR',
    'SERVICE_UNAVAILABLE',
    'INTERNAL_ERROR',
  ],
};

// Enhanced error categorization
export function categorizeError(error: unknown): ErrorDetails {
  if (error instanceof UploadError || error instanceof GCSError || 
      error instanceof AuthenticationError || error instanceof ValidationError ||
      error instanceof RateLimitError) {
    return {
      code: error.code,
      message: error.message,
      userMessage: error.message,
      retryable: 'retryable' in error ? error.retryable : false,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (
      message.includes("authentication failed") ||
      message.includes("invalid api key") ||
      message.includes("unauthorized") ||
      message.includes("forbidden")
    ) {
      return {
        code: ErrorCode.AUTHENTICATION_FAILED,
        message: error.message,
        userMessage: "Authentication failed - please check your API key",
        retryable: false,
        statusCode: 401,
      };
    } else if (
      message.includes("file too large") ||
      message.includes("size exceeds")
    ) {
      return {
        code: ErrorCode.FILE_TOO_LARGE,
        message: error.message,
        userMessage: "File size exceeds the maximum allowed limit",
        retryable: false,
        statusCode: 413,
      };
    } else if (
      message.includes("invalid file type") ||
      message.includes("unsupported format")
    ) {
      return {
        code: ErrorCode.INVALID_FILE_TYPE,
        message: error.message,
        userMessage: "File type is not supported",
        retryable: false,
        statusCode: 415,
      };
    } else if (
      message.includes("rate limit") ||
      message.includes("too many requests")
    ) {
      return {
        code: ErrorCode.RATE_LIMIT_EXCEEDED,
        message: error.message,
        userMessage: "Rate limit exceeded - please try again later",
        retryable: true,
        statusCode: 429,
      };
    } else if (
      message.includes("timeout") ||
      message.includes("timed out")
    ) {
      return {
        code: ErrorCode.TIMEOUT,
        message: error.message,
        userMessage: "Operation timed out - please try again",
        retryable: true,
        statusCode: 408,
      };
    } else if (
      message.includes("temporarily unavailable") ||
      message.includes("service unavailable") ||
      message.includes("network") ||
      message.includes("circuit breaker")
    ) {
      return {
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: error.message,
        userMessage: "Service temporarily unavailable - please try again later",
        retryable: true,
        statusCode: 503,
      };
    } else if (
      message.includes("invalid request") ||
      message.includes("bad request") ||
      message.includes("validation") ||
      message.includes("parameters")
    ) {
      return {
        code: ErrorCode.INVALID_REQUEST,
        message: error.message,
        userMessage: "Invalid request - please check your parameters",
        retryable: false,
        statusCode: 400,
      };
    }

    // Return a more detailed error for development
    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: error.message,
      userMessage: `Unexpected error: ${error.message}`,
      retryable: false,
      statusCode: 500,
    };
  }

  // Handle non-Error objects
  const errorString = typeof error === "string" ? error : String(error);
  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: errorString,
    userMessage: "An unexpected error occurred",
    retryable: false,
    statusCode: 500,
  };
}

// Retry with exponential backoff
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  context: {
    requestId: string;
    customerId?: string;
    operationName: string;
  }
): Promise<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error;
  let attempt = 0;

  logger.debug('Starting retry operation', {
    ...context,
    maxAttempts: finalConfig.maxAttempts,
    baseDelayMs: finalConfig.baseDelayMs
  });

  while (attempt < finalConfig.maxAttempts) {
    attempt++;
    const startTime = Date.now();

    try {
      const result = await operation();
      
      if (attempt > 1) {
        // Log successful retry
        logger.info('Operation succeeded after retry', {
          ...context,
          attempt,
          totalAttempts: finalConfig.maxAttempts,
          duration: Date.now() - startTime
        });

        metrics.toolCalls.inc({
          tool_name: `${context.operationName}_retry_success`,
          status: 'success'
        });

        if (context.customerId) {
          analytics.trackFeatureUsage(context.customerId, 'retry_success', {
            operation_name: context.operationName,
            attempt,
            total_attempts: finalConfig.maxAttempts
          });
        }
      }

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;

      // Check if error is retryable
      const isRetryable = isErrorRetryable(lastError, finalConfig.retryableErrors);
      const isLastAttempt = attempt >= finalConfig.maxAttempts;

      logger.warn('Operation attempt failed', {
        ...context,
        attempt,
        totalAttempts: finalConfig.maxAttempts,
        error: lastError.message,
        errorName: lastError.name,
        isRetryable,
        isLastAttempt,
        duration
      });

      metrics.toolCalls.inc({
        tool_name: `${context.operationName}_attempt`,
        status: isLastAttempt ? 'final_failure' : 'retry'
      });

      // Don't retry if error is not retryable or we've exhausted attempts
      if (!isRetryable || isLastAttempt) {
        break;
      }

      // Calculate delay for next attempt
      const delay = Math.min(
        finalConfig.baseDelayMs * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
        finalConfig.maxDelayMs
      );

      logger.debug('Retrying after delay', {
        ...context,
        attempt,
        delayMs: delay,
        nextAttempt: attempt + 1
      });

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All attempts failed
  logger.error('Operation failed after all retry attempts', {
    ...context,
    totalAttempts: finalConfig.maxAttempts,
    finalError: lastError.message,
    errorName: lastError.name
  });

  metrics.errors.inc({
    error_type: 'retry_exhausted',
    context: context.operationName
  });

  if (context.customerId) {
    analytics.trackError({
      customerId: context.customerId,
      error: lastError,
      context: `${context.operationName}_retry_exhausted`,
      requestId: context.requestId,
      metadata: {
        total_attempts: finalConfig.maxAttempts,
        operation_name: context.operationName
      }
    });
  }

  throw new UploadError(
    `Operation failed after ${finalConfig.maxAttempts} attempts: ${lastError.message}`,
    ErrorCode.RETRY_EXHAUSTED,
    false,
    500,
    lastError
  );
}

// Check if an error is retryable
function isErrorRetryable(error: Error, retryableErrors: string[]): boolean {
  // Check by error code/message
  const errorCode = (error as any).code || '';
  const errorMessage = error.message.toLowerCase();
  
  return (
    retryableErrors.some(code => 
      errorCode === code || 
      errorMessage.includes(code.toLowerCase())
    ) ||
    // Additional checks for common retryable patterns
    errorMessage.includes('timeout') ||
    errorMessage.includes('network') ||
    errorMessage.includes('connection') ||
    errorMessage.includes('service unavailable') ||
    errorMessage.includes('internal server error') ||
    errorMessage.includes('temporarily unavailable')
  );
}

// Circuit breaker implementation
export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly timeoutMs: number = 60000, // 1 minute
    private readonly context: string = 'circuit_breaker'
  ) {}

  async execute<T>(
    operation: () => Promise<T>,
    requestId: string,
    customerId?: string
  ): Promise<T> {
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      
      if (timeSinceLastFailure < this.timeoutMs) {
        metrics.errors.inc({ error_type: 'circuit_breaker_open', context: this.context });
        
        logger.warn('Circuit breaker is open', {
          context: this.context,
          requestId,
          customerId,
          failures: this.failures,
          timeSinceLastFailure
        });

        throw new UploadError(
          'Service temporarily unavailable due to repeated failures',
          ErrorCode.CIRCUIT_BREAKER_OPEN,
          true,
          503
        );
      } else {
        // Try to transition to half-open
        this.state = 'half-open';
        logger.info('Circuit breaker transitioning to half-open', {
          context: this.context,
          requestId,
          customerId
        });
      }
    }

    try {
      const result = await operation();
      
      // Success - reset circuit breaker
      if (this.state === 'half-open' || this.failures > 0) {
        logger.info('Circuit breaker reset after successful operation', {
          context: this.context,
          requestId,
          customerId,
          previousFailures: this.failures
        });
      }
      
      this.failures = 0;
      this.state = 'closed';
      
      return result;
    } catch (error) {
      this.failures++;
      this.lastFailureTime = Date.now();

      logger.warn('Circuit breaker recorded failure', {
        context: this.context,
        requestId,
        customerId,
        failures: this.failures,
        threshold: this.failureThreshold,
        error: error instanceof Error ? error.message : String(error)
      });

      if (this.failures >= this.failureThreshold) {
        this.state = 'open';
        
        logger.error('Circuit breaker opened due to repeated failures', {
          context: this.context,
          requestId,
          customerId,
          failures: this.failures,
          threshold: this.failureThreshold
        });

        metrics.errors.inc({ error_type: 'circuit_breaker_opened', context: this.context });

        if (customerId) {
          analytics.trackError({
            customerId,
            error: error instanceof Error ? error : new Error(String(error)),
            context: `${this.context}_circuit_breaker_opened`,
            requestId,
            metadata: {
              failures: this.failures,
              threshold: this.failureThreshold
            }
          });
        }
      }

      throw error;
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }

  reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
    
    logger.info('Circuit breaker manually reset', {
      context: this.context
    });
  }
}

// Global circuit breakers for different services
export const circuitBreakers = {
  gcs: new CircuitBreaker(5, 60000, 'gcs_operations'),
  bigquery: new CircuitBreaker(3, 30000, 'bigquery_operations'),
  auth: new CircuitBreaker(10, 120000, 'auth_operations'),
};

// Timeout wrapper
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  context: {
    requestId: string;
    customerId?: string;
    operationName: string;
  }
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      const error = new UploadError(
        `Operation timed out after ${timeoutMs}ms`,
        ErrorCode.TIMEOUT,
        true,
        408
      );
      
      logger.warn('Operation timed out', {
        ...context,
        timeoutMs
      });

      metrics.errors.inc({ error_type: 'timeout', context: context.operationName });

      if (context.customerId) {
        analytics.trackError({
          customerId: context.customerId,
          error,
          context: `${context.operationName}_timeout`,
          requestId: context.requestId,
          metadata: { timeout_ms: timeoutMs }
        });
      }

      reject(error);
    }, timeoutMs);
  });

  return Promise.race([operation(), timeoutPromise]);
}

// Legacy compatibility functions
export function createAuthErrorResponse(): string {
  return createMCPResponse({
    code: ErrorCode.AUTHENTICATION_FAILED,
    error: "No API key provided",
    message:
      "Authentication required. Please set the SCOPE3_API_KEY environment variable or provide via headers.",
    success: false,
  });
}

export function createErrorResponse(
  defaultMessage: string,
  error: unknown,
): string {
  const errorDetails = categorizeError(error);

  return createMCPResponse({
    code: errorDetails.code,
    details: error,
    error: errorDetails.code,
    message: `${defaultMessage}: ${errorDetails.userMessage}`,
    success: false,
  });
}

export function createMCPResponse(data: {
  code?: ErrorCode;
  data?: unknown; // Structured data for API consumers
  details?: unknown;
  error?: string;
  message: string;
  success: boolean;
}): string {
  const responseData: Record<string, unknown> = {
    message: data.message,
    success: data.success,
  };

  // Include structured data for API consumers
  if (data.data !== undefined) {
    responseData.data = data.data;
  }

  if (data.error) {
    responseData.error = data.error;
  }

  if (data.code) {
    responseData.errorCode = data.code;
  }

  // Always include details for debugging, but sanitize in production
  if (data.details !== undefined) {
    if (
      process.env.NODE_ENV === "development" ||
      process.env.NODE_ENV === "test"
    ) {
      responseData.details = data.details;
    } else {
      // In production, only include basic error info
      responseData.details =
        data.details instanceof Error ? { message: data.details.message } : {};
    }
  }

  return JSON.stringify(responseData);
}

// Error serialization for enhanced responses
export function serializeError(error: unknown): {
  success: false;
  error: {
    message: string;
    code: ErrorCode;
    retryable: boolean;
    statusCode: number;
  };
} {
  const errorDetails = categorizeError(error);
  
  return {
    success: false,
    error: {
      message: errorDetails.userMessage,
      code: errorDetails.code,
      retryable: errorDetails.retryable || false,
      statusCode: errorDetails.statusCode || 500,
    },
  };
}