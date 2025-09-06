export const PARSE_STRATEGY_PROMPT_QUERY = `
  query ParseStrategyPrompt(
    $availableBrandStandardsAgents: [BrandAgentInput!]
    $availableBrandStoryAgents: [BrandAgentInput!]
    $availableChannels: [String!]
    $availableCountries: [String!]
    $prompt: String!
    $strategyType: StrategyType!
  ) {
    parseStrategyPrompt(
      availableBrandStandardsAgents: $availableBrandStandardsAgents
      availableBrandStoryAgents: $availableBrandStoryAgents
      availableChannels: $availableChannels
      availableCountries: $availableCountries
      prompt: $prompt
      strategyType: $strategyType
    ) {
      brandStandardsAgents {
        id
        name
      }
      brandStoryAgents {
        id
        name
      }
      bitmapTargetingProfiles {
        dimensionName
        anyOfItems {
          id
          key
          displayName
          dimensionName
          description
        }
        noneOfItems {
          id
          key
          displayName
          dimensionName
          description
        }
        errors {
          code
          message
        }
      }
      channels
      countries
      missing
      status
      strategyName
    }
  }
`;

export const GENERATE_UPDATED_STRATEGY_PROMPT_QUERY = `
  query GenerateUpdatedStrategyPrompt(
    $bitmapTargetingProfiles: [BitmapTargetingProfilePromptInput!]
    $brandStandardsAgents: [BrandAgentInput!]!
    $brandStoryAgents: [BrandAgentInput!]!
    $channels: [String!]!
    $countries: [String!]!
    $currentPrompt: String!
    $originalBitmapTargetingProfiles: [BitmapTargetingProfilePromptInput!]
    $originalBrandStandardsAgents: [BrandAgentInput!]
    $originalBrandStoryAgents: [BrandAgentInput!]
    $originalChannels: [String!]
    $originalCountries: [String!]
    $strategyType: StrategyType!
  ) {
    generateUpdatedStrategyPrompt(
      bitmapTargetingProfiles: $bitmapTargetingProfiles
      brandStandardsAgents: $brandStandardsAgents
      brandStoryAgents: $brandStoryAgents
      channels: $channels
      countries: $countries
      currentPrompt: $currentPrompt
      originalBitmapTargetingProfiles: $originalBitmapTargetingProfiles
      originalBrandStandardsAgents: $originalBrandStandardsAgents
      originalBrandStoryAgents: $originalBrandStoryAgents
      originalChannels: $originalChannels
      originalCountries: $originalCountries
      strategyType: $strategyType
    )
  }
`;

export const CREATE_STRATEGY_MUTATION = `
  mutation CreateStrategy(
    $agentId: BigInt
    $brandStandardsAgentId: BigInt
    $brandStoryAgentIds: [BigInt!]
    $channelCodes: [String!]
    $countryCodes: [String!]
    $name: String!
    $prompt: String
    $smartPropertyListIds: [Float!]
    $strategyType: StrategyType
    $targetingProfileIds: [Float!]
  ) {
    createStrategy(
      agentId: $agentId
      brandStandardsAgentId: $brandStandardsAgentId
      brandStoryAgentIds: $brandStoryAgentIds
      channelCodes: $channelCodes
      countryCodes: $countryCodes
      name: $name
      prompt: $prompt
      smartPropertyListIds: $smartPropertyListIds
      strategyType: $strategyType
      targetingProfileIds: $targetingProfileIds
    ) {
      id
      name
      prompt
      strategyType
      channelCodes
      countryCodes
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_ONE_STRATEGY_MUTATION = `
  mutation UpdateOneStrategy(
    $strategyId: Float!
    $name: String
    $prompt: String
    $channelCodes: [String!]
    $countryCodes: [String!]
    $brandStandardsAgentId: BigInt
    $brandStoryAgentIds: [BigInt!]
  ) {
    updateOneStrategy(
      strategyId: $strategyId
      name: $name
      prompt: $prompt
      channelCodes: $channelCodes
      countryCodes: $countryCodes
      brandStandardsAgentId: $brandStandardsAgentId
      brandStoryAgentIds: $brandStoryAgentIds
    ) {
      id
      errors
    }
  }
`;
