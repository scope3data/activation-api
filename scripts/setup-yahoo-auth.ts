#!/usr/bin/env tsx
/**
 * Yahoo Authentication Setup Script
 * Consolidated from multiple previous versions with production-tested approach
 *
 * Features:
 * - Secure credential handling from multiple sources
 * - Direct SQL approach that bypasses BigQuery parameter issues
 * - Comprehensive validation and testing
 * - Production monitoring setup
 * - Environment-aware configuration
 */

import { BigQuery } from "@google-cloud/bigquery";
import { exec } from "child_process";
import { readFile } from "fs/promises";
import { promisify } from "util";
import { v4 as uuidv4 } from "uuid";

import { AuthHandlerFactory } from "../src/services/auth/auth-handler-factory.js";
import { SalesAgentService } from "../src/services/sales-agent-service.js";

const execAsync = promisify(exec);

interface YahooSetupConfig {
  accountIdentifier: string;
  agentEndpoint: string;
  agentName: string;
  bigqueryConfig: {
    datasetId: string;
    projectId: string;
  };
  credentials: {
    envVar?: string;
    filePath?: string;
    source: "env" | "file";
  };
  environment: "production" | "staging";
  monitoring?: {
    enableHealthChecks: boolean;
  };
}

class YahooAuthSetup {
  private bigquery: BigQuery;
  private salesAgentService: SalesAgentService;

  constructor(private config: YahooSetupConfig) {
    this.bigquery = new BigQuery({
      projectId: config.bigqueryConfig.projectId,
    });
    this.salesAgentService = new SalesAgentService(
      config.bigqueryConfig.projectId,
      config.bigqueryConfig.datasetId,
    );
  }

  /**
   * Main setup orchestration
   */
  async setup(): Promise<void> {
    console.log("🚀 Yahoo Authentication Setup");
    console.log("==============================");
    console.log(`Environment: ${this.config.environment}`);
    console.log(`Agent: ${this.config.agentName}`);
    console.log(`Project: ${this.config.bigqueryConfig.projectId}`);
    console.log(`Dataset: ${this.config.bigqueryConfig.datasetId}`);
    console.log("");

    try {
      // Step 1: Load and convert private key
      const privateKey = await this.loadPrivateKey();

      // Step 2: Test Yahoo authentication
      await this.testYahooAuth(privateKey);

      // Step 3: Setup database records (using working direct SQL approach)
      const _agentId = await this.setupDatabaseRecords(privateKey);

      // Step 4: Test end-to-end integration
      await this.testIntegration();

      console.log("✅ Yahoo authentication setup completed successfully!");
      console.log("");
      console.log("📋 Next Steps:");
      console.log("• Your sales agents can now discover Yahoo inventory");
      console.log("• Tokens auto-refresh 5 minutes before expiry");
      console.log("• Ready for ADCP product discovery");
    } catch (error) {
      console.error("❌ Setup failed:", error);
      console.error("");
      console.error("🔍 Troubleshooting:");
      console.error("• Check BigQuery permissions for project");
      console.error("• Verify private key file contains valid EC private key");
      console.error("• Ensure internet connectivity for Yahoo API calls");
      process.exit(1);
    }
  }

  /**
   * Load private key from configured source
   */
  private async loadPrivateKey(): Promise<string> {
    console.log("🔐 Step 1: Loading Private Key");
    console.log("------------------------------");

    let rawKey: string;

    if (this.config.credentials.source === "file") {
      if (!this.config.credentials.filePath) {
        throw new Error("filePath required for file source");
      }
      console.log(
        `📁 Loading private key from file: ${this.config.credentials.filePath}`,
      );
      rawKey = await readFile(this.config.credentials.filePath, "utf-8");
    } else if (this.config.credentials.source === "env") {
      if (!this.config.credentials.envVar) {
        throw new Error("envVar required for env source");
      }
      console.log(
        `🔑 Loading private key from environment: ${this.config.credentials.envVar}`,
      );
      rawKey = process.env[this.config.credentials.envVar];
      if (!rawKey) {
        throw new Error(
          `Environment variable ${this.config.credentials.envVar} not found`,
        );
      }
    } else {
      throw new Error(
        `Unsupported credential source: ${this.config.credentials.source}`,
      );
    }

    // Convert to PKCS8 format if needed
    if (rawKey.includes("BEGIN EC PRIVATE KEY")) {
      console.log("🔄 Converting EC private key to PKCS8 format...");
      const tempFile = `/tmp/yahoo_key_${Date.now()}.pem`;
      await execAsync(`echo '${rawKey.trim()}' > ${tempFile}`);
      const { stdout } = await execAsync(
        `openssl pkcs8 -topk8 -nocrypt -in ${tempFile}`,
      );
      await execAsync(`rm ${tempFile}`);
      rawKey = stdout.trim();
    }

    // Validate PKCS8 format
    if (!rawKey.includes("BEGIN PRIVATE KEY")) {
      throw new Error("Private key must be in PKCS8 format");
    }

    console.log("✅ Private key loaded and validated");
    console.log("");

    return rawKey;
  }

