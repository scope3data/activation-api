/**
 * Tactic Repository Test Double
 *
 * In-memory implementation of TacticRepository for contract testing.
 * Simulates the prebid query chain: org_id → sales_agent → tactics → campaigns
 */

import type {
  EffectivePricing,
  PrebidSegment,
  Tactic,
  TacticInput,
  TacticListOptions,
  TacticListResult,
  TacticRepository,
  TacticUpdateInput,
} from "../contracts/tactic-repository.js";

interface TestCampaign {
  endDate?: string;
  id: string;
  startDate?: string;
  status: "active" | "draft" | "inactive" | "paused";
}

interface TestSalesAgent {
  id: string;
  name: string;
  orgId: string;
  status: "active" | "inactive";
}

export class TacticRepositoryTestDouble implements TacticRepository {
  private campaigns = new Map<string, TestCampaign>();
  private maxItems = 100;
  private nextId = 1;
  private salesAgents = new Map<string, TestSalesAgent>();
  private tactics = new Map<string, Tactic>();
  private validApiKeys = new Set<string>();

  addValidApiKey(apiKey: string): void {
    this.validApiKeys.add(apiKey);
  }

  clear(): void {
    this.tactics.clear();
    this.campaigns.clear();
    this.salesAgents.clear();
    this.nextId = 1;
  }

  async createTactic(
    apiKey: string,
    input: TacticInput,
    effectivePricing: EffectivePricing,
    salesAgentId: string,
  ): Promise<Tactic> {
    this.validateAuth(apiKey);
    this.validateTacticInput(input);

    // Check storage limits
    if (this.tactics.size >= this.maxItems) {
      throw new Error("Storage limit exceeded");
    }

    const now = new Date().toISOString();
    const tactic: Tactic = {
      axeIncludeSegment: this.generateAxeSegment(),
      brandStoryId: input.brandStoryId,
      budgetAllocation: input.budgetAllocation,
      campaignId: input.campaignId,
      createdAt: now,
      customerId: 1, // Test customer
      description: input.description,
      effectivePricing,
      id: this.generateId("tactic"),
      mediaProductId: input.mediaProductId,
      name: input.name,
      salesAgentId,
      signalId: input.signalId,
      status: "active",
      updatedAt: now,
    };

    this.tactics.set(tactic.id, tactic);
    return structuredClone(tactic);
  }

  async deleteTactic(apiKey: string, tacticId: string): Promise<void> {
    this.validateAuth(apiKey);

    const tactic = this.tactics.get(tacticId);
    if (tactic) {
      tactic.status = "inactive";
      tactic.updatedAt = new Date().toISOString();
      this.tactics.set(tacticId, tactic);
    }
  }

  async getPrebidSegments(orgId: string): Promise<PrebidSegment[]> {
    // Simulate the prebid query chain: org_id → sales_agent → tactics → campaigns
    const publisherSalesAgents = Array.from(this.salesAgents.values()).filter(
      (agent) => agent.orgId === orgId && agent.status === "active",
    );

    if (publisherSalesAgents.length === 0) {
      return [];
    }

    const salesAgentIds = publisherSalesAgents.map((agent) => agent.id);
    const activeTactics = Array.from(this.tactics.values()).filter((tactic) => {
      // Must have sales agent, be active, and have segment
      if (
        !salesAgentIds.includes(tactic.salesAgentId) ||
        tactic.status !== "active" ||
        !tactic.axeIncludeSegment
      ) {
        return false;
      }

      // Check if campaign is active and within date range
      const campaign = this.campaigns.get(tactic.campaignId);
      if (!campaign || campaign.status !== "active") {
        return false;
      }

      const now = new Date();
      if (campaign.startDate && new Date(campaign.startDate) > now) {
        return false;
      }
      if (campaign.endDate && new Date(campaign.endDate) < now) {
        return false;
      }

      return true;
    });

    // Group by segment and find max CPM for each
    const segmentMap = new Map<string, number>();
    for (const tactic of activeTactics) {
      const segment = tactic.axeIncludeSegment!;
      const maxCpm = segmentMap.get(segment) || 0;
      segmentMap.set(
        segment,
        Math.max(maxCpm, tactic.effectivePricing.totalCpm),
      );
    }

    // Convert to array and sort by CPM descending
    return Array.from(segmentMap.entries())
      .map(([segment, maxCpm]) => ({
        axe_include_segment: segment,
        max_cpm: maxCpm,
      }))
      .sort((a, b) => b.max_cpm - a.max_cpm);
  }

