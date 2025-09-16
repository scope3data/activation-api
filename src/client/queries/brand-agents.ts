// GraphQL queries for brand agent operations

export const CREATE_BRAND_AGENT_MUTATION = `
  mutation CreateBrandAgent($input: BrandAgentInput!) {
    createBrandAgent(input: $input) {
      id
      name
      description
      customerId
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_BRAND_AGENT_MUTATION = `
  mutation UpdateBrandAgent($id: ID!, $input: BrandAgentUpdateInput!) {
    updateBrandAgent(id: $id, input: $input) {
      id
      name
      description
      customerId
      createdAt
      updatedAt
    }
  }
`;

export const DELETE_BRAND_AGENT_MUTATION = `
  mutation DeleteBrandAgent($id: ID!) {
    deleteBrandAgent(id: $id) {
      success
    }
  }
`;

export const GET_BRAND_AGENT_QUERY = `
  query GetBrandAgent($id: ID!) {
    brandAgent(id: $id) {
      id
      name
      description
      customerId
      createdAt
      updatedAt
    }
  }
`;

export const LIST_BRAND_AGENTS_QUERY = `
  query ListBrandAgents($where: AgentWhereInput) {
    brandAgents(where: $where) {
      id
      name
      description
      customerId
      createdAt
      updatedAt
    }
  }
