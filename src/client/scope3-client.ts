import { BigQuery } from "@google-cloud/bigquery";

import type {
  BrandAgent,
  BrandAgentCampaign,
  BrandAgentCampaignInput,
  BrandAgentCampaignUpdateInput,
  BrandAgentCreative,
  BrandAgentCreativeInput,
  BrandAgentCreativesData,
  BrandAgentCreativeUpdateInput,
  BrandAgentData,
  BrandAgentInput,
  BrandAgentsData,
  BrandAgentUpdateInput,
  AgentWhereInput as BrandAgentWhereInput,
  BrandStandardsAgent,
  BrandStandardsAgentInput,
  BrandStandardsAgentsData,
  BrandStoryAgent,
  BrandStoryAgentInput,
  BrandStoryAgentsData,
  MeasurementSource,
  MeasurementSourceInput,
  MeasurementSourcesData,
  SyntheticAudience,
  SyntheticAudienceInput,
  SyntheticAudiencesData,
} from "../types/brand-agent.js";
import type {
  AddAssetInput,
  AssignmentResult,
  BulkAssetImportResponse,
  CreateCreativeInput,
  Creative,
  CreativeFilter,
  CreativeFormatsResponse,
  CreativeListResponse,
  CreativeRevisionInput,
  PaginationInput,
  PublisherSyncResult,
  UpdateCreativeInput,
} from "../types/creative.js";
import type { ScoringOutcome, ScoringOutcomeInput } from "../types/events.js";
import type {
  BrandAgentPMPInput,
  DSPSeat,
  PMP,
  PMPUpdateInput,
} from "../types/pmp.js";
import type {
  Agent,
  AgentsData,
  AgentWhereInput,
  BitmapTargetingProfile,
  CreateBitmapTargetingProfileData,
  CreateBitmapTargetingProfileInput,
  CreateStrategyData,
  CreateStrategyInput,
  GenerateUpdatedStrategyPromptData,
  GenerateUpdatedStrategyPromptInput,
  GetAPIAccessKeysData,
  GraphQLResponse,
  ParsedStrategyDetails,
  ParseStrategyPromptData,
  ParseStrategyPromptInput,
  Strategy,
  TargetingDimension,
  UpdateStrategyInput,
} from "../types/scope3.js";
import type {
  OptimizationGoal,
  OptimizationRecommendations,
  ProductDiscoveryQuery,
  PublisherMediaProduct,
  Tactic,
  TacticInput,
  TacticPerformance,
  TacticsData,
  TacticUpdateInput,
} from "../types/tactics.js";
import type {
  WebhookSubscription,
  WebhookSubscriptionInput,
} from "../types/webhooks.js";

import { AuthenticationService } from "../services/auth-service.js";
import { BrandAgentService } from "../services/brand-agent-service.js";
import { CampaignBigQueryService } from "../services/campaign-bigquery-service.js";
import { CreativeService } from "../services/creative-service.js";
import { TacticBigQueryService } from "../services/tactic-bigquery-service.js";
import { GET_AGENTS_QUERY } from "./queries/agents.js";
import { GET_API_ACCESS_KEYS_QUERY } from "./queries/auth.js";
import {
  ADD_MEASUREMENT_SOURCE_MUTATION,
  // CREATE_BRAND_AGENT_CAMPAIGN_MUTATION, // Unused - for future GraphQL operations
  CREATE_BRAND_AGENT_CREATIVE_MUTATION,
  CREATE_BRAND_AGENT_MUTATION,
  CREATE_BRAND_AGENT_STANDARDS_MUTATION,
  CREATE_BRAND_AGENT_SYNTHETIC_AUDIENCE_MUTATION,
  CREATE_SYNTHETIC_AUDIENCE_MUTATION,
  DELETE_BRAND_AGENT_STANDARDS_MUTATION,
  DELETE_BRAND_AGENT_SYNTHETIC_AUDIENCE_MUTATION,
  GET_BRAND_AGENT_QUERY,
  LIST_BRAND_AGENT_CREATIVES_QUERY,
  LIST_BRAND_AGENT_STANDARDS_QUERY,
  LIST_BRAND_AGENT_SYNTHETIC_AUDIENCES_QUERY,
  LIST_BRAND_AGENTS_QUERY,
  LIST_MEASUREMENT_SOURCES_QUERY,
  LIST_SYNTHETIC_AUDIENCES_QUERY,
  // UPDATE_BRAND_AGENT_CAMPAIGN_MUTATION, // Unused - for future GraphQL operations
  UPDATE_BRAND_AGENT_CREATIVE_MUTATION,
  UPDATE_BRAND_AGENT_MUTATION,
  UPDATE_BRAND_AGENT_STANDARDS_MUTATION,
  UPDATE_BRAND_AGENT_SYNTHETIC_AUDIENCE_MUTATION,
} from "./queries/brand-agents.js";
import {
  CREATE_STRATEGY_MUTATION,
  GENERATE_UPDATED_STRATEGY_PROMPT_QUERY,
  PARSE_STRATEGY_PROMPT_QUERY,
  UPDATE_ONE_STRATEGY_MUTATION,
} from "./queries/campaigns.js";
import {
  CREATE_SCORING_OUTCOME_MUTATION,
  CREATE_WEBHOOK_SUBSCRIPTION_MUTATION,
  // GET_BRAND_AGENT_CAMPAIGN_WITH_DELIVERY_QUERY, // Unused - for future GraphQL operations
  GET_BUDGET_ALLOCATIONS_QUERY,
  GET_CAMPAIGN_DELIVERY_DATA_QUERY,
  GET_CAMPAIGN_TACTICS_QUERY,
  GET_SCORING_OUTCOMES_QUERY,
  GET_TACTIC_BREAKDOWN_QUERY,
  LIST_WEBHOOK_SUBSCRIPTIONS_QUERY,
} from "./queries/reporting.js";
import {
  CREATE_TACTIC_MUTATION,
  DELETE_TACTIC_MUTATION,
  GET_TACTIC_PERFORMANCE_QUERY,
  LIST_TACTICS_QUERY,
  UPDATE_TACTIC_MUTATION,
} from "./queries/tactics.js";
// Creative queries will be imported when needed for actual implementation
// import {
//   ASSIGN_CREATIVE_TO_CAMPAIGN_MUTATION,
//   CREATE_CREATIVE_MUTATION,
//   GET_CAMPAIGN_CREATIVES_QUERY,
//   GET_CREATIVE_QUERY,
//   GET_CREATIVES_QUERY,
//   UNASSIGN_CREATIVE_FROM_CAMPAIGN_MUTATION,
//   UPLOAD_ASSET_MUTATION,
// } from "./queries/creatives.js";
import { GET_OPTIMIZATION_RECOMMENDATIONS_QUERY } from "./queries/tactics.js";
import {
  CREATE_BITMAP_TARGETING_PROFILE_MUTATION,
  GET_TARGETING_DIMENSIONS_QUERY,
} from "./queries/targeting.js";
// PMP queries imported but not used yet - will be used when backend is ready
// import {
//   CREATE_BRAND_AGENT_PMP_MUTATION,
//   GET_DSP_SEATS_QUERY,
//   LIST_BRAND_AGENT_PMPS_QUERY,
//   UPDATE_BRAND_AGENT_PMP_MUTATION,
// } from "./queries/pmps.js";
import { ProductDiscoveryService } from "./services/product-discovery.js";

export class Scope3ApiClient {
  private authService: AuthenticationService;
  private brandAgentService: BrandAgentService;
  private campaignService: CampaignBigQueryService;
  private creativeService: CreativeService;
  private graphqlUrl: string;
  private productDiscovery: ProductDiscoveryService;
  private tacticService: TacticBigQueryService;

  constructor(graphqlUrl: string) {
    this.graphqlUrl = graphqlUrl;
    this.productDiscovery = new ProductDiscoveryService(graphqlUrl);

    // Initialize shared authentication service
    this.authService = new AuthenticationService(new BigQuery());

    // Initialize specialized services
    this.brandAgentService = new BrandAgentService(this.authService);
    this.campaignService = new CampaignBigQueryService();
    this.creativeService = new CreativeService(this.authService);
    this.tacticService = new TacticBigQueryService();
  }

  /**
   * Add assets via reference management (MCP orchestration)
   * No file uploads - manages URLs, upload IDs, CDN references
   */
  async addAssets(
    apiKey: string,
    input: AddAssetInput,
  ): Promise<BulkAssetImportResponse> {
    console.log("[STUB] addAssets - reference management");
    console.log("Input:", input);

    // Mock asset import results
    const results = input.assets.map((asset, idx) => ({
      assetId: `asset_${Date.now()}_${idx}`,
      originalUrl: asset.source.url,
      success: true,
      uploadId: asset.source.uploadId,
    }));

    return {
      errorCount: 0,
      results,
      successCount: results.length,
      summary: `Successfully added ${results.length} assets via reference management`,
    };
  }

