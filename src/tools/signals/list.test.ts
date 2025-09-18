/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  expectErrorResponse,
  SignalValidators,
} from "../../__tests__/utils/structured-response-helpers.js";
import { Scope3ApiClient } from "../../client/scope3-client.js";
import { CustomSignalsClient } from "../../services/custom-signals-client.js";
import { listCustomSignalsTool } from "./list.js";

// Mock the dependencies
vi.mock("../../client/scope3-client.js", () => ({
  Scope3ApiClient: vi.fn(),
}));

vi.mock("../../services/custom-signals-client.js", () => ({
  CustomSignalsClient: vi.fn().mockImplementation(() => ({
    listCustomSignalsWithSeatFilter: vi.fn(),
  })),
}));

describe("signals/list", () => {
  let mockScope3Client: {
    listCustomSignals: ReturnType<typeof vi.fn>;
  };
  let mockCustomSignalsClient: {
    listCustomSignalsWithSeatFilter: ReturnType<typeof vi.fn>;
  };
  let tool: ReturnType<typeof listCustomSignalsTool>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockScope3Client = {
      listCustomSignals: vi.fn(),
    };

    mockCustomSignalsClient = {
      listCustomSignalsWithSeatFilter: vi.fn(),
    };
    vi.mocked(CustomSignalsClient).mockImplementation(
      () =>
        mockCustomSignalsClient as Partial<CustomSignalsClient> as CustomSignalsClient,
    );

    tool = listCustomSignalsTool(
      mockScope3Client as Partial<Scope3ApiClient> as Scope3ApiClient,
    );
  });

  it("should list signals successfully without filters", async () => {
    const mockSignals = [
      {
        clusters: [{ channel: "web", gdpr: false, region: "us-east-1" }],
        createdAt: "2024-01-01T00:00:00Z",
        description: "Test signal description",
        id: "signal_123",
        key: "maid",
        name: "Test Signal",
        updatedAt: "2024-01-02T00:00:00Z",
      },
    ];

    mockScope3Client.listCustomSignals.mockResolvedValueOnce({
      signals: mockSignals,
      total: 1,
    });

    const result = await tool.execute(
      {},
      {
        session: { scope3ApiKey: "test_api_key" },
      },
    );

    // Validate structured response
    const parsedResponse = SignalValidators.validateListResponse(result, 1);
    expect((parsedResponse.data! as any).signals).toHaveLength(1);
    expect((parsedResponse.data! as any).count).toBe(1);
    expect((parsedResponse.data! as any).filters).toEqual({
      channel: undefined,
      region: undefined,
      seatId: undefined,
    });
    expect((parsedResponse.data! as any).statistics).toHaveProperty(
      "totalRegions",
    );
    expect((parsedResponse.data! as any).statistics).toHaveProperty(
      "compositeSignals",
    );

    // Verify message content
    expect(result).toContain("Custom Signals Overview");
    expect(result).toContain("**Total Signals:** 1");
    expect(result).toContain("Test Signal");
    expect(result).toContain("signal_123");
    expect(result).toContain("maid");
    expect(result).toContain("Test signal description");
    expect(result).toContain("Single Keys");

    expect(mockScope3Client.listCustomSignals).toHaveBeenCalledWith(
      "test_api_key",
      {
        channel: undefined,
        region: undefined,
      },
    );
  });

  it("should list signals with region and channel filters", async () => {
    const mockSignals = [
      {
        clusters: [{ channel: "ctv", gdpr: true, region: "eu-west-1" }],
        createdAt: "2024-01-01T00:00:00Z",
        description: "EU CTV signal",
        id: "signal_456",
        key: "rampid",
        name: "EU CTV Signal",
        updatedAt: "2024-01-02T00:00:00Z",
      },
    ];

    mockScope3Client.listCustomSignals.mockResolvedValueOnce({
      signals: mockSignals,
      total: 1,
    });

    const result = await tool.execute(
      {
        channel: "ctv",
        region: "eu-west-1",
      },
      {
        session: { scope3ApiKey: "test_api_key" },
      },
    );

    expect(result).toContain("Applied Filters");
    expect(result).toContain("**Region:** eu-west-1");
    expect(result).toContain("**Channel:** ctv");
    expect(result).toContain("**GDPR Compliant:** 1 cluster(s)");

    expect(mockScope3Client.listCustomSignals).toHaveBeenCalledWith(
      "test_api_key",
      {
        channel: "ctv",
        region: "eu-west-1",
      },
    );
  });

  it("should use seat filtering when seatId is provided", async () => {
    const mockSeatResult = {
      signals: [
        {
          clusters: [{ channel: "web", gdpr: false, region: "americas" }],
          createdAt: "2024-01-01T00:00:00Z",
          description: "Seat-specific signal",
          id: "signal_789",
          key: "postal_code,domain",
          name: "Seat Signal",
          seatId: "seat_123",
          seatName: "Test Brand Agent",
          updatedAt: "2024-01-02T00:00:00Z",
        },
      ],
      total: 1,
    };

    mockCustomSignalsClient.listCustomSignalsWithSeatFilter.mockResolvedValueOnce(
      mockSeatResult,
    );

    const result = await tool.execute(
      {
        region: "americas",
        seatId: "seat_123",
      },
      {
        session: { scope3ApiKey: "test_api_key" },
      },
    );

    expect(result).toContain("**Seat:** seat_123");
    expect(result).toContain("**Seat:** Test Brand Agent (seat_123)");
    expect(result).toContain("Composite Keys");
    expect(result).toContain("postal_code,domain");

    expect(
      mockCustomSignalsClient.listCustomSignalsWithSeatFilter,
    ).toHaveBeenCalledWith(mockScope3Client, "test_api_key", {
      channel: undefined,
      region: "americas",
      seatId: "seat_123",
    });
  });

  it("should handle empty results with helpful message", async () => {
    mockScope3Client.listCustomSignals.mockResolvedValueOnce({
      signals: [],
      total: 0,
    });

    const result = await tool.execute(
      {
        region: "eu-west-1",
      },
      {
        session: { scope3ApiKey: "test_api_key" },
      },
    );

    // Validate structured response
    const parsedResponse = SignalValidators.validateListResponse(result, 0);
    expect((parsedResponse.data! as any).count).toBe(0);
    expect((parsedResponse.data! as any).filters.region).toBe("eu-west-1");
    expect((parsedResponse.data! as any).statistics.totalRegions).toBe(0);

    expect(result).toContain("No Custom Signals Found");
    expect(result).toContain("Applied Filters");
    expect(result).toContain("**Region:** eu-west-1");
    expect(result).toContain("create_custom_signal");
    expect(result).toContain("Try removing filters");
  });

  it("should display platform statistics", async () => {
    const mockSignals = [
      {
        clusters: [
          { channel: "web", gdpr: false, region: "us-east-1" },
          { channel: "ctv", gdpr: true, region: "eu-west-1" },
        ],
        createdAt: "2024-01-01T00:00:00Z",
        description: "Multi-region signal",
        id: "signal_multi",
        key: "maid",
        name: "Multi Signal",
        updatedAt: "2024-01-02T00:00:00Z",
      },
      {
        clusters: [{ channel: "mobile", gdpr: false, region: "apac-ex-china" }],
        createdAt: "2024-01-01T00:00:00Z",
        description: "Composite signal",
        id: "signal_composite",
        key: "postal_code,domain",
        name: "Composite Signal",
        updatedAt: "2024-01-02T00:00:00Z",
      },
    ];

    mockScope3Client.listCustomSignals.mockResolvedValueOnce({
      signals: mockSignals,
      total: 2,
    });

    const result = await tool.execute(
      {},
      {
        session: { scope3ApiKey: "test_api_key" },
      },
    );

    expect(result).toContain("Platform Statistics");
    expect(result).toContain("**Active Regions:** 3");
    expect(result).toContain("**Channel Configurations:** 3");
    expect(result).toContain("**GDPR Compliant Signals:** 1");
    expect(result).toContain("**Composite Key Signals:** 1");
    expect(result).toContain("**Single Key Signals:** 1");
  });

  it("should handle missing API key", async () => {
    // Ensure no environment variable is set
    const originalApiKey = process.env.SCOPE3_API_KEY;
    delete process.env.SCOPE3_API_KEY;

    try {
      const result = await tool.execute({}, {});

      expectErrorResponse(result, "Authentication required");
      expect(result).toContain("AUTHENTICATION_FAILED");
      expect(mockScope3Client.listCustomSignals).not.toHaveBeenCalled();
    } finally {
      // Restore original value
      if (originalApiKey) {
        process.env.SCOPE3_API_KEY = originalApiKey;
      }
    }
  });

  it("should handle API errors", async () => {
    mockScope3Client.listCustomSignals.mockRejectedValueOnce(
      new Error("External service temporarily unavailable"),
    );

    const result = await tool.execute(
      {},
      {
        session: { scope3ApiKey: "test_api_key" },
      },
    );

    expectErrorResponse(result, "Failed to list custom signals");
    expect(result).toContain("SERVICE_UNAVAILABLE");
  });

  it("should use environment variable when no session API key", async () => {
    const originalEnv = process.env.SCOPE3_API_KEY;
    process.env.SCOPE3_API_KEY = "env_api_key";

    mockScope3Client.listCustomSignals.mockResolvedValueOnce({
      signals: [],
      total: 0,
    });

    try {
      const result = await tool.execute({}, {});

      SignalValidators.validateListResponse(result, 0);

      expect(mockScope3Client.listCustomSignals).toHaveBeenCalledWith(
        "env_api_key",
        {
          channel: undefined,
          region: undefined,
        },
      );
    } finally {
      process.env.SCOPE3_API_KEY = originalEnv;
    }
  });
});
