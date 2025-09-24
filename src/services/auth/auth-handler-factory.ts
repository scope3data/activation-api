import type { AuthHandler } from "./auth-handler.interface.js";
import type { SupportedAuthConfig } from "./types.js";

import {
  BearerAuthHandler,
  CustomHeaderAuthHandler,
  OAuthHandler,
} from "./simple-auth-handlers.js";
import { YahooJWTHandler } from "./yahoo-jwt-handler.js";

/**
 * Factory for creating authentication handlers based on auth type
 */
export class AuthHandlerFactory {
  private static handlers = new Map<string, AuthHandler>();

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
          clientId: config.clientId as string,
          clientSecret: config.clientSecret as string,
          refreshToken: config.refreshToken as string,
          tokenEndpoint: config.tokenEndpoint as string,
          type: "oauth",
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
   * @param authType - The authentication type (oauth, bearer, custom_header, yahoo)
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
        handler = new OAuthHandler();
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
    return ["bearer", "custom_header", "oauth", "yahoo"];
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
        const requiredOAuthFields = [
          "clientId",
          "clientSecret",
          "refreshToken",
          "tokenEndpoint",
        ];
        for (const field of requiredOAuthFields) {
          if (!authConfig[field] || typeof authConfig[field] !== "string") {
            throw new Error(`OAuth auth config must include '${field}' field`);
          }
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
