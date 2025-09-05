import { beforeEach, describe, expect, it, vi } from "vitest";

import { Scope3ApiClient } from "./scope3-client.js";

// Mock the Scope3ApiClient module
vi.mock("./scope3-client", () => {
  return {
    Scope3ApiClient: vi.fn().mockImplementation(() => ({
      getAgents: vi.fn(),
    })),
  };
});

type MockScope3ApiClient = {
  getAgents: ReturnType<typeof vi.fn>;
};

describe("MCP Server Integration", () => {
  let mockScope3Client: MockScope3ApiClient;
  let mockGetAgents: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAgents = vi.fn();
    mockScope3Client = {
      getAgents: mockGetAgents,
    };
    vi.mocked(Scope3ApiClient).mockImplementation(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => mockScope3Client as any,
    );
  });

  describe("Scope3ApiClient Integration", () => {
    it("should create client with correct GraphQL URL", () => {
      new Scope3ApiClient("https://api.scope3.com/api/graphql");
      expect(Scope3ApiClient).toHaveBeenCalledWith(
        "https://api.scope3.com/api/graphql",
      );
    });

    it("should handle successful agent retrieval", async () => {
      const mockAgents = [
        {
          description: "Test description",
          id: "1",
          models: [{ id: "model1", name: "Model 1" }],
          name: "Test Agent",
        },
      ];

      mockGetAgents.mockResolvedValueOnce(mockAgents);

      const client = new Scope3ApiClient();
      const result = await client.getAgents("test_api_key", {});

      expect(result).toEqual(mockAgents);
      expect(mockGetAgents).toHaveBeenCalledWith("test_api_key", {});
    });

    it("should handle authentication failures", async () => {
      mockGetAgents.mockRejectedValueOnce(new Error("Authentication failed"));

      const client = new Scope3ApiClient();

      await expect(client.getAgents("invalid_key")).rejects.toThrow(
        "Authentication failed",
      );
    });

    it("should handle service unavailable errors", async () => {
      mockGetAgents.mockRejectedValueOnce(
        new Error("External service temporarily unavailable"),
      );

      const client = new Scope3ApiClient();

      await expect(client.getAgents("test_key")).rejects.toThrow(
        "External service temporarily unavailable",
      );
    });

    it("should handle invalid request errors", async () => {
      mockGetAgents.mockRejectedValueOnce(
        new Error("Invalid request parameters or query"),
      );

      const client = new Scope3ApiClient();

      await expect(client.getAgents("test_key")).rejects.toThrow(
        "Invalid request parameters or query",
      );
    });

    it("should pass where clause correctly", async () => {
      const whereClause = { customerId: { equals: 1 } };
      const mockAgents = [{ id: "1", models: [], name: "Test Agent" }];

      mockGetAgents.mockResolvedValueOnce(mockAgents);

      const client = new Scope3ApiClient();
      await client.getAgents("test_key", whereClause);

      expect(mockGetAgents).toHaveBeenCalledWith("test_key", whereClause);
    });

    it("should use empty where clause by default", async () => {
      const mockAgents = [{ id: "1", models: [], name: "Test Agent" }];

      mockGetAgents.mockResolvedValueOnce(mockAgents);

      const client = new Scope3ApiClient();
      await client.getAgents("test_key");

      expect(mockGetAgents).toHaveBeenCalledWith("test_key");
    });
  });
});
