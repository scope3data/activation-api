/**
 * Service for interpreting natural language optimization requests
 * and converting them into strategy prompt updates
 */
export class OptimizationInterpreter {
  /**
   * Extract specific metrics and targets from change request
   */
  static extractMetrics(changeRequest: string): Record<string, unknown> {
    const request = changeRequest.toLowerCase();
    const metrics: Record<string, unknown> = {};

    // Extract percentage changes
    const percentageMatches = request.match(/(\d+)%/g);
    if (percentageMatches) {
      metrics.percentageChanges = percentageMatches.map((p) =>
        parseInt(p.replace("%", "")),
      );
    }

    // Extract dollar amounts
    const dollarMatches = request.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/g);
    if (dollarMatches) {
      metrics.dollarAmounts = dollarMatches.map((d) =>
        parseFloat(d.replace(/[$,]/g, "")),
      );
    }

    // Extract optimization types
    const optimizationTypes = [];
    if (request.includes("viewability")) optimizationTypes.push("viewability");
    if (request.includes("scale") || request.includes("volume"))
      optimizationTypes.push("scale");
    if (request.includes("efficiency") || request.includes("cpm"))
      optimizationTypes.push("efficiency");
    if (request.includes("reach")) optimizationTypes.push("reach");
    if (request.includes("completion")) optimizationTypes.push("completion");

    metrics.optimizationTypes = optimizationTypes;

