import { BigQuery } from "@google-cloud/bigquery";

import type {
  BudgetAllocation,
  EffectivePricing,
  PublisherMediaProduct,
  Tactic,
  TacticInput,
  TacticUpdateInput,
} from "../types/tactics.js";

import {
  AdCPMediaBuyService,
  type MediaBuyResult,
} from "./adcp-media-buy-service.js";
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
  error_message?: string;
  id: string;
  media_buy_approved_at?: string;
  media_buy_id?: string;
  media_buy_request?: Record<string, unknown>;
  media_buy_response?: Record<string, unknown>;
  media_buy_status?: string;
  media_buy_submitted_at?: string;
  media_product_id: string;
  name: string;
  sales_agent_id: string;
  signal_cost?: number;
  signal_id?: string;
  status: string;
  total_cpm: number;
  updated_at: string;
  webhook_secret?: string;
  webhook_url?: string;
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
   * Create a new tactic in BigQuery and execute media buy
   */
  async createTactic(data: TacticInput, apiToken?: string): Promise<Tactic> {
    const customerId = await this.resolveCustomerId(apiToken);

    // Generate tactic ID and calculate pricing
    const tacticId = `tactic_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    const effectivePricing = this.calculateEffectivePricing(data);
    const axeSegment = this.generateAxeSegment(tacticId);

    // Mock media product data (since we can't get it from GraphQL)
    const mediaProduct = this.getMockMediaProduct(data.mediaProductId);

    // Ensure BudgetAllocation type is properly recognized by TypeScript/ESLint
    const budgetAllocation: BudgetAllocation = data.budgetAllocation;

    // 1. Create tactic record with draft status and pending media buy
    const query = `
      INSERT INTO \`${this.projectId}.${this.dataset}.tactics\`
      (id, campaign_id, sales_agent_id, media_product_id, name, description, 
       budget_amount, budget_currency, budget_daily_cap, budget_pacing, budget_percentage,
       cpm, total_cpm, signal_cost, axe_include_segment, brand_story_id, signal_id, 
       status, media_buy_status, customer_id)
      VALUES (@id, @campaignId, @salesAgentId, @mediaProductId, @name, @description,
              @budgetAmount, @budgetCurrency, @budgetDailyCap, @budgetPacing, @budgetPercentage,
              @cpm, @totalCpm, @signalCost, @axeIncludeSegment, @brandStoryId, @signalId,
              @status, @mediaBuyStatus, @customerId)
    `;

    await this.bigquery.query({
      params: {
        axeIncludeSegment: axeSegment,
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
        mediaBuyStatus: "pending",
        mediaProductId: data.mediaProductId,
        name: data.name,
        salesAgentId: mediaProduct.publisherId,
        signalCost: effectivePricing.signalCost || null,
        signalId: data.signalId || null,
        status: "draft", // Start as draft, will be updated after media buy
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

    // 2. Create tactic record for media buy service
    const tacticRecord: TacticBigQueryRecord = {
      axe_include_segment: axeSegment,
      brand_story_id: data.brandStoryId,
      budget_amount: budgetAllocation.amount,
      budget_currency: budgetAllocation.currency || "USD",
      budget_daily_cap: budgetAllocation.dailyCap,
      budget_pacing: budgetAllocation.pacing || "even",
      budget_percentage: budgetAllocation.percentage,
      campaign_id: data.campaignId,
      cpm: effectivePricing.cpm,
      created_at: new Date().toISOString(),
      customer_id: customerId,
      description: data.description,
      id: tacticId,
      media_buy_status: "pending",
      media_product_id: data.mediaProductId,
      name: data.name,
      sales_agent_id: mediaProduct.publisherId,
      signal_cost: effectivePricing.signalCost,
      signal_id: data.signalId,
      status: "draft",
      total_cpm: effectivePricing.totalCpm,
      updated_at: new Date().toISOString(),
    };

    // 3. Attempt to execute media buy
    let finalStatus:
      | "active"
      | "completed"
      | "draft"
      | "failed"
      | "paused"
      | "pending_approval" = "draft";
    let mediaBuyResult: MediaBuyResult | null = null;

    try {
      const mediaBuyService = new AdCPMediaBuyService();

      // Find sales agent for this publisher/media product
      const salesAgent = await mediaBuyService.findSalesAgentForPublisher(
        mediaProduct.publisherId,
        customerId,
      );

      if (salesAgent) {
        // Get sanitized brief from campaign for sales agent privacy
        const sanitizedBrief = await this.getCampaignSanitizedBrief(
          data.campaignId,
          apiToken,
        );

        // Execute media buy with sanitized brief (no budget/price information)
        mediaBuyResult = await mediaBuyService.executeMediaBuy(
          tacticRecord,
          salesAgent,
          sanitizedBrief ||
            `Tactic for ${data.name} - budget details managed separately`,
          customerId,
        );

        // Update tactic with media buy results
        await this.updateTacticMediaBuy(tacticId, {
          error_message: mediaBuyResult.error_message,
          media_buy_id: mediaBuyResult.media_buy_id,
          media_buy_request: mediaBuyResult.request as unknown as Record<
            string,
            unknown
          >,
          media_buy_response: mediaBuyResult.response as unknown as Record<
            string,
            unknown
          >,
          media_buy_status: mediaBuyResult.status,
          media_buy_submitted_at: new Date().toISOString(),
          webhook_secret: mediaBuyResult.webhook_secret,
          webhook_url: mediaBuyResult.webhook_url,
        });

        // Update final status based on media buy result
        finalStatus =
          mediaBuyResult.status === "active" ? "active" : "pending_approval";
        if (mediaBuyResult.status === "failed") {
          finalStatus = "failed";
        }
      } else {
        // No sales agent available
        await this.updateTacticMediaBuy(tacticId, {
          error_message: "No sales agent available for this publisher",
          media_buy_status: "failed",
        });
        finalStatus = "failed";
      }
    } catch (error) {
      // Handle media buy execution errors
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.updateTacticMediaBuy(tacticId, {
        error_message: errorMessage,
        media_buy_status: "failed",
      });
      finalStatus = "failed";
    }

    // 4. Update final tactic status (it will always be different from initial "draft")
    await this.updateTacticStatus(tacticId, finalStatus);

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
      status: finalStatus,
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
   * Get sanitized brief from campaign for sales agent privacy
   */
  async getCampaignSanitizedBrief(
    campaignId: string,
    apiToken?: string,
  ): Promise<null | string> {
    const customerId = await this.resolveCustomerId(apiToken);

    const query = `
      SELECT sanitized_brief, prompt, name
      FROM \`${this.projectId}.${this.dataset}.campaigns\`
      WHERE id = @campaignId AND customer_id = @customerId
      LIMIT 1
    `;

    const [rows] = await this.bigquery.query({
      params: { campaignId, customerId },
      query,
    });

    if (rows.length === 0) {
      return null; // Campaign not found
    }

    const row = rows[0] as Record<string, unknown>;

    // Return sanitized brief if available, otherwise create fallback
    if (row.sanitized_brief && typeof row.sanitized_brief === "string") {
      return row.sanitized_brief;
    }

    // Fallback: create a generic brief without exposing campaign details
    const campaignName = row.name ? String(row.name) : "Campaign";
    return `${campaignName} - targeting and creative requirements as specified. Budget and pricing details managed separately for privacy.`;
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
   * Update tactic media buy information
   */
  async updateTacticMediaBuy(
    tacticId: string,
    updates: {
      error_message?: string;
      media_buy_approved_at?: string;
      media_buy_id?: string;
      media_buy_request?: Record<string, unknown>;
      media_buy_response?: Record<string, unknown>;
      media_buy_status?: string;
      media_buy_submitted_at?: string;
      webhook_secret?: string;
      webhook_url?: string;
    },
  ): Promise<void> {
    const query = `
      UPDATE \`${this.projectId}.${this.dataset}.tactics\`
      SET 
        media_buy_id = COALESCE(@mediaBuyId, media_buy_id),
        media_buy_status = COALESCE(@mediaBuyStatus, media_buy_status),
        media_buy_request = COALESCE(@mediaBuyRequest, media_buy_request),
        media_buy_response = COALESCE(@mediaBuyResponse, media_buy_response),
        media_buy_submitted_at = COALESCE(@mediaBuySubmittedAt, media_buy_submitted_at),
        media_buy_approved_at = COALESCE(@mediaBuyApprovedAt, media_buy_approved_at),
        webhook_url = COALESCE(@webhookUrl, webhook_url),
        webhook_secret = COALESCE(@webhookSecret, webhook_secret),
        error_message = COALESCE(@errorMessage, error_message),
        updated_at = CURRENT_TIMESTAMP()
      WHERE id = @tacticId
    `;

    await this.bigquery.query({
      params: {
        errorMessage: updates.error_message || null,
        mediaBuyApprovedAt: updates.media_buy_approved_at || null,
        mediaBuyId: updates.media_buy_id || null,
        mediaBuyRequest: updates.media_buy_request
          ? JSON.stringify(updates.media_buy_request)
          : null,
        mediaBuyResponse: updates.media_buy_response
          ? JSON.stringify(updates.media_buy_response)
          : null,
        mediaBuyStatus: updates.media_buy_status || null,
        mediaBuySubmittedAt: updates.media_buy_submitted_at || null,
        tacticId,
        webhookSecret: updates.webhook_secret || null,
        webhookUrl: updates.webhook_url || null,
      },
      query,
      types: {
        mediaBuyRequest: "JSON",
        mediaBuyResponse: "JSON",
      },
    });
  }

  /**
   * Update tactic status
   */
  async updateTacticStatus(tacticId: string, status: string): Promise<void> {
    const query = `
      UPDATE \`${this.projectId}.${this.dataset}.tactics\`
      SET status = @status, updated_at = CURRENT_TIMESTAMP()
      WHERE id = @tacticId
    `;

    await this.bigquery.query({
      params: { status, tacticId },
      query,
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
          model: "fixed_cpm",
        },
        createdAt: new Date(),
        deliveryType: "guaranteed",
        description: "Premium video advertising on Hulu streaming platform",
        formats: ["video", "display"],
        id: mediaProductId,
        inventoryType: "premium",
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
          model: "fixed_cpm",
        },
        createdAt: new Date(),
        deliveryType: "guaranteed",
        description: "Premium video advertising on Netflix streaming platform",
        formats: ["video"],
        id: mediaProductId,
        inventoryType: "premium",
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
          floorCpm: 5.0,
          model: "auction",
          targetCpm: 12.0,
        },
        createdAt: new Date(),
        deliveryType: "non_guaranteed",
        description: "Video advertising across YouTube platform",
        formats: ["video", "display"],
        id: mediaProductId,
        inventoryType: "premium",
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
          floorCpm: 2.5,
          model: "auction",
          targetCpm: 8.0,
        },
        createdAt: new Date(),
        deliveryType: "non_guaranteed",
        description: "Mixed display and video advertising inventory",
        formats: ["display", "video"],
        id: mediaProductId,
        inventoryType: "run_of_site",
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
