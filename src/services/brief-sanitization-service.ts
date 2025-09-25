// Brief Sanitization Service - Removes budget/price information for sales agents
// Creates sanitized campaign briefs that preserve targeting context without exposing sensitive financial data

export interface SanitizedBriefResult {
  confidence_score: number; // 0-100 confidence that sanitization was successful
  preserves_context: boolean;
  removed_elements: string[];
  sanitized_brief: string;
}

export class BriefSanitizationService {
  /**
   * Create a budget allocation range description for sales agents
   * This provides context about possible allocation without exposing full campaign budget
   */
  createAllocationRangeContext(
    tacticBudgetAmount: number,
    _campaignBudgetTotal?: number,
  ): string {
    // Create allocation range tiers based on tactic budget
    let allocationTier: string;
    let suggestedRange: string;

    if (tacticBudgetAmount < 1000) {
      allocationTier = "Small allocation";
      suggestedRange = "under $1K";
    } else if (tacticBudgetAmount < 5000) {
      allocationTier = "Medium allocation";
      suggestedRange = "$1K-$5K range";
    } else if (tacticBudgetAmount < 25000) {
      allocationTier = "Large allocation";
      suggestedRange = "$5K-$25K range";
    } else if (tacticBudgetAmount < 100000) {
      allocationTier = "Enterprise allocation";
      suggestedRange = "$25K-$100K range";
    } else {
      allocationTier = "Premium allocation";
      suggestedRange = "substantial budget";
    }

    return `${allocationTier} (${suggestedRange}) - please provide competitive pricing and premium inventory access.`;
  }

  /**
   * Sanitize a campaign brief by removing budget, price, and financial information
   * while preserving targeting context and campaign objectives
   */
  async sanitizeBrief(
    originalBrief: string,
    _tacticBudgetAmount?: number,
    _campaignBudgetTotal?: number,
  ): Promise<SanitizedBriefResult> {
    try {
      // List of financial terms and patterns to identify and remove
      const financialPatterns = [
        // Direct budget mentions
        /\$[\d,]+(?:\.\d{2})?(?:\s*(?:k|thousand|million|m|billion|b))?/gi,
        /budget[:\s]+\$?[\d,]+(?:\.\d{2})?(?:\s*(?:k|thousand|million|m|billion|b))?/gi,
        /spend[:\s]+\$?[\d,]+(?:\.\d{2})?(?:\s*(?:k|thousand|million|m|billion|b))?/gi,
        /cost[:\s]+\$?[\d,]+(?:\.\d{2})?(?:\s*(?:k|thousand|million|m|billion|b))?/gi,

        // CPM and pricing mentions
        /\$?[\d.]+\s*cpm/gi,
        /cpm[:\s]+\$?[\d.]+/gi,
        /cost\s+per\s+mille[:\s]+\$?[\d.]+/gi,
        /price[:\s]+\$?[\d,]+(?:\.\d{2})?/gi,

        // Budget-related phrases
        /with\s+a\s+budget\s+of[^.]+/gi,
        /budget\s+allocation[^.]+/gi,
        /spending\s+limit[^.]+/gi,
        /daily\s+cap[^.]+/gi,
        /total\s+spend[^.]+/gi,
        /financial\s+constraints[^.]+/gi,

        // Number ranges that might be budgets
        /between\s+\$?[\d,]+(?:\.\d{2})?\s+(?:and|to|-)\s+\$?[\d,]+(?:\.\d{2})?/gi,
        /from\s+\$?[\d,]+(?:\.\d{2})?\s+to\s+\$?[\d,]+(?:\.\d{2})?/gi,
      ];

      // Terms that indicate budget context but should be removed entirely
      const budgetContextPhrases = [
        /budget\s+considerations/gi,
        /cost\s+effectiveness/gi,
        /return\s+on\s+ad\s+spend/gi,
        /roas/gi,
        /cost\s+per\s+acquisition/gi,
        /cpa\s+target/gi,
        /roi\s+expectations/gi,
        /financial\s+goals/gi,
        /spend\s+efficiency/gi,
        /budget\s+optimization/gi,
      ];

      let sanitizedBrief = originalBrief;
      const removedElements: string[] = [];

      // Apply financial pattern removal
      for (const pattern of financialPatterns) {
        const matches = sanitizedBrief.match(pattern);
        if (matches) {
          for (const match of matches) {
            removedElements.push(`Financial reference: "${match}"`);
            sanitizedBrief = sanitizedBrief.replace(
              pattern,
              "[budget details removed for sales agent privacy]",
            );
          }
        }
      }

      // Remove budget context phrases entirely
      for (const phrase of budgetContextPhrases) {
        const matches = sanitizedBrief.match(phrase);
        if (matches) {
          for (const match of matches) {
            removedElements.push(`Budget context: "${match}"`);
            sanitizedBrief = sanitizedBrief.replace(phrase, "");
          }
        }
      }

      // Clean up multiple spaces and empty sentences
      sanitizedBrief = sanitizedBrief
        .replace(/\s+/g, " ") // Multiple spaces to single space
        .replace(/\.\s*\./g, ".") // Double periods
        .replace(/,\s*,/g, ",") // Double commas
        .replace(/\s+([.!?])/g, "$1") // Space before punctuation
        .replace(/^\s+|\s+$/g, ""); // Trim

      // Add context preservation note if budget information was removed
      if (removedElements.length > 0) {
        sanitizedBrief +=
          "\n\nNote: This is a sanitized version of the campaign brief with budget and pricing information removed for privacy. The targeting and creative requirements remain unchanged.";
      }

      // Determine confidence and context preservation
      const confidenceScore = this.calculateConfidenceScore(
        originalBrief,
        sanitizedBrief,
        removedElements,
      );

      const preservesContext = this.evaluateContextPreservation(
        originalBrief,
        sanitizedBrief,
      );

      return {
        confidence_score: confidenceScore,
        preserves_context: preservesContext,
        removed_elements: removedElements,
        sanitized_brief: sanitizedBrief,
      };
    } catch {
      // Fallback: return a generic sanitized brief if processing fails
      return {
        confidence_score: 0,
        preserves_context: false,
        removed_elements: ["Error during sanitization - using fallback brief"],
        sanitized_brief: this.createFallbackBrief(originalBrief),
      };
    }
  }