  /**
   * Setup database records using direct SQL approach (production-tested)
   */
  private async setupDatabaseRecords(privateKey: string): Promise<string> {
    console.log("📊 Step 3: Setting Up Database Records");
    console.log("--------------------------------------");

    const agentId = uuidv4();
    const customerId = 1; // Scope3

    // Create auth config with base64 encoding to avoid SQL injection/escaping issues
    const authConfig = {
      environment: this.config.environment,
      issuer: "idb2b.monetization.scope3",
      keyId: "0.0.1",
      privateKey,
      scope: "agentic-sales-client",
      subject: "idb2b.monetization.scope3",
      type: "yahoo_jwt" as const,
    };

    const authConfigJson = JSON.stringify(authConfig);
    const authConfigBase64 = Buffer.from(authConfigJson).toString("base64");

    // Check if agent already exists
    const checkAgentQuery = `
      SELECT id FROM \`${this.config.bigqueryConfig.projectId}.${this.config.bigqueryConfig.datasetId}.sales_agents\` 
      WHERE name = '${this.config.agentName}' AND endpoint_url = '${this.config.agentEndpoint}'
      LIMIT 1
    `;

    const [existingAgents] = await this.bigquery.query({
      query: checkAgentQuery,
    });
    let finalAgentId = agentId;

    if (existingAgents.length === 0) {
      // Create new agent with direct SQL
      const insertAgentQuery = `
        INSERT INTO \`${this.config.bigqueryConfig.projectId}.${this.config.bigqueryConfig.datasetId}.sales_agents\`
        (id, name, description, endpoint_url, protocol, auth_type, status, added_by)
        VALUES (
          '${agentId}',
          '${this.config.agentName}',
          'Yahoo DSP advertising platform for programmatic buying',
          '${this.config.agentEndpoint}',
          'adcp',
          'yahoo',
          'active',
          '${customerId}'
        )
      `;

      await this.bigquery.query({ query: insertAgentQuery });
      console.log("✅ Created new sales agent");
    } else {
      finalAgentId = existingAgents[0].id;
      console.log("ℹ️  Sales agent already exists, using existing");
    }

    // Check if account already exists
    const checkAccountQuery = `
      SELECT * FROM \`${this.config.bigqueryConfig.projectId}.${this.config.bigqueryConfig.datasetId}.sales_agent_accounts\`
      WHERE customer_id = ${customerId} AND sales_agent_id = '${finalAgentId}'
      LIMIT 1
    `;

    const [existingAccounts] = await this.bigquery.query({
      query: checkAccountQuery,
    });

    if (existingAccounts.length === 0) {
      // Create new account with direct SQL using base64 decoding
      const insertAccountQuery = `
        INSERT INTO \`${this.config.bigqueryConfig.projectId}.${this.config.bigqueryConfig.datasetId}.sales_agent_accounts\`
        (customer_id, sales_agent_id, account_identifier, auth_config, status, registered_by)
        VALUES (
          ${customerId},
          '${finalAgentId}',
          '${this.config.accountIdentifier}',
          PARSE_JSON(SAFE_CONVERT_BYTES_TO_STRING(FROM_BASE64('${authConfigBase64}'))),
          'active',
          'system'
        )
      `;

      await this.bigquery.query({ query: insertAccountQuery });
      console.log("✅ Created sales agent account");
    } else {
      console.log("ℹ️  Account already exists for this agent");
    }

    console.log(`✅ Database records ready (Agent ID: ${finalAgentId})`);
    console.log("");

    return finalAgentId;
  }

