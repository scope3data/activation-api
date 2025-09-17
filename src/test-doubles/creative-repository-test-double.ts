/**
 * Creative Repository Test Double
 *
 * In-memory implementation of CreativeRepository for testing.
 */

import {
  AssignmentResult,
  Creative,
  CreativeInput,
  CreativeListOptions,
  CreativeListResult,
  CreativeRepository,
  CreativeUpdate,
} from "../contracts/creative-repository.js";

interface TestConfig {
  errorRate?: number;
  latency?: number;
  maxItems?: number;
}

export class CreativeRepositoryTestDouble implements CreativeRepository {
  private assignments = new Map<string, Set<string>>(); // creativeId -> Set<campaignId>
  private callCounts = new Map<string, number>();
  private config: TestConfig;
  private creatives = new Map<string, Creative>();
  private nextId = 1;
  private validApiKeys = new Set<string>();

  constructor(config: TestConfig = {}) {
    this.config = {
      errorRate: 0,
      latency: 0,
      maxItems: 1000,
      ...config,
    };
  }

  // Test helper methods
  addValidApiKey(apiKey: string): void {
    this.validApiKeys.add(apiKey);
  }

  async assignCreativeToCampaign(
    apiKey: string,
    creativeId: string,
    campaignId: string,
    buyerAgentId: string,
  ): Promise<AssignmentResult> {
    this.trackCall("assignCreativeToCampaign");
    await this.simulateLatency();
    this.simulateError();
    this.validateAuth(apiKey);

    const creative = this.creatives.get(creativeId);
    if (!creative) {
      throw new Error(`Creative not found: ${creativeId}`);
    }

    if (creative.buyerAgentId !== buyerAgentId) {
      throw new Error(
        "Access denied: Creative belongs to different brand agent",
      );
    }

    // Add assignment
    if (!this.assignments.has(creativeId)) {
      this.assignments.set(creativeId, new Set());
    }
    this.assignments.get(creativeId)!.add(campaignId);

    // Update creative's campaign assignments
    const updatedCreative = { ...creative };
    updatedCreative.campaignAssignments = Array.from(
      this.assignments.get(creativeId)!,
    );
    this.creatives.set(creativeId, updatedCreative);

    return {
      campaignId,
      creativeId,
      message: `Creative ${creativeId} assigned to campaign ${campaignId}`,
      success: true,
    };
  }

  clear(): void {
    this.creatives.clear();
    this.assignments.clear();
    this.callCounts.clear();
    this.nextId = 1;
  }

  // CreativeRepository implementation
  async createCreative(
    apiKey: string,
    input: CreativeInput,
  ): Promise<Creative> {
    this.trackCall("createCreative");
    await this.simulateLatency();
    this.simulateError();
    this.validateAuth(apiKey);
    this.validateCreativeInput(input);

    if (this.creatives.size >= this.config.maxItems!) {
      throw new Error("Storage limit exceeded");
    }

    const now = new Date().toISOString();
    const creative: Creative = {
      assemblyMethod: input.assemblyMethod || "pre_assembled",
      assetIds: input.content.assetIds || [],
      buyerAgentId: input.buyerAgentId,
      campaignAssignments: [],
      content: { ...input.content },
      contentCategories: input.contentCategories || [],
      createdBy: "test_user",
      createdDate: now,
      creativeDescription: input.creativeDescription,
      creativeId: this.generateCreativeId(),
      creativeName: input.creativeName,
      customerId: 1,
      format: { ...input.format },
      lastModifiedBy: "test_user",
      lastModifiedDate: now,
      status: "draft",
      targetAudience: input.targetAudience,
      version: "1.0.0",
    };

    this.creatives.set(creative.creativeId, creative);
    return { ...creative };
  }

  async deleteCreative(apiKey: string, creativeId: string): Promise<void> {
    this.trackCall("deleteCreative");
    await this.simulateLatency();
    this.simulateError();
    this.validateAuth(apiKey);

    // Remove from assignments
    this.assignments.delete(creativeId);

    // Remove creative
    this.creatives.delete(creativeId);
  }

  getCallCount(operation: string): number {
    return this.callCounts.get(operation) || 0;
  }

  async getCreative(
    apiKey: string,
    creativeId: string,
    brandAgentId?: string,
  ): Promise<Creative | null> {
    this.trackCall("getCreative");
    await this.simulateLatency();
    this.simulateError();
    this.validateAuth(apiKey);

    const creative = this.creatives.get(creativeId);
    if (!creative) {
      return null;
    }

    // Apply brand agent filter if provided
    if (brandAgentId && creative.buyerAgentId !== brandAgentId) {
      return null;
    }

    return { ...creative };
  }

  async healthCheck(): Promise<boolean> {
    this.trackCall("healthCheck");
    await this.simulateLatency();

    if (this.config.errorRate && Math.random() < this.config.errorRate! * 0.1) {
      return false;
    }

    return true;
  }

