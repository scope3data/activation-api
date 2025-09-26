/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  expectErrorResponse,
  expectListResponse,
} from "../../__tests__/utils/structured-response-helpers.js";
import { Scope3ApiClient } from "../../client/scope3-client.js";
import { CustomSignalsClient } from "../../services/custom-signals-client.js";
import { getPartnerSeatsTool } from "./get-partner-seats.js";

// Mock the dependencies
vi.mock("../../client/scope3-client.js", () => ({
  Scope3ApiClient: vi.fn(),
}));

vi.mock("../../services/custom-signals-client.js", () => ({
  CustomSignalsClient: vi.fn().mockImplementation(() => ({
    getPartnerSeats: vi.fn(),
  })),
}));

describe("signals/get-partner-seats", () => {
  let mockScope3Client: Scope3ApiClient;
  let mockCustomSignalsClient: {
    getPartnerSeats: ReturnType<typeof vi.fn>;
  };
  let tool: ReturnType<typeof getPartnerSeatsTool>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockScope3Client = {
      listBrandAgents: vi.fn(),
    } as unknown as Scope3ApiClient;

    mockCustomSignalsClient = {
      getPartnerSeats: vi.fn(),
    };
    vi.mocked(CustomSignalsClient).mockImplementation(
      () =>
        mockCustomSignalsClient as Partial<CustomSignalsClient> as CustomSignalsClient,
    );

    tool = getPartnerSeatsTool(mockScope3Client);
  });

  it("should return partner seats on successful request", async () => {
    const mockSeats = [
      {
        customerId: 123,
        id: "seat_1",
        name: "Test Seat 1",
      },
      {
        customerId: 456,
        id: "seat_2",
        name: "Test Seat 2",
      },
    ];

    mockCustomSignalsClient.getPartnerSeats.mockResolvedValueOnce(mockSeats);

    const result = await tool.execute(
      {},
      {
        session: { customerId: 123, scope3ApiKey: "test_api_key" },
      },
    );

    // Validate structured response
    const parsedResponse = expectListResponse(
      result,
      2,
      (seat: Record<string, unknown>) => {
        expect(seat).toHaveProperty("id");
        expect(seat).toHaveProperty("name");
        expect(seat).toHaveProperty("customerId");
        expect(typeof seat.id).toBe("string");
        expect(typeof seat.name).toBe("string");
        expect(typeof seat.customerId).toBe("number");
      },
    );

    expect((parsedResponse.data! as any).seats).toHaveLength(2);
    expect((parsedResponse.data! as any).count).toBe(2);

    // Verify message content
    expect(result).toContain("Found 2 accessible brand agent seats");
    expect(result).toContain("Test Seat 1");
    expect(result).toContain("seat_1");
    expect(result).toContain("Customer ID: 123");
    expect(result).toContain("Test Seat 2");
    expect(result).toContain("seat_2");
    expect(result).toContain("Customer ID: 456");

    expect(mockCustomSignalsClient.getPartnerSeats).toHaveBeenCalledWith(
      mockScope3Client,
      "test_api_key",
    );
  });

  it("should handle missing API key", async () => {
    await expect(tool.execute({}, {})).rejects.toThrow(
      "Authentication required. Please provide valid API key in headers (x-scope3-api-key or Authorization: Bearer).",
    );
    expect(mockCustomSignalsClient.getPartnerSeats).not.toHaveBeenCalled();
  });

  it("should handle empty seats response", async () => {
    mockCustomSignalsClient.getPartnerSeats.mockResolvedValueOnce([]);

    const result = await tool.execute(
      {},
      {
        session: { customerId: 123, scope3ApiKey: "test_api_key" },
      },
    );

    const parsedResponse = expectListResponse(result, 0);
    expect((parsedResponse.data! as any).seats).toHaveLength(0);
    expect((parsedResponse.data! as any).count).toBe(0);

    expect(result).toContain("Found 0 accessible brand agent seats");
    expect(result).toContain("No brand agent seats are accessible");
  });

  it("should handle API errors", async () => {
    mockCustomSignalsClient.getPartnerSeats.mockRejectedValueOnce(
      new Error("External service temporarily unavailable"),
    );

    const result = await tool.execute(
      {},
      {
        session: { customerId: 123, scope3ApiKey: "test_api_key" },
      },
    );

    expectErrorResponse(result, "Failed to get partner seats");
    expect(result).toContain("Service temporarily unavailable");
  });

  it("should use session API key when provided", async () => {
    mockCustomSignalsClient.getPartnerSeats.mockResolvedValueOnce([]);

    const result = await tool.execute(
      {},
      {
        session: { customerId: 123, scope3ApiKey: "session_api_key" },
      },
    );

    expectListResponse(result, 0);

    expect(mockCustomSignalsClient.getPartnerSeats).toHaveBeenCalledWith(
      mockScope3Client,
      "session_api_key",
    );
  });
});
