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
 * OAuth authentication configuration
 */
export interface OAuthConfig extends AuthConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  tokenEndpoint: string;
  type: "oauth";
}

/**
 * Union type of all supported auth configurations
 */
export type SupportedAuthConfig =
  | BearerConfig
  | CustomHeaderConfig
  | OAuthConfig
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
