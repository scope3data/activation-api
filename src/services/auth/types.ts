import type { AuthConfig } from "./auth-handler.interface.js";

/**
 * Bearer token authentication configuration
 */
export interface BearerConfig extends AuthConfig {
  token: string;
  type: "bearer";
}

/**
 * Custom header authentication configuration
 */
export interface CustomHeaderConfig extends AuthConfig {
  headerName: string; // e.g., "X-API-Key"
  headerValue: string;
  type: "custom_header";
}

/**
 * OAuth authentication configuration (RFC 8414 Discovery + RFC 7591 Dynamic Registration)
 * Uses OAuth issuer domain for automatic discovery and client registration
 */
export interface OAuthConfig extends AuthConfig {
  issuer: string;           // OAuth issuer domain (e.g., "https://publisher.com")
  scope?: string;           // Optional requested scopes (e.g., "adcp.read adcp.write")
  type: "oauth";
}

/**
 * Legacy OAuth configuration (deprecated)
 * @deprecated Use OAuthConfig with issuer-based discovery instead
 */
export interface LegacyOAuthConfig extends AuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  tokenEndpoint: string;
  type: "oauth_legacy";
}

/**
 * Manual OAuth configuration for servers that don't support discovery
 * Use this when automatic discovery via .well-known endpoints fails
 */
export interface ManualOAuthConfig extends AuthConfig {
  tokenEndpoint: string;    // Direct token endpoint URL
  clientId: string;         // Pre-registered client ID
  clientSecret: string;     // Pre-registered client secret
  scope?: string;          // Optional requested scopes
  type: "oauth_manual";
}

/**
 * Union type of all supported auth configurations
 */
export type SupportedAuthConfig =
  | BearerConfig
  | CustomHeaderConfig
  | OAuthConfig
  | LegacyOAuthConfig
  | ManualOAuthConfig
  | YahooJWTConfig;

/**
 * Yahoo JWT authentication configuration
 */
export interface YahooJWTConfig extends AuthConfig {
  environment?: "production" | "uat";
  issuer: string; // e.g., "idb2b.monetization.scope3"
  keyId: string; // e.g., "0.0.1"
  privateKey: string; // PKCS8 format private key (PEM string)
  scope: string; // e.g., "agentic-sales-client"
  subject: string; // e.g., "idb2b.monetization.scope3"
  type: "yahoo_jwt";
}

/**
 * JWT payload for Yahoo authentication
 */
export interface YahooJWTPayload {
  [key: string]: unknown; // Index signature for compatibility with jose library
  aud: string; // audience (Yahoo ZTS URL)
  exp: number; // expiration time (Unix timestamp)
  iat: number; // issued at (Unix timestamp)
  iss: string; // issuer
  sub: string; // subject
}

/**
 * Yahoo OAuth2 token response
 */
export interface YahooTokenResponse {
  access_token: string;
  expires_in?: number;
  scope?: string;
  token_type: string;
}

/**
 * Environment-specific Yahoo endpoints
 */
export const YAHOO_ENDPOINTS = {
  production: "https://id.b2b.yahooincapis.com/zts/v1",
  uat: "https://id-uat.b2b.yahooincapis.com/zts/v1",
} as const;
