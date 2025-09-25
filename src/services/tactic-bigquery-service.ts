import { BigQuery } from "@google-cloud/bigquery";

import type {
  BudgetAllocation,
  EffectivePricing,
  PublisherMediaProduct,
  Tactic,
  TacticInput,
  TacticUpdateInput,
} from "../types/tactics.js";

import { AuthenticationService } from "./auth-service.js";

export interface PrebidSegment {
  axe_include_segment: string;
  max_cpm: number;
}

export interface TacticBigQueryRecord extends Record<string, unknown> {
  axe_include_segment?: string;
  brand_story_id?: string;
  budget_amount: number;
  budget_currency: string;
  budget_daily_cap?: number;
  budget_pacing: string;
  budget_percentage?: number;
  campaign_id: string;
  cpm: number;
  created_at: string;
  customer_id: number;
  description?: string;
  id: string;
  media_product_id: string;
  name: string;
  sales_agent_id: string;
  signal_cost?: number;
  signal_id?: string;
  status: string;
  total_cpm: number;
  updated_at: string;
}

export class TacticBigQueryService {
  private authService: AuthenticationService;
  private bigquery: BigQuery;
  private dataset: string;
  private projectId: string;

  constructor(
    projectId: string = "bok-playground",
    dataset: string = "agenticapi",
  ) {
    this.bigquery = new BigQuery({ location: "us-central1", projectId });
    this.projectId = projectId;
    this.dataset = dataset;
    this.authService = new AuthenticationService(this.bigquery);
  }

  /**
   * Create a new tactic in BigQuery
   */
  async createTactic(data: TacticInput, apiToken?: string): Promise<Tactic> {
    const customerId = await this.resolveCustomerId(apiToken);

    // Generate tactic ID and calculate pricing
    const tacticId = `tactic_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const effectivePricing = this.calculateEffectivePricing(data);

    // Mock media product data (since we can't get it from GraphQL)
    const mediaProduct = this.getMockMediaProduct(data.mediaProductId);

    // Ensure BudgetAllocation type is properly recognized by TypeScript/ESLint
    const budgetAllocation: BudgetAllocation = data.budgetAllocation;

    const query = `
      INSERT INTO \`${this.projectId}.${this.dataset}.tactics\`
      (id, campaign_id, sales_agent_id, media_product_id, name, description, 
       budget_amount, budget_currency, budget_daily_cap, budget_pacing, budget_percentage,
       cpm, total_cpm, signal_cost, axe_include_segment, brand_story_id, signal_id, 
       status, customer_id)
      VALUES (@id, @campaignId, @salesAgentId, @mediaProductId, @name, @description,
              @budgetAmount, @budgetCurrency, @budgetDailyCap, @budgetPacing, @budgetPercentage,
              @cpm, @totalCpm, @signalCost, @axeIncludeSegment, @brandStoryId, @signalId,
              @status, @customerId)
    `;

    await this.bigquery.query({
      params: {
        axeIncludeSegment: this.generateAxeSegment(tacticId),
        brandStoryId: data.brandStoryId || null,
        budgetAmount: budgetAllocation.amount,
        budgetCurrency: budgetAllocation.currency || "USD",
        budgetDailyCap: budgetAllocation.dailyCap || null,
        budgetPacing: budgetAllocation.pacing || "even",
        budgetPercentage: budgetAllocation.percentage || null,
        campaignId: data.campaignId,
        cpm: effectivePricing.cpm,
        customerId,
        description: data.description || null,
        id: tacticId,
        mediaProductId: data.mediaProductId,
        name: data.name,
        salesAgentId: mediaProduct.publisherId,
        signalCost: effectivePricing.signalCost || null,
        signalId: data.signalId || null,
        status: "active", // Set to active by default
        totalCpm: effectivePricing.totalCpm,
      },
      query,
      types: {
        budgetAmount: "FLOAT64",
        budgetDailyCap: "FLOAT64",
        budgetPercentage: "FLOAT64",
        cpm: "FLOAT64",
        customerId: "INT64",
        signalCost: "FLOAT64",
        totalCpm: "FLOAT64",
      },
    });

    // Return full tactic object matching expected interface
    return {
      brandStoryId: data.brandStoryId,
      budgetAllocation: {
        amount: budgetAllocation.amount,
        currency: budgetAllocation.currency || "USD",
        dailyCap: budgetAllocation.dailyCap,
        pacing: budgetAllocation.pacing || "even",
        percentage: budgetAllocation.percentage,
      },
      campaignId: data.campaignId,
      createdAt: new Date(),
      description: data.description,
      effectivePricing,
      id: tacticId,
      mediaProduct,
      name: data.name,
      signalId: data.signalId,
      status: "active",
      targeting: {
        inheritFromCampaign: !data.signalId,
        overrides: undefined,
        signalConfiguration: data.signalId
          ? {
              audienceIds: [],
              customParameters: {},
              segments: [data.signalId],
            }
          : undefined,
        signalProvider: data.signalId ? "scope3" : undefined,
        signalType: data.signalId
          ? "scope3"
          : ("none" as "buyer" | "none" | "scope3" | "third_party"),
      },
      updatedAt: new Date(),
    };
  }

