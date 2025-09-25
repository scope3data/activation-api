import type { CachedBigQuery } from "./cached-bigquery.js";

export interface CampaignEvent {
  type: 'campaign_created' | 'campaign_updated' | 'campaign_deleted' | 
        'budget_updated' | 'spend_recorded' | 'status_changed' |
        'creative_assigned' | 'creative_unassigned';
  campaignId: string;
  brandAgentId: string;
  metadata?: Record<string, unknown>;
}

/**
 * Handles cache invalidation for campaign lifecycle events
 * Critical for maintaining data consistency in ad tech operations
 */
export class CampaignCacheInvalidator {
  constructor(private cachedBigQuery: CachedBigQuery) {}

  /**
   * Invalidate cache based on campaign events
   * Uses surgical invalidation to minimize cache churn
   */
  async invalidateForEvent(event: CampaignEvent): Promise<void> {
    console.log(`[CacheInvalidator] Processing event: ${event.type} for campaign ${event.campaignId}`);
    
    switch (event.type) {
      case 'campaign_created':
        await this.invalidateCampaignLists(event.brandAgentId);
        break;
        
      case 'campaign_updated':
        await this.invalidateCampaignData(event.campaignId);
        await this.invalidateCampaignLists(event.brandAgentId);
        break;
        
      case 'campaign_deleted':
        await this.invalidateCampaignData(event.campaignId);
        await this.invalidateCampaignLists(event.brandAgentId);
        break;
        
      case 'budget_updated':
        // Invalidate budget-related queries immediately
        await this.invalidateBudgetData(event.campaignId);
        break;
        
      case 'spend_recorded':
        // Critical: Spend tracking must be real-time for budget management
        await this.invalidateSpendData(event.campaignId);
        await this.invalidateBudgetData(event.campaignId);
        break;
        
      case 'status_changed':
        // Status changes affect campaign lists and individual campaign data
        await this.invalidateCampaignData(event.campaignId);
        await this.invalidateCampaignLists(event.brandAgentId);
        break;
        
      case 'creative_assigned':
      case 'creative_unassigned':
        // Invalidate creative assignment queries
        await this.invalidateCreativeAssignments(event.campaignId);
        break;
    }
  }

  /**
   * Invalidate all campaign list queries for a brand agent
   * Covers: listCampaigns with various filters
   */
  private async invalidateCampaignLists(brandAgentId: string): Promise<void> {
    // Pattern matching for campaign list queries
    const patterns = [
      `campaigns.*brand_agent_id.*${brandAgentId}`,
      `campaigns.*WHERE.*${brandAgentId}`,
      `listCampaigns_${brandAgentId}` // If using method-based cache keys
    ];
    
    for (const pattern of patterns) {
      this.cachedBigQuery.invalidatePattern(pattern);
    }
  }

  /**
   * Invalidate individual campaign data
   */
  private async invalidateCampaignData(campaignId: string): Promise<void> {
    const patterns = [
      `campaigns.*id.*${campaignId}`,
      `getCampaign_${campaignId}`,
      `campaign_details_${campaignId}`
    ];
    
    for (const pattern of patterns) {
      this.cachedBigQuery.invalidatePattern(pattern);
    }
  }

  /**
   * Invalidate budget-related data (HIGH PRIORITY for ad tech)
   */
  private async invalidateBudgetData(campaignId: string): Promise<void> {
    const patterns = [
      `budget.*${campaignId}`,
      `spend.*${campaignId}`,
      `remaining_budget.*${campaignId}`
    ];
    
    for (const pattern of patterns) {
      this.cachedBigQuery.invalidatePattern(pattern);
    }
  }

  /**
   * Invalidate spend tracking data (CRITICAL for real-time budget management)
   */
  private async invalidateSpendData(campaignId: string): Promise<void> {
    const patterns = [
      `spend.*${campaignId}`,
      `daily_spend.*${campaignId}`,
      `hourly_spend.*${campaignId}`,
      `budget_utilization.*${campaignId}`
    ];
    
    for (const pattern of patterns) {
      this.cachedBigQuery.invalidatePattern(pattern);
    }
  }

  /**
   * Invalidate creative assignment data
   */
  private async invalidateCreativeAssignments(campaignId: string): Promise<void> {
    const patterns = [
      `campaign_creatives.*${campaignId}`,
      `creative_assignments.*${campaignId}`
    ];
    
    for (const pattern of patterns) {
      this.cachedBigQuery.invalidatePattern(pattern);
    }
  }

  /**
   * Emergency cache flush for critical data consistency issues
   * Use sparingly - impacts performance
   */
  async emergencyFlush(reason: string): Promise<void> {
    console.warn(`[CacheInvalidator] Emergency cache flush: ${reason}`);
    this.cachedBigQuery.invalidatePattern(''); // Clears all cache
  }
}