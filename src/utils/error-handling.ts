export enum ErrorCode {
  AGENTS_FETCH_FAILED = "AGENTS_FETCH_FAILED",
  AUTHENTICATION_FAILED = "AUTHENTICATION_FAILED",
  CAMPAIGN_CREATION_FAILED = "CAMPAIGN_CREATION_FAILED",
  CAMPAIGN_UPDATE_FAILED = "CAMPAIGN_UPDATE_FAILED",
  INVALID_REQUEST = "INVALID_REQUEST",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

interface ErrorDetails {
  code: ErrorCode;
  message: string;
  userMessage: string;
}

export function categorizeError(error: unknown): ErrorDetails {
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
      };
    } else if (
      message.includes("temporarily unavailable") ||
      message.includes("service unavailable") ||
      message.includes("timeout") ||
      message.includes("network")
    ) {
      return {
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: error.message,
        userMessage: "Service temporarily unavailable - please try again later",
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
      };
    }

    // Return a more detailed error for development
    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: error.message,
      userMessage: `Unexpected error: ${error.message}`,
    };
  }

  // Handle non-Error objects
  const errorString = typeof error === "string" ? error : String(error);
  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: errorString,
    userMessage: "An unexpected error occurred",
  };
}

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
  details?: unknown;
  error?: string;
  message: string;
  success: boolean;
}): string {
  const responseData: Record<string, unknown> = {
    message: data.message,
    success: data.success,
  };

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