  /**
   * Delete a tactic (mark as inactive)
   */
  async deleteTactic(tacticId: string, apiToken?: string): Promise<void> {
    const customerId = await this.resolveCustomerId(apiToken);

    const query = `
      UPDATE \`${this.projectId}.${this.dataset}.tactics\`
      SET status = 'inactive', updated_at = CURRENT_TIMESTAMP()
      WHERE id = @tacticId AND customer_id = @customerId
    `;

    await this.bigquery.query({
      params: { customerId, tacticId },
      query,
      types: { customerId: "INT64" },
    });
  }

  /**
   * Get prebid segments for a publisher org
   */
  async getPrebidSegments(orgId: string): Promise<PrebidSegment[]> {
    const query = `
      WITH publisher_sales_agent AS (
        SELECT 
          id as sales_agent_id,
          name as sales_agent_name
        FROM \`${this.projectId}.${this.dataset}.sales_agents\`
        WHERE org_id = @orgId 
          AND status = 'active'
      ),
      
      active_tactics AS (
        SELECT 
          t.axe_include_segment,
          t.total_cpm,
          c.start_date,
          c.end_date
        FROM \`${this.projectId}.${this.dataset}.tactics\` t
        INNER JOIN publisher_sales_agent psa 
          ON t.sales_agent_id = psa.sales_agent_id
        INNER JOIN \`${this.projectId}.${this.dataset}.campaigns\` c
          ON t.campaign_id = c.id
        WHERE t.status = 'active'
          AND c.status = 'active'
          AND t.axe_include_segment IS NOT NULL
          AND (c.start_date IS NULL OR c.start_date <= CURRENT_TIMESTAMP())
          AND (c.end_date IS NULL OR c.end_date >= CURRENT_TIMESTAMP())
      )
      
      SELECT 
        axe_include_segment,
        MAX(total_cpm) as max_cpm
      FROM active_tactics
      GROUP BY axe_include_segment
      ORDER BY max_cpm DESC
    `;

    try {
      const [rows] = await this.bigquery.query({
        params: { orgId },
        query,
      });

      return (
        rows as Array<{ axe_include_segment: string; max_cpm: number }>
      ).map((row) => ({
        axe_include_segment: row.axe_include_segment,
        max_cpm: row.max_cpm,
      }));
    } catch (error) {
      throw new Error(
        `Failed to get prebid segments for org ${orgId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get a specific tactic by ID
   */
  async getTactic(
    tacticId: string,
    apiToken?: string,
  ): Promise<null | TacticBigQueryRecord> {
    const customerId = await this.resolveCustomerId(apiToken);

    const query = `
      SELECT *
      FROM \`${this.projectId}.${this.dataset}.tactics\`
      WHERE id = @tacticId AND customer_id = @customerId
    `;

    try {
      const [rows] = await this.bigquery.query({
        params: { customerId, tacticId },
        query,
        types: { customerId: "INT64" },
      });

      return rows.length > 0 ? (rows[0] as TacticBigQueryRecord) : null;
    } catch (error) {
      throw new Error(
        `Failed to get tactic ${tacticId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List tactics for a campaign
   */
  async listTactics(
    campaignId: string,
    apiToken?: string,
  ): Promise<TacticBigQueryRecord[]> {
    const customerId = await this.resolveCustomerId(apiToken);

    const query = `
      SELECT *
      FROM \`${this.projectId}.${this.dataset}.tactics\`
      WHERE campaign_id = @campaignId 
        AND customer_id = @customerId
        AND status != 'inactive'
      ORDER BY created_at DESC
    `;

    try {
      const [rows] = await this.bigquery.query({
        params: { campaignId, customerId },
        query,
        types: { customerId: "INT64" },
      });

      return rows as TacticBigQueryRecord[];
    } catch (error) {
      throw new Error(
        `Failed to list tactics for campaign ${campaignId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Update a tactic
   */
  async updateTactic(
    tacticId: string,
    updates: { effectivePricing?: EffectivePricing } & TacticUpdateInput,
    apiToken?: string,
  ): Promise<void> {
    const customerId = await this.resolveCustomerId(apiToken);

    const setClauses = [];
    const params: Record<string, unknown> = { customerId, tacticId };

    if (updates.name) {
      setClauses.push("name = @name");
      params.name = updates.name;
    }

    if (updates.description !== undefined) {
      setClauses.push("description = @description");
      params.description = updates.description;
    }

    if (updates.status) {
      setClauses.push("status = @status");
      params.status = updates.status;
    }

    if (updates.budgetAllocation) {
      const budget = updates.budgetAllocation;
      if (budget.amount !== undefined) {
        setClauses.push("budget_amount = @budgetAmount");
        params.budgetAmount = budget.amount;
      }
      if (budget.currency) {
        setClauses.push("budget_currency = @budgetCurrency");
        params.budgetCurrency = budget.currency;
      }
      if (budget.dailyCap !== undefined) {
        setClauses.push("budget_daily_cap = @budgetDailyCap");
        params.budgetDailyCap = budget.dailyCap;
      }
      if (budget.pacing) {
        setClauses.push("budget_pacing = @budgetPacing");
        params.budgetPacing = budget.pacing;
      }
      if (budget.percentage !== undefined) {
        setClauses.push("budget_percentage = @budgetPercentage");
        params.budgetPercentage = budget.percentage;
      }
    }

    if (updates.effectivePricing) {
      const pricing = updates.effectivePricing;
      if (pricing.cpm !== undefined) {
        setClauses.push("cpm = @cpm");
        params.cpm = pricing.cpm;
      }
      if (pricing.totalCpm !== undefined) {
        setClauses.push("total_cpm = @totalCpm");
        params.totalCpm = pricing.totalCpm;
      }
      if (pricing.signalCost !== undefined) {
        setClauses.push("signal_cost = @signalCost");
        params.signalCost = pricing.signalCost;
      }
    }

    if (setClauses.length === 0) {
      return; // No updates to make
    }

    setClauses.push("updated_at = CURRENT_TIMESTAMP()");

    const query = `
      UPDATE \`${this.projectId}.${this.dataset}.tactics\`
      SET ${setClauses.join(", ")}
      WHERE id = @tacticId AND customer_id = @customerId
    `;

    await this.bigquery.query({
      params,
      query,
      types: {
        budgetAmount: "FLOAT64",
        budgetDailyCap: "FLOAT64",
        budgetPercentage: "FLOAT64",
        cpm: "FLOAT64",
        customerId: "INT64",
        signalCost: "FLOAT64",
        totalCpm: "FLOAT64",
      },
    });
  }

  /**
   * Calculate effective pricing for a tactic based on input CPM and signal costs
   */
  private calculateEffectivePricing(data: TacticInput): EffectivePricing {
    const baseCpm = data.cpm || 0; // Default to 0 if no CPM provided
    // For now, assume no additional signal cost since we can't look up actual signal pricing
    const signalCost = data.signalId ? 0.25 : 0; // Mock signal cost
    const totalCpm = baseCpm + signalCost;

    return {
      cpm: baseCpm,
      currency: data.budgetAllocation.currency || "USD",
      signalCost: signalCost > 0 ? signalCost : undefined,
      totalCpm,
    };
  }

  /**
   * Generate a unique AXE segment ID for a tactic
   */
  private generateAxeSegment(tacticId: string): string {
    // Generate a segment ID that's recognizable but not predictable
    const timestamp = Date.now().toString(36);
    const hash = tacticId.substring(tacticId.lastIndexOf("_") + 1);
    return `axe_${hash}_${timestamp}`;
  }

  /**
   * Generate mock media product data since GraphQL doesn't have tactic operations
   * In a real implementation, this would fetch from a media product API
   */
  private getMockMediaProduct(mediaProductId: string): PublisherMediaProduct {
    // Extract potential publisher info from ID or use defaults
    const isHulu = mediaProductId.toLowerCase().includes("hulu");
    const isNetflix = mediaProductId.toLowerCase().includes("netflix");
    const isYouTube =
      mediaProductId.toLowerCase().includes("youtube") ||
      mediaProductId.toLowerCase().includes("google");

    if (isHulu) {
      return {
        basePricing: {
          fixedCpm: 15.0,
          floorCpm: null,
          model: "fixed_cpm",
          targetCpm: null,
        },
        createdAt: new Date(),
        deliveryType: "streaming",
        description: "Premium video advertising on Hulu streaming platform",
        formats: ["video", "display"],
        id: mediaProductId,
        inventoryType: "premium_video",
        name: "Hulu Premium Video Inventory",
        productId: "hulu_premium_video",
        publisherId: "hulu_sales_001",
        publisherName: "Hulu",
        supportedTargeting: ["demographic", "geographic", "behavioral"],
        updatedAt: new Date(),
      };
    } else if (isNetflix) {
      return {
        basePricing: {
          fixedCpm: 25.0,
          floorCpm: null,
          model: "fixed_cpm",
          targetCpm: null,
        },
        createdAt: new Date(),
        deliveryType: "streaming",
        description: "Premium video advertising on Netflix streaming platform",
        formats: ["video"],
        id: mediaProductId,
        inventoryType: "premium_video",
        name: "Netflix Premium Video Advertising",
        productId: "netflix_premium_video",
        publisherId: "netflix_sales_001",
        publisherName: "Netflix",
        supportedTargeting: ["demographic", "geographic", "interest"],
        updatedAt: new Date(),
      };
    } else if (isYouTube) {
      return {
        basePricing: {
          fixedCpm: null,
          floorCpm: 5.0,
          model: "auction",
          targetCpm: 12.0,
        },
        createdAt: new Date(),
        deliveryType: "streaming",
        description: "Video advertising across YouTube platform",
        formats: ["video", "display"],
        id: mediaProductId,
        inventoryType: "video_advertising",
        name: "YouTube Video Advertising",
        productId: "youtube_video_ads",
        publisherId: "google_sales_001",
        publisherName: "Google/YouTube",
        supportedTargeting: [
          "demographic",
          "interest",
          "behavioral",
          "contextual",
        ],
        updatedAt: new Date(),
      };
    } else {
      // Generic media product
      return {
        basePricing: {
          fixedCpm: null,
          floorCpm: 2.5,
          model: "auction",
          targetCpm: 8.0,
        },
        createdAt: new Date(),
        deliveryType: "programmatic",
        description: "Mixed display and video advertising inventory",
        formats: ["display", "video"],
        id: mediaProductId,
        inventoryType: "mixed_inventory",
        name: "Display & Video Inventory",
        productId: "generic_display_video",
        publisherId: "publisher_001",
        publisherName: "Generic Publisher",
        supportedTargeting: ["demographic", "geographic"],
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Resolve customer ID from API token using auth service
   */
  private async resolveCustomerId(apiToken?: string): Promise<number> {
    const customerId = await this.authService.getCustomerIdFromToken(
      apiToken || "",
    );
    if (!customerId) {
      throw new Error("Unable to resolve customer ID from API token");
    }
    return customerId;
  }
}
