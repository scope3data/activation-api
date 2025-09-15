import { http, HttpResponse } from "msw";
import { createGraphQLResponse, testConfig } from "./test-setup.js";
import { brandAgentFixtures } from "../fixtures/brand-agent-fixtures.js";

/**
 * Simplified GraphQL mock handlers for MSW v2
 * Provides basic GraphQL API responses for testing
 */

export const graphqlMockHandlers = {
  // Successful operations
  success: [
    http.post(testConfig.graphqlUrl, async ({ request }) => {
      // Return a generic successful response for any GraphQL operation
      return HttpResponse.json(
        createGraphQLResponse({
          // List operations
          brandAgents: [
            brandAgentFixtures.graphqlBrandAgent(),
            {
              ...brandAgentFixtures.graphqlBrandAgent(),
              id: "ba_graphql_456",
              name: "Second GraphQL Brand",
            },
          ],
          agents: [
            brandAgentFixtures.graphqlBrandAgent(),
            {
              ...brandAgentFixtures.graphqlBrandAgent(),
              id: "ba_graphql_456",
              name: "Second GraphQL Brand",
            },
          ],
          // Single operations
          brandAgent: brandAgentFixtures.graphqlBrandAgent(),
          agent: brandAgentFixtures.graphqlBrandAgent(),
          // Mutations
          createBrandAgent: {
            ...brandAgentFixtures.graphqlBrandAgent(),
            id: "ba_created_123",
          },
          updateBrandAgent: brandAgentFixtures.graphqlBrandAgent(),
        }),
      );
    }),
  ],

  // Error scenarios
  errors: {
    // GraphQL errors in response
    graphqlError: http.post(testConfig.graphqlUrl, () => {
      return HttpResponse.json(
        createGraphQLResponse(null, [
          { message: "Invalid request parameters or query" },
        ]),
      );
    }),

    // Authentication failure
    authError: http.post(testConfig.graphqlUrl, () => {
      return new HttpResponse(
        JSON.stringify({ message: "Authentication failed" }),
        {
          status: 401,
        },
      );
    }),

    // Server error
    serverError: http.post(testConfig.graphqlUrl, () => {
      return new HttpResponse(
        JSON.stringify({ message: "Internal server error" }),
        {
          status: 500,
        },
      );
    }),
  },
};

/**
 * Utility functions for setting up specific test scenarios
 */
export const setupGraphQLMocks = {
  // Setup successful operations - return the array directly
  success: graphqlMockHandlers.success,

  // Setup specific error scenario
  withError: (errorType: keyof typeof graphqlMockHandlers.errors) => [
    graphqlMockHandlers.errors[errorType],
  ],

  // Setup delayed response for timeout testing
  withDelay: (delayMs: number) => [
    http.post(testConfig.graphqlUrl, async () => {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return HttpResponse.json(
        createGraphQLResponse({
          agents: [brandAgentFixtures.graphqlBrandAgent()],
        }),
      );
    }),
  ],
};
