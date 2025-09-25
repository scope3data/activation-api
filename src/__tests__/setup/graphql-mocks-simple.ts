/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { http, HttpResponse } from "msw";

import { brandAgentFixtures } from "../fixtures/brand-agent-fixtures.js";
import { createGraphQLResponse, testConfig } from "./test-setup.js";

/**
 * Simplified GraphQL mock handlers for MSW v2
 * Provides basic GraphQL API responses for testing
 */

export const graphqlMockHandlers = {
  // Error scenarios
  errors: {
    // Authentication failure
    authError: http.post(testConfig.graphqlUrl, () => {
      return new HttpResponse(
        JSON.stringify({ message: "Authentication failed" }),
        {
          status: 401,
        },
      );
    }),

    // GraphQL errors in response
    graphqlError: http.post(testConfig.graphqlUrl, () => {
      return HttpResponse.json(
        createGraphQLResponse(null, [
          { message: "Invalid request parameters or query" },
        ]),
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

  // Successful operations
  success: [
    http.post(testConfig.graphqlUrl, async () => {
      // Return a generic successful response for any GraphQL operation
      return HttpResponse.json(
        createGraphQLResponse({
          agent: brandAgentFixtures.graphqlBrandAgent(),
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
          // List operations
          brandAgents: [
            brandAgentFixtures.graphqlBrandAgent(),
            {
              ...brandAgentFixtures.graphqlBrandAgent(),
              id: "ba_graphql_456",
              name: "Second GraphQL Brand",
            },
          ],
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
};

/**
 * Utility functions for setting up specific test scenarios
 */
export const setupGraphQLMocks = {
  // Setup successful operations - return the array directly
  success: graphqlMockHandlers.success,

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

  // Setup specific error scenario
  withError: (errorType: keyof typeof graphqlMockHandlers.errors) => [
    graphqlMockHandlers.errors[errorType],
  ],
};
