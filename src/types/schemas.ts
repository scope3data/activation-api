// Shared Zod schemas for MCP tools

import { z } from "zod";

/**
 * Brand Agent Descriptor Schema
 *
 * Flexible way to reference brand agents in MCP tools.
 * Supports lookup by our internal ID, customer's external ID, or customer's nickname.
 * At least one field must be provided.
 */
export const BrandAgentDescriptorSchema = z
  .object({
    externalId: z
      .string()
      .optional()
      .describe(
        "Your external identifier for this brand agent (e.g., client code or account ID)",
      ),
    id: z
      .string()
      .optional()
      .describe("Our internal brand agent ID (e.g., 'ba_nike_123')"),
    nickname: z
      .string()
      .optional()
      .describe(
        "Your friendly name for this brand agent (e.g., 'Nike' for 'Nike c/o Kinesso')",
      ),
  })
  .refine((data) => data.id || data.externalId || data.nickname, {
    message: "At least one of id, externalId, or nickname must be provided",
    path: ["brandAgent"],
  });

export type BrandAgentDescriptorInput = z.infer<
  typeof BrandAgentDescriptorSchema
>;
