import type {
  BriefValidationRequest,
  BriefValidationResult,
  IBriefValidationService,
} from "../types/brief-validation.js";

import { BriefQualityLevel } from "../types/brief-validation.js";

/**
 * Test double implementation of IBriefValidationService
 * Provides deterministic, fast validation for testing purposes
 */
export class BriefValidationServiceTestDouble
  implements IBriefValidationService
{
  private readonly defaultThreshold = 70;

  async validateBrief(
    request: BriefValidationRequest,
  ): Promise<BriefValidationResult> {
    const threshold = request.threshold ?? this.defaultThreshold;
    const brief = request.brief.trim();

    // Deterministic scoring based on brief characteristics
    const evaluation = this.evaluateBrief(brief);
    const qualityLevel = this.determineQualityLevel(evaluation.score);

    return {
      feedback: evaluation.feedback,
      meetsThreshold: evaluation.score >= threshold,
      missingElements: evaluation.missingElements,
      qualityLevel,
      score: evaluation.score,
      suggestions: evaluation.suggestions,
      threshold,
    };
  }

  /**
   * Determines quality level based on score
   */
  private determineQualityLevel(score: number): BriefQualityLevel {
    if (score >= 80) return BriefQualityLevel.COMPREHENSIVE;
    if (score >= 60) return BriefQualityLevel.STANDARD;
    if (score >= 30) return BriefQualityLevel.MINIMAL;
    return BriefQualityLevel.NO_BRIEF;
  }

  /**
   * Deterministic brief evaluation for testing - aligned with critical requirements
   */
  private evaluateBrief(brief: string): {
    feedback: string;
    missingElements: string[];
    score: number;
    suggestions: string[];
  } {
    if (!brief || brief.length === 0) {
      return {
        feedback:
          "No brief content provided. Publishers need critical information to match inventory.",
        missingElements: [
          "Business objectives not clearly defined",
          "Target audience not specified",
          "Success metrics not defined",
          "Geographic targeting not defined - CRITICAL for inventory matching",
          "Campaign flight dates not specified - CRITICAL for inventory availability",
          "Creative format requirements not defined - CRITICAL for inventory matching",
        ],
        score: 0,
        suggestions: [
          "Add specific business objectives and measurable goals",
          "Define target audience demographics and psychographics",
          "Include specific KPIs with targets",
          "Specify geographic targeting (CRITICAL for inventory matching)",
          "Include campaign flight dates (CRITICAL for inventory availability)",
          "Define creative format requirements (CRITICAL for inventory matching)",
        ],
      };
    }

    const wordCount = brief.split(/\s+/).length;
    const suggestions: string[] = [];
    const missingElements: string[] = [];

    // Check for CRITICAL requirements (publishers need these for inventory matching)
    const hasObjectives =
      /\b(goal|objective|aim|target|increase|improve|drive|boost|achieve|generate|awareness|conversion|engagement)\b/i.test(
        brief,
      );
    const hasMetrics =
      /\b(metric|kpi|measure|track|roi|ctr|impression|click|conversion|lift|reach|frequency|awareness|download|visit)\b/i.test(
        brief,
      );
    const hasAudience =
      /\b(audience|demographic|customer|user|people|age|gender|millennial|adult|consumer|target)\b/i.test(
        brief,
      );
    const hasGeo =
      /\b(geographic|location|city|state|country|region|market|usa|united states|uk|nyc|la|chicago|tier|metro|national|local|sf|austin)\b/i.test(
        brief,
      );
    const hasFlightDates =
      /\b(date|timeline|flight|week|month|start|end|duration|campaign|march|april|january|february|may|june|july|august|september|october|november|december|q1|q2|q3|q4)\b/i.test(
        brief,
      );
    const hasCreativeSpecs =
      /\b(creative|video|banner|display|ad|content|format|size|messaging|15s|30s|728x90|300x250|native|html5|image|testimonial)\b/i.test(
        brief,
      );

    // Check for important but not critical elements
    const hasBudget =
      /\b(budget|spend|cost|\$|dollar|million|thousand|cap|daily)\b/i.test(
        brief,
      );

    // Count critical requirements
    const criticalRequirements = [
      hasObjectives,
      hasMetrics,
      hasAudience,
      hasGeo,
      hasFlightDates,
      hasCreativeSpecs,
    ];
    const criticalCount = criticalRequirements.filter(Boolean).length;

    // Scoring based on critical requirements (publishers need these)
    let score = Math.min(wordCount, 20); // Small base score from length

    // Critical requirements are worth 15 points each (90 total possible)
    score += criticalCount * 15;

    // Budget adds 10 points (important but not critical for inventory matching)
    if (hasBudget) score += 10;

    // Apply penalties for missing critical requirements
    const missingCritical = 6 - criticalCount;
    if (missingCritical >= 3) score = Math.max(score - 20, Math.min(score, 30)); // Cap at 30 if missing 3+ critical
    if (missingCritical >= 2) score = Math.max(score - 10, Math.min(score, 40)); // Cap at 40 if missing 2+ critical
    if (missingCritical >= 1) score = Math.min(score, 60); // Cap at 60 if missing any critical

    score = Math.min(score, 100);

    // Critical requirements - publishers need these for inventory matching
    if (!hasObjectives) {
      missingElements.push("Business objectives not clearly defined");
      suggestions.push(
        "Add specific, measurable business goals (e.g., 'Increase brand awareness by 30%')",
      );
    }
    if (!hasMetrics) {
      missingElements.push("Success metrics not defined");
      suggestions.push(
        "Include specific KPIs with targets (e.g., '2.5% CTR', '15M impressions')",
      );
    }
    if (!hasAudience) {
      missingElements.push("Target audience not specified");
      suggestions.push(
        "Define detailed demographics and psychographics (e.g., 'urban millennials 25-35, sustainability-focused')",
      );
    }
    if (!hasGeo) {
      missingElements.push(
        "Geographic targeting not defined - CRITICAL for inventory matching",
      );
      suggestions.push(
        "Specify target locations (e.g., 'tier 1 US cities', 'NYC, LA, Chicago metro areas')",
      );
    }
    if (!hasFlightDates) {
      missingElements.push(
        "Campaign flight dates not specified - CRITICAL for inventory availability",
      );
      suggestions.push(
        "Include campaign timing (e.g., 'March 1 - April 15, 2025', '6-week campaign starting Q2')",
      );
    }
    if (!hasCreativeSpecs) {
      missingElements.push(
        "Creative format requirements not defined - CRITICAL for inventory matching",
      );
      suggestions.push(
        "Specify creative formats needed (e.g., '15s/30s video, 728x90 display banners, native content')",
      );
    }

    // Important but not critical for inventory matching
    if (!hasBudget) {
      missingElements.push("Budget information not provided");
      suggestions.push("Specify total budget and daily spending constraints");
    }

    // Generate feedback based on score and critical requirements
    let feedback = "";
    if (criticalCount === 6) {
      feedback = `Excellent comprehensive brief with all ${criticalCount}/6 critical requirements. Publishers can effectively match this campaign to appropriate inventory.`;
    } else if (criticalCount >= 4) {
      feedback = `Good brief with ${criticalCount}/6 critical requirements present. Minor improvements would help publishers find better inventory matches.`;
    } else if (criticalCount >= 2) {
      feedback = `Basic brief with ${criticalCount}/6 critical requirements. Missing elements will make inventory matching challenging for publishers.`;
    } else {
      feedback = `Insufficient brief with only ${criticalCount}/6 critical requirements. Publishers will struggle to find appropriate inventory without this information.`;
    }

    return {
      feedback,
      missingElements: missingElements.slice(0, 6), // Limit to top 6 missing elements
      score,
      suggestions: suggestions.slice(0, 6), // Limit to top 6 suggestions
    };
  }
}