  async listCreatives(
    apiKey: string,
    options: CreativeListOptions,
  ): Promise<CreativeListResult> {
    this.trackCall("listCreatives");
    await this.simulateLatency();
    this.simulateError();
    this.validateAuth(apiKey);

    let creatives = Array.from(this.creatives.values()).filter(
      (c) => c.buyerAgentId === options.brandAgentId,
    );

    // Apply filters
    if (options.format) {
      creatives = creatives.filter((c) => c.format.formatId === options.format);
    }
    if (options.status) {
      creatives = creatives.filter((c) => c.status === options.status);
    }

    // Sort by creation date (newest first)
    creatives.sort(
      (a, b) =>
        new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
    );

    const totalCount = creatives.length;
    const offset = options.offset || 0;
    const limit = options.limit || 100;

    // Apply pagination
    const paginatedCreatives = creatives.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    // Calculate summary
    const summary = {
      activeCreatives: creatives.filter((c) => c.status === "active").length,
      assignedCreatives: creatives.filter(
        (c) => c.campaignAssignments && c.campaignAssignments.length > 0,
      ).length,
      draftCreatives: creatives.filter((c) => c.status === "draft").length,
      totalCreatives: totalCount,
      unassignedCreatives: creatives.filter(
        (c) => !c.campaignAssignments || c.campaignAssignments.length === 0,
      ).length,
    };

    return {
      creatives: paginatedCreatives.map((c) => ({ ...c })),
      hasMore,
      summary,
      totalCount,
    };
  }

  setTransientError(_operation: string, _failureCount: number): void {
    // This would be implemented to simulate specific operation failures
    // For now, using general error rate
  }

  async unassignCreativeFromCampaign(
    apiKey: string,
    creativeId: string,
    campaignId: string,
  ): Promise<AssignmentResult> {
    this.trackCall("unassignCreativeFromCampaign");
    await this.simulateLatency();
    this.simulateError();
    this.validateAuth(apiKey);

    // Remove assignment
    if (this.assignments.has(creativeId)) {
      this.assignments.get(creativeId)!.delete(campaignId);

      // Update creative's campaign assignments
      const creative = this.creatives.get(creativeId);
      if (creative) {
        const updatedCreative = { ...creative };
        updatedCreative.campaignAssignments = Array.from(
          this.assignments.get(creativeId)!,
        );
        this.creatives.set(creativeId, updatedCreative);
      }
    }

    return {
      campaignId,
      creativeId,
      message: `Creative ${creativeId} unassigned from campaign ${campaignId}`,
      success: true,
    };
  }

  async updateCreative(
    apiKey: string,
    creativeId: string,
    buyerAgentId: string,
    updates: CreativeUpdate,
  ): Promise<Creative> {
    this.trackCall("updateCreative");
    await this.simulateLatency();
    this.simulateError();
    this.validateAuth(apiKey);

    const creative = this.creatives.get(creativeId);
    if (!creative) {
      throw new Error(`Creative not found: ${creativeId}`);
    }

    if (creative.buyerAgentId !== buyerAgentId) {
      throw new Error(
        "Access denied: Creative belongs to different brand agent",
      );
    }

    // Ensure lastModifiedDate is later than createdDate
    await new Promise((resolve) => setTimeout(resolve, 1));

    // Apply updates
    const updatedCreative: Creative = {
      ...creative,
      content: updates.content
        ? { ...creative.content, ...updates.content }
        : creative.content,
      creativeDescription:
        updates.creativeDescription ?? creative.creativeDescription,
      creativeName: updates.name ?? creative.creativeName,
      lastModifiedBy: "test_user",
      lastModifiedDate: new Date().toISOString(),
      status: updates.status ?? creative.status,
      targetAudience: updates.targetAudience ?? creative.targetAudience,
    };

    this.creatives.set(creativeId, updatedCreative);
    return { ...updatedCreative };
  }

  private generateCreativeId(): string {
    return `creative_${Math.random().toString(36).substring(2, 15)}`;
  }

  private simulateError(): void {
    if (this.config.errorRate && Math.random() < this.config.errorRate!) {
      throw new Error("Simulated transient error");
    }
  }

  // Helper methods
  private async simulateLatency(): Promise<void> {
    if (this.config.latency && this.config.latency > 0) {
      await new Promise((resolve) => setTimeout(resolve, this.config.latency));
    }
  }

  private trackCall(operation: string): void {
    this.callCounts.set(operation, (this.callCounts.get(operation) || 0) + 1);
  }

  private validateAuth(apiKey: string): void {
    if (!this.validApiKeys.has(apiKey)) {
      throw new Error("Authentication failed: Invalid API key");
    }
  }

  private validateCreativeInput(input: CreativeInput): void {
    if (!input.buyerAgentId || input.buyerAgentId.trim() === "") {
      throw new Error("Validation error: buyerAgentId is required");
    }
    if (!input.creativeName || input.creativeName.trim() === "") {
      throw new Error("Validation error: creativeName is required");
    }
    if (!input.content || Object.keys(input.content).length === 0) {
      throw new Error("Validation error: content is required");
    }

    // Validate that at least one content source is provided
    const { assetIds, htmlSnippet, javascriptTag, productUrl, vastTag } =
      input.content;
    const hasContent =
      htmlSnippet ||
      javascriptTag ||
      vastTag ||
      (assetIds && assetIds.length > 0) ||
      productUrl;
    if (!hasContent) {
      throw new Error("Validation error: At least one content source required");
    }
  }
}