  /**
   * Calculate confidence score for sanitization success
   */
  private calculateConfidenceScore(
    originalBrief: string,
    sanitizedBrief: string,
    removedElements: string[],
  ): number {
    // Base confidence
    let confidence = 85;

    // Reduce confidence if no financial information was found/removed
    if (removedElements.length === 0) {
      // Check if original brief likely contained financial info we missed
      const likelyFinancialTerms =
        /\$|budget|cost|spend|price|cpm|allocation/gi;
      const hasLikelyFinancial = originalBrief.match(likelyFinancialTerms);
      if (hasLikelyFinancial) {
        confidence -= 30; // Might have missed something
      } else {
        confidence += 10; // Clean brief, high confidence
      }
    } else {
      // Confidence based on number of items removed
      confidence += Math.min(removedElements.length * 2, 15);
    }

    // Ensure brief still has meaningful content
    if (sanitizedBrief.length < originalBrief.length * 0.3) {
      confidence -= 20; // Removed too much content
    }

    // Check if brief makes sense after sanitization
    const hasTargeting =
      /target|audience|demographic|geographic|interest|behavior/gi;
    const hasObjective =
      /goal|objective|campaign|promote|advertise|awareness|conversion/gi;

    if (!sanitizedBrief.match(hasTargeting)) confidence -= 15;
    if (!sanitizedBrief.match(hasObjective)) confidence -= 15;

    return Math.max(0, Math.min(100, Math.round(confidence)));
  }

  /**
   * Create a generic fallback brief if sanitization fails
   */
  private createFallbackBrief(originalBrief: string): string {
    // Extract first sentence or first 100 chars as safe fallback
    const firstSentence = originalBrief.split(".")[0];
    if (firstSentence.length > 20 && firstSentence.length < 200) {
      return (
        firstSentence + ". [Additional campaign details available upon request]"
      );
    }

    return "Campaign targeting and creative requirements as specified. Budget and pricing details managed separately for privacy.";
  }

  /**
   * Evaluate if sanitized brief preserves essential targeting context
   */
  private evaluateContextPreservation(
    originalBrief: string,
    sanitizedBrief: string,
  ): boolean {
    // Check for preservation of key marketing elements
    const keyElements = [
      /target|audience|demographic/gi,
      /campaign|objective|goal/gi,
      /product|service|offering/gi,
      /geographic|location|region/gi,
      /age|gender|income/gi, // Demographics (non-financial)
      /interest|behavior|lifestyle/gi,
      /awareness|consideration|conversion/gi,
    ];

    let preservedCount = 0;
    let originalCount = 0;

    for (const element of keyElements) {
      const inOriginal = originalBrief.match(element);
      const inSanitized = sanitizedBrief.match(element);

      if (inOriginal) originalCount++;
      if (inSanitized) preservedCount++;
    }

    // Context is preserved if we maintained at least 60% of key elements
    return originalCount > 0 && preservedCount / originalCount >= 0.6;
  }
}
