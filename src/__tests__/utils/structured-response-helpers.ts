/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any */
import { expect } from "vitest";

/**
 * Structured Response Testing Utilities
 *
 * Provides validation helpers for the new MCP structured response format
 * that includes both human-readable messages and structured data objects.
 */

export interface StructuredMCPResponse<T = unknown> {
  data?: T;
  details?: unknown;
  error?: string;
  errorCode?: string;
  message: string;
  success: boolean;
}

export interface ValidatedAudience {
  brandAgentId: string;
  createdAt: Date | string;
  description: string;
  id: string;
  name: string;
  status: string;
  updatedAt: Date | string;
}

// Entity type definitions
export interface ValidatedBrandAgent {
  createdAt: Date | string;
  customerId: number;
  description?: string;
  id: string;
  name: string;
  updatedAt: Date | string;
}

export interface ValidatedBrandStandards {
  agentId: string;
  brandAgentId: string;
  createdAt: Date | string;
  id: string;
  name: string;
  status: string;
  updatedAt: Date | string;
}

export interface ValidatedBrandStory {
  brandAgentId: string;
  content: string;
  createdAt: Date | string;
  id: string;
  name: string;
  status: string;
  updatedAt: Date | string;
}

export interface ValidatedCampaign {
  brandAgentId: string;
  budget?: unknown;
  createdAt: Date | string;
  id: string;
  name: string;
  status: string;
  target?: unknown;
  updatedAt: Date | string;
}

export interface ValidatedCreative {
  brandAgentId: string;
  content?: unknown;
  creativeId: string;
  creativeName: string;
  format: string;
  status: string;
}

export interface ValidatedPMP {
  brandAgentId: string;
  createdAt: Date | string;
  dealId: string;
  id: string;
  name: string;
  publisherId: string;
  status: string;
  updatedAt: Date | string;
}

export interface ValidatedSignal {
  clusters: Array<{
    channel: string;
    gdpr: boolean;
    region: string;
  }>;
  createdAt: Date | string;
  description: string;
  id: string;
  key: string;
  name: string;
  updatedAt: Date | string;
}

export interface ValidatedTactic {
  campaignId: string;
  createdAt: Date | string;
  id: string;
  name: string;
  productId: string;
  status: string;
  updatedAt: Date | string;
}

/**
 * Validates an error response structure
 */
export function expectErrorResponse(
  responseString: string,
  expectedErrorMessage?: string,
): StructuredMCPResponse<null> {
  const response = expectStructuredResponse<null>(responseString);

  expect(response.success).toBe(false);
  expect(response).toHaveProperty("error");
  expect(typeof response.error).toBe("string");

  if (expectedErrorMessage) {
    expect(response.message).toContain(expectedErrorMessage);
  }

  return response;
}

/**
 * Validates a list response structure with count and items
 */
export function expectListResponse<T>(
  responseString: string,
  expectedCount?: number,
  itemValidator?: (item: T) => void,
): StructuredMCPResponse<{ [key: string]: number | T[]; count: number }> {
  const response = expectStructuredResponse(responseString);

  expect(response.success).toBe(true);
  expect(response.data).toBeDefined();

  if (response.data && typeof response.data === "object") {
    const dataObj = response.data as Record<string, unknown>;

    // Should have count
    expect(dataObj).toHaveProperty("count");
    expect(typeof dataObj.count).toBe("number");

    // Should have an array property (items/brandAgents/campaigns/etc)
    const arrayKey = Object.keys(dataObj).find(
      (key) => key !== "count" && Array.isArray(dataObj[key]),
    );
    expect(arrayKey).toBeDefined();

    if (arrayKey && dataObj[arrayKey]) {
      const items = dataObj[arrayKey] as T[];
      expect(Array.isArray(items)).toBe(true);

      // Count should match array length
      expect(dataObj.count).toBe(items.length);

      // If expected count provided, verify it
      if (expectedCount !== undefined) {
        expect(items).toHaveLength(expectedCount);
      }

      // Validate each item if validator provided
      if (itemValidator && items.length > 0) {
        items.forEach(itemValidator);
      }
    }
  }

  return response as StructuredMCPResponse<{
    [key: string]: number | T[];
    count: number;
  }>;
}

/**
 * Validates a single object response structure
 */
export function expectObjectResponse<T>(
  responseString: string,
  objectValidator?: (item: T) => void,
): StructuredMCPResponse<T> {
  const response = expectStructuredResponse<T>(responseString);

  expect(response.success).toBe(true);
  expect(response.data).toBeDefined();

  if (response.data && objectValidator) {
    objectValidator(response.data);
  }

  return response;
}

/**
 * Validates that a response follows the structured MCP format
 */