  // Measurement Source methods (stub)
  async addMeasurementSource(
    apiKey: string,
    input: MeasurementSourceInput,
  ): Promise<MeasurementSource> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: ADD_MEASUREMENT_SOURCE_MUTATION,
        variables: { input },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      addMeasurementSource: MeasurementSource;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.addMeasurementSource) {
      throw new Error("No data received");
    }

    return result.data.addMeasurementSource;
  }

  /**
   * Assign creative to campaign (both must belong to same buyer agent)
   */
  async assignCreativeToCampaign(
    apiKey: string,
    creativeId: string,
    campaignId: string,
    _buyerAgentId: string,
  ): Promise<AssignmentResult> {
    try {
      // Assign creative to campaign in BigQuery
      await this.campaignService.assignCreativeToCampaign(
        campaignId,
        creativeId,
      );

      return {
        campaignId,
        creativeId,
        message: `Creative ${creativeId} assigned to campaign ${campaignId}`,
        success: true,
      };
    } catch (error) {
      throw new Error(
        `Failed to assign creative to campaign: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Call list_creative_formats on a specific sales agent
   */
  async callSalesAgentFormatDiscovery(
    salesAgentUrl: string,
    params: {
      acceptsThirdPartyTags?: boolean;
      includeRequirements?: boolean;
    },
  ): Promise<{
    formats: Array<{
      description: string;
      formatId: string;
      name: string;
      requirements: {
        acceptsThirdPartyTags: boolean;
        assemblyCapable: boolean;
        requiredAssets: Array<{
          specs: {
            dimensions?: string;
            formats?: string[];
            maxSize?: string;
          };
          type: string;
        }>;
      };
    }>;
  }> {
    console.log(
      `[DISCOVERY] Calling list_creative_formats on ${salesAgentUrl}`,
      params,
    );

    try {
      // Make MCP call to sales agent's list_creative_formats tool
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch(salesAgentUrl, {
        body: JSON.stringify({
          id: `format-discovery-${Date.now()}`,
          jsonrpc: "2.0",
          method: "tools/call",
          params: {
            arguments: params,
            name: "list_creative_formats",
          },
        }),
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Scope3-MCP-Client/1.0",
        },
        method: "POST",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = (await response.json()) as Record<string, unknown>;

      if (result.error) {
        const error = result.error as Record<string, unknown>;
        throw new Error(`MCP Error: ${error.message || "Unknown error"}`);
      }

      // Parse the response - assuming it follows our format structure
      // In real implementation, we'd need to handle different sales agent response formats
      const resultData = result.result as Record<string, unknown> | undefined;
      const formats = Array.isArray(resultData?.formats)
        ? resultData.formats
        : [];

      return { formats };
    } catch (error) {
      console.warn(`Failed to discover formats from ${salesAgentUrl}:`, error);
      throw error;
    }
  }

  async createBitmapTargetingProfile(
    apiKey: string,
    input: CreateBitmapTargetingProfileInput,
  ): Promise<BitmapTargetingProfile> {
    const variables = {
      anyOf: input.anyOf.map((id) => parseInt(id)),
      customerId: parseInt(input.customerId),
      dimensionName: input.dimensionName,
      noneOf: input.noneOf.map((id) => parseInt(id)),
      strategyId: parseInt(input.strategyId),
    };

    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_BITMAP_TARGETING_PROFILE_MUTATION,
        variables,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result =
      (await response.json()) as GraphQLResponse<CreateBitmapTargetingProfileData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.createBitmapTargetingProfile) {
      throw new Error("No data received");
    }

    return result.data.createBitmapTargetingProfile;
  }

  // Brand Agent methods
  async createBrandAgent(
    apiKey: string,
    input: BrandAgentInput,
  ): Promise<BrandAgent> {
    // Create the core brand agent via GraphQL (without customer-scoped fields)
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_BRAND_AGENT_MUTATION,
        variables: {
          description: input.description,
          name: input.name,
        },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      createBrandAgent: BrandAgent;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.createBrandAgent) {
      throw new Error("No data received");
    }

    const brandAgent = result.data.createBrandAgent;

    // If we have customer-scoped fields, create/update the BigQuery extension
    if (input.externalId || input.nickname) {
      try {
        await this.brandAgentService.upsertBrandAgentExtension(brandAgent.id, {
          advertiserDomains: input.advertiserDomains,
          description: input.description,
          externalId: input.externalId,
          nickname: input.nickname,
        });
      } catch (error) {
        console.warn("Failed to create brand agent extension:", error);
        // Don't fail the entire operation - the core brand agent was created successfully
      }
    }

    // Return the enhanced brand agent with extension fields
    return {
      ...brandAgent,
      externalId: input.externalId,
      nickname: input.nickname,
    };
  }

  // Brand Agent Campaign methods
  async createBrandAgentCampaign(
    apiKey: string,
    input: BrandAgentCampaignInput,
  ): Promise<BrandAgentCampaign> {
    try {
      // Create campaign in BigQuery
      const campaignId = await this.campaignService.createCampaign(
        {
          brandAgentId: input.brandAgentId,
          budgetCurrency: input.budget?.currency,
          budgetDailyCap: input.budget?.dailyCap,
          budgetPacing: input.budget?.pacing,
          budgetTotal: input.budget?.total,
          endDate: input.endDate,
          name: input.name,
          prompt: input.prompt,
          startDate: input.startDate,
          status: "draft", // Always start as draft
        },
        apiKey,
      );

      // Assign audience IDs (brand stories) if provided
      if (input.audienceIds?.length) {
        for (const storyId of input.audienceIds) {
          await this.campaignService.assignBrandStoryToCampaign(
            campaignId,
            storyId,
          );
        }
      }

      // Return the created campaign
      const campaign = await this.campaignService.getCampaign(
        campaignId,
        apiKey,
      );
      if (!campaign) {
        throw new Error("Failed to retrieve created campaign");
      }

      return campaign;
    } catch (error) {
      // Campaign operations are BigQuery-only (not available in GraphQL)
      throw new Error(
        `Failed to create campaign: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Brand Agent Creative methods
  async createBrandAgentCreative(
    apiKey: string,
    input: BrandAgentCreativeInput,
  ): Promise<BrandAgentCreative> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_BRAND_AGENT_CREATIVE_MUTATION,
        variables: { input },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      createBrandAgentCreative: BrandAgentCreative;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.createBrandAgentCreative) {
      throw new Error("No data received");
    }

    return result.data.createBrandAgentCreative;
  }

  // Create Brand Agent PMP (stubbed until backend ready)
  async createBrandAgentPMP(
    apiKey: string,
    input: BrandAgentPMPInput,
  ): Promise<PMP> {
    // STUB implementation - will use parse/create pattern like campaigns
    console.log("[STUB] createBrandAgentPMP", input);

    // Mock PMP with realistic deal IDs
    const pmp: PMP = {
      brandAgentId: input.brandAgentId,
      createdAt: new Date(),
      dealIds: [
        {
          dealId: `GOOG_${Date.now()}`,
          ssp: "Google Ad Manager",
          status: "active",
        },
        {
          dealId: `AMZN_${Date.now()}`,
          ssp: "Amazon Publisher Services",
          status: "pending",
        },
        {
          dealId: `TTD_${Date.now()}`,
          ssp: "The Trade Desk",
          status: "active",
        },
      ],
      id: `pmp_${Date.now()}`,
      name: input.name || "PMP Campaign",
      prompt: input.prompt,
      status: "active",
      summary:
        "Created PMP targeting CTV inventory from premium publishers. Deal IDs have been generated for 3 SSPs with competitive CPMs and exclusive inventory access.",
      updatedAt: new Date(),
    };

    return pmp;
  }

  async createBrandAgentStandards(
    apiKey: string,
    input: BrandStandardsAgentInput,
  ): Promise<BrandStandardsAgent> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_BRAND_AGENT_STANDARDS_MUTATION,
        variables: { ...input },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      createBrandStandardsAgent: BrandStandardsAgent;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.createBrandStandardsAgent) {
      throw new Error("No data received");
    }

    return result.data.createBrandStandardsAgent;
  }

  async createBrandAgentSyntheticAudience(
    apiKey: string,
    input: BrandStoryAgentInput,
  ): Promise<BrandStoryAgent> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_BRAND_AGENT_SYNTHETIC_AUDIENCE_MUTATION,
        variables: { ...input },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      createBrandStoryAgent: BrandStoryAgent;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.createBrandStoryAgent) {
      throw new Error("No data received");
    }

    return result.data.createBrandStoryAgent;
  }

  /**
   * Create creatives via orchestration (no file uploads)
   * Handles format specification and content sources
   */
  async createCreative(
    apiKey: string,
    input: CreateCreativeInput,
  ): Promise<Creative> {
    // Validate format specification
    if (!input.format?.type || !input.format?.formatId) {
      throw new Error(
        "Format specification required (format.type and format.formatId)",
      );
    }

    // Validate content sources
    const { assetIds, htmlSnippet, javascriptTag, productUrl, vastTag } =
      (input.content as Record<string, unknown>) || {};
    const hasContent =
      htmlSnippet ||
      javascriptTag ||
      vastTag ||
      (Array.isArray(assetIds) && assetIds.length > 0) ||
      productUrl;

    if (!hasContent) {
      throw new Error("At least one content source required");
    }

    try {
      // Create creative in BigQuery
      const creativeId = await this.creativeService.createCreative({
        brandAgentId: input.buyerAgentId,
        content: (input.content as Record<string, unknown>) || {},
        creativeDescription: input.creativeDescription,
        creativeName: input.creativeName,
        format: input.format.formatId,
        targetAudience:
          typeof input.targetAudience === "string"
            ? { description: input.targetAudience }
            : input.targetAudience,
      });

      // Return the created creative
      const creative = await this.creativeService.getCreative(
        creativeId,
        undefined,
        apiKey,
      );
      if (!creative) {
        throw new Error("Failed to retrieve created creative");
      }

      return creative;
    } catch (error) {
      throw new Error(
        `Failed to create creative: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async createCustomSignal(
    apiKey: string,
    input: {
      clusters: Array<{
        channel?: string;
        gdpr?: boolean;
        region: string;
      }>;
      description: string;
      key: string;
      name: string;
    },
  ): Promise<{
    clusters: Array<{
      channel?: string;
      gdpr?: boolean;
      region: string;
    }>;
    createdAt: string;
    description: string;
    id: string;
    key: string;
    name: string;
  }> {
    const response = await fetch("https://api.scope3.com/signal", {
      body: JSON.stringify(input),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    return (await response.json()) as {
      clusters: Array<{
        channel?: string;
        gdpr?: boolean;
        region: string;
      }>;
      createdAt: string;
      description: string;
      id: string;
      key: string;
      name: string;
    };
  }

  async createScoringOutcome(
    apiKey: string,
    input: ScoringOutcomeInput,
  ): Promise<ScoringOutcome> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_SCORING_OUTCOME_MUTATION,
        variables: { input },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    const result = (await response.json()) as GraphQLResponse<{
      createScoringOutcome: ScoringOutcome;
    }>;

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    if (!result.data?.createScoringOutcome) {
      throw new Error("Failed to create scoring outcome");
    }

    return result.data.createScoringOutcome;
  }

  async createStrategy(
    apiKey: string,
    input: CreateStrategyInput,
  ): Promise<Strategy> {
    const variables = {
      brandStandardsAgentId: input.brandStandardsAgentId
        ? parseInt(input.brandStandardsAgentId)
        : null,
      brandStoryAgentIds: input.brandStoryAgentIds?.map((id) => parseInt(id)),
      channelCodes: input.channelCodes,
      countryCodes: input.countryCodes,
      name: input.name,
      prompt: input.prompt,
      smartPropertyListIds: input.smartPropertyListIds,
      strategyType: input.strategyType,
      targetingProfileIds: input.targetingProfileIds,
    };

    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_STRATEGY_MUTATION,
        variables,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result =
      (await response.json()) as GraphQLResponse<CreateStrategyData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.createStrategy) {
      throw new Error("No data received");
    }

    const strategy = result.data.createStrategy;

    // Check if it's an error response
    if ("code" in strategy) {
      throw new Error(
        `Strategy creation failed: ${strategy.message || strategy.code}`,
      );
    }

    return strategy as Strategy;
  }

  // Synthetic Audience methods (stub)
  async createSyntheticAudience(
    apiKey: string,
    input: SyntheticAudienceInput,
  ): Promise<SyntheticAudience> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_SYNTHETIC_AUDIENCE_MUTATION,
        variables: { input },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      createSyntheticAudience: SyntheticAudience;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.createSyntheticAudience) {
      throw new Error("No data received");
    }

    return result.data.createSyntheticAudience;
  }

  // Create tactic (product + targeting)
  async createTactic(apiKey: string, input: TacticInput): Promise<Tactic> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_TACTIC_MUTATION,
        variables: { input },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      createTactic: Tactic;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.createTactic) {
      throw new Error("No data received");
    }

    return result.data.createTactic;
  }

  async createWebhookSubscription(
    apiKey: string,
    input: WebhookSubscriptionInput,
  ): Promise<WebhookSubscription> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_WEBHOOK_SUBSCRIPTION_MUTATION,
        variables: { input },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    const result = (await response.json()) as GraphQLResponse<{
      createWebhookSubscription: WebhookSubscription;
    }>;

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    if (!result.data?.createWebhookSubscription) {
      throw new Error("Failed to create webhook subscription");
    }

    return result.data.createWebhookSubscription;
  }

  async deleteBrandAgent(_apiKey: string, _id: string): Promise<boolean> {
    // Note: DELETE mutation not available in GraphQL API
    throw new Error("Delete operation not supported by the GraphQL API");
  }

  async deleteBrandAgentCampaign(apiKey: string, id: string): Promise<void> {
    // Campaign deletions are BigQuery-only (not available in GraphQL)
    await this.campaignService.deleteCampaign(id, apiKey);
  }

  async deleteBrandAgentStandards(
    apiKey: string,
    standardsId: string,
  ): Promise<{ archivedAt: string; id: string }> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: DELETE_BRAND_AGENT_STANDARDS_MUTATION,
        variables: { id: standardsId, now: new Date().toISOString() },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      updateAgent: { archivedAt: string; id: string };
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.updateAgent) {
      throw new Error("No data received");
    }

    return result.data.updateAgent;
  }

  async deleteBrandAgentSyntheticAudience(
    apiKey: string,
    syntheticAudienceId: string,
  ): Promise<{ archivedAt: string; id: string }> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: DELETE_BRAND_AGENT_SYNTHETIC_AUDIENCE_MUTATION,
        variables: { id: syntheticAudienceId, now: new Date().toISOString() },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      updateAgent: { archivedAt: string; id: string };
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.updateAgent) {
      throw new Error("No data received");
    }

    return result.data.updateAgent;
  }

  /**
   * Delete a creative permanently
   */
  async deleteCreative(apiKey: string, creativeId: string): Promise<void> {
    try {
      await this.creativeService.deleteCreative(creativeId, apiKey);
    } catch (error) {
      throw new Error(
        `Failed to delete creative: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async deleteCustomSignal(
    apiKey: string,
    signalId: string,
  ): Promise<{
    deleted: boolean;
    id: string;
  }> {
    const response = await fetch(`https://api.scope3.com/signal/${signalId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "MCP-Server/1.0",
      },
      method: "DELETE",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status === 404) {
        throw new Error("Signal not found");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    return (await response.json()) as {
      deleted: boolean;
      id: string;
    };
  }

  // Delete tactic
  async deleteTactic(apiKey: string, tacticId: string): Promise<boolean> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: DELETE_TACTIC_MUTATION,
        variables: { id: tacticId },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      deleteTactic: { success: boolean };
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.deleteTactic) {
      throw new Error("No data received");
    }

    return result.data.deleteTactic.success;
  }

  // Discover publisher media products
  async discoverPublisherProducts(
    apiKey: string,
    query: ProductDiscoveryQuery,
  ): Promise<PublisherMediaProduct[]> {
    return this.productDiscovery.discoverProducts(apiKey, query);
  }

  async generateUpdatedStrategyPrompt(
    apiKey: string,
    input: GenerateUpdatedStrategyPromptInput,
  ): Promise<string> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GENERATE_UPDATED_STRATEGY_PROMPT_QUERY,
        variables: input,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result =
      (await response.json()) as GraphQLResponse<GenerateUpdatedStrategyPromptData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.generateUpdatedStrategyPrompt) {
      throw new Error("No data received");
    }

    return result.data.generateUpdatedStrategyPrompt;
  }

  /**
   * Get ADCP standard formats (from specification)
   */
  async getAdcpStandardFormats(): Promise<
    Array<{
      description: string;
      formatId: string;
      name: string;
      requirements: {
        acceptsThirdPartyTags: boolean;
        assemblyCapable: boolean;
        requiredAssets: Array<{
          specs: {
            dimensions?: string;
            formats?: string[];
            maxSize?: string;
          };
          type: string;
        }>;
      };
    }>
  > {
    // Return the ADCP standard formats from the official specification
    // This could be fetched from https://adcontextprotocol.org in real implementation
    return [
      {
        description: "Standard display banner with flexible dimensions",
        formatId: "display_banner",
        name: "Display Banner",
        requirements: {
          acceptsThirdPartyTags: true,
          assemblyCapable: true,
          requiredAssets: [
            {
              specs: {
                dimensions: "flexible",
                formats: ["jpg", "png", "gif", "webp"],
                maxSize: "150KB",
              },
              type: "image",
            },
          ],
        },
      },
      {
        description:
          "Native ad template with headline, body, and image (ADCP PR #49)",
        formatId: "native_sponsored_post",
        name: "Native Sponsored Post",
        requirements: {
          acceptsThirdPartyTags: false,
          assemblyCapable: true,
          requiredAssets: [
            {
              specs: {
                dimensions: "1200x628",
                formats: ["jpg", "png"],
                maxSize: "1MB",
              },
              type: "image",
            },
            {
              specs: {},
              type: "text",
            },
          ],
        },
      },
      {
        description:
          "Native article template with template variables (ADCP PR #49)",
        formatId: "native_article",
        name: "Native Article",
        requirements: {
          acceptsThirdPartyTags: false,
          assemblyCapable: true,
          requiredAssets: [
            {
              specs: {},
              type: "text",
            },
          ],
        },
      },
      {
        description: "Native product showcase template (ADCP PR #49)",
        formatId: "native_product",
        name: "Native Product",
        requirements: {
          acceptsThirdPartyTags: false,
          assemblyCapable: true,
          requiredAssets: [
            {
              specs: {
                dimensions: "square",
                formats: ["jpg", "png"],
                maxSize: "500KB",
              },
              type: "image",
            },
            {
              specs: {},
              type: "text",
            },
          ],
        },
      },
      {
        description:
          "VAST 4.0 compliant video with snippet support (ADCP PR #49)",
        formatId: "video_vast",
        name: "VAST Video",
        requirements: {
          acceptsThirdPartyTags: true,
          assemblyCapable: true,
          requiredAssets: [
            {
              specs: {
                dimensions: "16:9",
                formats: ["mp4", "webm"],
                maxSize: "100MB",
              },
              type: "video",
            },
          ],
        },
      },
    ];
  }

  // Agent methods
  async getAgents(apiKey: string, where?: AgentWhereInput): Promise<Agent[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_AGENTS_QUERY,
        variables: { where },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<AgentsData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.agents) {
      throw new Error("No data received");
    }

    return result.data.agents;
  }

  async getBrandAgent(apiKey: string, id: string): Promise<BrandAgent> {
    // GraphQL first - get core brand agent data
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_BRAND_AGENT_QUERY,
        variables: { id },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<BrandAgentData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.agent) {
      throw new Error("No data received");
    }

    const graphqlAgent = result.data.agent;

    // BigQuery enhancement - add customer-scoped fields when available
    try {
      const enhancedAgent = await this.brandAgentService.getBrandAgent(id);
      if (enhancedAgent) {
        // Use enhanced version with customer-scoped fields
        return enhancedAgent;
      }
    } catch (error) {
      console.log(
        "BigQuery enhancement failed, using GraphQL data only:",
        error,
      );
    }

    // Return GraphQL data without enhancement
    return graphqlAgent;
  }

  // Reporting methods
  async getBrandAgentCampaign(
    apiKey: string,
    campaignId: string,
  ): Promise<BrandAgentCampaign> {
    // Campaign retrieval is BigQuery-only (not available in GraphQL)
    const campaign = await this.campaignService.getCampaign(campaignId, apiKey);
    if (!campaign) {
      throw new Error("Campaign not found");
    }
    return campaign;
  }

  async getBudgetAllocations(
    apiKey: string,
    campaignId: string,
    dateRange: { end: Date; start: Date },
  ): Promise<Record<string, unknown>[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_BUDGET_ALLOCATIONS_QUERY,
        variables: {
          campaignId,
          endDate: dateRange.end.toISOString().split("T")[0],
          startDate: dateRange.start.toISOString().split("T")[0],
        },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    const result = (await response.json()) as GraphQLResponse<{
      budgetAllocations: Record<string, unknown>[];
    }>;

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data?.budgetAllocations || [];
  }

  /**
   * Get campaign by ID (alias for getBrandAgentCampaign for backward compatibility)
   */
  async getCampaign(
    apiKey: string,
    campaignId: string,
  ): Promise<BrandAgentCampaign> {
    return this.getBrandAgentCampaign(apiKey, campaignId);
  }

  /**
   * Get all creatives assigned to a specific campaign with performance data
   */
  async getCampaignCreatives(
    apiKey: string,
    campaignId: string,
    includePerformance?: boolean,
  ): Promise<Creative[]> {
    console.log(
      "[STUB] getCampaignCreatives - will query campaign assignments",
    );
    console.log("Query:", { campaignId, includePerformance });

    return [];
  }

  // Inventory Option Management Methods

  async getCampaignDeliveryData(
    apiKey: string,
    campaignId: string,
    dateRange: { end: Date; start: Date },
  ): Promise<Record<string, unknown>> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_CAMPAIGN_DELIVERY_DATA_QUERY,
        variables: {
          campaignId,
          endDate: dateRange.end.toISOString().split("T")[0],
          startDate: dateRange.start.toISOString().split("T")[0],
        },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    const result = (await response.json()) as GraphQLResponse<{
      campaignDeliveryData: Record<string, unknown>;
    }>;

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return (
      result.data?.campaignDeliveryData || { dailyDeliveries: [], summary: {} }
    );
  }

  // Inventory Option Management Methods

  async getCampaignTactics(
    apiKey: string,
    campaignId: string,
  ): Promise<Record<string, unknown>[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_CAMPAIGN_TACTICS_QUERY,
        variables: { campaignId },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    const result = (await response.json()) as GraphQLResponse<{
      campaignTactics: Record<string, unknown>[];
    }>;

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data?.campaignTactics || [];
  }

  /**
   * Get a creative by ID with BigQuery implementation
   */
  async getCreative(
    apiKey: string,
    creativeId: string,
    brandAgentId?: string,
  ): Promise<Creative | null> {
    try {
      return await this.creativeService.getCreative(
        creativeId,
        brandAgentId,
        apiKey,
      );
    } catch (error) {
      throw new Error(
        `Failed to get creative: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Authentication methods
  async getCustomerId(apiKey: string): Promise<number> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_API_ACCESS_KEYS_QUERY,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Invalid API key - authentication failed");
      }
      if (response.status === 403) {
        throw new Error(
          "Access forbidden - insufficient permissions for API key",
        );
      }
      if (response.status === 404) {
        throw new Error(
          "Invalid API key - API key not found or does not exist",
        );
      }
      if (response.status >= 500) {
        throw new Error(
          "External service temporarily unavailable - please try again later",
        );
      }
      throw new Error(
        `Request failed with status ${response.status}: ${response.statusText}`,
      );
    }

    const result =
      (await response.json()) as GraphQLResponse<GetAPIAccessKeysData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Unable to get customer information");
    }

    if (
      !result.data?.getAPIAccessKeys?.tokens ||
      result.data.getAPIAccessKeys.tokens.length === 0
    ) {
      throw new Error("No API key information found");
    }

    return result.data.getAPIAccessKeys.tokens[0].customerId;
  }

  async getCustomSignal(
    apiKey: string,
    signalId: string,
  ): Promise<{
    clusters: Array<{
      channel?: string;
      gdpr?: boolean;
      region: string;
    }>;
    createdAt: string;
    description: string;
    id: string;
    key: string;
    name: string;
    updatedAt?: string;
  }> {
    const response = await fetch(`https://api.scope3.com/signal/${signalId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "MCP-Server/1.0",
      },
      method: "GET",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status === 404) {
        throw new Error("Signal not found");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    return (await response.json()) as {
      clusters: Array<{
        channel?: string;
        gdpr?: boolean;
        region: string;
      }>;
      createdAt: string;
      description: string;
      id: string;
      key: string;
      name: string;
      updatedAt?: string;
    };
  }

  // Get DSP seats (stubbed until backend ready)
  async getDSPSeats(
    apiKey: string,
    dsp: string,
    searchTerm?: string,
  ): Promise<DSPSeat[]> {
    // STUB until backend provides this
    console.log("[STUB] getDSPSeats", { dsp, searchTerm });

    // Mock data for common DSPs
    const mockSeats: DSPSeat[] = [
      {
        dspName: dsp,
        id: "seat_1",
        seatId: "seat_123",
        seatName: "Primary Trading Desk",
      },
      {
        dspName: dsp,
        id: "seat_2",
        seatId: "seat_456",
        seatName: "Premium Inventory Seat",
      },
      {
        dspName: dsp,
        id: "seat_3",
        seatId: "seat_789",
        seatName: "Programmatic Reserved",
      },
    ];

    if (searchTerm) {
      return mockSeats.filter((seat) =>
        seat.seatName.toLowerCase().includes(searchTerm.toLowerCase()),
      );
    }

    return mockSeats;
  }

  // Get optimization recommendations
  async getOptimizationRecommendations(
    apiKey: string,
    campaignId: string,
    goal: OptimizationGoal,
  ): Promise<OptimizationRecommendations> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_OPTIMIZATION_RECOMMENDATIONS_QUERY,
        variables: { campaignId, goal },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      optimizationRecommendations: OptimizationRecommendations;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.optimizationRecommendations) {
      throw new Error("No data received");
    }

    return result.data.optimizationRecommendations;
  }

  // Inventory Option Management Methods

  // Get product recommendations
  async getProductRecommendations(
    apiKey: string,
    params: {
      budget: number;
      campaignBrief: string;
      preferredFormats?: string[];
      targetSignals?: ("buyer" | "scope3" | "third_party")[];
    },
  ): Promise<{
    guaranteed: PublisherMediaProduct[];
    nonGuaranteed: PublisherMediaProduct[];
    recommendations: {
      product: PublisherMediaProduct;
      reason: string;
      signalTypes: string[];
    }[];
  }> {
    return this.productDiscovery.getRecommendedProducts(apiKey, params);
  }

  // Inventory Option Management Methods

  /**
   * Get list of registered sales agents for format discovery
   */
  async getRegisteredSalesAgents(
    _apiKey: string,
  ): Promise<Array<{ name: string; url: string }>> {
    console.log(
      "[STUB] getRegisteredSalesAgents - would query registry of active sales agents",
    );

    // Mock sales agents for now - in real implementation this would query a registry
    return [
      { name: "Amazon DSP", url: "https://api.amazon-dsp.com/mcp" },
      { name: "The Trade Desk", url: "https://api.thetradedesk.com/mcp" },
      { name: "Microsoft Advertising", url: "https://api.adnexus.com/mcp" },
      { name: "Scope3 Platform", url: "https://api.scope3.com/mcp" },
    ];
  }

  async getScoringOutcomes(
    apiKey: string,
    campaignId: string,
    dateRange: { end: Date; start: Date },
  ): Promise<ScoringOutcome[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_SCORING_OUTCOMES_QUERY,
        variables: {
          campaignId,
          endDate: dateRange.end.toISOString().split("T")[0],
          startDate: dateRange.start.toISOString().split("T")[0],
        },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    const result = (await response.json()) as GraphQLResponse<{
      scoringOutcomes: ScoringOutcome[];
    }>;

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data?.scoringOutcomes || [];
  }

  // Get tactic by ID (BigQuery implementation)
  async getTactic(apiKey: string, tacticId: string): Promise<null | Tactic> {
    const tacticRecord = await this.tacticService.getTactic(tacticId, apiKey);

    if (!tacticRecord) {
      return null;
    }

    // Convert BigQuery record to Tactic interface
    return {
      brandStoryId: tacticRecord.brand_story_id,
      budgetAllocation: {
        amount: tacticRecord.budget_amount,
        currency: tacticRecord.budget_currency || "USD",
        pacing: tacticRecord.budget_pacing as "asap" | "even" | "front_loaded",
      },
      campaignId: tacticRecord.campaign_id,
      createdAt: new Date(tacticRecord.created_at),
      description: tacticRecord.description,
      effectivePricing: {
        cpm: tacticRecord.cpm,
        currency: "USD",
        totalCpm: tacticRecord.cpm,
      },
      id: tacticRecord.id,
      mediaProduct: {
        basePricing: {
          fixedCpm: tacticRecord.cpm,
          model: "fixed_cpm",
        },
        createdAt: new Date(),
        deliveryType: "non_guaranteed",
        description: `Media product ${tacticRecord.media_product_id}`,
        formats: [],
        id: tacticRecord.media_product_id,
        inventoryType: "run_of_site",
        name:
          (tacticRecord.media_product_name as string) ||
          `Product ${tacticRecord.media_product_id}`,
        productId: tacticRecord.media_product_id,
        publisherId: "unknown",
        publisherName:
          (tacticRecord.publisher_name as string) || "Unknown Publisher",
        updatedAt: new Date(),
      },
      name: tacticRecord.name,
      signalId: tacticRecord.signal_id,
      status: tacticRecord.status as
        | "active"
        | "completed"
        | "draft"
        | "paused",
      updatedAt: new Date(tacticRecord.updated_at),
    };
  }

  async getTacticBreakdown(
    apiKey: string,
    campaignId: string,
    dateRange: { end: Date; start: Date },
  ): Promise<Record<string, unknown>[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_TACTIC_BREAKDOWN_QUERY,
        variables: {
          campaignId,
          endDate: dateRange.end.toISOString().split("T")[0],
          startDate: dateRange.start.toISOString().split("T")[0],
        },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    const result = (await response.json()) as GraphQLResponse<{
      tacticBreakdown: Record<string, unknown>[];
    }>;

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data?.tacticBreakdown || [];
  }

  // Get tactic performance metrics
  async getTacticPerformance(
    apiKey: string,
    campaignId: string,
  ): Promise<{
    campaign: { id: string; name: string };
    options: Array<{
      option: Tactic;
      performance: TacticPerformance;
    }>;
    summary: {
      averageCpm: number;
      totalClicks?: number;
      totalConversions?: number;
      totalImpressions: number;
      totalSpend: number;
    };
  }> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_TACTIC_PERFORMANCE_QUERY,
        variables: { campaignId },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      tacticPerformance: {
        campaign: { id: string; name: string };
        options: Array<{
          option: Tactic;
          performance: TacticPerformance;
        }>;
        summary: {
          averageCpm: number;
          totalClicks?: number;
          totalConversions?: number;
          totalImpressions: number;
          totalSpend: number;
        };
      };
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.tacticPerformance) {
      throw new Error("No data received");
    }

    return result.data.tacticPerformance;
  }

  async getTacticPerformanceById(
    apiKey: string,
    tacticId: string,
    dateRange: { end: Date; start: Date },
  ): Promise<Record<string, unknown>> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_TACTIC_PERFORMANCE_QUERY,
        variables: {
          endDate: dateRange.end.toISOString().split("T")[0],
          startDate: dateRange.start.toISOString().split("T")[0],
          tacticId,
        },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    const result = (await response.json()) as GraphQLResponse<{
      tacticPerformance: Record<string, unknown>;
    }>;

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return (result.data?.tacticPerformance as Record<string, unknown>) || {};
  }

  // Targeting methods
  async getTargetingDimensions(apiKey: string): Promise<TargetingDimension[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_TARGETING_DIMENSIONS_QUERY,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      targetingDimensions: TargetingDimension[];
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.targetingDimensions) {
      throw new Error("No data received");
    }

    return result.data.targetingDimensions;
  }

  async listBrandAgentCampaigns(
    apiKey: string,
    brandAgentId: string,
    status?: string,
  ): Promise<BrandAgentCampaign[]> {
    // Campaign operations are BigQuery-only (not available in GraphQL)
    return await this.campaignService.listCampaigns(
      brandAgentId,
      status,
      apiKey,
    );
  }

  async listBrandAgentCreatives(
    apiKey: string,
    brandAgentId: string,
  ): Promise<BrandAgentCreative[]> {
    try {
      // Try BigQuery first - convert Creative[] to BrandAgentCreative[]
      const creatives = await this.creativeService.listCreatives(
        brandAgentId,
        undefined,
        apiKey,
      );
      return creatives.map((creative) => ({
        // Optional fields
        body: creative.creativeDescription,
        brandAgentId,
        createdAt: new Date(creative.createdDate),
        cta: this.extractCTAFromContent(creative.content),
        headline: creative.creativeName,
        id: creative.creativeId,
        name: creative.creativeName,
        type: this.mapFormatToType(creative.format?.type || "adcp"),
        updatedAt: new Date(creative.lastModifiedDate),
        url: this.extractUrlFromContent(creative.content),
      }));
    } catch (error) {
      console.log(
        "BigQuery listBrandAgentCreatives failed, falling back to GraphQL:",
        error,
      );
    }

    // Fallback to GraphQL
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: LIST_BRAND_AGENT_CREATIVES_QUERY,
        variables: { brandAgentId },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result =
      (await response.json()) as GraphQLResponse<BrandAgentCreativesData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.brandAgentCreatives) {
      throw new Error("No data received");
    }

    return result.data.brandAgentCreatives;
  }

  // List Brand Agent PMPs (stubbed until backend ready)
  async listBrandAgentPMPs(
    apiKey: string,
    brandAgentId: string,
  ): Promise<PMP[]> {
    // STUB implementation
    console.log("[STUB] listBrandAgentPMPs", { brandAgentId });

    // Return empty array for now
    return [];
  }

  // ========================================
  // CREATIVE MANAGEMENT METHODS (MCP Orchestration + REST)
  // ========================================

  async listBrandAgents(
    apiKey: string,
    where?: BrandAgentWhereInput,
  ): Promise<BrandAgent[]> {
    // GraphQL first - get core brand agent data
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: LIST_BRAND_AGENTS_QUERY,
        variables: { where },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      // Enhanced logging for brand agent list failures - capture response body for 4xx errors
      let errorBody = null;
      try {
        if (response.status >= 400 && response.status < 500) {
          errorBody = await response.text();
        }
      } catch {
        // Ignore body parsing errors
      }

      console.error(
        `[listBrandAgents] HTTP ${response.status} ${response.statusText}`,
        {
          headers: Object.fromEntries(response.headers.entries()),
          status: response.status,
          statusText: response.statusText,
          url: this.graphqlUrl,
          ...(errorBody && { responseBody: errorBody }),
        },
      );

      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error(
        `Request failed with status ${response.status}: ${response.statusText}${errorBody ? ` - ${errorBody}` : ""}`,
      );
    }

    const result = (await response.json()) as GraphQLResponse<BrandAgentsData>;

    if (result.errors && result.errors.length > 0) {
      console.error(`[listBrandAgents] GraphQL errors:`, result.errors);
      throw new Error(
        `Invalid request parameters or query: ${result.errors.map((e) => e.message).join(", ")}`,
      );
    }

    if (!result.data?.agents) {
      console.error(`[listBrandAgents] No brand agents data received`, result);
      throw new Error("No data received");
    }

    const graphqlAgents = result.data.agents;

    // BigQuery enhancement - add customer-scoped fields when available
    try {
      // Get customer ID from the first agent (all agents should have same customerId)
      const customerId =
        graphqlAgents.length > 0 ? Number(graphqlAgents[0].customerId) : 1;

      // Bulk query: Get all extensions for this customer in one query
      const extensionsMap =
        await this.brandAgentService.getBrandAgentExtensionsByCustomer(
          customerId,
        );

      // In-memory join: Enhance each GraphQL agent with BigQuery extensions
      const enhancedAgents: BrandAgent[] = graphqlAgents.map((agent) => {
        const extension = extensionsMap.get(String(agent.id));
        return this.brandAgentService.enhanceAgentWithExtensions(
          agent as unknown as Record<string, unknown>,
          extension,
        );
      });

      console.log(
        `[listBrandAgents] Enhanced ${enhancedAgents.length} agents with BigQuery data using 1 bulk query (instead of ${graphqlAgents.length} individual queries)`,
      );

      return enhancedAgents;
    } catch (error) {
      console.log(
        "BigQuery bulk enhancement failed, using GraphQL data only:",
        error,
      );
      // Return GraphQL data without enhancement
      return graphqlAgents;
    }
  }

  // Brand Standards Agent methods
  async listBrandAgentStandards(
    apiKey: string,
    brandAgentId: string,
  ): Promise<BrandStandardsAgent[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: LIST_BRAND_AGENT_STANDARDS_QUERY,
        variables: { brandAgentId },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result =
      (await response.json()) as GraphQLResponse<BrandStandardsAgentsData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    return result.data?.brandStandardsAgents || [];
  }

  // Synthetic Audience Agent methods
  async listBrandAgentSyntheticAudiences(
    apiKey: string,
    brandAgentId: string,
  ): Promise<BrandStoryAgent[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: LIST_BRAND_AGENT_SYNTHETIC_AUDIENCES_QUERY,
        variables: { brandAgentId },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result =
      (await response.json()) as GraphQLResponse<BrandStoryAgentsData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    return result.data?.brandStoryAgents || [];
  }

  /**
   * List available creative formats from all providers
   */
  async listCreativeFormats(
    apiKey: string,
    filters?: {
      acceptsThirdPartyTags?: boolean;
      assemblyCapable?: boolean;
      search?: string;
      type?: "adcp" | "creative_agent" | "publisher";
    },
  ): Promise<CreativeFormatsResponse> {
    console.log("[STUB] listCreativeFormats - discovery from all providers");
    console.log("Filters:", filters);

    // Standard AdCP formats - sync with actual AdCP specification
    return {
      adcp_formats: [
        {
          description: "Standard mobile banner format",
          formatId: "display_banner_320x50",
          name: "Mobile Banner 320x50",
          requirements: {
            acceptsThirdPartyTags: true,
            assemblyCapable: true,
            requiredAssets: [
              {
                specs: {
                  dimensions: "320x50",
                  formats: ["jpg", "png", "gif"],
                  maxSize: "150KB",
                },
                type: "image",
              },
            ],
          },
          type: "adcp",
        },
        {
          description: "Standard leaderboard banner format",
          formatId: "display_banner_728x90",
          name: "Leaderboard Banner 728x90",
          requirements: {
            acceptsThirdPartyTags: true,
            assemblyCapable: true,
            requiredAssets: [
              {
                specs: {
                  dimensions: "728x90",
                  formats: ["jpg", "png", "gif"],
                  maxSize: "150KB",
                },
                type: "image",
              },
            ],
          },
          type: "adcp",
        },
        {
          description: "Standard VAST 4.0 compliant video creative",
          formatId: "video_vast_preroll",
          name: "VAST Video Pre-roll",
          requirements: {
            acceptsThirdPartyTags: true,
            assemblyCapable: true,
            requiredAssets: [
              {
                specs: {
                  dimensions: "16:9",
                  formats: ["mp4"],
                  maxSize: "100MB",
                },
                type: "video",
              },
            ],
          },
          type: "adcp",
        },
        {
          description: "Standard native article placement",
          formatId: "native_article",
          name: "Native Article Format",
          requirements: {
            acceptsThirdPartyTags: false,
            assemblyCapable: true,
            requiredAssets: [
              {
                specs: {
                  dimensions: "1200x628",
                  formats: ["jpg", "png"],
                  maxSize: "1MB",
                },
                type: "image",
              },
              {
                specs: {},
                type: "text",
              },
            ],
          },
          type: "adcp",
        },
      ],
      creative_agent_formats: [
        {
          description: "AI-generated creative from product catalog data",
          formatId: "ai_dynamic_product",
          name: "AI Dynamic Product Creative",
          requirements: {
            acceptsThirdPartyTags: false,
            assemblyCapable: true,
            requiredAssets: [],
          },
          type: "creative_agent",
        },
        {
          description: "AI-generated creative from brand guidelines and assets",
          formatId: "ai_brand_template",
          name: "AI Brand Template Generator",
          requirements: {
            acceptsThirdPartyTags: false,
            assemblyCapable: true,
            requiredAssets: [
              {
                specs: {
                  dimensions: "any",
                  formats: ["png", "svg"],
                  maxSize: "10MB",
                },
                type: "logo",
              },
            ],
          },
          type: "creative_agent",
        },
      ],
      publisher_formats: [
        {
          description: "Amazon DSP specific Connected TV video format",
          formatId: "amazon_dsp_ctv_video",
          name: "Amazon DSP CTV Video",
          requirements: {
            acceptsThirdPartyTags: false,
            assemblyCapable: true,
            requiredAssets: [
              {
                specs: {
                  dimensions: "1920x1080",
                  formats: ["mp4"],
                  maxSize: "200MB",
                },
                type: "video",
              },
              {
                specs: {
                  dimensions: "400x400",
                  formats: ["png"],
                  maxSize: "1MB",
                },
                type: "logo",
              },
            ],
          },
          type: "publisher",
        },
        {
          description: "Google Display & Video 360 responsive display creative",
          formatId: "google_dv360_responsive_display",
          name: "Google DV360 Responsive Display",
          requirements: {
            acceptsThirdPartyTags: true,
            assemblyCapable: true,
            requiredAssets: [
              {
                specs: {
                  dimensions: "responsive",
                  formats: ["jpg", "png"],
                  maxSize: "5MB",
                },
                type: "image",
              },
              {
                specs: {},
                type: "text",
              },
              {
                specs: {
                  dimensions: "128x128",
                  formats: ["png"],
                  maxSize: "100KB",
                },
                type: "logo",
              },
            ],
          },
          type: "publisher",
        },
      ],
    };
  }

  /**
   * List creatives for a buyer agent with optional filters
   */
  async listCreatives(
    apiKey: string,
    buyerAgentId: string,
    filter?: CreativeFilter,
    pagination?: PaginationInput,
    _includeCampaigns?: boolean,
  ): Promise<CreativeListResponse> {
    try {
      // Try BigQuery first
      const creatives = await this.creativeService.listCreatives(
        buyerAgentId,
        filter?.status,
        apiKey,
      );

      // Get assignment counts
      const assignmentCounts =
        await this.creativeService.getCreativeAssignmentCounts(buyerAgentId);

      // Apply pagination if provided
      const startIndex = pagination?.offset || 0;
      const limit = pagination?.limit || 50;
      const paginatedCreatives = creatives.slice(
        startIndex,
        startIndex + limit,
      );

      // Convert to expected format
      const formattedCreatives = paginatedCreatives.map((creative) => ({
        assemblyMethod: creative.assemblyMethod,
        assetIds: creative.assetIds,
        buyerAgentId: creative.buyerAgentId,
        content: creative.content,
        contentCategories: creative.contentCategories,
        createdBy: creative.createdBy,
        createdDate: creative.createdDate,
        creativeDescription: creative.creativeDescription,
        creativeId: creative.creativeId,
        creativeName: creative.creativeName,
        customerId: creative.customerId,
        format: creative.format,
        lastModifiedBy: creative.lastModifiedBy,
        lastModifiedDate: creative.lastModifiedDate,
        status: creative.status,
        targetAudience: creative.targetAudience,
        version: creative.version,
      }));

      // Calculate summary statistics
      const assignedCreativeCount = creatives.filter(
        (c) => assignmentCounts[c.creativeId] > 0,
      ).length;

      const summary = {
        activeCreatives: creatives.filter((c) => c.status === "active").length,
        assignedCreatives: assignedCreativeCount,
        draftCreatives: creatives.filter((c) => c.status === "draft").length,
        totalCreatives: creatives.length,
        unassignedCreatives: creatives.length - assignedCreativeCount,
      };

      return {
        creatives: formattedCreatives,
        hasMore: startIndex + limit < creatives.length,
        summary,
        totalCount: creatives.length,
      };
    } catch (error) {
      throw new Error(
        `Failed to list creatives: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async listCustomSignals(
    apiKey: string,
    filters?: {
      channel?: string;
      region?: string;
    },
  ): Promise<{
    signals: Array<{
      clusters: Array<{
        channel?: string;
        gdpr?: boolean;
        region: string;
      }>;
      createdAt: string;
      description: string;
      id: string;
      key: string;
      name: string;
      updatedAt?: string;
    }>;
    total: number;
  }> {
    const params = new URLSearchParams();
    if (filters?.region) {
      params.append("region", filters.region);
    }
    if (filters?.channel) {
      params.append("channel", filters.channel);
    }

    const url = `https://api.scope3.com/signal${params.toString() ? `?${params.toString()}` : ""}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "MCP-Server/1.0",
      },
      method: "GET",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    return (await response.json()) as {
      signals: Array<{
        clusters: Array<{
          channel?: string;
          gdpr?: boolean;
          region: string;
        }>;
        createdAt: string;
        description: string;
        id: string;
        key: string;
        name: string;
        updatedAt?: string;
      }>;
      total: number;
    };
  }

  async listMeasurementSources(
    apiKey: string,
    brandAgentId: string,
  ): Promise<MeasurementSource[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: LIST_MEASUREMENT_SOURCES_QUERY,
        variables: { brandAgentId },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result =
      (await response.json()) as GraphQLResponse<MeasurementSourcesData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.measurementSources) {
      throw new Error("No data received");
    }

    return result.data.measurementSources;
  }

  async listSyntheticAudiences(
    apiKey: string,
    brandAgentId: string,
  ): Promise<SyntheticAudience[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: LIST_SYNTHETIC_AUDIENCES_QUERY,
        variables: { brandAgentId },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result =
      (await response.json()) as GraphQLResponse<SyntheticAudiencesData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.syntheticAudiences) {
      throw new Error("No data received");
    }

    return result.data.syntheticAudiences;
  }

  // List tactics for a campaign
  async listTactics(apiKey: string, campaignId: string): Promise<Tactic[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: LIST_TACTICS_QUERY,
        variables: { campaignId },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      tactics: TacticsData;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.tactics) {
      throw new Error("No data received");
    }

    return result.data.tactics.tactics;
  }

  async listWebhookSubscriptions(
    apiKey: string,
    brandAgentId: string,
  ): Promise<WebhookSubscription[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: LIST_WEBHOOK_SUBSCRIPTIONS_QUERY,
        variables: { brandAgentId },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    const result = (await response.json()) as GraphQLResponse<{
      webhookSubscriptions: WebhookSubscription[];
    }>;

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
    }

    return result.data?.webhookSubscriptions || [];
  }

  // Campaign methods
  async parseStrategyPrompt(
    apiKey: string,
    input: ParseStrategyPromptInput,
  ): Promise<ParsedStrategyDetails> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: PARSE_STRATEGY_PROMPT_QUERY,
        variables: input,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result =
      (await response.json()) as GraphQLResponse<ParseStrategyPromptData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.parseStrategyPrompt) {
      throw new Error("No data received");
    }

    return result.data.parseStrategyPrompt;
  }

  /**
   * Revise a creative based on publisher feedback
   */
  async reviseCreative(
    apiKey: string,
    params: CreativeRevisionInput,
  ): Promise<Creative> {
    console.log("[STUB] reviseCreative - applying revisions");
    console.log("Revision params:", params);

    // Mock revision result
    return {
      assemblyMethod: "pre_assembled",
      assetIds: params.revisions.assetIds || [],
      buyerAgentId: "ba_123",
      content: {
        ...params.revisions.content,
      },
      contentCategories: params.revisions.contentCategories,
      createdBy: "user@example.com",
      createdDate: new Date(Date.now() - 172800000).toISOString(),
      creativeId: params.creativeId,
      creativeName: "Summer Sale Banner (Revised)",
      customerId: 1,
      format: {
        formatId: "display_banner_728x90",
        type: "adcp",
      },
      lastModifiedBy: "user@example.com",

      lastModifiedDate: new Date().toISOString(),
      status: "pending_review",
      targetAudience: params.revisions.targetAudience,
      version: "1.1",
    };
  }

  /**
   * Sync creative to publishers for approval
   */
  async syncCreativeToPublishers(
    apiKey: string,
    params: {
      campaignId?: string;
      creativeId: string;
      preApproval?: boolean;
      publisherIds: string[];
    },
  ): Promise<PublisherSyncResult[]> {
    console.log("[STUB] syncCreativeToPublishers - syncing for approval");
    console.log("Params:", params);

    // Mock sync results
    return params.publisherIds.map((publisherId) => {
      // Simulate different scenarios
      const isStandardFormat = Math.random() > 0.3;
      const syncSuccess = Math.random() > 0.1;

      return {
        approvalStatus:
          syncSuccess && isStandardFormat ? "auto_approved" : "pending",
        creativeId: params.creativeId,
        error: syncSuccess
          ? undefined
          : "Publisher API temporarily unavailable",
        estimatedReviewTime: isStandardFormat ? "Instant" : "24 hours",
        publisherId,
        publisherName: `Publisher ${publisherId}`,
        syncedAt: new Date().toISOString(),
        syncStatus: syncSuccess ? "success" : "failed",
      };
    });
  }

  /**
   * Unassign creative from campaign
   */
  async unassignCreativeFromCampaign(
    apiKey: string,
    creativeId: string,
    campaignId: string,
  ): Promise<AssignmentResult> {
    try {
      // Unassign creative from campaign in BigQuery
      await this.campaignService.unassignCreativeFromCampaign(
        campaignId,
        creativeId,
      );

      return {
        campaignId,
        creativeId,
        message: `Creative ${creativeId} unassigned from campaign ${campaignId}`,
        success: true,
      };
    } catch (error) {
      throw new Error(
        `Failed to unassign creative from campaign: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async updateBrandAgent(
    apiKey: string,
    id: string,
    input: BrandAgentUpdateInput,
  ): Promise<BrandAgent> {
    // Update core brand agent via GraphQL (without customer-scoped fields)
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: UPDATE_BRAND_AGENT_MUTATION,
        variables: {
          description: input.description,
          id: parseInt(id),
          name: input.name,
        },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      updateBrandAgent: BrandAgent;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.updateBrandAgent) {
      throw new Error("No data received");
    }

    const brandAgent = result.data.updateBrandAgent;

    // Update BigQuery extensions if customer-scoped fields present
    if (
      input.externalId !== undefined ||
      input.nickname !== undefined ||
      input.dspSeats !== undefined
    ) {
      try {
        await this.brandAgentService.upsertBrandAgentExtension(id, {
          advertiserDomains: input.advertiserDomains,
          description: input.description,
          dspSeats: input.dspSeats,
          externalId: input.externalId,
          nickname: input.nickname,
        });
      } catch (error) {
        console.warn("Failed to update brand agent extension:", error);
        // Don't fail the entire operation - the core brand agent was updated successfully
      }
    }

    // Return the enhanced brand agent (get fresh data with extensions)
    try {
      const enhancedAgent = await this.brandAgentService.getBrandAgent(id);
      if (enhancedAgent) {
        return enhancedAgent;
      }
    } catch (error) {
      console.log("Failed to get enhanced agent data:", error);
    }

    // Return GraphQL data if enhancement fails
    return brandAgent;
  }

  async updateBrandAgentCampaign(
    apiKey: string,
    id: string,
    input: BrandAgentCampaignUpdateInput,
  ): Promise<BrandAgentCampaign> {
    // Campaign updates are BigQuery-only (not available in GraphQL)
    return await this.campaignService.updateCampaign(
      id,
      {
        budgetCurrency: input.budget?.currency,
        budgetDailyCap: input.budget?.dailyCap,
        budgetPacing: input.budget?.pacing,
        budgetTotal: input.budget?.total,
        endDate: input.endDate,
        name: input.name,
        outcomeScoreWindowDays: input.outcomeScoreWindowDays,
        prompt: input.prompt,
        scoringWeights: input.scoringWeights,
        startDate: input.startDate,
        status: input.status,
      },
      apiKey,
    );
  }

  // ========================================
  // PMP (PRIVATE MARKETPLACE) METHODS
  // ========================================

  async updateBrandAgentCreative(
    apiKey: string,
    id: string,
    input: BrandAgentCreativeUpdateInput,
  ): Promise<BrandAgentCreative> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: UPDATE_BRAND_AGENT_CREATIVE_MUTATION,
        variables: { id, input },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      updateBrandAgentCreative: BrandAgentCreative;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.updateBrandAgentCreative) {
      throw new Error("No data received");
    }

    return result.data.updateBrandAgentCreative;
  }

  // Update Brand Agent PMP (stubbed until backend ready)
  async updateBrandAgentPMP(
    apiKey: string,
    id: string,
    input: PMPUpdateInput,
  ): Promise<PMP> {
    // STUB implementation - will use parse/update pattern
    console.log("[STUB] updateBrandAgentPMP", { id, input });

    const pmp: PMP = {
      brandAgentId: "ba_123", // Would be fetched from existing PMP
      createdAt: new Date(Date.now() - 86400000), // Yesterday
      dealIds: [
        {
          dealId: `GOOG_updated_${Date.now()}`,
          ssp: "Google Ad Manager",
          status: "active",
        },
        {
          dealId: `AMZN_updated_${Date.now()}`,
          ssp: "Amazon Publisher Services",
          status: "active",
        },
      ],
      id,
      name: input.name || "Updated PMP Campaign",
      prompt: input.prompt || "Updated PMP requirements",
      status: input.status || "active",
      summary:
        "PMP updated with new requirements. Deal IDs have been refreshed for optimal performance.",
      updatedAt: new Date(),
    };

    return pmp;
  }

  async updateBrandAgentStandards(
    apiKey: string,
    agentId: string,
    name: string,
    prompt: string,
  ): Promise<{
    createdAt: string;
    id: string;
    name: string;
    prompt: string;
    status: string;
  }> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: UPDATE_BRAND_AGENT_STANDARDS_MUTATION,
        variables: { agentId, name, prompt },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      createAgentModel: {
        createdAt: string;
        id: string;
        name: string;
        prompt: string;
        status: string;
      };
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.createAgentModel) {
      throw new Error("No data received");
    }

    return result.data.createAgentModel;
  }

  async updateBrandAgentSyntheticAudience(
    apiKey: string,
    previousModelId: string,
    name: string,
    prompt: string,
  ): Promise<{
    createdAt: string;
    id: string;
    name: string;
    prompt: string;
    status: string;
  }> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: UPDATE_BRAND_AGENT_SYNTHETIC_AUDIENCE_MUTATION,
        variables: { name, previousModelId, prompt },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      updateBrandStory: {
        createdAt: string;
        id: string;
        name: string;
        prompt: string;
        status: string;
      };
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.updateBrandStory) {
      throw new Error("No data received");
    }

    return result.data.updateBrandStory;
  }

  /**
   * Update existing creative
   */
  async updateCreative(
    apiKey: string,
    input: UpdateCreativeInput,
  ): Promise<Creative> {
    try {
      // Use BigQuery to update the creative
      const updateData: Record<string, unknown> = {};

      if (input.updates.name) {
        updateData.name = input.updates.name;
      }

      if (input.updates.description !== undefined) {
        updateData.description = input.updates.description;
      }

      if (input.updates.content) {
        updateData.content = input.updates.content;
      }

      if (input.updates.status) {
        updateData.status = input.updates.status;
      }

      if (input.updates.targetAudience) {
        updateData.targetAudience =
          typeof input.updates.targetAudience === "string"
            ? { description: input.updates.targetAudience }
            : input.updates.targetAudience;
      }

      if (input.updates.contentCategories) {
        updateData.contentCategories = input.updates.contentCategories;
      }

      updateData.lastModifiedBy = "api_user";

      await this.creativeService.updateCreative(
        input.creativeId,
        updateData,
        apiKey,
      );

      // Get the updated creative to return
      const updatedCreative = await this.creativeService.getCreative(
        input.creativeId,
        undefined,
        apiKey,
      );

      if (!updatedCreative) {
        throw new Error("Creative not found after update");
      }

      return updatedCreative;
    } catch (error) {
      throw new Error(
        `Failed to update creative: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Removed parseCreativePrompt - AI generation handled by creative agents
  // Removed detectFileFormat - handled by REST upload layer

  // Custom Signal Definition Management Methods

  async updateCustomSignal(
    apiKey: string,
    signalId: string,
    input: {
      clusters?: Array<{
        channel?: string;
        gdpr?: boolean;
        region: string;
      }>;
      description?: string;
      name?: string;
    },
  ): Promise<{
    clusters: Array<{
      channel?: string;
      gdpr?: boolean;
      region: string;
    }>;
    createdAt: string;
    description: string;
    id: string;
    key: string;
    name: string;
    updatedAt: string;
  }> {
    const response = await fetch(`https://api.scope3.com/signal/${signalId}`, {
      body: JSON.stringify(input),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "PUT",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status === 404) {
        throw new Error("Signal not found");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    return (await response.json()) as {
      clusters: Array<{
        channel?: string;
        gdpr?: boolean;
        region: string;
      }>;
      createdAt: string;
      description: string;
      id: string;
      key: string;
      name: string;
      updatedAt: string;
    };
  }

  async updateOneStrategy(
    apiKey: string,
    input: UpdateStrategyInput,
  ): Promise<Strategy> {
    const variables = {
      brandStandardsAgentId: input.brandStandardsAgentId
        ? parseInt(input.brandStandardsAgentId)
        : null,
      brandStoryAgentIds: input.brandStoryAgentIds?.map((id) => parseInt(id)),
      channelCodes: input.channelCodes,
      countryCodes: input.countryCodes,
      name: input.name,
      prompt: input.prompt,
      strategyId: parseFloat(input.strategyId),
    };

    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: UPDATE_ONE_STRATEGY_MUTATION,
        variables,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      updateOneStrategy: Strategy;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.updateOneStrategy) {
      throw new Error("No data received");
    }

    return result.data.updateOneStrategy;
  }

  // Update tactic
  async updateTactic(
    apiKey: string,
    tacticId: string,
    input: TacticUpdateInput,
  ): Promise<Tactic> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: UPDATE_TACTIC_MUTATION,
        variables: { id: tacticId, input },
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "MCP-Server/1.0",
      },
      method: "POST",
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<{
      updateTactic: Tactic;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.updateTactic) {
      throw new Error("No data received");
    }

    return result.data.updateTactic;
  }

  // ============================================================================
  // HELPER METHODS FOR TYPE CONVERSIONS
  // ============================================================================

  async validateApiKey(
    apiKey: string,
  ): Promise<{ customerId?: number; isValid: boolean }> {
    try {
      const customerId = await this.getCustomerId(apiKey);
      return { customerId, isValid: true };
    } catch {
      return { isValid: false };
    }
  }

  /**
   * Extract CTA text from creative content
   */
  private extractCTAFromContent(
    content: Record<string, unknown>,
  ): string | undefined {
    // Try to extract CTA from HTML snippet or return undefined
    const html = content?.htmlSnippet;
    if (html && typeof html === "string") {
      const ctaMatch =
        html.match(/<button[^>]*>(.*?)<\/button>/i) ||
        html.match(
          />(Shop|Buy|Learn More|Download|Sign Up|Get Started)[^<]*</i,
        );
      return ctaMatch?.[1];
    }
    return undefined;
  }

  /**
   * Extract URL from creative content
   */
  private extractUrlFromContent(content: Record<string, unknown>): string {
    // Try to find a URL in the content
    return (
      (typeof content?.productUrl === "string" ? content.productUrl : null) ||
      (typeof content?.landingUrl === "string" ? content.landingUrl : null) ||
      (typeof content?.clickUrl === "string" ? content.clickUrl : null) ||
      "https://example.com"
    ); // Fallback URL
  }

  /**
   * Map Creative format type to BrandAgentCreative type
   */
  private mapFormatToType(
    formatType: string,
  ): "html5" | "image" | "native" | "video" {
    switch (formatType) {
      case "adcp":
        return "image"; // Default for ADCP formats
      case "creative_agent":
        return "html5"; // AI-generated creatives are typically HTML5
      case "publisher":
        return "native"; // Publisher-specific formats are often native
      default:
        return "image"; // Safe default
    }
  }

  // Removed parseCreativePrompt - AI generation handled by creative agents
  // Removed detectFileFormat - handled by REST upload layer
}
