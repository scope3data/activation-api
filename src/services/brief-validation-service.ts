import type {
  BriefValidationRequest,
  BriefValidationResult,
  IBriefValidationService,
} from "../types/brief-validation.js";

import { BriefQualityLevel } from "../types/brief-validation.js";

/**
 * Service for validating campaign briefs using AI evaluation
 * Based on Ad Context Protocol brief expectations
 */
export class BriefValidationService implements IBriefValidationService {
  private readonly defaultThreshold = 70;

  /**
   * Validates a campaign brief against Ad Context Protocol standards
   */
  async validateBrief(
    request: BriefValidationRequest,
  ): Promise<BriefValidationResult> {
    const threshold = request.threshold ?? this.defaultThreshold;

    // Create the evaluation prompt for the AI model
    const evaluationPrompt = this.buildEvaluationPrompt(request.brief);

    try {
      // Call AI model to evaluate the brief
      const aiResponse = await this.callAIModel(evaluationPrompt);

      // Parse AI response into structured format
      const evaluation = this.parseAIResponse(aiResponse);

      // Determine quality level based on score
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
    } catch (error) {
      // Fallback to basic validation if AI service is unavailable
      console.warn(
        "AI validation service unavailable, using fallback validation:",
        error,
      );
      return this.fallbackValidation(request.brief, threshold);
    }
  }

  /**
   * Builds the evaluation prompt for the AI model
   */
  private buildEvaluationPrompt(brief: string): string {
    return `You are evaluating a digital advertising campaign brief against the Ad Context Protocol standards from https://adcontextprotocol.org/docs/media-buy/product-discovery/brief-expectations.

EVALUATION CRITERIA:
Publishers need specific information to match campaigns with appropriate inventory. Missing critical elements makes campaign execution impossible or ineffective.

CRITICAL REQUIREMENTS (Must be present - campaigns fail without these):
- Business Objectives: Clear, measurable goals (e.g., "increase brand awareness by 30%", "drive 5,000 conversions")
- Success Metrics: Specific KPIs with targets (e.g., "2.5% CTR", "15M impressions", "40% brand lift")
- Target Audience: Detailed demographics, psychographics, interests (e.g., "urban millennials 25-35, $50k+ income, sustainability-focused")
- Geographic Markets: Specific locations, regions, or targeting areas (e.g., "tier 1 US cities", "NYC, LA, Chicago metro areas", "UK and Germany")
- Flight Dates: Campaign start/end dates or duration (e.g., "March 1 - April 15, 2025", "6-week campaign starting Q2")
- Creative Requirements: Formats, sizes, specifications needed (e.g., "15s/30s video, 728x90 display banners, native content")

IMPORTANT ELEMENTS (Strongly recommended):
- Budget Information: Total budget, daily caps, pacing constraints
- Brand Safety: Content restrictions, competitor separation, quality standards
- Promoted Offering: Clear product/brand positioning and messaging

ADDITIONAL ELEMENTS (Valuable for optimization):
- Competitive Context: Market positioning relative to competitors
- Channel Preferences: Platform or inventory type preferences
- Performance Context: Historical benchmarks or expectations

BRIEF TO EVALUATE:
"${brief}"

SCORING GUIDELINES:
- Missing ANY critical requirement = automatic score below 60
- Missing 2+ critical requirements = score below 40
- Missing 3+ critical requirements = score below 30
- All critical requirements + good detail = 70+ score
- All requirements + comprehensive detail = 80+ score

PROVIDE YOUR EVALUATION IN THIS EXACT JSON FORMAT:
{
  "score": [number 0-100],
  "feedback": "[2-3 sentences explaining overall quality and inventory matching capability]",
  "missingElements": ["element 1", "element 2"],
  "suggestions": ["specific suggestion 1", "specific suggestion 2"]
}

Be specific and actionable in your feedback. Emphasize that publishers need geo, timing, and creative specs to find matching inventory.`;
  }

