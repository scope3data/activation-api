import type { AuthHandler } from "./auth-handler.interface.js";
import type { SupportedAuthConfig } from "./types.js";

import {
  BearerAuthHandler,
  CustomHeaderAuthHandler,
  LegacyOAuthHandler,
  ManualOAuthHandler,
  OAuthHandler,
} from "./simple-auth-handlers.js";
import { YahooJWTHandler } from "./yahoo-jwt-handler.js";

/**
 * Factory for creating authentication handlers based on auth type
 */
export class AuthHandlerFactory {
  private static datasetId?: string;
  private static handlers = new Map<string, AuthHandler>();
  private static projectId?: string;

  /**
   * Clear all cached handlers (for testing)
   */
  static clearCache(): void {
    this.handlers.clear();
  }

  /**
   * Convert auth config from database format to typed config
   */
  static createTypedConfig(
    authType: string,
    config: Record<string, unknown>,
  ): SupportedAuthConfig {
    const normalizedType = authType.toLowerCase();

    // Validate first
    this.validateConfig(authType, config);

    switch (normalizedType) {
      case "bearer":
        return {
          token: config.token as string,
          type: "bearer",
        };

      case "custom_header":
        return {
          headerName: config.headerName as string,
          headerValue: config.headerValue as string,
          type: "custom_header",
        };

      case "oauth":
        return {
          issuer: config.issuer as string,
          scope: config.scope as string | undefined,
          type: "oauth",
        };

      case "oauth_legacy":
        return {
          clientId: config.clientId as string,
          clientSecret: config.clientSecret as string,
          refreshToken: config.refreshToken as string,
          tokenEndpoint: config.tokenEndpoint as string,
          type: "oauth_legacy",
        };

      case "oauth_manual":
        return {
          clientId: config.clientId as string,
          clientSecret: config.clientSecret as string,
          scope: config.scope as string | undefined,
          tokenEndpoint: config.tokenEndpoint as string,
          type: "oauth_manual",
        };

      case "yahoo":
      case "yahoo_jwt":
        return {
          environment:
            (config.environment as "production" | "uat") || "production",
          issuer: config.issuer as string,
          keyId: config.keyId as string,
          privateKey: config.privateKey as string,
          scope: config.scope as string,
          subject: config.subject as string,
          type: "yahoo_jwt",
        };

      default:
        throw new Error(
          `Cannot create typed config for unsupported auth type: ${authType}`,
        );
    }
  }

  /**
   * Get an auth handler for the given auth type
   * @param authType - The authentication type (oauth, bearer, custom_header, yahoo, etc.)
   * @returns Authentication handler instance
   */
  static getHandler(authType: string): AuthHandler {
    // Normalize auth type
    const normalizedType = authType.toLowerCase();

    // Check cache first
    if (this.handlers.has(normalizedType)) {
      return this.handlers.get(normalizedType)!;
    }

    // Create handler based on type
    let handler: AuthHandler;

    switch (normalizedType) {
      case "bearer":
        handler = new BearerAuthHandler();
        break;

      case "custom_header":
        handler = new CustomHeaderAuthHandler();
        break;

      case "oauth":
        // OAuth handler requires BigQuery configuration
        if (!this.projectId || !this.datasetId) {
          throw new Error(
            "AuthHandlerFactory must be initialized with projectId and datasetId before creating OAuth handlers. " +
              "Call AuthHandlerFactory.initialize(projectId, datasetId) first.",
          );
        }
        handler = new OAuthHandler(this.projectId, this.datasetId);
        break;

      case "oauth_legacy":
        handler = new LegacyOAuthHandler();
        break;

      case "oauth_manual":
        handler = new ManualOAuthHandler();
        break;

      case "yahoo":
      case "yahoo_jwt":
        handler = new YahooJWTHandler();
        break;

      default:
        throw new Error(`Unsupported auth type: ${authType}`);
    }

    // Cache the handler
    this.handlers.set(normalizedType, handler);
    return handler;
  }

