import type {
  AuthHandler,
  AuthHeaders,
  AuthToken,
} from "./auth-handler.interface.js";
import type { BearerConfig, CustomHeaderConfig, OAuthConfig } from "./types.js";

/**
 * Bearer token authentication handler
 * Returns static bearer tokens for API calls
 */
export class BearerAuthHandler implements AuthHandler {
  private cache = new Map<string, AuthToken>();

  clearCache(agentId: string): void {
    this.cache.delete(agentId);
  }

  /**
   * Get auth fields to spread into agent config for @adcp/client
   */
  getAgentAuthFields(token: AuthToken): Record<string, string> {
    return {
      authorization: `Bearer ${token.token}`,
    };
  }

  getAuthHeaders(token: AuthToken): AuthHeaders {
    return {
      Authorization: `Bearer ${token.token}`,
    };
  }

  async getToken(agentId: string, config: BearerConfig): Promise<AuthToken> {
    // Bearer tokens are static, so we can cache indefinitely
    const cached = this.cache.get(agentId);
    if (cached) return cached;

    const token: AuthToken = {
      // No expiry for static bearer tokens
      metadata: {
        auth_type: "bearer",
      },
      token: config.token,
      type: "bearer",
    };

    this.cache.set(agentId, token);
    return token;
  }

  isTokenValid(token: AuthToken): boolean {
    // Bearer tokens don't expire
    return Boolean(token.token);
  }

  async refreshToken(
    agentId: string,
    config: BearerConfig,
  ): Promise<AuthToken> {
    // Bearer tokens don't need refresh, just return the current token
    return this.getToken(agentId, config);
  }
}

/**
 * Custom header authentication handler
 * Supports any custom header name/value pair
 */
export class CustomHeaderAuthHandler implements AuthHandler {
  private cache = new Map<string, AuthToken>();

  clearCache(agentId: string): void {
    this.cache.delete(agentId);
  }

  /**
   * Get auth fields to spread into agent config for @adcp/client
   */
  getAgentAuthFields(token: AuthToken): Record<string, string> {
    const headerName = token.metadata?.header_name as string;
    if (!headerName) {
      throw new Error("Missing header_name in token metadata");
    }

    return {
      [headerName.toLowerCase()]: token.token,
    };
  }

  getAuthHeaders(token: AuthToken): AuthHeaders {
    const headerName = token.metadata?.header_name as string;
    if (!headerName) {
      throw new Error("Missing header_name in token metadata");
    }

    return {
      [headerName]: token.token,
    };
  }

  async getToken(
    agentId: string,
    config: CustomHeaderConfig,
  ): Promise<AuthToken> {
    // Custom headers are static, cache indefinitely
    const cached = this.cache.get(agentId);
    if (cached) return cached;

    const token: AuthToken = {
      metadata: {
        auth_type: "custom_header",
        header_name: config.headerName,
      },
      token: config.headerValue,
      type: "custom",
    };

    this.cache.set(agentId, token);
    return token;
  }

  isTokenValid(token: AuthToken): boolean {
    // Custom headers don't expire
    return Boolean(token.token);
  }

  async refreshToken(
    agentId: string,
    config: CustomHeaderConfig,
  ): Promise<AuthToken> {
    // Custom headers don't need refresh
    return this.getToken(agentId, config);
  }
}

/**
 * OAuth authentication handler (basic implementation)
 * Handles OAuth refresh token flow
 */
export class OAuthHandler implements AuthHandler {
  private cache = new Map<string, AuthToken>();

  clearCache(agentId: string): void {
    this.cache.delete(agentId);
  }

  /**
   * Get auth fields to spread into agent config for @adcp/client
   */
  getAgentAuthFields(token: AuthToken): Record<string, string> {
    const tokenType = (token.metadata?.token_type as string) || "Bearer";
    return {
      authorization: `${tokenType} ${token.token}`,
    };
  }

  getAuthHeaders(token: AuthToken): AuthHeaders {
    const tokenType = (token.metadata?.token_type as string) || "Bearer";
    return {
      Authorization: `${tokenType} ${token.token}`,
    };
  }

  async getToken(agentId: string, config: OAuthConfig): Promise<AuthToken> {
    // Check cache first
    const cached = this.cache.get(agentId);
    if (cached && this.isTokenValid(cached)) {
      return cached;
    }

    // Refresh or get new token
    return this.refreshToken(agentId, config);
  }

  isTokenValid(token: AuthToken): boolean {
    if (!token.expiresAt) return false;

    // Refresh 5 minutes before actual expiry to prevent mid-request expiry
    // Example: 1-hour token is cached for 55m, then refreshed proactively
    const bufferMs = 5 * 60 * 1000;
    return Date.now() < token.expiresAt.getTime() - bufferMs;
  }

  async refreshToken(agentId: string, config: OAuthConfig): Promise<AuthToken> {
    // Clear cached token
    this.clearCache(agentId);

    try {
      const response = await fetch(config.tokenEndpoint, {
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: "refresh_token",
          refresh_token: config.refreshToken,
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OAuth refresh failed: ${response.status} ${response.statusText}\n${errorText}`,
        );
      }

      const tokenResponse = (await response.json()) as {
        access_token: string;
        expires_in?: number;
        refresh_token?: string;
        token_type?: string;
      };

      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : new Date(Date.now() + 3600 * 1000); // Default 1 hour

      const token: AuthToken = {
        expiresAt,
        metadata: {
          auth_type: "oauth",
          token_type: tokenResponse.token_type || "Bearer",
        },
        refreshToken: tokenResponse.refresh_token || config.refreshToken,
        token: tokenResponse.access_token,
        type: "bearer",
      };

      // Cache the new token
      this.cache.set(agentId, token);
      return token;
    } catch (error) {
      throw new Error(
        `Failed to refresh OAuth token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
