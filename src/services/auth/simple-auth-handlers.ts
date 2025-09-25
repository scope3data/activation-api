import type {
  AuthHandler,
  AuthHeaders,
  AuthToken,
} from "./auth-handler.interface.js";
import type {
  BearerConfig,
  CustomHeaderConfig,
  LegacyOAuthConfig,
  ManualOAuthConfig,
  OAuthConfig,
} from "./types.js";

import { OAuthClientRegistrationService } from "./oauth-client-registration.js";
import { OAuthDiscoveryClient } from "./oauth-discovery-client.js";

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
 * Legacy OAuth handler for backward compatibility
 * @deprecated Use OAuthHandler with issuer-based discovery instead
 */
export class LegacyOAuthHandler implements AuthHandler {
  private cache = new Map<string, AuthToken>();

  clearCache(agentId: string): void {
    this.cache.delete(agentId);
  }

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

  async getToken(
    agentId: string,
    config: LegacyOAuthConfig,
  ): Promise<AuthToken> {
    const cached = this.cache.get(agentId);
    if (cached && this.isTokenValid(cached)) {
      return cached;
    }
    return this.refreshToken(agentId, config);
  }

  isTokenValid(token: AuthToken): boolean {
    if (!token.expiresAt) return false;
    const bufferMs = 5 * 60 * 1000;
    return Date.now() < token.expiresAt.getTime() - bufferMs;
  }

  async refreshToken(
    agentId: string,
    config: LegacyOAuthConfig,
  ): Promise<AuthToken> {
    console.warn(
      `[DEPRECATED] Using legacy OAuth configuration for agent ${agentId}. ` +
        `Please migrate to issuer-based OAuth configuration.`,
    );

    // Implementation of the old refresh token flow
    // (keeping the original implementation for compatibility)
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
        : new Date(Date.now() + 3600 * 1000);

      const token: AuthToken = {
        expiresAt,
        metadata: {
          auth_type: "oauth_legacy",
          token_type: tokenResponse.token_type || "Bearer",
        },
        refreshToken: tokenResponse.refresh_token || config.refreshToken,
        token: tokenResponse.access_token,
        type: "bearer",
      };

      this.cache.set(agentId, token);
      return token;
    } catch (error) {
      throw new Error(
        `Failed to refresh legacy OAuth token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Manual OAuth handler for servers that don't support discovery
 */
export class ManualOAuthHandler implements AuthHandler {
  private cache = new Map<string, AuthToken>();

  clearCache(agentId: string): void {
    this.cache.delete(agentId);
  }

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

  async getToken(
    agentId: string,
    config: ManualOAuthConfig,
  ): Promise<AuthToken> {
    const cached = this.cache.get(agentId);
    if (cached && this.isTokenValid(cached)) {
      return cached;
    }
    return this.refreshToken(agentId, config);
  }

  isTokenValid(token: AuthToken): boolean {
    if (!token.expiresAt) return false;
    const bufferMs = 5 * 60 * 1000;
    return Date.now() < token.expiresAt.getTime() - bufferMs;
  }

  async refreshToken(
    agentId: string,
    config: ManualOAuthConfig,
  ): Promise<AuthToken> {
    this.clearCache(agentId);

    try {
      const response = await fetch(config.tokenEndpoint, {
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: "client_credentials",
          ...(config.scope && { scope: config.scope }),
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
          `Manual OAuth token request failed: ${response.status} ${response.statusText}\n${errorText}`,
        );
      }

      const tokenResponse = (await response.json()) as {
        access_token: string;
        expires_in?: number;
        scope?: string;
        token_type?: string;
      };

      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : new Date(Date.now() + 3600 * 1000);

      const token: AuthToken = {
        expiresAt,
        metadata: {
          auth_type: "oauth_manual",
          scope: tokenResponse.scope,
          token_type: tokenResponse.token_type || "Bearer",
        },
        token: tokenResponse.access_token,
        type: "bearer",
      };

      this.cache.set(agentId, token);
      return token;
    } catch (error) {
      throw new Error(
        `Failed to get manual OAuth token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * OAuth authentication handler with automatic discovery and client registration
 * Implements RFC 8414 (OAuth Server Metadata) + RFC 7591 (Dynamic Client Registration)
 */
export class OAuthHandler implements AuthHandler {
  private cache = new Map<string, AuthToken>();
  private discoveryClient: OAuthDiscoveryClient;
  private registrationService: OAuthClientRegistrationService;

  constructor(
    projectId: string,
    datasetId: string,
    discoveryClient?: OAuthDiscoveryClient,
    registrationService?: OAuthClientRegistrationService,
  ) {
    this.discoveryClient = discoveryClient || new OAuthDiscoveryClient();
    this.registrationService =
      registrationService ||
      new OAuthClientRegistrationService(projectId, datasetId);
  }

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

    // Get new token using discovery + registration flow
    return this.requestNewToken(agentId, config);
  }

  isTokenValid(token: AuthToken): boolean {
    if (!token.expiresAt) return false;

    // Refresh 5 minutes before actual expiry to prevent mid-request expiry
    // Example: 1-hour token is cached for 55m, then refreshed proactively
    const bufferMs = 5 * 60 * 1000;
    return Date.now() < token.expiresAt.getTime() - bufferMs;
  }

  async refreshToken(agentId: string, config: OAuthConfig): Promise<AuthToken> {
    // OAuth client credentials flow doesn't use refresh tokens
    // Just get a new access token using client credentials
    return this.requestNewToken(agentId, config);
  }

  /**
   * Get new access token using OAuth discovery + client registration + client credentials flow
   */
  private async requestNewToken(
    agentId: string,
    config: OAuthConfig,
  ): Promise<AuthToken> {
    // Clear any cached token
    this.clearCache(agentId);

    try {
      // Step 1: Discover OAuth server metadata
      const metadata = await this.discoveryClient.discoverMetadata(
        config.issuer,
      );

      // Step 2: Get or create client registration
      const registration =
        await this.registrationService.getOrCreateRegistration(
          agentId,
          config.issuer,
          metadata,
          config.scope,
        );

      // Step 3: Request access token using client credentials
      const response = await fetch(metadata.token_endpoint, {
        body: new URLSearchParams({
          client_id: registration.client_id,
          client_secret: registration.client_secret || "",
          grant_type: "client_credentials",
          ...(config.scope && { scope: config.scope }),
        }),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "Scope3-Campaign-API/1.0 OAuth-Client",
        },
        method: "POST",
        // 15 second timeout for token request
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `OAuth token request failed: ${response.status} ${response.statusText}. ` +
            `Issuer: ${config.issuer}. Response: ${errorText.substring(0, 300)}`,
        );
      }

      const tokenResponse = (await response.json()) as {
        access_token: string;
        expires_in?: number;
        scope?: string;
        token_type?: string;
      };

      if (!tokenResponse.access_token) {
        throw new Error("OAuth token response missing 'access_token' field");
      }

      // Calculate expiration time
      const expiresAt = tokenResponse.expires_in
        ? new Date(Date.now() + tokenResponse.expires_in * 1000)
        : new Date(Date.now() + 3600 * 1000); // Default 1 hour

      const token: AuthToken = {
        expiresAt,
        metadata: {
          auth_type: "oauth",
          issuer: config.issuer,
          scope: tokenResponse.scope || config.scope,
          token_type: tokenResponse.token_type || "Bearer",
        },
        token: tokenResponse.access_token,
        type: "bearer",
      };

      // Cache the new token
      this.cache.set(agentId, token);
      return token;
    } catch (error) {
      throw new Error(
        `OAuth authentication failed for issuer "${config.issuer}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}