export function expectStructuredResponse<T>(
  responseString: string,
  expectedDataValidator?: (data: T) => void,
): StructuredMCPResponse<T> {
  // Should be valid JSON
  let parsed: StructuredMCPResponse<T>;
  expect(() => {
    parsed = JSON.parse(responseString);
  }).not.toThrow();

  parsed = JSON.parse(responseString);

  // Required fields
  expect(parsed).toHaveProperty("message");
  expect(parsed).toHaveProperty("success");
  expect(typeof parsed.message).toBe("string");
  expect(typeof parsed.success).toBe("boolean");

  // Message should be non-empty and human-readable
  expect(parsed.message.length).toBeGreaterThan(0);

  // If successful, should have data field for non-error responses
  if (parsed.success && !parsed.error) {
    expect(parsed).toHaveProperty("data");
  }

  // If data is provided, validate its structure
  if (parsed.data && expectedDataValidator) {
    expectedDataValidator(parsed.data);
  }

  return parsed;
}

/**
 * Brand Agent specific validators
 */
export const BrandAgentValidators = {
  validateBrandAgent: (agent: ValidatedBrandAgent) => {
    expect(agent).toHaveProperty("id");
    expect(agent).toHaveProperty("name");
    expect(agent).toHaveProperty("customerId");
    expect(agent).toHaveProperty("createdAt");
    expect(agent).toHaveProperty("updatedAt");

    expect(typeof agent.id).toBe("string");
    expect(typeof agent.name).toBe("string");
    expect(typeof agent.customerId).toBe("number");

    // Dates can be Date objects (service level) or strings (JSON serialized)
    expect(["string", "object"]).toContain(typeof agent.createdAt);
    expect(["string", "object"]).toContain(typeof agent.updatedAt);

    // If they're objects, they should be Date instances
    if (typeof agent.createdAt === "object") {
      expect(agent.createdAt).toBeInstanceOf(Date);
    }
    if (typeof agent.updatedAt === "object") {
      expect(agent.updatedAt).toBeInstanceOf(Date);
    }
  },

  validateCreateResponse: (responseString: string) =>
    expectObjectResponse(
      responseString,
      (data: { brandAgent: ValidatedBrandAgent }) => {
        // Create responses wrap the brand agent in a brandAgent property
        expect(data).toHaveProperty("brandAgent");
        BrandAgentValidators.validateBrandAgent(data.brandAgent);
      },
    ),

  validateGetResponse: (responseString: string) =>
    expectObjectResponse(
      responseString,
      (data: { brandAgent: ValidatedBrandAgent }) => {
        // Get responses wrap the brand agent in a brandAgent property
        expect(data).toHaveProperty("brandAgent");
        BrandAgentValidators.validateBrandAgent(data.brandAgent);
      },
    ),

  validateListResponse: (responseString: string, expectedCount?: number) =>
    expectListResponse<ValidatedBrandAgent>(
      responseString,
      expectedCount,
      BrandAgentValidators.validateBrandAgent,
    ),
};

/**
 * Campaign specific validators
 */
export const CampaignValidators = {
  validateCampaign: (campaign: ValidatedCampaign) => {
    expect(campaign).toHaveProperty("id");
    expect(campaign).toHaveProperty("name");
    expect(campaign).toHaveProperty("brandAgentId");
    expect(campaign).toHaveProperty("status");
    expect(campaign).toHaveProperty("createdAt");
    expect(campaign).toHaveProperty("updatedAt");

    expect(typeof campaign.id).toBe("string");
    expect(typeof campaign.name).toBe("string");
    expect(typeof campaign.brandAgentId).toBe("string");
    expect(typeof campaign.status).toBe("string");
    expect(["active", "paused", "completed", "draft"]).toContain(
      campaign.status,
    );
  },

  validateCreateResponse: (responseString: string) =>
    expectObjectResponse<{ campaign: ValidatedCampaign }>(
      responseString,
      (data) => {
        expect(data).toHaveProperty("campaign");
        CampaignValidators.validateCampaign(data.campaign);
      },
    ),

  validateListResponse: (responseString: string, expectedCount?: number) =>
    expectListResponse<ValidatedCampaign>(
      responseString,
      expectedCount,
      CampaignValidators.validateCampaign,
    ),
};

/**
 * Creative specific validators
 */
