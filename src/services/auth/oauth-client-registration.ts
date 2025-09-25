import { BigQuery } from "@google-cloud/bigquery";

import type { OAuthServerMetadata } from "./oauth-discovery-client.js";

/**
 * OAuth 2.0 Dynamic Client Registration
 * Implements RFC 7591: OAuth 2.0 Dynamic Client Registration Protocol
 * https://tools.ietf.org/html/rfc7591
 */

export interface ClientRegistration {
  client_id: string;
  client_id_issued_at?: number;
  client_name?: string;
  client_secret?: string;
  client_secret_expires_at?: number;
  client_uri?: string;
  contacts?: string[];
  grant_types: string[];
  logo_uri?: string;
  policy_uri?: string;
  scope?: string;
  software_id?: string;
  software_version?: string;
  token_endpoint_auth_method?: string;
  tos_uri?: string;
}

export interface ClientRegistrationRequest {
  client_name: string;
  client_uri?: string;
  contacts?: string[];
  grant_types: string[];
  logo_uri?: string;
  policy_uri?: string;
  redirect_uris?: string[];
  scope?: string;
  software_id?: string;
  software_version?: string;
  token_endpoint_auth_method?: string;
  tos_uri?: string;
}

export interface StoredClientRegistration {
  agent_id: string;
  client_id: string;
  client_secret_encrypted: string;
  expires_at?: Date;
  grant_types: string[];
  issuer: string;
  metadata: Record<string, unknown>;
  registered_at: Date;
  scope?: string;
}

export class OAuthClientRegistrationService {
  private bigquery: BigQuery;
  private readonly tableName: string;

  constructor(
    private projectId: string,
    private datasetId: string,
    tableName = "oauth_client_registrations",
  ) {
    this.bigquery = new BigQuery({ projectId });
    this.tableName = `${projectId}.${datasetId}.${tableName}`;
  }

  /**
   * Clear stored registration (for testing or manual cleanup)
   */
  async clearRegistration(agentId: string, issuer: string): Promise<void> {
    const query = `
      DELETE FROM \`${this.tableName}\`
      WHERE agent_id = @agent_id AND issuer = @issuer
    `;

    await this.bigquery.query({
      params: { agent_id: agentId, issuer },
      query,
    });
  }

  /**
   * Get existing registration or create new one
   * This is the main entry point for OAuth client registration
   */
  async getOrCreateRegistration(
    agentId: string,
    issuer: string,
    metadata: OAuthServerMetadata,
    requestedScope?: string,
  ): Promise<ClientRegistration> {
    // Check for existing registration
    const existing = await this.getStoredRegistration(agentId, issuer);
    if (existing && this.isRegistrationValid(existing)) {
      return this.storedToClientRegistration(existing);
    }

    // Create new registration
    if (!metadata.registration_endpoint) {
      throw new Error(
        `OAuth server "${issuer}" does not support dynamic client registration. ` +
          `No registration_endpoint found in server metadata. ` +
          `Manual client setup required.`,
      );
    }

    const registration = await this.registerClient(
      metadata.registration_endpoint,
      requestedScope,
    );

    // Store the registration
    await this.storeRegistration(agentId, issuer, registration, requestedScope);

    return registration;
  }

