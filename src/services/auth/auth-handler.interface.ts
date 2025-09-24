/**
 * Generic authentication configuration interface
 * Each handler will extend this with their specific configuration
 */
export interface AuthConfig {
  [key: string]: unknown;
  type: string; // e.g., 'oauth', 'bearer', 'yahoo_jwt'
}

/**
 * Base interface for authentication handlers
 * Each authentication mechanism (OAuth, Bearer, JWT, etc.) implements this interface
 */
export interface AuthHandler {
  /**
   * Clear any cached tokens for the given agent
   * @param agentId - Unique identifier for the agent
   */
  clearCache(agentId: string): void;

  /**
   * Get auth fields to spread into agent config for @adcp/client
   * @param token - The authentication token
   * @returns Object with auth fields to spread into agent config
   */
  getAgentAuthFields(token: AuthToken): Record<string, string>;

  /**
   * Get HTTP headers for authentication (optional, for debugging/testing)
   * @param token - The authentication token
   * @returns HTTP headers object
   */
  getAuthHeaders?(token: AuthToken): AuthHeaders;

  /**
   * Get an authentication token for the given configuration
   * @param agentId - Unique identifier for the agent
   * @param config - Authentication configuration specific to the handler
   * @returns Promise resolving to an authentication token
   */
  getToken(agentId: string, config: AuthConfig): Promise<AuthToken>;

  /**
   * Check if a token is still valid (not expired)
   * @param token - The token to validate
   * @returns True if token is still valid
   */
  isTokenValid(token: AuthToken): boolean;

  /**
   * Refresh an existing authentication token
   * @param agentId - Unique identifier for the agent
   * @param config - Authentication configuration specific to the handler
   * @returns Promise resolving to a refreshed authentication token
   */
  refreshToken(agentId: string, config: AuthConfig): Promise<AuthToken>;
}

/**
 * HTTP headers for authentication
 */
export interface AuthHeaders {
  [header: string]: string;
}

/**
 * Authentication token with metadata
 */
export interface AuthToken {
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  refreshToken?: string;
  token: string;
  type: "bearer" | "custom";
}