export const CreativeValidators = {
  validateCreateResponse: (responseString: string) =>
    expectObjectResponse<ValidatedCreative>(
      responseString,
      CreativeValidators.validateCreative,
    ),

  validateCreative: (creative: ValidatedCreative) => {
    expect(creative).toHaveProperty("creativeId");
    expect(creative).toHaveProperty("creativeName");
    expect(creative).toHaveProperty("brandAgentId");
    expect(creative).toHaveProperty("format");
    expect(creative).toHaveProperty("status");

    expect(typeof creative.creativeId).toBe("string");
    expect(typeof creative.creativeName).toBe("string");
    expect(typeof creative.brandAgentId).toBe("string");
    expect(typeof creative.format).toBe("string");
    expect(typeof creative.status).toBe("string");
  },

  validateGetResponse: (responseString: string) =>
    expectObjectResponse(
      responseString,
      (data: { creative: ValidatedCreative }) => {
        expect(data).toHaveProperty("creative");
        CreativeValidators.validateCreative(data.creative);
      },
    ),

  validateListResponse: (responseString: string, expectedCount?: number) =>
    expectListResponse<ValidatedCreative>(
      responseString,
      expectedCount,
      CreativeValidators.validateCreative,
    ),
};

/**
 * Signal specific validators
 */
export const SignalValidators = {
  validateCreateResponse: (responseString: string) =>
    expectObjectResponse<ValidatedSignal>(
      responseString,
      SignalValidators.validateSignal,
    ),

  validateListResponse: (responseString: string, expectedCount?: number) =>
    expectListResponse<ValidatedSignal>(
      responseString,
      expectedCount,
      SignalValidators.validateSignal,
    ),

  validateSignal: (signal: ValidatedSignal) => {
    expect(signal).toHaveProperty("id");
    expect(signal).toHaveProperty("name");
    expect(signal).toHaveProperty("key");
    expect(signal).toHaveProperty("description");
    expect(signal).toHaveProperty("clusters");
    expect(signal).toHaveProperty("createdAt");
    expect(signal).toHaveProperty("updatedAt");

    expect(typeof signal.id).toBe("string");
    expect(typeof signal.name).toBe("string");
    expect(typeof signal.key).toBe("string");
    expect(typeof signal.description).toBe("string");
    expect(Array.isArray(signal.clusters)).toBe(true);

    // Validate clusters
    if (signal.clusters.length > 0) {
      signal.clusters.forEach((cluster) => {
        expect(cluster).toHaveProperty("channel");
        expect(cluster).toHaveProperty("region");
        expect(cluster).toHaveProperty("gdpr");
        expect(typeof cluster.gdpr).toBe("boolean");
      });
    }
  },
};

/**
 * PMP specific validators
 */
export const PMPValidators = {
  validateCreateResponse: (responseString: string) =>
    expectObjectResponse(responseString, (data: { pmp: ValidatedPMP }) => {
      expect(data).toHaveProperty("pmp");
      PMPValidators.validatePMP(data.pmp);
    }),

  validateListResponse: (responseString: string, expectedCount?: number) =>
    expectListResponse<ValidatedPMP>(
      responseString,
      expectedCount,
      PMPValidators.validatePMP,
    ),

  validatePMP: (pmp: ValidatedPMP) => {
    expect(pmp).toHaveProperty("id");
    expect(pmp).toHaveProperty("name");
    expect(pmp).toHaveProperty("brandAgentId");
    expect(pmp).toHaveProperty("dealId");
    expect(pmp).toHaveProperty("publisherId");
    expect(pmp).toHaveProperty("status");
    expect(pmp).toHaveProperty("createdAt");
    expect(pmp).toHaveProperty("updatedAt");

    expect(typeof pmp.id).toBe("string");
    expect(typeof pmp.name).toBe("string");
    expect(typeof pmp.brandAgentId).toBe("string");
    expect(typeof pmp.dealId).toBe("string");
    expect(typeof pmp.publisherId).toBe("string");
    expect(typeof pmp.status).toBe("string");
  },
};

/**
 * Tactic specific validators
 */
export const TacticValidators = {
  validateCreateResponse: (responseString: string) =>
    expectObjectResponse(
      responseString,
      (data: { tactic: ValidatedTactic }) => {
        expect(data).toHaveProperty("tactic");
        TacticValidators.validateTactic(data.tactic);
      },
    ),

  validateListResponse: (responseString: string, expectedCount?: number) =>
    expectListResponse<ValidatedTactic>(
      responseString,
      expectedCount,
      TacticValidators.validateTactic,
    ),

  validateTactic: (tactic: ValidatedTactic) => {
    expect(tactic).toHaveProperty("id");
    expect(tactic).toHaveProperty("name");
    expect(tactic).toHaveProperty("campaignId");
    expect(tactic).toHaveProperty("productId");
    expect(tactic).toHaveProperty("status");
    expect(tactic).toHaveProperty("createdAt");
    expect(tactic).toHaveProperty("updatedAt");

    expect(typeof tactic.id).toBe("string");
    expect(typeof tactic.name).toBe("string");
    expect(typeof tactic.campaignId).toBe("string");
    expect(typeof tactic.productId).toBe("string");
    expect(typeof tactic.status).toBe("string");
  },
};

