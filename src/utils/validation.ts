/**
 * Validates if a string is a valid API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  // Scope3 API keys typically start with "scope3_" and contain base64-like characters
  return key.startsWith("scope3_") && key.length > 20;
}

/**
 * Validates strategy ID format
 */
export function isValidStrategyId(id: string): boolean {
  // Strategy IDs should be numeric strings or UUID format
  return (
    /^\d+$/.test(id) ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  );
}

/**
 * Sanitizes error messages for client responses
 */
export function sanitizeErrorMessage(
  error: unknown,
  defaultMessage: string,
): string {
  if (error instanceof Error) {
    // Only expose safe, user-friendly error messages
    if (error.message.includes("Authentication failed")) {
      return "Authentication failed - please check your API key";
    } else if (error.message.includes("temporarily unavailable")) {
      return "Service temporarily unavailable - please try again later";
    } else if (error.message.includes("Invalid request")) {
      return "Invalid request - please check your parameters";
    }
  }

  return defaultMessage;
}
