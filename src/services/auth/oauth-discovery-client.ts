/**
 * OAuth 2.0 Authorization Server Metadata Discovery
 * Implements RFC 8414: OAuth 2.0 Authorization Server Metadata
 * https://tools.ietf.org/html/rfc8414
 */

export interface OAuthServerMetadata {
  issuer: string;
  authorization_endpoint?: string;
  token_endpoint: string;
  registration_endpoint?: string;
  jwks_uri?: string;
  scopes_supported?: string[];
  response_types_supported?: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported?: string[];
  service_documentation?: string;
}

export class OAuthDiscoveryClient {
  private cache = new Map<string, { metadata: OAuthServerMetadata; expiresAt: number }>();
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Discover OAuth server metadata via RFC 8414
   * First tries: /.well-known/oauth-authorization-server
   * Falls back to: /.well-known/openid-configuration (for OIDC servers)
   */
  async discoverMetadata(issuer: string): Promise<OAuthServerMetadata> {
    // Check cache first
    const cached = this.getCachedMetadata(issuer);
    if (cached) {
      return cached;
    }

    // Validate issuer URL
    const issuerUrl = this.validateAndNormalizeIssuer(issuer);

    let metadata: OAuthServerMetadata;

    try {
      // Try RFC 8414 OAuth Authorization Server Metadata first
      metadata = await this.fetchMetadata(this.buildDiscoveryUrl(issuerUrl, "oauth-authorization-server"));
    } catch (error) {
      try {
        // Fall back to OpenID Connect Discovery
        metadata = await this.fetchMetadata(this.buildDiscoveryUrl(issuerUrl, "openid_configuration"));
      } catch (fallbackError) {
        throw new Error(
          `OAuth discovery failed for issuer "${issuer}". ` +
          `Tried both /.well-known/oauth-authorization-server and /.well-known/openid_configuration. ` +
          `Original error: ${error instanceof Error ? error.message : String(error)}. ` +
          `Fallback error: ${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
        );
      }
    }

    // Validate and normalize metadata
    const validatedMetadata = this.validateMetadata(metadata, issuer);

    // Cache the result
    this.cacheMetadata(issuer, validatedMetadata);

    return validatedMetadata;
  }

  /**
   * Clear discovery cache for a specific issuer or all issuers
   */
  clearCache(issuer?: string): void {
    if (issuer) {
      this.cache.delete(issuer);
    } else {
      this.cache.clear();
    }
  }

  private validateAndNormalizeIssuer(issuer: string): URL {
    let issuerUrl: URL;

    try {
      issuerUrl = new URL(issuer);
    } catch {
      throw new Error(`Invalid issuer URL: "${issuer}". Must be a valid HTTPS URL.`);
    }

    // Ensure HTTPS for security
    if (issuerUrl.protocol !== "https:") {
      throw new Error(`Issuer must use HTTPS: "${issuer}"`);
    }

    // Normalize - remove fragment and query per RFC 8414
    issuerUrl.search = "";
    issuerUrl.hash = "";

    return issuerUrl;
  }

  private buildDiscoveryUrl(issuerUrl: URL, wellKnownSuffix: string): string {
    const pathSegments = issuerUrl.pathname.split("/").filter(Boolean);

    if (pathSegments.length === 0) {
      // No path component: https://example.com -> https://example.com/.well-known/suffix
      return `${issuerUrl.origin}/.well-known/${wellKnownSuffix}`;
    } else {
      // With path: https://example.com/path -> https://example.com/.well-known/suffix/path
      return `${issuerUrl.origin}/.well-known/${wellKnownSuffix}/${pathSegments.join("/")}`;
    }
  }

  private async fetchMetadata(discoveryUrl: string): Promise<OAuthServerMetadata> {
    const response = await fetch(discoveryUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Scope3-Campaign-API/1.0 OAuth-Discovery-Client",
      },
      // 10 second timeout for discovery
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(
        `Discovery request failed: ${response.status} ${response.statusText} (${discoveryUrl})`
      );
    }

    const contentType = response.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      throw new Error(
        `Discovery endpoint returned non-JSON content: ${contentType} (${discoveryUrl})`
      );
    }

    let metadata: unknown;
    try {
      metadata = await response.json();
    } catch (error) {
      throw new Error(
        `Failed to parse discovery response as JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    if (!metadata || typeof metadata !== "object") {
      throw new Error("Discovery response is not a valid JSON object");
    }

    return metadata as OAuthServerMetadata;
  }

  private validateMetadata(metadata: OAuthServerMetadata, originalIssuer: string): OAuthServerMetadata {
    // Validate required fields per RFC 8414
    if (!metadata.issuer) {
      throw new Error("Discovery metadata missing required 'issuer' field");
    }

    if (!metadata.token_endpoint) {
      throw new Error("Discovery metadata missing required 'token_endpoint' field");
    }

    // Validate issuer matches what we requested
    if (metadata.issuer !== originalIssuer) {
      throw new Error(
        `Issuer mismatch: requested "${originalIssuer}" but metadata contains "${metadata.issuer}"`
      );
    }

    // Ensure server supports client credentials grant
    const grantTypes = metadata.grant_types_supported || [];
    if (!grantTypes.includes("client_credentials")) {
      throw new Error(
        `OAuth server does not support client_credentials grant type. Supported grants: [${grantTypes.join(", ")}]`
      );
    }

    // Validate URLs
    try {
      new URL(metadata.token_endpoint);
      if (metadata.authorization_endpoint) new URL(metadata.authorization_endpoint);
      if (metadata.registration_endpoint) new URL(metadata.registration_endpoint);
      if (metadata.jwks_uri) new URL(metadata.jwks_uri);
    } catch (error) {
      throw new Error(
        `Invalid endpoint URL in metadata: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return metadata;
  }

  private getCachedMetadata(issuer: string): OAuthServerMetadata | null {
    const cached = this.cache.get(issuer);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(issuer);
      return null;
    }

    return cached.metadata;
  }

  private cacheMetadata(issuer: string, metadata: OAuthServerMetadata): void {
    this.cache.set(issuer, {
      metadata,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }
}