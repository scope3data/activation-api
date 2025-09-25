/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AuthenticationService } from "../auth-service.js";
import type { CampaignBigQueryService } from "../campaign-bigquery-service.js";

interface AdTechPreloadConfig {
  // Performance tuning
  concurrentRequests: number;

  enabled: boolean;
  loadBudgetData: boolean;

  loadSpendData: boolean;
  // Brand agent prioritization
  maxBrandAgents: number;
  // Campaign prioritization
  maxCampaignsPerAgent: number;
  preloadFrequency: number; // How often to refresh preloaded data (minutes)

  prioritizeActiveCampaigns: boolean;
  prioritizeActiveSpenders: boolean;

  warmBrandStoryAssignments: boolean;
  // Ad tech specific warming
  warmCreativeAssignments: boolean;
  warmRecentSpendData: boolean;
}

/**
 * Ad tech-specific cache warming service
 * Optimizes for campaign management and spend tracking patterns
 */
export class AdTechPreloadService {
  private preloadPromises = new Map<number, Promise<void>>();
  private refreshIntervals = new Map<number, NodeJS.Timeout>();

  constructor(
    private campaignService: CampaignBigQueryService,
    private authService: AuthenticationService,
    private config: AdTechPreloadConfig = AD_TECH_PRELOAD_CONFIG,
  ) {}

  /**
   * Cleanup method to clear intervals
   */
  cleanup(): void {
    for (const [customerId, timer] of this.refreshIntervals.entries()) {
      clearInterval(timer);
      console.log(
        `[AdTechPreload] Cleaned up refresh timer for customer ${customerId}`,
      );
    }
    this.refreshIntervals.clear();
  }

  /**
   * Enhanced preload with ad tech optimization patterns
   */
  async preloadCustomerData(apiKey: string): Promise<void> {
    try {
      console.log("[AdTechPreload] Starting ad tech optimized preload");
      const startTime = Date.now();

      const customerId = await this.authService.getCustomerIdFromToken(apiKey);
      if (!customerId) {
        console.log("[AdTechPreload] No customer ID found, skipping");
        return;
      }

      // Prevent duplicate preloads
      if (this.preloadPromises.has(customerId)) {
        return this.preloadPromises.get(customerId);
      }

      const preloadPromise = this.doAdTechPreload(apiKey, customerId);
      this.preloadPromises.set(customerId, preloadPromise);

      try {
        await preloadPromise;
        const duration = Date.now() - startTime;
        console.log(
          `[AdTechPreload] Customer ${customerId} preload completed in ${duration}ms`,
        );

        // Schedule periodic refresh for active data
        this.schedulePeriodicRefresh(apiKey, customerId);
      } finally {
        this.preloadPromises.delete(customerId);
      }
    } catch (error) {
      console.error("[AdTechPreload] Ad tech preload failed:", error);
    }
  }

  private async doAdTechPreload(
    apiKey: string,
    customerId: number,
  ): Promise<void> {
    // Step 1: Load and prioritize brand agents
    const brandAgents = await this.loadAndPrioritizeBrandAgents(customerId);

    // Step 2: Load active campaigns with spend data
    await this.preloadActiveCampaigns(apiKey, brandAgents);

    // Step 3: Warm budget and spend tracking queries
    await this.warmBudgetTrackingData(apiKey, brandAgents);

    // Step 4: Preload creative assignments for active campaigns
    if (this.config.warmCreativeAssignments) {
      await this.warmCreativeAssignments(apiKey, brandAgents);
    }

    // Step 5: Warm brand story assignments
    if (this.config.warmBrandStoryAssignments) {
      await this.warmBrandStoryAssignments(apiKey, brandAgents);
    }
  }

  /**
   * Load brand agents and prioritize by ad spending activity
   */
  private async loadAndPrioritizeBrandAgents(customerId: number) {
    console.log(
      `[AdTechPreload] Loading brand agents for customer ${customerId}`,
    );
    const brandAgents = await this.campaignService.listBrandAgents(customerId);

    if (!this.config.prioritizeActiveSpenders) {
      return brandAgents.slice(0, this.config.maxBrandAgents);
    }

    // TODO: Add spend-based prioritization when spend data is available
    // For now, return top agents by ID (could be enhanced with spend history)
    console.log(
      `[AdTechPreload] Prioritizing ${brandAgents.length} brand agents by activity`,
    );
    return brandAgents.slice(0, this.config.maxBrandAgents);
  }

  /**
   * Preload active campaigns with focus on spend tracking
   */
  private async preloadActiveCampaigns(
    apiKey: string,
    brandAgents: any[],
  ): Promise<void> {
    console.log("[AdTechPreload] Loading active campaigns with spend focus");

    const batchSize = this.config.concurrentRequests;
    for (let i = 0; i < brandAgents.length; i += batchSize) {
      const batch = brandAgents.slice(i, i + batchSize);

      await Promise.allSettled(
        batch.map(async (agent) => {
          try {
            // Prioritize active campaigns
            const activeCampaigns = await this.campaignService.listCampaigns(
              agent.id,
              "active",
              apiKey,
            );

            // Also load all campaigns for management UI
            const allCampaigns = await this.campaignService.listCampaigns(
              agent.id,
              undefined,
              apiKey,
            );

            console.log(
              `[AdTechPreload] Agent ${agent.id}: ${activeCampaigns.length} active, ${allCampaigns.length} total campaigns`,
            );

            // Load individual campaign details for active campaigns
            if (activeCampaigns.length > 0) {
              const campaignsToDetail = activeCampaigns.slice(
                0,
                this.config.maxCampaignsPerAgent,
              );
              await Promise.allSettled(
                campaignsToDetail.map((c) =>
                  this.campaignService.getCampaign(c.id, apiKey),
                ),
              );
            }
          } catch (err) {
            console.warn(
              `[AdTechPreload] Failed to load campaigns for agent ${agent.id}:`,
              err,
            );
          }
        }),
      );
    }
  }