/**
 * Brand Story specific validators
 */
export const BrandStoryValidators = {
  validateBrandStory: (brandStory: ValidatedBrandStory) => {
    expect(brandStory).toHaveProperty("id");
    expect(brandStory).toHaveProperty("name");
    expect(brandStory).toHaveProperty("brandAgentId");
    expect(brandStory).toHaveProperty("content");
    expect(brandStory).toHaveProperty("status");
    expect(brandStory).toHaveProperty("createdAt");
    expect(brandStory).toHaveProperty("updatedAt");

    expect(typeof brandStory.id).toBe("string");
    expect(typeof brandStory.name).toBe("string");
    expect(typeof brandStory.brandAgentId).toBe("string");
    expect(typeof brandStory.content).toBe("string");
    expect(typeof brandStory.status).toBe("string");
  },

  validateCreateResponse: (responseString: string) =>
    expectObjectResponse(
      responseString,
      (data: { brandStory: ValidatedBrandStory }) => {
        expect(data).toHaveProperty("brandStory");
        BrandStoryValidators.validateBrandStory(data.brandStory);
      },
    ),

  validateListResponse: (responseString: string, expectedCount?: number) =>
    expectListResponse<ValidatedBrandStory>(
      responseString,
      expectedCount,
      BrandStoryValidators.validateBrandStory,
    ),
};

/**
 * Brand Standards specific validators
 */
export const BrandStandardsValidators = {
  validateBrandStandards: (standards: ValidatedBrandStandards) => {
    expect(standards).toHaveProperty("id");
    expect(standards).toHaveProperty("name");
    expect(standards).toHaveProperty("brandAgentId");
    expect(standards).toHaveProperty("agentId");
    expect(standards).toHaveProperty("status");
    expect(standards).toHaveProperty("createdAt");
    expect(standards).toHaveProperty("updatedAt");

    expect(typeof standards.id).toBe("string");
    expect(typeof standards.name).toBe("string");
    expect(typeof standards.brandAgentId).toBe("string");
    expect(typeof standards.agentId).toBe("string");
    expect(typeof standards.status).toBe("string");
  },

  validateCreateResponse: (responseString: string) =>
    expectObjectResponse(
      responseString,
      (data: { standardsAgent: ValidatedBrandStandards }) => {
        expect(data).toHaveProperty("standardsAgent");
        BrandStandardsValidators.validateBrandStandards(data.standardsAgent);
      },
    ),

  validateListResponse: (responseString: string, expectedCount?: number) =>
    expectListResponse<ValidatedBrandStandards>(
      responseString,
      expectedCount,
      BrandStandardsValidators.validateBrandStandards,
    ),
};

/**
 * Audience specific validators
 */
export const AudienceValidators = {
  validateAudience: (audience: ValidatedAudience) => {
    expect(audience).toHaveProperty("id");
    expect(audience).toHaveProperty("name");
    expect(audience).toHaveProperty("brandAgentId");
    expect(audience).toHaveProperty("description");
    expect(audience).toHaveProperty("status");
    expect(audience).toHaveProperty("createdAt");
    expect(audience).toHaveProperty("updatedAt");

    expect(typeof audience.id).toBe("string");
    expect(typeof audience.name).toBe("string");
    expect(typeof audience.brandAgentId).toBe("string");
    expect(typeof audience.description).toBe("string");
    expect(typeof audience.status).toBe("string");
  },

  validateCreateResponse: (responseString: string) =>
    expectObjectResponse(
      responseString,
      (data: { audience: ValidatedAudience }) => {
        expect(data).toHaveProperty("audience");
        AudienceValidators.validateAudience(data.audience);
      },
    ),

  validateListResponse: (responseString: string, expectedCount?: number) =>
    expectListResponse<ValidatedAudience>(
      responseString,
      expectedCount,
      AudienceValidators.validateAudience,
    ),
};

/**
 * Backwards compatibility helper - checks that response has message but doesn't require data
 */
export function expectLegacyCompatibleResponse(
  responseString: string,
): StructuredMCPResponse<unknown> {
  const response = JSON.parse(responseString);

  // Should always have message and success (legacy format)
  expect(response).toHaveProperty("message");
  expect(response).toHaveProperty("success");
  expect(typeof response.message).toBe("string");
  expect(typeof response.success).toBe("boolean");

  // May or may not have data (new format is optional for backwards compatibility)
  return response;
}
