import type {
  BrandAgent,
  BrandAgentCampaign,
  BrandAgentCampaignInput,
  BrandAgentCampaignsData,
  BrandAgentCampaignUpdateInput,
  BrandAgentCreative,
  BrandAgentCreativeInput,
  BrandAgentCreativesData,
  BrandAgentCreativeUpdateInput,
  BrandAgentInput,
  BrandAgentsData,
  BrandAgentUpdateInput,
  BrandAgentWhereInput,
  BrandStandards,
  BrandStandardsInput,
  MeasurementSource,
  MeasurementSourceInput,
  MeasurementSourcesData,
  SyntheticAudience,
  SyntheticAudienceInput,
  SyntheticAudiencesData,
} from "../types/brand-agent.js";
import type {
  Creative,
  CreativeAsset,
  CreativeFilter,
  CreativeListResponse,
  CreateCreativeInput,
  CreateAssetInput,
  AssignmentResult,
  PaginationInput,
} from "../types/creative.js";
import type {
  InventoryOption,
  InventoryOptionInput,
  InventoryOptionsData,
  InventoryOptionUpdateInput,
  InventoryPerformance,
  OptimizationGoal,
  OptimizationRecommendations,
  ProductDiscoveryQuery,
  PublisherMediaProduct,
} from "../types/inventory-options.js";
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

import { GET_AGENTS_QUERY } from "./queries/agents.js";
import { GET_API_ACCESS_KEYS_QUERY } from "./queries/auth.js";
import {
  ADD_MEASUREMENT_SOURCE_MUTATION,
  CREATE_BRAND_AGENT_CAMPAIGN_MUTATION,
  CREATE_BRAND_AGENT_CREATIVE_MUTATION,
  CREATE_BRAND_AGENT_MUTATION,
  CREATE_SYNTHETIC_AUDIENCE_MUTATION,
  DELETE_BRAND_AGENT_MUTATION,
  GET_BRAND_AGENT_QUERY,
  GET_BRAND_STANDARDS_QUERY,
  LIST_BRAND_AGENT_CAMPAIGNS_QUERY,
  LIST_BRAND_AGENT_CREATIVES_QUERY,
  LIST_BRAND_AGENTS_QUERY,
  LIST_MEASUREMENT_SOURCES_QUERY,
  LIST_SYNTHETIC_AUDIENCES_QUERY,
  SET_BRAND_STANDARDS_MUTATION,
  UPDATE_BRAND_AGENT_CAMPAIGN_MUTATION,
  UPDATE_BRAND_AGENT_CREATIVE_MUTATION,
  UPDATE_BRAND_AGENT_MUTATION,
} from "./queries/brand-agents.js";
import {
  GET_CREATIVES_QUERY,
  GET_CREATIVE_QUERY,
  CREATE_CREATIVE_MUTATION,
  UPLOAD_ASSET_MUTATION,
  ASSIGN_CREATIVE_TO_CAMPAIGN_MUTATION,
  UNASSIGN_CREATIVE_FROM_CAMPAIGN_MUTATION,
  GET_CAMPAIGN_CREATIVES_QUERY,
} from "./queries/creatives.js";
import {
  CREATE_STRATEGY_MUTATION,
  GENERATE_UPDATED_STRATEGY_PROMPT_QUERY,
  PARSE_STRATEGY_PROMPT_QUERY,
  UPDATE_ONE_STRATEGY_MUTATION,
} from "./queries/campaigns.js";
import {
  CREATE_INVENTORY_OPTION_MUTATION,
  DELETE_INVENTORY_OPTION_MUTATION,
  GET_INVENTORY_PERFORMANCE_QUERY,
  GET_OPTIMIZATION_RECOMMENDATIONS_QUERY,
  LIST_INVENTORY_OPTIONS_QUERY,
  UPDATE_INVENTORY_OPTION_MUTATION,
} from "./queries/inventory-options.js";
import {
  CREATE_BITMAP_TARGETING_PROFILE_MUTATION,
  GET_TARGETING_DIMENSIONS_QUERY,
} from "./queries/targeting.js";
import { ProductDiscoveryService } from "./services/product-discovery.js";

export class Scope3ApiClient {
  private graphqlUrl: string;
  private productDiscovery: ProductDiscoveryService;

  constructor(graphqlUrl: string) {
    this.graphqlUrl = graphqlUrl;
    this.productDiscovery = new ProductDiscoveryService(graphqlUrl);
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
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_BRAND_AGENT_MUTATION,
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
      createBrandAgent: BrandAgent;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.createBrandAgent) {
      throw new Error("No data received");
    }