  /**
   * Refresh only critical, fast-changing data
   */
  private async refreshCriticalData(
    apiKey: string,
    customerId: number,
  ): Promise<void> {
    const brandAgents = await this.campaignService.listBrandAgents(customerId);
    const topAgents = brandAgents.slice(0, Math.min(5, brandAgents.length));

    // Refresh active campaign lists (status may have changed)
    await Promise.allSettled(
      topAgents.map((agent) =>
        this.campaignService.listCampaigns(agent.id, "active", apiKey),
      ),
    );

    console.log(
      `[AdTechPreload] Refreshed critical data for ${topAgents.length} top brand agents`,
    );
  }

  /**
   * Schedule periodic refresh of critical ad tech data
   * Focuses on spend tracking and budget status
   */
  private schedulePeriodicRefresh(apiKey: string, customerId: number): void {
    // Clear existing refresh timer
    const existingTimer = this.refreshIntervals.get(customerId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    const refreshMs = this.config.preloadFrequency * 60 * 1000;
    const timer = setInterval(async () => {
      console.log(
        `[AdTechPreload] Periodic refresh for customer ${customerId}`,
      );

      try {
        // Only refresh critical data, not full preload
        await this.refreshCriticalData(apiKey, customerId);
      } catch (err) {
        console.error(
          `[AdTechPreload] Periodic refresh failed for customer ${customerId}:`,
          err,
        );
      }
    }, refreshMs);

    this.refreshIntervals.set(customerId, timer);
    console.log(
      `[AdTechPreload] Scheduled periodic refresh every ${this.config.preloadFrequency} minutes for customer ${customerId}`,
    );
  }

  /**
   * Warm brand story assignment queries
   */
  private async warmBrandStoryAssignments(
    apiKey: string,
    brandAgents: any[],
  ): Promise<void> {
    console.log("[AdTechPreload] Warming brand story assignments");

    // This would need brand story assignment querying methods
    for (const agent of brandAgents) {
      console.log(
        `[AdTechPreload] Would warm brand story assignments for brand agent ${agent.id}`,
      );
    }
  }

  /**
   * Critical: Warm budget and spend tracking queries
   * These are the most time-sensitive for ad tech operations
   */
  private async warmBudgetTrackingData(
    apiKey: string,
    brandAgents: any[],
  ): Promise<void> {
    if (!this.config.loadBudgetData && !this.config.loadSpendData) {
      return;
    }

    console.log("[AdTechPreload] Warming budget and spend tracking data");

    for (const agent of brandAgents) {
      try {
        // Get active campaigns for budget tracking
        const activeCampaigns = await this.campaignService.listCampaigns(
          agent.id,
          "active",
          apiKey,
        );

        // For each active campaign, warm budget-related queries
        const budgetPromises = activeCampaigns.map(async (campaign) => {
          if (this.config.loadBudgetData) {
            // Trigger budget status queries (these will be cached)
            // Note: This would need actual budget tracking methods in the service
            console.log(
              `[AdTechPreload] Would warm budget data for campaign ${campaign.id}`,
            );
          }

          if (this.config.loadSpendData && this.config.warmRecentSpendData) {
            // Trigger recent spend queries (these will be cached)
            console.log(
              `[AdTechPreload] Would warm spend data for campaign ${campaign.id}`,
            );
          }
        });

        await Promise.allSettled(budgetPromises);
      } catch (err) {
        console.warn(
          `[AdTechPreload] Failed to warm budget data for agent ${agent.id}:`,
          err,
        );
      }
    }
  }

  /**
   * Warm creative assignment queries for active campaigns
   */
  private async warmCreativeAssignments(
    apiKey: string,
    brandAgents: any[],
  ): Promise<void> {
    console.log("[AdTechPreload] Warming creative assignments");

    // This would need creative assignment querying methods
    // For now, log the intent
    for (const agent of brandAgents) {
      console.log(
        `[AdTechPreload] Would warm creative assignments for brand agent ${agent.id}`,
      );
    }
  }
}

export const AD_TECH_PRELOAD_CONFIG: AdTechPreloadConfig = {
  // Performance tuning for ad tech workloads
  concurrentRequests: 5, // Higher concurrency for ad tech

  enabled: true,
  loadBudgetData: true,

  loadSpendData: true,
  // Prioritize active spenders
  maxBrandAgents: 10,
  // Focus on active campaigns
  maxCampaignsPerAgent: 15,
  preloadFrequency: 5, // Refresh every 5 minutes

  prioritizeActiveCampaigns: true,
  prioritizeActiveSpenders: true,

  warmBrandStoryAssignments: true,
  // Ad tech specific warming
  warmCreativeAssignments: true,
  warmRecentSpendData: true,
};