    return metrics;
  }

  /**
   * Convert a natural language change request into an updated campaign prompt
   */
  static async interpretChangeRequest(
    changeRequest: string,
    currentPrompt?: string,
  ): Promise<{
    changes: string[];
    originalRequest: string;
    updatedPrompt: string;
  }> {
    const request = changeRequest.toLowerCase();

    // Extract optimization intents and parameters
    const optimizations = [];
    const changes = [];

    // Scale/Volume optimizations
    if (
      request.includes("scale") ||
      request.includes("spend") ||
      request.includes("volume")
    ) {
      const scaleMatch = request.match(/(\d+)%?\s*more\s*(scale|spend|volume)/);
      if (scaleMatch) {
        const percentage = scaleMatch[1];
        optimizations.push(
          `Increase daily spending capacity and reach by ${percentage}% to achieve greater scale`,
        );
        changes.push(
          `📈 **Scale Increase**: Raised daily spending capacity by ${percentage}%`,
        );
        changes.push(
          `🎯 **Targeting Expansion**: Broadened reach parameters to support increased scale`,
        );
      } else if (request.includes("more scale")) {
        optimizations.push(
          "Increase campaign scale through higher daily caps and expanded targeting reach",
        );
        changes.push(
          `📈 **Scale Enhancement**: Increased daily caps and expanded targeting reach`,
        );
      }
    }

    // Viewability optimizations
    if (request.includes("viewability")) {
      const viewabilityMatch = request.match(
        /viewability.*?(\d+)%|(\d+)%.*?viewability/,
      );
      if (viewabilityMatch) {
        const percentage = viewabilityMatch[1] || viewabilityMatch[2];
        optimizations.push(
          `Improve viewability to ${percentage}% or higher through premium inventory selection and placement optimization`,
        );
        changes.push(
          `👁️ **Viewability Target**: Set minimum viewability standard to ${percentage}%`,
        );
        changes.push(
          `💎 **Premium Inventory**: Prioritized high-viewability placements and publishers`,
        );
      } else if (
        request.includes("increase viewability") ||
        request.includes("improve viewability")
      ) {
        optimizations.push(
          "Prioritize high-viewability inventory and premium placements to improve viewability metrics",
        );
        changes.push(
          `👁️ **Viewability Enhancement**: Enhanced inventory selection for higher viewability`,
        );
      }
    }

    // Completion rate optimizations
    if (
      request.includes("completion") &&
      (request.includes("rate") || request.includes("video"))
    ) {
      const completionMatch = request.match(
        /completion.*?(\d+)%|(\d+)%.*?completion/,
      );
      if (completionMatch) {
        const percentage = completionMatch[1] || completionMatch[2];
        optimizations.push(
          `Optimize for ${percentage}% video completion rate through inventory selection and creative matching`,
        );
        changes.push(
          `🎬 **Completion Target**: Set minimum video completion rate to ${percentage}%`,
        );
        changes.push(
          `🎯 **Creative Matching**: Enhanced contextual alignment for better completion`,
        );
      } else {
        optimizations.push(
          "Improve video completion rates through better inventory quality and contextual alignment",
        );
        changes.push(
          `🎬 **Completion Enhancement**: Improved inventory selection for higher completion rates`,
        );
      }
    }

    // Efficiency/CPM optimizations
    if (
      request.includes("efficiency") ||
      request.includes("cpm") ||
      request.includes("cost")
    ) {
      if (
        request.includes("reduce") ||
        request.includes("lower") ||
        request.includes("improve efficiency")
      ) {
        optimizations.push(
          "Optimize cost efficiency by improving inventory mix and reducing unnecessary data costs",
        );
        changes.push(
          `💰 **Cost Efficiency**: Optimized inventory mix to reduce CPM`,
        );
        changes.push(
          `📊 **Data Optimization**: Reduced unnecessary data costs`,
        );
      }
      const cpmMatch = request.match(/cpm.*?\$?(\d+)|target.*?\$?(\d+).*?cpm/);
      if (cpmMatch) {
        const targetCPM = cpmMatch[1] || cpmMatch[2];
        optimizations.push(
          `Target effective CPM of $${targetCPM} through strategic inventory allocation`,
        );
        changes.push(
          `💰 **CPM Target**: Set target effective CPM to $${targetCPM}`,
        );
      }
    }

    // Brand safety optimizations
    if (request.includes("brand safety") || request.includes("safety")) {
      optimizations.push(
        "Enhance brand safety standards with stricter content filtering and premium publisher focus",
      );
      changes.push(
        `🛡️ **Brand Safety**: Enhanced content filtering and safety standards`,
      );
      changes.push(
        `✅ **Premium Publishers**: Focused on verified, brand-safe publishers`,
      );
    }

    // Reach optimizations
    if (request.includes("reach") && !request.includes("scale")) {
      const reachMatch = request.match(
        /reach.*?(\d+(?:\.\d+)?)[mk]?|(\d+(?:\.\d+)?)[mk]?.*?reach/i,
      );
      if (reachMatch) {
        const reachValue = reachMatch[1] || reachMatch[2];
        const unit = request.includes("m")
          ? "million"
          : request.includes("k")
            ? "thousand"
            : "";
        optimizations.push(
          `Expand targeting to achieve ${reachValue}${unit ? " " + unit : ""} unique reach`,
        );
        changes.push(
          `🌐 **Reach Target**: Set unique reach goal to ${reachValue}${unit ? " " + unit : ""} users`,
        );
        changes.push(
          `🎯 **Targeting Expansion**: Broadened audience parameters for increased reach`,
        );
      } else {
        optimizations.push(
          "Expand targeting parameters to maximize unique user reach",
        );
        changes.push(
          `🌐 **Reach Maximization**: Expanded targeting to maximize unique user reach`,
        );
      }
    }

    // If no specific optimizations found, provide general guidance
    if (optimizations.length === 0) {
      optimizations.push(
        `Apply the following optimization request: ${changeRequest}`,
      );
      changes.push(
        `⚙️ **General Optimization**: Applied custom optimization request`,
      );
    }

    // Create updated prompt
    let updatedPrompt;
    if (currentPrompt) {
      // Append optimizations to existing prompt
      const optimizationText = optimizations.join(". ");
      updatedPrompt = `${currentPrompt}

OPTIMIZATION REQUEST: ${optimizationText}`;
    } else {
      // Create new prompt with optimizations
      const optimizationText = optimizations.join(". ");
      updatedPrompt = `Campaign optimization request: ${optimizationText}`;
    }

    return {
      changes,
      originalRequest: changeRequest,
      updatedPrompt,
    };
  }
}
