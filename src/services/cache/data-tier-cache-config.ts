/**
 * Ad tech data tiering and caching strategy
 * Separates real-time operational data from campaign management data
 */

export interface DataTierConfig {
  description: string;
  invalidationStrategy: "immediate" | "lazy" | "scheduled";
  name: string;
  priority: "critical" | "high" | "low" | "medium";
  ttl: number;
}

/**
 * Ad Tech Data Tiers for Scope3 Campaign API
 * Based on OpenRTB and programmatic advertising requirements
 */
export const AD_TECH_DATA_TIERS: Record<string, DataTierConfig> = {
  aggregatedReports: {
    description: "Cross-campaign and account-level reporting",
    invalidationStrategy: "scheduled",
    name: "aggregated_reports",
    priority: "low",
    ttl: 15 * 60 * 1000, // 15 minutes - summary reports
  },

  // TIER 1: REAL-TIME BIDDING DATA (if applicable)
  // NOTE: Scope3 is campaign management focused, but planning for future RTB integration
  bidRequests: {
    description: "OpenRTB bid requests - never cache",
    invalidationStrategy: "immediate",
    name: "bid_requests",
    priority: "critical",
    ttl: 0, // No caching - real-time only
  },

  bidResponses: {
    description: "OpenRTB bid responses - never cache",
    invalidationStrategy: "immediate",
    name: "bid_responses",
    priority: "critical",
    ttl: 0, // No caching - real-time only
  },

  brandAgentLists: {
    description: "Brand agent directory and filtering",
    invalidationStrategy: "scheduled",
    name: "brand_agent_lists",
    priority: "medium",
    ttl: 3 * 60 * 1000, // 3 minutes - brand agent lists
  },

  // TIER 5: BRAND AGENT DATA (MEDIUM priority)
  brandAgentMetadata: {
    description: "Brand agent names, settings, preferences",
    invalidationStrategy: "lazy",
    name: "brand_agent_metadata",
    priority: "medium",
    ttl: 2 * 60 * 1000, // 2 minutes - brand agent details
  },

  budgetStatus: {
    description: "Campaign budget remaining and pacing status",
    invalidationStrategy: "immediate",
    name: "budget_status",
    priority: "critical",
    ttl: 15 * 1000, // 15 seconds - budget exhaustion checks
  },

  campaignLists: {
    description: "Filtered campaign lists for management UI",
    invalidationStrategy: "lazy",
    name: "campaign_lists",
    priority: "medium",
    ttl: 90 * 1000, // 90 seconds - list views
  },

  // TIER 4: CAMPAIGN MANAGEMENT DATA (MEDIUM priority)
  campaignMetadata: {
    description: "Campaign names, descriptions, objectives",
    invalidationStrategy: "lazy",
    name: "campaign_metadata",
    priority: "medium",
    ttl: 2 * 60 * 1000, // 2 minutes - campaign details
  },

  // TIER 2: BUDGET & SPEND TRACKING (CRITICAL for campaign management)
  campaignSpend: {
    description: "Real-time spend tracking for budget management",
    invalidationStrategy: "immediate",
    name: "campaign_spend",
    priority: "critical",
    ttl: 10 * 1000, // 10 seconds - critical for budget protection
  },

  // TIER 3: CAMPAIGN OPERATIONAL DATA (HIGH priority)
  campaignStatus: {
    description: "Campaign active/paused/ended status",
    invalidationStrategy: "immediate",
    name: "campaign_status",
    priority: "high",
    ttl: 30 * 1000, // 30 seconds - campaign on/off states
  },

  creativeAssignments: {
    description: "Campaign-creative assignment mappings",
    invalidationStrategy: "lazy",
    name: "creative_assignments",
    priority: "high",
    ttl: 45 * 1000, // 45 seconds - creative rotations
  },

  creativeLists: {
    description: "Creative asset libraries and search",
    invalidationStrategy: "scheduled",
    name: "creative_lists",
    priority: "low",
    ttl: 5 * 60 * 1000, // 5 minutes - creative libraries
  },

  // TIER 6: CREATIVE ASSETS (LOW priority - stable content)
  creativeMetadata: {
    description: "Creative asset metadata, formats, content",
    invalidationStrategy: "lazy",
    name: "creative_metadata",
    priority: "medium",
    ttl: 5 * 60 * 1000, // 5 minutes - creative details
  },

  // TIER 7: AUTHENTICATION & AUTHORIZATION (LOW frequency)
  customerAuth: {
    description: "Customer authentication and API key validation",
    invalidationStrategy: "lazy",
    name: "customer_auth",
    priority: "high", // High priority but low frequency
    ttl: 10 * 60 * 1000, // 10 minutes - auth tokens
  },

  dailySpendSummary: {
    description: "Daily spend aggregations for budget controls",
    invalidationStrategy: "immediate",
    name: "daily_spend_summary",
    priority: "high",
    ttl: 30 * 1000, // 30 seconds - daily budget tracking
  },

  // TIER 8: REPORTING DATA (LOW priority - analytical)
  performanceMetrics: {
    description: "Campaign performance reports and analytics",
    invalidationStrategy: "scheduled",
    name: "performance_metrics",
    priority: "low",
    ttl: 5 * 60 * 1000, // 5 minutes - campaign performance
  },

  targetingRules: {
    description: "Brand story and audience targeting rules",
    invalidationStrategy: "lazy",
    name: "targeting_rules",
    priority: "high",
    ttl: 60 * 1000, // 1 minute - targeting changes
  },
};

/**
 * Cache configuration factory based on data tiers
 */
export function createTieredCacheConfig(
  tiers: (keyof typeof AD_TECH_DATA_TIERS)[],
): Record<string, number> {
  const config: Record<string, number> = {};

  for (const tierKey of tiers) {
    const tier = AD_TECH_DATA_TIERS[tierKey];
    config[tier.name] = tier.ttl;
  }

  return config;
}

/**
 * Enhanced cache key generator that includes data tier information
 */
export function generateTieredCacheKey(
  dataType: keyof typeof AD_TECH_DATA_TIERS,
  identifiers: Record<string, number | string>,
  filters?: Record<string, unknown>,
): string {
  const tier = AD_TECH_DATA_TIERS[dataType];
  const baseKey = `${tier.name}:${tier.priority}`;

  // Add identifiers (campaign_id, brand_agent_id, etc.)
  const idPart = Object.entries(identifiers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");

  // Add filters if present
  const filterPart = filters
    ? ":filters:" + Buffer.from(JSON.stringify(filters)).toString("base64")
    : "";

  return `${baseKey}:${idPart}${filterPart}`;
}

/**
 * Get invalidation strategy for a data type
 */
export function getInvalidationStrategy(
  dataType: keyof typeof AD_TECH_DATA_TIERS,
): "immediate" | "lazy" | "scheduled" {
  return AD_TECH_DATA_TIERS[dataType].invalidationStrategy;
}

/**
 * Recommended cache configuration for Scope3 Campaign API
 */
export const SCOPE3_CAMPAIGN_CACHE_CONFIG = createTieredCacheConfig([
  "campaignSpend",
  "budgetStatus",
  "dailySpendSummary",
  "campaignStatus",
  "creativeAssignments",
  "targetingRules",
  "campaignMetadata",
  "campaignLists",
  "brandAgentMetadata",
  "brandAgentLists",
  "creativeMetadata",
  "creativeLists",
  "customerAuth",
  "performanceMetrics",
  "aggregatedReports",
]);

// Export for use in CachedBigQuery
export const AD_TECH_TTL_MAP = SCOPE3_CAMPAIGN_CACHE_CONFIG;
