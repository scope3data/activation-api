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
  BrandAgent,
  BrandAgentsData,
  BrandAgentInput,
  BrandAgentUpdateInput,
  BrandAgentWhereInput,
  BrandAgentCampaign,
  BrandAgentCampaignsData,
  BrandAgentCampaignInput,
  BrandAgentCampaignUpdateInput,
  BrandAgentCreative,
  BrandAgentCreativesData,
  BrandAgentCreativeInput,
  BrandAgentCreativeUpdateInput,
  BrandStandards,
  BrandStandardsInput,
  SyntheticAudience,
  SyntheticAudiencesData,
  SyntheticAudienceInput,
  MeasurementSource,
  MeasurementSourcesData,
  MeasurementSourceInput,
} from "../types/brand-agent.js";

import { GET_AGENTS_QUERY } from "./queries/agents.js";
import { GET_API_ACCESS_KEYS_QUERY } from "./queries/auth.js";
import {
  CREATE_BRAND_AGENT_MUTATION,
  UPDATE_BRAND_AGENT_MUTATION,
  DELETE_BRAND_AGENT_MUTATION,
  GET_BRAND_AGENT_QUERY,
  LIST_BRAND_AGENTS_QUERY,
  CREATE_BRAND_AGENT_CAMPAIGN_MUTATION,
  UPDATE_BRAND_AGENT_CAMPAIGN_MUTATION,
  LIST_BRAND_AGENT_CAMPAIGNS_QUERY,
  CREATE_BRAND_AGENT_CREATIVE_MUTATION,
  UPDATE_BRAND_AGENT_CREATIVE_MUTATION,
  LIST_BRAND_AGENT_CREATIVES_QUERY,
  SET_BRAND_STANDARDS_MUTATION,
  GET_BRAND_STANDARDS_QUERY,
  CREATE_SYNTHETIC_AUDIENCE_MUTATION,
  LIST_SYNTHETIC_AUDIENCES_QUERY,
  ADD_MEASUREMENT_SOURCE_MUTATION,
  LIST_MEASUREMENT_SOURCES_QUERY,
} from "./queries/brand-agents.js";
import {
  CREATE_STRATEGY_MUTATION,
  GENERATE_UPDATED_STRATEGY_PROMPT_QUERY,
  PARSE_STRATEGY_PROMPT_QUERY,
  UPDATE_ONE_STRATEGY_MUTATION,
} from "./queries/campaigns.js";
import {
  CREATE_BITMAP_TARGETING_PROFILE_MUTATION,
  GET_TARGETING_DIMENSIONS_QUERY,
} from "./queries/targeting.js";

export class Scope3ApiClient {
  private graphqlUrl: string;

  constructor(graphqlUrl: string) {
    this.graphqlUrl = graphqlUrl;
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

    const result = (await response.json()) as GraphQLResponse<BrandAgentCampaignsData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.brandAgentCampaigns) {
      throw new Error("No data received");
    }

    return result.data.brandAgentCampaigns;
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

    const result = (await response.json()) as GraphQLResponse<BrandAgentCreativesData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.brandAgentCreatives) {
      throw new Error("No data received");
    }

    return result.data.brandAgentCreatives;
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

    const result = (await response.json()) as GraphQLResponse<SyntheticAudiencesData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.syntheticAudiences) {
      throw new Error("No data received");
    }

    return result.data.syntheticAudiences;
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

    const result = (await response.json()) as GraphQLResponse<MeasurementSourcesData>;

    if (result.errors && result.errors.length > 0) {
      throw new Error("Invalid request parameters or query");
    }

    if (!result.data?.measurementSources) {
      throw new Error("No data received");
    }

    return result.data.measurementSources;
  }
}