  /**
   * Register Scope3 as OAuth client with publisher per RFC 7591
   */
  async registerClient(
    registrationEndpoint: string,
    requestedScope?: string,
  ): Promise<ClientRegistration> {
    const registrationRequest: ClientRegistrationRequest = {
      client_name: "Scope3 Campaign API",
      client_uri: "https://scope3.com",
      contacts: ["integrations@scope3.com"],
      grant_types: ["client_credentials"],
      policy_uri: "https://scope3.com/privacy",
      software_id: "scope3-campaign-api",
      software_version: "1.0",
      token_endpoint_auth_method: "client_secret_post",
      tos_uri: "https://scope3.com/terms",
      ...(requestedScope && { scope: requestedScope }),
    };

    try {
      const response = await fetch(registrationEndpoint, {
        body: JSON.stringify(registrationRequest),
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "Scope3-Campaign-API/1.0 OAuth-Registration-Client",
        },
        method: "POST",
        // 15 second timeout for registration
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `Client registration failed: ${response.status} ${response.statusText}. ` +
            `Response: ${errorText.substring(0, 200)}`,
        );
      }

      const registration = (await response.json()) as ClientRegistration;

      // Validate required fields
      if (!registration.client_id) {
        throw new Error(
          "Registration response missing required 'client_id' field",
        );
      }

      // For client credentials flow, we need a client secret
      if (!registration.client_secret) {
        throw new Error(
          "Registration response missing 'client_secret' field. " +
            "Client credentials grant requires a client secret.",
        );
      }

      return registration;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(
          `OAuth client registration failed for endpoint "${registrationEndpoint}": ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Retrieve stored client registration from BigQuery
   */
  private async getStoredRegistration(
    agentId: string,
    issuer: string,
  ): Promise<null | StoredClientRegistration> {
    const query = `
      SELECT 
        agent_id,
        issuer,
        client_id,
        client_secret_encrypted,
        grant_types,
        scope,
        registered_at,
        expires_at,
        metadata
      FROM \`${this.tableName}\`
      WHERE agent_id = @agent_id AND issuer = @issuer
      ORDER BY registered_at DESC
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      params: { agent_id: agentId, issuer },
      query,
    });

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      agent_id: row.agent_id,
      client_id: row.client_id,
      client_secret_encrypted: row.client_secret_encrypted,
      expires_at: row.expires_at ? new Date(row.expires_at.value) : undefined,
      grant_types: row.grant_types,
      issuer: row.issuer,
      metadata: row.metadata,
      registered_at: new Date(row.registered_at.value),
      scope: row.scope,
    };
  }

  /**
   * Check if stored registration is still valid
   */
  private isRegistrationValid(registration: StoredClientRegistration): boolean {
    // Check if client secret has expired
    if (
      registration.expires_at &&
      Date.now() >= registration.expires_at.getTime()
    ) {
      return false;
    }

    // Registration is valid
    return true;
  }

  /**
   * Convert stored registration to client registration format
   */
  private storedToClientRegistration(
    stored: StoredClientRegistration,
  ): ClientRegistration {
    // Simple decryption for client secret (in production, use proper decryption)
    const clientSecret = Buffer.from(
      stored.client_secret_encrypted,
      "base64",
    ).toString();

    return {
      client_id: stored.client_id,
      client_secret: clientSecret,
      client_secret_expires_at: stored.expires_at
        ? Math.floor(stored.expires_at.getTime() / 1000)
        : undefined,
      grant_types: stored.grant_types,
      scope: stored.scope,
      // Merge in metadata if available
      ...(stored.metadata as Partial<ClientRegistration>),
    };
  }

  /**
   * Store client registration in BigQuery
   */
  private async storeRegistration(
    agentId: string,
    issuer: string,
    registration: ClientRegistration,
    requestedScope?: string,
  ): Promise<void> {
    // Simple encryption for client secret (in production, use proper encryption)
    const clientSecretEncrypted = Buffer.from(
      registration.client_secret || "",
    ).toString("base64");

    const expiresAt = registration.client_secret_expires_at
      ? new Date(registration.client_secret_expires_at * 1000)
      : undefined;

    const query = `
      INSERT INTO \`${this.tableName}\` (
        agent_id,
        issuer,
        client_id,
        client_secret_encrypted,
        grant_types,
        scope,
        registered_at,
        expires_at,
        metadata
      ) VALUES (
        @agent_id,
        @issuer,
        @client_id,
        @client_secret_encrypted,
        @grant_types,
        @scope,
        @registered_at,
        @expires_at,
        PARSE_JSON(@metadata)
      )
      -- Use MERGE or INSERT IGNORE in production to handle race conditions
    `;

    await this.bigquery.query({
      params: {
        agent_id: agentId,
        client_id: registration.client_id,
        client_secret_encrypted: clientSecretEncrypted,
        expires_at: expiresAt?.toISOString(),
        grant_types: registration.grant_types,
        issuer,
        metadata: JSON.stringify({
          client_id_issued_at: registration.client_id_issued_at,
          client_name: registration.client_name,
          client_uri: registration.client_uri,
          contacts: registration.contacts,
          token_endpoint_auth_method: registration.token_endpoint_auth_method,
        }),
        registered_at: new Date().toISOString(),
        scope: requestedScope,
      },
      query,
    });
  }
}
