export interface BriefValidationRequest {
  brief: string;
  threshold?: number;
  brandAgentId?: string;
}

export interface BriefValidationResult {
  score: number;
  meetsThreshold: boolean;
  threshold: number;
  feedback: string;
  suggestions: string[];
  missingElements: string[];
  qualityLevel: BriefQualityLevel;
}

export interface IBriefValidationService {
  validateBrief(request: BriefValidationRequest): Promise<BriefValidationResult>;
}

export enum BriefQualityLevel {
  NO_BRIEF = "No Brief",
  MINIMAL = "Minimal Brief", 
  STANDARD = "Standard Brief",
  COMPREHENSIVE = "Comprehensive Brief"
}

export interface ValidateBriefParams {
  brief: string;
  threshold?: number;
  brandAgentId?: string;
}

// Add to existing MCP types
declare module "./mcp.js" {
  interface CreateCampaignParams {
    skipBriefValidation?: boolean;
    briefValidationThreshold?: number;
  }
}