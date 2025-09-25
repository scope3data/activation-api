/**
 * Tool-Level Tests: get_prebid_segments
 *
 * Tests the complete MCP tool execution including validation,
 * authentication, service interaction, and response formatting.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PrebidSegment } from "../../services/tactic-bigquery-service.js";
import type { MCPToolExecuteContext } from "../../types/mcp.js";

import { getPrebidSegmentsTool } from "./get-segments.js";

// Mock the TacticBigQueryService
vi.mock("../../services/tactic-bigquery-service.js", () => ({
  TacticBigQueryService: vi.fn().mockImplementation(() => ({
    getPrebidSegments: vi.fn(),
  })),
}));

import { TacticBigQueryService } from "../../services/tactic-bigquery-service.js";

const MockedTacticBigQueryService =
  TacticBigQueryService as unknown as vi.MockedClass<
    typeof TacticBigQueryService
  >;

describe("get_prebid_segments Tool", () => {
  let mockService: {
    getPrebidSegments: vi.MockedFunction<
      (orgId: string) => Promise<PrebidSegment[]>
    >;
  };
  let mockContext: MCPToolExecuteContext;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = new MockedTacticBigQueryService();
    MockedTacticBigQueryService.mockImplementation(() => mockService);

    mockContext = {
      server: {} as any,
    };
  });

  describe("Input Validation", () => {
    it("should validate required orgId parameter", async () => {
      const tool = getPrebidSegmentsTool();

      await expect(tool.execute({}, mockContext)).rejects.toThrow(
        /validation error.*required/i,
      );

      await expect(tool.execute({ orgId: "" }, mockContext)).rejects.toThrow(
        /organization id is required/i,
      );
    });

    it("should accept valid orgId", async () => {
      mockService.getPrebidSegments.mockResolvedValue([]);
      const tool = getPrebidSegmentsTool();

      const result = await tool.execute(
        { orgId: "valid_org_123" },
        mockContext,
      );

      expect(result).toContain(
        "No active campaigns targeting publisher org valid_org_123",
      );
      expect(mockService.getPrebidSegments).toHaveBeenCalledWith(
        "valid_org_123",
      );
    });
  });

  describe("Service Integration", () => {
    it("should handle empty segment results", async () => {
      mockService.getPrebidSegments.mockResolvedValue([]);
      const tool = getPrebidSegmentsTool();

      const result = await tool.execute({ orgId: "empty_org" }, mockContext);

      expect(result).toContain(
        "No active campaigns targeting publisher org empty_org",
      );
      expect(result).toContain('"totalSegments":0');
    });

    it("should handle successful segment retrieval", async () => {
      const mockSegments: PrebidSegment[] = [
        { axe_include_segment: "axe_high_value_123", max_cpm: 15.75 },
        { axe_include_segment: "axe_medium_value_456", max_cpm: 8.25 },
        { axe_include_segment: "axe_low_value_789", max_cpm: 4.5 },
      ];

      mockService.getPrebidSegments.mockResolvedValue(mockSegments);
      const tool = getPrebidSegmentsTool();

      const result = await tool.execute({ orgId: "active_org" }, mockContext);

      expect(result).toContain("🎯 **AXE Segments for Publisher active_org**");
      expect(result).toContain(
        "Found **3** active campaign targeting segments",
      );

      // Check segment details
      expect(result).toContain("axe_high_value_123");
      expect(result).toContain("Max CPM: $15.75");
      expect(result).toContain("Priority: Highest");

      expect(result).toContain("axe_medium_value_456");
      expect(result).toContain("Max CPM: $8.25");
      expect(result).toContain("Priority: High");

      expect(result).toContain("axe_low_value_789");
      expect(result).toContain("Max CPM: $4.50");
      expect(result).toContain("Priority: High"); // With 3 segments, all but the first get "High"

      // Check structured data
      expect(result).toContain('"totalSegments":3');
      expect(result).toContain('"segment":"axe_high_value_123"');
      expect(result).toContain('"maxCpm":15.75');

      // Check integration notes
      expect(result).toContain("### Integration Notes");
      expect(result).toContain(
        "Pass these segments to your ad server as **inclusion targeting**",
      );
      expect(result).toContain(
        "Higher CPM segments should get priority in auction logic",
      );
    });

    it("should handle service errors gracefully", async () => {
      const serviceError = new Error("BigQuery connection failed");
      mockService.getPrebidSegments.mockRejectedValue(serviceError);
      const tool = getPrebidSegmentsTool();

      await expect(
        tool.execute({ orgId: "error_org" }, mockContext),
      ).rejects.toThrow(
        "Failed to get prebid segments: BigQuery connection failed",
      );
    });

    it("should handle non-Error service rejections", async () => {
      mockService.getPrebidSegments.mockRejectedValue("String error");
      const tool = getPrebidSegmentsTool();

      await expect(
        tool.execute({ orgId: "string_error_org" }, mockContext),
      ).rejects.toThrow("Failed to get prebid segments: String error");
    });
  });

  describe("Response Formatting", () => {
    it("should format single segment correctly", async () => {
      const mockSegments: PrebidSegment[] = [
        { axe_include_segment: "axe_single_segment", max_cpm: 12.34 },
      ];

      mockService.getPrebidSegments.mockResolvedValue(mockSegments);
      const tool = getPrebidSegmentsTool();

      const result = await tool.execute({ orgId: "single_org" }, mockContext);

      expect(result).toContain(
        "Found **1** active campaign targeting segments",
      );
      expect(result).toContain("1. **axe_single_segment**");
      expect(result).toContain("Max CPM: $12.34");
      expect(result).toContain("Priority: Highest");
    });

    it("should prioritize segments correctly", async () => {
      const mockSegments: PrebidSegment[] = [
        { axe_include_segment: "axe_segment_1", max_cpm: 20.0 }, // Highest
        { axe_include_segment: "axe_segment_2", max_cpm: 15.0 }, // High
        { axe_include_segment: "axe_segment_3", max_cpm: 10.0 }, // High
        { axe_include_segment: "axe_segment_4", max_cpm: 5.0 }, // Standard
        { axe_include_segment: "axe_segment_5", max_cpm: 2.0 }, // Standard
      ];

      mockService.getPrebidSegments.mockResolvedValue(mockSegments);
      const tool = getPrebidSegmentsTool();

      const result = await tool.execute({ orgId: "priority_org" }, mockContext);

      // Check priority assignment
      const lines = result.split("\n");
      const segment1Line = lines.find((line) =>
        line.includes("Priority: Highest"),
      );
      const segment2Line = lines.find(
        (line) =>
          line.includes("axe_segment_2") && line.includes("Priority: High"),
      );
      const segment3Line = lines.find(
        (line) =>
          line.includes("axe_segment_3") && line.includes("Priority: High"),
      );
      const segment4Line = lines.find(
        (line) =>
          line.includes("axe_segment_4") && line.includes("Priority: Standard"),
      );

      expect(segment1Line).toBeDefined();
      expect(segment2Line).toBeDefined();
      expect(segment3Line).toBeDefined();
      expect(segment4Line).toBeDefined();
    });

    it("should include structured data for API consumption", async () => {
      const mockSegments: PrebidSegment[] = [
        { axe_include_segment: "axe_api_test", max_cpm: 9.99 },
      ];

      mockService.getPrebidSegments.mockResolvedValue(mockSegments);
      const tool = getPrebidSegmentsTool();

      const result = await tool.execute({ orgId: "api_org" }, mockContext);

      // Parse the structured data from the JSON response
      const parsedResult = JSON.parse(result);
      expect(parsedResult.data.orgId).toBe("api_org");
      expect(parsedResult.data.segments).toHaveLength(1);
      expect(parsedResult.data.segments[0].segment).toBe("axe_api_test");
      expect(parsedResult.data.segments[0].maxCpm).toBe(9.99);
      expect(parsedResult.data.totalSegments).toBe(1);
    });
  });

  describe("Tool Metadata", () => {
    it("should have correct tool metadata", () => {
      const tool = getPrebidSegmentsTool();
      expect(tool.name).toBe("get_prebid_segments");
      expect(tool.annotations.category).toBe("Prebid");
      expect(tool.annotations.dangerLevel).toBe("low");
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.annotations.openWorldHint).toBe(false);
    });

    it("should have proper input schema", () => {
      const tool = getPrebidSegmentsTool();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.required).toContain("orgId");
      expect(tool.inputSchema.properties.orgId.type).toBe("string");
    });

    it("should have comprehensive description", () => {
      const tool = getPrebidSegmentsTool();
      expect(tool.description).toContain("AXE inclusion segments");
      expect(tool.description).toContain("prebid integration");
      expect(tool.description).toContain("auction prioritization");
    });
  });
});
