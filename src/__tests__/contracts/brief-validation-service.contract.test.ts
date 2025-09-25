import { describe, expect, it } from "vitest";
import type { IBriefValidationService, BriefValidationRequest, BriefValidationResult } from "../../types/brief-validation.js";

/**
 * Contract test suite for BriefValidationService implementations
 * This test suite ensures all implementations follow the same behavioral contract
 */
export function testBriefValidationServiceContract(
  serviceFactory: () => IBriefValidationService,
) {
  describe("BriefValidationService Contract", () => {
    let service: IBriefValidationService;

    beforeEach(() => {
      service = serviceFactory();
    });

    describe("validateBrief", () => {
      it("should return high score for comprehensive brief", async () => {
        const comprehensiveBrief = `
          Campaign Objective: Increase brand awareness for EcoClean sustainable cleaning products by 40% among environmentally conscious millennials aged 25-35.
          
          Target Audience: Urban millennials (25-35 years old) with household income $50k+, interested in sustainability, eco-friendly products, and green living. Primary focus on major metropolitan areas: NYC, LA, SF, Chicago, Austin.
          
          Success Metrics: 
          - Achieve 15M impressions with minimum 2.5% CTR
          - Generate 50,000 website visits
          - Increase brand awareness by 40% (measured via brand lift study)
          - Drive 5,000 product demo sign-ups
          
          Budget: $250,000 total campaign budget over 6 weeks
          Daily spend cap: $6,000/day
          
          Flight Dates: March 1 - April 15, 2024
          
          Creative Requirements: Video ads (15s, 30s), display banners (728x90, 300x250), native content
          Focus on product sustainability messaging and real customer testimonials
          
          Geographic Markets: United States - tier 1 cities with high environmental awareness index
          
          Brand Safety: Exclude content related to competitor cleaning products, controversial environmental topics, avoid placement near negative environmental news
        `;

        const request: BriefValidationRequest = {
          brief: comprehensiveBrief,
          threshold: 70,
        };

        const result = await service.validateBrief(request);

        expect(result.score).toBeGreaterThan(70);
        expect(result.meetsThreshold).toBe(true);
        expect(result.threshold).toBe(70);
        expect(result.qualityLevel).toBe("Comprehensive Brief");
        expect(result.feedback).toBeTruthy();
        expect(Array.isArray(result.suggestions)).toBe(true);
        expect(Array.isArray(result.missingElements)).toBe(true);
      });

      it("should return low score for minimal brief", async () => {
        const minimalBrief = "We want to advertise our cleaning products to people.";

        const request: BriefValidationRequest = {
          brief: minimalBrief,
          threshold: 70,
        };

        const result = await service.validateBrief(request);

        expect(result.score).toBeLessThan(70);
        expect(result.meetsThreshold).toBe(false);
        expect(result.threshold).toBe(70);
        expect(result.qualityLevel).toBeOneOf(["No Brief", "Minimal Brief"]);
        expect(result.feedback).toBeTruthy();
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.missingElements.length).toBeGreaterThan(0);
      });

      it("should respect custom threshold", async () => {
        const standardBrief = `
          Campaign Goal: Promote our new fitness app to health-conscious adults.
          Target: Adults 25-45 interested in fitness and wellness.
          Budget: $100,000 over 4 weeks.
          Success: 10M impressions, 2% CTR, 10,000 app downloads.
        `;

        const lowThresholdRequest: BriefValidationRequest = {
          brief: standardBrief,
          threshold: 40,
        };

        const highThresholdRequest: BriefValidationRequest = {
          brief: standardBrief,
          threshold: 90,
        };

        const lowResult = await service.validateBrief(lowThresholdRequest);
        const highResult = await service.validateBrief(highThresholdRequest);

        expect(lowResult.threshold).toBe(40);
        expect(highResult.threshold).toBe(90);
        
        // Same brief, different thresholds should yield same score but different pass/fail
        expect(lowResult.score).toBe(highResult.score);
        
        // High threshold is more likely to fail
        if (lowResult.meetsThreshold) {
          expect(highResult.meetsThreshold).toBe(false);
        }
      });

      it("should handle empty brief gracefully", async () => {
        const request: BriefValidationRequest = {
          brief: "",
          threshold: 70,
        };

        const result = await service.validateBrief(request);

        expect(result.score).toBe(0);
        expect(result.meetsThreshold).toBe(false);
        expect(result.qualityLevel).toBe("No Brief");
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.missingElements.length).toBeGreaterThan(0);
      });

      it("should provide actionable feedback", async () => {
        const partialBrief = `
          We want to sell more shoes online. 
          Our target audience is young people who like sports.
        `;

        const request: BriefValidationRequest = {
          brief: partialBrief,
          threshold: 70,
        };

        const result = await service.validateBrief(request);

        // Should provide specific suggestions
        expect(result.suggestions.length).toBeGreaterThan(0);
        expect(result.missingElements.length).toBeGreaterThan(0);
        
        // Feedback should be descriptive
        expect(result.feedback).toBeTruthy();
        expect(result.feedback.length).toBeGreaterThan(10);
      });

      it("should validate brief with brand agent context", async () => {
        const brief = "Launch new eco-friendly product line to sustainability-focused consumers.";

        const request: BriefValidationRequest = {
          brief,
          threshold: 70,
          brandAgentId: "brand-123",
        };

        const result = await service.validateBrief(request);

        // Should handle brand context without errors
        expect(result).toBeDefined();
        expect(typeof result.score).toBe("number");
        expect(typeof result.meetsThreshold).toBe("boolean");
        expect(typeof result.qualityLevel).toBe("string");
      });

      it("should return consistent quality levels", async () => {
        const testCases = [
          { brief: "", expectedMinScore: 0, expectedMaxScore: 29, expectedLevel: "No Brief" },
          { 
            brief: "Sell products to people with small budget.", 
            expectedMinScore: 30, 
            expectedMaxScore: 59, 
            expectedLevel: "Minimal Brief" 
          },
        ];

        for (const testCase of testCases) {
          const request: BriefValidationRequest = {
            brief: testCase.brief,
            threshold: 50,
          };

          const result = await service.validateBrief(request);

          expect(result.score).toBeGreaterThanOrEqual(testCase.expectedMinScore);
          expect(result.score).toBeLessThanOrEqual(testCase.expectedMaxScore);
          expect(result.qualityLevel).toBe(testCase.expectedLevel);
        }
      });

      it("should validate result structure", async () => {
        const request: BriefValidationRequest = {
          brief: "Test brief for structure validation",
          threshold: 70,
        };

        const result = await service.validateBrief(request);

        // Required fields
        expect(typeof result.score).toBe("number");
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
        
        expect(typeof result.meetsThreshold).toBe("boolean");
        expect(typeof result.threshold).toBe("number");
        expect(typeof result.feedback).toBe("string");
        expect(typeof result.qualityLevel).toBe("string");
        
        expect(Array.isArray(result.suggestions)).toBe(true);
        expect(Array.isArray(result.missingElements)).toBe(true);
        
        // Quality level should be one of the expected values
        expect(result.qualityLevel).toBeOneOf([
          "No Brief",
          "Minimal Brief", 
          "Standard Brief",
          "Comprehensive Brief"
        ]);
      });
    });
  });
}