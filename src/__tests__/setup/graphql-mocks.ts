import { http, HttpResponse } from "msw";

import {
  brandAgentErrors,
  brandAgentFixtures,
} from "../fixtures/brand-agent-fixtures.js";
import { createGraphQLResponse, testConfig } from "./test-setup.js";

/**
 * GraphQL mock handlers for MSW
 * Provides realistic GraphQL API responses for testing
 */

// Helper to extract GraphQL operation name from request
function getOperationName(body: string): null | string {
  try {
    const parsed = JSON.parse(body);
    const query = parsed.query as string;
    const match = query.match(/(?:query|mutation)\s+(\w+)/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Helper to extract variables from GraphQL request
function getVariables(body: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(body);
    return parsed.variables || {};
  } catch {
    return {};
  }
}

export const graphqlMockHandlers = {
  // Error scenarios
  errors: {
    // Authentication failure
    authError: rest.post(testConfig.graphqlUrl, (req, res, ctx) => {
      return res(
        ctx.status(401),
        ctx.json({ message: "Authentication failed" }),
      );
    }),

    // GraphQL errors in response
    graphqlError: rest.post(testConfig.graphqlUrl, (req, res, ctx) => {
      return res(
        ctx.json(createGraphQLResponse(null, [brandAgentErrors.graphqlError])),
      );
    }),

    // Malformed response
    malformedResponse: rest.post(testConfig.graphqlUrl, (req, res, ctx) => {
      return res(ctx.text("Invalid JSON response"));
    }),

    // Network timeout simulation
    networkTimeout: rest.post(testConfig.graphqlUrl, (req, res, ctx) => {
      return res(ctx.delay("infinite"));
    }),

    // Rate limiting
    rateLimitError: rest.post(testConfig.graphqlUrl, (req, res, ctx) => {
      return res(ctx.status(429), ctx.json({ message: "Rate limit exceeded" }));
    }),

    // Server error
    serverError: rest.post(testConfig.graphqlUrl, (req, res, ctx) => {
      return res(
        ctx.status(500),
        ctx.json({ message: "Internal server error" }),
      );
    }),
  },

  // Specific operation mocks
  operations: {
    // Empty results
    emptyResults: rest.post(testConfig.graphqlUrl, (req, res, ctx) => {
      return res(
        ctx.json(
          createGraphQLResponse({
            agents: [],
          }),
        ),
      );
    }),

    // Get brand agent by ID
    getBrandAgent: (
      agentId: string,
      agent?: Partial<typeof brandAgentFixtures.graphqlBrandAgent>,
    ) =>
      rest.post(testConfig.graphqlUrl, async (req, res, ctx) => {
        const body = await req.text();
        if (body.includes("GetBrandAgent") && body.includes(agentId)) {
          return res(
            ctx.json(
              createGraphQLResponse({
                agent: {
                  ...brandAgentFixtures.graphqlBrandAgent(),
                  id: agentId,
                  ...agent,
                },
              }),
            ),
          );
        }
        return req.passthrough();
      }),

    // Large result set for performance testing
    largeResultSet: rest.post(testConfig.graphqlUrl, (req, res, ctx) => {
      const largeAgentList = Array.from({ length: 100 }, (_, index) => ({
        ...brandAgentFixtures.graphqlBrandAgent(),
        id: `ba_perf_${index}`,
        name: `Performance Test Brand ${index}`,
      }));

      return res(
        ctx.json(
          createGraphQLResponse({
            agents: largeAgentList,
          }),
        ),
      );
    }),
  },

  // Successful operations
  success: [
    // Default successful handler
    http.post(testConfig.graphqlUrl, async ({ request }) => {
      const body = await request.text();

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
          createBrandAgent: {
            ...brandAgentFixtures.graphqlBrandAgent(),
            id: "ba_created_123",
          },
          updateBrandAgent: brandAgentFixtures.graphqlBrandAgent(),
        }),
      );
    }),

    // List brand agents
    http.post(testConfig.graphqlUrl, async ({ request }) => {
      const body = await request.text();
      const operation = getOperationName(body);

      if (operation === "GetBrandAgents" || body.includes("agents(")) {
        return HttpResponse.json(
          createGraphQLResponse({
            agents: [
              brandAgentFixtures.graphqlBrandAgent(),
              {
                ...brandAgentFixtures.graphqlBrandAgent(),
                id: "ba_graphql_456",
                name: "Second GraphQL Brand",
              },
            ],
          }),
        );
      }

      return HttpResponse.passthrough();
    }),

    // Create brand agent
    rest.post(testConfig.graphqlUrl, async (req, res, ctx) => {
      const body = await req.text();
      const operation = getOperationName(body);

      if (operation === "CreateBrandAgent") {
        const variables = getVariables(body);
        const input = variables.input as Record<string, unknown>;

        return res(
          ctx.json(
            createGraphQLResponse({
              createBrandAgent: {
                ...brandAgentFixtures.graphqlBrandAgent(),
                customerId: input.customerId,
                id: "ba_created_123",
                name: input.name,
              },
            }),
          ),
        );
      }

      return req.passthrough();
    }),

    // Update brand agent
    rest.post(testConfig.graphqlUrl, async (req, res, ctx) => {
      const body = await req.text();
      const operation = getOperationName(body);

      if (operation === "UpdateBrandAgent") {
        const variables = getVariables(body);
        const input = variables.input as Record<string, unknown>;

        return res(
          ctx.json(
            createGraphQLResponse({
              updateBrandAgent: {
                ...brandAgentFixtures.graphqlBrandAgent(),
                name: input.name || brandAgentFixtures.graphqlBrandAgent().name,
                updatedAt: new Date().toISOString(),
              },
            }),
          ),
        );
      }

      return req.passthrough();
    }),
  ],
};

/**
 * Utility functions for setting up specific test scenarios
 */
export const setupGraphQLMocks = {
  // Setup successful operations
  success: () => graphqlMockHandlers.success,

  // Setup delayed response for timeout testing
  withDelay: (delayMs: number) => [
    rest.post(testConfig.graphqlUrl, (req, res, ctx) => {
      return res(
        ctx.delay(delayMs),
        ctx.json(
          createGraphQLResponse({
            agents: [brandAgentFixtures.graphqlBrandAgent()],
          }),
        ),
      );
    }),
  ],

  // Setup specific error scenario
  withError: (errorType: keyof typeof graphqlMockHandlers.errors) => [
    graphqlMockHandlers.errors[errorType],
  ],

  // Setup custom operation response
  withOperation: (operationName: string, response: unknown) => [
    rest.post(testConfig.graphqlUrl, async (req, res, ctx) => {
      const body = await req.text();
      const operation = getOperationName(body);

      if (operation === operationName) {
        return res(ctx.json(createGraphQLResponse(response)));
      }

      return req.passthrough();
    }),
  ],
};
