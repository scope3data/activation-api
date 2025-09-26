// Tactics types - manages publisher products with targeting strategies

// Budget allocation for a tactic
export interface BudgetAllocation {
  amount: number;
  currency: string;
  dailyCap?: number;
  pacing: "asap" | "even" | "front_loaded";
  percentage?: number; // % of total campaign budget
}

// Creative format types
export type CreativeFormat = "audio" | "display" | "html5" | "native" | "video";

// Pricing after signal costs are applied
export interface EffectivePricing {
  cpm: number; // Base CPM from publisher
  currency: string;
  signalCost?: number; // Additional cost for data signals
  totalCpm: number; // Final effective CPM
}

// Optimization types
export type OptimizationGoal =
  | "clicks"
  | "conversions"
  | "cost_efficiency"
  | "frequency"
  | "impressions"
  | "reach";

export interface OptimizationRecommendations {
  generatedAt: Date;
  goal: OptimizationGoal;
  projectedImprovement: {
    currentValue: number;
    improvement: number; // percentage
    metric: string;
    projectedValue: number;
  };
  suggestions: OptimizationSuggestion[];
}

export interface OptimizationSuggestion {
  confidence: number; // 0-1 scale
  currentOptionId: string;
  expectedImpact: string;
  reason: string;
  suggestedBudgetChange: number; // positive = increase, negative = decrease
}

// Query parameters for discovering publisher products
export interface ProductDiscoveryQuery {
  campaignBrief?: string; // Natural language description
  deliveryType?: "guaranteed" | "non_guaranteed";
  formats?: CreativeFormat[];
  inventoryType?: "premium" | "run_of_site" | "targeted_package";
  maxCpm?: number;
  minCpm?: number;
  publisherIds?: string[];
  supportedSignals?: ("buyer" | "scope3" | "third_party")[];
  targetingRequirements?: string[];
}

// Publisher's raw media product from AdCP
export interface PublisherMediaProduct {
  // Base pricing (before our signals)
  basePricing: {
    fixedCpm?: number;
    floorCpm?: number;
    model: "auction" | "fixed_cpm";
    targetCpm?: number; // Price guidance for auction
  };
  // Metadata
  createdAt: Date;
  deliveryType: "guaranteed" | "non_guaranteed";
  description: string;
  // Product characteristics
  formats: CreativeFormat[];
  id: string;

  inventoryType: "premium" | "run_of_site" | "targeted_package";
  name: string;
  productId: string; // Publisher's internal product ID

  publisherId: string;

  publisherName: string;

  // Available targeting dimensions this product supports
  supportedTargeting?: string[];
  updatedAt: Date;
}

// Input types for creating tactics
export interface PublisherMediaProductInput {
  basePricing: {
    fixedCpm?: number;
    floorCpm?: number;
    model: "auction" | "fixed_cpm";
    targetCpm?: number;
  };
  deliveryType: "guaranteed" | "non_guaranteed";
  description: string;
  formats: CreativeFormat[];
  inventoryType: "premium" | "run_of_site" | "targeted_package";
  name: string;
  productId: string;
  publisherId: string;
  supportedTargeting?: string[];
}

// Response types
export interface PublisherMediaProductsData {
  publisherMediaProducts: PublisherMediaProduct[];
}

// Signal configuration for targeting
export interface SignalConfiguration {
  audienceIds?: string[];
  customParameters?: Record<string, unknown>;
  segments?: string[];
}

// Our tactic (product + targeting)
export interface Tactic {
  brandStoryId?: string; // Simplified targeting - brand story ID
  // Budget allocation for this tactic
  budgetAllocation: BudgetAllocation;
  campaignId: string;
  // Metadata
  createdAt: Date;
  description?: string;

  // Effective pricing (may differ based on signal type)
  effectivePricing: EffectivePricing;

  id: string;

  // The underlying publisher product
  mediaProduct: PublisherMediaProduct;

  name: string; // e.g., "Hulu Premium + Scope3 Signals"

  performance?: TacticPerformance;
  salesAgentId?: string; // Sales agent handling this tactic
  signalId?: string; // Simplified targeting - optional signal ID
  // Status and performance
  status:
    | "active"
    | "completed"
    | "draft"
    | "failed"
    | "paused"
    | "pending_approval";

  // Our targeting layer (legacy complex targeting)
  targeting?: TargetingStrategy;
  updatedAt: Date;
}

export interface TacticInput {
  brandStoryId?: string; // Simplified targeting approach
  budgetAllocation: BudgetAllocation;
  campaignId: string;
  cpm?: number; // Direct CPM specification
  description?: string;
  mediaProductId: string; // Reference to existing publisher product
  name: string;
  signalId?: string; // Optional signal for enhanced targeting
  targeting?: TargetingStrategy; // Legacy complex targeting (optional for backward compatibility)
}

// Campaign tactic management configuration
export interface TacticManagement {
  // Auto-discovery settings
  autoDiscoverProducts?: boolean;
  autoOptimize?: boolean;
  // Budget constraints
  budgetSplit?: {
    guaranteed: number; // percentage
    nonGuaranteed: number; // percentage
  };
  discoveryCriteria?: ProductDiscoveryQuery;

  mode: "hybrid" | "scope3_managed" | "user_managed";

  optimizationGoal?:
    | "clicks"
    | "conversions"
    | "cost_efficiency"
    | "impressions";

  // Signal preferences
  preferredSignals?: ("buyer" | "scope3" | "third_party")[];
  tactics?: Tactic[];
}

// Performance metrics for a tactic
export interface TacticPerformance {
  clicks?: number;
  conversions?: number;
  cpa?: number; // Cost per acquisition
  cpc?: number; // Cost per click
  cpm: number; // Actual CPM achieved
  ctr?: number; // Click-through rate
  cvr?: number; // Conversion rate
  impressions: number;
  lastUpdated: Date;
  spend: number;
}

export interface TacticsData {
  tactics: Tactic[];
}

export interface TacticUpdateInput {
  budgetAllocation?: Partial<BudgetAllocation>;
  description?: string;
  name?: string;
  status?:
    | "active"
    | "completed"
    | "draft"
    | "failed"
    | "paused"
    | "pending_approval";
  targeting?: Partial<TargetingStrategy>;
}

// Targeting strategy applied to a media product
export interface TargetingStrategy {
  // Additional targeting from campaign
  inheritFromCampaign: boolean;
  overrides?: {
    demographics?: Record<string, unknown>;
    geo?: string[];
    interests?: string[];
  };
  signalConfiguration?: SignalConfiguration;

  signalProvider?: string; // e.g., "LiveRamp", "Scope3", etc.
  signalType: "buyer" | "none" | "scope3" | "third_party";
}
