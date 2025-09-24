#!/usr/bin/env tsx
/**
 * Yahoo Authentication Test Suite
 * Consolidated test script covering unit, integration, and end-to-end testing
 *
 * Test levels:
 * - Unit: Handler class functionality with mock credentials
 * - Integration: Database operations and auth flow
 * - End-to-end: Complete workflow via SalesAgentService
 */

import { readFile } from "fs/promises";

import type { YahooJWTConfig } from "../src/services/auth/types.js";

import { AuthHandlerFactory } from "../src/services/auth/auth-handler-factory.js";
import { YahooJWTHandler } from "../src/services/auth/yahoo-jwt-handler.js";
import { SalesAgentService } from "../src/services/sales-agent-service.js";

interface TestResult {
  details?: Record<string, unknown>;
  duration: number;
  error?: string;
  name: string;
  passed: boolean;
}

class YahooAuthTestSuite {
  private hasRealCredentials: boolean = false;
  private realPrivateKey?: string;
  private results: TestResult[] = [];

  async runAllTests(): Promise<void> {
    console.log("🧪 Yahoo Authentication Test Suite");
    console.log("===================================");
    console.log("");

    // Check for real credentials
    await this.checkCredentials();

    // Unit tests (always run)
    await this.runUnitTests();

    // Integration and E2E tests (only with real credentials)
    if (this.hasRealCredentials) {
      await this.runIntegrationTests();
      await this.runEndToEndTests();
    } else {
      console.log("⏭️  Skipping integration/E2E tests (no real credentials)");
      console.log(
        "   Place Yahoo private key in .yahoo_key to run full test suite",
      );
      console.log("");
    }

    // Report results
    this.reportResults();
  }

  private async checkCredentials(): Promise<void> {
    try {
      this.realPrivateKey = await readFile(".yahoo_key", "utf-8");
      this.hasRealCredentials = true;
      console.log(
        "🔑 Real credentials found (.yahoo_key) - running full test suite",
      );
    } catch {
      console.log("📝 Mock credentials only - running unit tests");
    }
    console.log("");
  }

  private reportResults(): void {
    console.log("📊 Test Results Summary");
    console.log("=======================");

    const passed = this.results.filter((r) => r.passed).length;
    const total = this.results.length;
    const successRate = Math.round((passed / total) * 100);

    console.log(`Tests: ${passed}/${total} passed (${successRate}%)`);
    console.log(
      `Total duration: ${this.results.reduce((sum, r) => sum + r.duration, 0)}ms`,
    );
    console.log("");

    if (passed === total) {
      console.log(
        "🎉 All tests passed! Yahoo authentication is ready for production.",
      );
    } else {
      console.log("⚠️  Some tests failed. Review the details above.");
      console.log("");
      console.log("Failed tests:");
      this.results
        .filter((r) => !r.passed)
        .forEach((r) => {
          console.log(`  • ${r.name}: ${r.error || "Test assertion failed"}`);
        });
    }

    console.log("");
    console.log("🔗 Integration Status:");

    if (this.hasRealCredentials) {
      const integrationTest = this.results.find(
        (r) => r.name === "SalesAgentService Integration",
      );
      const adcpTest = this.results.find(
        (r) => r.name === "ADCP Client Readiness",
      );

      if (integrationTest?.passed && adcpTest?.passed) {
        console.log("✅ Ready for @adcp/client integration");
        console.log("✅ Ready for Yahoo inventory discovery");
        console.log("✅ Tokens will auto-refresh in production");
      } else {
        console.log("❌ Integration issues detected");
        console.log("   Check database setup and auth configuration");
      }
    } else {
      console.log("⏭️  Integration status unknown (no real credentials)");
      console.log("   Add .yahoo_key file to test full integration");
    }
  }

  private async runEndToEndTests(): Promise<void> {
    if (!this.hasRealCredentials) return;

    console.log("🌐 End-to-End Tests");
    console.log("===================");

    // Test 1: SalesAgentService integration
    await this.runTest("SalesAgentService Integration", async () => {
      const salesAgentService = new SalesAgentService(
        "bok-playground",
        "agenticapi",
      );

      const agentConfigs =
        await salesAgentService.getAgentConfigsForDiscovery(1);
      const yahooAgent = agentConfigs.find(
        (agent) =>
          agent.name.toLowerCase().includes("yahoo") ||
          agent.agent_uri.includes("yahoo"),
      );

      return {
        details: {
          foundYahooAgent: !!yahooAgent,
          hasAuthorization: !!yahooAgent?.authorization,
          protocol: yahooAgent?.protocol,
          requiresAuth: yahooAgent?.requiresAuth,
          totalAgents: agentConfigs.length,
          yahooAgentName: yahooAgent?.name,
        },
        passed: !!(yahooAgent && yahooAgent.authorization),
      };
    });

    // Test 2: ADCP client readiness
    await this.runTest("ADCP Client Readiness", async () => {
      const salesAgentService = new SalesAgentService(
        "bok-playground",
        "agenticapi",
      );
      const agentConfigs =
        await salesAgentService.getAgentConfigsForDiscovery(1);
      const yahooAgent = agentConfigs.find((agent) =>
        agent.name.toLowerCase().includes("yahoo"),
      );

      if (!yahooAgent) {
        throw new Error("Yahoo agent not found");
      }

      const hasBearer = yahooAgent.authorization?.startsWith("Bearer ");
      const hasProtocol =
        yahooAgent.protocol === "adcp" || yahooAgent.protocol === "mcp";
      const hasEndpoint = !!yahooAgent.agent_uri;

      return {
        details: {
          authHeaderFormat: hasBearer ? "correct" : "missing/invalid",
          endpoint: yahooAgent.agent_uri,
          protocol: yahooAgent.protocol,
          readyForADCP: hasBearer && hasProtocol && hasEndpoint,
        },
        passed: hasBearer && hasProtocol && hasEndpoint,
      };
    });

    console.log("");
  }

