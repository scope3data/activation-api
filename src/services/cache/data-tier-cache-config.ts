/**
 * Ad tech data tiering and caching strategy
 * Separates real-time operational data from campaign management data
 */

export interface DataTierConfig {
  name: string;
  ttl: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  invalidationStrategy: 'immediate' | 'lazy' | 'scheduled';
  description: string;
}

/**
 * Ad Tech Data Tiers for Scope3 Campaign API
 * Based on OpenRTB and programmatic advertising requirements
 */
export const AD_TECH_DATA_TIERS: Record<string, DataTierConfig> = {
  // TIER 1: REAL-TIME BIDDING DATA (if applicable)
  // NOTE: Scope3 is campaign management focused, but planning for future RTB integration
  bidRequests: {
    name: 'bid_requests',
    ttl: 0, // No caching - real-time only
    priority: 'critical',
    invalidationStrategy: 'immediate',
    description: 'OpenRTB bid requests - never cache'
  },
  
  bidResponses: {
    name: 'bid_responses', 
    ttl: 0, // No caching - real-time only
    priority: 'critical',
    invalidationStrategy: 'immediate',
    description: 'OpenRTB bid responses - never cache'
  },
  
  // TIER 2: BUDGET & SPEND TRACKING (CRITICAL for campaign management)
  campaignSpend: {
    name: 'campaign_spend',
    ttl: 10 * 1000, // 10 seconds - critical for budget protection
    priority: 'critical',
    invalidationStrategy: 'immediate',
    description: 'Real-time spend tracking for budget management'
  },
  
  budgetStatus: {
    name: 'budget_status',
    ttl: 15 * 1000, // 15 seconds - budget exhaustion checks
    priority: 'critical', 
    invalidationStrategy: 'immediate',
    description: 'Campaign budget remaining and pacing status'
  },
  
  dailySpendSummary: {
    name: 'daily_spend_summary',
    ttl: 30 * 1000, // 30 seconds - daily budget tracking
    priority: 'high',
    invalidationStrategy: 'immediate',
    description: 'Daily spend aggregations for budget controls'
  },
  
  // TIER 3: CAMPAIGN OPERATIONAL DATA (HIGH priority)
  campaignStatus: {
    name: 'campaign_status',
    ttl: 30 * 1000, // 30 seconds - campaign on/off states
    priority: 'high',
    invalidationStrategy: 'immediate', 
    description: 'Campaign active/paused/ended status'
  },
  
  creativeAssignments: {
    name: 'creative_assignments',
    ttl: 45 * 1000, // 45 seconds - creative rotations
    priority: 'high',
    invalidationStrategy: 'lazy',
    description: 'Campaign-creative assignment mappings'
  },
  
  targetingRules: {
    name: 'targeting_rules',
    ttl: 60 * 1000, // 1 minute - targeting changes
    priority: 'high', 
    invalidationStrategy: 'lazy',
    description: 'Brand story and audience targeting rules'
  },
  
  // TIER 4: CAMPAIGN MANAGEMENT DATA (MEDIUM priority)
  campaignMetadata: {
    name: 'campaign_metadata',
    ttl: 2 * 60 * 1000, // 2 minutes - campaign details
    priority: 'medium',
    invalidationStrategy: 'lazy',
    description: 'Campaign names, descriptions, objectives'
  },
  
  campaignLists: {
    name: 'campaign_lists',
    ttl: 90 * 1000, // 90 seconds - list views
    priority: 'medium',
    invalidationStrategy: 'lazy',
    description: 'Filtered campaign lists for management UI'
  },
  
  // TIER 5: BRAND AGENT DATA (MEDIUM priority)
  brandAgentMetadata: {
    name: 'brand_agent_metadata', 
    ttl: 2 * 60 * 1000, // 2 minutes - brand agent details
    priority: 'medium',
    invalidationStrategy: 'lazy',
    description: 'Brand agent names, settings, preferences'
  },
  
  brandAgentLists: {
    name: 'brand_agent_lists',
    ttl: 3 * 60 * 1000, // 3 minutes - brand agent lists
    priority: 'medium',
    invalidationStrategy: 'scheduled',
    description: 'Brand agent directory and filtering'
  },
  
  // TIER 6: CREATIVE ASSETS (LOW priority - stable content)
  creativeMetadata: {
    name: 'creative_metadata',
    ttl: 5 * 60 * 1000, // 5 minutes - creative details
    priority: 'medium',
    invalidationStrategy: 'lazy',
    description: 'Creative asset metadata, formats, content'
  },
  
  creativeLists: {
    name: 'creative_lists',
    ttl: 5 * 60 * 1000, // 5 minutes - creative libraries
    priority: 'low',
    invalidationStrategy: 'scheduled',
    description: 'Creative asset libraries and search'
  },
  
  // TIER 7: AUTHENTICATION & AUTHORIZATION (LOW frequency)
  customerAuth: {
    name: 'customer_auth',
    ttl: 10 * 60 * 1000, // 10 minutes - auth tokens
    priority: 'high', // High priority but low frequency
    invalidationStrategy: 'lazy',
    description: 'Customer authentication and API key validation'
  },
  
  // TIER 8: REPORTING DATA (LOW priority - analytical)
  performanceMetrics: {
    name: 'performance_metrics',
    ttl: 5 * 60 * 1000, // 5 minutes - campaign performance
    priority: 'low',
    invalidationStrategy: 'scheduled',
    description: 'Campaign performance reports and analytics'
  },
  
  aggregatedReports: {
    name: 'aggregated_reports',
    ttl: 15 * 60 * 1000, // 15 minutes - summary reports
    priority: 'low',
    invalidationStrategy: 'scheduled',
    description: 'Cross-campaign and account-level reporting'
  }
};

