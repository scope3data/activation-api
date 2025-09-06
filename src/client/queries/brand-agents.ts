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
  query ListBrandAgents($where: BrandAgentWhereInput) {
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

// Brand Standards queries
export const SET_BRAND_STANDARDS_MUTATION = `
  mutation SetBrandStandards($brandAgentId: ID!, $input: BrandStandardsInput!) {
    setBrandStandards(brandAgentId: $brandAgentId, input: $input) {
      brandAgentId
      domainBlocklist
      domainAllowlist
      keywordFilters
      contentCategories
      updatedAt
    }
  }
`;

export const GET_BRAND_STANDARDS_QUERY = `
  query GetBrandStandards($brandAgentId: ID!) {
    brandStandards(brandAgentId: $brandAgentId) {
      brandAgentId
      domainBlocklist
      domainAllowlist
      keywordFilters
      contentCategories
      updatedAt
    }
  }
`;

// Synthetic Audience queries (stub)
export const CREATE_SYNTHETIC_AUDIENCE_MUTATION = `
  mutation CreateSyntheticAudience($input: SyntheticAudienceInput!) {
    createSyntheticAudience(input: $input) {
      id
      brandAgentId
      name
      description
      createdAt
      updatedAt
    }
  }
`;

export const LIST_SYNTHETIC_AUDIENCES_QUERY = `
  query ListSyntheticAudiences($brandAgentId: ID!) {
    syntheticAudiences(brandAgentId: $brandAgentId) {
      id
      brandAgentId
      name
      description
      createdAt
      updatedAt
    }
  }
`;

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
