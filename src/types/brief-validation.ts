export enum BriefQualityLevel {
  COMPREHENSIVE = "Comprehensive Brief",
  MINIMAL = "Minimal Brief",
  NO_BRIEF = "No Brief",
  STANDARD = "Standard Brief",
}

export interface BriefValidationRequest {
  brandAgentId?: string;
  brief: string;
  threshold?: number;
}

export interface BriefValidationResult {
  feedback: string;
  meetsThreshold: boolean;
  missingElements: string[];
  qualityLevel: BriefQualityLevel;
  score: number;
  suggestions: string[];
  threshold: number;
}

export interface IBriefValidationService {
  validateBrief(
    request: BriefValidationRequest,
  ): Promise<BriefValidationResult>;
}

export interface ValidateBriefParams {
  brandAgentId?: string;
  brief: string;
  threshold?: number;
}

// Add to existing MCP types
declare module "./mcp.js" {
  interface CreateCampaignParams {
    briefValidationThreshold?: number;
    skipBriefValidation?: boolean;
  }
}