  async getTactic(apiKey: string, tacticId: string): Promise<null | Tactic> {
    this.validateAuth(apiKey);
    const tactic = this.tactics.get(tacticId);
    return tactic ? structuredClone(tactic) : null;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async listTactics(
    apiKey: string,
    options: TacticListOptions,
  ): Promise<TacticListResult> {
    this.validateAuth(apiKey);

    let tactics = Array.from(this.tactics.values()).filter(
      (t) => t.campaignId === options.campaignId && t.status !== "inactive",
    );

    if (options.status) {
      tactics = tactics.filter((t) => t.status === options.status);
    }

    tactics.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const totalCount = tactics.length;
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    const paginatedTactics = tactics.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return {
      hasMore,
      tactics: paginatedTactics.map((t) => structuredClone(t)),
      totalCount,
    };
  }

  setMaxItems(maxItems: number): void {
    this.maxItems = maxItems;
  }

  /**
   * Test helper: Setup test data for prebid integration testing
   */
  setupPrebidTestData(
    orgId: string,
    salesAgentCount: number = 2,
    campaignsPerAgent: number = 2,
    tacticsPerCampaign: number = 3,
  ): {
    campaignIds: string[];
    salesAgentIds: string[];
    tacticIds: string[];
  } {
    const salesAgentIds: string[] = [];
    const campaignIds: string[] = [];
    const tacticIds: string[] = [];

    // Create sales agents for the org
    for (let i = 1; i <= salesAgentCount; i++) {
      const salesAgent: TestSalesAgent = {
        id: this.generateId("sales_agent"),
        name: `Test Sales Agent ${i}`,
        orgId,
        status: "active",
      };
      this.salesAgents.set(salesAgent.id, salesAgent);
      salesAgentIds.push(salesAgent.id);

      // Create campaigns for each sales agent
      for (let j = 1; j <= campaignsPerAgent; j++) {
        const campaign: TestCampaign = {
          id: this.generateId("campaign"),
          status: "active",
        };
        this.campaigns.set(campaign.id, campaign);
        campaignIds.push(campaign.id);

        // Create tactics for each campaign
        for (let k = 1; k <= tacticsPerCampaign; k++) {
          const tactic: Tactic = {
            axeIncludeSegment: `axe_segment_${i}_${j}_${k}`,
            budgetAllocation: {
              amount: 1000,
              currency: "USD",
              pacing: "even",
            },
            campaignId: campaign.id,
            createdAt: new Date().toISOString(),
            customerId: 1,
            effectivePricing: {
              cpm: 5.0 + Math.random() * 10, // Random CPM between 5-15
              totalCpm: 5.0 + Math.random() * 10,
            },
            id: this.generateId("tactic"),
            mediaProductId: `media_product_${i}_${j}`,
            name: `Test Tactic ${i}-${j}-${k}`,
            salesAgentId: salesAgent.id,
            status: "active",
            updatedAt: new Date().toISOString(),
          };
          this.tactics.set(tactic.id, tactic);
          tacticIds.push(tactic.id);
        }
      }
    }

    return { campaignIds, salesAgentIds, tacticIds };
  }

  async updateTactic(
    apiKey: string,
    tacticId: string,
    updates: TacticUpdateInput,
    effectivePricing?: EffectivePricing,
  ): Promise<Tactic> {
    this.validateAuth(apiKey);

    const tactic = this.tactics.get(tacticId);
    if (!tactic) {
      throw new Error(`Tactic not found: ${tacticId}`);
    }

    // Ensure updatedAt is later than createdAt
    await new Promise((resolve) => setTimeout(resolve, 10));

    const updatedTactic: Tactic = {
      ...tactic,
      budgetAllocation: updates.budgetAllocation
        ? { ...tactic.budgetAllocation, ...updates.budgetAllocation }
        : tactic.budgetAllocation,
      description: updates.description ?? tactic.description,
      effectivePricing: effectivePricing ?? tactic.effectivePricing,
      name: updates.name ?? tactic.name,
      status: updates.status ?? tactic.status,
      updatedAt: new Date().toISOString(),
    };

    this.tactics.set(tacticId, updatedTactic);
    return structuredClone(updatedTactic);
  }

  /**
   * Test helper: Update tactic segment for testing segment aggregation
   */
  updateTacticSegment(tacticId: string, axeIncludeSegment: string): void {
    const tactic = this.tactics.get(tacticId);
    if (tactic) {
      tactic.axeIncludeSegment = axeIncludeSegment;
      this.tactics.set(tacticId, tactic);
    }
  }

  private generateAxeSegment(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `axe_${random}_${timestamp}`;
  }

  private generateId(prefix: string): string {
    const timestamp = Date.now();
    const counter = this.nextId++;
    return `${prefix}_${timestamp}_${counter}`;
  }

  private validateAuth(apiKey: string): void {
    if (!this.validApiKeys.has(apiKey)) {
      throw new Error("Authentication failed: Invalid API key");
    }
  }

  private validateTacticInput(input: TacticInput): void {
    if (!input.name?.trim()) {
      throw new Error("Validation error: Tactic name is required");
    }

    if (!input.campaignId?.trim()) {
      throw new Error("Validation error: Campaign ID is required");
    }

    if (!input.mediaProductId?.trim()) {
      throw new Error("Validation error: Media product ID is required");
    }

    if (!input.budgetAllocation) {
      throw new Error("Validation error: Budget allocation is required");
    }

    if (input.budgetAllocation.amount <= 0) {
      throw new Error("Validation error: Budget amount must be positive");
    }
  }
}