`;

// Brand Agent Campaign queries
export const CREATE_BRAND_AGENT_CAMPAIGN_MUTATION = `
  mutation CreateBrandAgentCampaign($input: BrandAgentCampaignInput!) {
    createBrandAgentCampaign(input: $input) {
      id
      brandAgentId
      name
      prompt
      budget {
        total
        currency
        dailyCap
        pacing
      }
      creativeIds
      audienceIds
      status
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_BRAND_AGENT_CAMPAIGN_MUTATION = `
  mutation UpdateBrandAgentCampaign($id: ID!, $input: BrandAgentCampaignUpdateInput!) {
    updateBrandAgentCampaign(id: $id, input: $input) {
      id
      brandAgentId
      name
      prompt
      budget {
        total
        currency
        dailyCap
        pacing
      }
      creativeIds
      audienceIds
      status
      createdAt
      updatedAt
    }
  }
`;

export const LIST_BRAND_AGENT_CAMPAIGNS_QUERY = `
  query ListBrandAgentCampaigns($brandAgentId: ID!, $status: String) {
    brandAgentCampaigns(brandAgentId: $brandAgentId, status: $status) {
      id
      brandAgentId
      name
      prompt
      budget {
        total
        currency
        dailyCap
        pacing
      }
      creativeIds
      audienceIds
      status
      createdAt
      updatedAt
    }
  }
`;

// Brand Agent Creative queries
export const CREATE_BRAND_AGENT_CREATIVE_MUTATION = `
  mutation CreateBrandAgentCreative($input: BrandAgentCreativeInput!) {
    createBrandAgentCreative(input: $input) {
      id
      brandAgentId
      name
      type
      url
      headline
      body
      cta
      createdAt
      updatedAt
    }
  }
`;

export const UPDATE_BRAND_AGENT_CREATIVE_MUTATION = `
  mutation UpdateBrandAgentCreative($id: ID!, $input: BrandAgentCreativeUpdateInput!) {
    updateBrandAgentCreative(id: $id, input: $input) {
      id
      brandAgentId
      name
      type
      url
      headline
      body
      cta
      createdAt
      updatedAt
    }
  }
`;

export const LIST_BRAND_AGENT_CREATIVES_QUERY = `
  query ListBrandAgentCreatives($brandAgentId: ID!) {
    brandAgentCreatives(brandAgentId: $brandAgentId) {
      id
      brandAgentId
      name
      type
      url
      headline
      body
      cta
      createdAt
      updatedAt
    }
  }
`;

// Brand Standards Agent queries
export const LIST_BRAND_AGENT_STANDARDS_QUERY = `
  query ListBrandAgentStandards($brandAgentId: BigInt!) {
    brandStandardsAgents(where: { brandAgentId: { equals: $brandAgentId }, archivedAt: { equals: null }}) {
      id
      name
      brands
      channels
      countries
      languages
      models(where: { status: { equals: PRIMARY }}) {
        id
        name
        prompt
        createdAt
        updatedAt
      }
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_BRAND_AGENT_STANDARDS_MUTATION = `
  mutation CreateBrandStandardsAgent(
    $brandAgentId: BigInt!
    $name: String!
    $prompt: String!
    $brands: [String!]
    $channelCodes: [String!]
    $countryCodes: [String!]
    $languages: [String!]
  ) {
    createBrandStandardsAgent(
      brandAgentId: $brandAgentId
      name: $name
      brands: $brands
      channelCodes: $channelCodes
      countryCodes: $countryCodes
      languages: $languages
    ) {
      id
      name
      brands
      channels
      countries
      languages
      createdAt
      updatedAt
    }
    createAgentModel(
      agentId: $id
      name: $name
      prompt: $prompt
      isPrimary: true
    ) {
      id
      name
      prompt
      status
      createdAt
    }
  }
`;

export const UPDATE_BRAND_AGENT_STANDARDS_MUTATION = `
  mutation UpdateBrandAgentStandards(
    $agentId: BigInt!
    $name: String!
    $prompt: String!
  ) {
    createAgentModel(
      agentId: $agentId
      name: $name
      prompt: $prompt
      isPrimary: true
    ) {
      id
      name
      prompt
      status
      createdAt
    }
  }
`;

export const DELETE_BRAND_AGENT_STANDARDS_MUTATION = `
  mutation DeleteBrandStandardsAgent($id: BigInt!) {
    updateAgent(
      where: { id: $id }
      data: { archivedAt: { set: $now } }
    ) {
      id
      archivedAt
    }
  }
`;

// Synthetic Audience queries
export const LIST_BRAND_AGENT_SYNTHETIC_AUDIENCES_QUERY = `
  query ListBrandAgentSyntheticAudiences($brandAgentId: BigInt!) {
    brandStoryAgents(where: { brandAgentId: { equals: $brandAgentId }, archivedAt: { equals: null }}) {
      id
      name
      brands
      channels
      countries
      languages
      models(where: { status: { equals: PRIMARY }}) {
        id
        name
        prompt
        createdAt
        updatedAt
      }
      createdAt
      updatedAt
    }
  }
`;

export const CREATE_BRAND_AGENT_SYNTHETIC_AUDIENCE_MUTATION = `
  mutation CreateBrandSyntheticAudience(
    $brandAgentId: BigInt!
    $name: String!
    $prompt: String!
    $brands: [String!]
    $channelCodes: [String!]
    $countryCodes: [String!]
    $languages: [String!]
  ) {
    createBrandStoryAgent(
      brandAgentId: $brandAgentId
      name: $name
      brands: $brands
      channelCodes: $channelCodes
      countryCodes: $countryCodes
      languages: $languages
      publishStory: true
    ) {
      id
      name
      brands
      channels
      countries
      languages
      models(where: { status: { equals: PRIMARY }}) {
        id
        name
        prompt
        createdAt
      }
      createdAt
      updatedAt
    }
    createAgentModel(
      agentId: $id
      name: $name
      prompt: $prompt
      isPrimary: true
    ) {
      id
      name
      prompt
      status
      createdAt
    }
  }
`;

export const UPDATE_BRAND_AGENT_SYNTHETIC_AUDIENCE_MUTATION = `
  mutation UpdateBrandSyntheticAudience(
    $previousModelId: BigInt!
    $name: String!
    $prompt: String!
  ) {
    updateBrandStory(
      previousModelId: $previousModelId
      name: $name
      prompt: $prompt
    ) {
      id
      name
      prompt
      status
      createdAt
    }
  }
`;

export const DELETE_BRAND_AGENT_SYNTHETIC_AUDIENCE_MUTATION = `
  mutation DeleteBrandSyntheticAudience($id: BigInt!) {
    updateAgent(
      where: { id: $id }
      data: { archivedAt: { set: $now } }
    ) {
      id
      archivedAt
    }
  }
`;

// Legacy stub queries - these are replaced by the real synthetic audience queries above
// Keeping these for backward compatibility temporarily
export const CREATE_SYNTHETIC_AUDIENCE_MUTATION =
  CREATE_BRAND_AGENT_SYNTHETIC_AUDIENCE_MUTATION;
export const LIST_SYNTHETIC_AUDIENCES_QUERY =
  LIST_BRAND_AGENT_SYNTHETIC_AUDIENCES_QUERY;

// Measurement Source queries (stub)
export const ADD_MEASUREMENT_SOURCE_MUTATION = `
  mutation AddMeasurementSource($input: MeasurementSourceInput!) {
    addMeasurementSource(input: $input) {
      id
      brandAgentId
      name
      type
      configuration
      status
      createdAt
      updatedAt
    }
  }
`;

export const LIST_MEASUREMENT_SOURCES_QUERY = `
  query ListMeasurementSources($brandAgentId: ID!) {
    measurementSources(brandAgentId: $brandAgentId) {
      id
      brandAgentId
      name
      type
      configuration
      status
      createdAt
      updatedAt
    }
  }
`;
