export interface Agent {
  description?: string;
  id: string;
  models?: Array<{
    description?: string;
    id: string;
    name: string;
  }>;
  name: string;
}

export interface AgentsData {
  agents: Agent[];
}

export interface AgentWhereInput {
  customerId?: { equals?: number };
  id?: { equals?: string };
  name?: { contains?: string };
}

export interface APIAccessTokenInfo {
  createdAt: string;
  customerId: number;
  description?: string;
  expiresAt?: string;
  id: number;
  lastActivity?: string;
  lastUsageAt?: string;
  name: string;
  version: string;
}

export interface APIAccessTokenInfoList {
  tokens: APIAccessTokenInfo[];
}

export interface BitmapTargetingProfile {
  anyOf: string[];
  anyOfItems: TargetingItem[];
  createdAt: string;
  dimensionName: string;
  id: string;
  noneOf: string[];
  noneOfItems: TargetingItem[];
  strategyId: string;
  updatedAt: string;
}

export interface BitmapTargetingProfilePromptInput {
  anyOfItems: TargetingItemInput[];
  dimensionName: string;
  noneOfItems: TargetingItemInput[];
}

export interface BitmapTargetingProfilePromptResult {
  anyOfItems: TargetingItem[];
  dimensionName: string;
  errors: Array<{
    code: string;
    message: string;
  }>;
  noneOfItems: TargetingItem[];
}

export interface BrandAgentInput {
  id: number;
  name: string;
}

export interface CreateBitmapTargetingProfileData {
  createBitmapTargetingProfile: BitmapTargetingProfile;
}

export interface CreateBitmapTargetingProfileInput {
  anyOf: string[];
  customerId: string;
  dimensionName: string;
  noneOf: string[];
  strategyId: string;
}

export interface CreateStrategyData {
  createStrategy: StrategyResponse;
}

export interface CreateStrategyInput {
  brandStandardsAgentId?: string;
  brandStoryAgentIds?: string[];
  channelCodes?: string[];
  countryCodes?: string[];
  name: string;
  prompt?: string;
  smartPropertyListIds?: number[];
  strategyType: StrategyType;
  targetingProfileIds?: number[];
}

export interface GenerateUpdatedStrategyPromptData {
  generateUpdatedStrategyPrompt: string;
}

export interface GenerateUpdatedStrategyPromptInput {
  bitmapTargetingProfiles?: BitmapTargetingProfilePromptInput[];
  brandStandardsAgents: BrandAgentInput[];
  brandStoryAgents: BrandAgentInput[];
  channels: string[];
  countries: string[];
  currentPrompt: string;
  originalBitmapTargetingProfiles?: BitmapTargetingProfilePromptInput[];
  originalBrandStandardsAgents?: BrandAgentInput[];
  originalBrandStoryAgents?: BrandAgentInput[];
  originalChannels?: string[];
  originalCountries?: string[];
  strategyType: StrategyType;
}

export interface GetAPIAccessKeysData {
  getAPIAccessKeys: APIAccessTokenInfoList;
}

export interface GraphQLError {
  locations?: Array<{ column: number; line: number }>;
  message: string;
  path?: string[];
}

export interface GraphQLResponse<T> {
  data?: T;
  errors?: GraphQLError[];
}

export interface ParsedStrategyDetails {
  bitmapTargetingProfiles: BitmapTargetingProfilePromptResult[];
  brandStandardsAgents: ParsedStrategyDetailsBrandAgent[];
  brandStoryAgents: ParsedStrategyDetailsBrandAgent[];
  channels: null | string[];
  countries: null | string[];
  missing: string[];
  status: "error" | "success";
  strategyName: string;
}

export interface ParsedStrategyDetailsBrandAgent {
  id: number;
  name: string;
}

export interface ParseStrategyPromptData {
  parseStrategyPrompt: ParsedStrategyDetails;
}

export interface ParseStrategyPromptInput {
  availableBrandStandardsAgents?: BrandAgentInput[];
  availableBrandStoryAgents?: BrandAgentInput[];
  availableChannels?: string[];
  availableCountries?: string[];
  prompt: string;
  strategyType: StrategyType;
}

export interface Strategy {
  channelCodes: string[];
  countryCodes: string[];
  createdAt: string;
  id: string;
  name: string;
  prompt?: string;
  strategyType: StrategyType;
  updatedAt: string;
}

export interface StrategyErrorGQL {
  code: string;
  message?: string;
  rootCause?: unknown;
}

export type StrategyResponse = Strategy | StrategyErrorGQL;

export type StrategyType = "INTELLIGENT_PMPS" | "MEDIA_BUYS";

export interface TargetingDimension {
  description?: string;
  id: string;
  name: string;
  type: "BIT_MAP" | "CATEGORICAL";
}

export interface TargetingItem {
  description?: string;
  dimensionName: string;
  displayName: string;
  id: string;
  key: string;
}

export interface TargetingItemInput {
  id: number;
  key: string;
  name: string;
}

export interface TargetingProfile {
  category: string;
  categoryDescription: string;
  excludeTargets: Array<{
    description: string;
    id: string;
    name: string;
  }>;
  includeTargets: Array<{
    description: string;
    id: string;
    name: string;
  }>;
  issues: string[];
}

export interface UpdateStrategyInput {
  brandStandardsAgentId?: string;
  brandStoryAgentIds?: string[];
  channelCodes?: string[];
  countryCodes?: string[];
  name?: string;
  prompt?: string;
  strategyId: string;
}