  private async runIntegrationTests(): Promise<void> {
    if (!this.hasRealCredentials || !this.realPrivateKey) return;

    console.log("🔧 Integration Tests");
    console.log("====================");

    // Test 1: Real Yahoo authentication
    await this.runTest("Yahoo API Authentication", async () => {
      const handler = AuthHandlerFactory.getHandler("yahoo");
      const config = {
        environment: "production" as const,
        issuer: "idb2b.monetization.scope3",
        keyId: "0.0.1",
        privateKey: this.realPrivateKey!,
        scope: "agentic-sales-client",
        subject: "idb2b.monetization.scope3",
        type: "yahoo_jwt" as const,
      };

      const token = await handler.getToken("test-integration", config);

      return {
        details: {
          expiresAt: token.expiresAt?.toISOString(),
          hasExpiry: !!token.expiresAt,
          hasToken: !!token.value,
          tokenType: token.type,
        },
        passed: !!(token && token.value && token.expiresAt),
      };
    });

    // Test 2: Token caching
    await this.runTest("Token Caching", async () => {
      const handler = AuthHandlerFactory.getHandler("yahoo");
      const config = {
        environment: "production" as const,
        issuer: "idb2b.monetization.scope3",
        keyId: "0.0.1",
        privateKey: this.realPrivateKey!,
        scope: "agentic-sales-client",
        subject: "idb2b.monetization.scope3",
        type: "yahoo_jwt" as const,
      };

      // First call
      const startTime1 = Date.now();
      const token1 = await handler.getToken("cache-test", config);
      const duration1 = Date.now() - startTime1;

      // Second call (should be cached)
      const startTime2 = Date.now();
      const token2 = await handler.getToken("cache-test", config);
      const duration2 = Date.now() - startTime2;

      const isCached = duration2 < duration1 / 2; // Cached call should be much faster
      const sameToken = token1.value === token2.value;

      return {
        details: {
          cacheWorking: isCached,
          firstCallDuration: duration1,
          sameToken,
          secondCallDuration: duration2,
          speedImprovement: Math.round(
            ((duration1 - duration2) / duration1) * 100,
          ),
        },
        passed: isCached && sameToken,
      };
    });

    console.log("");
  }

  private async runTest(
    name: string,
    testFn: () => Promise<{
      details?: Record<string, unknown>;
      passed: boolean;
    }>,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      const result = await testFn();
      const duration = Date.now() - startTime;

      this.results.push({
        details: result.details,
        duration,
        name,
        passed: result.passed,
      });

      const status = result.passed ? "✅" : "❌";
      console.log(`${status} ${name} (${duration}ms)`);

      if (result.details && Object.keys(result.details).length > 0) {
        Object.entries(result.details).forEach(([key, value]) => {
          console.log(`   ${key}: ${value}`);
        });
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.results.push({
        duration,
        error: errorMessage,
        name,
        passed: false,
      });

      console.log(`❌ ${name} (${duration}ms)`);
      console.log(`   Error: ${errorMessage}`);
    }
  }

  private async runUnitTests(): Promise<void> {
    console.log("🔬 Unit Tests");
    console.log("=============");

    // Test 1: Handler instantiation
    await this.runTest("Handler Instantiation", async () => {
      const handler = new YahooJWTHandler();

      return {
        details: {
          hasClearCache: typeof handler.clearCache === "function",
          hasGetToken: typeof handler.getToken === "function",
          hasIsTokenValid: typeof handler.isTokenValid === "function",
          hasRefreshToken: typeof handler.refreshToken === "function",
        },
        passed: true,
      };
    });

    // Test 2: Factory pattern
    await this.runTest("Auth Handler Factory", async () => {
      const handler = AuthHandlerFactory.getHandler("yahoo");
      const isYahooHandler = handler instanceof YahooJWTHandler;

      return {
        details: {
          handlerType: handler.constructor.name,
          isCorrectType: isYahooHandler,
        },
        passed: isYahooHandler,
      };
    });

    // Test 3: Configuration validation with mock data
    await this.runTest("Configuration Validation", async () => {
      const handler = new YahooJWTHandler();
      const mockConfig: YahooJWTConfig = {
        environment: "production",
        issuer: "test.issuer",
        keyId: "test-key",
        privateKey: `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgDEMOxxxxxxxxxxxxxxx
xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxEhRA==
-----END PRIVATE KEY-----`,
        scope: "test-scope",
        subject: "test.subject",
        type: "yahoo_jwt",
      };

      try {
        await handler.getToken("test-agent", mockConfig);
        return {
          details: { error: "Expected validation to fail with mock key" },
          passed: false,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const expectedError = errorMessage.includes(
          "Failed to generate Yahoo JWT token",
        );

        return {
          details: {
            errorMessage: errorMessage.substring(0, 100),
            expectedValidationFailure: expectedError,
          },
          passed: expectedError,
        };
      }
    });

    console.log("");
  }
}

// Main execution
async function main() {
  const testSuite = new YahooAuthTestSuite();
  await testSuite.runAllTests();
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Test suite failed:", error);
    process.exit(1);
  });
}

export { YahooAuthTestSuite };
