import { BigQuery } from "@google-cloud/bigquery";

export interface CustomerContext {
  clientId: string;
  company?: string;
  customerId: number;
  permissions?: string[];
}

export interface ParsedToken {
  clientId: string;
  clientSecret: string;
}

interface CustomerMapping {
  access_client_id: string;
  access_client_secret_hash: string;
  company: string;
  customer_id: number;
}

export class AuthenticationService {
  private bigquery: BigQuery;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private cacheExpiry = new Map<string, number>();
  private customerCache = new Map<string, CustomerContext>();

  constructor(bigquery: BigQuery) {
    this.bigquery = bigquery;
  }

  /**
   * Get customer ID from token (backward compatibility helper)
   */
  async getCustomerIdFromToken(apiToken: string): Promise<null | number> {
    const context = await this.resolveCustomerContext(apiToken);
    return context?.customerId || null;
  }

  /**
   * Parse and validate Scope3 API token format
   * Token format: scope3_<32_char_client_id>_<secret>
   */
  parseApiToken(apiToken: string): null | ParsedToken {
    if (!apiToken?.startsWith("scope3_")) {
      return null;
    }

    const parts = apiToken.split("_");
    if (parts.length !== 3) {
      return null;
    }

    const [, clientId, clientSecret] = parts;

    // Validate clientId is exactly 32 characters (alphanumeric format)
    if (clientId.length !== 32 || !/^[a-zA-Z0-9]{32}$/i.test(clientId)) {
      return null;
    }

    // Basic client secret validation
    if (clientSecret.length < 8) {
      return null;
    }

    return { clientId, clientSecret };
  }

  /**
   * Resolve customer context from API token with caching
   */
  async resolveCustomerContext(
    apiToken: string,
  ): Promise<CustomerContext | null> {
    const parsed = this.parseApiToken(apiToken);
    if (!parsed) {
      return null;
    }

    const { clientId } = parsed;

    // Check cache first
    const cached = this.getCachedCustomer(clientId);
    if (cached) {
      return cached;
    }

    try {
      const context = await this.queryCustomerMapping(clientId);
      if (context) {
        this.cacheCustomer(clientId, context);
      }
      return context;
    } catch (error) {
      console.error("Failed to resolve customer context:", error);
      return null;
    }
  }

  /**
   * Validate token permissions for specific operations
   * Currently all valid tokens have full access
   */
  async validatePermissions(
    apiToken: string,
    _requiredPermissions: string[],
  ): Promise<boolean> {
    const context = await this.resolveCustomerContext(apiToken);
    if (!context) return false;

    // Future: implement granular permissions based on _requiredPermissions
    return true;
  }

  private cacheCustomer(clientId: string, context: CustomerContext): void {
    const now = Date.now();
    this.customerCache.set(clientId, context);
    this.cacheExpiry.set(clientId, now + this.CACHE_TTL_MS);
  }

  private getCachedCustomer(clientId: string): CustomerContext | null {
    const now = Date.now();
    if (this.customerCache.has(clientId)) {
      const expiry = this.cacheExpiry.get(clientId) || 0;
      if (now < expiry) {
        return this.customerCache.get(clientId) || null;
      } else {
        this.customerCache.delete(clientId);
        this.cacheExpiry.delete(clientId);
      }
    }
    return null;
  }

  private async queryCustomerMapping(
    clientId: string,
  ): Promise<CustomerContext | null> {
    const query = `
      SELECT * FROM EXTERNAL_QUERY(
        "swift-catfish-337215.us-central1.swift-catfish-337215-scope3", 
        "select c.id as customer_id, company, access_client_id, access_client_secret_hash from service_token st join customer c on st.customer_id=c.id ;"
      )
      WHERE access_client_id = @clientId
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      params: { clientId },
      query,
    });

    if (rows.length === 0) {
      return null;
    }

    const mapping = rows[0] as CustomerMapping;

    return {
      clientId: mapping.access_client_id,
      company: mapping.company,
      customerId: mapping.customer_id,
      permissions: ["full_access"], // Future: granular permissions
    };
  }
}
