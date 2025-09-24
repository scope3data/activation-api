import { importPKCS8, SignJWT } from "jose";

import type {
  AuthHandler,
  AuthHeaders,
  AuthToken,
} from "./auth-handler.interface.js";
import type {
  YahooJWTConfig,
  YahooJWTPayload,
  YahooTokenResponse,
} from "./types.js";

import { YAHOO_ENDPOINTS } from "./types.js";

/**
 * Yahoo JWT authentication handler
 * Implements JWT-based authentication with Yahoo's OAuth2 token exchange
 */
export class YahooJWTHandler implements AuthHandler {
  private tokenCache = new Map<string, AuthToken>();

  /**
   * Clear cached token for an agent
   */
  clearCache(agentId: string): void {
    this.tokenCache.delete(agentId);
  }

  /**
   * Get auth fields to spread into agent config for @adcp/client
   */
  getAgentAuthFields(token: AuthToken): Record<string, string> {
    return {
      authorization: `Bearer ${token.token}`,
    };
  }

  /**
   * Get HTTP headers for authentication
   */
  getAuthHeaders(token: AuthToken): AuthHeaders {
    return {
      Authorization: `Bearer ${token.token}`,
      "Content-Type": "application/json",
    };
  }

  /**
   * Get an authentication token for Yahoo API access
   */
  async getToken(agentId: string, config: YahooJWTConfig): Promise<AuthToken> {
    // Check cache first
    const cachedToken = this.tokenCache.get(agentId);
    if (cachedToken && this.isTokenValid(cachedToken)) {
      return cachedToken;
    }

    // Generate new token
    return this.generateNewToken(agentId, config);
  }

  /**
   * Check if a token is still valid
   */
  isTokenValid(token: AuthToken): boolean {
    if (!token.expiresAt) return false;

    // Refresh 5 minutes before actual expiry to prevent mid-request expiry
    // Example: 6-hour token is cached for 5h 55m, then refreshed proactively
    const bufferMs = 5 * 60 * 1000;
    return Date.now() < token.expiresAt.getTime() - bufferMs;
  }

  /**
   * Refresh an authentication token
   */
  async refreshToken(
    agentId: string,
    config: YahooJWTConfig,
  ): Promise<AuthToken> {
    // Clear cached token and generate new one
    this.clearCache(agentId);
    return this.generateNewToken(agentId, config);
  }

  /**
   * Exchange JWT for Yahoo access token
   */
  private async exchangeJWTForAccessToken(
    jwt: string,
    config: YahooJWTConfig,
  ): Promise<YahooTokenResponse> {
    const environment = config.environment || "production";
    const tokenEndpoint = `${YAHOO_ENDPOINTS[environment]}/oauth2/token`;

    const body = new URLSearchParams({
      client_assertion: jwt,
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      grant_type: "client_credentials",
      scope: config.scope,
    });

    try {
      const response = await fetch(tokenEndpoint, {
        body: body.toString(),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        method: "POST",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Yahoo token exchange failed: ${response.status} ${response.statusText}\n${errorText}`,
        );
      }

      const tokenResponse = (await response.json()) as YahooTokenResponse;

      if (!tokenResponse.access_token) {
        throw new Error("No access_token in Yahoo response");
      }

      return tokenResponse;
    } catch (error) {
      throw new Error(
        `Failed to exchange JWT for access token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Generate a signed JWT for Yahoo authentication
   */
  private async generateJWT(config: YahooJWTConfig): Promise<string> {
    const environment = config.environment || "production";
    const ztsUrl = YAHOO_ENDPOINTS[environment];

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour expiry

    const payload: YahooJWTPayload = {
      aud: ztsUrl,
      exp,
      iat: now,
      iss: config.issuer,
      sub: config.subject,
    };

    try {
      // Import the PKCS8 private key
      const privateKey = await importPKCS8(config.privateKey, "ES256");

      // Create and sign the JWT
      const jwt = await new SignJWT(payload)
        .setProtectedHeader({
          alg: "ES256",
          kid: config.keyId,
        })
        .sign(privateKey);

      return jwt;
    } catch (error) {
      throw new Error(
        `Failed to generate JWT: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Generate a new authentication token
   */
  private async generateNewToken(
    agentId: string,
    config: YahooJWTConfig,
  ): Promise<AuthToken> {
    try {
      // Generate JWT
      const jwt = await this.generateJWT(config);

      // Exchange JWT for access token
      const accessToken = await this.exchangeJWTForAccessToken(jwt, config);

      // Create auth token
      const authToken: AuthToken = {
        expiresAt: accessToken.expires_in
          ? new Date(Date.now() + accessToken.expires_in * 1000)
          : new Date(Date.now() + 3600 * 1000), // Default to 1 hour
        metadata: {
          scope: accessToken.scope,
          tokenType: accessToken.token_type,
        },
        token: accessToken.access_token,
        type: "bearer",
      };

      // Cache the token
      this.tokenCache.set(agentId, authToken);

      return authToken;
    } catch (error) {
      throw new Error(
        `Failed to generate Yahoo JWT token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
