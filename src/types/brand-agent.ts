// Brand Agent types - represents advertiser/account level entities

import type { InventoryManagement } from "./inventory-options.js";
import type { CampaignAlert } from "./reporting.js";

export interface BrandAgent {
  // Shared marketing configuration
  advertiserDomains: string[]; // Domains where users will be sent from all campaigns/creatives
  createdAt: Date;
  customerId: number;
  description?: string;
  dspSeats?: string[]; // DSP seat IDs for PMP creation
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

  id: string;

  // Inventory management configuration
  inventoryManagement?: InventoryManagement;
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

  // Inventory management configuration
  inventoryManagement?: InventoryManagement;

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

  // Inventory management configuration
  inventoryManagement?: Partial<InventoryManagement>;

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
  advertiserDomains: string[]; // Required on creation
  description?: string;
  name: string;
}

// API Response types
export interface BrandAgentsData {
  brandAgents: BrandAgent[];
}

export interface BrandAgentUpdateInput {
  advertiserDomains?: string[];
  description?: string;
  dspSeats?: string[]; // For adding/updating DSP seats
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