/**
 * Enhanced cache key generator that includes data tier information
 */
export function generateTieredCacheKey(
  dataType: keyof typeof AD_TECH_DATA_TIERS,
  identifiers: Record<string, string | number>,
  filters?: Record<string, unknown>
): string {
  const tier = AD_TECH_DATA_TIERS[dataType];
  const baseKey = `${tier.name}:${tier.priority}`;
  
  // Add identifiers (campaign_id, brand_agent_id, etc.)
  const idPart = Object.entries(identifiers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  
  // Add filters if present
  const filterPart = filters ? 
    ':filters:' + Buffer.from(JSON.stringify(filters)).toString('base64') : 
    '';
  
  return `${baseKey}:${idPart}${filterPart}`;
}

/**
 * Cache configuration factory based on data tiers
 */
export function createTieredCacheConfig(tiers: (keyof typeof AD_TECH_DATA_TIERS)[]): Record<string, number> {
  const config: Record<string, number> = {};
  
  for (const tierKey of tiers) {
    const tier = AD_TECH_DATA_TIERS[tierKey];
    config[tier.name] = tier.ttl;
  }
  
  return config;
}

/**
 * Get invalidation strategy for a data type
 */
export function getInvalidationStrategy(dataType: keyof typeof AD_TECH_DATA_TIERS): 'immediate' | 'lazy' | 'scheduled' {
  return AD_TECH_DATA_TIERS[dataType].invalidationStrategy;
}

/**
 * Recommended cache configuration for Scope3 Campaign API
 */
export const SCOPE3_CAMPAIGN_CACHE_CONFIG = createTieredCacheConfig([
  'campaignSpend',
  'budgetStatus', 
  'dailySpendSummary',
  'campaignStatus',
  'creativeAssignments',
  'targetingRules',
  'campaignMetadata',
  'campaignLists',
  'brandAgentMetadata',
  'brandAgentLists',
  'creativeMetadata',
  'creativeLists',
  'customerAuth',
  'performanceMetrics',
  'aggregatedReports'
]);

// Export for use in CachedBigQuery
export const AD_TECH_TTL_MAP = SCOPE3_CAMPAIGN_CACHE_CONFIG;