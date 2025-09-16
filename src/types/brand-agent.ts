// Brand Agent types - represents advertiser/account level entities

import type { CampaignAlert } from "./reporting.js";
import type { TacticManagement } from "./tactics.js";

// Shared Agent Model type
export interface AgentModel {
  createdAt: Date;
  id: string;
  name: string;
  prompt: string;
  status: "CLASSIFYING" | "FALLBACK" | "PRIMARY" | "STAGING";
  updatedAt: Date;
}

// Renamed to match GraphQL schema
export interface AgentWhereInput {
  customerId?: { equals?: number };
  id?: { equals?: string };
  name?: { contains?: string };
}

export interface BrandAgent {
  // Shared marketing configuration
  advertiserDomains: string[]; // Domains where users will be sent from all campaigns/creatives
  createdAt: Date;
  customerId: number;
  description?: string;
  dspSeats?: string[]; // DSP seat IDs for PMP creation
  externalId?: string; // Customer-scoped external identifier (e.g., client's internal brand ID)
  id: string;
  name: string;
  nickname?: string; // Customer-scoped friendly name (e.g., "Nike" for "Nike c/o Kinesso")
  // Opt-in to tactic seed data cooperative for improved new tactic recommendations
  tacticSeedDataCoop?: boolean;

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
  // NEW: Summary delivery status (always included, lightweight)
  deliverySummary?: {
    // Active alerts
    alerts: CampaignAlert[];
    healthScore: "critical" | "healthy" | "warning";
    lastUpdated: Date;

    // Pacing
    pacing: {
      budgetUtilized: number; // Percentage (0-1)
      daysRemaining: number;
      projectedCompletion: Date;
      status: "on_track" | "over" | "under";
    };

    status: "completed" | "delivering" | "paused" | "scheduled";

    // Key metrics for quick status
    today: {
      averagePrice: number;
      impressions: number;
      spend: number;
    };
  };

  endDate?: Date;

  id: string;
  name: string;
  // NEW: Integrated notification thresholds
  notificationThresholds?: {
    delivery?: {
      fillRateThreshold?: number; // Alert if <X% fill rate
      minDailyImpressions?: number;
    };
    performance?: {
      maxCpm?: number;
      minConversionRate?: number;
      minCtr?: number;
    };
    spend?: {
      dailyMax?: number;
      pacingVariance?: number; // Alert if >X% over/under pace
      totalMax?: number;
    };
  };

  // Outcome score measurement timing
  outcomeScoreWindowDays?: number;

  prompt: string;

  // Scoring weights configuration
  scoringWeights?: {
    affinity: number; // Weight for brand story affinity score (0-1)
    outcome: number; // Weight for user-provided outcome score (0-1)
    quality: number; // Weight for Scope3 media quality score (0-1)
  };

  // Campaign scheduling (UTC timestamps)
  startDate?: Date;
  status: string;

  // Inventory management configuration
  tacticManagement?: TacticManagement;

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

  endDate?: Date;

  name: string;
  // Optional notification thresholds
  notificationThresholds?: {
    delivery?: {
      fillRateThreshold?: number;
      minDailyImpressions?: number;
    };
    performance?: {
      maxCpm?: number;
      minConversionRate?: number;
      minCtr?: number;
    };
    spend?: {
      dailyMax?: number;
      pacingVariance?: number;
      totalMax?: number;
    };
  };

  // Outcome score measurement timing
  outcomeScoreWindowDays?: number;

  prompt: string;

  // Scoring weights configuration
  scoringWeights?: {
    affinity: number; // Weight for brand story affinity score (0-1)
    outcome: number; // Weight for user-provided outcome score (0-1)
    quality: number; // Weight for Scope3 media quality score (0-1)
  };
  // Campaign scheduling (UTC timestamps)
  startDate?: Date;

  // Inventory management configuration
  tacticManagement?: TacticManagement;
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
  // Inventory management configuration
  tacticManagement?: Partial<TacticManagement>;
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

// Brand Agent Descriptor - flexible way to reference brand agents in MCP tools
export interface BrandAgentDescriptor {
  externalId?: string; // Customer's external identifier
  // At least one of these must be provided
  id?: string; // Our internal brand agent ID
  nickname?: string; // Customer's friendly name
}

export interface BrandAgentInput {
  advertiserDomains: string[]; // Required on creation
  description?: string;
  externalId?: string; // Customer-scoped external identifier
  name: string;
  nickname?: string; // Customer-scoped friendly name
  tacticSeedDataCoop?: boolean; // Opt-in to tactic seed data cooperative
}

// API Response types
export interface BrandAgentsData {
  brandAgents: BrandAgent[];
}

export interface BrandAgentUpdateInput {
  advertiserDomains?: string[];
  description?: string;
  dspSeats?: string[]; // For adding/updating DSP seats
  externalId?: string; // Customer-scoped external identifier
  name?: string;
  nickname?: string; // Customer-scoped friendly name
  tacticSeedDataCoop?: boolean; // Opt-in to tactic seed data cooperative
}

// Backward compatibility alias (deprecated)
export type BrandAgentWhereInput = AgentWhereInput;

// Brand Standards (configuration per brand agent)
export interface BrandStandards {
  brandAgentId: string;
  contentCategories?: string[];
  domainAllowlist?: string[];
  domainBlocklist?: string[];
  keywordFilters?: string[];
  updatedAt: Date;
}

// Brand Standards Agent types (agent-based standards using models)
export interface BrandStandardsAgent {
  brands: string[];
  channels: string[];
  countries: string[];
  createdAt: Date;
  id: string;
  languages: string[];
  models: AgentModel[];
  name: string;
  updatedAt: Date;
}

export interface BrandStandardsAgentInput {
  brandAgentId: string;
  brands?: string[];
  channelCodes?: string[];
  countryCodes?: string[];
  languages?: string[];
  name: string;
  prompt: string;
}

export interface BrandStandardsAgentsData {
  brandStandardsAgents: BrandStandardsAgent[];
}

export interface BrandStandardsInput {
  contentCategories?: string[];
  domainAllowlist?: string[];
  domainBlocklist?: string[];
  keywordFilters?: string[];
}

// Brand Story Agent types (agent-based stories using models)
export interface BrandStoryAgent {
  brands: string[];
  channels: string[];
  countries: string[];
  createdAt: Date;
  id: string;
  languages: string[];
  models: AgentModel[];
  name: string;
  updatedAt: Date;
}

export interface BrandStoryAgentInput {
  brandAgentId: string;
  brands?: string[];
  channelCodes?: string[];
  countryCodes?: string[];
  languages?: string[];
  name: string;
  prompt: string;
}

export interface BrandStoryAgentsData {
  brandStoryAgents: BrandStoryAgent[];
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