  /**
   * Get supported auth types
   */
  static getSupportedTypes(): string[] {
    return [
      "bearer",
      "custom_header",
      "oauth",
      "oauth_legacy",
      "oauth_manual",
      "yahoo",
    ];
  }

  /**
   * Initialize factory with BigQuery configuration
   * Required for OAuth handlers that need to store client registrations
   */
  static initialize(projectId: string, datasetId: string): void {
    this.projectId = projectId;
    this.datasetId = datasetId;
  }

  /**
   * Validate auth type
   */
  static isSupported(authType: string): boolean {
    return this.getSupportedTypes().includes(authType.toLowerCase());
  }

  /**
   * Validate auth configuration structure
   */
  static validateConfig(authType: string, config: unknown): void {
    if (!config || typeof config !== "object") {
      throw new Error(`Invalid auth config for ${authType}: must be an object`);
    }

    const normalizedType = authType.toLowerCase();
    const authConfig = config as Record<string, unknown>;

    switch (normalizedType) {
      case "bearer":
        if (!authConfig.token || typeof authConfig.token !== "string") {
          throw new Error("Bearer auth config must include 'token' field");
        }
        break;

      case "custom_header":
        if (
          !authConfig.headerName ||
          typeof authConfig.headerName !== "string"
        ) {
          throw new Error(
            "Custom header auth config must include 'headerName' field",
          );
        }
        if (
          !authConfig.headerValue ||
          typeof authConfig.headerValue !== "string"
        ) {
          throw new Error(
            "Custom header auth config must include 'headerValue' field",
          );
        }
        break;

      case "oauth": {
        if (!authConfig.issuer || typeof authConfig.issuer !== "string") {
          throw new Error("OAuth auth config must include 'issuer' field");
        }

        // Validate issuer is a valid HTTPS URL
        try {
          const url = new URL(authConfig.issuer);
          if (url.protocol !== "https:") {
            throw new Error("OAuth issuer must use HTTPS");
          }
        } catch {
          throw new Error("OAuth issuer must be a valid HTTPS URL");
        }

        // Scope is optional but must be string if provided
        if (authConfig.scope && typeof authConfig.scope !== "string") {
          throw new Error("OAuth scope must be a string if provided");
        }
        break;
      }

      case "oauth_legacy": {
        const requiredFields = [
          "clientId",
          "clientSecret",
          "refreshToken",
          "tokenEndpoint",
        ];
        for (const field of requiredFields) {
          if (!authConfig[field] || typeof authConfig[field] !== "string") {
            throw new Error(
              `Legacy OAuth auth config must include '${field}' field`,
            );
          }
        }
        break;
      }

      case "oauth_manual": {
        const requiredFields = ["tokenEndpoint", "clientId", "clientSecret"];
        for (const field of requiredFields) {
          if (!authConfig[field] || typeof authConfig[field] !== "string") {
            throw new Error(
              `Manual OAuth auth config must include '${field}' field`,
            );
          }
        }

        // Validate tokenEndpoint is a valid HTTPS URL
        try {
          const url = new URL(authConfig.tokenEndpoint as string);
          if (url.protocol !== "https:") {
            throw new Error("OAuth token endpoint must use HTTPS");
          }
        } catch {
          throw new Error("OAuth token endpoint must be a valid HTTPS URL");
        }

        // Scope is optional but must be string if provided
        if (authConfig.scope && typeof authConfig.scope !== "string") {
          throw new Error("OAuth scope must be a string if provided");
        }
        break;
      }

      case "yahoo":
      case "yahoo_jwt": {
        const requiredYahooFields = [
          "privateKey",
          "issuer",
          "subject",
          "keyId",
          "scope",
        ];
        for (const field of requiredYahooFields) {
          if (!authConfig[field] || typeof authConfig[field] !== "string") {
            throw new Error(
              `Yahoo JWT auth config must include '${field}' field`,
            );
          }
        }
        break;
      }

      default:
        throw new Error(`Cannot validate unsupported auth type: ${authType}`);
    }
  }
}
