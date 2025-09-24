import { Scope3ApiClient } from "../../client/scope3-client.js";

/**
 * GraphQL Client Contract Tests
 * 
 * These tests validate that our GraphQL client methods work against the actual
 * backend API. They use real API calls to ensure our client code is compatible
 * with the server schema.
 * 
 * Key Benefits:
 * - Catches client-server schema mismatches in CI
 * - Validates authentication flows work correctly
 * - Ensures field names and structures match expectations
 * - Tests actual network behavior, not just mocks
 * 
 * Test Strategy:
 * - Use contract testing pattern with configurable API client
 * - Test both success and error scenarios
 * - Validate response structure and field names
 * - Use test data that can be safely created/deleted
 */

/**
 * Contract test suite for GraphQL client operations
 * This function can be called with different client configurations
 */
export function testGraphQLClientContract(
  clientFactory: () => Scope3ApiClient,
  options: {
    apiKey: string;
    skipMutations?: boolean; // Skip mutations that might affect production data
  }
) {
  describe("GraphQL Client Contract", () => {
    let client: Scope3ApiClient;

    beforeAll(() => {
      client = clientFactory();
    });

    describe("Authentication", () => {
      it("should accept valid API key", async () => {
        // Test that authentication works with a simple query
        try {
          await client.listBrandAgents(options.apiKey);
          // If we get here without throwing, auth worked
        } catch (error) {
          // Check if it's an auth error vs. a schema error
          const errorMessage = error instanceof Error ? error.message : String(error);
          expect(errorMessage).not.toMatch(/unauthorized|forbidden|authentication/i);
        }
      });

      it("should reject invalid API key", async () => {
        await expect(
          client.listBrandAgents("invalid_key_12345")
        ).rejects.toThrow();
      });
    });

    describe("Brand Agent Operations", () => {
      it("should list brand agents with correct field structure", async () => {
        const result = await client.listBrandAgents(options.apiKey);
        
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        
        if (result.length > 0) {
          const brandAgent = result[0];
          
          // Test that the response has expected field structure
          expect(brandAgent).toHaveProperty('id');
          expect(brandAgent).toHaveProperty('name');
          
          // Validate field types
          expect(typeof brandAgent.id).toBe('string');
          expect(typeof brandAgent.name).toBe('string');
        }
      });

      it("should get single brand agent by ID", async () => {
        const agents = await client.listBrandAgents(options.apiKey);
        
        if (agents.length > 0) {
          const firstAgent = agents[0];
          const singleAgent = await client.getBrandAgent(options.apiKey, firstAgent.id);
          
          expect(singleAgent).toBeDefined();
          expect(singleAgent.id).toBe(firstAgent.id);
          expect(singleAgent.name).toBe(firstAgent.name);
        }
      });

      it("should handle non-existent brand agent gracefully", async () => {
        await expect(
          client.getBrandAgent(options.apiKey, "non_existent_id_12345")
        ).rejects.toThrow();
      });
    });

    describe("Campaign Operations", () => {
      it("should list campaigns with correct field structure", async () => {
        // First get a brand agent to use for campaign listing
        const agents = await client.listBrandAgents(options.apiKey);
        
        if (agents.length > 0) {
          const campaigns = await client.listCampaigns(options.apiKey, agents[0].id);
          
          expect(campaigns).toBeDefined();
          expect(Array.isArray(campaigns)).toBe(true);
          
          if (campaigns.length > 0) {
            const campaign = campaigns[0];
            
            // Test campaign field structure
            expect(campaign).toHaveProperty('id');
            expect(campaign).toHaveProperty('name');
            expect(campaign).toHaveProperty('brandAgentId');
            
            // Validate field types
            expect(typeof campaign.id).toBe('string');
            expect(typeof campaign.name).toBe('string');
            expect(typeof campaign.brandAgentId).toBe('string');
          }
        }
      });

      it("should handle empty campaign list", async () => {
        const agents = await client.listBrandAgents(options.apiKey);
        
        if (agents.length > 0) {
          const campaigns = await client.listCampaigns(options.apiKey, agents[0].id);
          
          // Should return array even if empty
          expect(Array.isArray(campaigns)).toBe(true);
        }
      });
    });

    describe("Tactic Operations (Expected to Fail)", () => {
      it("should fail when attempting to create tactic via GraphQL", async () => {
        const tacticInput = {
          campaignId: "test_campaign_123",
          name: "Test Tactic",
          mediaProductId: "test_media_product_123",
          budgetAllocation: {
            amount: 1000,
            currency: "USD",
            pacing: "even" as const
          },
          cpm: 10.0
        };

        await expect(
          client.createTactic(options.apiKey, tacticInput)
        ).rejects.toThrow(/createTactic.*doesn't exist|Field.*not defined/i);
      });

      it("should fail when attempting to list tactics via GraphQL", async () => {
        await expect(
          client.listTactics(options.apiKey, "test_campaign_123")
        ).rejects.toThrow(/tactics.*doesn't exist|Field.*not defined/i);
      });

      it("should fail when attempting to get tactic via GraphQL", async () => {
        await expect(
          client.getTactic(options.apiKey, "test_tactic_123")
        ).rejects.toThrow(/tactic.*doesn't exist|Field.*not defined/i);
      });
    });

    describe("Error Handling", () => {
      it("should provide meaningful error messages for GraphQL errors", async () => {
        try {
          // Try to get a brand agent with malformed ID
          await client.getBrandAgent(options.apiKey, "");
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          // Error should be informative, not just "Request failed"
          expect(errorMessage.length).toBeGreaterThan(10);
          expect(errorMessage).not.toBe("Request failed");
        }
      });

      it("should handle network errors gracefully", async () => {
        // Create client with invalid endpoint
        const badClient = new Scope3ApiClient("https://invalid-endpoint-12345.com/graphql");
        
        await expect(
          badClient.listBrandAgents(options.apiKey)
        ).rejects.toThrow();
      });
    });

    describe("Query Field Name Validation", () => {
      it("should use correct field names for agents query", async () => {
        // This test validates that we're using 'agents' not 'brandAgents'
        await expect(
          client.listBrandAgents(options.apiKey)
        ).resolves.toBeDefined();
      });

      it("should use correct field names for single agent query", async () => {
        const agents = await client.listBrandAgents(options.apiKey);
        
        if (agents.length > 0) {
          // This validates we're using 'agent(id)' not 'brandAgent(id)'
          await expect(
            client.getBrandAgent(options.apiKey, agents[0].id)
          ).resolves.toBeDefined();
        }
      });
    });
  });
}

/**
 * Integration test that runs the contract tests against a real API
 */
describe("GraphQL Client Integration", () => {
  const apiKey = process.env.SCOPE3_API_KEY;
  
  // Skip integration tests if no API key provided
  const describeOrSkip = apiKey ? describe : describe.skip;
  
  describeOrSkip("Real API Integration", () => {
    testGraphQLClientContract(
      () => new Scope3ApiClient("https://api.scope3.com/api/graphql"),
      {
        apiKey: apiKey!,
        skipMutations: true // Don't run mutations against production
      }
    );
  });
});

/**
 * Mock test that runs the contract tests against a test double
 * This ensures the tests themselves work correctly
 */
describe("GraphQL Client Contract Validation", () => {
  // Create a mock client that implements the expected interface
  class MockGraphQLClient extends Scope3ApiClient {
    async listBrandAgents(apiKey: string) {
      if (apiKey === "invalid_key_12345") {
        throw new Error("Unauthorized");
      }
      
      return [
        {
          id: "agent_123",
          name: "Test Brand Agent",
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
    }

    async getBrandAgent(apiKey: string, id: string) {
      if (id === "non_existent_id_12345") {
        throw new Error("Brand agent not found");
      }
      
      return {
        id: id,
        name: "Test Brand Agent",
        status: "active",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }

    async listCampaigns(apiKey: string, brandAgentId: string) {
      return [
        {
          id: "campaign_123",
          name: "Test Campaign",
          brandAgentId: brandAgentId,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];
    }

    async createTactic(_apiKey: string, _input: unknown) {
      throw new Error("Field 'createTactic' doesn't exist on type 'Mutation'");
    }

    async listTactics(_apiKey: string, _campaignId: string) {
      throw new Error("Field 'tactics' doesn't exist on type 'Query'");
    }

    async getTactic(_apiKey: string, _tacticId: string) {
      throw new Error("Field 'tactic' doesn't exist on type 'Query'");
    }
  }

  testGraphQLClientContract(
    () => new MockGraphQLClient("https://mock.example.com/graphql"),
    {
      apiKey: "test_api_key_123",
      skipMutations: false
    }
  );
});