import type { AuthenticationService } from "../auth-service.js";
import type { CampaignBigQueryService } from "../campaign-bigquery-service.js";

interface PreloadConfig {
  enabled: boolean;
  maxBrandAgents: number;
  maxCampaignsPerAgent: number;
  loadRecentCampaigns: boolean;
  concurrentRequests: number;
}

export class PreloadService {
  private preloadPromises = new Map<number, Promise<void>>();
  private triggerPromises = new Map<string, Promise<void>>();

  constructor(
    private campaignService: CampaignBigQueryService,
    private authService: AuthenticationService,
    private config: PreloadConfig = DEFAULT_PRELOAD_CONFIG,
  ) {}

  /**
   * Trigger preload for a customer (fire-and-forget)
   * Returns immediately, preload continues in background
   */
  triggerPreload(apiKey: string): void {
    if (!this.config.enabled) {
      console.log("[Preload] Disabled by config");
      return;
    }

    // Check if we're already processing this API key
    if (this.triggerPromises.has(apiKey)) {
      console.log("[Preload] Already triggered for this API key");
      return;
    }

    // Start preload but don't wait for it - use setTimeout to ensure it's truly async
    const triggerPromise = new Promise<void>((resolve) => {
      setTimeout(async () => {
        try {
          await this.preloadCustomerData(apiKey);
          resolve();
        } catch (err) {
          console.error("[Preload] Background preload failed:", err);
          resolve(); // Always resolve to clean up
        } finally {
          this.triggerPromises.delete(apiKey);
        }
      }, 0);
    });

    this.triggerPromises.set(apiKey, triggerPromise);
  }

  /**
   * Preload common data for a customer
   * Uses existing service methods to populate cache
   */
  async preloadCustomerData(apiKey: string): Promise<void> {
    try {
      console.log("[Preload] Starting customer data preload");
      const startTime = Date.now();

      // Get customer ID for scoping
      const customerId = await this.authService.getCustomerIdFromToken(apiKey);
      if (!customerId) {
        console.log("[Preload] No customer ID found, skipping");
        return;
      }

      // Check if already preloading for this customer
      if (this.preloadPromises.has(customerId)) {
        console.log(
          `[Preload] Already preloading for customer ${customerId}, waiting...`,
        );
        return this.preloadPromises.get(customerId);
      }

      // Create preload promise to prevent duplicates
      const preloadPromise = this.doPreload(apiKey, customerId);
      this.preloadPromises.set(customerId, preloadPromise);

      try {
        await preloadPromise;
        const duration = Date.now() - startTime;
        console.log(
          `[Preload] Customer ${customerId} preload completed in ${duration}ms`,
        );
      } finally {
        this.preloadPromises.delete(customerId);
      }
    } catch (error) {
      console.error("[Preload] Preload failed:", error);
    }
  }

  private async doPreload(apiKey: string, customerId: number): Promise<void> {
    // Step 1: Load brand agents (this will cache them via CachedBigQuery)
    console.log(`[Preload] Loading brand agents for customer ${customerId}`);
    const brandAgents = await this.campaignService.listBrandAgents(customerId);
    console.log(`[Preload] Found ${brandAgents.length} brand agents`);

    if (brandAgents.length === 0) {
      console.log("[Preload] No brand agents found, preload complete");
      return;
    }

    // Step 2: Load campaigns for top brand agents
    const agentsToPreload = brandAgents.slice(0, this.config.maxBrandAgents);
    console.log(
      `[Preload] Loading campaigns for top ${agentsToPreload.length} brand agents`,
    );

    // Process agents in batches to avoid overwhelming BigQuery
    const batchSize = this.config.concurrentRequests;
    for (let i = 0; i < agentsToPreload.length; i += batchSize) {
      const batch = agentsToPreload.slice(i, i + batchSize);

      const campaignPromises = batch.map(async (agent) => {
        try {
          // Load all campaigns for this agent
          const allCampaigns = await this.campaignService.listCampaigns(
            agent.id,
            undefined, // No status filter - get all
            apiKey,
          );

          // Also load active campaigns separately (different cache key)
          const activeCampaigns = await this.campaignService.listCampaigns(
            agent.id,
            "active",
            apiKey,
          );

          console.log(
            `[Preload] Agent ${agent.id}: ${allCampaigns.length} total, ${activeCampaigns.length} active campaigns`,
          );

          // Load individual campaign details for recent ones
          if (this.config.loadRecentCampaigns && allCampaigns.length > 0) {
            const recentCampaigns = allCampaigns
              .slice(0, this.config.maxCampaignsPerAgent)
              .map((c) => c.id);

            // Load campaign details in parallel
            await Promise.allSettled(
              recentCampaigns.map((campaignId) =>
                this.campaignService.getCampaign(campaignId, apiKey),
              ),
            );

            console.log(
              `[Preload] Loaded details for ${recentCampaigns.length} recent campaigns for agent ${agent.id}`,
            );
          }

          return { agentId: agent.id, campaignCount: allCampaigns.length };
        } catch (err) {
          console.warn(
            `[Preload] Failed to load campaigns for agent ${agent.id}:`,
            err,
          );
          return { agentId: agent.id, campaignCount: 0, error: err };
        }
      });

      // Wait for this batch to complete
      const results = await Promise.allSettled(campaignPromises);
      const successful = results.filter((r) => r.status === "fulfilled").length;
      console.log(
        `[Preload] Batch ${Math.floor(i / batchSize) + 1}: ${successful}/${batch.length} agents processed`,
      );
    }

    // Step 3: Load some brand agent details individually (for getBrandAgent calls)
    console.log("[Preload] Loading individual brand agent details");
    const topAgentsForDetails = brandAgents.slice(
      0,
      Math.min(10, brandAgents.length),
    );

    await Promise.allSettled(
      topAgentsForDetails.map((agent) =>
        this.campaignService.getBrandAgent(agent.id),
      ),
    );

    console.log(
      `[Preload] Loaded individual details for ${topAgentsForDetails.length} brand agents`,
    );
  }

  /**
   * Get preload status for debugging
   */
  getPreloadStatus(): { activePreloads: number; customerIds: number[] } {
    return {
      activePreloads: this.preloadPromises.size + this.triggerPromises.size,
      customerIds: Array.from(this.preloadPromises.keys()),
    };
  }

  /**
   * Wait for all active preloads to complete (for testing)
   */
  async waitForAllPreloads(): Promise<void> {
    // Wait for both trigger promises and preload promises
    await Promise.allSettled([
      ...Array.from(this.triggerPromises.values()),
      ...Array.from(this.preloadPromises.values()),
    ]);
  }
}

export const DEFAULT_PRELOAD_CONFIG: PreloadConfig = {
  enabled: true,
  maxBrandAgents: 10, // Load campaigns for top 10 brand agents
  maxCampaignsPerAgent: 20, // Load details for up to 20 recent campaigns per agent
  loadRecentCampaigns: true, // Whether to load individual campaign details
  concurrentRequests: 3, // Process 3 brand agents at a time
};
