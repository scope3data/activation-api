// Brand Agent types - represents advertiser/account level entities

export interface BrandAgent {
  createdAt: Date;
  customerId: number;
  description?: string;
  id: string;
  name: string;
  updatedAt: Date;
}

// Campaign types (owned by brand agent)
export interface BrandAgentCampaign {
  audienceIds: string[];
  brandAgentId: string;
  budget?: {
    currency: string;
    dailyCap?: number;
    pacing?: string;
    total: number;
  };
  createdAt: Date;
  creativeIds: string[];
  id: string;
  name: string;
  prompt: string;
  status: string;
  updatedAt: Date;
}

export interface BrandAgentCampaignInput {
  audienceIds?: string[];
  brandAgentId: string;
  budget?: {
    currency: string;
    dailyCap?: number;
    pacing?: string;
    total: number;
  };
  creativeIds?: string[];
  name: string;
  prompt: string;
}

export interface BrandAgentCampaignsData {
  brandAgentCampaigns: BrandAgentCampaign[];
}

export interface BrandAgentCampaignUpdateInput {
  audienceIds?: string[];
  budget?: {
    currency?: string;
    dailyCap?: number;
    pacing?: string;
    total?: number;
  };
  creativeIds?: string[];
  name?: string;
  prompt?: string;
  status?: string;
}

// Creative types (owned by brand agent)
export interface BrandAgentCreative {
  body?: string;
  brandAgentId: string;
  createdAt: Date;
  cta?: string;
  headline?: string;
  id: string;
  name: string;
  type: "html5" | "image" | "native" | "video";
  updatedAt: Date;
  url: string;
}

export interface BrandAgentCreativeInput {
  body?: string;
  brandAgentId: string;
  cta?: string;
  headline?: string;
  name: string;
  type: "html5" | "image" | "native" | "video";
  url: string;
}

export interface BrandAgentCreativesData {
  brandAgentCreatives: BrandAgentCreative[];
}

export interface BrandAgentCreativeUpdateInput {
  body?: string;
  cta?: string;
  headline?: string;
  name?: string;
  type?: "html5" | "image" | "native" | "video";
  url?: string;
}

export interface BrandAgentInput {
  description?: string;
  name: string;
}

// API Response types
export interface BrandAgentsData {
  brandAgents: BrandAgent[];
}

export interface BrandAgentUpdateInput {
  description?: string;
  name?: string;
}

export interface BrandAgentWhereInput {
  customerId?: { equals?: number };
  id?: { equals?: string };
  name?: { contains?: string };
}

// Brand Standards (configuration per brand agent)
export interface BrandStandards {
  brandAgentId: string;
  contentCategories?: string[];
  domainAllowlist?: string[];
  domainBlocklist?: string[];
  keywordFilters?: string[];
  updatedAt: Date;
}

export interface BrandStandardsInput {
  contentCategories?: string[];
  domainAllowlist?: string[];
  domainBlocklist?: string[];
  keywordFilters?: string[];
}

// Measurement Source types (owned by brand agent) - stub for now
export interface MeasurementSource {
  brandAgentId: string;
  configuration?: Record<string, unknown>;
  createdAt: Date;
  id: string;
  name: string;
  status: "active" | "error" | "inactive";
  type: "analytics" | "brand_study" | "conversion_api" | "mmm";
  updatedAt: Date;
}

export interface MeasurementSourceInput {
  brandAgentId: string;
  configuration?: Record<string, unknown>;
  name: string;
  type: "analytics" | "brand_study" | "conversion_api" | "mmm";
}

export interface MeasurementSourcesData {
  measurementSources: MeasurementSource[];
}

export interface MeasurementSourceUpdateInput {
  configuration?: Record<string, unknown>;
  name?: string;
  status?: "active" | "error" | "inactive";
  type?: "analytics" | "brand_study" | "conversion_api" | "mmm";
}

// Synthetic Audience types (owned by brand agent) - stub for now
export interface SyntheticAudience {
  brandAgentId: string;
  createdAt: Date;
  description?: string;
  id: string;
  name: string;
  updatedAt: Date;
}

export interface SyntheticAudienceInput {
  brandAgentId: string;
  description?: string;
  name: string;
}

export interface SyntheticAudiencesData {
  syntheticAudiences: SyntheticAudience[];
}

export interface SyntheticAudienceUpdateInput {
  description?: string;
  name?: string;
}
