import { beforeEach, describe, expect, it, vi } from "vitest";

import type { BriefValidationResult } from "../../types/brief-validation.js";
import type {
  MCPToolExecuteContext,
  ValidateBriefParams,
} from "../../types/mcp.js";

import { BriefValidationService } from "../../services/brief-validation-service.js";
import { BriefQualityLevel } from "../../types/brief-validation.js";
import { validateBriefTool } from "./validate-brief.js";

// Mock the BriefValidationService
vi.mock("../../services/brief-validation-service.js", () => ({
  BriefValidationService: vi.fn(),
}));

describe("validateBriefTool", () => {
  let tool: ReturnType<typeof validateBriefTool>;
  let mockValidationService: {
    validateBrief: ReturnType<typeof vi.fn>;
  };
  let mockContext: MCPToolExecuteContext;

  beforeEach(() => {
    mockValidationService = {
      validateBrief: vi.fn(),
    };

    (
      BriefValidationService as unknown as ReturnType<typeof vi.fn>
    ).mockImplementation(() => mockValidationService);

    tool = validateBriefTool();

    mockContext = {
      session: {
        scope3ApiKey: "test-api-key",
      },
    };
  });

  describe("tool configuration", () => {
    it("should have correct tool name", () => {
      expect(tool.name).toBe("campaign_validate_brief");
    });

    it("should have correct annotations", () => {
      expect(tool.annotations.category).toBe("Campaigns");
      expect(tool.annotations.dangerLevel).toBe("low");
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.annotations.title).toBe("Validate Campaign Brief");
    });

    it("should have description mentioning Ad Context Protocol", () => {
      expect(tool.description).toContain("Ad Context Protocol");
      expect(tool.description).toContain("AI evaluation");
    });
  });

  describe("parameter validation", () => {
    it("should require brief parameter", () => {
      const params = tool.parameters;
      const briefParam = params.shape.brief;

      expect(briefParam).toBeDefined();

      // Test that brief is required by attempting to parse without it
      expect(() => params.parse({})).toThrow();
    });

    it("should have optional threshold parameter with default 70", () => {
      const params = tool.parameters;
      const parsed = params.parse({ brief: "test brief" });

      expect(parsed.threshold).toBe(70);
    });

    it("should validate threshold range", () => {
      const params = tool.parameters;

      // Should fail for negative threshold
      expect(() => params.parse({ brief: "test", threshold: -1 })).toThrow();

      // Should fail for threshold > 100
      expect(() => params.parse({ brief: "test", threshold: 101 })).toThrow();

      // Should pass for valid threshold
      const parsed = params.parse({ brief: "test", threshold: 80 });
      expect(parsed.threshold).toBe(80);
    });

    it("should have optional brandAgentId parameter", () => {
      const params = tool.parameters;
      const parsed1 = params.parse({ brief: "test brief" });
      const parsed2 = params.parse({
        brandAgentId: "agent-123",
        brief: "test brief",
      });

      expect(parsed1.brandAgentId).toBeUndefined();
      expect(parsed2.brandAgentId).toBe("agent-123");
    });
  });

  describe("execute", () => {
    it("should validate brief and return formatted results for passing brief", async () => {
      const mockResult: BriefValidationResult = {
        feedback: "Excellent comprehensive brief with clear objectives.",
        meetsThreshold: true,
        missingElements: [],
        qualityLevel: BriefQualityLevel.COMPREHENSIVE,
        score: 85,
        suggestions: ["Consider adding more specific metrics"],
        threshold: 70,
      };

      mockValidationService.validateBrief.mockResolvedValue(mockResult);

      const args: ValidateBriefParams = {
        brief:
          "Comprehensive campaign brief with objectives, audience, budget, and metrics.",
        threshold: 70,
      };

      const result = await tool.execute(args, mockContext);

      expect(mockValidationService.validateBrief).toHaveBeenCalledWith({
        brandAgentId: undefined,
        brief: args.brief,
        threshold: 70,
      });

      expect(result).toContain("Brief Validation Results");
      expect(result).toContain("85/100");
      expect(result).toContain("✅");
      expect(result).toContain("PASSES validation requirements");
      expect(result).toContain("Comprehensive Brief");
      expect(result).toContain("Brief Ready for Campaign Creation");
    });

    it("should validate brief and return formatted results for failing brief", async () => {
      const mockResult: BriefValidationResult = {
        feedback: "Basic brief missing key information.",
        meetsThreshold: false,
        missingElements: [
          "Business objectives not clearly defined",
          "Success metrics not defined",
        ],
        qualityLevel: BriefQualityLevel.MINIMAL,
        score: 45,
        suggestions: [
          "Add specific business objectives",
          "Define target audience demographics",
        ],
        threshold: 70,
      };

      mockValidationService.validateBrief.mockResolvedValue(mockResult);

      const args: ValidateBriefParams = {
        brief: "We want to advertise our products.",
        threshold: 70,
      };

      const result = await tool.execute(args, mockContext);

      expect(result).toContain("45/100");
      expect(result).toContain("❌");
      expect(result).toContain("FAILS validation requirements");
      expect(result).toContain("Minimal Brief");
      expect(result).toContain("Brief Needs Improvement");
      expect(result).toContain("Add specific business objectives");
      expect(result).toContain("Business objectives not clearly defined");
    });

    it("should use custom threshold", async () => {
      const mockResult: BriefValidationResult = {
        feedback: "Brief meets custom threshold.",
        meetsThreshold: true,
        missingElements: [],
        qualityLevel: BriefQualityLevel.STANDARD,
        score: 60,
        suggestions: [],
        threshold: 50,
      };

      mockValidationService.validateBrief.mockResolvedValue(mockResult);

      const args: ValidateBriefParams = {
        brief: "Standard campaign brief.",
        threshold: 50,
      };

      await tool.execute(args, mockContext);

      expect(mockValidationService.validateBrief).toHaveBeenCalledWith({
        brandAgentId: undefined,
        brief: args.brief,
        threshold: 50,
      });
    });

    it("should include brand agent context when provided", async () => {
      const mockResult: BriefValidationResult = {
        feedback: "Good brief with brand context.",
        meetsThreshold: true,
        missingElements: [],
        qualityLevel: BriefQualityLevel.STANDARD,
        score: 75,
        suggestions: [],
        threshold: 70,
      };

      mockValidationService.validateBrief.mockResolvedValue(mockResult);

      const args: ValidateBriefParams = {
        brandAgentId: "brand-456",
        brief: "Campaign brief with brand context.",
      };

      await tool.execute(args, mockContext);

      expect(mockValidationService.validateBrief).toHaveBeenCalledWith({
        brandAgentId: "brand-456",
        brief: args.brief,
        threshold: 70,
      });
    });

    it("should return structured response data", async () => {
      const mockResult: BriefValidationResult = {
        feedback: "Good brief quality.",
        meetsThreshold: true,
        missingElements: [],
        qualityLevel: BriefQualityLevel.COMPREHENSIVE,
        score: 80,
        suggestions: [],
        threshold: 70,
      };

      mockValidationService.validateBrief.mockResolvedValue(mockResult);

      const args: ValidateBriefParams = {
        brief: "Test brief for data validation.",
      };

      const result = await tool.execute(args, mockContext);

      // Parse the JSON response to check structure
      const responseMatch = result.match(/```json\n([\s\S]*?)\n```/);
      if (responseMatch) {
        const responseData = JSON.parse(responseMatch[1]);

        expect(responseData.data.validation).toEqual(mockResult);
        expect(responseData.data.briefAnalysis).toBeDefined();
        expect(responseData.data.briefAnalysis.wordCount).toBeTypeOf("number");
        expect(responseData.data.briefAnalysis.characterCount).toBeTypeOf(
          "number",
        );
        expect(responseData.success).toBe(true);
      }
    });

    it("should handle validation service errors", async () => {
      mockValidationService.validateBrief.mockRejectedValue(
        new Error("Service unavailable"),
      );

      const args: ValidateBriefParams = {
        brief: "Test brief",
      };

      await expect(tool.execute(args, mockContext)).rejects.toThrow(
        "Failed to validate campaign brief: Service unavailable",
      );
    });

    it("should include quality guidelines in response", async () => {
      const mockResult: BriefValidationResult = {
        feedback: "Standard brief quality.",
        meetsThreshold: true,
        missingElements: [],
        qualityLevel: BriefQualityLevel.STANDARD,
        score: 75,
        suggestions: [],
        threshold: 70,
      };

      mockValidationService.validateBrief.mockResolvedValue(mockResult);

      const args: ValidateBriefParams = {
        brief: "Campaign brief for guidelines test.",
      };

      const result = await tool.execute(args, mockContext);

      expect(result).toContain("Brief Quality Guidelines");
      expect(result).toContain("Comprehensive (80-100)");
      expect(result).toContain("Standard (60-79)");
      expect(result).toContain("Minimal (30-59)");
      expect(result).toContain("No Brief (0-29)");
    });
  });
});
