import { beforeEach, describe, expect, it, vi } from "vitest";

import { Scope3ApiClient } from "./scope3-client.js";

// Mock the global fetch function
global.fetch = vi.fn();

describe("Scope3ApiClient", () => {
  let client: Scope3ApiClient;
  const mockFetch = vi.mocked(fetch);
  const validApiKey = "scope3_test_key_123";

  beforeEach(() => {
    client = new Scope3ApiClient("https://api.scope3.com/api/graphql");
    mockFetch.mockReset();
  });

  describe("getAgents", () => {
    it("should return agents on successful request", async () => {
      const mockAgents = [
        {
          description: "Test description",
          id: "1",
          models: [
            { description: "Model description", id: "model1", name: "Model 1" },
          ],
          name: "Test Agent 1",
        },
      ];

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          data: { agents: mockAgents },
        }),
        ok: true,
      } as Response);

      const result = await client.getAgents(validApiKey);

      expect(result).toEqual(mockAgents);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.scope3.com/api/graphql",
        expect.objectContaining({
          body: expect.stringContaining("agents"),
          headers: {
            Authorization: `Bearer ${validApiKey}`,
            "Content-Type": "application/json",
            "User-Agent": "MCP-Server/1.0",
          },
          method: "POST",
        }),
      );
    });

    it("should throw authentication error for 401 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      await expect(client.getAgents(validApiKey)).rejects.toThrow(
        "Authentication failed",
      );
    });

    it("should throw authentication error for 403 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
      } as Response);

      await expect(client.getAgents(validApiKey)).rejects.toThrow(
        "Authentication failed",
      );
    });

    it("should throw service unavailable error for 500 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(client.getAgents(validApiKey)).rejects.toThrow(
        "External service temporarily unavailable",
      );
    });

    it("should throw request failed error for other 4xx responses", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
      } as Response);

      await expect(client.getAgents(validApiKey)).rejects.toThrow(
        "Request failed",
      );
    });

    it("should throw error for GraphQL errors in response", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          errors: [{ message: "Invalid query" }],
        }),
        ok: true,
      } as Response);

      await expect(client.getAgents(validApiKey)).rejects.toThrow(
        "Invalid request parameters or query",
      );
    });

    it("should throw error when no data is returned", async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          data: null,
        }),
        ok: true,
      } as Response);

      await expect(client.getAgents(validApiKey)).rejects.toThrow(
        "No data received",
      );
    });

    it("should pass where clause in GraphQL query", async () => {
      const whereClause = { customerId: { equals: 1 } };
      const mockAgents = [{ id: "1", models: [], name: "Test Agent" }];

      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          data: { agents: mockAgents },
        }),
        ok: true,
      } as Response);

      await client.getAgents(validApiKey, whereClause);

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.variables.where).toEqual(whereClause);
    });
  });
});