    return result.data.createBrandAgent;
  }

  // Brand Agent Campaign methods
  async createBrandAgentCampaign(
    apiKey: string,
    input: BrandAgentCampaignInput,
  ): Promise<BrandAgentCampaign> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_BRAND_AGENT_CAMPAIGN_MUTATION,
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
      createBrandAgentCampaign: BrandAgentCampaign;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.createBrandAgentCampaign) {
      throw new Error("No data received");
    }

    return result.data.createBrandAgentCampaign;
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

  // Create inventory option (product + targeting)
  async createInventoryOption(
    apiKey: string,
    input: InventoryOptionInput,
  ): Promise<InventoryOption> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: CREATE_INVENTORY_OPTION_MUTATION,
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
      createInventoryOption: InventoryOption;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.createInventoryOption) {
      throw new Error("No data received");
    }

    return result.data.createInventoryOption;
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

  async deleteBrandAgent(apiKey: string, id: string): Promise<boolean> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: DELETE_BRAND_AGENT_MUTATION,
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

    const result = (await response.json()) as GraphQLResponse<{
      deleteBrandAgent: { success: boolean };
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.deleteBrandAgent) {
      throw new Error("No data received");
    }

    return result.data.deleteBrandAgent.success;
  }

  // Delete inventory option
  async deleteInventoryOption(
    apiKey: string,
    optionId: string,
  ): Promise<boolean> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: DELETE_INVENTORY_OPTION_MUTATION,
        variables: { id: optionId },
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
      deleteInventoryOption: { success: boolean };
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.deleteInventoryOption) {
      throw new Error("No data received");
    }

    return result.data.deleteInventoryOption.success;
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

    const result = (await response.json()) as GraphQLResponse<{
      brandAgent: BrandAgent;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.brandAgent) {
      throw new Error("No data received");
    }

    return result.data.brandAgent;
  }

  async getBrandStandards(
    apiKey: string,
    brandAgentId: string,
  ): Promise<BrandStandards> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: GET_BRAND_STANDARDS_QUERY,
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

    const result = (await response.json()) as GraphQLResponse<{
      brandStandards: BrandStandards;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.brandStandards) {
      throw new Error("No data received");
    }

    return result.data.brandStandards;
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
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
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

  // Get inventory performance metrics
  async getInventoryPerformance(
    apiKey: string,
    campaignId: string,
  ): Promise<{
    campaign: { id: string; name: string };
    options: Array<{
      option: InventoryOption;
      performance: InventoryPerformance;
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
        query: GET_INVENTORY_PERFORMANCE_QUERY,
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
      inventoryPerformance: {
        campaign: { id: string; name: string };
        options: Array<{
          option: InventoryOption;
          performance: InventoryPerformance;
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

    if (!result.data?.inventoryPerformance) {
      throw new Error("No data received");
    }

    return result.data.inventoryPerformance;
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
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: LIST_BRAND_AGENT_CAMPAIGNS_QUERY,
        variables: { brandAgentId, status },
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
      (await response.json()) as GraphQLResponse<BrandAgentCampaignsData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.brandAgentCampaigns) {
      throw new Error("No data received");
    }

    return result.data.brandAgentCampaigns;
  }

  async listBrandAgentCreatives(
    apiKey: string,
    brandAgentId: string,
  ): Promise<BrandAgentCreative[]> {
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

  async listBrandAgents(
    apiKey: string,
    where?: BrandAgentWhereInput,
  ): Promise<BrandAgent[]> {
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
      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication failed");
      }
      if (response.status >= 500) {
        throw new Error("External service temporarily unavailable");
      }
      throw new Error("Request failed");
    }

    const result = (await response.json()) as GraphQLResponse<BrandAgentsData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.brandAgents) {
      throw new Error("No data received");
    }

    return result.data.brandAgents;
  }

  // List inventory options for a campaign
  async listInventoryOptions(
    apiKey: string,
    campaignId: string,
  ): Promise<InventoryOption[]> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: LIST_INVENTORY_OPTIONS_QUERY,
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
      inventoryOptions: InventoryOptionsData;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.inventoryOptions) {
      throw new Error("No data received");
    }

    return result.data.inventoryOptions.inventoryOptions;
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

  // Inventory Option Management Methods

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

  // Brand Standards methods
  async setBrandStandards(
    apiKey: string,
    brandAgentId: string,
    input: BrandStandardsInput,
  ): Promise<BrandStandards> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: SET_BRAND_STANDARDS_MUTATION,
        variables: { brandAgentId, input },
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
      setBrandStandards: BrandStandards;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.setBrandStandards) {
      throw new Error("No data received");
    }

    return result.data.setBrandStandards;
  }

  async updateBrandAgent(
    apiKey: string,
    id: string,
    input: BrandAgentUpdateInput,
  ): Promise<BrandAgent> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: UPDATE_BRAND_AGENT_MUTATION,
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
      updateBrandAgent: BrandAgent;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.updateBrandAgent) {
      throw new Error("No data received");
    }

    return result.data.updateBrandAgent;
  }

  async updateBrandAgentCampaign(
    apiKey: string,
    id: string,
    input: BrandAgentCampaignUpdateInput,
  ): Promise<BrandAgentCampaign> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: UPDATE_BRAND_AGENT_CAMPAIGN_MUTATION,
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
      updateBrandAgentCampaign: BrandAgentCampaign;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.updateBrandAgentCampaign) {
      throw new Error("No data received");
    }

    return result.data.updateBrandAgentCampaign;
  }

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

  // Update inventory option
  async updateInventoryOption(
    apiKey: string,
    optionId: string,
    input: InventoryOptionUpdateInput,
  ): Promise<InventoryOption> {
    const response = await fetch(this.graphqlUrl, {
      body: JSON.stringify({
        query: UPDATE_INVENTORY_OPTION_MUTATION,
        variables: { id: optionId, input },
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
      updateInventoryOption: InventoryOption;
    }>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.updateInventoryOption) {
      throw new Error("No data received");
    }

    return result.data.updateInventoryOption;
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

  // ========================================
  // CREATIVE MANAGEMENT METHODS (AdCP Pass-Through)
  // ========================================

  /**
   * Create a new creative with assets
   * Designed as pass-through to AdCP publishers
   */
  async createCreative(
    apiKey: string,
    buyerAgentId: string,
    input: Omit<CreateCreativeInput, 'buyerAgentId'>,
  ): Promise<Creative> {
    // STUB: Will pass through to AdCP publisher when available
    console.log('[STUB] createCreative - will pass through to AdCP publisher');
    console.log('Input:', { buyerAgentId, ...input });
    
    // Generate mock creative with human-readable structure
    const mockCreative: Creative = {
      creativeId: `creative_${Date.now()}`,
      creativeName: input.creativeName,
      creativeDescription: input.creativeDescription,
      version: '1.0.0',
      buyerAgentId,
      customerId: await this.getCustomerId(apiKey),
      
      assets: input.assets.map((asset, idx) => ({
        assetId: `asset_${Date.now()}_${idx}`,
        assetName: asset.assetName,
        assetType: asset.assetType,
        fileFormat: this.detectFileFormat(asset.fileUrl || ''),
        fileSizeBytes: 0, // Would be calculated
        fileUrl: asset.fileUrl || `https://stub.asset/${Date.now()}`,
        textContent: asset.textContent,
        assetRole: idx === 0 ? 'primary' : 'companion',
        tags: asset.tags || [],
        widthPixels: asset.widthPixels,
        heightPixels: asset.heightPixels,
        durationSeconds: asset.durationSeconds,
      })),
      
      primaryAssetId: input.assets.length > 0 ? `asset_${Date.now()}_0` : undefined,
      
      advertiserDomains: input.advertiserDomains,
      contentCategories: input.contentCategories || [],
      targetAudience: input.targetAudience,
      
      status: 'draft',
      createdDate: new Date().toISOString(),
      lastModifiedDate: new Date().toISOString(),
      createdBy: 'api_user',
      lastModifiedBy: 'api_user',
    };
    
    return mockCreative;
  }

  /**
   * List creatives for a buyer agent with optional filters
   * Will query AdCP publishers when backend is implemented
   */
  async listCreatives(
    apiKey: string,
    buyerAgentId: string,
    filter?: CreativeFilter,
    pagination?: PaginationInput,
    includeCampaigns?: boolean,
  ): Promise<CreativeListResponse> {
    // STUB: Will query AdCP publishers
    console.log('[STUB] listCreatives - will query AdCP publishers');
    console.log('Query:', { buyerAgentId, filter, pagination, includeCampaigns });
    
    return {
      items: [],
      totalCount: 0,
      pageInfo: { hasNextPage: false },
      summary: {
        totalCreatives: 0,
        byStatus: {},
        byAssetType: {},
        totalCampaigns: 0,
        averageAssetsPerCreative: 0,
      }
    };
  }

  /**
   * Get a single creative by ID
   */
  async getCreative(
    apiKey: string,
    creativeId: string,
  ): Promise<Creative> {
    // STUB: Will query AdCP publisher
    console.log('[STUB] getCreative - will query AdCP publisher');
    console.log('Query:', { creativeId });
    
    throw new Error('Creative not found (STUB)');
  }

  /**
   * Upload individual asset that can be used in creatives
   * Will delegate to appropriate AdCP publisher based on asset type
   */
  async uploadAsset(
    apiKey: string,
    buyerAgentId: string,
    asset: CreateAssetInput,
  ): Promise<CreativeAsset> {
    console.log('[STUB] uploadAsset - will pass through to AdCP publisher');
    console.log('Upload:', { buyerAgentId, asset });
    
    // Would delegate to appropriate AdCP publisher
    // based on asset type and buyer agent configuration
    
    const mockAsset: CreativeAsset = {
      assetId: `asset_${Date.now()}`,
      assetName: asset.assetName,
      assetType: asset.assetType,
      fileFormat: this.detectFileFormat(asset.fileUrl || ''),
      fileSizeBytes: 0,
      fileUrl: asset.fileUrl || `https://stub.asset/${Date.now()}`,
      textContent: asset.textContent,
      assetRole: asset.assetRole,
      tags: asset.tags || [],
      widthPixels: asset.widthPixels,
      heightPixels: asset.heightPixels,
      durationSeconds: asset.durationSeconds,
      customMetadata: asset.customMetadata,
    };
    
    return mockAsset;
  }

  /**
   * Assign creative to campaign (both must belong to same buyer agent)
   */
  async assignCreativeToCampaign(
    apiKey: string,
    creativeId: string,
    campaignId: string,
    buyerAgentId: string,
  ): Promise<AssignmentResult> {
    console.log('[STUB] assignCreativeToCampaign - will validate and assign');
    console.log('Assignment:', { creativeId, campaignId, buyerAgentId });
    
    // Would validate that both creative and campaign belong to the same buyer agent
    
    return {
      success: true,
      message: `[STUB] Creative ${creativeId} assigned to campaign ${campaignId}`,
      assignment: {
        campaignId,
        campaignName: 'Mock Campaign',
        assignedDate: new Date().toISOString(),
        isActive: true,
      }
    };
  }

  /**
   * Unassign creative from campaign
   */
  async unassignCreativeFromCampaign(
    apiKey: string,
    creativeId: string,
    campaignId: string,
  ): Promise<AssignmentResult> {
    console.log('[STUB] unassignCreativeFromCampaign');
    console.log('Unassignment:', { creativeId, campaignId });
    
    return {
      success: true,
      message: `[STUB] Creative ${creativeId} unassigned from campaign ${campaignId}`,
    };
  }

  /**
   * Get all creatives assigned to a specific campaign
   */
  async getCampaignCreatives(
    apiKey: string,
    campaignId: string,
  ): Promise<Creative[]> {
    console.log('[STUB] getCampaignCreatives - will query campaign assignments');
    console.log('Query:', { campaignId });
    
    return [];
  }

  /**
   * Parse creative prompt to detect required assets and types
   * Uses AI to understand natural language creative descriptions
   */
  async parseCreativePrompt(
    apiKey: string,
    prompt: string,
  ): Promise<{
    suggestedName: string;
    suggestedAssets: CreateAssetInput[];
    advertiserDomains?: string[];
    contentCategories?: string[];
  }> {
    console.log('[STUB] parseCreativePrompt - will use AI to parse prompt');
    console.log('Prompt:', prompt);
    
    // Would use AI to parse the natural language prompt
    // and suggest creative structure
    
    return {
      suggestedName: 'AI-Generated Creative Name',
      suggestedAssets: [
        {
          assetName: 'Generated from prompt',
          assetType: 'image',
          fileUrl: 'https://placeholder.com/generated',
        }
      ],
    };
  }

  /**
   * Detect file format from URL or filename
   * Helper method for asset management
   */
  private detectFileFormat(url: string): string {
    if (!url) return 'unknown';
    
    const extension = url.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'jpeg';
      case 'png':
        return 'png';
      case 'gif':
        return 'gif';
      case 'mp4':
        return 'mp4';
      case 'webm':
        return 'webm';
      case 'mp3':
        return 'mp3';
      case 'aac':
        return 'aac';
      case 'html':
      case 'htm':
        return 'html';
      default:
        return extension || 'unknown';
    }
  }
}