  /**
   * Calls the AI model to evaluate the brief
   * This is a stub - would be implemented with actual AI service
   */
  private async callAIModel(prompt: string): Promise<string> {
    // Implementation note: This is a placeholder for actual AI service integration.
    // In production, this would connect to services like Gemini, OpenAI, or Claude API.

    // Check for environment variables for AI service configuration
    const aiServiceUrl = process.env.AI_SERVICE_URL;
    const aiApiKey = process.env.AI_API_KEY;

    if (!aiServiceUrl || !aiApiKey) {
      throw new Error("AI service not configured");
    }

    // Mock implementation - replace with actual AI service call
    const response = await fetch(aiServiceUrl, {
      body: JSON.stringify({
        max_tokens: 500,
        model: "gemini-pro", // or whatever model is configured
        prompt,
        temperature: 0.1, // Low temperature for consistent evaluation
      }),
      headers: {
        Authorization: `Bearer ${aiApiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(`AI service error: ${response.status}`);
    }

    const data = (await response.json()) as Record<string, unknown>;
    return (
      (data.response as string) ||
      ((data.choices as Record<string, unknown>[])?.[0]?.text as string) ||
      (data.content as string) ||
      ""
    );
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
   * Fallback parsing when JSON parsing fails
   */
  private fallbackParseResponse(response: string): {
    feedback: string;
    missingElements: string[];
    score: number;
    suggestions: string[];
  } {
    // Extract score with regex
    const scoreMatch = response.match(/score[:\s]*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1]) : 50;

    // Extract feedback (first few sentences)
    const sentences = response.split(".").filter((s) => s.trim().length > 10);
    const feedback = sentences.slice(0, 2).join(".") + ".";

    // Extract suggestions and missing elements with simple heuristics
    const suggestions: string[] = [];
    const missingElements: string[] = [];

    const lines = response.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.toLowerCase().includes("missing") ||
        trimmed.toLowerCase().includes("lacking")
      ) {
        missingElements.push(trimmed);
      } else if (
        trimmed.toLowerCase().includes("suggest") ||
        trimmed.toLowerCase().includes("add")
      ) {
        suggestions.push(trimmed);
      }
    }

    return {
      feedback: feedback || "Brief evaluation completed with limited parsing",
      missingElements: missingElements.slice(0, 5), // Limit to 5 missing elements
      score: Math.max(0, Math.min(100, score)),
      suggestions: suggestions.slice(0, 5), // Limit to 5 suggestions
    };
  }

  /**
   * Fallback validation when AI service is unavailable
   */
  private fallbackValidation(
    brief: string,
    threshold: number,
  ): BriefValidationResult {
    const wordCount = brief.split(/\s+/).length;

    // Check for critical requirements (hard requirements for inventory matching)
    const hasObjectives =
      /\b(goal|objective|aim|target|increase|improve|drive|boost|awareness|conversion|engagement)\b/i.test(
        brief,
      );
    const hasMetrics =
      /\b(metric|kpi|measure|track|roi|ctr|impression|click|conversion|lift|reach|frequency)\b/i.test(
        brief,
      );
    const hasAudience =
      /\b(audience|demographic|customer|user|people|age|gender|millennial|adult|consumer|target)\b/i.test(
        brief,
      );
    const hasGeo =
      /\b(geographic|location|city|state|country|region|market|usa|united states|uk|nyc|la|chicago|tier|metro|national|local)\b/i.test(
        brief,
      );
    const hasFlightDates =
      /\b(date|timeline|flight|week|month|start|end|duration|campaign|march|april|january|february|may|june|july|august|september|october|november|december|q1|q2|q3|q4)\b/i.test(
        brief,
      );
    const hasCreativeSpecs =
      /\b(creative|video|banner|display|ad|content|format|size|messaging|15s|30s|728x90|300x250|native|html5|image)\b/i.test(
        brief,
      );

    // Check for important but not critical elements
    const hasBudget =
      /\b(budget|spend|cost|\$|dollar|million|thousand|cap|daily)\b/i.test(
        brief,
      );

    // Count critical requirements (these are mandatory for inventory matching)
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

    // Budget adds 10 points (important but not critical)
    if (hasBudget) score += 10;

    // Apply penalties for missing critical requirements
    const missingCritical = 6 - criticalCount;
    if (missingCritical >= 3) score = Math.max(score - 20, Math.min(score, 30)); // Cap at 30 if missing 3+ critical
    if (missingCritical >= 2) score = Math.max(score - 10, Math.min(score, 40)); // Cap at 40 if missing 2+ critical
    if (missingCritical >= 1) score = Math.min(score, 60); // Cap at 60 if missing any critical

    score = Math.min(score, 100);

    const missingElements = [];
    const suggestions = [];

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

    // Important but not critical
    if (!hasBudget) {
      missingElements.push("Budget information not provided");
      suggestions.push("Specify total budget and daily spending constraints");
    }

    return {
      feedback: `Fallback evaluation completed. Brief has ${criticalCount}/6 critical requirements needed for inventory matching. ${score >= 70 ? "Publishers can effectively match this campaign to appropriate inventory." : "Missing critical elements will make inventory matching difficult or impossible."}`,
      meetsThreshold: score >= threshold,
      missingElements,
      qualityLevel: this.determineQualityLevel(score),
      score,
      suggestions,
      threshold,
    };
  }

  /**
   * Parses AI response into structured evaluation
   */
  private parseAIResponse(aiResponse: string): {
    feedback: string;
    missingElements: string[];
    score: number;
    suggestions: string[];
  } {
    try {
      // Try to extract JSON from AI response
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          feedback: parsed.feedback || "Brief evaluation completed",
          missingElements: Array.isArray(parsed.missingElements)
            ? parsed.missingElements
            : [],
          score: Math.max(0, Math.min(100, parsed.score || 0)),
          suggestions: Array.isArray(parsed.suggestions)
            ? parsed.suggestions
            : [],
        };
      }
    } catch (error) {
      console.warn("Failed to parse AI response as JSON:", error);
    }

    // Fallback parsing if JSON extraction fails
    return this.fallbackParseResponse(aiResponse);
  }
}
