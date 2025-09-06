// Brand Agent types - represents advertiser/account level entities

export interface BrandAgent {
  id: string;
  name: string;
  description?: string;
  customerId: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandAgentInput {
  name: string;
  description?: string;
}

export interface BrandAgentUpdateInput {
  name?: string;
  description?: string;
}

export interface BrandAgentWhereInput {
  id?: { equals?: string };
  name?: { contains?: string };
  customerId?: { equals?: number };
}

// Campaign types (owned by brand agent)
export interface BrandAgentCampaign {
  id: string;
  brandAgentId: string;
  name: string;
  prompt: string;
  budget?: {
    total: number;
    currency: string;
    dailyCap?: number;
    pacing?: string;
  };
  creativeIds: string[];
  audienceIds: string[];
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandAgentCampaignInput {
  brandAgentId: string;
  name: string;
  prompt: string;
  budget?: {
    total: number;
    currency: string;
    dailyCap?: number;
    pacing?: string;
  };
  creativeIds?: string[];
  audienceIds?: string[];
}

export interface BrandAgentCampaignUpdateInput {
  name?: string;
  prompt?: string;
  budget?: {
    total?: number;
    currency?: string;
    dailyCap?: number;
    pacing?: string;
  };
  creativeIds?: string[];
  audienceIds?: string[];
  status?: string;
}

// Creative types (owned by brand agent)
export interface BrandAgentCreative {
  id: string;
  brandAgentId: string;
  name: string;
  type: 'image' | 'video' | 'native' | 'html5';
  url: string;
  headline?: string;
  body?: string;
  cta?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BrandAgentCreativeInput {
  brandAgentId: string;
  name: string;
  type: 'image' | 'video' | 'native' | 'html5';
  url: string;
  headline?: string;
  body?: string;
  cta?: string;
}

export interface BrandAgentCreativeUpdateInput {
  name?: string;
  type?: 'image' | 'video' | 'native' | 'html5';
  url?: string;
  headline?: string;
  body?: string;
  cta?: string;
}

// Brand Standards (configuration per brand agent)
export interface BrandStandards {
  brandAgentId: string;
  domainBlocklist?: string[];
  domainAllowlist?: string[];
  keywordFilters?: string[];
  contentCategories?: string[];
  updatedAt: Date;
}

export interface BrandStandardsInput {
  domainBlocklist?: string[];
  domainAllowlist?: string[];
  keywordFilters?: string[];
  contentCategories?: string[];
}

// Synthetic Audience types (owned by brand agent) - stub for now
export interface SyntheticAudience {
  id: string;
  brandAgentId: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyntheticAudienceInput {
  brandAgentId: string;
  name: string;
  description?: string;
}

export interface SyntheticAudienceUpdateInput {
  name?: string;
  description?: string;
}

// Measurement Source types (owned by brand agent) - stub for now
export interface MeasurementSource {
  id: string;
  brandAgentId: string;
  name: string;
  type: 'conversion_api' | 'analytics' | 'brand_study' | 'mmm';
  configuration?: Record<string, any>;
  status: 'active' | 'inactive' | 'error';
  createdAt: Date;
  updatedAt: Date;
}

export interface MeasurementSourceInput {
  brandAgentId: string;
  name: string;
  type: 'conversion_api' | 'analytics' | 'brand_study' | 'mmm';
  configuration?: Record<string, any>;
}

export interface MeasurementSourceUpdateInput {
  name?: string;
  type?: 'conversion_api' | 'analytics' | 'brand_study' | 'mmm';
  configuration?: Record<string, any>;
  status?: 'active' | 'inactive' | 'error';
}

// API Response types
export interface BrandAgentsData {
  brandAgents: BrandAgent[];
}

export interface BrandAgentCampaignsData {
  brandAgentCampaigns: BrandAgentCampaign[];
}

export interface BrandAgentCreativesData {
  brandAgentCreatives: BrandAgentCreative[];
}

export interface SyntheticAudiencesData {
  syntheticAudiences: SyntheticAudience[];
}

export interface MeasurementSourcesData {
  measurementSources: MeasurementSource[];
}