  /**
   * Test end-to-end integration
   */
  private async testIntegration(): Promise<void> {
    console.log("🔬 Step 4: Testing Integration");
    console.log("------------------------------");

    const startTime = Date.now();
    const agentConfigs =
      await this.salesAgentService.getAgentConfigsForDiscovery(1);
    const duration = Date.now() - startTime;

    console.log(
      `✅ Retrieved ${agentConfigs.length} agent configs (${duration}ms)`,
    );

    // Find Yahoo agent
    const yahooAgent = agentConfigs.find(
      (agent) =>
        agent.name.toLowerCase().includes("yahoo") ||
        agent.agent_uri.includes("yahoo"),
    );

    if (!yahooAgent) {
      throw new Error("Yahoo agent not found in discovery configs");
    }

    console.log(`✅ Agent found: ${yahooAgent.name}`);
    console.log(`✅ URI: ${yahooAgent.agent_uri}`);
    console.log(`✅ Protocol: ${yahooAgent.protocol}`);
    console.log(`✅ Requires auth: ${yahooAgent.requiresAuth}`);

    if (!yahooAgent.authorization?.startsWith("Bearer ")) {
      throw new Error("Yahoo agent missing bearer authorization");
    }

    console.log("✅ Bearer token authorization configured");
    console.log("");
  }

  /**
   * Test Yahoo authentication
   */
  private async testYahooAuth(privateKey: string): Promise<void> {
    console.log("🧪 Step 2: Testing Yahoo Authentication");
    console.log("---------------------------------------");

    const handler = AuthHandlerFactory.getHandler("yahoo");
    const config = {
      environment: this.config.environment,
      issuer: "idb2b.monetization.scope3",
      keyId: "0.0.1",
      privateKey,
      scope: "agentic-sales-client",
      subject: "idb2b.monetization.scope3",
      type: "yahoo_jwt" as const,
    };

    const startTime = Date.now();
    const token = await handler.getToken("test-yahoo-agent", config);
    const duration = Date.now() - startTime;

    console.log(`✅ Yahoo authentication successful! (${duration}ms)`);
    console.log(`✅ Token expires: ${token.expiresAt?.toISOString()}`);
    console.log(`✅ Token type: ${token.type}`);
    console.log("");
  }
}

// Default configurations for different environments
const PRODUCTION_CONFIG: YahooSetupConfig = {
  accountIdentifier: "scope3-yahoo-production-account",
  agentEndpoint: "https://api.yahoo-dsp.com/adcp",
  agentName: "Yahoo DSP Production",
  bigqueryConfig: {
    datasetId: "agenticapi",
    projectId: "bok-playground", // Update for your production project
  },
  credentials: {
    envVar: "YAHOO_PRIVATE_KEY_PKCS8_PROD",
    source: "env",
  },
  environment: "production",
  monitoring: {
    enableHealthChecks: true,
  },
};

const STAGING_CONFIG: YahooSetupConfig = {
  accountIdentifier: "scope3-yahoo-staging-account",
  agentEndpoint: "https://staging-api.yahoo-dsp.com/adcp",
  agentName: "Yahoo DSP Staging",
  bigqueryConfig: {
    datasetId: "agenticapi",
    projectId: "bok-playground", // Update for your staging project
  },
  credentials: {
    filePath: "./.yahoo_key",
    source: "file",
  },
  environment: "staging",
  monitoring: {
    enableHealthChecks: false,
  },
};

// Main execution
async function main() {
  const environment = process.argv[2] as "production" | "staging" | undefined;

  if (!environment || !["production", "staging"].includes(environment)) {
    console.error("Usage: tsx setup-yahoo-auth.ts [production|staging]");
    console.error("");
    console.error("Examples:");
    console.error(
      "  tsx setup-yahoo-auth.ts staging     # Uses .yahoo_key file",
    );
    console.error(
      "  tsx setup-yahoo-auth.ts production  # Uses YAHOO_PRIVATE_KEY_PKCS8_PROD env var",
    );
    console.error("");
    console.error(
      "Note: Update bigqueryConfig in script for your project/dataset",
    );
    process.exit(1);
  }

  const config =
    environment === "production" ? PRODUCTION_CONFIG : STAGING_CONFIG;

  // Allow override of BigQuery project from environment
  if (process.env.BIGQUERY_PROJECT) {
    config.bigqueryConfig.projectId = process.env.BIGQUERY_PROJECT;
  }
  if (process.env.BIGQUERY_DATASET) {
    config.bigqueryConfig.datasetId = process.env.BIGQUERY_DATASET;
  }

  const setupService = new YahooAuthSetup(config);
  await setupService.setup();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Setup failed:", error);
    process.exit(1);
  });
}

export { YahooAuthSetup, type YahooSetupConfig };
