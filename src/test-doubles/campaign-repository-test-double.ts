/**
 * Campaign Repository Test Double
 *
 * Simplified in-memory implementation for contract testing demonstration.
 */

import type {
  Campaign,
  CampaignInput,
  CampaignListOptions,
  CampaignListResult,
  CampaignRepository,
  CampaignUpdate,
} from "../contracts/campaign-repository.js";

export class CampaignRepositoryTestDouble implements CampaignRepository {
  private campaigns = new Map<string, Campaign>();
  private maxItems = 100; // Default max items
  private nextId = 1;
  private validApiKeys = new Set<string>();

  addValidApiKey(apiKey: string): void {
    this.validApiKeys.add(apiKey);
  }

  clear(): void {
    this.campaigns.clear();
    this.nextId = 1;
  }

  async createCampaign(
    apiKey: string,
    input: CampaignInput,
  ): Promise<Campaign> {
    this.validateAuth(apiKey);

    if (!input.brandAgentId || !input.campaignName || !input.prompt) {
      throw new Error("Validation error: Required fields missing");
    }

    // Business rule validation
    if (input.budgetTotal !== undefined && input.budgetTotal < 0) {
      throw new Error("Validation error: Budget total must be positive");
    }

    if (input.brandAgentId.trim() === "") {
      throw new Error("Validation error: Brand agent ID cannot be empty");
    }

    // Check storage limits
    if (this.campaigns.size >= this.maxItems) {
      throw new Error("Storage limit exceeded");
    }

    const now = new Date().toISOString();
    const campaign: Campaign = {
      audienceIds: [],
      brandAgentId: input.brandAgentId,
      budget: {
        currency: input.budgetCurrency || "USD",
        dailyCap: input.budgetDailyCap,
        pacing: input.budgetPacing || "even",
        total: input.budgetTotal || 10000,
      },
      createdAt: now,
      creativeIds: [],
      id: this.generateId(),
      name: input.campaignName,
      outcomeScoreWindowDays: input.outcomeScoreWindowDays || 7,
      prompt: input.prompt,
      scoringWeights: input.scoringWeights,
      status: "draft",
      updatedAt: now,
    };

    this.campaigns.set(campaign.id, campaign);
    return structuredClone(campaign);
  }

  async deleteCampaign(apiKey: string, campaignId: string): Promise<void> {
    this.validateAuth(apiKey);
    this.campaigns.delete(campaignId);
  }

  async getCampaign(
    apiKey: string,
    campaignId: string,
  ): Promise<Campaign | null> {
    this.validateAuth(apiKey);
    const campaign = this.campaigns.get(campaignId);
    return campaign ? structuredClone(campaign) : null;
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }

  async listCampaigns(
    apiKey: string,
    options: CampaignListOptions,
  ): Promise<CampaignListResult> {
    this.validateAuth(apiKey);

    let campaigns = Array.from(this.campaigns.values()).filter(
      (c) => c.brandAgentId === options.brandAgentId,
    );

    if (options.status) {
      campaigns = campaigns.filter((c) => c.status === options.status);
    }

    campaigns.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const totalCount = campaigns.length;
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    const paginatedCampaigns = campaigns.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    return {
      campaigns: paginatedCampaigns.map((c) => structuredClone(c)),
      hasMore,
      totalCount,
    };
  }

  setMaxItems(maxItems: number): void {
    this.maxItems = maxItems;
  }

  async updateCampaign(
    apiKey: string,
    campaignId: string,
    updates: CampaignUpdate,
  ): Promise<Campaign> {
    this.validateAuth(apiKey);

    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      const message = "Campaign not found: " + campaignId;
      throw new Error(message);
    }

    // Ensure updatedAt is later than createdAt
    await new Promise((resolve) => setTimeout(resolve, 1));

    const updatedCampaign: Campaign = {
      ...campaign,
      budget: {
        ...campaign.budget,
        currency: updates.budgetCurrency ?? campaign.budget.currency,
        dailyCap: updates.budgetDailyCap ?? campaign.budget.dailyCap,
        pacing: updates.budgetPacing ?? campaign.budget.pacing,
        total: updates.budgetTotal ?? campaign.budget.total,
      },
      name: updates.campaignName ?? campaign.name,
      outcomeScoreWindowDays:
        updates.outcomeScoreWindowDays ?? campaign.outcomeScoreWindowDays,
      prompt: updates.prompt ?? campaign.prompt,
      scoringWeights: updates.scoringWeights ?? campaign.scoringWeights,
      status: updates.status ?? campaign.status,
      updatedAt: new Date().toISOString(),
    };

    this.campaigns.set(campaignId, updatedCampaign);
    return structuredClone(updatedCampaign);
  }

  private generateId(): string {
    const timestamp = Date.now();
    const counter = this.nextId++;
    return "campaign_" + timestamp + "_" + counter;
  }

  private validateAuth(apiKey: string): void {
    if (!this.validApiKeys.has(apiKey)) {
      throw new Error("Authentication failed: Invalid API key");
    }
  }
}
